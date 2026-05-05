import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Coffee, FileText, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { SettingsModal } from '@/components/settings-modal';
import { CWS_URL, CHANGELOG_KEY, CHANGELOG } from '@/lib/constants';

export type TopLevelTab = 'profile' | 'tracker';

const TABS: { id: TopLevelTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'tracker', label: 'Tracker' },
];

const EASE = [0.25, 0.1, 0.25, 1] as const;

interface BottomNavProps {
  activeTab: TopLevelTab;
  onTabChange: (tab: TopLevelTab) => void;
  onDeleteAll?: () => void;
  onClearAnswerBank?: () => Promise<void> | void;
}

export function BottomNav({
  activeTab,
  onTabChange,
  onDeleteAll,
  onClearAnswerBank,
}: BottomNavProps) {
  const { theme, toggle: toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showChangelogBanner, setShowChangelogBanner] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void chrome.storage.local.get([CHANGELOG_KEY]).then((data) => {
      if (cancelled) return;
      const v = data[CHANGELOG_KEY] as string | undefined;
      setShowChangelogBanner(!!(v && CHANGELOG[v]));
    });
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (CHANGELOG_KEY in changes) {
        const v = changes[CHANGELOG_KEY]!.newValue as string | undefined;
        setShowChangelogBanner(!!(v && CHANGELOG[v]));
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.local.onChanged.removeListener(listener);
    };
  }, []);

  const handleRate = useCallback(() => window.open(CWS_URL, '_blank'), []);

  const handleChangelog = useCallback(() => {
    setShowChangelogModal(true);
    if (showChangelogBanner) {
      setShowChangelogBanner(false);
      void chrome.storage.local.remove(CHANGELOG_KEY);
    }
  }, [showChangelogBanner]);

  return (
    <>
      <nav
        className="flex items-center justify-between px-4 h-[52px] shrink-0 relative z-10"
        role="tablist"
        aria-label="Side panel views"
      >
        <div className="flex items-center gap-2.5">
          {TABS.map((tab, i) => (
            <div key={tab.id} className="flex items-center gap-2.5">
              {i > 0 && (
                <span aria-hidden className="text-muted-foreground/25 text-[11px] select-none">
                  |
                </span>
              )}
              <TabButton
                label={tab.label}
                active={activeTab === tab.id}
                onClick={() => onTabChange(tab.id)}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton label="Rate this extension" onClick={handleRate} icon={Star} />
          <IconLink
            label="Buy me a coffee"
            href="https://buymeacoffee.com/hyunwk"
            icon={Coffee}
            accent="coffee"
          />
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
          <IconButton label="Settings" onClick={() => setShowSettings(true)} icon={SettingsIcon} />
        </div>
      </nav>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onClearAnswerBank={onClearAnswerBank}
        onDeleteAllData={onDeleteAll}
      />

      <ChangelogModal open={showChangelogModal} onClose={() => setShowChangelogModal(false)} />
    </>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'relative h-[52px] px-1 text-[11px] uppercase tracking-[0.12em] font-medium transition-colors cursor-pointer',
        active ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground/80',
      )}
    >
      {label}
      {active && (
        <motion.span
          layoutId="bottom-nav-underline"
          className="absolute left-0 right-0 bottom-[14px] h-px bg-foreground"
          transition={{ duration: 0.32, ease: EASE }}
        />
      )}
    </button>
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
        'flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer',
        highlight
          ? 'text-green-600 hover:bg-green-600/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      <Icon size={17} />
    </button>
  );
}

function IconLink({
  icon: Icon,
  label,
  href,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  accent?: 'coffee';
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer',
        accent === 'coffee'
          ? 'text-yellow-600/80 hover:text-yellow-700 hover:bg-yellow-500/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      <Icon size={17} />
    </a>
  );
}

function ChangelogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
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
                onClick={onClose}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
