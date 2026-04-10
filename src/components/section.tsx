import { useState } from 'react';
import { Info } from 'lucide-react';
import type { SectionId } from '@/types/profile';
import type { ReactNode } from 'react';

const SECTION_HINTS: Record<SectionId, string> = {
  personal: 'Name, email, phone, and address used to fill contact fields on applications.',
  links: 'LinkedIn, GitHub, portfolio, and other URLs auto-fill when applications ask for them.',
  work: 'Your most recent role is used for company and title fields. Add more for multi-entry forms.',
  education: 'School, degree, and dates populate education sections on application forms.',
  skills: 'Skills and languages fill relevant fields. Some forms list these as checkboxes.',
  preferences: 'Start date, work arrangement, and salary range fill when applications ask.',
  eeo: 'Equal employment opportunity fields. These are always optional — skip if you prefer.',
  documents: 'Upload your resume to auto-attach it on supported platforms.',
  answers: 'Add Q&A pairs for open-ended questions. Mira matches them to similar fields using ML.',
};

interface SectionProps {
  id: SectionId;
  title: string;
  titleBold: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ id, title, titleBold, action, children }: SectionProps) {
  const [showHint, setShowHint] = useState(false);
  const hint = SECTION_HINTS[id];

  return (
    <section data-section={id} className="scroll-mt-24 pb-8 mb-4">
      <div className="flex justify-between items-end mb-6">
        <div className="relative">
          <h2 className="text-[26px] leading-tight tracking-tight font-light">
            <span className="text-muted-foreground">{title}</span>
            <br />
            <span className="text-foreground font-medium">
              {titleBold}
              {hint && (
                <span className="relative inline-flex items-center ml-1.5 align-middle">
                  <button
                    type="button"
                    className="inline-flex items-center text-foreground/35 hover:text-foreground/60 transition-colors cursor-pointer"
                    onMouseEnter={() => setShowHint(true)}
                    onMouseLeave={() => setShowHint(false)}
                    onClick={() => setShowHint(!showHint)}
                    aria-label="Section info"
                  >
                    <Info size={13} />
                  </button>
                  {showHint && (
                    <div className="absolute left-0 top-full mt-2 z-10 min-w-[200px] max-w-[calc(100vw-4rem)] px-3 py-2 rounded-lg bg-popover/95 backdrop-blur-sm border border-border/50 shadow-lg text-[11px] leading-relaxed text-foreground/60 break-words">
                      {hint}
                    </div>
                  )}
                </span>
              )}
            </span>
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
