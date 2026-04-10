import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Pencil, Trash2, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import type { Preset } from '@/lib/storage';

const MAX_PRESETS = 5;

interface PresetBarProps {
  presets: Preset[];
  activePresetId: string;
  onSelect: (presetId: string) => void;
  onAdd: (name: string) => void;
  onRequestDelete: (presetId: string) => void;
  onRename: (presetId: string, name: string) => void;
}

export function PresetBar({
  presets,
  activePresetId,
  onSelect,
  onAdd,
  onRequestDelete,
  onRename,
}: PresetBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showPresetHint, setShowPresetHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activePreset = presets.find((p) => p.id === activePresetId);
  const { theme, toggle: toggleTheme } = useTheme();

  // Focus rename input
  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingId]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const startRename = (preset: Preset) => {
    setRenamingId(preset.id);
    setRenameValue(preset.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleSelect = (presetId: string) => {
    onSelect(presetId);
    setMenuOpen(false);
  };

  const handleAdd = () => {
    const num = presets.length + 1;
    onAdd(`Preset ${num}`);
    setMenuOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, presetId: string) => {
    e.stopPropagation();
    onRequestDelete(presetId);
    setMenuOpen(false);
  };

  return (
    <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-background">
      <span className="text-sm font-medium tracking-tight shrink-0">Mira</span>
      <div className="w-px h-4 bg-border mx-1" />
      <div className="relative flex-1 min-w-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          onMouseEnter={() => !menuOpen && setShowPresetHint(true)}
          onMouseLeave={() => setShowPresetHint(false)}
          aria-label="Switch profile preset"
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          className={cn(
            'flex items-center gap-2 w-full h-8 text-left transition-all cursor-pointer',
            'bg-transparent border-0 border-b border-transparent',
            'hover:border-b-foreground',
            menuOpen && 'border-b-foreground',
          )}
        >
          <span className="text-[13px] font-semibold truncate flex-1">
            {activePreset?.name ?? 'Profile'}
          </span>
          <ChevronDown
            size={12}
            className={cn(
              'shrink-0 text-muted-foreground/40 transition-transform duration-150',
              menuOpen && 'rotate-180 text-muted-foreground',
            )}
          />
        </button>
        {showPresetHint && !menuOpen && (
          <div className="absolute top-full left-0 mt-1.5 z-10 w-[240px] px-3 py-2 rounded-lg bg-popover/95 backdrop-blur-sm border border-border/50 shadow-lg text-[11px] leading-relaxed text-foreground/60">
            Save different profiles for different types of roles
          </div>
        )}

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md z-20 overflow-hidden"
            >
              <motion.div
                className="py-1"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
              >
                {presets.map((preset) => {
                  const isActive = preset.id === activePresetId;
                  const isRenaming = renamingId === preset.id;

                  return (
                    <motion.div
                      key={preset.id}
                      variants={{ hidden: { opacity: 0, y: -4 }, visible: { opacity: 1, y: 0 } }}
                    >
                      {isRenaming ? (
                        <div className="px-2 py-1">
                          <input
                            ref={inputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            maxLength={40}
                            className="w-full h-8 px-2.5 text-[12px] font-medium rounded-lg bg-input border border-primary/50 text-foreground outline-none"
                          />
                          <div className="flex items-center justify-between mt-1 px-0.5">
                            <span className="text-[9px] text-muted-foreground/30">
                              Enter to save · Esc to cancel
                            </span>
                            <span
                              className={cn(
                                'text-[9px] tabular-nums',
                                renameValue.length > 35
                                  ? 'text-yellow-500/60'
                                  : 'text-muted-foreground/20',
                              )}
                            >
                              {renameValue.length}/40
                            </span>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelect(preset.id)}
                          className={cn(
                            'group flex items-center gap-2 w-full px-3 py-2 text-left transition-colors cursor-pointer',
                            isActive
                              ? 'bg-primary/8 text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                          )}
                        >
                          <div
                            className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              isActive ? 'bg-primary' : 'bg-transparent',
                            )}
                          />

                          <span className="text-[12px] font-medium truncate flex-1">
                            {preset.name}
                          </span>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startRename(preset);
                              }}
                              className="p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                              title="Rename"
                            >
                              <Pencil size={11} />
                            </button>
                            {presets.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, preset.id)}
                                className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>

              {presets.length < MAX_PRESETS && (
                <>
                  <div className="h-px bg-border/60 mx-2" />
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      New preset
                    </button>
                  </div>
                  {presets.length === 1 && (
                    <div className="px-3 pb-2">
                      <p className="text-[9px] text-muted-foreground/30 leading-relaxed">
                        Presets let you save different profiles for different types of roles.
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        className="flex items-center justify-center w-6 h-8 -mr-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </motion.div>
        </AnimatePresence>
      </button>
    </div>
  );
}
