import '@testing-library/jest-dom/vitest';
import { setupChromeMock } from './chrome-mock';

// Mock chrome APIs globally
setupChromeMock();

// Mock IntersectionObserver for Framer Motion's whileInView
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: readonly number[] = [];

  constructor(private callback: (entries: unknown[], observer: unknown) => void) {
    setTimeout(() => {
      this.callback([], this);
    }, 0);
  }

  observe(_target: Element): void {}
  unobserve(_target: Element): void {}
  disconnect(): void {}
  takeRecords(): never[] {
    return [];
  }
}

globalThis.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock Element.scrollTo and scrollIntoView for jsdom
Element.prototype.scrollTo = function () {};
Element.prototype.scrollIntoView = function () {};
window.scrollTo = function () {} as typeof window.scrollTo;
