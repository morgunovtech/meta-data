import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { BoundingBox, DetectionSummary } from '../types/detection';

type LoadedModels = {
  objectModel: any;
  faceModel: any;
};

async function loadModels(): Promise<LoadedModels> {
  const [{ load }, tf, blazefaceModule] = await Promise.all([
    import('@tensorflow-models/coco-ssd'),
    import('@tensorflow/tfjs'),
    import('@tensorflow-models/blazeface')
  ]);
  if (typeof window !== 'undefined') {
    await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
    await tf.ready();
  }
  const [objectModel, faceModel] = await Promise.all([
    load({ base: 'lite_mobilenet_v2' }),
    blazefaceModule.load()
  ]);
  return { objectModel, faceModel };
}

export function useImageAnalysis(imageUrl: string | null) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const modelsRef = useRef<LoadedModels | null>(null);
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
        if (!modelsRef.current) {
          modelsRef.current = await loadModels();
        }
        const image = new Image();
        image.src = imageUrl;
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('image-load'));
        });
        if (cancelled) return;
        const [predictions, faces] = await Promise.all([
          modelsRef.current.objectModel.detect(image, undefined, 0.2),
          modelsRef.current.faceModel.estimateFaces(image, false)
        ]);
        if (cancelled) return;
        const objectBoxes: BoundingBox[] = predictions.map((pred: any) => ({
          x: pred.bbox[0],
          y: pred.bbox[1],
          width: pred.bbox[2],
          height: pred.bbox[3],
          score: pred.score,
          label: pred.class,
          category: 'object'
        }));
        const faceBoxes: BoundingBox[] = (faces as Array<any>).map((face) => {
          const [x1, y1] = face.topLeft as [number, number];
          const [x2, y2] = face.bottomRight as [number, number];
          return {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
            score: Array.isArray(face.probability) ? face.probability[0] ?? 0 : face.probability ?? 0,
            label: 'face',
            category: 'face'
          };
        });
        const boxes = [...objectBoxes, ...faceBoxes];
        const summaryValue = summarizeDetections(objectBoxes, faceBoxes);
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

function summarizeDetections(objects: BoundingBox[], faces: BoundingBox[]): DetectionSummary {
  const vehiclesSet = new Set(['car', 'bus', 'truck', 'train', 'bicycle', 'motorcycle']);
  const animalsSet = new Set(['dog', 'cat', 'bird', 'horse', 'sheep', 'cow']);
  let people = 0;
  let vehicles = 0;
  let animals = 0;
  const labelCounts: Record<string, number> = {};

  objects.forEach((d) => {
    if (d.score < 0.5) return;
    labelCounts[d.label] = (labelCounts[d.label] ?? 0) + 1;
    if (d.label === 'person') people += 1;
    if (vehiclesSet.has(d.label)) vehicles += 1;
    if (animalsSet.has(d.label)) animals += 1;
  });

  faces.forEach((d) => {
    if (d.score < 0.5) return;
    labelCounts[d.label] = (labelCounts[d.label] ?? 0) + 1;
  });

  return {
    people,
    vehicles,
    animals,
    faces: faces.filter((face) => face.score >= 0.5).length,
    labelCounts
  };
}
