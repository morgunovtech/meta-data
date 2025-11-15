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

export function useImageAnalysis(imageUrl: string | null) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const modelRef = useRef<any | null>(null);
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
        if (!modelRef.current) {
          modelRef.current = await loadModel();
        }
        const image = new Image();
        image.src = imageUrl;
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('image-load'));
        });
        if (cancelled) return;
        const [predictions, ocrTexts] = await Promise.all([
          modelRef.current.detect(image, undefined, 0.2),
          runOcr(imageUrl)
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
        const summaryValue = summarizeDetections(boxes, ocrTexts);
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

async function runOcr(imageUrl: string): Promise<string[]> {
  try {
    const [{ createWorker }] = await Promise.all([import('tesseract.js')]);
    const worker = await createWorker({
      workerPath: 'https://unpkg.com/tesseract.js@4.1.1/dist/worker.min.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      corePath: 'https://unpkg.com/tesseract.js-core@4.0.1/tesseract-core.wasm.js'
    });
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data } = await worker.recognize(imageUrl);
    await worker.terminate();
    return data.text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 5);
  } catch (error) {
    console.warn('ocr', error);
    return [];
  }
}

function summarizeDetections(detections: BoundingBox[], ocrTexts: string[]): DetectionSummary {
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

  return { people, vehicles, animals, description, ocrTexts };
}
