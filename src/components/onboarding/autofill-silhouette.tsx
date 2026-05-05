import { motion } from 'framer-motion';
import { EASE } from './animation';

// Visual loop suggesting form fields filling in. Decorative — sits behind
// the welcome copy at low opacity. Each line fills horizontally on its own
// staggered delay and resets, so the page always feels alive.

interface FieldLine {
  /** Top offset in % of viewport. */
  top: number;
  /** Width of label area in % of container. */
  labelWidth: number;
  /** Width of value bar in % (the part that fills). */
  valueWidth: number;
  /** Animation delay in seconds within the loop. */
  delay: number;
  /** Loop duration in seconds. */
  duration: number;
}

const LINES: FieldLine[] = [
  { top: 8, labelWidth: 12, valueWidth: 28, delay: 0.0, duration: 5.2 },
  { top: 18, labelWidth: 10, valueWidth: 36, delay: 0.6, duration: 5.6 },
  { top: 28, labelWidth: 14, valueWidth: 22, delay: 1.2, duration: 4.8 },
  { top: 40, labelWidth: 11, valueWidth: 32, delay: 0.4, duration: 5.4 },
  { top: 52, labelWidth: 13, valueWidth: 26, delay: 1.8, duration: 5.0 },
  { top: 63, labelWidth: 9, valueWidth: 38, delay: 0.9, duration: 5.8 },
  { top: 74, labelWidth: 12, valueWidth: 30, delay: 1.4, duration: 5.2 },
  { top: 86, labelWidth: 10, valueWidth: 24, delay: 2.2, duration: 4.6 },
];

export function AutofillSilhouette() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
      style={{ maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)' }}
    >
      {LINES.map((line, i) => (
        <FieldRow key={i} {...line} />
      ))}
    </div>
  );
}

function FieldRow({ top, labelWidth, valueWidth, delay, duration }: FieldLine) {
  return (
    <div
      className="absolute left-0 right-0 flex items-center gap-3 px-[12%]"
      style={{ top: `${top}%` }}
    >
      <div className="h-px bg-foreground/[0.04]" style={{ width: `${labelWidth}%` }} />
      <div
        className="relative h-[3px] rounded-full bg-foreground/[0.025] overflow-hidden flex-shrink-0"
        style={{ width: `${valueWidth}%` }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-foreground/[0.07] rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: ['0%', '0%', '100%', '100%', '0%'] }}
          transition={{
            duration,
            ease: EASE,
            delay,
            repeat: Infinity,
            times: [0, 0.1, 0.5, 0.85, 1],
          }}
        />
      </div>
    </div>
  );
}
