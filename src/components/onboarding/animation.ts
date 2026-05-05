export const EASE = [0.25, 0.1, 0.25, 1] as const;

/** Staggered fade-up entrance — shared across phase components for consistency. */
export function stagger(i: number, base = 0.05) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: EASE, delay: base + i * 0.07 },
  };
}
