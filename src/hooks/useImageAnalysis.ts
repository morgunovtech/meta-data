import { useEffect, useState } from 'react';
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

export function useImageAnalysis(imageUrl: string | null) {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const [model, setModel] = useState<any>(null);

  useEffect(() => {
    if (!enabled) {
      setDetections([]);
      setSummary(null);
      return;
    }
    if (!imageUrl) {
      return;
    }
    if (!('OffscreenCanvas' in window) && !window.WebGLRenderingContext) {
      setError(t('contentUnavailable'));
      setEnabled(false);
      return;
    }
    let cancelled = false;
    const detect = async () => {
      setLoading(true);
      setError(null);
      try {
        const cocoModel = model ?? (await loadModel());
        if (!model) {
          setModel(cocoModel);
        }
        const image = new Image();
        image.src = imageUrl;
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('image-load'));
        });
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
        const summary = summarizeDetections(boxes);
        setDetections(boxes);
        setSummary(summary);
      } catch (err) {
        console.error('analysis', err);
        setError(t('contentUnavailable'));
        setEnabled(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    detect();
    return () => {
      cancelled = true;
    };
  }, [enabled, imageUrl, model, t]);

  return {
    enabled,
    setEnabled,
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
  const topLabels: string[] = [];

  detections.forEach((d) => {
    if (d.score < 0.5) return;
    if (d.label === 'person') people += 1;
    if (vehiclesSet.has(d.label)) vehicles += 1;
    if (animalsSet.has(d.label)) animals += 1;
    if (topLabels.length < 5 && !topLabels.includes(d.label)) {
      topLabels.push(d.label);
    }
  });

  const description = topLabels.length > 0 ? topLabels.join(', ') : '';

  return { people, vehicles, animals, description };
}
