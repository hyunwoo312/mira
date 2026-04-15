import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  AlertTriangle,
  Copy,
  CheckCheck,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  ArrowRight,
  Loader2,
  Star,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { saveFeedback } from '@/lib/autofill/feedback';
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
  onExport?: () => void;
  onImport?: (file: File) => void | Promise<void>;
  onDeleteAll?: () => void;
}

const ease = [0.25, 0.1, 0.25, 1] as const;

export function FillBar({
  onFill,
  isLoading,
  result,
  logs = [],
  pageUrl,
  profileReady = true,
  onExport,
  onImport,
  onDeleteAll,
}: FillBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showRateBanner, setShowRateBanner] = useState(false);
  const [showChangelogBanner, setShowChangelogBanner] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check for rate prompt and changelog banner on mount
  useEffect(() => {
    chrome.storage.local.get([FILL_COUNT_KEY, RATE_DISMISSED_KEY, CHANGELOG_KEY]).then((data) => {
      const count = (data[FILL_COUNT_KEY] as number) ?? 0;
      const dismissed = data[RATE_DISMISSED_KEY] as boolean;
      if (count >= 5 && !dismissed) setShowRateBanner(true);

      const clVersion = data[CHANGELOG_KEY] as string | undefined;
      if (clVersion && CHANGELOG[clVersion]) {
        setShowChangelogBanner(true);
      }
    });
  }, []);

  const dismissRateBanner = useCallback(() => {
    setShowRateBanner(false);
    chrome.storage.local.set({ [RATE_DISMISSED_KEY]: true });
  }, []);

  const dismissChangelogBanner = useCallback(() => {
    setShowChangelogBanner(false);
    chrome.storage.local.remove(CHANGELOG_KEY);
  }, []);

  const handleRate = useCallback(() => {
    window.open(CWS_URL, '_blank');
    setShowMenu(false);
  }, []);

  const handleChangelog = useCallback(() => {
    setShowChangelogModal(true);
    setShowMenu(false);
  }, []);

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

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleExport = useCallback(() => {
    onExport?.();
    setShowMenu(false);
  }, [onExport]);
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
    setShowMenu(false);
  }, []);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
    }
    e.target.value = '';
  }, []);
  const confirmImport = useCallback(async () => {
    if (!pendingFile) return;
    try {
      setImportError(null);
      setImportSuccess(false);
      await onImport?.(pendingFile);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }
    setPendingFile(null);
  }, [pendingFile, onImport]);
  const handleDeleteAll = useCallback(() => {
    setShowDeleteConfirm(true);
    setShowMenu(false);
  }, []);
  const confirmDeleteAll = useCallback(() => {
    onDeleteAll?.();
    setShowDeleteConfirm(false);
  }, [onDeleteAll]);

  const copyLogs = useCallback(() => {
    // Build rich debug report for scanner debugging
    const lines: string[] = [];

    // Header
    lines.push('=== MIRA FILL DEBUG LOG ===');
    if (pageUrl) lines.push(`URL: ${pageUrl}`);
    if (result) {
      lines.push(`ATS: ${result.ats ?? 'unknown'}`);
      lines.push(`Form elements on page: ${result.totalFormElements ?? '?'}`);
      lines.push(`Fields scanned: ${result.total}`);
      lines.push(
        `Result: ${result.filled} filled, ${result.failed} failed, ${result.skipped} skipped`,
      );
      if (result.durationMs != null) lines.push(`Duration: ${result.durationMs}ms`);
      lines.push(`ML: ${result.mlAvailable ? 'yes' : 'no'}`);
    }
    lines.push('');

    // Per-field details grouped by status
    const groups: [string, FillLog[]][] = [
      ['FILLED', logs.filter((l) => l.status === 'filled')],
      ['FAILED', logs.filter((l) => l.status === 'failed')],
      ['SKIPPED', logs.filter((l) => l.status === 'skipped')],
    ];

    for (const [groupLabel, groupLogs] of groups) {
      if (groupLogs.length === 0) continue;
      lines.push(`--- ${groupLabel} (${groupLogs.length}) ---`);
      for (const l of groupLogs) {
        lines.push(`  ${l.field}`);
        lines.push(
          `    widget: ${l.widgetType ?? '?'}  |  category: ${l.category ?? 'none'}  |  by: ${l.source ?? '?'}${l.confidence != null ? ` (${Math.round(l.confidence * 100)}%)` : ''}`,
        );
        if (l.value) lines.push(`    value: ${l.value}`);
        if (l.sectionHeading) lines.push(`    section: ${l.sectionHeading}`);
        if (l.groupLabels && l.groupLabels.length > 0)
          lines.push(`    options: [${l.groupLabels.join(', ')}]`);
        if (l.elementHint) lines.push(`    element: ${l.elementHint}`);
        if (l.attemptedValue) lines.push(`    attempted: ${l.attemptedValue}`);
        if (l.failReason) lines.push(`    reason: ${l.failReason}`);
        if (l.skipReason) lines.push(`    reason: ${l.skipReason}`);
      }
      lines.push('');
    }

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Clipboard API unavailable or denied — ignore silently
      },
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
            <button
              type="button"
              onClick={() => {
                setShowChangelogModal(true);
                if (showChangelogBanner) dismissChangelogBanner();
              }}
              className={cn(
                'text-[10px] uppercase tracking-widest font-medium leading-none transition-colors cursor-pointer',
                showChangelogBanner
                  ? 'text-green-600 animate-pulse'
                  : 'text-foreground/50 hover:text-foreground/70',
              )}
            >
              v{chrome.runtime.getManifest().version}
              {showChangelogBanner ? ' — new' : ''}
            </button>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="text-[10px] uppercase tracking-widest font-medium text-foreground/50 hover:text-foreground/70 transition-colors cursor-pointer"
            >
              Options
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  role="menu"
                  className="absolute bottom-full right-0 mb-2 bg-popover border border-border rounded-lg shadow-md py-1 min-w-[160px] z-30"
                >
                  <MenuItem icon={Download} label="Export profile" onClick={handleExport} />
                  <MenuItem icon={Upload} label="Import profile" onClick={handleImportClick} />
                  <MenuItem icon={FileText} label="Changelog" onClick={handleChangelog} />
                  <MenuItem icon={Star} label="Rate this extension" onClick={handleRate} />
                  <MenuItem
                    icon={Trash2}
                    label="Delete all data"
                    onClick={handleDeleteAll}
                    destructive
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Import feedback */}
      <AnimatePresence>
        {importError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden px-5"
          >
            <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-[11px]">
              <span>{importError}</span>
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="shrink-0 hover:opacity-70 cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
        {importSuccess && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden px-5"
          >
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-600/10 text-green-600 text-[11px]">
              <Check size={12} />
              <span>Profile imported successfully</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {pendingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setPendingFile(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-popover border border-border rounded-lg p-5 mx-4 w-full max-w-[320px] shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <Upload size={16} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Import profile</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    This will replace the current preset's profile with the imported data.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
                >
                  Import
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-popover border border-border rounded-lg p-5 mx-4 w-full max-w-[320px] shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 shrink-0">
                  <Trash2 size={16} className="text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Delete all data</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Permanently delete all profiles, presets, files, and settings. Cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAll}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium bg-destructive text-white hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
                >
                  Delete everything
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 text-[11px] transition-colors cursor-pointer',
        destructive
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      <Icon size={12} /> {label}
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
