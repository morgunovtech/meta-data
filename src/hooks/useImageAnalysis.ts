import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { BoundingBox, DetectionSummary } from '../types/detection';

async function loadModel() {
  const [{ load }, tf] = await Promise.all([
    import('@tensorflow-models/coco-ssd'),
    import('@tensorflow/tfjs')
  ]);
  if (typeof window !== 'undefined') {
    await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
    await tf.ready();
  }
  return load({ base: 'lite_mobilenet_v2' });
}

function supportsAnalysis(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.OffscreenCanvas || window.WebGLRenderingContext);
}

export function useImageAnalysis(imageUrl: string | null) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const modelRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const analyze = async () => {
      if (!imageUrl) {
        setDetections([]);
        setSummary(null);
        setError(null);
        setLoading(false);
        return;
      }
      if (!supportsAnalysis()) {
        setError(t('contentUnavailable'));
        setDetections([]);
        setSummary(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setSummary(null);
      try {
        const cocoModel = modelRef.current ?? (await loadModel());
        if (!modelRef.current) {
          modelRef.current = cocoModel;
        }
        const image = new Image();
        image.src = imageUrl;
        if (image.decode) {
          await image.decode();
        } else {
          await new Promise((resolve, reject) => {
            image.onload = () => resolve(undefined);
            image.onerror = () => reject(new Error('image-load'));
          });
        }
        if (cancelled) return;
        const predictions = await cocoModel.detect(image, undefined, 0.2);
        if (cancelled) return;
        const boxes: BoundingBox[] = predictions.map((pred: any) => ({
          x: pred.bbox[0],
          y: pred.bbox[1],
          width: pred.bbox[2],
          height: pred.bbox[3],
          score: pred.score,
          label: pred.class
        }));
        setDetections(boxes);
        setSummary(summarizeDetections(boxes));
      } catch (err) {
        console.error('analysis', err);
        if (!cancelled) {
          setError(t('contentUnavailable'));
          setDetections([]);
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    analyze();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, t]);

  return {
    loading,
    error,
    detections,
    summary
  };
}

function summarizeDetections(detections: BoundingBox[]): DetectionSummary {
  const vehiclesSet = new Set(['car', 'bus', 'truck', 'train', 'bicycle', 'motorcycle']);
  const animalsSet = new Set(['dog', 'cat', 'bird', 'horse', 'sheep', 'cow']);
  let people = 0;
  let vehicles = 0;
  let animals = 0;
  const aggregate = new Map<string, { count: number; confidence: number }>();

  detections.forEach((d) => {
    const strong = d.score >= 0.5;
    if (strong) {
      if (d.label === 'person') people += 1;
      if (vehiclesSet.has(d.label)) vehicles += 1;
      if (animalsSet.has(d.label)) animals += 1;
    }
    if (d.score < 0.45) return;
    const entry = aggregate.get(d.label) ?? { count: 0, confidence: 0 };
    entry.count += 1;
    entry.confidence = Math.max(entry.confidence, d.score);
    aggregate.set(d.label, entry);
  });

  const top = Array.from(aggregate.entries())
    .sort((a, b) => b[1].confidence - a[1].confidence)
    .slice(0, 5)
    .map(([label, value]) => ({ label, count: value.count, confidence: value.confidence }));

  const description = top.length > 0 ? top.map((item) => `${item.label} ×${item.count}`).join(', ') : '';

  return { people, vehicles, animals, description, top };
}
