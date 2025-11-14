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
import type {
  AntiSearchParams,
  CleanupPreviewDimensions,
  ManualMask,
  PrivacyLevel,
  PrivacyPresetId
} from './types/cleanup';
import {
  applyAntiSearch,
  applyColorReduction,
  applyWatermark,
  blurDetections,
  blurManualMasks,
  generateAntiSearchParams
} from './utils/cleanup';

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

function createAnonymisedName(extension: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `photo-${random}.${extension}`;
}

function computePrivacyLevel(score: number): PrivacyLevel {
  if (score >= 6) {
    return 'high';
  }
  if (score >= 3) {
    return 'medium';
  }
  return 'low';
}

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
  const [blurFaces, setBlurFaces] = useState(false);
  const [blurStrength, setBlurStrength] = useState(blurDefault);
  const [jpegQuality, setJpegQuality] = useState(qualityDefault);
  const [renameFile, setRenameFile] = useState(false);
  const [manualMaskMode, setManualMaskMode] = useState(false);
  const [manualMasks, setManualMasks] = useState<ManualMask[]>([]);
  const [antiSearchEnabled, setAntiSearchEnabled] = useState(false);
  const [antiSearchLevel, setAntiSearchLevel] = useState(1);
  const [antiSearchParams, setAntiSearchParams] = useState<AntiSearchParams | null>(null);
  const [reduceColor, setReduceColor] = useState(false);
  const [watermark, setWatermark] = useState(false);
  const [activePreset, setActivePreset] = useState<PrivacyPresetId | null>(null);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<CleanupPreviewDimensions | null>(null);

  const personDetections = useMemo(
    () => detections.filter((det) => det.label === 'person'),
    [detections]
  );

  useEffect(() => {
    if (antiSearchEnabled) {
      setAntiSearchParams((prev) => {
        if (prev && prev.level === antiSearchLevel) {
          return prev;
        }
        return generateAntiSearchParams(antiSearchLevel);
      });
    } else {
      setAntiSearchParams(null);
    }
  }, [antiSearchEnabled, antiSearchLevel]);

  const handleFile = useCallback(
    async (file: File) => {
      setManualCoords(null);
      setRemoveMetadata(true);
      setBlurFaces(false);
      setBlurStrength(blurDefault);
      setNotice(null);
      setJpegQuality(qualityDefault);
      setPreviewDataUrl(null);
      setPreviewLoading(true);
      setEstimatedSize(null);
      setRenameFile(false);
      setManualMasks([]);
      setManualMaskMode(false);
      setAntiSearchEnabled(false);
      setAntiSearchLevel(1);
      setAntiSearchParams(null);
      setReduceColor(false);
      setWatermark(false);
      setActivePreset(null);
      setPreviewDimensions(null);
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
    const ctx = baseCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas');
    }
    ctx.drawImage(image, 0, 0, baseCanvas.width, baseCanvas.height);

    if (blurFaces && personDetections.length > 0) {
      blurDetections(ctx, image, personDetections, blurStrength);
    }

    if (manualMasks.length > 0) {
      blurManualMasks(ctx, image, manualMasks, blurStrength);
    }

    let workingCanvas = baseCanvas;

    if (antiSearchEnabled && antiSearchParams) {
      workingCanvas = applyAntiSearch(workingCanvas, antiSearchParams);
    }

    if (reduceColor) {
      workingCanvas = applyColorReduction(workingCanvas);
    }

    if (watermark) {
      workingCanvas = applyWatermark(workingCanvas, t('watermarkText'));
    }

    return workingCanvas;
  }, [
    fileInfo,
    blurFaces,
    personDetections,
    blurStrength,
    manualMasks,
    antiSearchEnabled,
    antiSearchParams,
    reduceColor,
    watermark,
    t
  ]);

  const handleDownload = useCallback(async () => {
    if (!fileInfo) {
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
      const fallbackName = `${fileInfo.file.name.replace(/\.[^/.]+$/, '')}.cleaned.${extension}`;
      link.download = renameFile ? createAnonymisedName(extension) : fallbackName;
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
    createProcessedCanvas,
    jpegQuality,
    renameFile,
    t
  ]);

  const handleReset = useCallback(() => {
    reset();
    setManualCoords(null);
    setRemoveMetadata(true);
    setBlurFaces(false);
    setBlurStrength(blurDefault);
    setProcessing(false);
    setNotice(null);
    setJpegQuality(qualityDefault);
    setPreviewDataUrl(null);
    setPreviewLoading(false);
    setEstimatedSize(null);
    setRenameFile(false);
    setManualMaskMode(false);
    setManualMasks([]);
    setAntiSearchEnabled(false);
    setAntiSearchLevel(1);
    setAntiSearchParams(null);
    setReduceColor(false);
    setWatermark(false);
    setActivePreset(null);
    setPreviewDimensions(null);
  }, [reset]);

  useEffect(() => {
    if (!fileInfo) {
      setPreviewDataUrl(null);
      setPreviewLoading(false);
      setEstimatedSize(null);
      setPreviewDimensions(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    createProcessedCanvas()
      .then((canvas) => {
        if (!canvas || cancelled) {
          return;
        }
        const mime = fileInfo.mimeType.includes('png') ? 'image/png' : 'image/jpeg';
        const quality = mime === 'image/jpeg' ? jpegQuality : undefined;
        const dataUrl = canvas.toDataURL(mime, quality);
        if (!cancelled) {
          setPreviewDataUrl(dataUrl);
          setEstimatedSize(estimateDataUrlBytes(dataUrl));
          setPreviewDimensions({ width: canvas.width, height: canvas.height });
        }
      })
      .catch((err) => {
        console.error('cleanup-preview', err);
        if (!cancelled) {
          setPreviewDataUrl(null);
          setEstimatedSize(null);
          setPreviewDimensions(null);
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
  }, [fileInfo, blurFaces, jpegQuality, createProcessedCanvas]);

  const handleManualMaskAdd = useCallback((mask: Omit<ManualMask, 'id'>) => {
    setManualMasks((current) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return [...current, { id, ...mask }];
    });
  }, []);

  const handleManualMaskRemove = useCallback((id: string) => {
    setManualMasks((current) => current.filter((mask) => mask.id !== id));
  }, []);

  const handleManualMaskClear = useCallback(() => {
    setManualMasks([]);
  }, []);

  const applyPreset = useCallback(
    (preset: PrivacyPresetId) => {
      setActivePreset(preset);
      switch (preset) {
        case 'minimal':
          setRemoveMetadata(true);
          setRenameFile(true);
          setBlurFaces(false);
          setBlurStrength(blurDefault);
          setManualMaskMode(false);
          setAntiSearchEnabled(false);
          setAntiSearchLevel(1);
          setReduceColor(false);
          setWatermark(false);
          setJpegQuality(0.92);
          break;
        case 'balanced':
          setRemoveMetadata(true);
          setRenameFile(true);
          setBlurFaces(true);
          setBlurStrength(blurDefault);
          setManualMaskMode(false);
          setAntiSearchEnabled(true);
          setAntiSearchLevel(1);
          setReduceColor(false);
          setWatermark(false);
          setJpegQuality(0.9);
          break;
        case 'maximal':
          setRemoveMetadata(true);
          setRenameFile(true);
          setBlurFaces(true);
          setBlurStrength(36);
          setManualMaskMode(false);
          setAntiSearchEnabled(true);
          setAntiSearchLevel(3);
          setReduceColor(true);
          setWatermark(true);
          setJpegQuality(0.85);
          break;
        default:
          break;
      }
    },
    []
  );

  const privacyScore = useMemo(() => {
    let score = 0;
    if (removeMetadata) score += 2;
    if (blurFaces && personDetections.length > 0) score += 2;
    if (manualMasks.length > 0) score += 2;
    if (antiSearchEnabled) score += 1 + antiSearchLevel * 0.5;
    if (renameFile) score += 1;
    if (reduceColor) score += 1;
    if (watermark) score += 0.5;
    return score;
  }, [
    removeMetadata,
    blurFaces,
    personDetections.length,
    manualMasks.length,
    antiSearchEnabled,
    antiSearchLevel,
    renameFile,
    reduceColor,
    watermark
  ]);

  const privacyLevel = useMemo(() => computePrivacyLevel(privacyScore), [privacyScore]);

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
        removeMetadata={removeMetadata}
        blurFaces={blurFaces}
        blurStrength={blurStrength}
        jpegQuality={jpegQuality}
        renameFile={renameFile}
        manualMaskMode={manualMaskMode}
        manualMasks={manualMasks}
        antiSearchEnabled={antiSearchEnabled}
        antiSearchLevel={antiSearchLevel}
        reduceColor={reduceColor}
        watermark={watermark}
        activePreset={activePreset}
        privacyLevel={privacyLevel}
        previewDimensions={previewDimensions}
        setRemoveMetadata={setRemoveMetadata}
        setBlurFaces={setBlurFaces}
        setBlurStrength={setBlurStrength}
        setJpegQuality={setJpegQuality}
        setRenameFile={setRenameFile}
        setManualMaskMode={setManualMaskMode}
        onManualMaskAdd={handleManualMaskAdd}
        onManualMaskRemove={handleManualMaskRemove}
        onManualMaskClear={handleManualMaskClear}
        setAntiSearchEnabled={setAntiSearchEnabled}
        setAntiSearchLevel={setAntiSearchLevel}
        setReduceColor={setReduceColor}
        setWatermark={setWatermark}
        onApplyPreset={applyPreset}
        onClean={handleDownload}
        processing={processing}
        previewDataUrl={previewDataUrl}
        previewLoading={previewLoading}
        estimatedSize={estimatedSize}
        personDetections={personDetections}
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
