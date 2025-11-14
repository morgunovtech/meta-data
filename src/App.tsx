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
import type { CleanupOptions, ManualMaskRegion, CleanupPresetKey } from './types/cleanup';
import { ensureRenameToken, stripMetadataBlob } from './utils/metadataCleanup';

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
const antiSearchDefaultStrength = 1;

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function needsCanvasProcessing(options: CleanupOptions): boolean {
  return (
    options.blurFaces ||
    options.manualMasks.length > 0 ||
    (options.antiSearchEnabled && options.antiSearchStrength > 0) ||
    options.reduceColors ||
    options.addWatermark
  );
}

function pseudoRandom(seed: number) {
  let value = seed || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
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
  const [cleanupOptions, setCleanupOptions] = useState<CleanupOptions>(() => ({
    removeMetadata: true,
    blurFaces: false,
    blurStrength: blurDefault,
    jpegQuality: qualityDefault,
    renameFile: false,
    renameToken: null,
    antiSearchEnabled: false,
    antiSearchStrength: antiSearchDefaultStrength,
    antiSearchSeed: Math.floor(Math.random() * 2 ** 32),
    manualMasks: [],
    reduceColors: false,
    addWatermark: false
  }));
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [finalDimensions, setFinalDimensions] = useState<{ width: number; height: number } | null>(null);

  const preparedBlobRef = useRef<{
    optionsKey: string;
    blob: Blob;
    mime: string;
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);

  const personDetections = useMemo(
    () => detections.filter((det) => det.label === 'person'),
    [detections]
  );

  const optionsKey = useMemo(() => {
    if (!fileInfo) return '';
    const maskKey = cleanupOptions.manualMasks
      .map((mask) => `${mask.id}:${mask.x.toFixed(4)},${mask.y.toFixed(4)},${mask.width.toFixed(4)},${mask.height.toFixed(4)}`)
      .join('|');
    return [
      fileInfo.file.name,
      fileInfo.file.lastModified,
      fileInfo.sizeBytes,
      cleanupOptions.removeMetadata ? 'rm' : 'keep',
      cleanupOptions.blurFaces ? `blur-${cleanupOptions.blurStrength}` : 'noblur',
      cleanupOptions.jpegQuality.toFixed(3),
      cleanupOptions.renameFile ? 'rename' : 'keepname',
      cleanupOptions.antiSearchEnabled ? `anti-${cleanupOptions.antiSearchStrength}-${cleanupOptions.antiSearchSeed}` : 'noanti',
      maskKey,
      cleanupOptions.reduceColors ? 'mono' : 'fullcolor',
      cleanupOptions.addWatermark ? 'wm' : 'nowm'
    ].join(';');
  }, [cleanupOptions, fileInfo]);

  const updateCleanupOptions = useCallback(<K extends keyof CleanupOptions>(key: K, value: CleanupOptions[K]) => {
    setCleanupOptions((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const setManualMasks = useCallback((masks: ManualMaskRegion[]) => {
    setCleanupOptions((prev) => ({
      ...prev,
      manualMasks: masks
    }));
  }, []);

  const applyPreset = useCallback(
    (preset: CleanupPresetKey) => {
      setCleanupOptions((prev) => {
        if (preset === 'basic') {
          return {
            ...prev,
            removeMetadata: true,
            blurFaces: false,
            blurStrength: blurDefault,
            renameFile: true,
            reduceColors: false,
            antiSearchEnabled: false,
            manualMasks: [],
            addWatermark: false
          };
        }
        if (preset === 'strong') {
          return {
            ...prev,
            removeMetadata: true,
            blurFaces: true,
            blurStrength: Math.max(prev.blurStrength, 36),
            renameFile: true,
            reduceColors: true,
            antiSearchEnabled: true,
            antiSearchStrength: Math.max(prev.antiSearchStrength, 2),
            antiSearchSeed: Math.floor(Math.random() * 2 ** 32),
            manualMasks: prev.manualMasks,
            addWatermark: true
          };
        }
        return prev;
      });
    },
    []
  );

  const handleFile = useCallback(
    async (file: File) => {
      setManualCoords(null);
      setCleanupOptions({
        removeMetadata: true,
        blurFaces: false,
        blurStrength: blurDefault,
        jpegQuality: qualityDefault,
        renameFile: false,
        renameToken: null,
        antiSearchEnabled: false,
        antiSearchStrength: antiSearchDefaultStrength,
        antiSearchSeed: Math.floor(Math.random() * 2 ** 32),
        manualMasks: [],
        reduceColors: false,
        addWatermark: false
      });
      setNotice(null);
      setPreviewDataUrl(null);
      setPreviewLoading(true);
      setEstimatedSize(null);
      setFinalDimensions(null);
      preparedBlobRef.current = null;
      await processFile(file);
    },
    [processFile]
  );

  const createProcessedCanvas = useCallback(
    async (options: CleanupOptions) => {
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
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        ctx.filter = `blur(${Math.round(options.blurStrength)}px)`;
        ctx.drawImage(image, x, y, width, height, x, y, width, height);
        ctx.filter = 'none';
        ctx.restore();
      };

      if (options.blurFaces && personDetections.length > 0) {
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
          if (width > 0 && height > 0) {
            applyBlurRegion(x, y, width, height);
          }
        });
      }

      if (options.manualMasks.length > 0) {
        options.manualMasks.forEach((mask) => {
          const x = mask.x * canvas.width;
          const y = mask.y * canvas.height;
          const width = mask.width * canvas.width;
          const height = mask.height * canvas.height;
          if (width > 0 && height > 0) {
            applyBlurRegion(x, y, width, height);
          }
        });
      }

      if (options.antiSearchEnabled && options.antiSearchStrength > 0) {
        const cropPx = Math.min(options.antiSearchStrength, Math.floor(Math.min(canvas.width, canvas.height) / 6));
        const workingWidth = Math.max(8, canvas.width - cropPx * 2);
        const workingHeight = Math.max(8, canvas.height - cropPx * 2);
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = workingWidth;
        croppedCanvas.height = workingHeight;
        const croppedCtx = croppedCanvas.getContext('2d');
        if (!croppedCtx) {
          throw new Error('canvas');
        }
        croppedCtx.drawImage(canvas, cropPx, cropPx, workingWidth, workingHeight, 0, 0, workingWidth, workingHeight);

        const rotateCanvas = document.createElement('canvas');
        rotateCanvas.width = workingWidth;
        rotateCanvas.height = workingHeight;
        const rotateCtx = rotateCanvas.getContext('2d');
        if (!rotateCtx) {
          throw new Error('canvas');
        }
        const random = pseudoRandom(options.antiSearchSeed);
        const maxAngleDeg = 0.35 + options.antiSearchStrength * 0.25; // <= ~1.1°
        const angle = (random() - 0.5) * 2 * maxAngleDeg;
        rotateCtx.translate(workingWidth / 2, workingHeight / 2);
        rotateCtx.rotate((angle * Math.PI) / 180);
        rotateCtx.drawImage(croppedCanvas, -workingWidth / 2, -workingHeight / 2);
        rotateCtx.setTransform(1, 0, 0, 1, 0, 0);

        // subtle noise / brightness tweak
        const noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = workingWidth;
        noiseCanvas.height = workingHeight;
        const noiseCtx = noiseCanvas.getContext('2d');
        if (!noiseCtx) {
          throw new Error('canvas');
        }
        noiseCtx.drawImage(rotateCanvas, 0, 0);
        const imageData = noiseCtx.getImageData(0, 0, workingWidth, workingHeight);
        const data = imageData.data;
        const noiseStrength = options.antiSearchStrength;
        for (let i = 0; i < data.length; i += 4) {
          const delta = (random() - 0.5) * noiseStrength * 1.5;
          data[i] = Math.min(255, Math.max(0, data[i] + delta));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + delta));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + delta));
        }
        noiseCtx.putImageData(imageData, 0, 0);

        canvas = noiseCanvas;
        ctx = noiseCtx;
      }

      if (options.reduceColors) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      if (options.addWatermark) {
        const fontSize = Math.max(14, Math.round(canvas.width * 0.018));
        ctx.save();
        ctx.font = `${fontSize}px "Inter", sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const padding = Math.max(12, Math.round(canvas.width * 0.02));
        const watermark = t('watermarkText');
        ctx.fillText(watermark, canvas.width - padding, canvas.height - padding);
        ctx.restore();
      }

      return canvas;
    },
    [fileInfo, personDetections, t]
  );

  const handleDownload = useCallback(async () => {
    if (!fileInfo) {
      return;
    }
    setProcessing(true);
    setNotice(null);
    try {
      let prepared = preparedBlobRef.current;
      if (!prepared || prepared.optionsKey !== optionsKey) {
        prepared = null;
      }
      let blob: Blob | null = prepared ? prepared.blob : null;
      let mime = fileInfo.mimeType;
      let width = fileInfo.width;
      let height = fileInfo.height;

      if (!blob) {
        if (needsCanvasProcessing(cleanupOptions)) {
          const canvas = await createProcessedCanvas(cleanupOptions);
          if (!canvas) {
            throw new Error('no-canvas');
          }
          width = canvas.width;
          height = canvas.height;
          const exportMime = mime.includes('png') ? 'image/png' : mime.includes('webp') ? 'image/webp' : 'image/jpeg';
          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (result) => {
                if (result) resolve(result);
                else reject(new Error('export-failed'));
              },
              exportMime,
              exportMime === 'image/jpeg' || exportMime === 'image/webp' ? cleanupOptions.jpegQuality : undefined
            );
          });
          mime = exportMime;
        } else if (cleanupOptions.removeMetadata) {
          blob = await stripMetadataBlob(fileInfo.file);
        } else {
          blob = fileInfo.file;
        }
      } else {
        mime = prepared.mime;
        width = prepared.width;
        height = prepared.height;
      }

      if (!blob) {
        throw new Error('no-blob');
      }

      const extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const renameToken = cleanupOptions.renameFile
        ? ensureRenameToken(cleanupOptions.renameToken)
        : cleanupOptions.renameToken;
      if (cleanupOptions.renameFile && renameToken !== cleanupOptions.renameToken) {
        updateCleanupOptions('renameToken', renameToken);
      }

      const fileBase = cleanupOptions.renameFile
        ? `photo-${renameToken ?? ensureRenameToken(null)}`
        : fileInfo.file.name.replace(/\.[^/.]+$/, '');

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileBase}.cleaned.${extension}`;
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
  }, [cleanupOptions, createProcessedCanvas, fileInfo, optionsKey, t, updateCleanupOptions]);

  const handleReset = useCallback(() => {
    reset();
    setManualCoords(null);
    setCleanupOptions({
      removeMetadata: true,
      blurFaces: false,
      blurStrength: blurDefault,
      jpegQuality: qualityDefault,
      renameFile: false,
      renameToken: null,
      antiSearchEnabled: false,
      antiSearchStrength: antiSearchDefaultStrength,
      antiSearchSeed: Math.floor(Math.random() * 2 ** 32),
      manualMasks: [],
      reduceColors: false,
      addWatermark: false
    });
    setProcessing(false);
    setNotice(null);
    setPreviewDataUrl(null);
    setPreviewLoading(false);
    setEstimatedSize(null);
    setFinalDimensions(null);
    preparedBlobRef.current = null;
  }, [reset]);

  useEffect(() => {
    if (!fileInfo) {
      setPreviewDataUrl(null);
      setPreviewLoading(false);
      setEstimatedSize(null);
      setFinalDimensions(null);
      preparedBlobRef.current = null;
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const useCanvas = needsCanvasProcessing(cleanupOptions);
    const perform = async () => {
      try {
        if (!useCanvas && !cleanupOptions.removeMetadata) {
          if (!cancelled) {
            setPreviewDataUrl(fileInfo.dataUrl);
            setEstimatedSize(fileInfo.sizeBytes);
            setFinalDimensions({ width: fileInfo.width, height: fileInfo.height });
            preparedBlobRef.current = {
              optionsKey,
              blob: fileInfo.file,
              mime: fileInfo.mimeType,
              dataUrl: fileInfo.dataUrl,
              width: fileInfo.width,
              height: fileInfo.height
            };
          }
          return;
        }

        if (!useCanvas && cleanupOptions.removeMetadata) {
          const cleanedBlob = await stripMetadataBlob(fileInfo.file);
          if (cancelled) return;
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('preview-dataurl'));
            reader.readAsDataURL(cleanedBlob);
          });
          if (cancelled) return;
          setPreviewDataUrl(dataUrl);
          setEstimatedSize(cleanedBlob.size);
          setFinalDimensions({ width: fileInfo.width, height: fileInfo.height });
          preparedBlobRef.current = {
            optionsKey,
            blob: cleanedBlob,
            mime: fileInfo.mimeType,
            dataUrl,
            width: fileInfo.width,
            height: fileInfo.height
          };
          return;
        }

        const canvas = await createProcessedCanvas(cleanupOptions);
        if (!canvas || cancelled) {
          return;
        }
        const exportMime = fileInfo.mimeType.includes('png')
          ? 'image/png'
          : fileInfo.mimeType.includes('webp')
          ? 'image/webp'
          : 'image/jpeg';
        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new Error('preview-export'));
            },
            exportMime,
            exportMime === 'image/jpeg' || exportMime === 'image/webp' ? cleanupOptions.jpegQuality : undefined
          );
        });
        if (cancelled) return;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('preview-dataurl'));
          reader.readAsDataURL(blob);
        });
        if (cancelled) return;
        setPreviewDataUrl(dataUrl);
        setEstimatedSize(blob.size || estimateDataUrlBytes(dataUrl));
        setFinalDimensions({ width: canvas.width, height: canvas.height });
        preparedBlobRef.current = {
          optionsKey,
          blob,
          mime: exportMime,
          dataUrl,
          width: canvas.width,
          height: canvas.height
        };
      } catch (err) {
        console.error('cleanup-preview', err);
        if (!cancelled) {
          setPreviewDataUrl(null);
          setEstimatedSize(null);
          preparedBlobRef.current = null;
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    };

    perform();

    return () => {
      cancelled = true;
    };
  }, [cleanupOptions, createProcessedCanvas, fileInfo, optionsKey]);

  const metadataRemovedReason = useMemo(() => {
    if (!fileInfo) return 'none';
    if (cleanupOptions.removeMetadata) {
      return 'explicit';
    }
    return needsCanvasProcessing(cleanupOptions) ? 'transform' : 'none';
  }, [cleanupOptions, fileInfo]);

  const cleanupSummary = useMemo(() => {
    if (!fileInfo) {
      return null;
    }
    const finalWidth = finalDimensions?.width ?? fileInfo.width;
    const finalHeight = finalDimensions?.height ?? fileInfo.height;
    const metadataStatus =
      metadataRemovedReason === 'none'
        ? t('privacySummaryMetadataKept')
        : metadataRemovedReason === 'explicit'
        ? t('privacySummaryMetadataRemoved')
        : t('privacySummaryMetadataRemovedTransforms');
    const blurStatus = cleanupOptions.blurFaces || cleanupOptions.manualMasks.length > 0
      ? t('privacySummaryFacesBlurred')
      : t('privacySummaryFacesUntouched');
    const antiSearchStatus = cleanupOptions.antiSearchEnabled
      ? t('privacySummaryAntiSearchOn', { level: cleanupOptions.antiSearchStrength })
      : t('privacySummaryAntiSearchOff');
    const renameStatus = cleanupOptions.renameFile
      ? t('privacySummaryRenamed')
      : t('privacySummaryOriginalName');
    const resolutionStatus = finalWidth === fileInfo.width && finalHeight === fileInfo.height
      ? t('privacySummaryResolutionSame', { width: fileInfo.width, height: fileInfo.height })
      : t('privacySummaryResolutionChanged', {
          fromWidth: fileInfo.width,
          fromHeight: fileInfo.height,
          toWidth: finalWidth,
          toHeight: finalHeight
        });
    const colorStatus = cleanupOptions.reduceColors
      ? t('privacySummaryColorReduced')
      : t('privacySummaryColorFull');
    const watermarkStatus = cleanupOptions.addWatermark
      ? t('privacySummaryWatermarkOn')
      : t('privacySummaryWatermarkOff');

    let privacyScore = 0;
    if (metadataRemovedReason !== 'none') privacyScore += 1;
    if (cleanupOptions.blurFaces || cleanupOptions.manualMasks.length > 0) privacyScore += 1;
    if (cleanupOptions.antiSearchEnabled) privacyScore += 1;
    if (cleanupOptions.renameFile) privacyScore += 1;
    if (cleanupOptions.reduceColors || cleanupOptions.addWatermark) privacyScore += 0.5;
    const level = privacyScore >= 3.5 ? t('privacyLevelHigh') : privacyScore >= 2 ? t('privacyLevelMedium') : t('privacyLevelLow');

    return {
      metadataStatus,
      blurStatus,
      antiSearchStatus,
      renameStatus,
      resolutionStatus,
      colorStatus,
      watermarkStatus,
      level
    };
  }, [cleanupOptions, fileInfo, finalDimensions, metadataRemovedReason, t]);

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
        options={cleanupOptions}
        summary={cleanupSummary}
        onOptionChange={updateCleanupOptions}
        onPreset={applyPreset}
        setManualMasks={setManualMasks}
        manualMasks={cleanupOptions.manualMasks}
        onClean={handleDownload}
        processing={processing}
        previewDataUrl={previewDataUrl}
        previewLoading={previewLoading}
        estimatedSize={estimatedSize}
        metadataRemovedReason={metadataRemovedReason}
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
