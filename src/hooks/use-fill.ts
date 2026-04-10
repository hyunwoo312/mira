import { useState, useCallback, useEffect } from 'react';
import type { Profile } from '@/lib/schema';
import { profileToFillMap } from '@/lib/autofill/profile-map';
import { loadFiles } from '@/lib/file-storage';
import { saveApplication, parsePageTitle } from '@/lib/application-store';

export interface FillLogItem {
  field: string;
  value: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: 'static-map' | 'heuristic' | 'options' | 'ml' | 'answer-bank' | 'rescan';
  confidence?: number;
  widgetType?: string;
  category?: string;
  sectionHeading?: string;
  groupLabels?: string[];
  elementHint?: string;
  skipReason?: string;
  failReason?: string;
  attemptedValue?: string;
}

interface FillState {
  isLoading: boolean;
  result: {
    filled: number;
    failed: number;
    skipped: number;
    total: number;
    durationMs?: number;
    mlAvailable?: boolean;
    ats?: string;
    totalFormElements?: number;
  } | null;
  logs: FillLogItem[];
  pageUrl: string;
  error: string | null;
}

export function useFill(presetId?: string) {
  const [state, setState] = useState<FillState>({
    isLoading: false,
    result: null,
    logs: [],
    pageUrl: '',
    error: null,
  });

  const fill = useCallback(
    async (profile: Profile) => {
      setState({ isLoading: true, result: null, logs: [], pageUrl: '', error: null });

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          setState({
            isLoading: false,
            result: { filled: 0, failed: 0, skipped: 0, total: 0 },
            logs: [],
            pageUrl: '',
            error: null,
          });
          return;
        }

        const tabId = tab.id;

        // Check if content script is already in the main frame
        let needsInjection = false;
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'PING' }, { frameId: 0 });
        } catch {
          needsInjection = true;
        }

        // Detect which frame has the form
        let targetFrameId = 0;
        const frames = await chrome.webNavigation.getAllFrames({ tabId });

        if (frames && frames.length > 1) {
          // Multi-frame page — check all frames for forms
          // Inject into frames that don't have content script yet
          for (const frame of frames) {
            try {
              await chrome.tabs.sendMessage(tabId, { type: 'PING' }, { frameId: frame.frameId });
            } catch {
              // This frame needs injection — page-script first (MAIN world), then content script
              await chrome.scripting
                .executeScript({
                  target: { tabId, frameIds: [frame.frameId] },
                  files: ['content-scripts/page-script.js'],
                  world: 'MAIN' as chrome.scripting.ExecutionWorld,
                })
                .catch(() => {});
              await chrome.scripting
                .executeScript({
                  target: { tabId, frameIds: [frame.frameId] },
                  files: ['content-scripts/content.js'],
                })
                .catch(() => {});
            }
          }
          if (needsInjection) await new Promise((r) => setTimeout(r, 200));

          for (const frame of frames) {
            try {
              const det = await chrome.tabs.sendMessage(
                tabId,
                { type: 'DETECT_FORM' },
                { frameId: frame.frameId },
              );
              if (det?.hasForm) {
                targetFrameId = frame.frameId;
                if (!det.isTop) break;
              }
            } catch {
              // Frame doesn't have content script
            }
          }
        } else if (needsInjection) {
          await chrome.scripting
            .executeScript({
              target: { tabId, allFrames: true },
              files: ['content-scripts/page-script.js'],
              world: 'MAIN' as chrome.scripting.ExecutionWorld,
            })
            .catch(() => {});
          await chrome.scripting
            .executeScript({
              target: { tabId, allFrames: true },
              files: ['content-scripts/content.js'],
            })
            .catch(() => {});
          await new Promise((r) => setTimeout(r, 200));
        }

        const fillMap = profileToFillMap(profile);

        const files = await loadFiles(presetId);
        const activeResume = files.find((f) => f.category === 'resume' && f.isActive);
        const activeCoverLetter = files.find((f) => f.category === 'cover_letter' && f.isActive);
        if (activeResume) {
          fillMap.resume = JSON.stringify({
            name: activeResume.name,
            type: activeResume.type,
            data: activeResume.data,
          });
        }
        if (activeCoverLetter) {
          fillMap.coverLetter = JSON.stringify({
            name: activeCoverLetter.name,
            type: activeCoverLetter.type,
            data: activeCoverLetter.data,
          });
        }

        const answerBank = (profile.answerBank ?? []).filter((a) => a.question && a.answer);
        // Pass profile for Workday's sequential experience filling
        const profileData = {
          workExperience: profile.workExperience,
          education: profile.education,
          linkedin: profile.linkedin,
          github: profile.github,
          portfolio: profile.portfolio,
        };
        const fillMessage = { type: 'FILL', fillMap, answerBank, profile: profileData };

        const response = await chrome.tabs
          .sendMessage(tabId, fillMessage, { frameId: targetFrameId })
          .catch(() => ({ result: { filled: 0, total: 0, failed: 0, skipped: 0, logs: [] } }));

        const res = response?.result ?? { filled: 0, failed: 0, skipped: 0, total: 0, logs: [] };

        // Auto-save to application history (only for supported ATS)
        const atsName = res.ats ?? 'generic';
        if (res.total > 0 && atsName !== 'generic') {
          const pageUrl = tab.url ?? '';
          const {
            company,
            role,
            location: urlLocation,
          } = parsePageTitle(tab.title ?? '', pageUrl, atsName);

          // Extract location from page DOM (skip for Workday — already extracted from URL)
          let location = urlLocation;
          if (!location) {
            try {
              const [metaResult] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                  // Greenhouse (native + embedded)
                  let loc =
                    document
                      .querySelector('.job__location div, .job__location')
                      ?.textContent?.trim() ?? '';
                  if (!loc)
                    loc =
                      document
                        .querySelector('#header .location, .app-title .location')
                        ?.textContent?.trim() ?? '';
                  // Lever
                  if (!loc)
                    loc =
                      document
                        .querySelector('.posting-categories .sort-by-time, .location')
                        ?.textContent?.trim() ?? '';
                  // Ashby — location section with heading
                  if (!loc) {
                    const headings = document.querySelectorAll('h2, h3');
                    for (const h of headings) {
                      if (/^location$/i.test(h.textContent?.trim() ?? '')) {
                        const sibling = h.nextElementSibling;
                        if (sibling) {
                          loc = sibling.textContent?.trim() ?? '';
                          break;
                        }
                      }
                    }
                  }
                  // Generic fallback
                  if (!loc)
                    loc =
                      document
                        .querySelector('[class*="location" i]:not(input):not(select)')
                        ?.textContent?.trim() ?? '';
                  return loc.slice(0, 100);
                },
              });
              if (metaResult?.result) {
                location = metaResult.result;
              }
            } catch {
              /* Scripting may fail on some pages */
            }
          }

          saveApplication({
            url: pageUrl,
            company,
            role,
            location,
            ats: res.ats ?? 'generic',
            timestamp: Date.now(),
            filled: res.filled,
            failed: res.failed ?? 0,
            skipped: res.skipped ?? 0,
            total: res.total,
            durationMs: res.durationMs ?? 0,
          }).catch(() => {});
        }

        setState({
          isLoading: false,
          result: {
            filled: res.filled,
            failed: res.failed ?? 0,
            skipped: res.skipped ?? 0,
            total: res.total,
            durationMs: res.durationMs,
            mlAvailable: res.mlAvailable,
            ats: res.ats,
            totalFormElements: res.totalFormElements,
          },
          logs: res.logs ?? [],
          pageUrl: tab.url ?? '',
          error: null,
        });
      } catch (err) {
        setState({
          isLoading: false,
          result: null,
          logs: [],
          pageUrl: '',
          error: err instanceof Error ? err.message : 'Fill failed unexpectedly',
        });
      }
    },
    [presetId],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null, logs: [], pageUrl: '', error: null });
  }, []);

  useEffect(() => {
    const handleTabChange = () => {
      setState((prev) =>
        prev.result ? { isLoading: false, result: null, logs: [], pageUrl: '', error: null } : prev,
      );
    };
    const handleTabUpdate = (_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (changeInfo.url) handleTabChange();
    };
    chrome.tabs.onActivated.addListener(handleTabChange);
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange);
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    };
  }, []);

  return { ...state, fill, reset };
}
