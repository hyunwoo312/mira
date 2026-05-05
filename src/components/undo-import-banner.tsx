import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

const EASE = [0.25, 0.1, 0.25, 1] as const;
const TTL_MS = 10_000;

interface UndoImportBannerProps {
  /** When this becomes a fresh truthy value, the banner appears and a TTL begins. */
  active: boolean;
  onUndo: () => void | Promise<void>;
  onDismiss: () => void;
}

/**
 * Sticky at the top of the profile scroll area for 10s after a resume import,
 * with an Undo affordance that rolls profile + attached file back to the
 * pre-import snapshot.
 */
export function UndoImportBanner({ active, onUndo, onDismiss }: UndoImportBannerProps) {
  const [progress, setProgress] = useState(1);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / TTL_MS);
      setProgress(remaining);
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
          className="sticky top-2 mx-3 z-20 rounded-lg border border-border bg-[oklch(0.87_0.025_70)] dark:bg-[oklch(0.24_0.012_70)] shadow-sm overflow-hidden"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="text-[9px] uppercase tracking-[0.14em] font-semibold text-foreground/55 shrink-0">
              Imported
            </span>
            <span className="flex-1 text-[12px] text-foreground/80 leading-snug">
              Profile pre-filled from resume.
            </span>
            <button
              type="button"
              onClick={() => void onUndo()}
              className="relative text-[11px] font-medium text-foreground hover:text-foreground/70 transition-colors cursor-pointer"
            >
              Undo
              <span
                aria-hidden
                className="absolute -bottom-0.5 left-0 right-0 h-px bg-foreground/60"
              />
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
          <div
            className="h-px bg-foreground/20 origin-left"
            style={{ transform: `scaleX(${progress})` }}
            aria-hidden
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
