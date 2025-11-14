import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, useT } from '../i18n';
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
import { formatCoordinatePair, formatLocalizedDateTime, formatNumber } from '../utils/format';
import {
  describeDayPeriod,
  extractSoftware,
  hasReverseData,
  inferCameraPosition,
  inferMovement,
  resolveLocalTime,
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
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

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
  const surveillanceItems = useMemo(() => (surveillanceFetch.data ?? []).slice(0, 5), [surveillanceFetch.data]);

  const localTimeDetails = useMemo(() => {
    if (!timestamp) return null;
    const formatted = formatLocalizedDateTime(timestamp, lang, localContext.timezone);
    if (!formatted) return null;
    const periodKey = `dayPeriod${capitalize(describeDayPeriod(new Date(timestamp)))}` as const;
    return {
      formatted: formatted.formatted,
      weekday: formatted.weekday,
      periodKey
    };
  }, [lang, localContext.timezone, timestamp]);

  const handleCopyCoords = useCallback(() => {
    if (!coords) return;
    const text = formatCoordinatePair(coords.lat, coords.lon);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch((error) => console.warn('clipboard', error));
    }
    setCopied(true);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 2000);
  }, [coords]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    []
  );

  const insights = useMemo<InsightItem[]>(() => {
    const list: InsightItem[] = [];
    const formatCategory = (category: string) =>
      category
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    if (coords) {
      const location = hasReverseData(reverseFetch.data) ? reverseFetch.data : null;
      const addressLine = location
        ? [
            location.country ?? t('emptyValue'),
            location.city ?? t('emptyValue'),
            location.district ?? t('emptyValue'),
            location.street ?? t('emptyValue'),
            location.houseNumber ?? t('emptyValue')
          ]
            .map((part) => part || t('emptyValue'))
            .join(', ')
        : `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`;
      const accuracyMeters = metadata?.gps?.accuracy ?? location?.precisionMeters;
      const accuracyText =
        accuracyMeters != null
          ? t('insightLocationAccuracyDetailed', { accuracy: Math.round(Math.max(accuracyMeters, 0)) })
          : t('insightLocationAccuracyUnknown');

      list.push({
        id: 'location',
        severity: 'high',
        title: t('insightLocationTitle'),
        content: (
          <div className="insight-content">
            {reverseFetch.loading ? (
              <p>{t('insightLoading')}</p>
            ) : reverseFetch.error ? (
              <p>
                {t('insightLocationError', {
                  lat: coords.lat.toFixed(5),
                  lon: coords.lon.toFixed(5)
                })}
              </p>
            ) : (
              <p>{t('insightLocationLine', { line: addressLine })}</p>
            )}
            <ul className="insight-sublist">
              <li>{accuracyText}</li>
              <li>
                <button type="button" className="link-button" onClick={handleCopyCoords}>
                  {t('insightLocationCoordinatesCopy', {
                    coords: formatCoordinatePair(coords.lat, coords.lon)
                  })}
                </button>
                {copied ? <span className="copy-success">{t('coordinatesCopied')}</span> : null}
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
      list.push({
        id: 'time',
        severity: 'high',
        title: t('insightTimeTitle'),
        content: (
          <div className="insight-content">
            <p>
              {t('insightTimeValue', {
                date: localTimeDetails.formatted,
                weekday: localTimeDetails.weekday,
                period: t(localTimeDetails.periodKey)
              })}
            </p>
            <p>{t('insightTimeZone', { timezone: timezoneText })}</p>
            <p>{holidayText}</p>
          </div>
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

    if (metadata?.cameraMake || metadata?.cameraModel) {
      const deviceName = [metadata?.cameraMake, metadata?.cameraModel].filter(Boolean).join(' ');
      const cameraKey =
        cameraPosition === 'front'
          ? 'cameraPositionFront'
          : cameraPosition === 'rear'
          ? 'cameraPositionRear'
          : 'cameraPositionUnknown';
      const deviceText = t('insightDevicePersona', {
        device: deviceName,
        camera: t(cameraKey)
      });
      list.push({
        id: 'device',
        severity: 'high',
        title: t('insightDeviceTitle'),
        content: <p>{deviceText}</p>
      });
    } else {
      list.push({
        id: 'device-missing',
        severity: 'info',
        title: t('insightDeviceTitle'),
        content: <p>{t('insightDeviceUnknown')}</p>
      });
    }

    if (software) {
      list.push({
        id: 'software',
        severity: 'medium',
        title: t('insightOsTitle'),
        content: <p>{t('insightOsValue', { software })}</p>
      });
    }

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
              {t('insightWeatherBrief', {
                temperature: Math.round(weatherSummary.temperature),
                precipitation: weatherSummary.precipitation.toFixed(1),
                cloud: Math.round(weatherSummary.cloudCover),
                wind: Math.round(weatherSummary.windSpeed)
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

    if (!poiFetch.loading) {
      if (poiFetch.error) {
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
            <ul className="insight-sublist">
              {poiItems.map((poi) => (
                <li key={`${poi.category}-${poi.name}-${poi.distance}`}>
                  {t('insightPoiItem', {
                    name: poi.name || t('insightPoiUnnamed', { category: formatCategory(poi.category) }),
                    distance: Math.round(poi.distance),
                    category: formatCategory(poi.category)
                  })}
                </li>
              ))}
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
    }

    if (!surveillanceFetch.loading) {
      if (surveillanceFetch.error) {
        list.push({
          id: 'surveillance-error',
          severity: 'info',
          title: t('insightSurveillanceTitle'),
          content: <p>{t('insightSurveillanceError')}</p>
        });
      } else if (surveillanceItems.length > 0) {
        list.push({
          id: 'surveillance',
          severity: 'high',
          title: t('insightSurveillanceTitle'),
          content: (
            <ul className="insight-sublist">
              {surveillanceItems.map((item) => (
                <li key={`${item.category}-${item.name}-${item.distance}`}>
                  {t('insightSurveillanceItem', {
                    name: item.name || t('insightPoiUnnamed', { category: formatCategory(item.category) }),
                    distance: Math.round(item.distance),
                    category: formatCategory(item.category)
                  })}
                </li>
              ))}
            </ul>
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
    }

    return list;
  }, [
    coords,
    reverseFetch.loading,
    reverseFetch.error,
    reverseFetch.data,
    gpsHeading,
    t,
    localTimeDetails,
    localContext.holidayName,
    localContext.holidayCode,
    localContext.timezone,
    metadata?.cameraMake,
    metadata?.cameraModel,
    software,
    cameraPosition,
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
    metadata?.gps?.accuracy,
    handleCopyCoords,
    copied
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
                onRetry={() => coords && surveillanceFetch.request(`/api/surveillance-candidates?lat=${coords.lat}&lon=${coords.lon}`)}
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
