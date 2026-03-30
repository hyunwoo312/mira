import { useState, useEffect, useRef, useCallback } from 'react';
import type { SectionId } from '@/types/profile';

export function useScrollspy(sectionIds: readonly SectionId[]) {
  const [activeSection, setActiveSection] = useState<SectionId>(sectionIds[0]!);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const isScrollingToRef = useRef(false);

  // Callback ref — fires when the DOM element mounts/unmounts
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  useEffect(() => {
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingToRef.current) return;

      const threshold = container.clientHeight * 0.35;
      let current: SectionId = sectionIds[0]!;

      for (const id of sectionIds) {
        const el = container.querySelector(`[data-section="${id}"]`) as HTMLElement;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;

        if (relativeTop <= threshold) {
          current = id;
        }
      }

      setActiveSection(current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [container, sectionIds]);

  const scrollToSection = useCallback(
    (id: SectionId) => {
      if (!container) return;

      const element = container.querySelector(`[data-section="${id}"]`);
      if (!element) return;

      isScrollingToRef.current = true;
      setActiveSection(id);

      element.scrollIntoView({ behavior: 'smooth', block: 'start' });

      setTimeout(() => {
        isScrollingToRef.current = false;
      }, 600);
    },
    [container],
  );

  return { activeSection, containerRef, scrollToSection };
}
