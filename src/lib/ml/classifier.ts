/**
 * Unified multi-task model for field classification + option scoring.
 *
 * Uses a fine-tuned DeBERTa-v3 ONNX model with dual outputs:
 *   - classify_logits: [B, num_categories] for field classification
 *   - score_logits: [B, 1] for option/answer scoring
 *
 * Task routing via input prefix tokens: <classify>, <score>, <match>
 */

import { AutoTokenizer, env } from '@huggingface/transformers';
import type { ModelStatus, FieldContext, Classification, AnswerMatch } from './types';

const MODEL_PATH = '/models/unified/';
const ANSWER_MATCH_THRESHOLD = 0.7;
const OPTION_SCORE_THRESHOLD = 0.6;
const MAX_LENGTH = 128;

// Configure Transformers.js for extension environment
env.allowLocalModels = true;
env.useBrowserCache = false;
env.allowRemoteModels = false;
env.backends.onnx.wasm!.wasmPaths = chrome.runtime.getURL('/');
env.backends.onnx.wasm!.numThreads = 1;

type StatusCallback = (status: ModelStatus, progress?: number, error?: string) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tokenizer = any;

interface LabelMap {
  label2id: Record<string, number>;
  id2label: Record<string, string>;
}

/**
 * Build the classification input string.
 * Must match the training-time build_classify_input() in dataset.py.
 */
/** Sanitize text for model input — strip control characters, limit length. */
function sanitize(text: string, maxLen = 200): string {
  // eslint-disable-next-line no-control-regex
  return text.slice(0, maxLen).replace(/[\x00-\x1F\x7F]/g, ' ');
}

/**
 * Strip trailing required-field markers (asterisks) so the ML sees the
 * semantic label regardless of whether the form renders the required cue.
 * Observed on Sony: "Will you need relocation assistance…?" classifies as
 * `relocationAssistance` 79%, but the same string with a trailing `*`
 * flips to `relocate` 75% because the tokenizer bundles `location?*`
 * differently. Training samples don't carry these cosmetic markers.
 */
function stripRequiredMarkers(label: string): string {
  return label.replace(/[\s*✱★]+$/u, '').trim();
}

function buildClassifyInput(field: FieldContext): string {
  const parts: string[] = ['<classify>'];
  if (field.sectionHeading) parts.push(sanitize(field.sectionHeading) + ' :');
  parts.push(sanitize(stripRequiredMarkers(field.label)));
  if (field.placeholder) parts.push(sanitize(field.placeholder, 100));
  if (field.type) parts.push(`[${field.type}]`);
  if (field.ariaLabel && field.ariaLabel !== field.label)
    parts.push(sanitize(stripRequiredMarkers(field.ariaLabel), 100));
  if (field.name) parts.push(sanitize(field.name, 50));
  if (field.options?.length)
    parts.push(
      field.options
        .slice(0, 5)
        .map((o) => sanitize(o, 50))
        .join(' '),
    );
  return parts.join(' ');
}

/**
 * Build the option scoring input string.
 * Must match the training-time build_score_input() in dataset.py.
 */
function buildScoreInput(question: string, profileValue: string, option: string): string {
  return `<score> ${sanitize(question)} [SEP] ${sanitize(profileValue, 100)} [SEP] ${sanitize(option, 100)}`;
}

/**
 * Build the answer bank matching input string.
 * Must match the training-time build_match_input() in dataset.py.
 */
function buildMatchInput(fieldLabel: string, answerQuestion: string): string {
  return `<match> ${sanitize(fieldLabel)} [SEP] ${sanitize(answerQuestion)}`;
}

function softmax(logits: Float32Array | number[]): number[] {
  const max = Math.max(...logits);
  const exps = Array.from(logits).map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export class FieldClassifier {
  private tokenizer: Tokenizer | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ONNX Runtime session type not exported by onnxruntime-web
  private session: any = null;
  private labelMap: LabelMap | null = null;
  private vocabRemap: Map<number, number> | null = null;
  private status: ModelStatus = 'idle';

  async load(onStatus?: StatusCallback): Promise<void> {
    if (this.status === 'ready' || this.status === 'loading') return;

    this.status = 'loading';
    onStatus?.('loading', 0);

    try {
      const modelUrl = chrome.runtime.getURL(MODEL_PATH);

      // Load tokenizer
      onStatus?.('loading', 10);
      this.tokenizer = await AutoTokenizer.from_pretrained(modelUrl);

      // Load label map
      onStatus?.('loading', 20);
      const labelMapUrl = chrome.runtime.getURL(MODEL_PATH + 'label_map.json');
      const labelMapResponse = await fetch(labelMapUrl);
      if (!labelMapResponse.ok)
        throw new Error(`Failed to load label map: ${labelMapResponse.status}`);
      const parsedMap = await labelMapResponse.json();
      if (!parsedMap?.label2id || !parsedMap?.id2label || typeof parsedMap.label2id !== 'object') {
        throw new Error('Invalid label map format');
      }
      this.labelMap = parsedMap as LabelMap;

      // Load vocabulary remap table (maps original token IDs to compact IDs
      // for the trimmed embedding table). If not present, model uses full vocab.
      try {
        const remapUrl = chrome.runtime.getURL(MODEL_PATH + 'vocab_remap.json');
        const remapResponse = await fetch(remapUrl);
        const remapData = await remapResponse.json();
        if (remapData?.old_to_new) {
          this.vocabRemap = new Map<number, number>();
          for (const [oldId, newId] of Object.entries(remapData.old_to_new)) {
            this.vocabRemap.set(Number(oldId), newId as number);
          }
        }
      } catch {
        this.vocabRemap = null;
      }

      // Load ONNX session directly for dual-output model
      onStatus?.('loading', 30);
      const ort = await import('onnxruntime-web');
      const onnxUrl = chrome.runtime.getURL(MODEL_PATH + 'onnx/model_quantized.onnx');

      const modelResponse = await fetch(onnxUrl);
      if (!modelResponse.ok) throw new Error(`Failed to load ONNX model: ${modelResponse.status}`);
      const modelBuffer = await modelResponse.arrayBuffer();
      onStatus?.('loading', 70);

      this.session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['wasm'],
      });

      onStatus?.('loading', 100);
      this.status = 'ready';
      onStatus?.('ready');
    } catch (err) {
      this.status = 'error';
      const message = err instanceof Error ? err.message : 'Unknown error';
      onStatus?.('error', undefined, message);
      throw err;
    }
  }

  /**
   * Run inference on a batch of input strings.
   * Returns raw outputs: [classify_logits, score_logits]
   */
  private async run(
    texts: string[],
  ): Promise<{ classifyLogits: Float32Array; scoreLogits: Float32Array; batchSize: number }> {
    if (!this.session || !this.tokenizer) {
      throw new Error('Model not loaded');
    }

    const encoded = this.tokenizer(texts, {
      padding: true,
      truncation: true,
      max_length: MAX_LENGTH,
    });

    // Transformers.js Tensor objects are compatible with onnxruntime-web sessions
    // but we need to ensure int64 type for the input tensors
    const inputIdsData = encoded.input_ids.data;
    const attMaskData = encoded.attention_mask.data;
    const dims = encoded.input_ids.dims;

    // Convert to BigInt64Array for ONNX int64 inputs.
    // If vocab is trimmed, remap original token IDs to compact IDs.
    const inputIdsBig = new BigInt64Array(inputIdsData.length);
    const attMaskBig = new BigInt64Array(attMaskData.length);
    for (let i = 0; i < inputIdsData.length; i++) {
      const origId = Number(inputIdsData[i]);
      const mappedId = this.vocabRemap ? (this.vocabRemap.get(origId) ?? 0) : origId;
      inputIdsBig[i] = BigInt(mappedId);
      attMaskBig[i] = BigInt(Number(attMaskData[i]));
    }

    // Use the ORT Tensor class from the session's runtime
    const ort = await import('onnxruntime-web');
    const inputIds = new ort.Tensor('int64', inputIdsBig, dims);
    const attentionMask = new ort.Tensor('int64', attMaskBig, dims);

    const results = await this.session.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
    });

    return {
      classifyLogits: new Float32Array(results.classify_logits.data),
      scoreLogits: new Float32Array(results.score_logits.data),
      batchSize: texts.length,
    };
  }

  async classify(fields: FieldContext[]): Promise<Classification[]> {
    if (!this.session || this.status !== 'ready') {
      this.status = 'idle';
      try {
        await this.load((status, progress, error) => {
          chrome.runtime
            .sendMessage({ type: 'ML_STATUS', status, progress, error })
            .catch(() => {});
        });
      } catch {
        return fields.map((f) => ({ label: f.label, category: '', confidence: 0 }));
      }
    }

    const inputs = fields.map(buildClassifyInput);
    const numCategories = Object.keys(this.labelMap!.label2id).length;

    try {
      const { classifyLogits } = await this.run(inputs);

      return fields.map((field, i) => {
        const start = i * numCategories;
        const logits = classifyLogits.slice(start, start + numCategories);
        const probs = softmax(logits);
        const maxIdx = probs.indexOf(Math.max(...probs));
        return {
          label: field.label,
          category: this.labelMap!.id2label[String(maxIdx)] ?? '',
          confidence: probs[maxIdx] ?? 0,
        };
      });
    } catch {
      return fields.map((f) => ({ label: f.label, category: '', confidence: 0 }));
    }
  }

  /**
   * Score each option for a field given the profile value.
   * Returns the best matching option index and score.
   */
  async scoreOptions(
    question: string,
    profileValue: string,
    options: string[],
  ): Promise<{ bestIndex: number; score: number }> {
    if (!this.session || this.status !== 'ready') {
      return { bestIndex: -1, score: 0 };
    }
    if (options.length === 0) return { bestIndex: -1, score: 0 };

    try {
      const inputs = options.map((opt) => buildScoreInput(question, profileValue, opt));
      const { scoreLogits } = await this.run(inputs);

      let bestIdx = -1;
      let bestScore = -Infinity;

      for (let i = 0; i < options.length; i++) {
        const score = sigmoid(scoreLogits[i]!);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestScore >= OPTION_SCORE_THRESHOLD && bestIdx >= 0) {
        return { bestIndex: bestIdx, score: bestScore };
      }

      return { bestIndex: -1, score: bestScore };
    } catch {
      return { bestIndex: -1, score: 0 };
    }
  }

  /**
   * Match field labels against answer bank questions using the scoring head.
   */
  async matchAnswers(fieldLabels: string[], questions: string[]): Promise<AnswerMatch[]> {
    if (fieldLabels.length === 0 || questions.length === 0) return [];
    if (!this.session || this.status !== 'ready') return [];

    try {
      const matches: AnswerMatch[] = [];

      for (let fi = 0; fi < fieldLabels.length; fi++) {
        const inputs = questions.map((q) => buildMatchInput(fieldLabels[fi]!, q));
        const { scoreLogits } = await this.run(inputs);

        let bestIdx = -1;
        let bestScore = -Infinity;

        for (let qi = 0; qi < questions.length; qi++) {
          const score = sigmoid(scoreLogits[qi]!);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = qi;
          }
        }

        if (bestScore >= ANSWER_MATCH_THRESHOLD && bestIdx >= 0) {
          matches.push({
            fieldLabel: fieldLabels[fi]!,
            questionIndex: bestIdx,
            similarity: bestScore,
          });
        }
      }

      return matches;
    } catch {
      return [];
    }
  }

  async unload(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.tokenizer = null;
    this.labelMap = null;
    this.status = 'idle';
  }

  getStatus(): ModelStatus {
    return this.status;
  }
}
