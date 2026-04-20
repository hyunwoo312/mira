import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Pencil, Trash2, Download, Upload, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Preset } from '@/lib/storage';

const MAX_PRESETS = 5;

interface PresetBarProps {
  presets: Preset[];
  activePresetId: string;
  onSelect: (presetId: string) => void;
  onAdd: (name: string) => void;
  onRequestDelete: (presetId: string) => void;
  onRename: (presetId: string, name: string) => void;
  onExport?: () => void;
  onImport?: (file: File) => void | Promise<void>;
}

export function PresetBar({
  presets,
  activePresetId,
  onSelect,
  onAdd,
  onRequestDelete,
  onRename,
  onExport,
  onImport,
}: PresetBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showPresetHint, setShowPresetHint] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePreset = presets.find((p) => p.id === activePresetId);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
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
    <div className="relative flex items-center gap-2 px-5 py-4 border-b border-border bg-background">
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

      <div className="flex items-center -mr-1 shrink-0">
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            title="Export profile"
            aria-label="Export profile"
            className="flex items-center justify-center w-6 h-8 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Download size={13} />
          </button>
        )}
        {onImport && (
          <button
            type="button"
            onClick={handleImportClick}
            title="Import profile"
            aria-label="Import profile"
            className="flex items-center justify-center w-6 h-8 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Upload size={13} />
          </button>
        )}
      </div>

      {onImport && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      )}

      {/* Import feedback (inline, absolute under header) */}
      <AnimatePresence>
        {importError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 overflow-hidden px-1"
          >
            <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-[11px]">
              <span>{importError}</span>
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="shrink-0 hover:opacity-70 cursor-pointer"
                aria-label="Dismiss"
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
            className="absolute left-0 right-0 top-full mt-1 overflow-hidden px-1"
          >
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-600/10 text-green-600 text-[11px]">
              <Check size={12} />
              <span>Profile imported successfully</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import confirm modal */}
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
                    This will replace the current preset&apos;s profile with the imported data.
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
      </AnimatePresence>
    </div>
  );
}
