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

        // Use the original File object for best quality
        // Request blocks output explicitly (disabled by default in v7)
        const { data } = await worker.recognize(
          fileInfo.file,
          undefined,
          { text: true, blocks: true }
        );

        if (cancelled) {
          await worker.terminate();
          return;
        }

        setProgress({ label: t('ocrStageDone'), value: 1 });

        // Tesseract.js v7 structure: data.blocks[].paragraphs[].lines[].words[]
        const regions: OCRRegion[] = [];
        const cleanLines: string[] = [];

        for (const block of data.blocks ?? []) {
          for (const paragraph of block.paragraphs ?? []) {
            for (const line of paragraph.lines ?? []) {
              if (line.confidence < 25) continue;

              // Collect clean words from this line
              const goodWords: string[] = [];
              for (const word of line.words ?? []) {
                const w = word.text.trim();
                if (word.confidence < 30) continue;
                if (w.length < 2) continue;
                // Skip tokens that are purely punctuation/symbols
                const alphaCount = (w.match(/[\p{L}\p{N}]/gu) ?? []).length;
                if (alphaCount === 0) continue;
                goodWords.push(w);

                const bbox = word.bbox;
                regions.push({
                  text: w,
                  x: bbox.x0,
                  y: bbox.y0,
                  width: bbox.x1 - bbox.x0,
                  height: bbox.y1 - bbox.y0,
                  confidence: word.confidence,
                });
              }

              // Only keep lines with at least 2 meaningful characters total
              const lineText = goodWords.join(' ');
              const lineAlpha = (lineText.match(/[\p{L}\p{N}]/gu) ?? []).length;
              if (lineAlpha < 3) continue;
              cleanLines.push(lineText);
            }
          }
        }

        // Use block-extracted lines, fall back to data.text if blocks empty
        const fullText = cleanLines.length > 0
          ? cleanLines.join('\n')
          : (data.text ?? '').trim();

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
