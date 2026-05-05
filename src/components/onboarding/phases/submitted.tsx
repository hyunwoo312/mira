import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Lock, Keyboard, RotateCcw } from 'lucide-react';
import { EASE, stagger } from '../animation';
import { getLastDemoFillStats, subscribeDemoFillStats, type DemoFillStats } from '../use-demo-fill';

const TIPS = [
  {
    icon: Keyboard,
    title: 'Use the shortcut',
    body: 'Ctrl+Shift+F (⌘⇧F on Mac) fills any form on any supported ATS without leaving the page.',
  },
  {
    icon: Lock,
    title: 'Everything stays local',
    body: 'Profile, resume, fill history — none of it leaves the browser. The ML model runs on-device.',
  },
  {
    icon: RotateCcw,
    title: 'Refine over time',
    body: 'When a fill misses, the side panel log lets you flag fields. Your answers and preferences improve with each form.',
  },
];

export function Submitted({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<DemoFillStats | null>(getLastDemoFillStats());
  useEffect(() => subscribeDemoFillStats(setStats), []);

  return (
    <div className="flex flex-col gap-10 w-full">
      <motion.div {...stagger(0)} className="flex items-center gap-2.5">
        <SubmittedSeal />
        <span className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60">
          Walkthrough complete
        </span>
      </motion.div>

      <div className="flex flex-col gap-4">
        <motion.h2
          {...stagger(1)}
          className="text-[34px] leading-[1.15] tracking-tight font-light text-foreground/45"
        >
          Application
          <br />
          <span className="font-medium text-foreground">submitted.</span>
        </motion.h2>
        <motion.p
          {...stagger(2)}
          className="text-[13px] leading-relaxed text-muted-foreground max-w-[520px]"
        >
          On a real form, that's the moment your application lands in someone's queue. Mira didn't
          actually send anything — this whole flow ran on your machine. Now you're set up to use it
          for the real thing.
        </motion.p>
      </div>

      {stats && stats.filled > 0 && (
        <motion.div {...stagger(3)} className="flex items-center gap-6 py-4 border-y border-border">
          <Stat label="Filled" value={String(stats.filled)} />
          <Stat label="Skipped" value={String(stats.skipped)} />
          <Stat label="Duration" value={formatDuration(stats.durationMs)} />
        </motion.div>
      )}

      <div className="flex flex-col gap-1">
        <motion.span
          {...stagger(4)}
          className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60 mb-3"
        >
          A few things to remember
        </motion.span>
        {TIPS.map((tip, i) => (
          <motion.div key={tip.title} {...stagger(5 + i)}>
            <Tip icon={tip.icon} title={tip.title} body={tip.body} />
          </motion.div>
        ))}
      </div>

      <motion.div {...stagger(8)} className="pt-2">
        <CloseAction onClick={onClose} />
      </motion.div>

      <motion.p
        {...stagger(9)}
        className="text-[11px] leading-relaxed text-muted-foreground/50 max-w-[520px]"
      >
        You can reopen this walkthrough any time from Settings → Onboarding → Open onboarding.
      </motion.p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60">
        {label}
      </span>
      <span className="text-[20px] leading-none font-light text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function Tip({ icon: Icon, title, body }: { icon: typeof Check; title: string; body: string }) {
  return (
    <div className="relative flex items-start gap-4 py-4">
      <div className="relative w-7 h-7 shrink-0 mt-0.5">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
          className="absolute inset-0 flex items-center justify-center rounded-md bg-muted/50 border border-border/60 text-foreground/70 tip-icon-stroke"
        >
          <Icon size={13} strokeWidth={1.75} />
        </motion.div>
      </div>
      <div className="flex-1">
        <h4 className="text-[13px] font-medium text-foreground mb-0.5">{title}</h4>
        <p className="text-[12px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-border origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.25 }}
        aria-hidden
      />
    </div>
  );
}

/** Animated seal that lands the "submitted" beat: ring expands from 0,
 *  check stroke draws in, both settle with a tiny scale pulse. */
function SubmittedSeal() {
  return (
    <div className="relative w-7 h-7">
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-foreground/20"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.5, 1], opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-foreground text-background flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
      >
        <svg viewBox="0 0 24 24" className="w-[14px] h-[14px]" aria-hidden>
          <motion.path
            d="M5 12 l4 4 l10 -10"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.4 }}
          />
        </svg>
      </motion.div>
    </div>
  );
}

function CloseAction({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-2 py-1.5 text-[13px] font-medium text-foreground transition-colors cursor-pointer"
    >
      <span>Open Mira and start</span>
      <ArrowRight
        size={14}
        className="transition-transform duration-200 ease-out group-hover:translate-x-1"
      />
      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" aria-hidden />
    </button>
  );
}
