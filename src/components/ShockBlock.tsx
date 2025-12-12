import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, useT, type MessageKey } from '../i18n';
import type { StructuredMetadata, ManualCoordinates } from '../types/metadata';
import type {
  ReverseGeocodeResult,
  TimezoneHolidayResult,
  HistoricalWeatherResult,
  PoiResult,
  ImageUniquenessResult
} from '../types/api';
import { useAPIFetch } from '../hooks/useAPIFetch';
import { ErrorBanner } from './ErrorBanner';
import { MapBlock } from './MapBlock';
import { googleMapsLink, streetViewLink } from '../utils/mapLinks';
import { formatMeters, formatNumber } from '../utils/format';
import {
  describeDayPeriod,
  extractSoftware,
  inferCameraPosition,
  inferMovement,
  resolveLocalTime,
  summarizeWeather
} from '../utils/insights';
import { computePhash } from '../utils/phash';

interface ShockBlockProps {
  metadata: StructuredMetadata | null;
  manualCoords: ManualCoordinates | null;
  onManualCoordsChange: (coords: ManualCoordinates | null) => void;
  imageDataUrl: string | null;
}

type InsightSeverity = 'high' | 'medium' | 'info';

interface InsightItem {
  id: string;
  severity: InsightSeverity;
  title: string;
  content: React.ReactNode;
}

export const ShockBlock: React.FC<ShockBlockProps> = ({ metadata, manualCoords, onManualCoordsChange, imageDataUrl }) => {
  const t = useT();
  const { lang } = useI18n();
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const gpsHeading = metadata?.gps?.heading;
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const [phash, setPhash] = useState<string | null>(null);
  const [hashLoading, setHashLoading] = useState(false);

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

  const timestamp = useMemo(() => metadata?.shotDate ?? new Date().toISOString(), [metadata?.shotDate]);

  useEffect(() => {
    let cancelled = false;
    if (!imageDataUrl) {
      setPhash(null);
      return () => {
        cancelled = true;
      };
    }
    setHashLoading(true);
    computePhash(imageDataUrl)
      .then((hash) => {
        if (!cancelled) {
          setPhash(hash);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHashLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [imageDataUrl]);

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
  const uniquenessFetch = useAPIFetch<ImageUniquenessResult>();

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

  useEffect(() => {
    if (!phash) return;
    uniquenessFetch.request(`/api/image-uniqueness?phash=${phash}`);
  }, [phash]);

  const software = useMemo(() => extractSoftware(metadata), [metadata]);
  const cameraPosition = useMemo(() => inferCameraPosition(metadata), [metadata]);
  const movement = useMemo(() => inferMovement(metadata), [metadata]);
  const localContext = useMemo(
    () => resolveLocalTime(metadata, timezoneFetch.data ?? null, coords),
    [coords, metadata, timezoneFetch.data]
  );
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
    return { formatted: capitalize(formatted), timezone: localContext.timezone };
  }, [lang, localContext.iso, localContext.timezone, metadata?.shotDate]);

  const timePeriodLabel = useMemo(() => {
    const iso = localContext.iso ?? metadata?.shotDate;
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const periodKey = `dayPeriod_${describeDayPeriod(date)}` as MessageKey;
    return t(periodKey);
  }, [localContext.iso, metadata?.shotDate, t]);

  const reverseData = reverseFetch.data ?? null;
  const accuracyMeters = useMemo(() => {
    const candidates = [metadata?.gps?.accuracy, reverseData?.precisionMeters]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    if (candidates.length === 0) {
      return null;
    }
    return Math.min(...candidates);
  }, [metadata?.gps?.accuracy, reverseData?.precisionMeters]);

  const locationParts = useMemo(() => {
    if (!reverseData) return [];
    const parts: Array<{ label: string; value: string }> = [];
    if (reverseData.country) {
      parts.push({ label: t('insightLocationCountryLabel'), value: reverseData.country });
    }
    if (reverseData.city) {
      parts.push({ label: t('insightLocationCityLabel'), value: reverseData.city });
    }
    const district = reverseData.district ?? reverseData.state;
    if (district) {
      parts.push({ label: t('insightLocationDistrictLabel'), value: district });
    }
    if (reverseData.road) {
      parts.push({ label: t('insightLocationStreetLabel'), value: reverseData.road });
    }
    if (reverseData.houseNumber) {
      parts.push({ label: t('insightLocationHouseLabel'), value: reverseData.houseNumber });
    }
    return parts;
  }, [reverseData, t]);

  const locationTitle = useMemo(() => {
    if (!coords) {
      return t('insightLocationTitle', { accuracy: t('insightAccuracyUnknown') });
    }
    const accuracyLabel = accuracyMeters != null ? formatMeters(accuracyMeters, lang) : t('insightAccuracyUnknown');
    return t('insightLocationTitle', { accuracy: accuracyLabel });
  }, [coords, accuracyMeters, lang, t]);

  const timezoneTitle = t('insightTimeTitle');

  const poiItems = useMemo(() => {
    if (!poiFetch.data) return [];
    return poiFetch.data
      .slice(0, 5)
      .map((poi) => ({
        name: poi.name?.trim()?.length ? poi.name : t('insightPoiUnnamed', { category: translateCategory(poi.category, t) }),
        category: translateCategory(poi.category, t),
        distance: Math.round(poi.distance)
      }));
  }, [poiFetch.data, t]);

  const surveillanceItems = useMemo(() => {
    if (!surveillanceFetch.data) return [];
    return surveillanceFetch.data
      .slice(0, 5)
      .map((poi) => ({
        name: poi.name?.trim()?.length ? poi.name : translateCategory(poi.category, t),
        category: translateCategory(poi.category, t),
        distance: Math.round(poi.distance)
      }));
  }, [surveillanceFetch.data, t]);

  const uniquenessInsight = useMemo(() => {
    if (hashLoading) {
      return t('insightSimilarityLoading');
    }
    if (!phash) {
      return t('insightSimilarityUnavailable');
    }
    if (uniquenessFetch.loading) {
      return t('insightSimilarityChecking');
    }
    if (uniquenessFetch.error) {
      return t('insightSimilarityError');
    }
    const result = uniquenessFetch.data;
    if (!result) {
      return t('insightSimilarityUnavailable');
    }
    if (result.matches.length === 0) {
      return t('insightSimilarityUnique');
    }
    const list = result.matches
      .map((match) => `${match.label} — ${(match.similarity * 100).toFixed(0)}%`)
      .join('; ');
    return t('insightSimilarityMatches', { list });
  }, [hashLoading, phash, uniquenessFetch.data, uniquenessFetch.error, uniquenessFetch.loading, t]);

  const insights = useMemo<InsightItem[]>(() => {
    const list: InsightItem[] = [];

    if (coords) {
      let locationBody: React.ReactNode;
      if (reverseFetch.loading) {
        locationBody = <p>{t('insightLoading')}</p>;
      } else if (reverseFetch.error) {
        locationBody = (
          <p>
            {t('insightLocationError', {
              lat: coords.lat.toFixed(5),
              lon: coords.lon.toFixed(5)
            })}
          </p>
        );
      } else if (reverseData) {
        locationBody = (
          <div className="insight-location">
            <div className="insight-location__details">
              {locationParts.length > 0 ? (
                <dl>
                  {locationParts.map((part) => (
                    <div key={`${part.label}-${part.value}`} className="insight-location__row">
                      <dt>{part.label}</dt>
                      <dd>{part.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>{t('insightLocationSummaryFallback')}</p>
              )}
              <div className="insight-location__coords">
                <button type="button" onClick={handleCopyCoordinates} className="link-button">
                  {copied
                    ? t('coordinatesCopied')
                    : t('insightLocationCoordinatesAction', {
                        lat: coords.lat.toFixed(5),
                        lon: coords.lon.toFixed(5)
                      })}
                </button>
                <div className="insight-location__actions">
                  <a className="button button--ghost" href={googleMapsLink(coords.lat, coords.lon)} target="_blank" rel="noreferrer">
                    {t('openMaps')}
                  </a>
                  <a
                    className="button button--ghost"
                    href={streetViewLink(coords.lat, coords.lon, gpsHeading)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('openStreetView')}
                  </a>
                </div>
              </div>
            </div>
            <div className="insight-location__map">
              <MapBlock lat={coords.lat} lon={coords.lon} accuracy={accuracyMeters ?? undefined} />
            </div>
          </div>
        );
      } else {
        locationBody = (
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
        title: locationTitle,
        content: locationBody
      });
    } else {
      list.push({
        id: 'location-missing',
        severity: 'info',
        title: locationTitle,
        content: <p>{t('insightLocationMissing')}</p>
      });
    }

    if (localTimeDetails) {
      const timezoneLabel = localTimeDetails.timezone
        ? localContext.timezoneSource === 'approx'
          ? t('insightTimeTimezoneApprox', { timezone: localTimeDetails.timezone })
          : localTimeDetails.timezone
        : t('insightTimeTimezoneUnknown');
      const periodLabel = timePeriodLabel ?? t('dayPeriod_unknown');
      const holidayText = localContext.holidayName
        ? t('insightTimeHoliday', { holiday: localContext.holidayName })
        : t('insightTimeNoHoliday');
      list.push({
        id: 'time',
        severity: 'high',
        title: timezoneTitle,
        content: (
          <div className="insight-content">
            <p>
              {t('insightTimeValue', {
                date: localTimeDetails.formatted,
                timezone: timezoneLabel,
                period: periodLabel
              })}
            </p>
            <p>{holidayText}</p>
          </div>
        )
      });
    } else {
      list.push({
        id: 'time-missing',
        severity: 'medium',
        title: timezoneTitle,
        content: <p>{t('insightTimeMissing')}</p>
      });
    }

    if (metadata?.cameraMake || metadata?.cameraModel || software) {
      const deviceSummary = [metadata?.cameraMake, metadata?.cameraModel].filter(Boolean).join(' ');
      const positionKey =
        cameraPosition === 'front'
          ? 'insightCameraFront'
          : cameraPosition === 'rear'
          ? 'insightCameraRear'
          : 'insightCameraUnknown';
      const details = [
        deviceSummary,
        software,
        cameraPosition ? t(positionKey as MessageKey) : null
      ].filter(Boolean);
      list.push({
        id: 'device',
        severity: 'high',
        title: t('insightDeviceTitle'),
        content: <p>{t('insightDeviceSummary', { summary: details.join(', ') })}</p>
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
        list.push({ id: 'weather-loading', severity: 'info', title: t('insightWeatherTitle'), content: <p>{t('insightLoading')}</p> });
      } else if (weatherFetch.error) {
        list.push({ id: 'weather-error', severity: 'info', title: t('insightWeatherTitle'), content: <p>{t('insightWeatherError')}</p> });
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
    }

    if (poiFetch.loading) {
      list.push({ id: 'poi-loading', severity: 'info', title: t('insightPoiTitle'), content: <p>{t('insightLoading')}</p> });
    } else if (poiFetch.error) {
      list.push({ id: 'poi-error', severity: 'info', title: t('insightPoiTitle'), content: <p>{t('insightPoiError')}</p> });
    } else if (poiItems.length > 0) {
      list.push({
        id: 'poi',
        severity: 'medium',
        title: t('insightPoiTitle'),
        content: (
          <ul className="insight-sublist">
            {poiItems.map((poi, index) => (
              <li key={`${poi.name}-${index}`}>
                {t('insightPoiListItem', { name: poi.name, category: poi.category, distance: poi.distance })}
              </li>
            ))}
          </ul>
        )
      });
    } else {
      list.push({ id: 'poi-empty', severity: 'info', title: t('insightPoiTitle'), content: <p>{t('insightPoiEmpty')}</p> });
    }

    if (surveillanceFetch.loading) {
      list.push({ id: 'surveillance-loading', severity: 'info', title: t('insightSurveillanceTitle'), content: <p>{t('insightLoading')}</p> });
    } else if (surveillanceFetch.error) {
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
            {surveillanceItems.map((poi, index) => (
              <li key={`${poi.name}-${index}`}>
                {t('insightSurveillanceListItem', { category: poi.category, distance: poi.distance })}
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

    list.push({
      id: 'similarity',
      severity: 'medium',
      title: t('insightSimilarityTitle'),
      content: <p>{uniquenessInsight}</p>
    });

    return list;
  }, [
    coords,
    reverseFetch.loading,
    reverseFetch.error,
    reverseData,
    locationParts,
    t,
    handleCopyCoordinates,
    copied,
    gpsHeading,
    accuracyMeters,
    lang,
    locationTitle,
    localTimeDetails,
    localContext.holidayName,
    timezoneTitle,
    metadata?.cameraMake,
    metadata?.cameraModel,
    software,
    cameraPosition,
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
    uniquenessInsight
  ]);

  return (
    <section className="panel insights-panel">
      <h2 className="section-title">{t('shockBlockTitle')}</h2>

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
        {uniquenessFetch.error ? (
          <ErrorBanner
            message={t('insightSimilarityError')}
            onRetry={() => phash && uniquenessFetch.request(`/api/image-uniqueness?phash=${phash}`)}
          />
        ) : null}
      </div>
    </section>
  );
};

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const CATEGORY_KEYS: Record<string, MessageKey> = {
  cafe: 'poiCategory_cafe',
  restaurant: 'poiCategory_restaurant',
  bank: 'poiCategory_bank',
  atm: 'poiCategory_atm',
  mall: 'poiCategory_mall',
  museum: 'poiCategory_museum',
  parking: 'poiCategory_parking',
  fuel: 'poiCategory_fuel',
  gas_station: 'poiCategory_fuel',
  supermarket: 'poiCategory_supermarket',
  pharmacy: 'poiCategory_pharmacy'
};

function translateCategory(category: string, t: ReturnType<typeof useT>): string {
  const normalized = category.toLowerCase();
  const key = CATEGORY_KEYS[normalized];
  if (key) {
    return t(key);
  }
  return category;
}
