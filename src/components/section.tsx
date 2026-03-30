import type { SectionId } from '@/types/profile';
import type { ReactNode } from 'react';

interface SectionProps {
  id: SectionId;
  title: string;
  titleBold: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ id, title, titleBold, action, children }: SectionProps) {
  return (
    <section data-section={id} className="scroll-mt-24 pb-8 mb-4">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-[26px] leading-tight tracking-tight font-light">
          <span className="text-muted-foreground">{title}</span>
          <br />
          <span className="text-foreground font-medium">{titleBold}</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
