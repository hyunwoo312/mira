/**
 * Overlay React component — rendered inside Shadow DOM.
 * Matches fill-bar.tsx log patterns for visual consistency.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FillResult, LogItem, Phase } from './fill-overlay';

export interface OverlayState {
  visible: boolean;
  phase: Phase | null;
  result: FillResult | null;
  logs: LogItem[];
  timerActive: boolean;
  timerPaused: boolean;
  isDark: boolean;
}

interface Props {
  state: OverlayState;
  onDismiss: () => void;
  onPauseDismiss: () => void;
  onResumeDismiss: () => void;
  onOpenPanel: () => void;
  onToggleTheme: () => void;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 };
const ease = [0.25, 0.1, 0.25, 1] as const;
const stateTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.2, ease },
};
const MAX_LOG_ITEMS = 10;

export function OverlayApp({
  state,
  onDismiss,
  onPauseDismiss,
  onResumeDismiss,
  onOpenPanel,
  onToggleTheme,
}: Props) {
  const [logExpanded, setLogExpanded] = useState(false);

  const toggleLog = () => {
    setLogExpanded((v) => !v);
    onPauseDismiss();
  };

  return (
    <AnimatePresence>
      {state.visible && (
        <motion.div
          key="overlay"
          className={`mira-widget ${state.isDark ? 'dark' : ''}`}
          initial={{ opacity: 0, x: '110%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '110%' }}
          transition={spring}
          onMouseEnter={state.timerActive && !logExpanded ? onPauseDismiss : undefined}
          onMouseLeave={state.timerActive && !logExpanded ? onResumeDismiss : undefined}
        >
          {/* Header */}
          <div className="ov-header">
            <div className="ov-header-left">
              <MiraLogo />
              <span className="ov-header-title">Mira</span>
            </div>
            <div className="ov-header-right">
              <button
                className="ov-btn-icon"
                onClick={onToggleTheme}
                title={state.isDark ? 'Switch to light' : 'Switch to dark'}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={state.isDark ? 'moon' : 'sun'}
                    initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'flex' }}
                  >
                    {state.isDark ? <MoonIcon /> : <SunIcon />}
                  </motion.div>
                </AnimatePresence>
              </button>
              <button className="ov-btn-icon" onClick={onOpenPanel} title="Open Side Panel">
                <ExpandIcon />
              </button>
              <div className="ov-divider" />
              <button className="ov-btn-icon" onClick={onDismiss} title="Dismiss">
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Content — state transitions slide up/down */}
          <AnimatePresence mode="wait">
            {state.phase === 'ml-loading' && <MLLoadingView key="ml" />}
            {state.phase === 'filling' && <FillingView key="fill" />}
            {state.result && (
              <ResultView
                key="result"
                result={state.result}
                logs={state.logs}
                logExpanded={logExpanded}
                onToggleLog={toggleLog}
                onOpenPanel={onOpenPanel}
              />
            )}
          </AnimatePresence>

          {/* Timer bar */}
          {state.timerActive && (
            <div className="ov-timer-track">
              <div className={`ov-timer-bar ${state.timerPaused ? 'paused' : ''}`} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── ML Loading ── */
function MLLoadingView() {
  return (
    <motion.div className="ov-center" {...stateTransition}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'flex', color: 'var(--fg)' }}
      >
        <SpinnerIcon />
      </motion.div>
      <motion.span
        className="ov-loading-text"
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        Initializing ML model…
      </motion.span>
    </motion.div>
  );
}

/* ── Filling ── */
function FillingView() {
  return (
    <motion.div className="ov-pad" {...stateTransition}>
      <div className="ov-row-between">
        <div className="ov-row" style={{ gap: 6 }}>
          <motion.div
            className="ov-dot ov-dot-active"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="ov-label">Filling application…</span>
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'flex', color: 'var(--muted)' }}
        >
          <SpinnerIcon />
        </motion.div>
      </div>
      {/* Shimmer skeletons stagger in */}
      <div className="ov-shimmer-group">
        {[100, 72, 85].map((w, i) => (
          <motion.div
            key={i}
            className="ov-shimmer"
            style={{ width: `${w}%` }}
            initial={{ opacity: 0, scaleX: 0.3 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.3, delay: i * 0.1, ease }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ── Result ── */
function ResultView({
  result,
  logs,
  logExpanded,
  onToggleLog,
  onOpenPanel,
}: {
  result: FillResult;
  logs: LogItem[];
  logExpanded: boolean;
  onToggleLog: () => void;
  onOpenPanel: () => void;
}) {
  const ratio = result.total > 0 ? result.filled / result.total : 0;
  const statusLabel =
    result.total === 0
      ? 'No Fields Found'
      : ratio >= 0.8
        ? 'Fill Complete'
        : ratio >= 0.5
          ? 'Partially Filled'
          : 'Fill Issues';
  const filledPct = result.total > 0 ? (result.filled / result.total) * 100 : 0;
  const failedPct = result.total > 0 ? (result.failed / result.total) * 100 : 0;
  const skippedPct = result.total > 0 ? (result.skipped / result.total) * 100 : 0;

  const grouped = useMemo(
    () => ({
      failed: logs.filter((l) => l.status === 'failed'),
      filled: logs.filter((l) => l.status === 'filled'),
      skipped: logs.filter((l) => l.status === 'skipped'),
    }),
    [logs],
  );
  const hasLogs = logs.length > 0;

  return (
    <motion.div {...stateTransition}>
      {/* Summary */}
      <div className="ov-pad" style={{ paddingBottom: 12 }}>
        <div className="ov-row-between" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Status label slides in */}
            <motion.div
              className="ov-label"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1, ease }}
            >
              {statusLabel}
            </motion.div>
            {/* Title slides in */}
            <motion.div
              className="ov-result-title"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.15, ease }}
            >
              Application Parsed.
            </motion.div>
          </div>
          {/* Count pops in */}
          <motion.div
            className="ov-result-count"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.2 }}
          >
            {result.filled}
            <span className="ov-dim">/{result.total} fields</span>
            {ratio >= 1.0 && <Confetti />}
          </motion.div>
        </div>

        {/* Segment bar */}
        <div className="ov-bar-track">
          {result.filled > 0 && (
            <motion.div
              className="ov-bar-seg ov-green"
              initial={{ width: 0 }}
              animate={{ width: `${filledPct}%` }}
              transition={{ duration: 0.6, ease, delay: 0.25 }}
            />
          )}
          {result.failed > 0 && (
            <motion.div
              className="ov-bar-seg ov-red"
              initial={{ width: 0 }}
              animate={{ width: `${failedPct}%` }}
              transition={{ duration: 0.6, ease, delay: 0.35 }}
            />
          )}
          {result.skipped > 0 && (
            <motion.div
              className="ov-bar-seg ov-amber"
              initial={{ width: 0 }}
              animate={{ width: `${skippedPct}%` }}
              transition={{ duration: 0.6, ease, delay: 0.45 }}
            />
          )}
        </div>
      </div>

      {/* View Log button — fades in after bar */}
      {hasLogs && (
        <motion.div
          className="ov-pad"
          style={{ paddingTop: 0, paddingBottom: 12 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <button className="ov-log-btn" onClick={onToggleLog}>
            <span>{logExpanded ? 'Hide Log' : 'View Log'}</span>
            <motion.div
              animate={{ rotate: logExpanded ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex' }}
            >
              <ChevronIcon />
            </motion.div>
          </button>
        </motion.div>
      )}

      {/* Log panel with staggered items */}
      <AnimatePresence>
        {logExpanded && hasLogs && (
          <motion.div
            className="ov-log-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
          >
            <div className="ov-log-scroll">
              {grouped.failed.length > 0 && (
                <LogGroup label="Failed" items={grouped.failed} color="red" />
              )}
              {grouped.skipped.length > 0 && (
                <LogGroup label="Skipped" items={grouped.skipped} color="amber" />
              )}
              {grouped.filled.length > 0 && (
                <LogGroup
                  label="Filled"
                  items={grouped.filled}
                  color="green"
                  onMore={onOpenPanel}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Log Group ── */
function LogGroup({
  label,
  items,
  color,
  onMore,
}: {
  label: string;
  items: LogItem[];
  color: 'green' | 'amber' | 'red';
  onMore?: () => void;
}) {
  const shown = items.slice(0, MAX_LOG_ITEMS);
  const remaining = items.length - shown.length;
  const dotClass =
    color === 'green' ? 'ov-dot-green' : color === 'amber' ? 'ov-dot-amber' : 'ov-dot-red';

  return (
    <div className="ov-log-group">
      <motion.div
        className="ov-log-group-head"
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className={`ov-dot ${dotClass}`} />
        <span className="ov-log-group-name">{label}</span>
        <span className="ov-log-group-count">{items.length}</span>
      </motion.div>
      {/* Items stagger in */}
      {shown.map((item, i) => (
        <motion.div
          key={`${item.field}-${i}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, delay: i * 0.03 }}
        >
          <LogItemRow item={item} />
        </motion.div>
      ))}
      {remaining > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: shown.length * 0.03 }}
        >
          <button className="ov-log-more" onClick={onMore}>
            +{remaining} more — open Side Panel
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ── Log Item ── */
function LogItemRow({ item }: { item: LogItem }) {
  const detail =
    item.status === 'filled'
      ? item.value || ''
      : item.status === 'failed'
        ? formatReason(item.failReason) || 'Failed'
        : formatReason(item.skipReason) || 'Skipped';

  return (
    <div className="ov-log-item" title={`${item.field}: ${detail}`}>
      <div className="ov-log-item-top">
        <span className="ov-log-item-field">{item.field}</span>
        {item.source === 'ml' && item.confidence != null && (
          <span className={`ov-tag ${item.confidence >= 0.9 ? 'ov-tag-green' : 'ov-tag-amber'}`}>
            ML
          </span>
        )}
        {item.source === 'answer-bank' && <span className="ov-tag">AB</span>}
      </div>
      {detail && (
        <div className={`ov-log-item-detail ${item.status !== 'filled' ? 'muted' : ''}`}>
          {detail}
        </div>
      )}
    </div>
  );
}

function formatReason(r?: string): string {
  if (!r) return '';
  return r.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/* ── Confetti burst for 100% fill ── */
const CONFETTI_COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316'];

// Pre-generate particle data at module level to avoid impure calls in render
function generateParticles() {
  return Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 30 + Math.random() * 50;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 20,
      rotate: Math.random() * 540 - 270,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: Math.random() > 0.5 ? 6 : 4,
      height: Math.random() > 0.5 ? 3 : 6,
      delay: Math.random() * 0.2,
    };
  });
}

const CONFETTI_PARTICLES = generateParticles();

function Confetti() {
  const particles = CONFETTI_PARTICLES;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 10,
      }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: p.width,
            height: p.height,
            borderRadius: 1,
            background: p.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1.5 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.5, rotate: p.rotate }}
          transition={{ duration: 1, delay: p.delay, ease: [0.2, 0.8, 0.4, 1] }}
        />
      ))}
    </div>
  );
}

/* ── Icons ── */
function SunIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function MiraLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 100 100" fill="none">
      <rect x="16" y="38" width="20" height="46" rx="1.5" fill="currentColor" />
      <rect x="64" y="38" width="20" height="46" rx="1.5" fill="currentColor" />
      <path
        d="M50 6C50 30 65 38 84 38C65 38 50 46 50 74C50 46 35 38 16 38C35 38 50 30 50 6Z"
        fill="currentColor"
        opacity="0.4"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.15" />
      <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
