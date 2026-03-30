import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PROFILE_SECTIONS, type SectionId } from '@/types/profile';
import { cn } from '@/lib/utils';

const TAB_LABELS: Record<SectionId, string> = {
  personal: 'Personal',
  links: 'Links',
  work: 'Work',
  education: 'Education',
  skills: 'Skills',
  preferences: 'Preferences',
  eeo: 'EEO',
  documents: 'Documents',
  answers: 'Answers',
};

interface TabBarProps {
  activeSection: SectionId;
  onTabClick: (id: SectionId) => void;
}

export function TabBar({ activeSection, onTabClick }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSection]);

  // Convert vertical mouse wheel to horizontal scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY, behavior: 'smooth' });
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  return (
    <nav className="border-b border-border bg-background shrink-0 relative">
      <div ref={scrollRef} role="tablist" className="flex overflow-x-auto scrollbar-hide px-2">
        {PROFILE_SECTIONS.map((section) => {
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onTabClick(section.id)}
              aria-selected={isActive}
              role="tab"
              className={cn(
                'relative block shrink-0 px-3.5 py-3 text-xs whitespace-nowrap transition-colors cursor-pointer',
                isActive
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {TAB_LABELS[section.id]}
              {isActive && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-foreground"
                  transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
