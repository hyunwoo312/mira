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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { saveFeedback } from '@/lib/autofill/feedback';
import { useUpdateCheck } from '@/hooks/use-update-check';
import type { ModelStatus } from '@/lib/ml/types';

export interface FillLog {
  field: string;
  value: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: 'options' | 'heuristic' | 'ml' | 'answer-bank' | 'rescan';
  confidence?: number;
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
  } | null;
  logs?: FillLog[];
  pageUrl?: string;
  mlStatus?: ModelStatus;
  mlProgress?: number;
  profileReady?: boolean;
  onExport?: () => void;
  onImport?: (file: File) => void;
  onDeleteAll?: () => void;
}

const ease = [0.25, 0.1, 0.25, 1] as const;

export function FillBar({
  onFill,
  isLoading,
  result,
  logs = [],
  pageUrl,
  mlStatus = 'idle',
  mlProgress = 0,
  profileReady = true,
  onExport,
  onImport,
  onDeleteAll,
}: FillBarProps) {
  const { updateAvailable, releasesUrl } = useUpdateCheck();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Show result count briefly, then morph to Re-fill
  useEffect(() => {
    if (result && !isLoading) {
      const show = setTimeout(() => setShowResult(true), 0);
      const hide = setTimeout(() => setShowResult(false), 2000);
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
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImport?.(file);
      e.target.value = '';
    },
    [onImport],
  );
  const handleDeleteAll = useCallback(() => {
    setShowDeleteConfirm(true);
    setShowMenu(false);
  }, []);
  const confirmDeleteAll = useCallback(() => {
    onDeleteAll?.();
    setShowDeleteConfirm(false);
  }, [onDeleteAll]);

  const copyLogs = useCallback(() => {
    const text = logs.map((l) => `[${l.status}] ${l.field}: ${l.value || '(empty)'}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [logs]);

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
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                isLoading && 'bg-yellow-500 animate-pulse',
                !isLoading && result && resultColor === 'green' && 'bg-green-600',
                !isLoading && result && resultColor === 'yellow' && 'bg-yellow-500',
                !isLoading && result && resultColor === 'red' && 'bg-destructive',
                !isLoading && !result && mlStatus === 'ready' && 'bg-green-600 animate-pulse',
                !isLoading && !result && mlStatus === 'loading' && 'bg-yellow-500 animate-pulse',
                !isLoading && !result && mlStatus === 'error' && 'bg-destructive',
                !isLoading && !result && mlStatus === 'idle' && 'bg-foreground/20',
              )}
            />
            <span
              className="text-[10px] uppercase tracking-widest font-medium text-foreground/60"
              role="status"
            >
              {isLoading
                ? 'Filling Application'
                : result
                  ? resultColor === 'green'
                    ? 'Fill Complete'
                    : resultColor === 'yellow'
                      ? 'Partially Filled'
                      : 'Fill Issues'
                  : !profileReady
                    ? 'Complete Profile'
                    : mlStatus === 'loading'
                      ? `Loading Model ${mlProgress}%`
                      : 'Ready to Autofill'}
            </span>
          </div>
          {result && !isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-medium tracking-tight text-foreground/80"
            >
              {result.filled}
              <span className="text-foreground/35">/{result.total}</span>
            </motion.div>
          ) : (
            !isLoading &&
            !result &&
            profileReady && (
              <span className="text-[9px] text-foreground/30 tracking-wide">
                Ashby · Greenhouse · Lever
              </span>
            )
          )}
        </div>

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

        <button
          type="button"
          onClick={isLoading ? undefined : handleFill}
          disabled={!profileReady && !result}
          className={cn(
            'group relative w-full py-3.5 px-4 flex justify-between items-center overflow-hidden',
            'bg-primary text-primary-foreground font-medium text-sm',
            'transition-all duration-200',
            'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isLoading && 'cursor-wait',
            !profileReady && !result && 'opacity-40 pointer-events-none',
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
            <span className="text-[10px] uppercase tracking-widest font-medium leading-none text-foreground/50">
              v{chrome.runtime.getManifest().version}
            </span>
            {updateAvailable && (
              <a
                href={releasesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] uppercase tracking-widest font-medium leading-none text-green-600 hover:underline cursor-pointer"
              >
                Update available
              </a>
            )}
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

      {/* Delete confirmation */}
      <AnimatePresence>
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
                ? 'bg-foreground/5 text-foreground/50'
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
