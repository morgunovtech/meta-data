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
import { formatLocalizedDateTime, formatNumber } from '../utils/format';
import {
  describeDayPeriod,
  extractSoftware,
  hasReverseData,
  inferCameraPosition,
  inferMovement,
  resolveLocalTime,
  summarizeWeather,
  resolvePoiCategoryKey,
  resolveSurveillanceCategoryKey
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

type LocationSummary =
  | {
      kind: 'success';
      message: string;
      accuracy: number | null;
      precision?: number | null;
    }
  | {
      kind: 'error';
      message: string;
      accuracy: number | null;
      precision?: number | null;
    };

export const ShockBlock: React.FC<ShockBlockProps> = ({ metadata, manualCoords, onManualCoordsChange }) => {
  const t = useT();
  const { lang } = useI18n();
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  const gpsAccuracy = metadata?.gps?.accuracy;
  const gpsHeading = metadata?.gps?.heading;

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

  useEffect(() => {
    setCopyState('idle');
  }, [coords?.lat, coords?.lon]);

  const timestamp = metadata?.shotDate ?? null;

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
    timezoneFetch.request(
      `/api/timezone-and-holiday?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(timestamp)}`
    );
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
  const surveillanceItems = useMemo(() => (surveillanceFetch.data ?? []).slice(0, 5), [surveillanceFetch.data]);

  const localTimeDetails = useMemo(() => {
    if (!localContext.iso) return null;
    const date = new Date(localContext.iso);
    if (Number.isNaN(date.getTime())) return null;
    const formattedRaw = formatLocalizedDateTime(date, lang);
    if (!formattedRaw) return null;
    const normalized = formattedRaw.charAt(0).toLocaleUpperCase(lang) + formattedRaw.slice(1);
    return {
      formatted: normalized,
      periodKey: `dayPeriod${capitalize(describeDayPeriod(date))}` as MessageKey
    };
  }, [lang, localContext.iso]);

  useEffect(() => {
    if (copyState === 'idle' || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopy = useCallback(() => {
    if (!coords) return;
    const text = `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
    if (!navigator?.clipboard) {
      setCopyState('error');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => setCopyState('success'))
      .catch(() => setCopyState('error'));
  }, [coords]);

  const locationSummary = useMemo<LocationSummary | null>(() => {
    if (!coords) return null;
    if (reverseFetch.error || !hasReverseData(reverseFetch.data)) {
      return {
        kind: 'error',
        message: t('insightLocationError', {
          lat: coords.lat.toFixed(5),
          lon: coords.lon.toFixed(5)
        }),
        accuracy: gpsAccuracy ?? null
      };
    }
    if (!reverseFetch.data) {
      return null;
    }
    const data = reverseFetch.data;
    const streetLine = data.houseNumber ? `${data.street ?? ''} ${data.houseNumber}`.trim() : data.street ?? '';
    const parts = [data.country, data.city, data.district, streetLine].filter(Boolean);
    const addressValue = parts.length > 0 ? parts.join(', ') : data.address;
    return {
      kind: 'success',
      message: t('insightLocationLine', { value: addressValue }),
      accuracy: gpsAccuracy ?? null,
      precision: data.precisionMeters ?? null
    };
  }, [coords, reverseFetch.data, reverseFetch.error, gpsAccuracy, t]);

  const timezoneDisplay = useMemo(() => {
    if (!localContext.timezone) {
      return t('insightTimeTimezoneUnknown');
    }
    const offsetMatch = localContext.iso?.match(/[+-]\d{2}:\d{2}$/);
    if (offsetMatch) {
      return `${localContext.timezone} (UTC${offsetMatch[0]})`;
    }
    return localContext.timezone;
  }, [localContext.iso, localContext.timezone, t]);
  const holidayText = localContext.holidayName
    ? t('insightTimeHoliday', { holiday: localContext.holidayName, code: localContext.holidayCode ?? t('emptyValue') })
    : t('insightTimeNoHoliday');

  const insights = useMemo<InsightItem[]>(() => {
    const entries: InsightItem[] = [];

    if (coords) {
      if (!locationSummary && !reverseFetch.error) {
        entries.push({
          id: 'location-loading',
          severity: 'info',
          title: t('insightLocationTitle'),
          content: <p>{t('insightLoading')}</p>
        });
      } else if (locationSummary) {
        const accuracyValue = locationSummary.accuracy ?? locationSummary.precision ?? null;
        const coordText = t('insightLocationCoordinatesLabel', {
          lat: coords.lat.toFixed(5),
          lon: coords.lon.toFixed(5)
        });
        const statusText =
          copyState === 'success'
            ? t('insightLocationCopied')
            : copyState === 'error'
            ? t('insightCopyFailed')
            : t('insightLocationCopyHint');
        entries.push({
          id: 'location',
          severity: 'high',
          title: t('insightLocationTitle'),
          content: (
            <div className="insight-content">
              <ul className="insight-location-list">
                <li>{locationSummary.message}</li>
                {accuracyValue != null ? (
                  <li>{t('insightLocationPrecision', { accuracy: Math.round(accuracyValue) })}</li>
                ) : null}
                <li>
                  <button
                    type="button"
                    className="insight-coordinates-button"
                    onClick={handleCopy}
                    aria-label={t('insightLocationCopy')}
                  >
                    {coordText}
                  </button>
                  <span className="insight-coordinates-status" aria-live="polite">
                    {statusText}
                  </span>
                </li>
              </ul>
              <div className="insight-actions">
                <a
                  className="button button--ghost"
                  href={googleMapsLink(coords.lat, coords.lon)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t('openMaps')}
                </a>
                <a
                  className="button button--ghost"
                  href={streetViewLink(coords.lat, coords.lon, gpsHeading)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t('openStreetView')}
                </a>
              </div>
            </div>
          )
        });
      } else {
        entries.push({
          id: 'location-missing',
          severity: 'info',
          title: t('insightLocationTitle'),
          content: <p>{t('insightLocationMissing')}</p>
        });
      }
    } else {
      entries.push({
        id: 'location-missing',
        severity: 'info',
        title: t('insightLocationTitle'),
        content: <p>{t('insightLocationMissing')}</p>
      });
    }

    if (localTimeDetails?.formatted) {
      entries.push({
        id: 'time',
        severity: 'high',
        title: t('insightTimeTitle'),
        content: (
          <div className="insight-content">
            <p>{t('insightTimeValue', { date: `${localTimeDetails.formatted} (${t(localTimeDetails.periodKey)})` })}</p>
            <p>{t('insightTimeZone', { timezone: timezoneDisplay })}</p>
            <p>{holidayText}</p>
          </div>
        )
      });
    } else {
      entries.push({
        id: 'time-missing',
        severity: 'medium',
        title: t('insightTimeTitle'),
        content: <p>{t('insightTimeMissing')}</p>
      });
    }

    const deviceName = [metadata?.cameraMake, metadata?.cameraModel].filter(Boolean).join(' ');
    if (deviceName) {
      const facingKey =
        cameraPosition === 'front'
          ? 'cameraFacingFront'
          : cameraPosition === 'rear'
          ? 'cameraFacingRear'
          : null;
      const facing = facingKey ? t(facingKey as MessageKey) : null;
      const summary = facing ? `${deviceName} — ${facing}` : deviceName;
      entries.push({
        id: 'device',
        severity: 'high',
        title: t('insightDeviceTitle'),
        content: <p>{t('insightDeviceSummary', { device: summary })}</p>
      });
    } else {
      entries.push({
        id: 'device-missing',
        severity: 'info',
        title: t('insightDeviceTitle'),
        content: <p>{t('insightDeviceUnknown')}</p>
      });
    }

    if (software) {
      entries.push({
        id: 'software',
        severity: 'medium',
        title: t('insightSoftwareTitle'),
        content: <p>{t('insightSoftwareValue', { software })}</p>
      });
    } else {
      entries.push({
        id: 'software-missing',
        severity: 'info',
        title: t('insightSoftwareTitle'),
        content: <p>{t('insightSoftwareUnknown')}</p>
      });
    }

    if (movement) {
      const speed = movement.speedKmh ? formatNumber(movement.speedKmh, 1) : undefined;
      const key = movement.moving ? 'insightMovementMoving' : 'insightMovementStill';
      entries.push({
        id: 'movement',
        severity: movement.moving ? 'high' : 'medium',
        title: t('insightMovementTitle'),
        content: <p>{t(key, speed ? { speed } : {})}</p>
      });
    }

    if (coords && timestamp) {
      if (weatherFetch.loading) {
        entries.push({
          id: 'weather-loading',
          severity: 'info',
          title: t('insightWeatherTitle'),
          content: <p>{t('insightLoading')}</p>
        });
      } else if (weatherFetch.error) {
        entries.push({
          id: 'weather-error',
          severity: 'info',
          title: t('insightWeatherTitle'),
          content: <p>{t('insightWeatherError')}</p>
        });
      } else if (weatherSummary) {
        entries.push({
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
      entries.push({
        id: 'weather-missing',
        severity: 'info',
        title: t('insightWeatherTitle'),
        content: <p>{t('insightWeatherMissing')}</p>
      });
    }

    if (poiFetch.loading) {
      entries.push({
        id: 'poi-loading',
        severity: 'info',
        title: t('insightPoiTitle'),
        content: <p>{t('insightLoading')}</p>
      });
    } else if (poiFetch.error) {
      entries.push({
        id: 'poi-error',
        severity: 'info',
        title: t('insightPoiTitle'),
        content: <p>{t('insightPoiError')}</p>
      });
    } else if (poiItems.length > 0) {
      entries.push({
        id: 'poi',
        severity: 'medium',
        title: t('insightPoiTitle'),
        content: (
          <div className="insight-content">
            <p>{t('insightPoiListIntro')}</p>
            <ul className="insight-sublist">
              {poiItems.map((poi, index) => {
                const categoryLabel = t(resolvePoiCategoryKey(poi.category));
                const name = poi.name || t('insightPoiUnnamed', { category: categoryLabel });
                return (
                  <li key={`${poi.category}-${index}`}>
                    {t('insightPoiItem', {
                      category: categoryLabel,
                      name,
                      distance: Math.round(poi.distance)
                    })}
                  </li>
                );
              })}
            </ul>
          </div>
        )
      });
    } else {
      entries.push({
        id: 'poi-empty',
        severity: 'info',
        title: t('insightPoiTitle'),
        content: <p>{t('insightPoiEmpty')}</p>
      });
    }

    if (surveillanceFetch.loading) {
      entries.push({
        id: 'surveillance-loading',
        severity: 'info',
        title: t('insightSurveillanceTitle'),
        content: <p>{t('insightLoading')}</p>
      });
    } else if (surveillanceFetch.error) {
      entries.push({
        id: 'surveillance-error',
        severity: 'info',
        title: t('insightSurveillanceTitle'),
        content: <p>{t('insightSurveillanceError')}</p>
      });
    } else if (surveillanceItems.length > 0) {
      entries.push({
        id: 'surveillance',
        severity: 'high',
        title: t('insightSurveillanceTitle'),
        content: (
          <div className="insight-content">
            <p>{t('insightSurveillanceListIntro')}</p>
            <ul className="insight-sublist">
              {surveillanceItems.map((poi, index) => {
                const categoryLabel = t(resolveSurveillanceCategoryKey(poi.category));
                return (
                  <li key={`${poi.category}-${index}`}>
                    {t('insightSurveillanceItem', {
                      category: categoryLabel,
                      distance: Math.round(poi.distance)
                    })}
                  </li>
                );
              })}
            </ul>
          </div>
        )
      });
    } else {
      entries.push({
        id: 'surveillance-empty',
        severity: 'info',
        title: t('insightSurveillanceTitle'),
        content: <p>{t('insightSurveillanceEmpty')}</p>
      });
    }

    return entries;
  }, [
    coords,
    locationSummary,
    t,
    gpsHeading,
    handleCopy,
    copyState,
    localTimeDetails,
    timezoneDisplay,
    holidayText,
    metadata?.cameraMake,
    metadata?.cameraModel,
    cameraPosition,
    software,
    movement,
    weatherFetch.loading,
    weatherFetch.error,
    weatherSummary,
    poiFetch.loading,
    poiFetch.error,
    poiItems,
    surveillanceFetch.loading,
    surveillanceFetch.error,
    surveillanceItems,
    timestamp,
    reverseFetch.loading,
    reverseFetch.error
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
