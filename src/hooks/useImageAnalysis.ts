import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { BoundingBox, DetectionSummary } from '../types/detection';

let sharedModel: any | null = null;
let modelLoading: Promise<any> | null = null;

async function ensureModel() {
  if (sharedModel) {
    return sharedModel;
  }
  if (!modelLoading) {
    modelLoading = (async () => {
      const [{ load }, tf] = await Promise.all([
        import('@tensorflow-models/coco-ssd'),
        import('@tensorflow/tfjs')
      ]);
      if (typeof window !== 'undefined') {
        try {
          await tf.setBackend('webgl');
        } catch (error) {
          await tf.setBackend('cpu');
        }
        await tf.ready();
      }
      sharedModel = await load({ base: 'lite_mobilenet_v2' });
      return sharedModel;
    })();
  }
  return modelLoading;
}

function hasAnalysisSupport() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.OffscreenCanvas || window.WebGLRenderingContext);
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = url;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('image-load'));
  });
  return image;
}

export function useImageAnalysis(imageUrl: string | null) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!imageUrl) {
      setDetections([]);
      setSummary(null);
      setError(null);
      lastUrlRef.current = null;
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!hasAnalysisSupport()) {
      setError(t('contentUnavailable'));
      setDetections([]);
      setSummary(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const detect = async () => {
      setLoading(true);
      setError(null);
      try {
        const model = await ensureModel();
        if (cancelled) return;
        const image = await loadImage(imageUrl);
        if (cancelled) return;
        const predictions = await model.detect(image, undefined, 0.3);
        if (cancelled) return;
        const boxes: BoundingBox[] = predictions
          .map((pred: any) => ({
            x: pred.bbox[0],
            y: pred.bbox[1],
            width: pred.bbox[2],
            height: pred.bbox[3],
            score: pred.score,
            label: pred.class
          }))
          .filter((box) => box.score >= 0.5);
        setDetections(boxes);
        setSummary(summarizeDetections(boxes));
        lastUrlRef.current = imageUrl;
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

    detect();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, t]);

  useEffect(() => {
    if (imageUrl !== lastUrlRef.current) {
      setSummary(null);
    }
  }, [imageUrl]);

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
  const counts = new Map<string, number>();

  detections.forEach((d) => {
    if (d.label === 'person') people += 1;
    if (vehiclesSet.has(d.label)) vehicles += 1;
    if (animalsSet.has(d.label)) animals += 1;
    counts.set(d.label, (counts.get(d.label) ?? 0) + 1);
  });

  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return { people, vehicles, animals, total: detections.length, top };
}
