import { useCallback, useMemo, useState } from 'react';
import type { DetectionSummary } from '../types/detection';

const MIN_WORKER_CORES = 2;

function isSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.HTMLCanvasElement) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < MIN_WORKER_CORES) {
    return false;
  }
  return true;
}

let modelPromise: Promise<any> | null = null;

async function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureModel() {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.16.0/dist/tf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js');
    if (!window.cocoSsd) {
      throw new Error('coco-ssd unavailable');
    }
    return window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
  })();
  return modelPromise;
}

export function useImageAnalysis() {
  const [summary, setSummary] = useState<DetectionSummary | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [showBoxes, setShowBoxes] = useState(false);
  const supported = useMemo(isSupported, []);

  const analyze = useCallback(
    async (imageElement: HTMLImageElement) => {
      if (!supported) {
        setError('unsupported');
        return;
      }
      setLoading(true);
      setError(undefined);

      try {
        const model = await ensureModel();
        const predictions = await model.detect(imageElement, 20);
        const boxes = predictions.map((prediction: any) => ({
          x: prediction.bbox[0],
          y: prediction.bbox[1],
          width: prediction.bbox[2],
          height: prediction.bbox[3],
          score: prediction.score,
          className: prediction.class
        }));
        const counts: Record<string, number> = {};
        boxes.forEach((box) => {
          counts[box.className] = (counts[box.className] ?? 0) + 1;
        });
        const caption = boxes
          .filter((box) => box.score > 0.5)
          .map((box) => `${box.className} (${Math.round(box.score * 100)}%)`)
          .join(', ');
        setSummary({ boxes, counts, caption });
      } catch (err) {
        console.error('analysis-failed', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [supported]
  );

  const reset = useCallback(() => {
    setSummary(undefined);
    setError(undefined);
    setShowBoxes(false);
  }, []);

  return { summary, loading, error, analyze, supported, showBoxes, setShowBoxes, reset } as const;
}
