import { motion } from 'framer-motion';
import { DummyForm } from '../dummy-form';
import { stagger } from '../animation';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT_KEYS = isMac ? ['⌘', '⇧', 'F'] : ['Ctrl', 'Shift', 'F'];

export function Trial({ onSubmit }: { onBack: () => void; onSubmit: () => void }) {
  return (
    <div className="flex flex-col gap-10 w-full">
      <div className="flex flex-col gap-4">
        <motion.span
          {...stagger(0)}
          className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60"
        >
          Your turn
        </motion.span>
        <motion.h2
          {...stagger(1)}
          className="text-[34px] leading-[1.15] tracking-tight font-light text-foreground/45"
        >
          Try Mira on
          <br />
          <span className="font-medium text-foreground">this form.</span>
        </motion.h2>
        <motion.p
          {...stagger(2)}
          className="text-[13px] leading-relaxed text-muted-foreground max-w-[520px]"
        >
          Open the Mira side panel, then click <span className="text-foreground">Fill</span>. The
          form below will populate with a sample candidate so you can see how it feels in practice.
          When you're ready, hit Submit to wrap up the walkthrough.
        </motion.p>
      </div>

      <motion.div {...stagger(3)} className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-muted-foreground">Press</span>
          <Kbd keys={SHORTCUT_KEYS} />
          <span className="text-muted-foreground">or click the Mira icon in your toolbar.</span>
        </div>
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          Don't see the icon? Click the puzzle piece in your browser bar and pin Mira.
        </p>
      </motion.div>

      <motion.div {...stagger(4)}>
        <DummyForm onSubmit={onSubmit} />
      </motion.div>
    </div>
  );
}

function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 rounded-md border border-border bg-muted/40 text-[11px] font-medium text-foreground tabular-nums"
        >
          {k}
        </span>
      ))}
    </span>
  );
}
