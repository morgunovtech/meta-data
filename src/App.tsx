import React, { useEffect, useMemo, useState } from 'react';
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
import type { BoundingBox } from './types/detection';
import { useT } from './i18n';

const qualityDefault = 0.92;

const App: React.FC = () => {
  const t = useT();
  const { fileInfo, error, loading, processFile, reset } = useImageFile();
  const { metadata } = useExifMetadata(fileInfo);
  const analysis = useImageAnalysis(fileInfo?.dataUrl ?? null);

  const [showBoxes, setShowBoxes] = useState(false);
  const [manualCoords, setManualCoords] = useState<ManualCoordinates | null>(null);
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [blurFaces, setBlurFaces] = useState(false);
  const [jpegQuality, setJpegQuality] = useState(qualityDefault);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const detections: BoundingBox[] = useMemo(() => analysis.detections, [analysis.detections]);

  useEffect(() => {
    if (!analysis.enabled) {
      setShowBoxes(false);
    }
  }, [analysis.enabled]);

  const handleFile = async (file: File) => {
    setManualCoords(null);
    setShowBoxes(false);
    setRemoveMetadata(true);
    setBlurFaces(false);
    setNotice(null);
    await processFile(file);
  };

  const handleDownload = async () => {
    if (!fileInfo || (!removeMetadata && !blurFaces)) {
      return;
    }
    setProcessing(true);
    setNotice(null);
    try {
      const image = new Image();
      image.src = fileInfo.dataUrl;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('image-load'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = fileInfo.width;
      canvas.height = fileInfo.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      if (blurFaces) {
        detections
          .filter((det) => det.label === 'person')
          .forEach((det) => {
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
      const extension = mime.includes('png') ? 'png' : 'jpg';
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
      setNotice(t('downloadReady'));
    } catch (err) {
      console.error(err);
      setNotice(t('cleanupFailed'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="title-row">
        <LanguageSwitcher />
        <button type="button" onClick={() => reset()} style={{ background: 'none', border: 'none', color: '#38bdf8' }}>
          {t('reset')}
        </button>
      </div>
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
          enabled={analysis.enabled}
          setEnabled={(value) => analysis.setEnabled(value)}
          loading={analysis.loading}
          error={analysis.error}
          summary={analysis.summary}
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
      {notice ? <p className="notice">{notice}</p> : null}
    </div>
  );
};

export default App;
