import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { useImageFile } from './hooks/useImageFile';
import { useExifMetadata } from './hooks/useExifMetadata';
import { clampQuality } from './utils/image';
import { toIsoOrNull } from './utils/datetime';
import { useAPIFetch } from './hooks/useAPIFetch';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import type {
  HistoricalWeatherResult,
  PoiItem,
  ReverseGeocodeResult,
  SurveillanceItem,
  TimezoneHolidayResult
} from './types/api';
import type { ManualCoordinates } from './types/metadata';
import type { BoundingBox } from './types/detection';
import LanguageSwitcher from './components/common/LanguageSwitcher';
import UploadZone from './components/UploadZone';
import PreviewPane from './components/PreviewPane';
import MetadataPanel from './components/MetadataPanel';
import ShockBlock from './components/shock/ShockBlock';
import AnalysisBlock from './components/analysis/AnalysisBlock';
import CleanupBlock from './components/CleanupBlock';
import NotificationBanner from './components/common/NotificationBanner';

const App: React.FC = () => {
  const { t } = useLanguage();
  const image = useImageFile();
  const { metadata } = useExifMetadata({ file: image.file });
  const [manualCoords, setManualCoords] = useState<ManualCoordinates | null>(null);
  const [quality, setQuality] = useState(0.92);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const imageElRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!image.dataUrl) {
      imageElRef.current = null;
      return;
    }
    const img = new Image();
    img.src = image.dataUrl;
    img.onload = () => {
      imageElRef.current = img;
    };
  }, [image.dataUrl]);

  const gps = useMemo(() => {
    if (manualCoords) return manualCoords;
    if (!metadata?.exif.gpsLatitude || !metadata?.exif.gpsLongitude) return null;
    return { latitude: metadata.exif.gpsLatitude, longitude: metadata.exif.gpsLongitude };
  }, [manualCoords, metadata?.exif.gpsLatitude, metadata?.exif.gpsLongitude]);

  const timestampIso = useMemo(() => toIsoOrNull(metadata?.exif.dateTimeOriginal ?? undefined), [metadata?.exif.dateTimeOriginal]);

  const timezoneFetch = useAPIFetch<TimezoneHolidayResult>();
  const reverseGeoFetch = useAPIFetch<ReverseGeocodeResult>();
  const weatherFetch = useAPIFetch<HistoricalWeatherResult>();
  const poiFetch = useAPIFetch<PoiItem[]>();
  const surveillanceFetch = useAPIFetch<SurveillanceItem[]>();

  useEffect(() => {
    if (gps && timestampIso) {
      timezoneFetch.execute({
        path: '/api/timezone-and-holiday',
        params: { lat: gps.latitude, lon: gps.longitude, timestamp: timestampIso }
      });
    }
  }, [gps, timestampIso, timezoneFetch]);

  useEffect(() => {
    if (gps) {
      reverseGeoFetch.execute({
        path: '/api/reverse-geocode',
        params: { lat: gps.latitude, lon: gps.longitude }
      });
      poiFetch.execute({
        path: '/api/nearby-poi',
        params: { lat: gps.latitude, lon: gps.longitude, radius: 250 }
      });
      surveillanceFetch.execute({
        path: '/api/surveillance-candidates',
        params: { lat: gps.latitude, lon: gps.longitude, radius: 300 }
      });
      if (timestampIso) {
        weatherFetch.execute({
          path: '/api/historical-weather',
          params: { lat: gps.latitude, lon: gps.longitude, timestamp: timestampIso }
        });
      }
    }
  }, [gps, timestampIso, reverseGeoFetch, poiFetch, surveillanceFetch, weatherFetch]);

  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const [showBoxes, setShowBoxes] = useState(false);
  const analysis = useImageAnalysis({ enabled: analysisEnabled, image: imageElRef.current });

  const handleAnalyze = () => {
    analysis.analyze();
  };

  const drawBoxes = (ctx: CanvasRenderingContext2D, boxes: BoundingBox[]) => {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.font = '14px sans-serif';
    boxes.forEach((box) => {
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.fillRect(box.x, box.y - 18, ctx.measureText(box.label).width + 12, 18);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(box.label, box.x + 6, box.y - 4);
    });
  };

  useEffect(() => {
    const canvas = document.getElementById('analysis-overlay') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imageElRef.current;
    if (!ctx || !img) return;
    if (!showBoxes || !analysis.summary?.boxes || !image.dataUrl) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth * dpr;
    const displayHeight = canvas.clientHeight * dpr;
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    const scaleX = displayWidth / img.width;
    const scaleY = displayHeight / img.height;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    const scaledBoxes = analysis.summary.boxes.map((box) => ({
      ...box,
      x: box.x * scaleX,
      y: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY
    }));
    drawBoxes(ctx, scaledBoxes);
  }, [analysis.summary?.boxes, image.dataUrl, showBoxes]);

  const handleManualCoords = (coords: ManualCoordinates | null) => {
    setManualCoords(coords);
  };

  return (
    <div className="main-container">
      <header className="panel">
        <div className="flex-row" style={{ justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ maxWidth: 720 }}>
            <h1>{t('app_title')}</h1>
            <p>{t('app_tagline')}</p>
            <p>{t('app_how_it_works')}</p>
            <p className="badge">{t('safety_note')}</p>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <a href="#" aria-label={t('link_privacy')}>
                {t('link_privacy')}
              </a>
              <a href="#" aria-label={t('link_source')}>
                {t('link_source')}
              </a>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <section className="panel">
        <UploadZone image={image} />
      </section>

      {image.error && (
        <NotificationBanner
          tone="error"
          messageKey={
            image.error === 'too_large'
              ? 'error_too_large'
              : image.error === 'bad_type'
              ? 'error_bad_type'
              : image.error === 'heic'
              ? 'error_heic'
              : 'error_corrupt'
          }
          messageParams={{ limit: 20 }}
        />
      )}

      {image.basicInfo && image.thumbnailUrl && (
        <section className="flex-row">
          <PreviewPane
            thumbnailUrl={image.thumbnailUrl}
            basicInfo={image.basicInfo}
            openFullscreen={() => setShowFullscreen(true)}
            showBoxes={showBoxes}
          />
          <MetadataPanel metadata={metadata} info={image.basicInfo} />
        </section>
      )}

      <ShockBlock
        metadata={metadata}
        gps={gps}
        timestampIso={timestampIso}
        timezoneFetch={timezoneFetch}
        reverseGeoFetch={reverseGeoFetch}
        weatherFetch={weatherFetch}
        poiFetch={poiFetch}
        surveillanceFetch={surveillanceFetch}
        onManualCoords={handleManualCoords}
      />

      <AnalysisBlock
        enabled={analysisEnabled}
        setEnabled={setAnalysisEnabled}
        summary={analysis.summary}
        loading={analysis.loading}
        error={analysis.error}
        onAnalyze={handleAnalyze}
        showBoxes={showBoxes}
        setShowBoxes={setShowBoxes}
        hasImage={Boolean(image.dataUrl)}
      />

      <CleanupBlock
        hasImage={Boolean(image.dataUrl)}
        summary={analysis.summary}
        removeMetadata
        blurFaces
        quality={quality}
        setQuality={(value) => setQuality(clampQuality(value))}
        image={image}
      />

      {showFullscreen && image.dataUrl && (
        <div
          className="fullscreen-viewer"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowFullscreen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setShowFullscreen(false);
          }}
        >
          <img src={image.dataUrl} alt={t('thumbnail_alt')} />
        </div>
      )}
    </div>
  );
};

export default App;
