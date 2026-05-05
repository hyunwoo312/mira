import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWipe } from './transition';
import { Welcome } from './phases/welcome';
import { Method } from './phases/method';
import { ProfileTour } from './phases/profile-tour';
import { Trial } from './phases/trial';
import { Submitted } from './phases/submitted';
import { useDemoFillListener } from './use-demo-fill';
import { AutofillSilhouette } from './autofill-silhouette';
import { EASE } from './animation';

const PHASES = [
  { id: 'welcome', numeral: 'I', title: 'Welcome' },
  { id: 'method', numeral: 'II', title: 'Method' },
  { id: 'profile', numeral: 'III', title: 'Profile' },
  { id: 'trial', numeral: 'IV', title: 'Trial' },
  { id: 'submitted', numeral: 'V', title: 'Done' },
] as const;
const PHASE_COUNT = PHASES.length;
const SUBMITTED_PHASE = 4;

type PhaseIndex = 0 | 1 | 2 | 3 | 4;

export function Onboarding() {
  const [phase, setPhase] = useState<PhaseIndex>(0);
  const [direction, setDirection] = useState(1);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);

  useDemoFillListener();

  const goTo = useCallback((target: PhaseIndex) => {
    setPhase((current) => {
      setDirection(target > current ? 1 : -1);
      return target;
    });
  }, []);

  const next = useCallback(() => {
    setPhase((p) => {
      if (p >= PHASE_COUNT - 1) return p;
      setDirection(1);
      return (p + 1) as PhaseIndex;
    });
  }, []);

  const back = useCallback(() => {
    setPhase((p) => {
      if (p <= 0) return p;
      setDirection(-1);
      return (p - 1) as PhaseIndex;
    });
  }, []);

  const requestSkip = useCallback(() => setSkipConfirmOpen(true), []);
  const cancelSkip = useCallback(() => setSkipConfirmOpen(false), []);
  const confirmSkip = useCallback(() => {
    setSkipConfirmOpen(false);
    goTo(SUBMITTED_PHASE);
  }, [goTo]);

  const closeAndOpenSidePanel = useCallback(() => {
    void chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => {});
    window.close();
  }, []);

  const current = PHASES[phase]!;
  const skipVisible = phase < SUBMITTED_PHASE;

  return (
    <motion.div
      className="min-h-screen bg-background text-foreground flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <Header
        numeral={current.numeral}
        title={current.title}
        index={phase}
        onSkip={requestSkip}
        showSkip={skipVisible}
      />

      <main className="flex-1 flex flex-col relative">
        <AnimatePresence>
          {phase === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="absolute inset-0 pointer-events-none"
            >
              <AutofillSilhouette />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
          <div className="w-full max-w-[640px]">
            <PageWipe pageKey={current.id} direction={direction}>
              {phase === 0 && <Welcome onNext={next} />}
              {phase === 1 && <Method onNext={next} onBack={back} />}
              {phase === 2 && <ProfileTour onNext={next} onBack={back} />}
              {phase === 3 && <Trial onSubmit={next} onBack={back} />}
              {phase === 4 && <Submitted onClose={closeAndOpenSidePanel} />}
            </PageWipe>
          </div>
        </div>
      </main>

      <Footer phase={phase} onBack={back} onSkip={requestSkip} showSkip={skipVisible} />

      <SkipConfirm open={skipConfirmOpen} onCancel={cancelSkip} onConfirm={confirmSkip} />
    </motion.div>
  );
}

function SkipConfirm({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-popover border border-border rounded-lg p-5 mx-4 w-full max-w-[340px] shadow-md"
          >
            <h3 className="text-sm font-medium text-foreground mb-2">Skip the walkthrough?</h3>
            <p className="text-[12px] text-foreground/60 leading-relaxed mb-4">
              You'll skip the demo and go straight to the wrap-up. You can reopen this walkthrough
              any time from{' '}
              <span className="text-foreground">Settings → Onboarding → Open onboarding</span>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity cursor-pointer"
              >
                Skip
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({
  numeral,
  title,
  index,
  onSkip,
  showSkip,
}: {
  numeral: string;
  title: string;
  index: number;
  onSkip: () => void;
  showSkip: boolean;
}) {
  return (
    <header className="relative">
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.25 }}
        className="max-w-[920px] mx-auto px-6 h-12 flex items-center justify-between"
      >
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground">
          <span className="text-foreground">Mira</span>
          <span className="text-muted-foreground/40">/</span>
          <NumeralTicker numeral={numeral} />
          <span>—</span>
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <Dots index={index} />
          {showSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="text-[10px] uppercase tracking-[0.05em] font-medium text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              Skip
            </button>
          )}
        </div>
      </motion.div>
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-border origin-center"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
        aria-hidden
      />
    </header>
  );
}

/**
 * Cross-fade between roman numerals as phases swap. Outgoing slides up + out,
 * incoming rises + in. Tabular-num spacing keeps the slot stable.
 */
function NumeralTicker({ numeral }: { numeral: string }) {
  return (
    <span className="relative inline-block tabular-nums font-medium text-foreground/80 min-w-[1.5em] h-[1.2em] leading-none">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={numeral}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="absolute inset-0"
        >
          {numeral}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Dots({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: PHASE_COUNT }).map((_, i) => (
        <motion.span
          key={i}
          className="block h-1 rounded-full"
          animate={{
            width: i === index ? 18 : 4,
            backgroundColor:
              i === index
                ? 'var(--color-foreground)'
                : i < index
                  ? 'var(--color-muted-foreground)'
                  : 'var(--color-border)',
          }}
          transition={{ duration: 0.3, ease: EASE }}
        />
      ))}
    </div>
  );
}

function Footer({
  phase,
  onBack,
  onSkip,
  showSkip,
}: {
  phase: number;
  onBack: () => void;
  onSkip: () => void;
  showSkip: boolean;
}) {
  return (
    <footer className="border-t border-border">
      <div className="max-w-[920px] mx-auto px-6 h-12 flex items-center justify-between text-[10px] uppercase tracking-[0.05em] font-medium text-muted-foreground/60">
        <button
          type="button"
          onClick={onBack}
          disabled={phase === 0}
          className="hover:text-foreground transition-colors cursor-pointer disabled:opacity-0 disabled:cursor-default"
        >
          ← Back
        </button>
        {showSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            Skip walkthrough →
          </button>
        )}
      </div>
    </footer>
  );
}
