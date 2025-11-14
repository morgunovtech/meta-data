import React from 'react';
import { InfoBlock } from '@/components/InfoBlock';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { UploadDropZone } from '@/components/UploadDropZone';
import { useImageFile } from '@/hooks/useImageFile';
import { useExifMetadata } from '@/hooks/useExifMetadata';
import { MetadataPanel } from '@/components/MetadataPanel';
import { ImagePreview } from '@/components/ImagePreview';
import { ShockBlock } from '@/components/ShockBlock';
import { useI18n } from '@/i18n/I18nContext';
import { ContentAnalysisBlock } from '@/components/ContentAnalysisBlock';
import { useImageAnalysis } from '@/hooks/useImageAnalysis';
import { CleanupDownloadBlock } from '@/components/CleanupDownloadBlock';
import { ErrorBanner } from '@/components/ErrorBanner';

const errorKeys = {
  too_large: 'error_too_large',
  unsupported: 'error_unsupported',
  corrupted: 'error_corrupted',
  heic: 'error_heic'
} as const;

export default function App() {
  const { t } = useI18n();
  const image = useImageFile();
  const exif = useExifMetadata(image.info);
  const analysis = useImageAnalysis(image.info);

  const fileError = image.error ? t(errorKeys[image.error], { limit: 20 }) : undefined;

  return (
    <main className="app">
      <div className="top-bar">
        <InfoBlock />
        <LanguageSwitcher />
      </div>

      <section className="uploader">
        <h2>{t('upload_title')}</h2>
        <UploadDropZone onFileSelect={image.selectFile} busy={image.loading} />
        {fileError && <ErrorBanner message={fileError} />}
      </section>

      {image.info && (
        <section className="analysis-layout">
          <ImagePreview image={image.info} showBoxes={analysis.showBoxes} detections={analysis.state.detections} />
          <MetadataPanel image={image.info} metadata={exif.data} />
        </section>
      )}

      {exif.data && (
        <ShockBlock metadata={exif.data} groups={exif.groups} />
      )}

      {image.info && (
        <ContentAnalysisBlock
          enabled={analysis.state.enabled}
          loading={analysis.state.loading}
          supported={analysis.state.supported}
          summary={analysis.state.summary}
          detections={analysis.state.detections}
          summaryMetrics={analysis.summaryMetrics}
          showBoxes={analysis.showBoxes}
          onToggle={analysis.toggle}
          onToggleBoxes={analysis.setShowBoxes}
        />
      )}

      {image.info && (
        <CleanupDownloadBlock image={image.info} detections={analysis.state.detections} />
      )}
    </main>
  );
}
