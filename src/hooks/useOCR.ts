import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { BasicFileInfo } from '../types/metadata';

export interface OCRRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface OCRResult {
  fullText: string;
  regions: OCRRegion[];
}

export function useOCR(fileInfo: BasicFileInfo | null) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null);
  const workerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    if (!fileInfo) {
      setResult(null);
      setError(null);
      setLoading(false);
      setProgress(null);
      return () => { cancelled = true; };
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress({ label: t('ocrStageLoad'), value: 0.1 });

      try {
        const Tesseract = await import('tesseract.js');

        if (cancelled) return;
        setProgress({ label: t('ocrStageRecognize'), value: 0.3 });

        // Create worker for Russian + English
        const worker = await Tesseract.createWorker('rus+eng', undefined, {
          logger: (m: any) => {
            if (cancelled) return;
            if (m.status === 'recognizing text') {
              setProgress({
                label: t('ocrStageRecognize'),
                value: 0.3 + m.progress * 0.6,
              });
            }
          },
        });
        workerRef.current = worker;

        if (cancelled) {
          await worker.terminate();
          return;
        }

        const { data } = await worker.recognize(fileInfo.dataUrl);

        if (cancelled) {
          await worker.terminate();
          return;
        }

        setProgress({ label: t('ocrStageDone'), value: 1 });

        // Extract word-level bounding boxes with decent confidence
        const regions: OCRRegion[] = [];
        for (const line of data.lines ?? []) {
          for (const word of line.words ?? []) {
            if (word.confidence < 40) continue;
            if (word.text.trim().length < 2) continue;
            const bbox = word.bbox;
            regions.push({
              text: word.text,
              x: bbox.x0,
              y: bbox.y0,
              width: bbox.x1 - bbox.x0,
              height: bbox.y1 - bbox.y0,
              confidence: word.confidence,
            });
          }
        }

        // Build line-level text (filter low confidence lines)
        const lines = (data.lines ?? [])
          .filter((line: any) => line.confidence > 30)
          .map((line: any) => line.text.trim())
          .filter((text: string) => text.length > 0);

        const fullText = lines.join('\n');

        setResult({ fullText, regions });

        await worker.terminate();
        workerRef.current = null;
      } catch (err) {
        console.error('ocr', err);
        if (!cancelled) {
          setError(t('ocrError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      workerRef.current?.terminate().catch(() => {});
      workerRef.current = null;
    };
  }, [fileInfo, t]);

  return { loading, error, result, progress };
}
