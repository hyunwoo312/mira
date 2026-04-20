import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findBestOptionIndex, isYesNoOnlyOptionSet } from '../../fillers/shared';

vi.mock('../../classify/ml', () => ({
  scoreOptionsWithML: vi.fn(),
}));

import { scoreOptionsWithML } from '../../classify/ml';

describe('isYesNoOnlyOptionSet', () => {
  it.each([
    ['Yes/No', ['Yes', 'No'], true],
    ['Yes/No/Decline', ['Yes', 'No', 'Decline to answer'], true],
    ['Yes/No/Prefer-not', ['Yes', 'No', 'Prefer not to say'], true],
    ['N/A included', ['Yes', 'No', 'N/A'], true],
    ['whitespace-tolerant', ['  Yes  ', 'No'], true],
  ])('returns true for %s', (_, options, expected) => {
    expect(isYesNoOnlyOptionSet(options)).toBe(expected);
  });

  it.each([
    ['empty list', []],
    ['too many options', ['Yes', 'No', 'Maybe', 'Sometimes', 'Never']],
    ['real values mixed in', ['Yes', 'No', 'United States']],
    ['non-yes-no content', ['Male', 'Female', 'Other']],
  ])('returns false for %s', (_, options) => {
    expect(isYesNoOnlyOptionSet(options)).toBe(false);
  });
});

describe('findBestOptionIndex', () => {
  const mockedMl = vi.mocked(scoreOptionsWithML);

  beforeEach(() => {
    mockedMl.mockReset();
    // Default: ML unavailable (returns -1) so we can isolate non-ML paths.
    mockedMl.mockResolvedValue({ bestIndex: -1, score: 0 });
  });

  it('finds a direct exact match', async () => {
    const idx = await findBestOptionIndex(['Cat', 'Dog', 'Bird'], 'Dog');
    expect(idx).toBe(1);
  });

  it("finds via alias when category is provided (Bachelor's → BS)", async () => {
    const options = ['Associates', 'BA', 'BS', 'MA', 'PhD'];
    const idx = await findBestOptionIndex(options, "Bachelor's", 'degree');
    expect(idx).toBe(2);
  });

  it('picks single option for affirmative-shaped consent fills', async () => {
    // Long legal text boiled down to single "I agree" — profile value is "Yes"
    const options = ['I agree to the terms'];
    const idx = await findBestOptionIndex(options, 'Yes');
    expect(idx).toBe(0);
  });

  it('picks single option for "acknowledge" values', async () => {
    const idx = await findBestOptionIndex(['I Acknowledge'], 'acknowledge');
    expect(idx).toBe(0);
  });

  it('does NOT pick a single option when value is freeform', async () => {
    const idx = await findBestOptionIndex(['Tuesday'], 'Hyunwoo');
    expect(idx).toBe(-1);
  });

  it('falls through concept-match for Yes-shaped values (matches "I agree" affirmative)', async () => {
    const idx = await findBestOptionIndex(['I agree to the terms', 'I decline the terms'], 'Yes');
    expect(idx).toBe(0);
  });

  it('skips concept-match for NO_CONCEPT_MATCH categories (e.g. country)', async () => {
    // Value "United States" against a clearly-wrong option set; concept would
    // otherwise pick something, but country is in NO_CONCEPT_MATCH.
    const idx = await findBestOptionIndex(['Foo', 'Bar'], 'United States', 'country', 'Country');
    expect(idx).toBe(-1);
    expect(mockedMl).toHaveBeenCalled();
  });

  it('invokes ML scorer when heuristics fail and fieldLabel is present', async () => {
    mockedMl.mockResolvedValue({ bestIndex: 1, score: 0.9 });
    const idx = await findBestOptionIndex(
      ['Alpha', 'Beta', 'Gamma'],
      'some-value',
      'customQuestion',
      'Some field',
    );
    expect(idx).toBe(1);
    expect(mockedMl).toHaveBeenCalledWith('Some field', 'some-value', ['Alpha', 'Beta', 'Gamma']);
  });

  it('does NOT invoke ML when fieldLabel is missing', async () => {
    await findBestOptionIndex(['Alpha', 'Beta'], 'gamma');
    expect(mockedMl).not.toHaveBeenCalled();
  });

  it('does NOT invoke ML when options list is too long (>20)', async () => {
    const options = Array.from({ length: 50 }, (_, i) => `Option ${i}`);
    await findBestOptionIndex(options, 'not-in-list', 'customQuestion', 'Q');
    expect(mockedMl).not.toHaveBeenCalled();
  });

  it('returns -1 cleanly when ML rejects', async () => {
    mockedMl.mockRejectedValue(new Error('ml unavailable'));
    const idx = await findBestOptionIndex(['Alpha', 'Beta'], 'gamma', 'customQuestion', 'Q');
    expect(idx).toBe(-1);
  });

  it('exact match beats alias match', async () => {
    // Value "BS" matches directly to the "BS" option (index 2), not to any
    // alias-based alternative.
    const idx = await findBestOptionIndex(
      ['Bachelor of Arts', 'Bachelor of Science', 'BS', 'MS'],
      'BS',
      'degree',
    );
    expect(idx).toBe(2);
  });
});
