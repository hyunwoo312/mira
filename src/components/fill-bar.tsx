import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  AlertTriangle,
  Copy,
  CheckCheck,
  RotateCcw,
  ArrowRight,
  Loader2,
  Star,
  FileText,
  Settings as SettingsIcon,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { saveFeedback } from '@/lib/autofill/feedback';
import { formatDebugLog } from '@/lib/autofill/debug-log';
import { useTheme } from '@/hooks/use-theme';
import { SettingsModal } from '@/components/settings-modal';
import {
  CWS_URL,
  FILL_COUNT_KEY,
  RATE_DISMISSED_KEY,
  CHANGELOG_KEY,
  CHANGELOG,
} from '@/lib/constants';

export interface FillLog {
  field: string;
  value: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: 'static-map' | 'options' | 'heuristic' | 'ml' | 'answer-bank' | 'rescan';
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

interface FillBarProps {
  onFill: () => void;
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
  logs?: FillLog[];
  pageUrl?: string;
  profileReady?: boolean;
  onDeleteAll?: () => void;
  onClearAnswerBank?: () => Promise<void> | void;
}

const ease = [0.25, 0.1, 0.25, 1] as const;

export function FillBar({
  onFill,
  isLoading,
  result,
  logs = [],
  pageUrl,
  profileReady = true,
  onDeleteAll,
  onClearAnswerBank,
}: FillBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showRateBanner, setShowRateBanner] = useState(false);
  const [showChangelogBanner, setShowChangelogBanner] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const syncBanners = async () => {
      const data = await chrome.storage.local.get([
        FILL_COUNT_KEY,
        RATE_DISMISSED_KEY,
        CHANGELOG_KEY,
      ]);
      const count = (data[FILL_COUNT_KEY] as number) ?? 0;
      const dismissed = data[RATE_DISMISSED_KEY] as boolean;
      setShowRateBanner(count >= 5 && !dismissed);
      const clVersion = data[CHANGELOG_KEY] as string | undefined;
      setShowChangelogBanner(!!(clVersion && CHANGELOG[clVersion]));
    };
    syncBanners();
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (FILL_COUNT_KEY in changes || RATE_DISMISSED_KEY in changes || CHANGELOG_KEY in changes) {
        syncBanners();
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  const dismissRateBanner = useCallback(() => {
    setShowRateBanner(false);
    chrome.storage.local.set({ [RATE_DISMISSED_KEY]: true });
  }, []);

  const handleRate = useCallback(() => {
    window.open(CWS_URL, '_blank');
  }, []);

  const handleChangelog = useCallback(() => {
    setShowChangelogModal(true);
    if (showChangelogBanner) {
      setShowChangelogBanner(false);
      chrome.storage.local.remove(CHANGELOG_KEY);
    }
  }, [showChangelogBanner]);

  // Show result count briefly, then morph to Re-fill
  useEffect(() => {
    if (result && !isLoading) {
      const show = setTimeout(() => setShowResult(true), 0);
      const hide = setTimeout(() => setShowResult(false), 10000);
      return () => {
        clearTimeout(show);
        clearTimeout(hide);
      };
    }
    const t = setTimeout(() => setShowResult(false), 0);
    return () => clearTimeout(t);
  }, [result, isLoading]);

  const handleDeleteAll = useCallback(() => {
    onDeleteAll?.();
  }, [onDeleteAll]);

  const copyLogs = useCallback(() => {
    const text = formatDebugLog(result ?? null, logs, pageUrl ?? '');
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  }, [logs, result, pageUrl]);

  const filledLogs = useMemo(() => logs.filter((l) => l.status === 'filled'), [logs]);
  const failedLogs = useMemo(() => logs.filter((l) => l.status === 'failed'), [logs]);
  const skippedLogs = useMemo(() => logs.filter((l) => l.status === 'skipped'), [logs]);

  const handleFlag = useCallback(
    (log: FillLog) => {
      saveFeedback({
        fieldLabel: log.field,
        status: log.status,
        filledCategory: log.status === 'filled' ? log.value : undefined,
        pageUrl: pageUrl ?? window.location.href,
        timestamp: new Date().toISOString(),
      });
    },
    [pageUrl],
  );

  const lastFillTime = useRef(0);
  const handleFill = useCallback(() => {
    const now = Date.now();
    if (now - lastFillTime.current < 2000) return; // 2s debounce
    lastFillTime.current = now;
    onFill();
  }, [onFill]);

  const fillRatio = result ? result.filled / Math.max(result.total, 1) : 0;
  const resultColor = fillRatio >= 0.8 ? 'green' : fillRatio >= 0.5 ? 'yellow' : 'red';

  // Button state: idle | loading | result-count | refill
  const buttonState = isLoading
    ? 'loading'
    : result && showResult
      ? 'result-count'
      : result
        ? 'refill'
        : 'idle';

  return (
    <div className="border-t border-border bg-[oklch(0.87_0.025_70)] dark:bg-[oklch(0.24_0.012_70)] relative z-20">
      <AnimatePresence>
        {expanded && result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '40vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <button
              type="button"
              className="flex justify-center py-2 cursor-pointer w-full"
              onClick={() => setExpanded(false)}
              aria-label="Collapse"
            >
              <div className="w-8 h-0.5 rounded-full bg-foreground/15" />
            </button>
            <div className="h-[calc(100%-24px)] overflow-y-auto px-5 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">
                  Fill Details
                  {result?.durationMs != null && result.durationMs > 0 && (
                    <span className="ml-2 normal-case tracking-normal font-normal">
                      {result.durationMs < 1000
                        ? `${result.durationMs}ms`
                        : `${(result.durationMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  {result?.mlAvailable != null && (
                    <span
                      className={cn(
                        'ml-2 normal-case tracking-normal font-normal',
                        result.mlAvailable
                          ? 'text-emerald-600/60 dark:text-emerald-400/60'
                          : 'text-yellow-600/60',
                      )}
                    >
                      {result.mlAvailable ? 'ML' : 'no ML'}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={copyLogs}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <CheckCheck size={10} className="text-green-600" />
                  ) : (
                    <Copy size={10} />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {pageUrl && (
                <div className="text-[10px] text-foreground/25 mb-3 truncate select-text font-mono">
                  {pageUrl}
                </div>
              )}
              {failedLogs.length > 0 && (
                <LogGroup
                  label="Failed"
                  count={failedLogs.length}
                  color="destructive"
                  logs={failedLogs}
                  pageUrl={pageUrl}
                  onFlag={handleFlag}
                />
              )}
              {filledLogs.length > 0 && (
                <LogGroup
                  label="Filled"
                  count={filledLogs.length}
                  color="green"
                  logs={filledLogs}
                  pageUrl={pageUrl}
                  onFlag={handleFlag}
                />
              )}
              {skippedLogs.length > 0 && (
                <LogGroup
                  label="Skipped"
                  count={skippedLogs.length}
                  color="yellow"
                  logs={skippedLogs}
                  pageUrl={pageUrl}
                  onFlag={handleFlag}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('px-5 py-4', expanded && 'border-t border-foreground/10')}>
        {result && !isLoading && (
          <div className="flex justify-between items-center mb-3">
            <span
              className="text-[10px] uppercase tracking-widest font-medium text-foreground/60"
              role="status"
            >
              {resultColor === 'green'
                ? 'Fill Complete'
                : resultColor === 'yellow'
                  ? 'Partially Filled'
                  : 'Fill Issues'}
            </span>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-medium tracking-tight text-foreground/80"
            >
              {result.filled}
              <span className="text-foreground/35">/{result.total}</span>
            </motion.div>
          </div>
        )}

        <AnimatePresence>
          {result && !isLoading && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 4, opacity: 1, marginBottom: 12 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease }}
              className="flex gap-0.5 rounded-full overflow-hidden bg-foreground/10"
            >
              {result.filled > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(result.filled / result.total) * 100}%` }}
                  transition={{ duration: 0.5, ease }}
                  className="h-full rounded-full bg-green-600"
                />
              )}
              {(result.failed ?? 0) > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((result.failed ?? 0) / result.total) * 100}%` }}
                  transition={{ duration: 0.5, ease, delay: 0.1 }}
                  className="h-full rounded-full bg-destructive"
                />
              )}
              {(result.skipped ?? 0) > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((result.skipped ?? 0) / result.total) * 100}%` }}
                  transition={{ duration: 0.5, ease, delay: 0.2 }}
                  className="h-full rounded-full bg-yellow-500/60"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRateBanner && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden mb-3"
            >
              <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-primary/5 text-[11px]">
                <span className="text-foreground/60">
                  Enjoying Mira?{' '}
                  <a
                    href={CWS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline cursor-pointer"
                  >
                    Leave a rating
                  </a>
                </span>
                <button
                  type="button"
                  onClick={dismissRateBanner}
                  className="shrink-0 text-foreground/30 hover:text-foreground/60 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={isLoading ? undefined : handleFill}
          disabled={!profileReady && !result}
          className={cn(
            'group relative w-full py-3.5 px-4 flex justify-between items-center overflow-hidden',
            'bg-primary text-primary-foreground font-medium text-sm',
            'transition-all duration-200',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isLoading && 'cursor-wait',
            !profileReady && !result ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          {isLoading && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/15 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {!isLoading && (
            <div className="absolute inset-0 bg-primary-foreground/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out" />
          )}

          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {buttonState === 'idle' && (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  Fill Application
                </motion.span>
              )}
              {buttonState === 'loading' && (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2"
                >
                  Filling...
                </motion.span>
              )}
              {buttonState === 'result-count' && result && (
                <motion.span
                  key="result"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2"
                >
                  {result.filled}/{result.total} filled
                </motion.span>
              )}
              {buttonState === 'refill' && (
                <motion.span
                  key="refill"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2"
                >
                  <RotateCcw size={13} /> Re-fill
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {buttonState === 'loading' ? (
                <motion.div
                  key="spinner"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 size={16} />
                  </motion.div>
                </motion.div>
              ) : buttonState === 'result-count' ? (
                <motion.div
                  key="check"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  {resultColor === 'green' ? (
                    <Check size={16} />
                  ) : resultColor === 'yellow' ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <X size={16} />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="arrow"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </button>

        <div className="mt-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {result && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] uppercase tracking-widest font-medium text-foreground/50 hover:text-foreground/70 transition-colors cursor-pointer"
              >
                {expanded ? 'Hide Log' : 'View Log'}
              </button>
            )}
            <span className="text-[10px] uppercase tracking-widest font-medium text-foreground/30 leading-none">
              v{chrome.runtime.getManifest().version}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <IconButton label="Rate this extension" onClick={handleRate} icon={Star} />
            <IconButton
              label="Changelog"
              onClick={handleChangelog}
              icon={FileText}
              highlight={showChangelogBanner}
            />
            <IconButton
              label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={toggleTheme}
              icon={theme === 'light' ? Moon : Sun}
            />
            <IconButton
              label="Settings"
              onClick={() => setShowSettings(true)}
              icon={SettingsIcon}
            />
          </div>
        </div>
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onClearAnswerBank={onClearAnswerBank}
        onDeleteAllData={handleDeleteAll}
      />

      {/* Changelog modal */}
      <AnimatePresence>
        {showChangelogModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowChangelogModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-popover border border-border rounded-lg p-5 mx-4 w-full max-w-[320px] shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <FileText size={16} className="text-primary" />
                </div>
                <h3 className="text-sm font-medium text-foreground pt-1">Changelog</h3>
              </div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {Object.entries(CHANGELOG)
                  .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
                  .map(([version, entries]) => (
                    <div key={version}>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">
                        v{version}
                      </span>
                      <ul className="mt-1 space-y-0.5">
                        {entries.map((entry, i) => (
                          <li
                            key={i}
                            className="text-[11px] text-foreground/70 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1 before:h-1 before:rounded-full before:bg-foreground/20"
                          >
                            {entry}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setShowChangelogModal(false)}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer',
        highlight
          ? 'text-green-600 hover:bg-green-600/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      <Icon size={13} />
    </button>
  );
}

function LogGroup({
  label,
  count,
  color,
  logs,
  pageUrl: _pageUrl,
  onFlag,
}: {
  label: string;
  count: number;
  color: 'green' | 'yellow' | 'destructive';
  logs: FillLog[];
  pageUrl?: string;
  onFlag: (log: FillLog) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            color === 'green' && 'bg-green-600',
            color === 'yellow' && 'bg-yellow-500',
            color === 'destructive' && 'bg-destructive',
          )}
        />
        <span className="text-[10px] font-medium text-foreground/40 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[10px] text-foreground/25">{count}</span>
      </div>
      {logs.map((log, i) => (
        <LogItem key={`${log.field}-${i}`} log={log} onFlag={onFlag} />
      ))}
    </div>
  );
}

function LogItem({ log, onFlag }: { log: FillLog; onFlag: (log: FillLog) => void }) {
  const [flagged, setFlagged] = useState(false);
  const handleFlag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (flagged) return;
    onFlag(log);
    setFlagged(true);
  };

  return (
    <div className="group py-1 px-2 rounded-md hover:bg-foreground/5 transition-colors">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-foreground/60 leading-tight line-clamp-2 flex-1">
          {log.field}
        </span>
        {log.source === 'ml' && log.confidence != null && (
          <span
            className={cn(
              'shrink-0 text-[8px] px-1 py-px rounded',
              log.confidence >= 0.9
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-yellow-500/10 text-yellow-600',
            )}
          >
            ML
          </span>
        )}
        {log.source === 'answer-bank' && (
          <span className="shrink-0 text-[8px] px-1 py-px rounded bg-foreground/5 text-foreground/40">
            AB
          </span>
        )}
        <button
          type="button"
          onClick={handleFlag}
          className={cn(
            'shrink-0 text-[9px] px-1.5 py-0.5 rounded transition-colors cursor-pointer',
            flagged
              ? 'text-yellow-600 bg-yellow-500/10'
              : 'text-foreground/20 opacity-0 group-hover:opacity-100 hover:text-foreground/50 hover:bg-foreground/5',
          )}
        >
          {flagged ? 'flagged' : 'flag'}
        </button>
      </div>
      {log.value && log.status === 'filled' && (
        <div className="text-[10px] text-foreground/30 mt-0.5 truncate">{log.value}</div>
      )}
    </div>
  );
}
