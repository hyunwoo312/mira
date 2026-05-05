import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FileText, Loader2, Lock, X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';

const EASE = [0.25, 0.1, 0.25, 1] as const;

interface EmptyStatePromptProps {
  open: boolean;
  /** Permanently dismisses the prompt for this preset (no parse). */
  onDismiss: () => void;
  /** Triggers the file picker; dismissal is left to the parent so the dialog
   *  stays mounted until the import succeeds (preset becomes touched) or the
   *  user dismisses some other way. */
  onImportResume: () => void;
  /** Set true while a parse is running to disable re-entry. */
  parsing?: boolean;
}

export function EmptyStatePrompt({
  open,
  onDismiss,
  onImportResume,
  parsing,
}: EmptyStatePromptProps) {
  const importBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onDismiss]);

  useEffect(() => {
    if (open) importBtnRef.current?.focus();
  }, [open]);

  const dialog = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18, ease: EASE }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onDismiss}
          role="dialog"
          aria-modal="true"
          aria-labelledby="empty-state-title"
        >
          <motion.div
            ref={dialogRef}
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-popover border border-border rounded-lg p-6 mx-4 w-full max-w-[340px] shadow-md"
          >
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="absolute top-3 right-3 text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>

            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1], delay: 0.05 }}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 mb-4"
              aria-hidden
            >
              <FileText size={18} className="text-primary" />
            </motion.div>

            <h2
              id="empty-state-title"
              className="text-[20px] leading-[1.2] tracking-tight font-light text-foreground/45"
            >
              Set up your
              <br />
              <span className="font-medium text-foreground">profile.</span>
            </h2>
            <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
              Drop in a resume PDF and Mira will pre-fill it for you, or start from scratch.
            </p>

            <div className="mt-5 flex flex-col items-stretch gap-2">
              <button
                ref={importBtnRef}
                type="button"
                onClick={onImportResume}
                disabled={parsing}
                className="w-full flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-[12px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 disabled:cursor-default"
              >
                {parsing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Parsing…
                  </>
                ) : (
                  <>
                    <FileText size={13} />
                    Import from resume
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                disabled={parsing}
                className="w-full h-9 px-4 rounded-lg text-[12px] font-medium text-foreground bg-transparent border border-border hover:bg-accent transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
              >
                Fill manually
              </button>
            </div>

            <div className="mt-5 pt-3 border-t border-border/60 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Lock size={10} aria-hidden />
              <span>Files stay on your device. PDF resumes only.</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return dialog;
  return createPortal(dialog, document.body);
}
