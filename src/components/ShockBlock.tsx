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
import { formatMeters, formatNumber } from '../utils/format';
import {
  extractSoftware,
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

  const handleCopyCoordinates = useCallback(() => {
    if (!coords) return;
    const text = `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
    const markCopied = () => {
      setCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(markCopied)
        .catch(() => {
          markCopied();
        });
    } else {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        markCopied();
      } catch (error) {
        console.warn('copy-coordinates', error);
      }
    }
  }, [coords]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCopied(false);
  }, [coords?.lat, coords?.lon]);

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

  const localTimeDetails = useMemo(() => {
    const iso = metadata?.shotDate ?? localContext.iso;
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    if (localContext.timezone) {
      options.timeZone = localContext.timezone;
    }
    const formatted = new Intl.DateTimeFormat(lang, options).format(date);
    return { formatted };
  }, [lang, localContext.iso, localContext.timezone, metadata?.shotDate]);

  const reverseData = reverseFetch.data ?? null;
  const accuracyMeters = useMemo(() => {
    const candidates = [metadata?.gps?.accuracy, reverseData?.precisionMeters]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    if (candidates.length === 0) {
      return null;
    }
    return Math.min(...candidates);
  }, [metadata?.gps?.accuracy, reverseData?.precisionMeters]);

  const locationSummary = useMemo(() => {
    if (!reverseData) return null;
    const parts: string[] = [];
    if (reverseData.country) {
      parts.push(t('insightLocationCountry', { value: reverseData.country }));
    }
    if (reverseData.city) {
      parts.push(t('insightLocationCity', { value: reverseData.city }));
    }
    const district = reverseData.district ?? reverseData.state;
    if (district) {
      parts.push(t('insightLocationDistrict', { value: district }));
    }
    if (reverseData.road) {
      parts.push(t('insightLocationStreet', { value: reverseData.road }));
    }
    if (reverseData.houseNumber) {
      parts.push(t('insightLocationHouse', { value: reverseData.houseNumber }));
    }
    if (parts.length === 0) {
      return null;
    }
    return parts.join(', ');
  }, [reverseData, t]);

  const insights = useMemo<InsightItem[]>(() => {
    const list: InsightItem[] = [];

    if (coords) {
      const coordinateParams = {
        lat: coords.lat.toFixed(5),
        lon: coords.lon.toFixed(5)
      };
      let primarySection: React.ReactNode;
      if (reverseFetch.loading) {
        primarySection = <p>{t('insightLoading')}</p>;
      } else if (reverseFetch.error) {
        primarySection = (
          <p>
            {t('insightLocationError', {
              lat: coords.lat.toFixed(5),
              lon: coords.lon.toFixed(5)
            })}
          </p>
        );
      } else if (reverseData) {
        primarySection = (
          <div className="insight-location-details">
            {reverseData.address ? (
              <p className="insight-location-details__address">{t('insightLocationAddress', { address: reverseData.address })}</p>
            ) : null}
            <p>{locationSummary ?? t('insightLocationSummaryFallback')}</p>
          </div>
        );
      } else {
        primarySection = (
          <p>
            {t('insightLocationError', {
              lat: coords.lat.toFixed(5),
              lon: coords.lon.toFixed(5)
            })}
          </p>
        );
      }

      list.push({
        id: 'location',
        severity: 'high',
        title: t('insightLocationTitle'),
        content: (
          <div className="insight-content">
            {primarySection}
            <div className="insight-meta-row">
              {accuracyMeters != null ? (
                <span>{t('insightLocationAccuracy', { accuracy: formatMeters(accuracyMeters, lang) })}</span>
              ) : null}
              <button type="button" className="link-button" onClick={handleCopyCoordinates}>
                {copied ? t('coordinatesCopied') : t('insightLocationCoordinatesAction', coordinateParams)}
              </button>
            </div>
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
      const timezoneLabel = localContext.timezone ?? t('insightTimeTimezoneUnknown');
      const formattedDate = capitalize(localTimeDetails.formatted);
      list.push({
        id: 'time',
        severity: 'high',
        title: t('insightTimeTitle'),
        content: (
          <div className="insight-content">
            <p>{t('insightTimeValue', { date: formattedDate })}</p>
            <p>{t('insightTimeZone', { timezone: timezoneLabel })}</p>
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
      const lens = metadata?.lensModel;
      const deviceText = lens
        ? t('insightDeviceLens', { device: deviceName, lens })
        : t('insightDeviceSimple', { device: deviceName });
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
    } else {
      list.push({
        id: 'software-missing',
        severity: 'info',
        title: t('insightOsTitle'),
        content: <p>{t('insightOsUnknown')}</p>
      });
    }

    if (cameraPosition !== 'unknown') {
      const key =
        cameraPosition === 'front' ? 'insightCameraFront' : cameraPosition === 'rear' ? 'insightCameraRear' : 'insightCameraUnknown';
      list.push({
        id: 'camera-position',
        severity: 'medium',
        title: t('insightCameraTitle'),
        content: <p>{t(key)}</p>
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
    } else if (poiFetch.data && poiFetch.data.length > 0) {
      const topItems = poiFetch.data.slice(0, 5);
      list.push({
        id: 'poi',
        severity: 'medium',
        title: t('insightPoiTitle'),
        content: (
          <div className="insight-content">
            <p>{t('insightPoiListIntro')}</p>
            <ul className="insight-sublist">
              {topItems.map((poi, index) => {
                const label = poi.name?.trim()?.length
                  ? poi.name
                  : t('insightPoiUnnamed', { category: poi.category });
                return (
                  <li key={`${poi.category}-${label ?? index}`}>
                    {t('insightPoiListItem', {
                      name: label,
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
    } else if (surveillanceFetch.data && surveillanceFetch.data.length > 0) {
      const watchList = surveillanceFetch.data.slice(0, 5);
      list.push({
        id: 'surveillance',
        severity: 'high',
        title: t('insightSurveillanceTitle'),
        content: (
          <div className="insight-content">
            <p>{t('insightSurveillanceListIntro')}</p>
            <ul className="insight-sublist">
              {watchList.map((poi, index) => {
                const label = poi.name?.trim()?.length
                  ? poi.name
                  : t('insightPoiUnnamed', { category: poi.category });
                return (
                  <li key={`surveillance-${poi.category}-${label ?? index}`}>
                    {t('insightSurveillanceListItem', {
                      category: label,
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
    reverseFetch.loading,
    reverseFetch.error,
    reverseData,
    gpsHeading,
    t,
    localTimeDetails,
    localContext.holidayName,
    localContext.holidayCode,
    localContext.timezone,
    metadata?.cameraMake,
    metadata?.cameraModel,
    metadata?.lensModel,
    software,
    cameraPosition,
    movement,
    weatherFetch.loading,
    weatherFetch.error,
    weatherSummary,
    timestamp,
    poiFetch.loading,
    poiFetch.error,
    poiFetch.data,
    surveillanceFetch.loading,
    surveillanceFetch.error,
    surveillanceFetch.data,
    handleCopyCoordinates,
    accuracyMeters,
    locationSummary,
    lang,
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
            <MapBlock lat={coords.lat} lon={coords.lon} accuracy={accuracyMeters ?? undefined} />
            <ul className="map-meta">
              <li>
                {t('coordinatesLabel')}: {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
              </li>
              <li>
                {t('accuracyLabel')}: {accuracyMeters != null ? formatMeters(accuracyMeters, lang) : t('emptyValue')}
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
