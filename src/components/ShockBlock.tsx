import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import type { StructuredMetadata, ManualCoordinates } from '../types/metadata';
import type {
  ReverseGeocodeResult,
  TimezoneHolidayResult,
  HistoricalWeatherResult,
  PoiResult
} from '../types/api';
import { useAPIFetch } from '../hooks/useAPIFetch';
import { ErrorBanner } from './ErrorBanner';
import { MapBlock } from './MapBlock';
import { googleMapsLink, streetViewLink } from '../utils/mapLinks';
import { formatDate, formatNumber } from '../utils/format';

interface ShockBlockProps {
  metadata: StructuredMetadata | null;
  manualCoords: ManualCoordinates | null;
  onManualCoordsChange: (coords: ManualCoordinates | null) => void;
}

export const ShockBlock: React.FC<ShockBlockProps> = ({ metadata, manualCoords, onManualCoordsChange }) => {
  const t = useT();
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');

  useEffect(() => {
    if (manualCoords) {
      setLatInput(manualCoords.lat.toFixed(5));
      setLonInput(manualCoords.lon.toFixed(5));
    } else if (metadata?.gps) {
      setLatInput(metadata.gps.lat.toFixed(5));
      setLonInput(metadata.gps.lon.toFixed(5));
    } else {
      setLatInput('');
      setLonInput('');
    }
  }, [manualCoords, metadata?.gps?.lat, metadata?.gps?.lon]);

  const coords = useMemo(() => {
    if (manualCoords) return manualCoords;
    if (metadata?.gps) {
      return { lat: metadata.gps.lat, lon: metadata.gps.lon };
    }
    return null;
  }, [manualCoords, metadata?.gps?.lat, metadata?.gps?.lon]);
  const timestamp = metadata?.shotDate ?? null;

  const reverseFetch = useAPIFetch<ReverseGeocodeResult>();
  const timezoneFetch = useAPIFetch<TimezoneHolidayResult>();
  const weatherFetch = useAPIFetch<HistoricalWeatherResult>();
  const poiFetch = useAPIFetch<PoiResult[]>();
  const surveillanceFetch = useAPIFetch<PoiResult[]>();

  useEffect(() => {
    if (!coords) return;
    reverseFetch.request(`/api/reverse-geocode?lat=${coords.lat}&lon=${coords.lon}`);
  }, [coords?.lat, coords?.lon]);

  useEffect(() => {
    if (!coords || !timestamp) return;
    timezoneFetch.request(
      `/api/timezone-and-holiday?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(timestamp)}`
    );
  }, [coords?.lat, coords?.lon, timestamp]);

  useEffect(() => {
    if (!coords || !timestamp) return;
    weatherFetch.request(
      `/api/historical-weather?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(timestamp)}`
    );
  }, [coords?.lat, coords?.lon, timestamp]);

  useEffect(() => {
    if (!coords) return;
    poiFetch.request(`/api/nearby-poi?lat=${coords.lat}&lon=${coords.lon}`);
    surveillanceFetch.request(`/api/surveillance-candidates?lat=${coords.lat}&lon=${coords.lon}`);
  }, [coords?.lat, coords?.lon]);

  const deviceNarrative = useMemo(() => buildDeviceNarrative(metadata, t), [metadata, t]);
  const mapAccuracy = metadata?.gps?.accuracy ?? reverseFetch.data?.precisionMeters ?? undefined;

  return (
    <section className="panel">
      <h2 className="section-title">{t('shockBlockTitle')}</h2>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <section>
          <h3 className="section-title" style={{ fontSize: '1.1rem' }}>
            {t('timezoneTitle')}
          </h3>
          {!timestamp ? <p className="notice">{t('timezoneMissing')}</p> : null}
          {timezoneFetch.loading ? <p>{t('timezoneLoading')}</p> : null}
          {timezoneFetch.error ? (
            <ErrorBanner
              message={t('timezoneError')}
              onRetry={() =>
                coords &&
                timestamp &&
                timezoneFetch.request(
                  `/api/timezone-and-holiday?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(timestamp)}`
                )
              }
            />
          ) : null}
          {timezoneFetch.data ? (
            <p>
              {t('timezoneResult', {
                time: formatDate(timezoneFetch.data.localTimeIso) ?? timezoneFetch.data.localTimeIso,
                timezone: timezoneFetch.data.timezone
              })}
              <br />
              {timezoneFetch.data.holiday
                ? `${t('holidayYes')}: ${timezoneFetch.data.holiday.name} (${timezoneFetch.data.holiday.countryCode})`
                : t('holidayNo')}
            </p>
          ) : null}
        </section>

        <section>
          <h3 className="section-title" style={{ fontSize: '1.1rem' }}>
            {t('mapTitle')}
          </h3>
          {!metadata?.gps && !manualCoords ? (
            <div>
              <p className="notice">{t('mapMissing')}</p>
              <div className="controls-row">
                <input
                  type="number"
                  value={latInput}
                  placeholder={t('manualLat')}
                  onChange={(event) => setLatInput(event.target.value)}
                />
                <input
                  type="number"
                  value={lonInput}
                  placeholder={t('manualLon')}
                  onChange={(event) => setLonInput(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    const latValue = latInput.trim();
                    const lonValue = lonInput.trim();
                    const lat = Number(latValue);
                    const lon = Number(lonValue);
                    if (latValue && lonValue && Number.isFinite(lat) && Number.isFinite(lon)) {
                      onManualCoordsChange({ lat, lon });
                    }
                  }}
                >
                  {t('applyManual')}
                </button>
              </div>
            </div>
          ) : null}
          {coords ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <MapBlock lat={coords.lat} lon={coords.lon} accuracy={mapAccuracy} />
              <div>
                <p>
                  <strong>{t('coordinatesLabel')}:</strong> {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
                </p>
                <p>
                  <strong>{t('accuracyLabel')}:</strong>{' '}
                  {metadata?.gps?.accuracy
                    ? t('accuracyMeters', { value: Math.round(metadata.gps.accuracy) })
                    : reverseFetch.data?.precisionMeters
                    ? t('accuracyMeters', { value: Math.round(reverseFetch.data.precisionMeters) })
                    : t('emptyValue')}
                </p>
                <div className="controls-row">
                  <a href={googleMapsLink(coords.lat, coords.lon)} target="_blank" rel="noreferrer noopener">
                    {t('openMaps')}
                  </a>
                  <a href={streetViewLink(coords.lat, coords.lon, metadata?.gps?.heading)} target="_blank" rel="noreferrer noopener">
                    {t('openStreetView')}
                  </a>
                </div>
              </div>
              {reverseFetch.loading ? <p>{t('mapLoading')}</p> : null}
              {reverseFetch.error ? (
                <ErrorBanner
                  message={t('reverseError')}
                  onRetry={() => reverseFetch.request(`/api/reverse-geocode?lat=${coords.lat}&lon=${coords.lon}`)}
                />
              ) : null}
              {reverseFetch.data ? (
                <div>
                  <p>
                    <strong>{t('addressLabel')}:</strong> {reverseFetch.data.address}
                  </p>
                  <p>
                    <strong>{t('countryLabel')}:</strong> {reverseFetch.data.country}{' '}
                    {reverseFetch.data.countryCode ? `(${reverseFetch.data.countryCode})` : ''}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="section-title" style={{ fontSize: '1.1rem' }}>
            {t('weatherTitle')}
          </h3>
          {!coords || !timestamp ? <p className="notice">{t('weatherMissing')}</p> : null}
          {weatherFetch.loading ? <p>{t('weatherLoading')}</p> : null}
          {weatherFetch.error ? (
            <ErrorBanner
              message={t('weatherError')}
              onRetry={() =>
                coords &&
                timestamp &&
                weatherFetch.request(
                  `/api/historical-weather?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(timestamp)}`
                )
              }
            />
          ) : null}
          {weatherFetch.data ? (
            <p>
              {t('weatherSummary', {
                temperature: formatNumber(weatherFetch.data.temperature, 1) ?? weatherFetch.data.temperature,
                precipitation: formatNumber(weatherFetch.data.precipitation, 1) ?? weatherFetch.data.precipitation,
                cloudCover: formatNumber(weatherFetch.data.cloudCover, 0) ?? weatherFetch.data.cloudCover,
                windSpeed: formatNumber(weatherFetch.data.windSpeed, 1) ?? weatherFetch.data.windSpeed,
                pressure: formatNumber(weatherFetch.data.pressure, 0) ?? weatherFetch.data.pressure
              })}
            </p>
          ) : null}
        </section>

        <section>
          <h3 className="section-title" style={{ fontSize: '1.1rem' }}>
            {t('poiTitle')}
          </h3>
          {poiFetch.loading ? <p>{t('poiLoading')}</p> : null}
          {poiFetch.error ? (
            <ErrorBanner
              message={t('poiError')}
              onRetry={() => coords && poiFetch.request(`/api/nearby-poi?lat=${coords.lat}&lon=${coords.lon}`)}
            />
          ) : null}
          {poiFetch.data?.length ? (
            <ul className="inline-list">
              {poiFetch.data.map((poi) => (
                <li key={`${poi.name}-${poi.distance}`}>
                  <strong>{poi.name || t('emptyValue')}</strong> — {poi.category} (
                  {t('accuracyMeters', { value: Math.round(poi.distance) })})
                </li>
              ))}
            </ul>
          ) : coords && !poiFetch.loading && !poiFetch.error ? (
            <p className="notice">{t('poiEmpty')}</p>
          ) : null}
        </section>

        <section>
          <h3 className="section-title" style={{ fontSize: '1.1rem' }}>
            {t('surveillanceTitle')}
          </h3>
          {surveillanceFetch.loading ? <p>{t('surveillanceLoading')}</p> : null}
          {surveillanceFetch.error ? (
            <ErrorBanner
              message={t('surveillanceError')}
              onRetry={() => coords && surveillanceFetch.request(`/api/surveillance-candidates?lat=${coords.lat}&lon=${coords.lon}`)}
            />
          ) : null}
          {surveillanceFetch.data?.length ? (
            <ul className="inline-list">
              {surveillanceFetch.data.map((poi) => (
                <li key={`${poi.name}-${poi.distance}`}>
                  <strong>{poi.name || poi.category}</strong> — {t('accuracyMeters', { value: Math.round(poi.distance) })}
                </li>
              ))}
            </ul>
          ) : coords && !surveillanceFetch.loading && !surveillanceFetch.error ? (
            <p className="notice">{t('surveillanceEmpty')}</p>
          ) : null}
        </section>

        <section>
          <h3 className="section-title" style={{ fontSize: '1.1rem' }}>
            {t('cameraModel')}
          </h3>
          <p>{deviceNarrative}</p>
        </section>
      </div>
    </section>
  );
};

function buildDeviceNarrative(metadata: StructuredMetadata | null, t: ReturnType<typeof useT>): string {
  if (!metadata) return t('emptyValue');
  const segments: string[] = [];
  if (metadata.cameraMake || metadata.cameraModel) {
    const device = [metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ');
    segments.push(t('narrativeCaptured', { device }));
  }
  if (metadata.lensModel) {
    segments.push(t('narrativeLens', { lens: metadata.lensModel }));
  }
  const exif = metadata.groups.exif as Record<string, unknown>;
  const xmp = metadata.groups.xmp as Record<string, unknown>;
  const icc = metadata.groups.icc as Record<string, unknown>;
  const software = typeof exif?.Software === 'string' ? exif.Software : undefined;
  if (software) {
    segments.push(t('narrativeSoftware', { software }));
  }
  if (xmp && Object.keys(xmp).length > 0) {
    segments.push(t('narrativeXmp'));
  }
  if (icc && Object.keys(icc).length > 0) {
    segments.push(t('narrativeIcc'));
  }
  if (segments.length === 0) {
    return t('narrativeInsufficient');
  }
  return segments.join(' ');
}
