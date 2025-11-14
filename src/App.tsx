import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InfoBlock } from './components/InfoBlock';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { UploadZone } from './components/UploadZone';
import { useImageFile } from './hooks/useImageFile';
import { useExifMetadata } from './hooks/useExifMetadata';
import { PreviewViewer } from './components/PreviewViewer';
import { MetadataPanel } from './components/MetadataPanel';
import { ShockBlock } from './components/ShockBlock';
import { CleanupDownloadBlock } from './components/CleanupDownloadBlock';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import type { ManualCoordinates } from './types/metadata';
import { useT } from './i18n';
import { ThemeSwitcher } from './components/ThemeSwitcher';

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = src;
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('image-load'));
    };
  });
}

const qualityDefault = 0.92;
const blurDefault = 32;

const App: React.FC = () => {
  const t = useT();
  const { fileInfo, error, loading, processFile, reset } = useImageFile();
  const { metadata } = useExifMetadata(fileInfo);
  const {
    loading: analysisLoading,
    error: analysisError,
    detections,
    summary: analysisSummary
  } = useImageAnalysis(fileInfo?.dataUrl ?? null);

  type NoticeState = { type: 'success' | 'error'; message: string };

  const [manualCoords, setManualCoords] = useState<ManualCoordinates | null>(null);
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [blurFaces, setBlurFaces] = useState(false);
  const [blurAmount, setBlurAmount] = useState(blurDefault);
  const [jpegQuality, setJpegQuality] = useState(qualityDefault);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const personDetections = useMemo(
    () => detections.filter((det) => det.label === 'person'),
    [detections]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setManualCoords(null);
      setRemoveMetadata(true);
      setBlurFaces(false);
      setBlurAmount(blurDefault);
      setNotice(null);
      setJpegQuality(qualityDefault);
      setPreviewDataUrl(null);
      setPreviewLoading(true);
      setEstimatedSize(null);
      await processFile(file);
    },
    [processFile]
  );

  const createProcessedCanvas = useCallback(async () => {
    if (!fileInfo) return null;
    const image = await loadImageElement(fileInfo.dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = fileInfo.width;
    canvas.height = fileInfo.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas');
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    if (blurFaces && personDetections.length > 0) {
      personDetections.forEach((det) => {
        const headX = Math.max(0, det.x + det.width * 0.2);
        const headWidth = det.width * 0.6;
        const headY = Math.max(0, det.y - det.height * 0.1);
        const headHeight = det.height * 0.55;
        const padX = Math.max(det.width * 0.08, 12);
        const padY = Math.max(det.height * 0.12, 12);
        const x = Math.max(0, headX - padX);
        const y = Math.max(0, headY - padY);
        const width = Math.max(0, Math.min(canvas.width - x, headWidth + padX * 2));
        const height = Math.max(0, Math.min(canvas.height - y, headHeight + padY * 2));
        ctx.save();
        ctx.beginPath();
        if (width > 0 && height > 0) {
          ctx.rect(x, y, width, height);
          ctx.clip();
          ctx.filter = `blur(${blurAmount}px)`;
          ctx.drawImage(image, x, y, width, height, x, y, width, height);
        }
        ctx.restore();
      });
    }

    return canvas;
  }, [fileInfo, blurFaces, blurAmount, personDetections]);

  const handleDownload = useCallback(async () => {
    if (!fileInfo || (!removeMetadata && !blurFaces)) {
      return;
    }
    setProcessing(true);
    setNotice(null);
    try {
      const canvas = await createProcessedCanvas();
      if (!canvas) {
        throw new Error('no-canvas');
      }
      const mime = fileInfo.mimeType;
      const extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const blob: Blob = await new Promise((resolve, reject) => {
        if (mime === 'image/png') {
          canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error('export-failed'));
          }, 'image/png');
        } else if (mime === 'image/webp') {
          canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error('export-failed'));
          }, 'image/webp', jpegQuality);
        } else {
          canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error('export-failed'));
          }, 'image/jpeg', jpegQuality);
        }
      });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileInfo.file.name.replace(/\.[^/.]+$/, '')}.cleaned.${extension}`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(link.href);
        document.body.removeChild(link);
      }, 2000);
      setEstimatedSize(blob.size);
      setNotice({ type: 'success', message: t('downloadReady') });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: t('cleanupFailed') });
    } finally {
      setProcessing(false);
    }
  }, [
    fileInfo,
    removeMetadata,
    blurFaces,
    createProcessedCanvas,
    jpegQuality,
    t
  ]);

  const handleReset = useCallback(() => {
    reset();
    setManualCoords(null);
    setRemoveMetadata(true);
    setBlurFaces(false);
    setBlurAmount(blurDefault);
    setProcessing(false);
    setNotice(null);
    setJpegQuality(qualityDefault);
    setPreviewDataUrl(null);
    setPreviewLoading(false);
    setEstimatedSize(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, [reset]);

  useEffect(() => {
    if (!fileInfo) {
      setPreviewDataUrl(null);
      setPreviewLoading(false);
      setEstimatedSize(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setEstimatedSize(null);
    createProcessedCanvas()
      .then((canvas) => {
        if (!canvas || cancelled) {
          return;
        }
        const mime = fileInfo.mimeType.includes('png') ? 'image/png' : 'image/jpeg';
        const quality = mime === 'image/jpeg' ? jpegQuality : undefined;
        canvas.toBlob(
          (blob) => {
            if (!blob || cancelled) {
              return;
            }
            const url = URL.createObjectURL(blob);
            if (previewUrlRef.current) {
              URL.revokeObjectURL(previewUrlRef.current);
            }
            previewUrlRef.current = url;
            setEstimatedSize(blob.size);
            setPreviewDataUrl(url);
          },
          mime,
          quality
        );
      })
      .catch((err) => {
        console.error('cleanup-preview', err);
        if (!cancelled) {
          setPreviewDataUrl(null);
          setEstimatedSize(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [fileInfo, blurFaces, jpegQuality, blurAmount, createProcessedCanvas]);

  return (
    <div className="app-shell">
      <header className="title-row">
        <div className="title-row__group">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
        <button type="button" className="button button--ghost" onClick={handleReset}>
          {t('reset')}
        </button>
      </header>
      <div className="intro-grid">
        <InfoBlock />
        <UploadZone loading={loading} onFile={handleFile} error={error ?? undefined} />
      </div>

      {fileInfo ? (
        <div className="grid-two-column">
          <div className="panel">
            <PreviewViewer fileInfo={fileInfo} detections={detections} />
          </div>
          <MetadataPanel
            fileInfo={fileInfo}
            metadata={metadata}
            analysis={{ loading: analysisLoading, error: analysisError, summary: analysisSummary }}
          />
        </div>
      ) : null}

      {fileInfo ? (
        <ShockBlock metadata={metadata} manualCoords={manualCoords} onManualCoordsChange={setManualCoords} />
      ) : null}

      <CleanupDownloadBlock
        fileInfo={fileInfo}
        detections={detections}
        removeMetadata={removeMetadata}
        blurFaces={blurFaces}
        blurAmount={blurAmount}
        jpegQuality={jpegQuality}
        setRemoveMetadata={setRemoveMetadata}
        setBlurFaces={setBlurFaces}
        setBlurAmount={setBlurAmount}
        setJpegQuality={setJpegQuality}
        onClean={handleDownload}
        processing={processing}
        previewDataUrl={previewDataUrl}
        previewLoading={previewLoading}
        estimatedSize={estimatedSize}
      />
      {notice ? (
        <p className={`notice ${notice.type === 'success' ? 'notice--positive' : 'notice--negative'}`}>
          {notice.message}
        </p>
      ) : null}
    </div>
  );
};

export default App;
