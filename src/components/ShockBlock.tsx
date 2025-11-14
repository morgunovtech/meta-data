import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n, useT, type MessageKey } from '../i18n';
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
import { formatNumber, formatLocalizedDateTime } from '../utils/format';
import {
  describeDayPeriod,
  extractSoftware,
  hasReverseData,
  inferCameraPosition,
  inferMovement,
  resolveLocalTime,
  summarizeSurveillance,
  summarizeWeather
} from '../utils/insights';

type InsightSeverity = 'high' | 'medium' | 'info';

interface InsightItem {
  id: string;
  severity: InsightSeverity;
  title: string;
  content: React.ReactNode;
}

interface ShockBlockProps {
  metadata: StructuredMetadata | null;
  manualCoords: ManualCoordinates | null;
  onManualCoordsChange: (coords: ManualCoordinates | null) => void;
}

export const ShockBlock: React.FC<ShockBlockProps> = ({ metadata, manualCoords, onManualCoordsChange }) => {
  const t = useT();
  const { lang } = useI18n();
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const gpsAccuracy = metadata?.gps?.accuracy;
  const gpsHeading = metadata?.gps?.heading;
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

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
    setCopyState('idle');
  }, [manualCoords, metadata?.gps?.lat, metadata?.gps?.lon]);

  const coords = useMemo(() => {
    if (manualCoords) return manualCoords;
    if (metadata?.gps) {
      return { lat: metadata.gps.lat, lon: metadata.gps.lon };
    }
    return null;
  }, [manualCoords, metadata?.gps?.lat, metadata?.gps?.lon]);
  const timestamp = metadata?.shotDate ?? null;

  const coordsLabel = coords ? `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` : '';

  const handleCopyCoordinates = useCallback(() => {
    if (!coords) return;
    const value = coordsLabel;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(() => setCopyState('copied'))
        .catch(() => setCopyState('error'));
      return;
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyState('copied');
    } catch (error) {
      console.error('copy-coords', error);
      setCopyState('error');
    }
  }, [coords, coordsLabel]);

  const reverseFetch = useAPIFetch<ReverseGeocodeResult>();
  const timezoneFetch = useAPIFetch<TimezoneHolidayResult>();
  const weatherFetch = useAPIFetch<HistoricalWeatherResult>();
  const poiFetch = useAPIFetch<PoiResult[]>();
  const surveillanceFetch = useAPIFetch<PoiResult[]>();

  useEffect(() => {
    if (!coords) return;
    reverseFetch.request(`/api/reverse-geocode?lat=${coords.lat}&lon=${coords.lon}`);
  }, [coords]);

  useEffect(() => {
    if (!coords || !timestamp) return;
    timezoneFetch.request(`/api/timezone-and-holiday?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(timestamp)}`);
  }, [coords, timestamp]);

  useEffect(() => {
    if (!coords || !timestamp) return;
    weatherFetch.request(`/api/historical-weather?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(timestamp)}`);
  }, [coords, timestamp]);

  useEffect(() => {
    if (!coords) return;
    poiFetch.request(`/api/nearby-poi?lat=${coords.lat}&lon=${coords.lon}`);
    surveillanceFetch.request(`/api/surveillance-candidates?lat=${coords.lat}&lon=${coords.lon}`);
  }, [coords]);

  const software = useMemo(() => extractSoftware(metadata), [metadata]);
  const cameraPosition = useMemo(() => inferCameraPosition(metadata), [metadata]);
  const movement = useMemo(() => inferMovement(metadata), [metadata]);
  const localContext = useMemo(() => resolveLocalTime(metadata, timezoneFetch.data ?? null), [metadata, timezoneFetch.data]);
  const weatherSummary = useMemo(() => summarizeWeather(weatherFetch.data ?? null), [weatherFetch.data]);
  const poiItems = useMemo(() => (poiFetch.data ?? []).slice(0, 5), [poiFetch.data]);
  const surveillanceItems = useMemo(
    () => (surveillanceFetch.data ?? []).slice(0, 5),
    [surveillanceFetch.data]
  );
  const surveillanceSummary = useMemo(() => summarizeSurveillance(surveillanceFetch.data ?? null), [surveillanceFetch.data]);

  const localTimeDetails = useMemo(() => {
    if (!localContext.iso) return null;
    const date = new Date(localContext.iso);
    if (Number.isNaN(date.getTime())) return null;
    const formatted = formatLocalizedDateTime(date, lang);
    const weekday = new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(date);
    const periodKey = `dayPeriod${capitalize(describeDayPeriod(date))}` as const;
    return {
      formatted,
      weekday,
      periodKey
    };
  }, [lang, localContext.iso]);

  const insights = useMemo<InsightItem[]>(() => {
    const list: InsightItem[] = [];

    if (coords) {
      const reverseData = hasReverseData(reverseFetch.data) ? reverseFetch.data : null;
      const accuracyMeters = gpsAccuracy ?? reverseData?.precisionMeters ?? null;
      const accuracyText = accuracyMeters != null
        ? t('insightLocationPrecisionLine', {
            accuracy: t('accuracyMeters', { value: Math.max(1, Math.round(accuracyMeters)) })
          })
        : null;
      const primaryLine = reverseFetch.loading
        ? t('insightLoading')
        : reverseData
        ? t('insightLocationLine', {
            country: reverseData.country ?? t('emptyValue'),
            city: reverseData.city ?? t('emptyValue'),
            district: reverseData.district ?? t('emptyValue'),
            street: reverseData.road ?? t('emptyValue'),
            house: reverseData.houseNumber ?? t('emptyValue')
          })
        : t('insightLocationFallback', { coords: coordsLabel });

      list.push({
        id: 'location',
        severity: 'high',
        title: t('insightLocationTitle'),
        content: (
          <div className="insight-content">
            <ul className="insight-detail-list">
              <li>{primaryLine}</li>
              {accuracyText ? <li>{accuracyText}</li> : null}
              <li className="insight-copy">
                <button type="button" className="link-button" onClick={handleCopyCoordinates}>
                  {t('insightLocationCoords', { coords: coordsLabel })}
                </button>
                <span className="copy-feedback">
                  {copyState === 'copied'
                    ? t('copied')
                    : copyState === 'error'
                    ? t('copyFailed')
                    : t('copyHint')}
                </span>
              </li>
            </ul>
            <div className="insight-actions">
              <a className="button button--ghost" href={googleMapsLink(coords.lat, coords.lon)} target="_blank" rel="noreferrer">
                {t('openMaps')}
              </a>
              <a className="button button--ghost" href={streetViewLink(coords.lat, coords.lon, gpsHeading)} target="_blank" rel="noreferrer">
                {t('openStreetView')}
              </a>
            </div>
          </div>
        )
      });
    } else {
      list.push({
        id: 'location-missing',
        severity: 'info',
        title: t('insightLocationTitle'),
        content: <p>{t('insightLocationMissing')}</p>
      });
    }

    if (localTimeDetails) {
      const holidayText = localContext.holidayName
        ? t('insightTimeHoliday', {
            holiday: localContext.holidayName,
            code: localContext.holidayCode ?? t('emptyValue')
          })
        : t('insightTimeNoHoliday');
      const timezoneText = localContext.timezone ?? t('insightTimeTimezoneUnknown');
      const periodLabel = t(localTimeDetails.periodKey as MessageKey);
      list.push({
        id: 'time',
        severity: 'high',
        title: t('insightTimeTitle'),
        content: (
          <ul className="insight-detail-list">
            <li>{t('insightTimeValue', { datetime: localTimeDetails.formatted })}</li>
            <li>{t('insightTimePeriod', { period: periodLabel })}</li>
            <li>{t('insightTimeZone', { timezone: timezoneText })}</li>
            <li>{holidayText}</li>
          </ul>
        )
      });
    } else {
      list.push({
        id: 'time-missing',
        severity: 'medium',
        title: t('insightTimeTitle'),
        content: <p>{t('insightTimeMissing')}</p>
      });
    }

    const deviceName = [metadata?.cameraMake, metadata?.cameraModel].filter(Boolean).join(' ');
    const cameraKey = cameraPosition !== 'unknown' ? (`cameraPlacement${capitalize(cameraPosition)}` as MessageKey) : null;
    const positionLabel = cameraKey ? t(cameraKey) : '';
    const deviceLine = [deviceName, positionLabel].filter(Boolean).join(', ');

    list.push({
      id: 'device',
      severity: deviceLine ? 'high' : 'info',
      title: t('insightDeviceTitle'),
      content: <p>{deviceLine || t('insightDeviceUnknown')}</p>
    });

    list.push({
      id: 'software',
      severity: software ? 'medium' : 'info',
      title: t('insightOsTitle'),
      content: <p>{software ? t('insightOsValue', { software }) : t('insightOsUnknown')}</p>
    });

    list.push({
      id: 'camera-position',
      severity: cameraPosition === 'front' ? 'high' : 'medium',
      title: t('insightCameraTitle'),
      content: <p>{t(cameraPosition === 'front' ? 'insightCameraFront' : cameraPosition === 'rear' ? 'insightCameraRear' : 'insightCameraUnknown')}</p>
    });

    if (movement) {
      const speed = movement.speedKmh ? formatNumber(movement.speedKmh, 1) : undefined;
      const key = movement.moving ? 'insightMovementMoving' : 'insightMovementStill';
      list.push({
        id: 'movement',
        severity: movement.moving ? 'high' : 'medium',
        title: t('insightMovementTitle'),
        content: <p>{t(key, speed ? { speed } : {})}</p>
      });
    }

    if (coords && timestamp) {
      if (weatherFetch.loading) {
        list.push({
          id: 'weather-loading',
          severity: 'info',
          title: t('insightWeatherTitle'),
          content: <p>{t('insightLoading')}</p>
        });
      } else if (weatherFetch.error) {
        list.push({
          id: 'weather-error',
          severity: 'info',
          title: t('insightWeatherTitle'),
          content: <p>{t('insightWeatherError')}</p>
        });
      } else if (weatherSummary) {
        list.push({
          id: 'weather',
          severity: 'medium',
          title: t('insightWeatherTitle'),
          content: (
            <p>
              {t('insightWeatherValue', {
                temperature: Math.round(weatherSummary.temperature),
                precipitation: weatherSummary.precipitation.toFixed(1),
                cloud: Math.round(weatherSummary.cloudCover),
                wind: Math.round(weatherSummary.windSpeed),
                pressure: Math.round(weatherSummary.pressure)
              })}
            </p>
          )
        });
      }
    } else {
      list.push({
        id: 'weather-missing',
        severity: 'info',
        title: t('insightWeatherTitle'),
        content: <p>{t('insightWeatherMissing')}</p>
      });
    }

    if (poiFetch.loading) {
      list.push({
        id: 'poi-loading',
        severity: 'info',
        title: t('insightPoiTitle'),
        content: <p>{t('insightLoading')}</p>
      });
    } else if (poiFetch.error) {
      list.push({
        id: 'poi-error',
        severity: 'info',
        title: t('insightPoiTitle'),
        content: <p>{t('insightPoiError')}</p>
      });
    } else if (poiItems.length > 0) {
      list.push({
        id: 'poi',
        severity: 'medium',
        title: t('insightPoiTitle'),
        content: (
          <ul className="insight-detail-list">
            {poiItems.map((item, index) => {
              const formattedCategory = humanizeCategory(item.category);
              const name = item.name || t('insightPoiUnnamed', { category: formattedCategory });
              return (
                <li key={`${name}-${index}`}>
                  {t('insightPoiListItem', {
                    name,
                    category: formattedCategory,
                    distance: Math.round(item.distance)
                  })}
                </li>
              );
            })}
          </ul>
        )
      });
    } else {
      list.push({
        id: 'poi-empty',
        severity: 'info',
        title: t('insightPoiTitle'),
        content: <p>{t('insightPoiEmpty')}</p>
      });
    }

    if (surveillanceFetch.loading) {
      list.push({
        id: 'surveillance-loading',
        severity: 'info',
        title: t('insightSurveillanceTitle'),
        content: <p>{t('insightLoading')}</p>
      });
    } else if (surveillanceFetch.error) {
      list.push({
        id: 'surveillance-error',
        severity: 'info',
        title: t('insightSurveillanceTitle'),
        content: <p>{t('insightSurveillanceError')}</p>
      });
    } else if (surveillanceItems.length > 0 && surveillanceSummary) {
      list.push({
        id: 'surveillance',
        severity: 'high',
        title: t('insightSurveillanceTitle'),
        content: (
          <div className="insight-content">
            <p>
              {t('insightSurveillanceValue', {
                count: surveillanceSummary.count,
                distance: surveillanceSummary.nearest ? Math.round(surveillanceSummary.nearest) : 0
              })}
            </p>
            <ul className="insight-detail-list">
              {surveillanceItems.map((item, index) => (
                <li key={`${item.category}-${index}`}>
                  {t('insightSurveillanceItem', {
                    category: humanizeCategory(item.category),
                    distance: Math.round(item.distance)
                  })}
                </li>
              ))}
            </ul>
          </div>
        )
      });
    } else {
      list.push({
        id: 'surveillance-empty',
        severity: 'info',
        title: t('insightSurveillanceTitle'),
        content: <p>{t('insightSurveillanceEmpty')}</p>
      });
    }

    return list;
  }, [
    coords,
    coordsLabel,
    gpsAccuracy,
    reverseFetch.loading,
    reverseFetch.data,
    handleCopyCoordinates,
    copyState,
    gpsHeading,
    t,
    localTimeDetails,
    localContext.holidayName,
    localContext.holidayCode,
    localContext.timezone,
    metadata?.cameraMake,
    metadata?.cameraModel,
    cameraPosition,
    software,
    movement,
    weatherFetch.loading,
    weatherFetch.error,
    weatherSummary,
    timestamp,
    poiFetch.loading,
    poiFetch.error,
    poiItems,
    surveillanceFetch.loading,
    surveillanceFetch.error,
    surveillanceItems,
    surveillanceSummary
  ]);

  return (
    <section className="panel">
      <h2 className="section-title">{t('shockBlockTitle')}</h2>
      <p className="insight-lead">{t('insightLead')}</p>

      {!metadata?.gps && !manualCoords ? (
        <div className="manual-coords">
          <p>{t('mapMissing')}</p>
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
                const lat = Number(latInput);
                const lon = Number(lonInput);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                  onManualCoordsChange({ lat, lon });
                }
              }}
            >
              {t('applyManual')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="insights-layout">
        <div className="insight-column">
          <ul className="insight-list">
            {insights.map((insight) => (
              <li key={insight.id} className={`insight-item insight-item--${insight.severity}`}>
                <h3>{insight.title}</h3>
                {insight.content}
              </li>
            ))}
          </ul>
          <div className="insight-errors">
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
            {reverseFetch.error ? (
              <ErrorBanner
                message={t('reverseError')}
                onRetry={() => coords && reverseFetch.request(`/api/reverse-geocode?lat=${coords.lat}&lon=${coords.lon}`)}
              />
            ) : null}
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
            {poiFetch.error ? (
              <ErrorBanner
                message={t('poiError')}
                onRetry={() => coords && poiFetch.request(`/api/nearby-poi?lat=${coords.lat}&lon=${coords.lon}`)}
              />
            ) : null}
            {surveillanceFetch.error ? (
              <ErrorBanner
                message={t('insightSurveillanceError')}
                onRetry={() =>
                  coords && surveillanceFetch.request(`/api/surveillance-candidates?lat=${coords.lat}&lon=${coords.lon}`)
                }
              />
            ) : null}
          </div>
        </div>
        {coords ? (
          <aside className="map-column" aria-label={t('mapTitle')}>
            <MapBlock lat={coords.lat} lon={coords.lon} accuracy={gpsAccuracy} />
            <ul className="map-meta">
              <li>
                {t('coordinatesLabel')}: {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
              </li>
              <li>
                {t('accuracyLabel')}: {gpsAccuracy ? t('accuracyMeters', { value: Math.round(gpsAccuracy) }) : t('emptyValue')}
              </li>
            </ul>
          </aside>
        ) : null}
      </div>
    </section>
  );
};

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanizeCategory(value: string): string {
  if (!value) return value;
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
