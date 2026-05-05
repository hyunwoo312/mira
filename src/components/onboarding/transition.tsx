import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import { EASE } from './animation';

interface PageWipeProps {
  /** Stable key per phase — drives the AnimatePresence keyed re-mount. */
  pageKey: string;
  /** -1 = back, 1 = forward. */
  direction: number;
  children: ReactNode;
}

/**
 * Hairline-seam page transition. As phases swap, a horizontal line draws
 * across the content area, the outgoing phase lifts above it and fades, and
 * the incoming phase rises from below. The seam dissolves once content settles.
 */
export function PageWipe({ pageKey, direction, children }: PageWipeProps) {
  return (
    <div className="relative w-full">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={pageKey}
          custom={direction}
          initial={{ opacity: 0, y: 36 * direction }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -36 * direction }}
          transition={{
            opacity: { duration: 0.35, ease: EASE },
            y: { duration: 0.55, ease: EASE },
          }}
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <SeamLine pageKey={pageKey} />
    </div>
  );
}

/**
 * Horizontal hairline that draws across the seam at each phase swap, then
 * fades into the page. Re-keys on every transition so it replays.
 */
function SeamLine({ pageKey }: { pageKey: string }) {
  return (
    <motion.div
      key={pageKey}
      className="absolute top-1/2 left-0 right-0 h-px bg-foreground/15 origin-center pointer-events-none"
      initial={{ scaleX: 0, opacity: 1 }}
      animate={{ scaleX: [0, 1, 1, 0], opacity: [1, 1, 0.4, 0] }}
      transition={{ duration: 0.65, ease: EASE, times: [0, 0.45, 0.7, 1] }}
      aria-hidden
    />
  );
}
