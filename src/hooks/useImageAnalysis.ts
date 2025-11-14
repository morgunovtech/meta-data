import { useCallback, useEffect, useRef, useState } from 'react';
import type { DetectionSummary, BoundingBox } from '../types/detection';

interface Options {
  enabled: boolean;
  image?: HTMLImageElement | null;
}

const MIN_SCORE = 0.45;

export const useImageAnalysis = ({ enabled, image }: Options) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const modelRef = useRef<any>(null);

  const loadModel = useCallback(async () => {
    if (!enabled || modelRef.current) {
      return modelRef.current;
    }
    try {
      setLoading(true);
      const [cocoModule, tfModule] = await Promise.all([
        import('https://esm.sh/@tensorflow-models/coco-ssd@2.2.2'),
        import('https://esm.sh/@tensorflow/tfjs@4.16.0')
      ]);
      const tf: any = tfModule;
      if (tf && typeof tf.getBackend === 'function' && !tf.getBackend()) {
        await tf.setBackend('webgl').catch(async () => tf.setBackend('cpu'));
      }
      const load = (cocoModule as any).load ?? (cocoModule as any).default?.load;
      if (!load) {
        throw new Error('model_unavailable');
      }
      const model = await load({ base: 'lite_mobilenet_v2' });
      modelRef.current = model;
      return model;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'model_error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const analyze = useCallback(async () => {
    if (!enabled || !image) return;
    const model = await loadModel();
    if (!model) return;
    setLoading(true);
    setError(null);
    try {
      const predictions = await model.detect(image, 10);
      const boxes: BoundingBox[] = predictions
        .filter((item: any) => item.score >= MIN_SCORE)
        .map((item: any) => ({
          x: item.bbox[0],
          y: item.bbox[1],
          width: item.bbox[2],
          height: item.bbox[3],
          label: item.class,
          score: item.score
        }));
      const counts: Record<string, number> = {};
      boxes.forEach((box) => {
        counts[box.label] = (counts[box.label] ?? 0) + 1;
      });
      const caption = boxes
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((box) => `${box.label} (${Math.round(box.score * 100)}%)`)
        .join(', ');
      setSummary({ caption, counts, boxes });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'analysis_error');
    } finally {
      setLoading(false);
    }
  }, [enabled, image, loadModel]);

  useEffect(() => {
    if (!enabled) {
      setSummary(null);
      setError(null);
      setLoading(false);
    }
  }, [enabled]);

  return { loading, error, summary, analyze };
};
