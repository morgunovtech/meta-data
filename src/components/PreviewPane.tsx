import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { calcMegapixels } from '../utils/image';
import { formatBytes, formatMB } from '../utils/file';
import type { BasicFileInfo } from '../types/metadata';

interface Props {
  thumbnailUrl: string;
  basicInfo: BasicFileInfo;
  openFullscreen: () => void;
  showBoxes: boolean;
}

const PreviewPane: React.FC<Props> = ({ thumbnailUrl, basicInfo, openFullscreen, showBoxes }) => {
  const { t } = useLanguage();
  const orientationKey = `orientation_${basicInfo.orientation}`;

  return (
    <div className="panel" style={{ flex: 1 }}>
      <h2>{t('basic_info_title')}</h2>
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <img
          src={thumbnailUrl}
          alt={t('thumbnail_alt')}
          style={{ width: '100%', borderRadius: 16, display: 'block' }}
          onClick={openFullscreen}
        />
        <canvas
          className="thumbnail"
          id="analysis-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            borderRadius: 16,
            display: showBoxes ? 'block' : 'none'
          }}
        />
      </div>
      <dl className="table-like">
        <dt>{t('file_name')}</dt>
        <dd>{basicInfo.name}</dd>
        <dt>{t('file_type')}</dt>
        <dd>{basicInfo.type}</dd>
        <dt>{t('file_size')}</dt>
        <dd>
          {formatBytes(basicInfo.sizeBytes)} ({formatMB(basicInfo.sizeBytes)} MB)
        </dd>
        <dt>{t('file_dimensions')}</dt>
        <dd>
          {basicInfo.width} × {basicInfo.height}
        </dd>
        <dt>{t('file_megapixels')}</dt>
        <dd>{calcMegapixels(basicInfo.width, basicInfo.height)}</dd>
        <dt>{t('file_orientation')}</dt>
        <dd>{t(orientationKey)}</dd>
      </dl>
      <button className="button-secondary" style={{ marginTop: '1rem' }} onClick={openFullscreen}>
        {t('preview_open')}
      </button>
    </div>
  );
};

export default PreviewPane;
