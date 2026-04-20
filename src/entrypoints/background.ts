/**
 * Service worker: manages side panel behavior, offscreen document
 * lifecycle (lazy ML loading with idle timeout), fill orchestration,
 * context menu, keyboard shortcut, and message routing.
 */

import type { ModelStatus } from '@/lib/ml/types';
import { logger } from '@/lib/logger';
import { profileToFillMap } from '@/lib/autofill/profile-map';
import { loadPresetStore } from '@/lib/storage';
import { loadFiles } from '@/lib/file-storage';
import { saveApplication, parsePageTitle } from '@/lib/application-store';
import { loadSettings } from '@/lib/settings';
import { ML_IDLE_TIMEOUT_MS, FILL_COUNT_KEY, CHANGELOG_KEY } from '@/lib/constants';

const SALARY_KEYS = ['salaryMin', 'salaryMax', 'salaryRange'];
const EEO_KEYS = [
  'gender',
  'transgender',
  'sexualOrientation',
  'race',
  'veteranStatus',
  'disabilityStatus',
  'lgbtq',
  'communities',
];

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // ── State ──────────────────────────────────────────────────────────
  let offscreenReady = false;
  let mlStatus: ModelStatus = 'idle';
  let sidePanelPort: chrome.runtime.Port | null = null;
  let fillInProgress = false;
  let lastFillResult: {
    result: unknown;
    logs: unknown[];
    pageUrl: string;
    error: string | null;
  } | null = null;

  const ML_IDLE_ALARM = 'mira-ml-idle';

  // ── Idle timeout (uses chrome.alarms to survive SW sleep) ──────────
  function resetIdleTimer() {
    chrome.alarms.create(ML_IDLE_ALARM, {
      delayInMinutes: ML_IDLE_TIMEOUT_MS / 60_000,
    });
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ML_IDLE_ALARM) {
      destroyOffscreen();
    }
  });

  // ── Offscreen lifecycle ────────────────────────────────────────────
  async function ensureOffscreen(): Promise<void> {
    // Fast path: everything is known to be ready
    if (offscreenReady && mlStatus === 'ready') {
      resetIdleTimer();
      return;
    }

    // Ensure offscreen document exists
    if (!offscreenReady) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      });
      if (contexts.length > 0) {
        offscreenReady = true;
      } else {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: [chrome.offscreen.Reason.WORKERS],
          justification: 'ML model inference for field classification',
        });
        offscreenReady = true;
        // Brief wait for offscreen JS listener to register
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // Ensure model is loaded — send OFFSCREEN_LOAD_MODEL which is
    // idempotent (classifier.load returns immediately if already ready)
    if (mlStatus !== 'ready') {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_LOAD_MODEL' });
          if (res?.success) {
            // classifier.load() returned — model is either freshly loaded or was already ready.
            // Query actual status since the ready callback may not have fired yet.
            try {
              const statusRes = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_GET_STATUS' });
              if (statusRes?.status) {
                mlStatus = statusRes.status as ModelStatus;
              }
            } catch {
              // If status query fails, trust the success response
              mlStatus = 'ready';
            }
            break;
          }
        } catch {
          // Offscreen listener not ready yet — retry after delay
          if (attempt < 4) {
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            logger.error('Model failed to load after 5 attempts', 'background');
          }
        }
      }
    }

    resetIdleTimer();
  }

  async function destroyOffscreen(): Promise<void> {
    if (!offscreenReady) return;
    try {
      await chrome.runtime.sendMessage({ type: 'OFFSCREEN_UNLOAD' }).catch(() => {});
      await chrome.offscreen.closeDocument();
    } catch {
      // Already closed
    }
    offscreenReady = false;
    mlStatus = 'idle';
  }

  // ── Fill orchestration ─────────────────────────────────────────────
  async function executeFill(
    presetId?: string,
    onPhase?: (phase: 'injected' | 'filling') => void,
  ): Promise<{
    result: {
      filled: number;
      failed: number;
      skipped: number;
      total: number;
      durationMs?: number;
      mlAvailable?: boolean;
      ats?: string;
      totalFormElements?: number;
    };
    logs: unknown[];
    pageUrl: string;
    error: string | null;
  }> {
    const store = await loadPresetStore();
    const targetPresetId = presetId ?? store.activePresetId;
    const preset = store.presets.find((p) => p.id === targetPresetId);
    if (!preset) {
      return {
        result: { filled: 0, failed: 0, skipped: 0, total: 0 },
        logs: [],
        pageUrl: '',
        error: 'Preset not found',
      };
    }

    const profile = preset.profile;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return {
        result: { filled: 0, failed: 0, skipped: 0, total: 0 },
        logs: [],
        pageUrl: '',
        error: null,
      };
    }

    const tabId = tab.id;

    // Inject content scripts on demand (dedup guards in each script prevent double-init)
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

    // Scripts injected — overlay can now receive messages
    onPhase?.('injected');

    // Detect which frame has the form
    let targetFrameId = 0;
    const frames = await chrome.webNavigation.getAllFrames({ tabId });

    if (frames && frames.length > 1) {
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
          // Frame doesn't have content script (restricted frame)
        }
      }
    }

    const settings = await loadSettings();

    if (!settings.mlDisabled) {
      await ensureOffscreen();
    }
    onPhase?.('filling');

    const fillMap = profileToFillMap(profile);
    if (settings.skipSalary) {
      for (const k of SALARY_KEYS) delete fillMap[k];
    }
    if (settings.skipEeo) {
      for (const k of EEO_KEYS) delete fillMap[k];
    }

    const files = await loadFiles(targetPresetId);
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

    const answerBank = (profile.answerBank ?? []).filter(
      (a: { question?: string; answer?: string }) => a.question && a.answer,
    );
    const profileData = {
      workExperience: profile.workExperience,
      education: profile.education,
      linkedin: profile.linkedin,
      github: profile.github,
      portfolio: profile.portfolio,
    };
    const fillMessage = {
      type: 'FILL',
      fillMap,
      answerBank,
      profile: profileData,
      settings: {
        mlDisabled: settings.mlDisabled,
        verboseLogging: settings.verboseLogging,
      },
    };

    const response = await chrome.tabs
      .sendMessage(tabId, fillMessage, { frameId: targetFrameId })
      .catch(() => ({ result: { filled: 0, total: 0, failed: 0, skipped: 0, logs: [] } }));

    const res = response?.result ?? { filled: 0, failed: 0, skipped: 0, total: 0, logs: [] };

    const atsName = res.ats ?? 'generic';
    if (settings.saveApplications && res.total > 0 && atsName !== 'generic') {
      const pageUrl = tab.url ?? '';
      const {
        company,
        role,
        location: urlLocation,
      } = parsePageTitle(tab.title ?? '', pageUrl, atsName);

      let location = urlLocation;
      if (!location) {
        try {
          const [metaResult] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              let loc =
                document.querySelector('.job__location div, .job__location')?.textContent?.trim() ??
                '';
              if (!loc)
                loc =
                  document
                    .querySelector('#header .location, .app-title .location')
                    ?.textContent?.trim() ?? '';
              if (!loc)
                loc =
                  document
                    .querySelector('.posting-categories .sort-by-time, .location')
                    ?.textContent?.trim() ?? '';
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

    // Increment fill count for rate prompt
    if (res.filled > 0) {
      chrome.storage.local.get(FILL_COUNT_KEY).then((data) => {
        const count = ((data[FILL_COUNT_KEY] as number) ?? 0) + 1;
        chrome.storage.local.set({ [FILL_COUNT_KEY]: count });
      });
    }

    return {
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
    };
  }

  // ── Context menu ───────────────────────────────────────────────────
  chrome.runtime.onInstalled.addListener((details) => {
    // Context menu
    chrome.contextMenus.create({
      id: 'mira-fill',
      title: 'Mira: Auto-fill',
      contexts: ['page'],
    });
    // Add preset sub-items
    loadPresetStore().then((store) => {
      if (store.presets.length > 1) {
        for (const preset of store.presets) {
          chrome.contextMenus.create({
            id: `mira-fill-${preset.id}`,
            parentId: 'mira-fill',
            title: preset.name,
            contexts: ['page'],
          });
        }
      }
    });

    // Changelog flag
    if (details.reason === 'update') {
      const version = chrome.runtime.getManifest().version;
      chrome.storage.local.set({ [CHANGELOG_KEY]: version });
    }
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    const menuId = info.menuItemId as string;
    if (!menuId.startsWith('mira-fill')) return;

    const presetId = menuId === 'mira-fill' ? undefined : menuId.replace('mira-fill-', '');

    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;

      const settings = await loadSettings();
      const notify = (msg: Record<string, unknown>) => {
        if (!tabId) return;
        if (
          settings.hideOverlay &&
          typeof msg.type === 'string' &&
          msg.type.startsWith('FILL_OVERLAY')
        )
          return;
        chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }).catch(() => {});
      };

      try {
        fillInProgress = true;
        lastFillResult = null;
        sidePanelPort?.postMessage({ type: 'FILL_STARTED' });

        const fillResult = await executeFill(presetId, (phase) => {
          if (phase === 'injected') {
            notify({ type: 'FILL_OVERLAY_SHOW', phase: 'ml-loading' });
          } else {
            notify({ type: 'FILL_OVERLAY_SHOW', phase: 'filling' });
          }
        });

        fillInProgress = false;
        lastFillResult = fillResult;
        notify({
          type: 'FILL_OVERLAY_RESULT',
          result: fillResult.result,
          logs: (fillResult.logs as unknown[]).slice(0, 200),
        });
        sidePanelPort?.postMessage({ type: 'FILL_RESULT', ...fillResult });
      } catch {
        fillInProgress = false;
        notify({ type: 'FILL_OVERLAY_DISMISS' });
        sidePanelPort?.postMessage({
          type: 'FILL_RESULT',
          result: { filled: 0, failed: 0, skipped: 0, total: 0 },
          logs: [],
          pageUrl: '',
          error: 'Fill failed',
        });
      }
    })();
  });

  // Rebuild context menus when presets change
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['mira_presets']) {
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'mira-fill',
          title: 'Mira: Auto-fill',
          contexts: ['page'],
        });
        loadPresetStore().then((store) => {
          if (store.presets.length > 1) {
            for (const preset of store.presets) {
              chrome.contextMenus.create({
                id: `mira-fill-${preset.id}`,
                parentId: 'mira-fill',
                title: preset.name,
                contexts: ['page'],
              });
            }
          }
        });
      });
    }
  });

  // ── Keyboard shortcut ──────────────────────────────────────────────
  chrome.commands.onCommand.addListener((command) => {
    if (command !== 'trigger-fill') return;

    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;

      const settings = await loadSettings();
      const notify = (msg: Record<string, unknown>) => {
        if (!tabId) return;
        if (
          settings.hideOverlay &&
          typeof msg.type === 'string' &&
          msg.type.startsWith('FILL_OVERLAY')
        )
          return;
        chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }).catch(() => {});
      };

      try {
        fillInProgress = true;
        lastFillResult = null;
        sidePanelPort?.postMessage({ type: 'FILL_STARTED' });

        const fillResult = await executeFill(undefined, (phase) => {
          if (phase === 'injected') {
            notify({ type: 'FILL_OVERLAY_SHOW', phase: 'ml-loading' });
          } else {
            notify({ type: 'FILL_OVERLAY_SHOW', phase: 'filling' });
          }
        });

        fillInProgress = false;
        lastFillResult = fillResult;
        notify({
          type: 'FILL_OVERLAY_RESULT',
          result: fillResult.result,
          logs: (fillResult.logs as unknown[]).slice(0, 200),
        });

        sidePanelPort?.postMessage({ type: 'FILL_RESULT', ...fillResult });
      } catch {
        fillInProgress = false;
        notify({ type: 'FILL_OVERLAY_DISMISS' });
        sidePanelPort?.postMessage({
          type: 'FILL_RESULT',
          result: { filled: 0, failed: 0, skipped: 0, total: 0 },
          logs: [],
          pageUrl: '',
          error: 'Fill failed',
        });
      }
    })();
  });

  // (changelog flag is set in the onInstalled listener above)

  // ── Sidepanel port (passive — no ML lifecycle control) ─────────────
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sidepanel') return;

    sidePanelPort = port;

    // Send current ML status immediately
    port.postMessage({ type: 'ML_STATUS', status: mlStatus });

    // If a fill is in progress or just completed, sync sidepanel
    if (fillInProgress) {
      port.postMessage({ type: 'FILL_STARTED' });
    } else if (lastFillResult) {
      port.postMessage({ type: 'FILL_RESULT', ...lastFillResult });
    }

    // Query actual status from offscreen (may exist even if offscreenReady
    // is false after service worker restart)
    chrome.runtime
      .sendMessage({ type: 'OFFSCREEN_GET_STATUS' })
      .then((res) => {
        if (res?.status) {
          mlStatus = res.status as ModelStatus;
          offscreenReady = true;
          port.postMessage({ type: 'ML_STATUS', status: mlStatus });
        }
      })
      .catch(() => {
        // No offscreen running — status stays as-is
      });

    port.onDisconnect.addListener(() => {
      sidePanelPort = null;
    });
  });

  // ── Message routing ────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Reject messages that didn't originate from this extension. MV3 without
    // `externally_connectable` already blocks foreign origins, but the id
    // check is cheap defense-in-depth.
    if (sender.id && sender.id !== chrome.runtime.id) return false;

    if (message.type === 'OPEN_SIDE_PANEL') {
      const tabId = sender.tab?.id;
      if (tabId) {
        chrome.sidePanel.open({ tabId }).catch(() => {});
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'ML_STATUS') {
      mlStatus = message.status as ModelStatus;
      sidePanelPort?.postMessage(message);
      return false;
    }

    if (message.type === 'TRIGGER_FILL') {
      (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id;
        const settings = await loadSettings();
        const notify = (msg: Record<string, unknown>) => {
          if (!tabId) return;
          if (
            settings.hideOverlay &&
            typeof msg.type === 'string' &&
            msg.type.startsWith('FILL_OVERLAY')
          )
            return;
          chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }).catch(() => {});
        };

        try {
          fillInProgress = true;
          lastFillResult = null;
          const fillResult = await executeFill(message.presetId, (phase) => {
            if (phase === 'injected') {
              notify({ type: 'FILL_OVERLAY_SHOW', phase: 'ml-loading' });
            } else {
              notify({ type: 'FILL_OVERLAY_SHOW', phase: 'filling' });
            }
          });
          fillInProgress = false;
          lastFillResult = fillResult;
          notify({
            type: 'FILL_OVERLAY_RESULT',
            result: fillResult.result,
            logs: (fillResult.logs as unknown[]).slice(0, 200),
          });
          sendResponse(fillResult);
        } catch (err) {
          fillInProgress = false;
          notify({ type: 'FILL_OVERLAY_DISMISS' });
          const error = err instanceof Error ? err.message : 'Fill failed unexpectedly';
          sendResponse({
            result: { filled: 0, failed: 0, skipped: 0, total: 0 },
            logs: [],
            pageUrl: '',
            error,
          });
        }
      })();
      return true;
    }

    const FORWARDS: Record<
      string,
      {
        offscreen: string;
        payload: (m: Record<string, unknown>) => Record<string, unknown>;
        fallback: Record<string, unknown>;
      }
    > = {
      ML_CLASSIFY: {
        offscreen: 'OFFSCREEN_CLASSIFY',
        payload: (m) => ({ fields: m.fields }),
        fallback: { classifications: [] },
      },
      ML_MATCH_ANSWERS: {
        offscreen: 'OFFSCREEN_MATCH_ANSWERS',
        payload: (m) => ({ fieldLabels: m.fieldLabels, questions: m.questions }),
        fallback: { matches: [] },
      },
      ML_SCORE_OPTIONS: {
        offscreen: 'OFFSCREEN_SCORE_OPTIONS',
        payload: (m) => ({
          question: m.question,
          profileValue: m.profileValue,
          options: m.options,
        }),
        fallback: { bestIndex: -1, score: 0 },
      },
    };

    const forwardConfig = FORWARDS[message.type];
    if (forwardConfig) {
      (async () => {
        try {
          await ensureOffscreen();
          resetIdleTimer();
          const response = await chrome.runtime.sendMessage({
            type: forwardConfig.offscreen,
            requestId: crypto.randomUUID(),
            ...forwardConfig.payload(message),
          });
          sendResponse(response ?? { ...forwardConfig.fallback, error: 'No response' });
        } catch (err: unknown) {
          sendResponse({
            ...forwardConfig.fallback,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })();
      return true;
    }

    if (message.type === 'ML_GET_STATUS') {
      sendResponse({ status: mlStatus });
      return true;
    }

    return false;
  });
});
