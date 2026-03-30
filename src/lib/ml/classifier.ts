/**
 * Fine-tuned field classifier using sequence classification.
 * Loads a fine-tuned MiniLM ONNX model via Transformers.js,
 * classifies field labels into one of 53 categories with
 * softmax confidence scores.
 */

import { pipeline, env } from '@huggingface/transformers';
import type { ModelStatus, FieldContext, Classification, AnswerMatch } from './types';

// Local fine-tuned model for classification
const MODEL_PATH = '/models/field-classifier/';
// Pre-trained MiniLM for embedding similarity (answer bank matching)
const EMBEDDING_MODEL_PATH = '/models/embeddings/';
const ANSWER_MATCH_THRESHOLD = 0.75;

// Configure Transformers.js for extension environment
env.allowLocalModels = true;
env.useBrowserCache = false;
env.allowRemoteModels = false;

// Point ONNX runtime to local WASM files (CDN blocked by extension CSP)
env.backends.onnx.wasm!.wasmPaths = chrome.runtime.getURL('/');

type StatusCallback = (status: ModelStatus, progress?: number, error?: string) => void;

interface ClassifierOutput {
  label: string;
  score: number;
}

type TextClassifier = {
  (texts: string | string[]): Promise<ClassifierOutput[] | ClassifierOutput[][]>;
  dispose: () => Promise<void>;
};
type EmbeddingOutput = { data: Float32Array }[];
type Embedder = {
  (texts: string[], options: Record<string, unknown>): Promise<EmbeddingOutput>;
  dispose: () => Promise<void>;
};

/**
 * Build the input string for the classifier.
 * Must match the training-time build_input() in train.py.
 */
function buildInput(field: FieldContext): string {
  const parts: string[] = [];
  if (field.sectionHeading) parts.push(field.sectionHeading + ' :');
  parts.push(field.label);
  if (field.placeholder) parts.push(field.placeholder);
  if (field.type) parts.push(`[${field.type}]`);
  if (field.ariaLabel && field.ariaLabel !== field.label) parts.push(field.ariaLabel);
  if (field.name) parts.push(field.name);
  if (field.options?.length) parts.push(field.options.slice(0, 5).join(' '));
  return parts.join(' ');
}

export class FieldClassifier {
  private classifier: TextClassifier | null = null;
  private embedder: Embedder | null = null;
  private status: ModelStatus = 'idle';

  async load(onStatus?: StatusCallback): Promise<void> {
    if (this.status === 'ready' || this.status === 'loading') return;

    this.status = 'loading';
    onStatus?.('loading', 0);

    try {
      // Try WebGPU first, fall back to WASM
      let device: 'webgpu' | 'wasm' = 'wasm';
      try {
        if ('gpu' in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gpu = (navigator as any).gpu;
          const adapter = await gpu.requestAdapter();
          if (adapter) device = 'webgpu';
        }
      } catch {
        // WebGPU not available, use WASM
      }

      const modelUrl = chrome.runtime.getURL(MODEL_PATH);

      this.classifier = (await pipeline('text-classification', modelUrl, {
        local_files_only: true,
        dtype: 'fp16',
        device,
        progress_callback: (progress: { progress?: number; status?: string }) => {
          if (progress.progress != null) {
            onStatus?.('loading', Math.round(progress.progress));
          }
        },
      })) as unknown as TextClassifier;

      this.status = 'ready';
      onStatus?.('ready');
    } catch (err) {
      this.status = 'error';
      const message = err instanceof Error ? err.message : 'Unknown error';
      onStatus?.('error', undefined, message);
      throw err;
    }
  }

  async classify(fields: FieldContext[]): Promise<Classification[]> {
    // Auto-load if not ready
    if (!this.classifier || this.status !== 'ready') {
      this.status = 'idle'; // Reset to allow reload
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
    if (!this.classifier) {
      return fields.map((f) => ({ label: f.label, category: '__no_classifier__', confidence: 0 }));
    }

    const inputs = fields.map(buildInput);

    try {
      const outputs = (await this.classifier(inputs)) as ClassifierOutput[] | ClassifierOutput[][];

      return fields.map((field, i) => {
        const output = outputs[i];
        const top = Array.isArray(output) ? output[0] : output;
        return {
          label: field.label,
          category: top?.label ?? '',
          confidence: top?.score ?? 0,
        };
      });
    } catch {
      return fields.map((f) => ({ label: f.label, category: '', confidence: 0 }));
    }
  }

  /**
   * Match field labels against answer bank questions using embedding similarity.
   * Returns matches above the threshold.
   */
  /** Lazy-load the embedding model on first answer bank use */
  private async ensureEmbedder(): Promise<boolean> {
    if (this.embedder) return true;
    try {
      let device: 'webgpu' | 'wasm' = 'wasm';
      try {
        if ('gpu' in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gpu = (navigator as any).gpu;
          const adapter = await gpu.requestAdapter();
          if (adapter) device = 'webgpu';
        }
      } catch {
        /* WASM fallback */
      }

      const embeddingModelUrl = chrome.runtime.getURL(EMBEDDING_MODEL_PATH);
      this.embedder = (await pipeline('feature-extraction', embeddingModelUrl, {
        device,
        dtype: 'q8' as const,
      })) as unknown as Embedder;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Semantic option matching: find the best-matching option for a value
   * using embedding cosine similarity. Used as Tier 3 fallback when
   * fuzzy/alias/concept matching all fail for select/radio fields.
   */
  async matchOption(
    value: string,
    options: string[],
  ): Promise<{ bestIndex: number; similarity: number }> {
    if (options.length === 0) return { bestIndex: -1, similarity: 0 };
    if (!(await this.ensureEmbedder())) return { bestIndex: -1, similarity: 0 };

    const OPTION_MATCH_THRESHOLD = 0.7;

    try {
      const valueOutput = await this.embedder!([value], { pooling: 'mean', normalize: true });
      const optionOutputs = await this.embedder!(options, { pooling: 'mean', normalize: true });

      const valueEmb: Float32Array = valueOutput[0]?.data
        ? new Float32Array(valueOutput[0].data)
        : new Float32Array(0);

      let bestIdx = -1;
      let bestSim = -1;

      for (let i = 0; i < options.length; i++) {
        const optOut = optionOutputs[i];
        const optEmb: Float32Array = optOut?.data
          ? new Float32Array(optOut.data)
          : new Float32Array(0);

        let dot = 0;
        for (let j = 0; j < valueEmb.length; j++) {
          dot += valueEmb[j]! * optEmb[j]!;
        }

        if (dot > bestSim) {
          bestSim = dot;
          bestIdx = i;
        }
      }

      if (bestSim >= OPTION_MATCH_THRESHOLD && bestIdx >= 0) {
        return { bestIndex: bestIdx, similarity: bestSim };
      }

      return { bestIndex: -1, similarity: bestSim };
    } catch {
      return { bestIndex: -1, similarity: 0 };
    }
  }

  async matchAnswers(fieldLabels: string[], questions: string[]): Promise<AnswerMatch[]> {
    if (fieldLabels.length === 0 || questions.length === 0) return [];
    if (!(await this.ensureEmbedder())) return [];

    try {
      const fieldOutputs = await this.embedder!(fieldLabels, { pooling: 'mean', normalize: true });
      const questionOutputs = await this.embedder!(questions, { pooling: 'mean', normalize: true });

      const matches: AnswerMatch[] = [];

      for (let fi = 0; fi < fieldLabels.length; fi++) {
        const fieldOut = fieldOutputs[fi];
        const fieldEmb: Float32Array = fieldOut?.data
          ? new Float32Array(fieldOut.data)
          : new Float32Array(0);

        let bestIdx = -1;
        let bestSim = -1;

        for (let qi = 0; qi < questions.length; qi++) {
          const qOut = questionOutputs[qi];
          const qEmb: Float32Array = qOut?.data ? new Float32Array(qOut.data) : new Float32Array(0);

          let dot = 0;
          for (let i = 0; i < fieldEmb.length; i++) {
            dot += fieldEmb[i]! * qEmb[i]!;
          }

          if (dot > bestSim) {
            bestSim = dot;
            bestIdx = qi;
          }
        }

        if (bestSim >= ANSWER_MATCH_THRESHOLD && bestIdx >= 0) {
          matches.push({
            fieldLabel: fieldLabels[fi]!,
            questionIndex: bestIdx,
            similarity: bestSim,
          });
        }
      }

      return matches;
    } catch {
      return [];
    }
  }

  async unload(): Promise<void> {
    if (this.classifier) {
      await this.classifier.dispose();
      this.classifier = null;
    }
    if (this.embedder) {
      await this.embedder.dispose();
      this.embedder = null;
    }
    this.status = 'idle';
  }

  getStatus(): ModelStatus {
    return this.status;
  }
}
