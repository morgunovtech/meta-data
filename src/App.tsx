import React, { useEffect, useMemo, useState } from 'react';
import { InfoBlock } from './components/InfoBlock';
import { UploadZone } from './components/UploadZone';
import { PreviewViewer } from './components/PreviewViewer';
import { MetadataPanel } from './components/MetadataPanel';
import { ShockBlock } from './components/ShockBlock';
import { MapBlock } from './components/MapBlock';
import { ContentAnalysisBlock } from './components/ContentAnalysisBlock';
import { CleanupBlock } from './components/CleanupBlock';
import { ErrorBanner } from './components/ErrorBanner';
import { useImageFile } from './hooks/useImageFile';
import { useExifMetadata } from './hooks/useExifMetadata';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { useAPIFetch } from './hooks/useAPIFetch';
import type {
  PoiResult,
  ReverseGeocodeResult,
  SurveillanceResult,
  TimezoneHolidayResult,
  WeatherSample
} from './types/api';
import { toIsoDate } from './utils/date';
import './App.css';

export default function App() {
  const { state: imageState, readImage } = useImageFile();
  const exif = useExifMetadata(imageState.info.file);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | undefined>();
  const [fullscreen, setFullscreen] = useState(false);
  const [analysisEnabled, setAnalysisEnabled] = useState(false);

  const timezoneApi = useAPIFetch<TimezoneHolidayResult>();
  const addressApi = useAPIFetch<ReverseGeocodeResult>();
  const weatherApi = useAPIFetch<WeatherSample>();
  const poiApi = useAPIFetch<PoiResult[]>();
  const surveillanceApi = useAPIFetch<SurveillanceResult[]>();

  useEffect(() => {
    const gps = exif.metadata?.gps;
    if (gps?.latitude && gps?.longitude) {
      setCoords({ lat: gps.latitude, lon: gps.longitude });
    }
  }, [exif.metadata?.gps?.latitude, exif.metadata?.gps?.longitude]);

  const isoTimestamp = useMemo(() => toIsoDate(exif.metadata?.camera.dateTimeOriginal), [exif.metadata?.camera.dateTimeOriginal]);

  useEffect(() => {
    if (!coords || !isoTimestamp) return;
    timezoneApi.call(
      `/timezone-and-holiday?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(isoTimestamp)}`
    );
  }, [coords, isoTimestamp]);

  useEffect(() => {
    if (!coords) return;
    addressApi.call(`/reverse-geocode?lat=${coords.lat}&lon=${coords.lon}`);
  }, [coords]);

  useEffect(() => {
    if (!coords || !isoTimestamp) return;
    weatherApi.call(
      `/historical-weather?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(isoTimestamp)}`
    );
  }, [coords, isoTimestamp]);

  useEffect(() => {
    if (!coords) return;
    poiApi.call(`/nearby-poi?lat=${coords.lat}&lon=${coords.lon}`);
    surveillanceApi.call(`/surveillance-candidates?lat=${coords.lat}&lon=${coords.lon}`);
  }, [coords]);

  const manualCoords = (lat: number, lon: number) => {
    setCoords({ lat, lon });
  };

  const {
    analyze,
    error: analysisError,
    loading: analysisLoading,
    summary,
    supported: analysisSupported,
    showBoxes,
    setShowBoxes,
    reset: resetAnalysis
  } = useImageAnalysis();

  const objectUrl = useMemo(() => {
    if (!imageState.info.file) return undefined;
    const url = URL.createObjectURL(imageState.info.file);
    return url;
  }, [imageState.info.file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    resetAnalysis();
  }, [imageState.info.file, resetAnalysis]);

  useEffect(() => {
    if (!analysisEnabled) {
      resetAnalysis();
    }
  }, [analysisEnabled, resetAnalysis]);

  return (
    <div className={`app ${fullscreen ? 'fullscreen-open' : ''}`}>
      <InfoBlock />
      <main className="layout">
        <section className="column">
          <UploadZone imageState={imageState} onFileSelected={readImage} />
          <PreviewViewer
            preview={imageState.preview}
            boxes={summary?.boxes}
            showBoxes={showBoxes}
            onToggleFullscreen={setFullscreen}
            originalWidth={imageState.info.width}
            originalHeight={imageState.info.height}
          />
          <ContentAnalysisBlock
            enabled={analysisEnabled}
            setEnabled={setAnalysisEnabled}
            supported={analysisSupported}
            loading={analysisLoading}
            error={analysisError}
            summary={summary}
            showBoxes={showBoxes}
            setShowBoxes={setShowBoxes}
            onAnalyze={(image) => analyze(image)}
            imageSrc={objectUrl}
          />
          <CleanupBlock file={imageState.info.file} info={imageState.info} detections={summary} />
        </section>
        <section className="column">
          <MetadataPanel image={imageState} exif={exif} />
          <ShockBlock
            metadata={exif.metadata}
            timezone={timezoneApi.data}
            timezoneLoading={timezoneApi.loading}
            timezoneError={timezoneApi.error}
            onRetryTimezone={() => {
              if (!coords || !isoTimestamp) return;
              timezoneApi.call(
                `/timezone-and-holiday?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(isoTimestamp)}`
              );
            }}
            weather={weatherApi.data}
            weatherLoading={weatherApi.loading}
            weatherError={weatherApi.error}
            onRetryWeather={() => {
              if (!coords || !isoTimestamp) return;
              weatherApi.call(
                `/historical-weather?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(isoTimestamp)}`
              );
            }}
            pois={poiApi.data}
            poiLoading={poiApi.loading}
            poiError={poiApi.error}
            onRetryPoi={() => {
              if (!coords) return;
              poiApi.call(`/nearby-poi?lat=${coords.lat}&lon=${coords.lon}`);
            }}
            surveillance={surveillanceApi.data}
            surveillanceLoading={surveillanceApi.loading}
            surveillanceError={surveillanceApi.error}
            onRetrySurveillance={() => {
              if (!coords) return;
              surveillanceApi.call(`/surveillance-candidates?lat=${coords.lat}&lon=${coords.lon}`);
            }}
            address={addressApi.data}
            onRetryAddress={() => {
              if (!coords) return;
              addressApi.call(`/reverse-geocode?lat=${coords.lat}&lon=${coords.lon}`);
            }}
            addressLoading={addressApi.loading}
            addressError={addressApi.error}
            onManualCoords={manualCoords}
          />
          <MapBlock gps={exif.metadata?.gps} address={addressApi.data} />
        </section>
      </main>
      <ErrorBanner message={imageState.error ?? exif.error} />
    </div>
  );
}
