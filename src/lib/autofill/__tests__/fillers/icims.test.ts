import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../scanners/setup';

// Track bridge calls so tests can assert on them
const bridgeCalls: Array<{ type: string; args: unknown[] }> = [];

vi.mock('../../bridge', () => ({
  bridgeClick: vi.fn(async (el: HTMLElement) => {
    bridgeCalls.push({ type: 'click', args: [el.id || el.tagName] });
    // Simulate user click so handlers that listen to click can react in tests.
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }),
  bridgeSetText: vi.fn(async (el: HTMLInputElement, value: string) => {
    bridgeCalls.push({ type: 'setText', args: [el.id, value] });
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }),
  bridgeSetSelect: vi.fn(async (el: HTMLSelectElement, value: string) => {
    bridgeCalls.push({ type: 'setSelect', args: [el.id, value] });
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }),
}));

// ML stub so fillers don't make real offscreen calls.
vi.mock('../../classify/ml', () => ({
  scoreOptionsWithML: vi.fn().mockResolvedValue({ bestIndex: -1, confidence: 0 }),
}));

import { fillIcimsTypeahead, fillIcimsDate } from '../../fillers/icims';

const TYPEAHEAD_BASE_ID = '1570139_PersonProfileFields.AddressCountry';

function buildTypeaheadDOM(selectedText: string | null, optionTitles: string[]): HTMLAnchorElement {
  const ctnrId = `${TYPEAHEAD_BASE_ID}_icimsDropdown_ctnr`;
  const resultsId = `${TYPEAHEAD_BASE_ID}_dropdown-results`;
  const placeholderHtml = selectedText
    ? `<span class="dropdown-text">${selectedText}</span>`
    : `<span class="dropdown-text"><span class="dropdown-placeholder">— Make a Selection —</span></span>`;
  document.body.innerHTML = `
    <div class="iCIMS_InfoData">
      <select id="${TYPEAHEAD_BASE_ID}" class="dropdown-hide"><option legacy="true"></option></select>
      <a id="${TYPEAHEAD_BASE_ID}_icimsDropdown" class="dropdown-select" role="combobox">
        ${placeholderHtml}
      </a>
      <div id="${ctnrId}" class="dropdown-container">
        <input type="text" class="dropdown-search" />
        <ul id="${resultsId}" class="dropdown-results" role="listbox">
          <li id="${resultsId}_-1" class="dropdown-result result-selectable"
              dropdown-index="-1" role="option">
            <span class="dropdown-placeholder">— Make a Selection —</span>
          </li>
          ${optionTitles
            .map(
              (t, i) =>
                `<li id="${resultsId}_${i}" class="dropdown-result result-selectable" dropdown-index="${i}" title="${t}" role="option">${t}</li>`,
            )
            .join('')}
        </ul>
      </div>
    </div>
  `;
  return document.getElementById(`${TYPEAHEAD_BASE_ID}_icimsDropdown`) as HTMLAnchorElement;
}

describe('fillIcimsTypeahead', () => {
  beforeEach(() => {
    bridgeCalls.length = 0;
    document.body.innerHTML = '';
  });

  it('opens dropdown and clicks the matching option when initial options contain the value', async () => {
    const anchor = buildTypeaheadDOM(null, ['United States', 'Afghanistan', 'Albania']);
    // When the matched li is clicked, swap the placeholder for the chosen text
    // so fillIcimsTypeahead's success probe passes.
    const resultsId = `${TYPEAHEAD_BASE_ID}_dropdown-results`;
    const targetLi = document.getElementById(`${resultsId}_0`)!;
    targetLi.addEventListener('click', () => {
      anchor.innerHTML = `<span class="dropdown-text">United States</span>`;
    });

    const result = await fillIcimsTypeahead(anchor, 'United States', 'country');
    expect(result.status).toBe('filled');
    expect(bridgeCalls.some((c) => c.type === 'click')).toBe(true);
  });

  it('skips with already-filled when the anchor has a non-placeholder value', async () => {
    const anchor = buildTypeaheadDOM('Canada', ['United States', 'Canada']);
    const result = await fillIcimsTypeahead(anchor, 'United States', 'country');
    expect(result).toEqual({ status: 'skipped', reason: 'already-filled' });
  });

  it('returns select-failed when click does not commit (placeholder still present)', async () => {
    buildTypeaheadDOM(null, ['United States']);
    const anchor = document.getElementById(`${TYPEAHEAD_BASE_ID}_icimsDropdown`)!;
    // No click listener → anchor keeps the placeholder, fillIcimsTypeahead's
    // success probe sees `.dropdown-placeholder` and reports select-failed.
    const result = await fillIcimsTypeahead(anchor, 'United States', 'country');
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toBe('select-failed');
  });

  it('returns no-dropdown when no options render after open', async () => {
    document.body.innerHTML = `
      <div class="iCIMS_InfoData">
        <select id="empty-select"><option legacy="true"></option></select>
        <a id="empty-select_icimsDropdown" role="combobox">
          <span class="dropdown-text"><span class="dropdown-placeholder">— Make a Selection —</span></span>
        </a>
        <div id="empty-select_icimsDropdown_ctnr" class="dropdown-container">
          <ul id="empty-select_dropdown-results" class="dropdown-results"></ul>
        </div>
      </div>
    `;
    const anchor = document.getElementById('empty-select_icimsDropdown')!;
    const result = await fillIcimsTypeahead(anchor, 'Texas', 'state');
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toBe('no-dropdown');
  });

  it('filters out the placeholder row (dropdown-index="-1") from matching', async () => {
    const anchor = buildTypeaheadDOM(null, ['Texas', 'Tennessee']);
    const resultsId = `${TYPEAHEAD_BASE_ID}_dropdown-results`;
    const targetLi = document.getElementById(`${resultsId}_0`)!;
    targetLi.addEventListener('click', () => {
      anchor.innerHTML = `<span class="dropdown-text">Texas</span>`;
    });

    const result = await fillIcimsTypeahead(anchor, 'Texas', 'state');
    expect(result.status).toBe('filled');
    // Click must be on a real option, not the placeholder row.
    const placeholderClicked = bridgeCalls.some(
      (c) => c.type === 'click' && String(c.args[0]).endsWith('_-1'),
    );
    expect(placeholderClicked).toBe(false);
  });

  it('resolves anchor from a select element passed in (scanner fallback)', async () => {
    buildTypeaheadDOM(null, ['United States']);
    const select = document.getElementById(TYPEAHEAD_BASE_ID) as HTMLSelectElement;
    const resultsId = `${TYPEAHEAD_BASE_ID}_dropdown-results`;
    const targetLi = document.getElementById(`${resultsId}_0`)!;
    const anchor = document.getElementById(`${TYPEAHEAD_BASE_ID}_icimsDropdown`)!;
    targetLi.addEventListener('click', () => {
      anchor.innerHTML = `<span class="dropdown-text">United States</span>`;
    });
    const result = await fillIcimsTypeahead(select, 'United States', 'country');
    expect(result.status).toBe('filled');
  });
});

describe('fillIcimsDate', () => {
  beforeEach(() => {
    bridgeCalls.length = 0;
    document.body.innerHTML = '';
  });

  function buildTripleDOM(suffixStyle: 'short' | 'long'): {
    month: HTMLSelectElement;
    day: HTMLSelectElement;
    year: HTMLInputElement;
  } {
    const [monS, datS, yeaS] =
      suffixStyle === 'short' ? ['_Mon', '_Dat', '_Yea'] : ['_Month', '_Date', '_Year'];
    const base = 'rcf3214';
    document.body.innerHTML = `
      <div class="iCIMS_TextInputField">
        <label>Start Date (Month / Day / Year)</label>
        <select id="${base}${monS}">
          <option value=""></option>
          ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            .map((m, i) => `<option value="${i + 1}">${m}</option>`)
            .join('')}
        </select>
        <select id="${base}${datS}">
          <option value=""></option>
          ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
        </select>
        <input type="text" id="${base}${yeaS}" />
      </div>
    `;
    return {
      month: document.getElementById(`${base}${monS}`) as HTMLSelectElement,
      day: document.getElementById(`${base}${datS}`) as HTMLSelectElement,
      year: document.getElementById(`${base}${yeaS}`) as HTMLInputElement,
    };
  }

  it('fills a date triple with MM/YYYY format (short suffix)', async () => {
    const { month, day, year } = buildTripleDOM('short');
    const result = await fillIcimsDate(month, '6/2022');
    expect(result.status).toBe('filled');
    expect(month.value).toBe('6');
    expect(day.value).toBe('1');
    expect(year.value).toBe('2022');
  });

  it('fills a date triple with long suffix (_Month/_Date/_Year)', async () => {
    const { month, year } = buildTripleDOM('long');
    const result = await fillIcimsDate(month, '6/2022');
    expect(result.status).toBe('filled');
    expect(month.value).toBe('6');
    expect(year.value).toBe('2022');
  });

  it('parses ISO format (YYYY-MM-DD)', async () => {
    const { month, day, year } = buildTripleDOM('short');
    const result = await fillIcimsDate(month, '2022-08-15');
    expect(result.status).toBe('filled');
    expect(month.value).toBe('8');
    expect(day.value).toBe('15');
    expect(year.value).toBe('2022');
  });

  it('parses US format (MM/DD/YYYY)', async () => {
    const { month, day, year } = buildTripleDOM('short');
    const result = await fillIcimsDate(month, '08/15/2022');
    expect(result.status).toBe('filled');
    expect(month.value).toBe('8');
    expect(day.value).toBe('15');
    expect(year.value).toBe('2022');
  });

  it('parses month-name + year (e.g. "May 2022")', async () => {
    const { month, year } = buildTripleDOM('short');
    const result = await fillIcimsDate(month, 'May 2022');
    expect(result.status).toBe('filled');
    expect(month.value).toBe('5');
    expect(year.value).toBe('2022');
  });

  it('skips when both month and year already selected', async () => {
    const { month, year } = buildTripleDOM('short');
    month.value = '6';
    year.value = '2022';
    const result = await fillIcimsDate(month, '8/2023');
    expect(result).toEqual({ status: 'skipped', reason: 'already-filled' });
  });

  it("returns wrong-type for garbage values that can't be parsed as a date", async () => {
    const { month } = buildTripleDOM('short');
    const result = await fillIcimsDate(month, 'not-a-date');
    expect(result).toEqual({ status: 'skipped', reason: 'wrong-type' });
  });

  it('returns element-error when sibling inputs are missing', async () => {
    document.body.innerHTML = `<input id="orphan_Mon" />`;
    const orphan = document.getElementById('orphan_Mon') as HTMLInputElement;
    const result = await fillIcimsDate(orphan, '6/2022');
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toBe('element-error');
  });
});
