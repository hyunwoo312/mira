import { motion } from 'framer-motion';
import { ArrowRight, FileText } from 'lucide-react';
import { DEMO_PROFILE } from '@/lib/onboarding/demo-profile';
import { stagger } from '../animation';

export function ProfileTour({ onNext }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-10 w-full">
      <div className="flex flex-col gap-4">
        <motion.span
          {...stagger(0)}
          className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60"
        >
          What you'll edit
        </motion.span>
        <motion.h2
          {...stagger(1)}
          className="text-[34px] leading-[1.15] tracking-tight font-light text-foreground/45"
        >
          Your profile
          <br />
          <span className="font-medium text-foreground">lives in the side panel.</span>
        </motion.h2>
        <motion.p
          {...stagger(2)}
          className="text-[13px] leading-relaxed text-muted-foreground max-w-[520px]"
        >
          Build it once, in a few minutes. Each section below maps to fields on real applications —
          the more complete your profile, the more Mira can fill.
        </motion.p>
      </div>

      <div className="flex flex-col gap-3">
        <motion.div {...stagger(3)}>
          <SectionCard
            label="Personal"
            description="Name, email, phone, address. Used for every contact field on every form."
            preview={[
              ['First Name', DEMO_PROFILE.firstName],
              ['Email', DEMO_PROFILE.email],
              ['City', DEMO_PROFILE.city],
            ]}
          />
        </motion.div>

        <motion.div {...stagger(4)}>
          <SectionCard
            label="Links"
            description="LinkedIn, GitHub, portfolio. Auto-fills when applications ask."
            preview={[
              ['LinkedIn', stripScheme(DEMO_PROFILE.linkedin)],
              ['GitHub', stripScheme(DEMO_PROFILE.github)],
            ]}
          />
        </motion.div>

        <motion.div {...stagger(5)}>
          <SectionCard
            label="Work & Education"
            description="Most recent role + school populate company, title, degree fields."
            preview={[
              ['Company', DEMO_PROFILE.workExperience[0]?.company ?? ''],
              ['School', DEMO_PROFILE.education[0]?.school ?? ''],
              ['Degree', DEMO_PROFILE.education[0]?.degree ?? ''],
            ]}
          />
        </motion.div>

        <motion.div {...stagger(6)}>
          <DocumentsCard />
        </motion.div>

        <motion.div {...stagger(7)}>
          <SectionCard
            label="Answers"
            description="Custom Q&A pairs for open-ended prompts. Mira uses ML to match them to similar questions."
            preview={[
              [
                DEMO_PROFILE.answerBank[0]?.question ?? 'Why this role?',
                truncate(DEMO_PROFILE.answerBank[0]?.answer ?? ''),
              ],
            ]}
          />
        </motion.div>
      </div>

      <motion.p
        {...stagger(8)}
        className="text-[11px] leading-relaxed text-muted-foreground/60 max-w-[520px] -mt-2"
      >
        Skip the typing later — when you set up your real preset, Mira can pre-fill it from a resume
        PDF in one step.
      </motion.p>

      <motion.div {...stagger(9)} className="pt-2">
        <ContinueAction onClick={onNext} />
      </motion.div>
    </div>
  );
}

function SectionCard({
  label,
  description,
  preview,
}: {
  label: string;
  description: string;
  preview: [string, string][];
}) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-6 items-start py-4 border-b border-border">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground">
          {label}
        </span>
        <p className="text-[12px] leading-relaxed text-muted-foreground/80">{description}</p>
      </div>
      <div className="flex flex-col">
        {preview.map(([k, v], i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-border/60 last:border-b-0"
          >
            <span className="text-[10px] uppercase tracking-[0.05em] font-medium text-muted-foreground">
              {k}
            </span>
            <span className="text-[12px] text-foreground/80 tabular-nums truncate ml-3">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsCard() {
  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-6 items-start py-4 border-b border-border">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground">
          Documents
        </span>
        <p className="text-[12px] leading-relaxed text-muted-foreground/80">
          Drop a resume PDF in your real profile and Mira can pre-fill the whole thing — or just
          attach it as-is. Cover letters attach as-is.
        </p>
      </div>
      <DocumentsSectionPreview />
    </div>
  );
}

/** Mirrors the real Documents section UI in a non-interactive preview. */
function DocumentsSectionPreview() {
  return (
    <div
      aria-hidden
      className="relative space-y-3 rounded-md border border-border/60 bg-muted/30 p-3 select-none"
    >
      <div className="absolute top-2 right-2 text-[8px] uppercase tracking-[0.12em] font-medium text-muted-foreground/50 px-1.5 py-0.5 rounded bg-background/70 border border-border/60">
        Preview
      </div>
      <div className="flex gap-1.5">
        <span className="px-3 h-6 inline-flex items-center rounded-full text-[10px] font-medium bg-foreground text-background border border-foreground">
          Resume
        </span>
        <span className="px-3 h-6 inline-flex items-center rounded-full text-[10px] font-medium border border-border text-muted-foreground/70">
          Cover Letter
        </span>
      </div>
      <div className="rounded-md border border-dashed border-border/70 bg-background/40 px-4 py-5 flex flex-col items-center text-center">
        <FileText size={16} className="text-foreground/30 mb-1.5" />
        <span className="text-[11px] font-medium text-foreground/55">Drop your resume here</span>
        <span className="text-[10px] text-muted-foreground/60 mt-0.5">PDF, DOCX up to 5MB</span>
      </div>
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Drop a PDF and Mira can parse it to pre-fill your profile.
      </p>
    </div>
  );
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function truncate(s: string, max = 56): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

function ContinueAction({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-2 py-1.5 text-[13px] font-medium text-foreground transition-colors cursor-pointer"
    >
      <span>Continue to demo</span>
      <ArrowRight
        size={14}
        className="transition-transform duration-200 ease-out group-hover:translate-x-1"
      />
      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" aria-hidden />
    </button>
  );
}
