/**
 * Shared setup for scanner tests.
 * jsdom doesn't support layout — override offsetParent/offsetWidth/offsetHeight
 * so all elements appear "visible" during tests.
 */

import { beforeAll, afterAll } from 'vitest';

const origOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return this.parentElement ?? document.body;
    },
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    get() {
      return 100;
    },
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    get() {
      return 20;
    },
    configurable: true,
  });
});

afterAll(() => {
  if (origOffsetParent)
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', origOffsetParent);
  if (origOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origOffsetWidth);
  if (origOffsetHeight)
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeight);
});
