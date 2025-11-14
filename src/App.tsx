import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InfoBlock } from './components/InfoBlock';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { UploadZone } from './components/UploadZone';
import { useImageFile } from './hooks/useImageFile';
import { useExifMetadata } from './hooks/useExifMetadata';
import { PreviewViewer } from './components/PreviewViewer';
import { MetadataPanel } from './components/MetadataPanel';
import { ShockBlock } from './components/ShockBlock';
import { ContentAnalysisBlock } from './components/ContentAnalysisBlock';
import { CleanupDownloadBlock } from './components/CleanupDownloadBlock';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import type { ManualCoordinates } from './types/metadata';
import { useT } from './i18n';
import { ThemeSwitcher } from './components/ThemeSwitcher';

const qualityDefault = 0.92;

const App: React.FC = () => {
  const t = useT();
  const { fileInfo, error, loading, processFile, reset } = useImageFile();
  const { metadata } = useExifMetadata(fileInfo);
  const {
    enabled: analysisEnabled,
    setEnabled: setAnalysisEnabled,
    loading: analysisLoading,
    error: analysisError,
    detections,
    summary: analysisSummary
  } = useImageAnalysis(fileInfo?.dataUrl ?? null);

  type NoticeState = { type: 'success' | 'error'; message: string };

  const [showBoxes, setShowBoxes] = useState(false);
  const [manualCoords, setManualCoords] = useState<ManualCoordinates | null>(null);
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [blurFaces, setBlurFaces] = useState(false);
  const [jpegQuality, setJpegQuality] = useState(qualityDefault);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const personDetections = useMemo(
    () => detections.filter((det) => det.label === 'person'),
    [detections]
  );

  useEffect(() => {
    if (!analysisEnabled) {
      setShowBoxes(false);
    }
  }, [analysisEnabled]);

  const handleFile = useCallback(
    async (file: File) => {
      setManualCoords(null);
      setShowBoxes(false);
      setRemoveMetadata(true);
      setBlurFaces(false);
      setNotice(null);
      setAnalysisEnabled(false);
      setJpegQuality(qualityDefault);
      await processFile(file);
    },
    [processFile, setAnalysisEnabled]
  );

  const handleDownload = useCallback(async () => {
    if (!fileInfo || (!removeMetadata && !blurFaces)) {
      return;
    }
    setProcessing(true);
    setNotice(null);
    try {
      const image = new Image();
      image.src = fileInfo.dataUrl;
      if (image.decode) {
        await image.decode();
      } else {
        await new Promise((resolve, reject) => {
          image.onload = () => resolve(undefined);
          image.onerror = () => reject(new Error('image-load'));
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = fileInfo.width;
      canvas.height = fileInfo.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      if (blurFaces) {
        personDetections.forEach((det) => {
          ctx.save();
          ctx.beginPath();
          ctx.rect(det.x, det.y, det.width, det.height);
          ctx.clip();
          ctx.filter = 'blur(12px)';
          ctx.drawImage(canvas, det.x, det.y, det.width, det.height, det.x, det.y, det.width, det.height);
          ctx.restore();
        });
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
    personDetections,
    jpegQuality,
    t
  ]);

  const handleReset = useCallback(() => {
    reset();
    setManualCoords(null);
    setShowBoxes(false);
    setRemoveMetadata(true);
    setBlurFaces(false);
    setProcessing(false);
    setNotice(null);
    setJpegQuality(qualityDefault);
    setAnalysisEnabled(false);
  }, [reset, setAnalysisEnabled]);

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
      <InfoBlock />
      <UploadZone loading={loading} onFile={handleFile} error={error ?? undefined} />

      {fileInfo ? (
        <div className="grid-two-column">
          <div className="panel">
            <PreviewViewer fileInfo={fileInfo} detections={detections} showBoxes={showBoxes} />
          </div>
          <MetadataPanel fileInfo={fileInfo} metadata={metadata} />
        </div>
      ) : null}

      {fileInfo ? (
        <ShockBlock metadata={metadata} manualCoords={manualCoords} onManualCoordsChange={setManualCoords} />
      ) : null}

      {fileInfo ? (
        <ContentAnalysisBlock
          enabled={analysisEnabled}
          setEnabled={setAnalysisEnabled}
          loading={analysisLoading}
          error={analysisError}
          summary={analysisSummary}
          showBoxes={showBoxes}
          onToggleBoxes={setShowBoxes}
        />
      ) : null}

      <CleanupDownloadBlock
        fileInfo={fileInfo}
        detections={detections}
        removeMetadata={removeMetadata}
        blurFaces={blurFaces}
        jpegQuality={jpegQuality}
        setRemoveMetadata={setRemoveMetadata}
        setBlurFaces={setBlurFaces}
        setJpegQuality={setJpegQuality}
        onClean={handleDownload}
        processing={processing}
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
