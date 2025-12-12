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
  PresetKey,
  PrivacyLevel,
  PrivacyScores,
  QualityMode
} from './types/cleanup';
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
const PREVIEW_MAX_DIMENSION = 2400;

const presetConfig: Record<Exclude<PresetKey, 'none'>, {
  removeMetadata: boolean;
  blurFaces: boolean;
  antiSearchEnabled: boolean;
  antiSearchLevel: number;
  reduceColor: boolean;
  watermark: boolean;
  prnuCleanup: boolean;
  qualityMode: QualityMode;
  renameFile: boolean;
}> = {
  social: {
    removeMetadata: true,
    blurFaces: true,
    antiSearchEnabled: true,
    antiSearchLevel: 2,
    reduceColor: false,
    watermark: true,
    prnuCleanup: true,
    qualityMode: 'medium',
    renameFile: true
  },
  work: {
    removeMetadata: true,
    blurFaces: false,
    antiSearchEnabled: true,
    antiSearchLevel: 1,
    reduceColor: false,
    watermark: false,
    prnuCleanup: false,
    qualityMode: 'medium',
    renameFile: true
  },
  proof: {
    removeMetadata: true,
    blurFaces: false,
    antiSearchEnabled: false,
    antiSearchLevel: 1,
    reduceColor: false,
    watermark: false,
    prnuCleanup: false,
    qualityMode: 'original',
    renameFile: false
  },
  personal: {
    removeMetadata: true,
    blurFaces: true,
    antiSearchEnabled: true,
    antiSearchLevel: 2,
    reduceColor: false,
    watermark: false,
    prnuCleanup: true,
    qualityMode: 'medium',
    renameFile: true
  }
};

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
  if (score >= 75) {
    return 'high';
  }
  if (score >= 45) {
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

function scoreFromRisk(risk: number): number {
  const bounded = Math.min(1, Math.max(0, risk));
  return Math.round((1 - bounded) * 100);
}

const App: React.FC = () => {
  const t = useT();
  const { fileInfo, error, loading, processFile } = useImageFile();
  const { metadata } = useExifMetadata(fileInfo);
  const {
    loading: analysisLoading,
    error: analysisError,
    ocrStatus,
    detections,
    summary: analysisSummary
  } = useImageAnalysis(fileInfo);

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
  const [antiSearchLevel, setAntiSearchLevel] = useState(2);
  const [antiSearchParams, setAntiSearchParams] = useState<AntiSearchParams | null>(null);
  const [reduceColor, setReduceColor] = useState(false);
  const [watermark, setWatermark] = useState(false);
  const [prnuCleanup, setPrnuCleanup] = useState(false);
  const [preset, setPreset] = useState<PresetKey>('none');
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
      setAntiSearchParams(generateAntiSearchParams({ level: antiSearchLevel }));
    } else {
      setAntiSearchParams(null);
    }
  }, [antiSearchEnabled, antiSearchLevel]);

  useEffect(() => {
    if (preset === 'none') return;
    const config = presetConfig[preset];
    if (
      config.removeMetadata !== removeMetadata ||
      config.blurFaces !== blurFaces ||
      config.antiSearchEnabled !== antiSearchEnabled ||
      config.antiSearchLevel !== antiSearchLevel ||
      config.reduceColor !== reduceColor ||
      config.watermark !== watermark ||
      config.prnuCleanup !== prnuCleanup ||
      config.qualityMode !== qualityMode ||
      config.renameFile !== renameFile
    ) {
      setPreset('none');
    }
  }, [
    antiSearchEnabled,
    antiSearchLevel,
    blurFaces,
    preset,
    prnuCleanup,
    qualityMode,
    reduceColor,
    removeMetadata,
    renameFile,
    watermark
  ]);

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
      setAntiSearchLevel(2);
      setReduceColor(false);
      setWatermark(false);
      setPrnuCleanup(false);
      setPreset('none');
      setPreviewDimensions(null);
      await processFile(file);
    },
    [processFile]
  );

  const createProcessedCanvas = useCallback(
    async (options?: { maxDimension?: number }) => {
      if (!fileInfo) return null;
      const longest = Math.max(fileInfo.width, fileInfo.height) || 1;
      const targetScale = options?.maxDimension ? Math.min(1, options.maxDimension / longest) : 1;
      const targetWidth = Math.max(1, Math.round(fileInfo.width * targetScale));
      const targetHeight = Math.max(1, Math.round(fileInfo.height * targetScale));

      const image = await loadImageElement(fileInfo.dataUrl);
      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = targetWidth;
      baseCanvas.height = targetHeight;
      const ctx = baseCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('canvas');
      }
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      const scaledDetections = personDetections.map((det) => ({
        ...det,
        x: det.x * targetScale,
        y: det.y * targetScale,
        width: det.width * targetScale,
        height: det.height * targetScale
      }));

      const scaledMasks = manualMasks.map((mask) => ({
        ...mask,
        x: mask.x * targetScale,
        y: mask.y * targetScale,
        width: mask.width * targetScale,
        height: mask.height * targetScale
      }));

      if (blurFaces && scaledDetections.length > 0) {
        blurDetections(ctx, baseCanvas, scaledDetections, blurStrength);
      }

      if (scaledMasks.length > 0) {
        blurManualMasks(ctx, baseCanvas, scaledMasks, blurStrength);
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
    },
    [
      fileInfo,
      blurFaces,
      personDetections,
      blurStrength,
      manualMasks,
      antiSearchEnabled,
      antiSearchParams,
      reduceColor,
      watermark,
      prnuCleanup,
      t
    ]
  );

  const handleDownload = useCallback(async () => {
    if (!fileInfo) {
      return;
    }
    setProcessing(true);
    setNotice(null);
    try {
      if (import.meta.env.DEV) {
        console.info('[pipeline] export:start', { mime: fileInfo.mimeType, qualityMode });
      }
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
      if (import.meta.env.DEV) {
        console.info('[pipeline] export:done');
      }
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
    const longestSide = Math.max(fileInfo.width, fileInfo.height) || 1;
    const previewScale = Math.min(1, PREVIEW_MAX_DIMENSION / longestSide);
    createProcessedCanvas({ maxDimension: PREVIEW_MAX_DIMENSION })
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
          setPreviewDimensions({
            width: Math.round(canvas.width / previewScale),
            height: Math.round(canvas.height / previewScale)
          });
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

  const applyPreset = useCallback(
    (key: PresetKey) => {
      setPreset(key);
      if (key === 'none') return;
      const config = presetConfig[key];
      setRemoveMetadata(config.removeMetadata);
      setBlurFaces(config.blurFaces);
      setAntiSearchEnabled(config.antiSearchEnabled);
      setAntiSearchLevel(config.antiSearchLevel);
      setReduceColor(config.reduceColor);
      setWatermark(config.watermark);
      setPrnuCleanup(config.prnuCleanup);
      setQualityMode(config.qualityMode);
      setRenameFile(config.renameFile);
    },
    []
  );

  const applySafetyRecommendations = useCallback(() => {
    setPreset('none');
    setRemoveMetadata(true);
    setRenameFile(true);
    if (personDetections.length > 0) {
      setBlurFaces(true);
    }
    setAntiSearchEnabled(true);
    setAntiSearchLevel((current) => Math.max(2, current));
    setPrnuCleanup(true);
  }, [personDetections.length]);


  const privacyScores = useMemo<PrivacyScores>(() => {
    const hasGps = Boolean(metadata?.gps);
    const hasTime = Boolean(metadata?.shotDate);
    const hasFaces = personDetections.length > 0;
    const hasText = Boolean(analysisSummary?.ocrTexts && analysisSummary.ocrTexts.length > 0);
    const hasDevice = Boolean(metadata?.cameraMake || metadata?.cameraModel || metadata?.lensModel || metadata?.software);

    const locationRisk = hasGps ? 0.7 : 0.2;
    const timeRisk = hasTime ? 0.45 : 0.15;
    const idRisk = hasFaces || hasText ? 0.65 : 0.25;
    const deviceRisk = hasDevice ? 0.55 : 0.2;
    const searchRisk = 0.5;

    const categories = [
      {
        id: 'location' as const,
        score: scoreFromRisk(locationRisk * (removeMetadata ? 0.35 : 1))
      },
      {
        id: 'time' as const,
        score: scoreFromRisk(timeRisk * (removeMetadata ? 0.4 : 1))
      },
      {
        id: 'identification' as const,
        score: scoreFromRisk(
          idRisk * (blurFaces || manualMasks.length > 0 ? 0.35 : 1) * (antiSearchEnabled ? 0.8 : 1)
        )
      },
      {
        id: 'device' as const,
        score: scoreFromRisk(deviceRisk * (removeMetadata ? 0.45 : 1) * (renameFile ? 0.8 : 1))
      },
      {
        id: 'search' as const,
        score: scoreFromRisk(searchRisk * (antiSearchEnabled ? 0.35 : 1) * (prnuCleanup ? 0.85 : 1))
      }
    ];

    const overall = Math.round(
      categories.reduce((acc, item) => acc + item.score, 0) / (categories.length || 1)
    );

    return { overall, categories };
  }, [
    analysisSummary?.ocrTexts,
    antiSearchEnabled,
    manualMasks.length,
    metadata?.cameraMake,
    metadata?.cameraModel,
    metadata?.gps,
    metadata?.lensModel,
    metadata?.software,
    metadata?.shotDate,
    personDetections.length,
    prnuCleanup,
    removeMetadata,
    renameFile
  ]);

  const privacyLevel = useMemo(() => computePrivacyLevel(privacyScores.overall), [privacyScores.overall]);

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
            <PreviewViewer
              fileInfo={fileInfo}
              detections={detections}
              sceneDescription={sceneDescription}
              statusNote={ocrStatus ?? undefined}
            />
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
        antiSearchLevel={antiSearchLevel}
        setAntiSearchLevel={setAntiSearchLevel}
        setReduceColor={setReduceColor}
        setWatermark={setWatermark}
        setPrnuCleanup={setPrnuCleanup}
        preset={preset}
        onPresetChange={applyPreset}
        privacyScores={privacyScores}
        onApplyRecommendation={applySafetyRecommendations}
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
