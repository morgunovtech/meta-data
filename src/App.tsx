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
import type { CleanupOptions, ManualMaskRegion, CleanupPresetConfig } from './types/cleanup';
import { stripImageMetadata, generateAnonFileName } from './utils/stripMetadata';
import { createSeededRandom } from './utils/random';

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

const qualityDefault = 1;
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
  const [blurFaces, setBlurFaces] = useState(false);
  const [blurStrength, setBlurStrength] = useState(blurDefault);
  const [jpegQuality, setJpegQuality] = useState(qualityDefault);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [renameFile, setRenameFile] = useState(false);
  const [renameSeed, setRenameSeed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  const [antiSearchEnabled, setAntiSearchEnabled] = useState(false);
  const [antiSearchIntensity, setAntiSearchIntensity] = useState(1);
  const [antiSearchSeed, setAntiSearchSeed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  const [manualMaskEnabled, setManualMaskEnabled] = useState(false);
  const [manualMasks, setManualMasks] = useState<ManualMaskRegion[]>([]);
  const [reduceColor, setReduceColor] = useState(false);
  const [watermark, setWatermark] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [processedDimensions, setProcessedDimensions] = useState<{ width: number; height: number } | null>(null);

  const personDetections = useMemo(
    () => detections.filter((det) => det.label === 'person'),
    [detections]
  );

  const cleanupOptions: CleanupOptions = useMemo(
    () => ({
      removeMetadata,
      blurFaces,
      blurStrength,
      manualMaskEnabled,
      manualMasks,
      antiSearch: { enabled: antiSearchEnabled, intensity: antiSearchIntensity, seed: antiSearchSeed },
      reduceColor,
      watermark,
      renameFile
    }),
    [
      removeMetadata,
      blurFaces,
      blurStrength,
      manualMaskEnabled,
      manualMasks,
      antiSearchEnabled,
      antiSearchIntensity,
      antiSearchSeed,
      reduceColor,
      watermark,
      renameFile
    ]
  );

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
      setRenameSeed(Math.floor(Math.random() * 0xffffffff));
      setAntiSearchEnabled(false);
      setAntiSearchIntensity(1);
      setAntiSearchSeed(Math.floor(Math.random() * 0xffffffff));
      setManualMaskEnabled(false);
      setManualMasks([]);
      setReduceColor(false);
      setWatermark(false);
      setActivePreset(null);
      setProcessedDimensions(null);
      await processFile(file);
    },
    [processFile]
  );

  const createProcessedCanvas = useCallback(async () => {
    if (!fileInfo) return null;

    const image = await loadImageElement(fileInfo.dataUrl);
    let canvas = document.createElement('canvas');
    canvas.width = fileInfo.width;
    canvas.height = fileInfo.height;
    let ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas');
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const applyBlurRegion = (x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();
      ctx.filter = `blur(${Math.round(cleanupOptions.blurStrength)}px)`;
      ctx.drawImage(image, x, y, width, height, x, y, width, height);
      ctx.filter = 'none';
      ctx.restore();
    };

    if (cleanupOptions.blurFaces && personDetections.length > 0) {
      personDetections.forEach((det) => {
        const pad = Math.max(det.width, det.height) * 0.08;
        const faceWidth = det.width * 0.55;
        const faceHeight = det.height * 0.45;
        const centerX = det.x + det.width / 2;
        const faceX = centerX - faceWidth / 2;
        const x = Math.max(0, Math.min(canvas.width, faceX - pad));
        const y = Math.max(0, Math.min(canvas.height, det.y - pad * 0.6));
        const width = Math.min(canvas.width - x, faceWidth + pad * 2);
        const height = Math.min(canvas.height - y, faceHeight + pad * 1.5);
        applyBlurRegion(x, y, width, height);
      });
    }

    if (cleanupOptions.manualMaskEnabled && cleanupOptions.manualMasks.length > 0) {
      cleanupOptions.manualMasks.forEach((mask) => {
        const x = Math.max(0, mask.x * canvas.width);
        const y = Math.max(0, mask.y * canvas.height);
        const width = Math.max(0, Math.min(canvas.width - x, mask.width * canvas.width));
        const height = Math.max(0, Math.min(canvas.height - y, mask.height * canvas.height));
        applyBlurRegion(x, y, width, height);
      });
    }

    if (cleanupOptions.antiSearch.enabled && cleanupOptions.antiSearch.intensity > 0) {
      const rng = createSeededRandom(cleanupOptions.antiSearch.seed + cleanupOptions.antiSearch.intensity);
      const margin = Math.min(
        3,
        Math.max(
          1,
          Math.round(cleanupOptions.antiSearch.intensity + rng())
        ),
        Math.floor(Math.min(canvas.width, canvas.height) / 10)
      );
      const cropWidth = Math.max(1, canvas.width - margin * 2);
      const cropHeight = Math.max(1, canvas.height - margin * 2);
      const cropped = document.createElement('canvas');
      cropped.width = cropWidth;
      cropped.height = cropHeight;
      const croppedCtx = cropped.getContext('2d');
      if (!croppedCtx) {
        throw new Error('canvas');
      }
      croppedCtx.drawImage(canvas, margin, margin, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      const rotationMax = 0.4 + cleanupOptions.antiSearch.intensity * 0.25;
      const rotation = ((rng() - 0.5) * 2 * rotationMax * Math.PI) / 180;

      const rotated = document.createElement('canvas');
      rotated.width = cropWidth;
      rotated.height = cropHeight;
      const rotatedCtx = rotated.getContext('2d');
      if (!rotatedCtx) {
        throw new Error('canvas');
      }
      rotatedCtx.translate(rotated.width / 2, rotated.height / 2);
      rotatedCtx.rotate(rotation);
      rotatedCtx.drawImage(cropped, -cropped.width / 2, -cropped.height / 2);
      rotatedCtx.setTransform(1, 0, 0, 1, 0, 0);
      const sample = croppedCtx.getImageData(
        Math.max(0, Math.min(cropWidth - 1, Math.floor(rng() * cropWidth))),
        Math.max(0, Math.min(cropHeight - 1, Math.floor(rng() * cropHeight))),
        1,
        1
      ).data;
      rotatedCtx.globalCompositeOperation = 'destination-over';
      rotatedCtx.fillStyle = `rgba(${sample[0]}, ${sample[1]}, ${sample[2]}, 1)`;
      rotatedCtx.fillRect(0, 0, rotated.width, rotated.height);
      rotatedCtx.globalCompositeOperation = 'source-over';

      const imageData = rotatedCtx.getImageData(0, 0, rotated.width, rotated.height);
      const { data } = imageData;
      const brightnessOffset = (rng() - 0.5) * cleanupOptions.antiSearch.intensity * 4;
      const contrastFactor = 1 + (rng() - 0.5) * cleanupOptions.antiSearch.intensity * 0.05;
      const noiseStrength = cleanupOptions.antiSearch.intensity * 1.8;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (rng() - 0.5) * noiseStrength;
        for (let channel = 0; channel < 3; channel += 1) {
          const value = data[i + channel];
          const contrasted = (value - 128) * contrastFactor + 128 + brightnessOffset + noise;
          data[i + channel] = Math.max(0, Math.min(255, contrasted));
        }
      }
      rotatedCtx.putImageData(imageData, 0, 0);

      canvas = rotated;
      ctx = rotatedCtx;
    }

    if (cleanupOptions.reduceColor) {
      const colorData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = colorData;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      ctx.putImageData(colorData, 0, 0);
    }

    if (cleanupOptions.watermark) {
      const watermarkText = t('watermarkText');
      ctx.save();
      ctx.font = `${Math.max(12, Math.round(canvas.width * 0.018))}px/1.4 "Inter", "Segoe UI", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      const padding = Math.max(16, Math.round(canvas.width * 0.02));
      ctx.fillText(watermarkText, canvas.width - padding, canvas.height - padding);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeText(watermarkText, canvas.width - padding, canvas.height - padding);
      ctx.restore();
    }

    return canvas;
  }, [fileInfo, cleanupOptions, personDetections, t]);

  const handleDownload = useCallback(async () => {
    if (!fileInfo) {
      return;
    }

    const hasManualBlur = cleanupOptions.manualMaskEnabled && cleanupOptions.manualMasks.length > 0;
    const hasAntiSearch = cleanupOptions.antiSearch.enabled && cleanupOptions.antiSearch.intensity > 0;
    const hasPixelTransforms =
      cleanupOptions.blurFaces || hasManualBlur || hasAntiSearch || cleanupOptions.reduceColor || cleanupOptions.watermark;
    const qualityAdjusted =
      !fileInfo.mimeType.includes('png') && Math.abs(jpegQuality - 1) > 0.001;
    const needsCanvas = hasPixelTransforms || qualityAdjusted;

    setProcessing(true);
    setNotice(null);
    try {
      let outputBlob: Blob | null = null;
      let outputMime = fileInfo.mimeType;

      if (needsCanvas) {
        const canvas = await createProcessedCanvas();
        if (!canvas) {
          throw new Error('no-canvas');
        }
        if (fileInfo.mimeType.includes('png')) {
          outputMime = 'image/png';
        } else if (fileInfo.mimeType.includes('webp')) {
          outputMime = 'image/webp';
        } else {
          outputMime = 'image/jpeg';
        }
        outputBlob = await new Promise<Blob>((resolve, reject) => {
          const quality = outputMime === 'image/jpeg' || outputMime === 'image/webp' ? jpegQuality : undefined;
          canvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new Error('export-failed'));
            },
            outputMime,
            quality
          );
        });
        if (cleanupOptions.removeMetadata) {
          outputBlob = await stripImageMetadata(outputBlob, outputMime);
        }
      } else if (cleanupOptions.removeMetadata) {
        outputBlob = await stripImageMetadata(fileInfo.file, fileInfo.mimeType);
        outputMime = fileInfo.mimeType;
      } else {
        outputBlob = fileInfo.file;
        outputMime = fileInfo.mimeType;
      }

      if (!outputBlob) {
        throw new Error('no-blob');
      }

      const extension = outputMime.includes('png') ? 'png' : outputMime.includes('webp') ? 'webp' : 'jpg';
      const baseName = fileInfo.file.name.replace(/\.[^/.]+$/, '');
      const downloadName = cleanupOptions.renameFile
        ? generateAnonFileName(extension, renameSeed)
        : `${baseName}.cleaned.${extension}`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(outputBlob);
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(link.href);
        document.body.removeChild(link);
      }, 2000);
      if (cleanupOptions.renameFile) {
        setRenameSeed(Math.floor(Math.random() * 0xffffffff));
      }
      setNotice({ type: 'success', message: t('downloadReady') });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: t('cleanupFailed') });
    } finally {
      setProcessing(false);
    }
  }, [
    fileInfo,
    cleanupOptions,
    createProcessedCanvas,
    jpegQuality,
    renameSeed,
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
    setRenameSeed(Math.floor(Math.random() * 0xffffffff));
    setAntiSearchEnabled(false);
    setAntiSearchIntensity(1);
    setAntiSearchSeed(Math.floor(Math.random() * 0xffffffff));
    setManualMaskEnabled(false);
    setManualMasks([]);
    setReduceColor(false);
    setWatermark(false);
    setActivePreset(null);
    setProcessedDimensions(null);
  }, [reset]);

  const handlePresetApply = useCallback(
    (preset: CleanupPresetConfig) => {
      const opts = preset.options;
      if (typeof opts.removeMetadata === 'boolean') {
        setRemoveMetadata(opts.removeMetadata);
      }
      if (typeof opts.blurFaces === 'boolean') {
        setBlurFaces(opts.blurFaces);
      }
      if (typeof opts.blurStrength === 'number') {
        setBlurStrength(opts.blurStrength);
      }
      if (typeof opts.manualMaskEnabled === 'boolean') {
        setManualMaskEnabled(opts.manualMaskEnabled);
      }
      if (typeof opts.renameFile === 'boolean') {
        setRenameFile(opts.renameFile);
      }
      if (typeof opts.reduceColor === 'boolean') {
        setReduceColor(opts.reduceColor);
      }
      if (typeof opts.watermark === 'boolean') {
        setWatermark(opts.watermark);
      }
      if (opts.antiSearch) {
        if (typeof opts.antiSearch.enabled === 'boolean') {
          setAntiSearchEnabled(opts.antiSearch.enabled);
          if (opts.antiSearch.enabled && !antiSearchEnabled) {
            setAntiSearchSeed(Math.floor(Math.random() * 0xffffffff));
          }
        }
        if (typeof opts.antiSearch.intensity === 'number') {
          setAntiSearchIntensity(opts.antiSearch.intensity);
        }
      }
      setActivePreset(preset.id);
    },
    [antiSearchEnabled]
  );

  const handleSetRemoveMetadata = useCallback((value: boolean) => {
    setActivePreset(null);
    setRemoveMetadata(value);
  }, []);

  const handleSetBlurFaces = useCallback((value: boolean) => {
    setActivePreset(null);
    setBlurFaces(value);
  }, []);

  const handleSetBlurStrength = useCallback((value: number) => {
    setActivePreset(null);
    setBlurStrength(value);
  }, []);

  const handleSetJpegQuality = useCallback((value: number) => {
    setActivePreset(null);
    setJpegQuality(value);
  }, []);

  const handleSetRenameFile = useCallback((value: boolean) => {
    setActivePreset(null);
    setRenameFile(value);
    if (value) {
      setRenameSeed(Math.floor(Math.random() * 0xffffffff));
    }
  }, []);

  const handleSetAntiSearchEnabled = useCallback(
    (value: boolean) => {
      setActivePreset(null);
      setAntiSearchEnabled(value);
      if (value) {
        setAntiSearchSeed(Math.floor(Math.random() * 0xffffffff));
        if (antiSearchIntensity === 0) {
          setAntiSearchIntensity(1);
        }
      }
    },
    [antiSearchIntensity]
  );

  const handleSetAntiSearchIntensity = useCallback((value: number) => {
    setActivePreset(null);
    setAntiSearchIntensity(value);
    if (value === 0) {
      setAntiSearchEnabled(false);
    } else if (!antiSearchEnabled) {
      setAntiSearchEnabled(true);
      setAntiSearchSeed(Math.floor(Math.random() * 0xffffffff));
    }
  }, [antiSearchEnabled]);

  const handleSetManualMaskEnabled = useCallback((value: boolean) => {
    setActivePreset(null);
    setManualMaskEnabled(value);
  }, []);

  const handleUpdateManualMasks = useCallback((value: ManualMaskRegion[]) => {
    setActivePreset(null);
    setManualMasks(value);
  }, []);

  const handleClearManualMasks = useCallback(() => {
    setActivePreset(null);
    setManualMasks([]);
  }, []);

  const handleSetReduceColor = useCallback((value: boolean) => {
    setActivePreset(null);
    setReduceColor(value);
  }, []);

  const handleSetWatermark = useCallback((value: boolean) => {
    setActivePreset(null);
    setWatermark(value);
  }, []);

  useEffect(() => {
    if (!fileInfo) {
      setPreviewDataUrl(null);
      setPreviewLoading(false);
      setEstimatedSize(null);
      setProcessedDimensions(null);
      return;
    }
    const hasManualBlur = cleanupOptions.manualMaskEnabled && cleanupOptions.manualMasks.length > 0;
    const hasAntiSearch = cleanupOptions.antiSearch.enabled && cleanupOptions.antiSearch.intensity > 0;
    const qualityAdjusted =
      !fileInfo.mimeType.includes('png') && Math.abs(jpegQuality - 1) > 0.001;
    const needsCanvasPreview =
      cleanupOptions.blurFaces || hasManualBlur || hasAntiSearch || cleanupOptions.reduceColor || cleanupOptions.watermark ||
      qualityAdjusted;

    if (!needsCanvasPreview) {
      setPreviewDataUrl(fileInfo.dataUrl);
      setEstimatedSize(fileInfo.sizeBytes);
      setProcessedDimensions({ width: fileInfo.width, height: fileInfo.height });
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
        const mime = fileInfo.mimeType.includes('png') ? 'image/png' : fileInfo.mimeType.includes('webp') ? 'image/webp' : 'image/jpeg';
        const quality = mime === 'image/jpeg' || mime === 'image/webp' ? jpegQuality : undefined;
        const dataUrl = canvas.toDataURL(mime, quality);
        if (!cancelled) {
          setPreviewDataUrl(dataUrl);
          setEstimatedSize(estimateDataUrlBytes(dataUrl));
          setProcessedDimensions({ width: canvas.width, height: canvas.height });
        }
      })
      .catch((err) => {
        console.error('cleanup-preview', err);
        if (!cancelled) {
          setPreviewDataUrl(null);
          setEstimatedSize(null);
          setProcessedDimensions(null);
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
  }, [fileInfo, cleanupOptions, jpegQuality, createProcessedCanvas]);

  const cleanupSummary = useMemo(() => {
    if (!fileInfo) {
      return null;
    }
    const originalResolution = `${fileInfo.width}×${fileInfo.height}`;
    const processedResolution = processedDimensions
      ? `${processedDimensions.width}×${processedDimensions.height}`
      : originalResolution;
    const resolutionChanged = processedDimensions
      ? processedDimensions.width !== fileInfo.width || processedDimensions.height !== fileInfo.height
      : false;
    const manualMaskCount = manualMasks.length;
    const manualMaskActive = manualMaskEnabled && manualMaskCount > 0;
    const antiLevel = antiSearchEnabled ? antiSearchIntensity : 0;
    const facesDetected = personDetections.length;
    const facesBlurred = blurFaces && facesDetected > 0;
    const metadataRemoved = removeMetadata;
    const rename = renameFile;
    const score =
      (metadataRemoved ? 2 : 0) +
      (facesBlurred ? 2 : 0) +
      (manualMaskActive ? 2 : 0) +
      antiLevel +
      (rename ? 1 : 0) +
      (reduceColor ? 1 : 0);
    const privacyLevel = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';

    return {
      metadataRemoved,
      resolutionBefore: originalResolution,
      resolutionAfter: resolutionChanged ? processedResolution : null,
      facesRequested: blurFaces,
      facesDetected,
      facesBlurred,
      manualMaskEnabled,
      manualMaskCount,
      antiSearchLevel: antiLevel,
      renameEnabled: rename,
      reduceColor,
      watermark,
      privacyLevel
    };
  }, [
    fileInfo,
    processedDimensions,
    manualMasks,
    manualMaskEnabled,
    antiSearchEnabled,
    antiSearchIntensity,
    personDetections,
    blurFaces,
    removeMetadata,
    renameFile,
    reduceColor,
    watermark
  ]);

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
        blurStrength={blurStrength}
        jpegQuality={jpegQuality}
        setRemoveMetadata={handleSetRemoveMetadata}
        setBlurFaces={handleSetBlurFaces}
        setBlurStrength={handleSetBlurStrength}
        setJpegQuality={handleSetJpegQuality}
        renameFile={renameFile}
        setRenameFile={handleSetRenameFile}
        antiSearchEnabled={antiSearchEnabled}
        antiSearchIntensity={antiSearchIntensity}
        setAntiSearchEnabled={handleSetAntiSearchEnabled}
        setAntiSearchIntensity={handleSetAntiSearchIntensity}
        manualMaskEnabled={manualMaskEnabled}
        manualMasks={manualMasks}
        setManualMaskEnabled={handleSetManualMaskEnabled}
        onManualMasksChange={handleUpdateManualMasks}
        onManualMasksClear={handleClearManualMasks}
        reduceColor={reduceColor}
        setReduceColor={handleSetReduceColor}
        watermark={watermark}
        setWatermark={handleSetWatermark}
        applyPreset={handlePresetApply}
        activePreset={activePreset}
        cleanupSummary={cleanupSummary}
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
