import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { BoundingBox, DetectionSummary } from '../types/detection';

async function ensureTensorflowReady() {
  const tf = await import('@tensorflow/tfjs');
  if (typeof window !== 'undefined') {
    const currentBackend = tf.getBackend();
    if (currentBackend !== 'webgl') {
      await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
    }
    await tf.ready();
  }
  return tf;
}

async function loadObjectModel() {
  const [{ load }] = await Promise.all([
    import('@tensorflow-models/coco-ssd'),
    ensureTensorflowReady()
  ]);
  return load({ base: 'lite_mobilenet_v2' });
}

async function loadFaceModel() {
  const [blazeface] = await Promise.all([
    import('@tensorflow-models/blazeface'),
    ensureTensorflowReady()
  ]);
  return blazeface.load({ maxFaces: 10 });
}

export function useImageAnalysis(imageUrl: string | null) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const objectModelRef = useRef<any | null>(null);
  const faceModelRef = useRef<any | null>(null);
  const capabilityCheckedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const reset = () => {
      setDetections([]);
      setSummary(null);
    };

    if (!imageUrl) {
      reset();
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (typeof window === 'undefined') {
      return () => {
        cancelled = true;
      };
    }

    const hasWebGL = (() => {
      if (!window.WebGLRenderingContext) return false;
      try {
        const canvas = document.createElement('canvas');
        return !!(
          canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        );
      } catch (error) {
        console.warn('webgl-check', error);
        return false;
      }
    })();

    if (!hasWebGL && !('OffscreenCanvas' in window)) {
      if (!capabilityCheckedRef.current) {
        setError(t('contentUnavailable'));
        capabilityCheckedRef.current = true;
      }
      reset();
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const detect = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!objectModelRef.current) {
          objectModelRef.current = await loadObjectModel();
        }
        if (!faceModelRef.current) {
          faceModelRef.current = await loadFaceModel();
        }
        const image = new Image();
        image.src = imageUrl;
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('image-load'));
        });
        if (cancelled) return;
        const [predictions, faces] = await Promise.all([
          objectModelRef.current.detect(image, undefined, 0.2),
          faceModelRef.current.estimateFaces(image, false)
        ]);
        if (cancelled) return;
        const boxes: BoundingBox[] = predictions.map((pred: any) => ({
          x: pred.bbox[0],
          y: pred.bbox[1],
          width: pred.bbox[2],
          height: pred.bbox[3],
          score: pred.score,
          label: pred.class
        }));
        faces.forEach((face: any) => {
          const [x, y] = face.topLeft;
          const [brX, brY] = face.bottomRight;
          const width = brX - x;
          const height = brY - y;
          boxes.push({
            x,
            y,
            width,
            height,
            score: Array.isArray(face.probability) ? face.probability[0] ?? 0.9 : face.probability ?? 0.9,
            label: 'face'
          });
        });
        const summaryValue = summarizeDetections(boxes);
        setDetections(boxes);
        setSummary(summaryValue);
        capabilityCheckedRef.current = true;
      } catch (err) {
        console.error('analysis', err);
        if (!cancelled) {
          setError(t('contentUnavailable'));
          reset();
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
  let faces = 0;
  const topLabels: string[] = [];

  detections.forEach((d) => {
    if (d.score < 0.5) return;
    if (d.label === 'person') people += 1;
    if (d.label === 'face') faces += 1;
    if (vehiclesSet.has(d.label)) vehicles += 1;
    if (animalsSet.has(d.label)) animals += 1;
    if (topLabels.length < 5 && !topLabels.includes(d.label)) {
      topLabels.push(d.label);
    }
  });

  const description = topLabels.length > 0 ? topLabels.join(', ') : '';

  return { people, faces, vehicles, animals, description };
}
