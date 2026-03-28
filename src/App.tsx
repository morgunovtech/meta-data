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
import { useOCR } from './hooks/useOCR';
import { OCRBlock } from './components/OCRBlock';
import type { ManualCoordinates } from './types/metadata';
import { useI18n, useT } from './i18n';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import type { AntiSearchParams, CleanupPreviewDimensions, ManualMask, QualityMode } from './types/cleanup';
import { ProfileBlock } from './components/ProfileBlock';
import { generateSceneNarrative } from './utils/sceneNarrative';
import { analyzeFilename } from './utils/heuristics/filenameAnalyzer';
import { analyzeResolution } from './utils/heuristics/resolutionAnalyzer';
import { detectStrippedMetadata } from './utils/heuristics/strippedDetector';
import { analyzeEditingHistory } from './utils/heuristics/editingHistory';
import { generateFileHash } from './utils/heuristics/hashAnalyzer';
import { analyzeDateTime } from './utils/heuristics/temporalAnalyzer';
import { generateDigitalProfile, type DigitalProfile } from './utils/heuristics/digitalProfile';
import type { FilenameAnalysis } from './utils/heuristics/filenameAnalyzer';
import type { ResolutionAnalysis } from './utils/heuristics/resolutionAnalyzer';
import type { StrippedAnalysis } from './utils/heuristics/strippedDetector';
import type { EditingAnalysis } from './utils/heuristics/editingHistory';
import type { HashResult } from './utils/heuristics/hashAnalyzer';
import type { TemporalInsight } from './utils/heuristics/temporalAnalyzer';

export interface ProData {
  filename: FilenameAnalysis;
  resolution: ResolutionAnalysis;
  stripped: StrippedAnalysis;
  editing: EditingAnalysis;
  hash: HashResult | null;
  temporal: TemporalInsight[];
}
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

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

const SEO_DESCRIPTIONS: Record<string, string> = {
  ru: 'Бесплатный онлайн-инструмент для анализа и удаления метаданных из фотографий. EXIF, GPS, OCR, детекция лиц — всё локально в браузере.',
  en: 'Free browser-based tool to analyze and remove photo metadata. EXIF, GPS, OCR, face detection — all processed locally, nothing uploaded.',
  uz: 'Fotosuratlar metama\'lumotlarini tahlil qilish va olib tashlash uchun bepul vosita. EXIF, GPS, OCR — hammasi brauzerda ishlaydi.',
};

const SEO_TITLES: Record<string, string> = {
  ru: 'Found You — Анализ метаданных фото',
  en: 'Found You — Photo Metadata Analyzer',
  uz: 'Found You — Foto metadata tahlili',
};

const App: React.FC = () => {
  const t = useT();
  const { lang } = useI18n();

  // Update document title and meta description on language change
  useEffect(() => {
    document.title = SEO_TITLES[lang] ?? SEO_TITLES.ru;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', SEO_DESCRIPTIONS[lang] ?? SEO_DESCRIPTIONS.ru);
    }
  }, [lang]);
  const { fileInfo, error, loading, processFile } = useImageFile();
  const { metadata } = useExifMetadata(fileInfo);
  const { loading: analysisLoading, error: analysisError, detectionStatus, detections, summary: analysisSummary } =
    useImageAnalysis(fileInfo);
  const { loading: ocrLoading, error: ocrError, result: ocrResult, progress: ocrProgress } = useOCR(fileInfo);

  const [digitalProfile, setDigitalProfile] = useState<DigitalProfile | null>(null);
  const [proData, setProData] = useState<ProData | null>(null);

  // Compute digital profile when analysis completes
  useEffect(() => {
    if (!fileInfo) { setDigitalProfile(null); setProData(null); return; }
    if (analysisLoading || ocrLoading) return;

    let cancelled = false;
    (async () => {
      const originalName = fileInfo.originalName ?? fileInfo.file.name;
      const filenameResult = analyzeFilename(originalName, lang);
      const resolutionResult = analyzeResolution(fileInfo.width, fileInfo.height, lang);
      const exif = metadata?.groups?.exif ?? {};
      const xmp = metadata?.groups?.xmp ?? {};
      const editingResult = analyzeEditingHistory(exif, xmp, lang);
      const strippedResult = detectStrippedMetadata({
        filename: originalName,
        filenameAnalysis: filenameResult,
        mimeType: fileInfo.mimeType,
        width: fileInfo.width,
        height: fileInfo.height,
        hasExif: Object.keys(exif).length > 2,
        hasSoftwareTag: !!(exif.Software ?? exif.software ?? xmp.CreatorTool ?? xmp.creatorTool),
        lang,
      });
      const temporalResult = analyzeDateTime(metadata?.shotDate, lang);
      const hashResult = await generateFileHash(fileInfo.originalFile ?? fileInfo.file);

      if (cancelled) return;

      const profile = generateDigitalProfile({
        filename: filenameResult,
        resolution: resolutionResult,
        stripped: strippedResult,
        editing: editingResult,
        hash: hashResult,
        temporal: temporalResult,
        metadata: metadata ?? null,
        detections,
        ocrResult: ocrResult ?? null,
        originalFilename: originalName,
        lang,
      });
      setDigitalProfile(profile);
      setProData({ filename: filenameResult, resolution: resolutionResult, stripped: strippedResult, editing: editingResult, hash: hashResult, temporal: temporalResult });
    })();
    return () => { cancelled = true; };
  }, [fileInfo, metadata, detections, ocrResult, analysisLoading, ocrLoading, lang]);

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
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<CleanupPreviewDimensions | null>(null);
  const reduceColor = antiSearchEnabled && antiSearchLevel === 3;
  const prnuCleanup = removeMetadata;
  const watermark = watermarkEnabled;

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
      setWatermarkEnabled(false);
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
        points: mask.points.map((pt) => ({ x: pt.x * targetScale, y: pt.y * targetScale })),
        radius: mask.radius * targetScale
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
      const baseName = (fileInfo.originalName ?? fileInfo.file.name).replace(/\.[^/.]+$/, '');
      const fallbackName = `${baseName}.cleaned.${extension}`;
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
    const debounceTimer = setTimeout(() => {
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
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
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
    watermarkEnabled,
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

  const sceneDescription = useMemo(() => {
    if (analysisLoading) return t('sceneDescriptionLoading');
    if (analysisError) return t('sceneDescriptionUnavailable');
    if (!fileInfo || detections.length === 0) return t('sceneDescriptionEmpty');
    return generateSceneNarrative({
      detections,
      imageWidth: fileInfo.width,
      imageHeight: fileInfo.height,
      lang,
    });
  }, [analysisLoading, analysisError, fileInfo, detections, lang, t]);

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
              progress={
                analysisLoading && detectionStatus
                  ? { label: detectionStatus.label, value: detectionStatus.progress }
                  : null
              }
            />
          </div>
          <MetadataPanel fileInfo={fileInfo} metadata={metadata} />
        </div>
      ) : null}

      {fileInfo ? (
        <OCRBlock
          result={ocrResult}
          loading={ocrLoading}
          error={ocrError}
          progress={ocrProgress}
        />
      ) : null}

      {fileInfo && digitalProfile ? (
        <ProfileBlock
          profile={digitalProfile}
          lang={lang}
          metadata={metadata}
          proData={proData}
          fileInfo={fileInfo}
          detections={detections}
          ocrResult={ocrResult}
        />
      ) : null}

      {fileInfo ? (
        <ShockBlock
          metadata={metadata}
          manualCoords={manualCoords}
          onManualCoordsChange={setManualCoords}
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
        watermarkEnabled={watermarkEnabled}
        setWatermarkEnabled={setWatermarkEnabled}
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
