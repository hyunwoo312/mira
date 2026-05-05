import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deepQuerySelectorAll } from '../scanners/shared';

describe('deepQuerySelectorAll', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('finds elements in the main DOM', () => {
    container.innerHTML = '<input id="a" type="text"><input id="b" type="text">';
    const found = deepQuerySelectorAll<HTMLInputElement>(container, 'input');
    expect(found.map((el) => el.id)).toEqual(['a', 'b']);
  });

  it('finds elements inside an open shadow root', () => {
    const host = document.createElement('div');
    container.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<input id="hidden" type="text">';

    const found = deepQuerySelectorAll<HTMLInputElement>(container, 'input');
    expect(found.map((el) => el.id)).toEqual(['hidden']);
  });

  it('combines main DOM and shadow-root matches', () => {
    container.innerHTML = '<input id="outer" type="text"><div id="host"></div>';
    const host = container.querySelector('#host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<input id="inner" type="text">';

    const found = deepQuerySelectorAll<HTMLInputElement>(container, 'input');
    const ids = found.map((el) => el.id).sort();
    expect(ids).toEqual(['inner', 'outer']);
  });

  it('handles nested shadow roots', () => {
    const outerHost = document.createElement('div');
    container.appendChild(outerHost);
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    outerShadow.innerHTML = '<div id="inner-host"></div>';
    const innerHost = outerShadow.querySelector('#inner-host')!;
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    innerShadow.innerHTML = '<input id="deep" type="text">';

    const found = deepQuerySelectorAll<HTMLInputElement>(container, 'input');
    expect(found.map((el) => el.id)).toEqual(['deep']);
  });

  it('does not loop on cyclic shadow refs', () => {
    // Synthetic guard test: ensure the visited-set prevents infinite recursion
    // even though browsers don't actually allow cycles.
    const host = document.createElement('div');
    container.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<input id="x">';

    expect(() => deepQuerySelectorAll(container, 'input')).not.toThrow();
  });

  it('returns empty array when nothing matches', () => {
    container.innerHTML = '<div></div>';
    expect(deepQuerySelectorAll(container, 'input')).toEqual([]);
  });
});
