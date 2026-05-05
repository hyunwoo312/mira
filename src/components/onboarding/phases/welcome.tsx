import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { EASE, stagger } from '../animation';

export function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-start gap-10">
      <motion.span
        {...stagger(0)}
        className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60"
      >
        First time here
      </motion.span>

      <motion.h1
        {...stagger(1)}
        className="text-[44px] leading-[1.1] tracking-tight font-light text-foreground/45"
      >
        An auto-fill,
        <br />
        <span className="font-medium text-foreground">for job applications.</span>
      </motion.h1>

      <motion.p
        {...stagger(2)}
        className="text-[15px] leading-relaxed text-muted-foreground max-w-[460px]"
      >
        You build a profile once. Mira fills it into Greenhouse, Ashby, Lever, Workday, and iCIMS
        forms — on your machine, in one click.
      </motion.p>

      <motion.div {...stagger(3)} className="pt-2">
        <BeginAction onClick={onNext} />
      </motion.div>
    </div>
  );
}

function BeginAction({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-2 py-1.5 text-[13px] font-medium text-foreground transition-colors cursor-pointer"
    >
      <span>Begin</span>
      <ArrowRight
        size={14}
        className="transition-transform duration-200 ease-out group-hover:translate-x-1"
      />
      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" aria-hidden />
      <motion.span
        className="absolute -bottom-0.5 left-0 h-px bg-foreground"
        initial={{ width: 0 }}
        whileHover={{ width: '100%' }}
        transition={{ duration: 0.25, ease: EASE }}
        aria-hidden
      />
    </button>
  );
}
