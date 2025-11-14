import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ImageInfo } from './useImageFile';
import type { ContentAnalysisState, DetectedObject } from '@/types/analysis';

let modelPromise: Promise<any> | undefined;

const isEnvironmentSupported = () => {
  if (typeof window === 'undefined') return false;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  return Boolean(gl);
};

const loadModel = async () => {
  if (!modelPromise) {
    modelPromise = (async () => {
      // Load TensorFlow.js and COCO-SSD lazily from esm.sh to avoid bundling heavy assets by default.
      const [tf, coco] = await Promise.all([
        import('https://esm.sh/@tensorflow/tfjs@4.10.0?bundle&target=es2022'),
        import('https://esm.sh/@tensorflow-models/coco-ssd@2.2.2')
      ]);
      if (tf.ready) {
        await tf.ready();
      }
      return coco.load({ base: 'lite_mobilenet_v2' });
    })();
  }
  return modelPromise;
};

const summarizeDetections = (detections: DetectedObject[]) => {
  const people = detections.filter((d) => d.label === 'person').length;
  const animals = detections.filter((d) => ['dog', 'cat', 'bird'].includes(d.label)).length;
  const vehicles = detections.filter((d) => ['car', 'bus', 'truck', 'bicycle', 'motorcycle'].includes(d.label)).length;
  const top = detections
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((d) => `${d.label} ${(d.score * 100).toFixed(0)}%`)
    .join(', ');
  return { people, animals, vehicles, top };
};

export const useImageAnalysis = (image?: ImageInfo) => {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<Omit<ContentAnalysisState, 'enabled'>>({
    loading: false,
    supported: isEnvironmentSupported(),
    detections: []
  });
  const [showBoxes, setShowBoxes] = useState(false);

  useEffect(() => {
    if (!enabled || !image) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    if (!state.supported) {
      return;
    }
    let cancelled = false;

    const analyze = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const model = await loadModel();
        if (cancelled) return;
        const img = document.createElement('img');
        img.src = image.objectUrl;
        await img.decode();
        const predictions = await model.detect(img, 10);
        if (cancelled) return;
        const detections: DetectedObject[] = predictions.map((item: any, index: number) => ({
          id: `${item.class}-${index}`,
          label: item.class as string,
          score: item.score as number,
          box: {
            left: item.bbox[0] as number,
            top: item.bbox[1] as number,
            width: item.bbox[2] as number,
            height: item.bbox[3] as number
          }
        }));
        const summary = summarizeDetections(detections);
        setState({
          loading: false,
          supported: true,
          detections,
          summary: summary.top
        });
      } catch (error) {
        console.error('content analysis failed', error);
        if (!cancelled) {
          setState({ loading: false, supported: false, detections: [] });
        }
      }
    };

    analyze();

    return () => {
      cancelled = true;
    };
  }, [enabled, image, state.supported]);

  const toggle = useCallback((value: boolean) => {
    setEnabled(value);
    if (!value) {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const summaryMetrics = useMemo(() => {
    if (!state.detections.length) return { people: 0, animals: 0, vehicles: 0 };
    return {
      people: state.detections.filter((d) => d.label === 'person').length,
      animals: state.detections.filter((d) => ['dog', 'cat', 'bird'].includes(d.label)).length,
      vehicles: state.detections.filter((d) => ['car', 'bus', 'truck', 'bicycle', 'motorcycle'].includes(d.label)).length
    };
  }, [state.detections]);

  return {
    state: { ...state, enabled },
    toggle,
    showBoxes,
    setShowBoxes,
    summaryMetrics
  };
};
