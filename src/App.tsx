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
import type { AntiSearchParams, CleanupPreviewDimensions, ManualMask, PrivacyLevel, QualityMode } from './types/cleanup';
import {
  applyAntiSearch,
  applyColorReduction,
  applyPrnuCleanup,
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

const blurDefault = 28;

function qualityForMode(mode: QualityMode): number {
  switch (mode) {
    case 'low':
      return 0.82;
    case 'medium':
      return 0.9;
    case 'original':
    default:
      return 0.98;
  }
}

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
  const { fileInfo, error, loading, processFile } = useImageFile();
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
  const [qualityMode, setQualityMode] = useState<QualityMode>('medium');
  const [renameFile, setRenameFile] = useState(false);
  const [manualMaskMode, setManualMaskMode] = useState(false);
  const [manualMasks, setManualMasks] = useState<ManualMask[]>([]);
  const [antiSearchEnabled, setAntiSearchEnabled] = useState(false);
  const [antiSearchParams, setAntiSearchParams] = useState<AntiSearchParams | null>(null);
  const [reduceColor, setReduceColor] = useState(false);
  const [watermark, setWatermark] = useState(false);
  const [prnuCleanup, setPrnuCleanup] = useState(false);
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
      setAntiSearchParams(generateAntiSearchParams({ level: 3 }));
    } else {
      setAntiSearchParams(null);
    }
  }, [antiSearchEnabled]);

  const handleFile = useCallback(
    async (file: File) => {
      setManualCoords(null);
      setRemoveMetadata(true);
      setBlurFaces(false);
      setBlurStrength(blurDefault);
      setNotice(null);
      setQualityMode('medium');
      setPreviewDataUrl(null);
      setPreviewLoading(true);
      setEstimatedSize(null);
      setRenameFile(false);
      setManualMasks([]);
      setManualMaskMode(false);
      setAntiSearchEnabled(false);
      setAntiSearchParams(null);
      setReduceColor(false);
      setWatermark(false);
      setPrnuCleanup(false);
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

    if (prnuCleanup) {
      workingCanvas = applyPrnuCleanup(workingCanvas);
    }

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
      const jpegQuality = qualityForMode(qualityMode);
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
  }, [fileInfo, createProcessedCanvas, qualityMode, renameFile, t]);

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
        const quality = mime === 'image/jpeg' ? qualityForMode(qualityMode) : undefined;
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
  }, [
    fileInfo,
    blurFaces,
    manualMasks,
    blurStrength,
    antiSearchEnabled,
    antiSearchParams,
    reduceColor,
    watermark,
    prnuCleanup,
    qualityMode,
    createProcessedCanvas
  ]);

  const handleManualMaskAdd = useCallback((mask: Omit<ManualMask, 'id'>) => {
    setManualMasks((current) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return [...current, { id, ...mask }];
    });
  }, []);

  const handleManualMaskRemove = useCallback((id: string) => {
    setManualMasks((current) => current.filter((mask) => mask.id !== id));
  }, []);


  const privacyScore = useMemo(() => {
    let score = 0;
    if (removeMetadata) score += 2;
    if (blurFaces && personDetections.length > 0) score += 2;
    if (manualMasks.length > 0) score += 2;
    if (antiSearchEnabled) score += 3;
    if (renameFile) score += 1;
    if (reduceColor) score += 1;
    if (watermark) score += 0.5;
    if (prnuCleanup) score += 1.5;
    if (qualityMode !== 'original') score += 1;
    return score;
  }, [
    removeMetadata,
    blurFaces,
    personDetections.length,
    manualMasks.length,
    antiSearchEnabled,
    renameFile,
    reduceColor,
    watermark,
    prnuCleanup,
    qualityMode
  ]);

  const privacyLevel = useMemo(() => computePrivacyLevel(privacyScore), [privacyScore]);

  const sceneDescription = useMemo(() => {
    if (!analysisSummary) {
      if (analysisLoading) return t('sceneDescriptionLoading');
      if (analysisError) return t('sceneDescriptionUnavailable');
      return t('sceneDescriptionEmpty');
    }
    const segments: string[] = [];
    if (analysisSummary.people > 0) {
      segments.push(t('sceneDescriptionPeople', { count: analysisSummary.people }));
    }
    if (analysisSummary.vehicles > 0) {
      segments.push(t('sceneDescriptionVehicles', { count: analysisSummary.vehicles }));
    }
    if (analysisSummary.animals > 0) {
      segments.push(t('sceneDescriptionAnimals', { count: analysisSummary.animals }));
    }
    if (analysisSummary.ocrTexts && analysisSummary.ocrTexts.length > 0) {
      const joined = analysisSummary.ocrTexts.slice(0, 3).join(' • ');
      segments.push(t('sceneDescriptionText', { text: joined }));
    }
    if (segments.length === 0) {
      return t('sceneDescriptionEmpty');
    }
    return t('sceneDescriptionDetected', { items: segments.join('; ') });
  }, [analysisSummary, analysisLoading, analysisError, t]);

  return (
    <div className="app-shell">
      <header className="title-row">
        <div className="title-row__group">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>
      <div className="intro-grid">
        <InfoBlock />
        <UploadZone loading={loading} onFile={handleFile} error={error ?? undefined} />
      </div>

      {fileInfo ? (
        <div className="grid-two-column">
          <div className="panel">
            <PreviewViewer fileInfo={fileInfo} detections={detections} sceneDescription={sceneDescription} />
          </div>
          <MetadataPanel fileInfo={fileInfo} metadata={metadata} />
        </div>
      ) : null}

      {fileInfo ? (
        <ShockBlock
          metadata={metadata}
          manualCoords={manualCoords}
          onManualCoordsChange={setManualCoords}
          imageDataUrl={fileInfo.dataUrl}
        />
      ) : null}

      <CleanupDownloadBlock
        fileInfo={fileInfo}
        removeMetadata={removeMetadata}
        blurFaces={blurFaces}
        blurStrength={blurStrength}
        qualityMode={qualityMode}
        renameFile={renameFile}
        manualMaskMode={manualMaskMode}
        manualMasks={manualMasks}
        antiSearchEnabled={antiSearchEnabled}
        reduceColor={reduceColor}
        watermark={watermark}
        prnuCleanup={prnuCleanup}
        privacyLevel={privacyLevel}
        previewDimensions={previewDimensions}
        setRemoveMetadata={setRemoveMetadata}
        setBlurFaces={setBlurFaces}
        setBlurStrength={setBlurStrength}
        setQualityMode={setQualityMode}
        setRenameFile={setRenameFile}
        setManualMaskMode={setManualMaskMode}
        onManualMaskAdd={handleManualMaskAdd}
        onManualMaskRemove={handleManualMaskRemove}
        setAntiSearchEnabled={setAntiSearchEnabled}
        setReduceColor={setReduceColor}
        setWatermark={setWatermark}
        setPrnuCleanup={setPrnuCleanup}
        onClean={handleDownload}
        processing={processing}
        previewDataUrl={previewDataUrl}
        previewLoading={previewLoading}
        estimatedSize={estimatedSize}
        personDetections={personDetections}
        originalPreviewUrl={fileInfo?.thumbnailUrl ?? null}
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
