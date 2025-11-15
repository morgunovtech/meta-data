import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { AntiSearchParams, ManualMaskRegion } from './types/cleanup';
import { applyAntiSearch, generateAntiSearchParams } from './utils/antiSearch';
import { createRandomId } from './utils/random';

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
const blurDefault = 28;

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

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
  const [renameFile, setRenameFile] = useState(false);
  const [renameSlug, setRenameSlug] = useState<string>(() => createRandomId());
  const [blurFaces, setBlurFaces] = useState(false);
  const [blurStrength, setBlurStrength] = useState(blurDefault);
  const [manualMasks, setManualMasks] = useState<ManualMaskRegion[]>([]);
  const [antiSearchEnabled, setAntiSearchEnabled] = useState(false);
  const [antiSearchStrength, setAntiSearchStrength] = useState(1);
  const [antiSearchParams, setAntiSearchParams] = useState<AntiSearchParams | null>(null);
  const [grayscale, setGrayscale] = useState(false);
  const [watermark, setWatermark] = useState(false);
  const [jpegQuality, setJpegQuality] = useState(qualityDefault);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);

  const personDetections = useMemo(
    () => detections.filter((det) => det.label === 'person'),
    [detections]
  );
  const hasManualMasks = manualMasks.length > 0;
  const hasAnyChange = useMemo(
    () =>
      renameFile ||
      removeMetadata ||
      blurFaces ||
      hasManualMasks ||
      (antiSearchEnabled && antiSearchStrength > 0) ||
      grayscale ||
      watermark,
    [
      renameFile,
      removeMetadata,
      blurFaces,
      hasManualMasks,
      antiSearchEnabled,
      antiSearchStrength,
      grayscale,
      watermark
    ]
  );
  const needsCanvasProcessing = useMemo(
    () =>
      removeMetadata ||
      blurFaces ||
      hasManualMasks ||
      (antiSearchEnabled && antiSearchStrength > 0) ||
      grayscale ||
      watermark,
    [
      removeMetadata,
      blurFaces,
      hasManualMasks,
      antiSearchEnabled,
      antiSearchStrength,
      grayscale,
      watermark
    ]
  );
  const estimatedResolution = useMemo(() => {
    if (!fileInfo) return null;
    let width = fileInfo.width;
    let height = fileInfo.height;
    if (antiSearchEnabled && antiSearchStrength > 0 && antiSearchParams) {
      if (width > antiSearchParams.crop * 2 && height > antiSearchParams.crop * 2) {
        width = Math.max(1, width - antiSearchParams.crop * 2);
        height = Math.max(1, height - antiSearchParams.crop * 2);
      }
    }
    return { width, height };
  }, [fileInfo, antiSearchEnabled, antiSearchStrength, antiSearchParams]);
  const targetExtension = useMemo(() => {
    if (!fileInfo) return null;
    if (!needsCanvasProcessing) {
      const ext = fileInfo.file.name.split('.').pop();
      if (ext) {
        return ext.toLowerCase();
      }
    }
    if (fileInfo.mimeType.includes('png')) return 'png';
    if (fileInfo.mimeType.includes('webp')) return 'webp';
    return 'jpg';
  }, [fileInfo, needsCanvasProcessing]);
  const renamePreviewName = useMemo(() => {
    if (!fileInfo) return null;
    const extension = targetExtension ?? 'jpg';
    return `photo-${renameSlug}.${extension}`;
  }, [fileInfo, renameSlug, targetExtension]);
  const originalBaseName = useMemo(
    () => (fileInfo ? fileInfo.file.name.replace(/\.[^/.]+$/, '') : ''),
    [fileInfo]
  );
  const metadataFieldCount = useMemo(() => {
    if (!metadata) return 0;
    return Object.values(metadata.groups).reduce((total, group) => total + Object.keys(group).length, 0);
  }, [metadata]);

  const ensureAntiSearchParams = useCallback(
    (strength: number) => {
      const params = generateAntiSearchParams({ strength });
      setAntiSearchParams(params);
      return params;
    },
    []
  );

  const handleRenameToggle = useCallback((value: boolean) => {
    setRenameFile(value);
    if (value) {
      setRenameSlug((current) => current || createRandomId());
    }
  }, []);

  const handleAntiSearchToggle = useCallback(
    (value: boolean) => {
      setAntiSearchEnabled(value);
      if (value) {
        ensureAntiSearchParams(antiSearchStrength);
      } else {
        setAntiSearchParams(null);
      }
    },
    [antiSearchStrength, ensureAntiSearchParams]
  );

  const handleAntiSearchStrengthChange = useCallback(
    (value: number) => {
      const clamped = Math.max(1, Math.min(3, Math.round(value)));
      setAntiSearchStrength(clamped);
      if (antiSearchEnabled) {
        ensureAntiSearchParams(clamped);
      }
    },
    [antiSearchEnabled, ensureAntiSearchParams]
  );

  const handleAddMask = useCallback((mask: ManualMaskRegion) => {
    setManualMasks((prev) => [...prev, mask]);
  }, []);

  const handleRemoveMask = useCallback((id: string) => {
    setManualMasks((prev) => prev.filter((mask) => mask.id !== id));
  }, []);

  const handleClearMasks = useCallback(() => {
    setManualMasks([]);
  }, []);

  const applyPreset = useCallback(
    (preset: 'quick' | 'balanced' | 'paranoid') => {
      if (preset === 'quick') {
        setRemoveMetadata(true);
        setRenameFile(false);
        setBlurFaces(false);
        setBlurStrength(blurDefault);
        setAntiSearchEnabled(false);
        setAntiSearchStrength(1);
        setAntiSearchParams(null);
        setGrayscale(false);
        setWatermark(false);
        setJpegQuality(qualityDefault);
        return;
      }

      if (preset === 'balanced') {
        setRemoveMetadata(true);
        setRenameFile(true);
        setRenameSlug((current) => current || createRandomId());
        setBlurFaces(true);
        setBlurStrength(Math.max(blurDefault, 32));
        setAntiSearchEnabled(true);
        setAntiSearchStrength(1);
        ensureAntiSearchParams(1);
        setGrayscale(false);
        setWatermark(false);
        setJpegQuality(0.9);
        return;
      }

      setRemoveMetadata(true);
      setRenameFile(true);
      setRenameSlug((current) => current || createRandomId());
      setBlurFaces(true);
      setBlurStrength(Math.max(blurDefault, 36));
      setAntiSearchEnabled(true);
      setAntiSearchStrength(3);
      ensureAntiSearchParams(3);
      setGrayscale(true);
      setWatermark(true);
      setJpegQuality(0.88);
    },
    [ensureAntiSearchParams]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setManualCoords(null);
      setRemoveMetadata(true);
      setRenameFile(false);
      setRenameSlug(createRandomId());
      setBlurFaces(false);
      setBlurStrength(blurDefault);
      setManualMasks([]);
      setAntiSearchEnabled(false);
      setAntiSearchStrength(1);
      setAntiSearchParams(null);
      setGrayscale(false);
      setWatermark(false);
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
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = fileInfo.width;
    baseCanvas.height = fileInfo.height;
    const baseCtx = baseCanvas.getContext('2d');
    if (!baseCtx) {
      throw new Error('canvas');
    }
    baseCtx.drawImage(image, 0, 0, baseCanvas.width, baseCanvas.height);

    const applyBlurRegion = (x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      baseCtx.save();
      baseCtx.beginPath();
      baseCtx.rect(x, y, width, height);
      baseCtx.clip();
      baseCtx.filter = `blur(${Math.round(blurStrength)}px)`;
      baseCtx.drawImage(image, x, y, width, height, x, y, width, height);
      baseCtx.filter = 'none';
      baseCtx.restore();
    };

    if (blurFaces && personDetections.length > 0) {
      personDetections.forEach((det) => {
        const pad = Math.max(det.width, det.height) * 0.08;
        const faceWidth = det.width * 0.55;
        const faceHeight = det.height * 0.45;
        const centerX = det.x + det.width / 2;
        const faceX = centerX - faceWidth / 2;
        const x = Math.max(0, Math.min(baseCanvas.width, faceX - pad));
        const y = Math.max(0, Math.min(baseCanvas.height, det.y - pad * 0.6));
        const width = Math.min(baseCanvas.width - x, faceWidth + pad * 2);
        const height = Math.min(baseCanvas.height - y, faceHeight + pad * 1.5);
        applyBlurRegion(x, y, width, height);
      });
    }

    if (manualMasks.length > 0) {
      manualMasks.forEach((mask) => {
        const x = mask.x * baseCanvas.width;
        const y = mask.y * baseCanvas.height;
        const width = mask.width * baseCanvas.width;
        const height = mask.height * baseCanvas.height;
        applyBlurRegion(x, y, width, height);
      });
    }

    let workingCanvas: HTMLCanvasElement = baseCanvas;

    if (antiSearchEnabled && antiSearchStrength > 0) {
      const params =
        antiSearchParams ?? generateAntiSearchParams({ strength: antiSearchStrength });
      if (!antiSearchParams) {
        setAntiSearchParams(params);
      }
      workingCanvas = applyAntiSearch(workingCanvas, params);
    }

    if (grayscale) {
      const ctx = workingCanvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
        const { data } = imageData;
        for (let index = 0; index < data.length; index += 4) {
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
          data[index] = gray;
          data[index + 1] = gray;
          data[index + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
      }
    }

    if (watermark) {
      const ctx = workingCanvas.getContext('2d');
      if (ctx) {
        const margin = Math.max(16, Math.round(workingCanvas.width * 0.02));
        const fontSize = Math.max(14, Math.round(workingCanvas.width * 0.018));
        ctx.save();
        ctx.font = `${fontSize}px/1.2 "Inter", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.filter = 'blur(0.35px)';
        ctx.fillText(t('watermarkText'), workingCanvas.width - margin, workingCanvas.height - margin);
        ctx.filter = 'none';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fillText(t('watermarkText'), workingCanvas.width - margin, workingCanvas.height - margin);
        ctx.restore();
      }
    }

    return workingCanvas;
  }, [
    fileInfo,
    blurFaces,
    personDetections,
    blurStrength,
    manualMasks,
    antiSearchEnabled,
    antiSearchStrength,
    antiSearchParams,
    grayscale,
    watermark,
    t
  ]);

  const handleDownload = useCallback(async () => {
    if (!fileInfo || !hasAnyChange) {
      return;
    }
    setProcessing(true);
    setNotice(null);
    try {
      const originalExtension = fileInfo.file.name.split('.').pop() ?? '';
      const safeSlug = renameSlug || createRandomId();
      const preferredMime = fileInfo.mimeType.includes('png')
        ? 'image/png'
        : fileInfo.mimeType.includes('webp')
        ? 'image/webp'
        : 'image/jpeg';
      let blob: Blob;
      let extension = originalExtension.toLowerCase();

      if (!needsCanvasProcessing) {
        blob = fileInfo.file;
        if (!extension) {
          extension = preferredMime.split('/')[1] ?? 'jpg';
        }
      } else {
        const canvas = await createProcessedCanvas();
        if (!canvas) {
          throw new Error('no-canvas');
        }
        const targetMime = preferredMime;
        extension = targetMime.includes('png')
          ? 'png'
          : targetMime.includes('webp')
          ? 'webp'
          : 'jpg';
        blob = await new Promise<Blob>((resolve, reject) => {
          const callback = (result: Blob | null) => {
            if (result) resolve(result);
            else reject(new Error('export-failed'));
          };
          if (targetMime === 'image/png') {
            canvas.toBlob(callback, 'image/png');
          } else if (targetMime === 'image/webp') {
            canvas.toBlob(callback, 'image/webp', jpegQuality);
          } else {
            canvas.toBlob(callback, 'image/jpeg', jpegQuality);
          }
        });
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      if (renameFile) {
        link.download = `photo-${safeSlug}.${extension || 'jpg'}`;
      } else if (needsCanvasProcessing) {
        const baseName = fileInfo.file.name.replace(/\.[^/.]+$/, '');
        link.download = `${baseName}.cleaned.${extension || 'jpg'}`;
      } else {
        link.download = fileInfo.file.name;
      }
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(link.href);
        document.body.removeChild(link);
      }, 2000);
      setNotice({ type: 'success', message: t('downloadReady') });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: t('cleanupFailed') });
    } finally {
      setProcessing(false);
    }
  }, [
    fileInfo,
    hasAnyChange,
    needsCanvasProcessing,
    renameFile,
    renameSlug,
    createProcessedCanvas,
    jpegQuality,
    t
  ]);

  const handleReset = useCallback(() => {
    reset();
    setManualCoords(null);
    setRemoveMetadata(true);
    setRenameFile(false);
    setRenameSlug(createRandomId());
    setBlurFaces(false);
    setBlurStrength(blurDefault);
    setManualMasks([]);
    setAntiSearchEnabled(false);
    setAntiSearchStrength(1);
    setAntiSearchParams(null);
    setGrayscale(false);
    setWatermark(false);
    setProcessing(false);
    setNotice(null);
    setJpegQuality(qualityDefault);
    setPreviewDataUrl(null);
    setPreviewLoading(false);
    setEstimatedSize(null);
  }, [reset]);

  useEffect(() => {
    if (!fileInfo) {
      setPreviewDataUrl(null);
      setPreviewLoading(false);
      setEstimatedSize(null);
      return;
    }

    if (!needsCanvasProcessing) {
      setPreviewDataUrl(fileInfo.dataUrl);
      setEstimatedSize(fileInfo.sizeBytes);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    createProcessedCanvas()
      .then((canvas) => {
        if (!canvas || cancelled) {
          return;
        }
        const targetMime = fileInfo.mimeType.includes('png')
          ? 'image/png'
          : fileInfo.mimeType.includes('webp')
          ? 'image/webp'
          : 'image/jpeg';
        const quality = targetMime === 'image/jpeg' || targetMime === 'image/webp' ? jpegQuality : undefined;
        const dataUrl = canvas.toDataURL(targetMime, quality);
        if (!cancelled) {
          setPreviewDataUrl(dataUrl);
          setEstimatedSize(estimateDataUrlBytes(dataUrl));
        }
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
    };
  }, [fileInfo, needsCanvasProcessing, jpegQuality, createProcessedCanvas]);

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
        metadataFieldCount={metadataFieldCount}
        detections={detections}
        removeMetadata={removeMetadata}
        setRemoveMetadata={setRemoveMetadata}
        renameFile={renameFile}
        onRenameChange={handleRenameToggle}
        renamePreviewName={renamePreviewName}
        targetExtension={targetExtension}
        blurFaces={blurFaces}
        setBlurFaces={setBlurFaces}
        blurStrength={blurStrength}
        setBlurStrength={setBlurStrength}
        manualMasks={manualMasks}
        onAddManualMask={handleAddMask}
        onRemoveManualMask={handleRemoveMask}
        onClearManualMasks={handleClearMasks}
        antiSearchEnabled={antiSearchEnabled}
        antiSearchStrength={antiSearchStrength}
        onAntiSearchChange={handleAntiSearchToggle}
        onAntiSearchStrengthChange={handleAntiSearchStrengthChange}
        grayscale={grayscale}
        setGrayscale={setGrayscale}
        watermark={watermark}
        setWatermark={setWatermark}
        jpegQuality={jpegQuality}
        setJpegQuality={setJpegQuality}
        onClean={handleDownload}
        processing={processing}
        previewDataUrl={previewDataUrl}
        previewLoading={previewLoading}
        estimatedSize={estimatedSize}
        estimatedResolution={estimatedResolution}
        hasAnyChange={hasAnyChange}
        manualMaskCount={manualMasks.length}
        applyPreset={applyPreset}
        originalFileName={fileInfo?.file.name ?? ''}
        originalSize={fileInfo?.sizeBytes ?? null}
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
