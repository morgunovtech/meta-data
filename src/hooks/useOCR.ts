import { useEffect, useRef, useState } from 'react';
import { useI18n, useT } from '../i18n';
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

/* ── image preprocessing for better OCR accuracy ──────────── */

const PREPROCESS_MAX_DIMENSION = 3000;

function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        // Scale down if too large, but keep high res for OCR
        const longest = Math.max(img.width, img.height) || 1;
        const scale = Math.min(1, PREPROCESS_MAX_DIMENSION / longest);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Draw original
        ctx.drawImage(img, 0, 0, w, h);

        // Convert to grayscale and increase contrast
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          // Luminance grayscale
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // Increase contrast: stretch around midpoint
          const contrasted = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
          d[i] = contrasted;
          d[i + 1] = contrasted;
          d[i + 2] = contrasted;
        }
        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          'image/png'
        );
      } catch {
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('preprocess-image-load'));
    };
    img.src = url;
  });
}

/* ── word/line filtering ─────────────────────────────────── */

interface WordInfo {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

function isGoodWord(word: WordInfo): boolean {
  const w = word.text.trim();
  if (w.length === 0) return false;

  // Pure punctuation/symbols — always skip
  const alphaCount = (w.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (alphaCount === 0) return false;

  // Length-proportional confidence: short words need higher confidence
  if (w.length <= 2) return word.confidence >= 50;
  if (w.length <= 4) return word.confidence >= 35;
  return word.confidence >= 25;
}

function extractRegions(
  data: any,
  scaleX: number,
  scaleY: number
): { regions: OCRRegion[]; cleanLines: string[] } {
  const regions: OCRRegion[] = [];
  const cleanLines: string[] = [];

  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        if (line.confidence < 20) continue;

        const goodWords: string[] = [];
        for (const word of line.words ?? []) {
          const w = word.text.trim();
          if (!isGoodWord(word)) continue;
          goodWords.push(w);

          const bbox = word.bbox;
          regions.push({
            text: w,
            x: bbox.x0 * scaleX,
            y: bbox.y0 * scaleY,
            width: (bbox.x1 - bbox.x0) * scaleX,
            height: (bbox.y1 - bbox.y0) * scaleY,
            confidence: word.confidence,
          });
        }

        const lineText = goodWords.join(' ');
        const lineAlpha = (lineText.match(/[\p{L}\p{N}]/gu) ?? []).length;
        if (lineAlpha < 2) continue;
        cleanLines.push(lineText);
      }
    }
  }

  return { regions, cleanLines };
}

/* ── fallback: extract from data.words when blocks are empty ── */

function extractFromWords(
  data: any,
  scaleX: number,
  scaleY: number
): { regions: OCRRegion[]; text: string } {
  const regions: OCRRegion[] = [];
  const words: string[] = [];

  for (const word of data.words ?? []) {
    if (!isGoodWord(word)) continue;
    const w = word.text.trim();
    words.push(w);

    if (word.bbox) {
      regions.push({
        text: w,
        x: word.bbox.x0 * scaleX,
        y: word.bbox.y0 * scaleY,
        width: (word.bbox.x1 - word.bbox.x0) * scaleX,
        height: (word.bbox.y1 - word.bbox.y0) * scaleY,
        confidence: word.confidence,
      });
    }
  }

  return { regions, text: words.join(' ') };
}

/* ── main hook ───────────────────────────────────────────── */

export function useOCR(fileInfo: BasicFileInfo | null) {
  const t = useT();
  const { lang } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null);
  const workerRef = useRef<import('tesseract.js').Worker | null>(null);

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
      setProgress({ label: t('ocrStageLoad'), value: 0.05 });

      try {
        // Preprocess image: grayscale + contrast for better accuracy
        const preprocessed = await preprocessImage(fileInfo.file);
        if (cancelled) return;

        setProgress({ label: t('ocrStageLoad'), value: 0.15 });

        const Tesseract = await import('tesseract.js');
        if (cancelled) return;

        setProgress({ label: t('ocrStageRecognize'), value: 0.25 });

        const worker = await Tesseract.createWorker('rus+eng', undefined, {
          logger: (m: any) => {
            if (cancelled) return;
            if (m.status === 'recognizing text') {
              setProgress({
                label: t('ocrStageRecognize'),
                value: 0.25 + m.progress * 0.6,
              });
            }
          },
        });
        workerRef.current = worker;

        if (cancelled) {
          await worker.terminate();
          return;
        }

        // Compute scale factor: preprocessing may have resized the image
        // Regions should map back to original image coordinates
        const longest = Math.max(fileInfo.width, fileInfo.height) || 1;
        const preprocScale = Math.min(1, PREPROCESS_MAX_DIMENSION / longest);
        const scaleX = 1 / preprocScale;
        const scaleY = 1 / preprocScale;

        const { data } = await worker.recognize(
          preprocessed,
          undefined,
          { text: true, blocks: true }
        );

        if (cancelled) {
          await worker.terminate();
          return;
        }

        setProgress({ label: t('ocrStageDone'), value: 1 });

        // Primary: extract from blocks hierarchy
        let { regions, cleanLines } = extractRegions(data, scaleX, scaleY);

        // Fallback 1: try data.words directly if blocks yielded nothing
        const dataAny = data as any;
        if (cleanLines.length === 0 && (dataAny.words ?? []).length > 0) {
          const fallback = extractFromWords(dataAny, scaleX, scaleY);
          regions = fallback.regions;
          cleanLines = fallback.text ? [fallback.text] : [];
        }

        // Fallback 2: use raw data.text if everything else is empty
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
  // Depend on lang instead of t to avoid re-running OCR on language switch.
  // t is only used for progress labels inside the effect, not for OCR logic.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileInfo, lang]);

  return { loading, error, result, progress };
}
