import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Trash2, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/use-settings';
import type { OverlayDismissMs, Settings } from '@/lib/settings';
import { clearApplications } from '@/lib/application-store';

const DISMISS_OPTIONS: { label: string; value: OverlayDismissMs }[] = [
  { label: '4s', value: 4000 },
  { label: '8s', value: 8000 },
  { label: '15s', value: 15000 },
  { label: 'Never', value: null },
];

type ConfirmKind = 'clear-history' | 'clear-bank' | 'reset-settings' | 'delete-all' | null;

const CONFIRM_COPY: Record<
  Exclude<ConfirmKind, null>,
  { title: string; body: string; button: string }
> = {
  'clear-history': {
    title: 'Clear application history?',
    body: 'All tracked applications will be removed. This cannot be undone.',
    button: 'Clear history',
  },
  'clear-bank': {
    title: 'Clear answer bank?',
    body: "Your saved custom answers will be removed from the active preset's profile.",
    button: 'Clear answers',
  },
  'reset-settings': {
    title: 'Reset all settings?',
    body: 'All settings in this modal will return to their defaults. Your profile data is unaffected.',
    button: 'Reset settings',
  },
  'delete-all': {
    title: 'Delete all Mira data?',
    body: "Profiles, answer bank, files, applications history, and settings will be permanently removed. This can't be undone.",
    button: 'Delete all',
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onClearAnswerBank?: () => Promise<void> | void;
  onDeleteAllData?: () => void;
}

export function SettingsModal({ open, onClose, onClearAnswerBank, onDeleteAllData }: Props) {
  const { settings, update, reset } = useSettings();
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const onToggle = useCallback(
    async (key: keyof Settings, value: boolean | OverlayDismissMs) => {
      await update({ [key]: value } as Partial<Settings>);
    },
    [update],
  );

  const openShortcutsPage = useCallback(() => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }, []);

  const runConfirmed = useCallback(async () => {
    const kind = confirm;
    setConfirm(null);
    if (!kind) return;
    if (kind === 'clear-history') {
      await clearApplications();
      flash('Application history cleared');
    } else if (kind === 'clear-bank') {
      await onClearAnswerBank?.();
      flash('Answer bank cleared');
    } else if (kind === 'reset-settings') {
      await reset();
      flash('Settings reset to defaults');
    } else if (kind === 'delete-all') {
      onDeleteAllData?.();
      onClose();
    }
  }, [confirm, onClearAnswerBank, reset, flash, onDeleteAllData, onClose]);

  const body = useMemo(
    () => (
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <Section title="Fill Behavior">
          <ToggleRow
            label="Hide overlay"
            desc="Don't show the floating result badge on the page after fill."
            checked={settings.hideOverlay}
            onChange={(v) => onToggle('hideOverlay', v)}
          />
          <Row
            label="Overlay dismiss timer"
            desc="How long the result badge stays visible before fading out."
          >
            <Segmented
              options={DISMISS_OPTIONS}
              value={settings.overlayDismissMs}
              onChange={(v) => onToggle('overlayDismissMs', v)}
            />
          </Row>
        </Section>

        <Section title="Field Preferences">
          <ToggleRow
            label="Skip EEO questions"
            desc="Leave gender, race, veteran, and disability fields blank."
            checked={settings.skipEeo}
            onChange={(v) => onToggle('skipEeo', v)}
          />
          <ToggleRow
            label="Skip salary fields"
            desc="Don't fill salary expectation / desired compensation fields."
            checked={settings.skipSalary}
            onChange={(v) => onToggle('skipSalary', v)}
          />
        </Section>

        <Section title="Privacy & Data">
          <ToggleRow
            label="Save applications to history"
            desc="Track filled applications for later review."
            checked={settings.saveApplications}
            onChange={(v) => onToggle('saveApplications', v)}
          />
          <IconActionRow
            label="Clear application history"
            icon={Trash2}
            onClick={() => setConfirm('clear-history')}
            variant="destructive"
          />
          <IconActionRow
            label="Clear answer bank"
            icon={Trash2}
            onClick={() => setConfirm('clear-bank')}
            variant="destructive"
          />
        </Section>

        <Section title="Keyboard Shortcuts">
          <IconActionRow
            label="Manage autofill & side-panel shortcuts"
            desc="Opens chrome://extensions/shortcuts in a new tab."
            icon={ExternalLink}
            onClick={openShortcutsPage}
          />
        </Section>

        <Section title="Advanced">
          <ToggleRow
            label="Disable ML classifier"
            desc="Use heuristic patterns only — faster but less accurate."
            checked={settings.mlDisabled}
            onChange={(v) => onToggle('mlDisabled', v)}
          />
          <ToggleRow
            label="Verbose console logging"
            desc="Emit debug logs from the autofill pipeline."
            checked={settings.verboseLogging}
            onChange={(v) => onToggle('verboseLogging', v)}
          />
        </Section>

        <div className="pt-4 border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={() => setConfirm('reset-settings')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5 transition-colors cursor-pointer"
          >
            <RotateCcw size={11} />
            Reset settings
          </button>
          <button
            type="button"
            onClick={() => setConfirm('delete-all')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 size={11} />
            Delete all data
          </button>
        </div>
      </div>
    ),
    [settings, onToggle, openShortcutsPage],
  );

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="bg-popover border border-border rounded-lg p-5 mx-4 w-full max-w-[360px] shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <SettingsIcon size={16} className="text-primary" />
                </div>
                <h3 className="text-sm font-medium text-foreground pt-1">Settings</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer pt-1"
                aria-label="Close settings"
              >
                <X size={16} />
              </button>
            </div>

            {body}

            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="mt-3 text-center text-[11px] text-foreground/50"
                >
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {confirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirm(null);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.12 }}
                  className="bg-popover border border-border rounded-lg p-5 mx-4 w-full max-w-[300px] shadow-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    {CONFIRM_COPY[confirm].title}
                  </h4>
                  <p className="text-[11px] text-foreground/60 leading-relaxed mb-4">
                    {CONFIRM_COPY[confirm].body}
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      className="h-8 px-3 rounded-lg text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={runConfirmed}
                      className="h-8 px-3 rounded-lg text-[12px] font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 transition-colors cursor-pointer"
                    >
                      {CONFIRM_COPY[confirm].button}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}

/* ── Row primitives ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50 mb-2">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[12px] text-foreground/80">{label}</div>
        {desc && <div className="text-[10px] text-foreground/40 mt-0.5 leading-snug">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} desc={desc}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors cursor-pointer',
          checked ? 'bg-primary' : 'bg-foreground/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </Row>
  );
}

function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2 h-6 text-[10px] uppercase tracking-wider transition-colors cursor-pointer',
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground/50 hover:text-foreground/80',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function IconActionRow({
  label,
  desc,
  icon: Icon,
  onClick,
  variant,
}: {
  label: string;
  desc?: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'destructive';
}) {
  return (
    <Row label={label} desc={desc}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer',
          variant === 'destructive'
            ? 'text-destructive/80 hover:text-destructive hover:bg-destructive/10'
            : 'text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5',
        )}
      >
        <Icon size={13} />
      </button>
    </Row>
  );
}
