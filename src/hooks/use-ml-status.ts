import { useState, useEffect } from 'react';
import type { ModelStatus } from '@/lib/ml/types';

/**
 * Connects to the service worker via a persistent port.
 * This connection triggers offscreen document creation (model loading)
 * and its disconnection triggers cleanup.
 *
 * Also receives ML model status updates.
 */
export function useMLStatus() {
  const [status, setStatus] = useState<ModelStatus>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'sidepanel' });

    port.onMessage.addListener(
      (message: { type: string; status?: ModelStatus; progress?: number }) => {
        if (message.type === 'ML_STATUS') {
          if (message.status) setStatus(message.status);
          if (message.progress != null) setProgress(message.progress);
        }
      },
    );

    return () => port.disconnect();
  }, []);

  return { mlStatus: status, mlProgress: progress };
}
