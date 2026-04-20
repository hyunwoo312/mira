/**
 * Tests for the ML classification tier in the autofill pipeline.
 *
 * The actual ONNX model can't run in vitest (needs WASM + chrome extension context),
 * so we test:
 *   1. The ML messaging layer (classify/ml.ts)
 *   2. Three-tier classification flow with realistic ML mock responses
 *   3. Label map consistency with the pipeline
 *   4. Confidence thresholds and edge cases
 */

import { classifyWithML } from '../classify/ml';
import { classifyFields } from '../classify/index';
import type { ScanResult, WidgetType } from '../types';
import labelMap from '../../../../public/models/unified/label_map.json';

// ── Chrome mock ──

beforeEach(() => {
  Element.prototype.scrollIntoView = function () {};
  globalThis.chrome = {
    ...globalThis.chrome,
    runtime: {
      ...globalThis.chrome?.runtime,
      sendMessage: vi.fn(),
    },
  } as unknown as typeof chrome;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ──

function makeScanResult(
  label: string,
  widgetType: WidgetType = 'plain-text',
  opts?: Partial<ScanResult>,
): ScanResult {
  const el = document.createElement('input');
  document.body.appendChild(el);
  return {
    label,
    widgetType,
    ats: 'generic',
    element: el,
    category: null,
    ...opts,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ── Label Map Tests ──

describe('label map consistency', () => {
  it('should have matching label2id and id2label entries', () => {
    const l2i = labelMap.label2id as Record<string, number>;
    const i2l = labelMap.id2label as Record<string, string>;

    for (const [label, id] of Object.entries(l2i)) {
      expect(i2l[String(id)]).toBe(label);
    }
    for (const [id, label] of Object.entries(i2l)) {
      expect(l2i[label]).toBe(Number(id));
    }
  });

  it('should contain all expected core categories', () => {
    const required = [
      'firstName',
      'lastName',
      'fullName',
      'email',
      'phone',
      'resume',
      'coverLetter',
      'linkedin',
      'github',
      'location',
      'city',
      'state',
      'country',
      'zipCode',
      'workAuth',
      'sponsorship',
      'relocate',
      'startDate',
      'gender',
      'race',
      'veteranStatus',
      'disabilityStatus',
      'consent',
      'degree',
      'school',
      'company',
    ];
    for (const cat of required) {
      expect(labelMap.label2id).toHaveProperty(cat);
    }
  });

  it('should have contiguous IDs starting from 0', () => {
    const ids = Object.values(labelMap.label2id).sort((a, b) => a - b);
    for (let i = 0; i < ids.length; i++) {
      expect(ids[i]).toBe(i);
    }
  });

  it('should have exactly 58 categories', () => {
    expect(Object.keys(labelMap.label2id)).toHaveLength(58);
  });

  it('should include the relocationAssistance category (v0.2.2 retrain)', () => {
    expect(labelMap.label2id).toHaveProperty('relocationAssistance');
  });
});

// ── ML Messaging Layer Tests ──

describe('classifyWithML', () => {
  it('should send ML_CLASSIFY message with correct field contexts', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({
      classifications: [{ label: 'Work Authorization', category: 'workAuth', confidence: 0.95 }],
    });
    globalThis.chrome.runtime.sendMessage = mockSendMessage;

    const fields: ScanResult[] = [makeScanResult('Work Authorization')];
    await classifyWithML(fields);

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ML_CLASSIFY',
        fields: expect.arrayContaining([expect.objectContaining({ label: 'Work Authorization' })]),
      }),
    );
  });

  it('should return empty map when ML returns an error', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      error: 'Model not loaded',
    });

    const fields: ScanResult[] = [makeScanResult('Gender')];
    const result = await classifyWithML(fields);

    expect(result.available).toBe(false);
    expect(result.map.size).toBe(0);
  });

  it('should return empty map when sendMessage throws', async () => {
    globalThis.chrome.runtime.sendMessage = vi
      .fn()
      .mockRejectedValue(new Error('Extension context invalidated'));

    const fields: ScanResult[] = [makeScanResult('Gender')];
    const result = await classifyWithML(fields);

    expect(result.available).toBe(false);
    expect(result.map.size).toBe(0);
  });

  it('should filter out low-confidence results', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [{ label: 'Something', category: 'customQuestion', confidence: 0.2 }],
    });

    const fields: ScanResult[] = [makeScanResult('Something')];
    const result = await classifyWithML(fields);

    // customQuestion is not in LOW_THRESHOLD_CATEGORIES, threshold is 0.5
    expect(result.map.size).toBe(0);
  });

  it('should accept lower confidence for known easy categories', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [{ label: 'Your email', category: 'email', confidence: 0.35 }],
    });

    const fields: ScanResult[] = [makeScanResult('Your email')];
    const result = await classifyWithML(fields);

    // email is in LOW_THRESHOLD_CATEGORIES, threshold is 0.3
    expect(result.map.size).toBe(1);
    expect(result.map.get(0)?.category).toBe('email');
  });

  it('should handle empty field array', async () => {
    const result = await classifyWithML([]);
    expect(result.available).toBe(true);
    expect(result.map.size).toBe(0);
  });
});

// ── Three-Tier Classification Flow ──

describe('classifyFields (three-tier flow)', () => {
  it('should skip fields already classified by static-map', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [],
    });

    const fields: ScanResult[] = [
      makeScanResult('First Name', 'plain-text', {
        category: 'firstName',
        classifiedBy: 'static-map',
      }),
    ];

    await classifyFields(fields);

    // Should not have been sent to ML
    expect(fields[0]!.category).toBe('firstName');
    expect(fields[0]!.classifiedBy).toBe('static-map');
  });

  it('should classify by options (Tier 1) before heuristics', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [],
    });

    const fields: ScanResult[] = [
      makeScanResult('Please select', 'native-select', {
        groupLabels: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
      }),
    ];

    await classifyFields(fields);

    expect(fields[0]!.category).toBe('gender');
    expect(fields[0]!.classifiedBy).toBe('options');
  });

  it('should classify by heuristic patterns (Tier 2)', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [],
    });

    const fields: ScanResult[] = [makeScanResult('Email Address')];
    await classifyFields(fields);

    expect(fields[0]!.category).toBe('email');
    expect(fields[0]!.classifiedBy).toBe('heuristic');
  });

  it('should fall through to ML (Tier 3) for unmatched fields', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [
        { label: 'Are you authorized to work?', category: 'workAuth', confidence: 0.92 },
      ],
    });

    const fields: ScanResult[] = [makeScanResult('Are you authorized to work?')];
    const mlAvailable = await classifyFields(fields);

    expect(mlAvailable).toBe(true);
    expect(fields[0]!.category).toBe('workAuth');
    expect(fields[0]!.classifiedBy).toBe('ml');
    expect(fields[0]!.mlConfidence).toBe(0.92);
  });

  it('should reject ML classification on textareas for non-allowed categories', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [
        { label: 'Tell us about yourself', category: 'firstName', confidence: 0.6 },
      ],
    });

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const fields: ScanResult[] = [
      {
        label: 'Tell us about yourself',
        widgetType: 'plain-text',
        ats: 'generic',
        element: textarea,
        category: null,
      },
    ];

    await classifyFields(fields);

    // firstName is not allowed on textareas — should be rejected
    expect(fields[0]!.category).toBeNull();
  });

  it('should classify long checkbox labels as consent', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [],
    });

    const longLabel =
      'I certify that the information provided in this application is true and complete to the best of my knowledge and belief.';
    const fields: ScanResult[] = [makeScanResult(longLabel, 'checkbox')];

    await classifyFields(fields);

    expect(fields[0]!.category).toBe('consent');
    expect(fields[0]!.classifiedBy).toBe('heuristic');
  });

  it('should handle batch classification of multiple fields', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [
        { label: 'Do you need sponsorship?', category: 'sponsorship', confidence: 0.88 },
        { label: 'Willing to relocate?', category: 'relocate', confidence: 0.85 },
      ],
    });

    const fields: ScanResult[] = [
      makeScanResult('First Name'), // Tier 2 heuristic
      makeScanResult('Do you need sponsorship?'), // Tier 3 ML
      makeScanResult('Willing to relocate?'), // Tier 3 ML
    ];

    await classifyFields(fields);

    expect(fields[0]!.category).toBe('firstName');
    expect(fields[0]!.classifiedBy).toBe('heuristic');
    expect(fields[1]!.category).toBe('sponsorship');
    expect(fields[1]!.classifiedBy).toBe('ml');
    expect(fields[2]!.category).toBe('relocate');
    expect(fields[2]!.classifiedBy).toBe('ml');
  });

  it('should override ML race prediction when options are Yes/No', async () => {
    globalThis.chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      classifications: [{ label: 'Are you Hispanic?', category: 'race', confidence: 0.7 }],
    });

    const fields: ScanResult[] = [
      makeScanResult('Are you Hispanic?', 'radio-group', {
        groupLabels: ['Yes', 'No', 'Decline to answer'],
      }),
    ];

    await classifyFields(fields);

    // ML said "race" but options are yes/no — should override to heuristic
    expect(fields[0]!.category).toBe('isHispanic');
    expect(fields[0]!.classifiedBy).toBe('heuristic');
  });
});
