import { motion } from 'framer-motion';
import { ArrowRight, Lock } from 'lucide-react';
import { EASE, stagger } from '../animation';

const STEPS = [
  {
    n: '01',
    title: 'Scan',
    body: 'Mira reads the form on the page — every input, label, and section.',
  },
  {
    n: '02',
    title: 'Classify',
    body: 'Each field is categorized by an on-device model trained on real ATS pages.',
  },
  {
    n: '03',
    title: 'Fill',
    body: 'Your profile populates the right field, formatted to match what each form expects.',
  },
];

export function Method({ onNext, onBack: _onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        <motion.span
          {...stagger(0)}
          className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60"
        >
          How it works
        </motion.span>
        <motion.h2
          {...stagger(1)}
          className="text-[34px] leading-[1.15] tracking-tight font-light text-foreground/45"
        >
          Three passes,
          <br />
          <span className="font-medium text-foreground">one click.</span>
        </motion.h2>
      </div>

      <div className="flex flex-col">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            {...stagger(i + 2)}
            className="relative flex items-start gap-6 py-5"
          >
            <span className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/50 tabular-nums w-8 pt-1">
              {step.n}
            </span>
            <div className="flex-1">
              <h3 className="text-[15px] font-medium text-foreground mb-1">{step.title}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-px bg-border origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.2 + i * 0.1 }}
              aria-hidden
            />
          </motion.div>
        ))}
      </div>

      <motion.div
        {...stagger(STEPS.length + 2)}
        className="flex items-start gap-3 px-4 py-3 rounded-md bg-muted/50 border border-border/60"
      >
        <Lock size={13} className="text-foreground/60 mt-0.5 shrink-0" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <span className="text-foreground font-medium">Privacy.</span> Nothing leaves your browser.
          No accounts, no servers — your profile and the model both run locally.
        </p>
      </motion.div>

      <motion.div {...stagger(STEPS.length + 3)} className="pt-2">
        <ContinueAction onClick={onNext} />
      </motion.div>
    </div>
  );
}

function ContinueAction({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-2 py-1.5 text-[13px] font-medium text-foreground transition-colors cursor-pointer"
    >
      <span>Continue</span>
      <ArrowRight
        size={14}
        className="transition-transform duration-200 ease-out group-hover:translate-x-1"
      />
      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" aria-hidden />
    </button>
  );
}
