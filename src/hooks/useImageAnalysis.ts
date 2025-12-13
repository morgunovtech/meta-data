import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { BoundingBox, DetectionSummary } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';

async function loadModel() {
  const resolved = await Promise.all([
    import('@tensorflow-models/coco-ssd'),
    import('@tensorflow/tfjs')
  ]).catch((error) => {
    console.warn('analysis-model-load', error);
    return null;
  });

  if (!resolved) return null;

  const [{ load }, tf] = resolved;
  if (typeof window !== 'undefined') {
    await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
    await tf.ready();
  }
  return load({ base: 'lite_mobilenet_v2' });
}

type OcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;

type OcrSource = {
  label: string;
  workerPath: string;
  corePath: string;
  langPath: string;
};

const ocrAssetBase = (import.meta.env.VITE_OCR_ASSET_BASE ?? `${import.meta.env.BASE_URL}ocr/`).replace(
  /\/*$/,
  '/'
);
const ocrEnabled = import.meta.env.VITE_ENABLE_OCR !== 'false';
const resolveOcrAsset = (fileName: string) => `${ocrAssetBase}${fileName}`;

const ocrSources: OcrSource[] = [
  {
    label: 'local',
    workerPath: resolveOcrAsset('worker.min.js'),
    corePath: resolveOcrAsset('tesseract-core.wasm.js'),
    langPath: ocrAssetBase
  },
  {
    label: 'cdn',
    workerPath: 'https://unpkg.com/tesseract.js@4.1.1/dist/worker.min.js',
    corePath: 'https://unpkg.com/tesseract.js-core@5.0.1/tesseract-core.wasm.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast/'
  }
];

let cachedOcrWorkerPromise: Promise<OcrWorker | null> | null = null;
let ocrProgressListener: ((message: { status: string; progress?: number }) => void) | null = null;

async function getOcrWorker(
  onProgress?: (message: { status: string; progress?: number }) => void,
  signal?: AbortSignal
): Promise<OcrWorker | null> {
  if (signal?.aborted) return null;
  if (onProgress) {
    ocrProgressListener = onProgress;
  }
  if (!cachedOcrWorkerPromise) {
    cachedOcrWorkerPromise = (async () => {
      const [{ createWorker }] = await Promise.all([import('tesseract.js')]);
      for (const source of ocrSources) {
        try {
          const worker = await createWorker({
            workerPath: source.workerPath,
            langPath: source.langPath,
            corePath: source.corePath,
            logger: (message) => {
              if (message?.status) {
                ocrProgressListener?.({ status: message.status, progress: message.progress });
              }
            }
          });
          await worker.loadLanguage('eng');
          await worker.initialize('eng');
          if (import.meta.env.DEV) {
            console.info('[ocr] ready via', source.label);
          }
          return worker;
        } catch (error) {
          console.warn('ocr-init', source.label, error);
        }
      }
      cachedOcrWorkerPromise = null;
      return null;
    })();
  }
  return cachedOcrWorkerPromise;
}

export function useImageAnalysis(fileInfo: BasicFileInfo | null) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<{ label: string; progress: number } | null>(null);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const modelRef = useRef<any | null>(null);
  const capabilityCheckedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const reset = () => {
      setDetections([]);
      setSummary(null);
      setDetectionStatus(null);
    };

    if (!fileInfo) {
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

    const abortController = new AbortController();

    const detect = async () => {
      setLoading(true);
      setError(null);
      setOcrStatus(null);
      setDetectionStatus({ label: t('detectionStagePrep'), progress: 0 });
      let decoded: DecodedSource | null = null;
      try {
        if (import.meta.env.DEV) {
          console.info('[pipeline] analyze:start');
        }
        if (!modelRef.current) {
          setDetectionStatus({ label: t('detectionStageModel'), progress: 0.15 });
          modelRef.current = await loadModel();
          if (!modelRef.current && import.meta.env.DEV) {
            console.info('[pipeline] analyze:skip-detection (model unavailable)');
          }
        }
        setDetectionStatus({ label: t('detectionStageDecode'), progress: 0.3 });
        decoded = await decodeForAnalysis(fileInfo);
        if (!decoded) {
          throw new Error('analysis-image');
        }
        if (import.meta.env.DEV) {
          console.info('[analysis] image ready', {
            width: decoded.source.width,
            height: decoded.source.height,
            original: { width: fileInfo.width, height: fileInfo.height }
          });
        }
        if (cancelled) return;
        const scaledForDetection = scaleImage(decoded.source, DETECTION_MAX_DIMENSION, {
          width: decoded.baseWidth,
          height: decoded.baseHeight
        });
        setDetectionStatus({ label: t('detectionStageDetect'), progress: 0.55 });
        const handleOcrProgress = (message: { status: string; progress?: number }) => {
          if (cancelled) return;
          const percent = typeof message.progress === 'number' ? Math.round(message.progress * 100) : null;
          const statusLabel = mapOcrStatus(message.status, t);
          setOcrStatus(
            percent !== null
              ? t('ocrProgress', { status: statusLabel, progress: percent })
              : t('ocrWorking', { status: statusLabel })
          );
        };
        const [predictions, ocrResult] = await Promise.all([
          modelRef.current?.detect && scaledForDetection.canvas.width > 1 && scaledForDetection.canvas.height > 1
            ? modelRef.current.detect(scaledForDetection.canvas, undefined, 0.2)
            : Promise.resolve([]),
          runOcr(decoded.source, {
            signal: abortController.signal,
            onProgress: handleOcrProgress,
            baseDimensions: { width: decoded.baseWidth, height: decoded.baseHeight },
            t
          })
        ]);
        if (cancelled) return;
        setDetectionStatus({ label: t('detectionStageProcess'), progress: 0.8 });
        const boxes: BoundingBox[] = predictions.map((pred: any) => ({
          x: pred.bbox[0] * scaledForDetection.scaleX,
          y: pred.bbox[1] * scaledForDetection.scaleY,
          width: pred.bbox[2] * scaledForDetection.scaleX,
          height: pred.bbox[3] * scaledForDetection.scaleY,
          score: pred.score,
          label: pred.class
        }));
        const ocrBoxes = ocrResult?.boxes ?? [];
        const summaryValue = summarizeDetections([...boxes, ...ocrBoxes], ocrResult?.lines ?? []);
        setDetections([...boxes, ...ocrBoxes]);
        setSummary(summaryValue);
        if (import.meta.env.DEV) {
          console.info('[pipeline] analyze:done', {
            objects: boxes.length,
            textBoxes: ocrBoxes.length,
            lines: ocrResult?.lines?.length ?? 0
          });
        }
        capabilityCheckedRef.current = true;
        setOcrStatus(null);
        setDetectionStatus({ label: t('detectionStageDone'), progress: 1 });
      } catch (err) {
        console.error('analysis', err);
        if (!cancelled) {
          setError(t('contentUnavailable'));
          setOcrStatus(t('ocrUnavailable'));
          reset();
        }
      } finally {
        decoded?.cleanup?.();
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    detect();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [fileInfo, t]);

  return {
    loading,
    error,
    ocrStatus,
    detectionStatus,
    detections,
    summary
  };
}

type RunOcrOptions = {
  signal?: AbortSignal;
  onProgress?: (message: { status: string; progress?: number }) => void;
  baseDimensions?: { width: number; height: number };
  t: ReturnType<typeof useT>;
};

type OcrRunResult = { lines: string[]; boxes: BoundingBox[] };
type CanvasSource = CanvasImageSource & { width: number; height: number };
const DETECTION_MAX_DIMENSION = 1600;
const OCR_MAX_DIMENSION = 1800;
const MAX_ANALYSIS_PIXELS = 14_000_000;
const DECODE_MAX_DIMENSION = Math.max(DETECTION_MAX_DIMENSION, OCR_MAX_DIMENSION);

type DecodedSource = {
  source: CanvasSource;
  baseWidth: number;
  baseHeight: number;
  cleanup?: () => void;
};

async function decodeForAnalysis(fileInfo: BasicFileInfo): Promise<DecodedSource | null> {
  const workingWidth = fileInfo.width;
  const workingHeight = fileInfo.height;
  const baseWidth = fileInfo.originalWidth ?? workingWidth;
  const baseHeight = fileInfo.originalHeight ?? workingHeight;

  const longestSide = Math.max(workingWidth, workingHeight) || 1;
  const pixelScale = Math.sqrt(MAX_ANALYSIS_PIXELS / Math.max(1, workingWidth * workingHeight));
  const targetScale = Math.min(1, DECODE_MAX_DIMENSION / longestSide, pixelScale);
  const targetWidth = Math.max(1, Math.round(workingWidth * targetScale));
  const targetHeight = Math.max(1, Math.round(workingHeight * targetScale));

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(fileInfo.file, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: 'high'
      });
      const cleanup = () => {
        if (typeof (bitmap as ImageBitmap).close === 'function') {
          (bitmap as ImageBitmap).close();
        }
      };
      return {
        source: bitmap as CanvasSource,
        baseWidth,
        baseHeight,
        cleanup
      };
    } catch (error) {
      console.warn('bitmap-decode', error);
    }
  }

  const image = new Image();
  image.decoding = 'async';
  image.loading = 'eager';
  image.src = fileInfo.dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('image-load'));
  });

  return {
    source: image as CanvasSource,
    baseWidth,
    baseHeight
  };
}

async function runOcr(image: CanvasSource, options: RunOcrOptions): Promise<OcrRunResult | null> {
  const { signal, onProgress, t } = options;
  if (signal?.aborted || !ocrEnabled) {
    return null;
  }

  try {
    const worker = await getOcrWorker(onProgress, signal);
    if (!worker || signal?.aborted) {
      return null;
    }
    const preprocessed = await preprocessImageForOcr(image, signal, options.baseDimensions);
    if (!preprocessed || signal?.aborted) {
      return null;
    }
    if (preprocessed.canvas.width <= 1 || preprocessed.canvas.height <= 1) {
      return null;
    }
    onProgress?.({ status: 'recognizing text', progress: 0 });
    const { data } = await worker.recognize(preprocessed.canvas);
    onProgress?.({ status: 'recognizing text', progress: 1 });
    if (signal?.aborted) {
      return null;
    }
    const lines = data.text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 5);
    const boxes: BoundingBox[] = (data.words ?? [])
      .filter((word) => word?.text?.trim())
      .map((word) => {
        const { bbox } = word;
        const width = Math.max(1, (bbox.x1 - bbox.x0) * preprocessed.scaleX);
        const height = Math.max(1, (bbox.y1 - bbox.y0) * preprocessed.scaleY);
        return {
          x: bbox.x0 * preprocessed.scaleX,
          y: bbox.y0 * preprocessed.scaleY,
          width,
          height,
          score: typeof word.confidence === 'number' ? word.confidence / 100 : 0.5,
          label: `text: ${word.text}`
        } satisfies BoundingBox;
      })
      .slice(0, 10);
    if (lines.length === 0) {
      onProgress?.({ status: t('ocrNoTextFound') });
    }
    return { lines, boxes };
  } catch (error) {
    console.warn('ocr', error);
    onProgress?.({ status: t('ocrUnavailable') });
    return null;
  }
}

function mapOcrStatus(status: string, t: ReturnType<typeof useT>): string {
  const statusMap: Record<string, string> = {
    'loading tesseract core': t('ocrStatusLoadingCore'),
    'initializing tesseract': t('ocrStatusInitializing'),
    'recognizing text': t('ocrStatusRecognizing')
  };
  return statusMap[status] ?? status;
}

type ScaledCanvas = { canvas: HTMLCanvasElement; scaleX: number; scaleY: number };

function scaleImage(
  image: CanvasSource,
  maxDimension = 2000,
  base?: { width: number; height: number }
): ScaledCanvas {
  try {
    const canvas = document.createElement('canvas');
    const maxSourceDimension = Math.max(image.width, image.height) || 1;
    const scale = Math.min(1, maxDimension / maxSourceDimension);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas');
    }
    ctx.drawImage(image as CanvasImageSource, 0, 0, width, height);
    const scaleX = (base?.width ?? image.width) / width;
    const scaleY = (base?.height ?? image.height) / height;
    return { canvas, scaleX, scaleY };
  } catch (error) {
    console.warn('scale-image-fallback', error);
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return { canvas, scaleX: 1, scaleY: 1 };
  }
}

async function preprocessImageForOcr(
  image: CanvasSource,
  signal?: AbortSignal,
  base?: { width: number; height: number }
): Promise<(ScaledCanvas & { canvas: HTMLCanvasElement }) | null> {
  if (signal?.aborted) return null;
  const scaled = scaleImage(image, OCR_MAX_DIMENSION, base);
  const { canvas } = scaled;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    sum += gray;
  }
  const avg = sum / (data.length / 4);
  const threshold = Math.min(230, Math.max(80, avg + 10));
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
  return scaled;
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
    if (d.label.startsWith('text')) return;
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
