import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { formatMeters, formatNumber } from '../utils/format';
import {
  describeDayPeriod,
  extractSoftware,
  inferCameraPosition,
  inferMovement,
  resolveLocalTime,
  summarizeWeather
} from '../utils/insights';

interface ShockBlockProps {
  metadata: StructuredMetadata | null;
  manualCoords: ManualCoordinates | null;
  onManualCoordsChange: (coords: ManualCoordinates | null) => void;
}

type InsightSeverity = 'high' | 'medium' | 'info';

interface InsightRow {
  id: string;
  emoji: string;
  title: string;
  severity: InsightSeverity;
  content: React.ReactNode;
}

const POI_CATEGORY_MAP: Record<string, MessageKey> = {
  cafe: 'poiCategory_cafe',
  restaurant: 'poiCategory_restaurant',
  fast_food: 'poiCategory_fastFood',
  bar: 'poiCategory_bar',
  pub: 'poiCategory_pub',
  bank: 'poiCategory_bank',
  atm: 'poiCategory_atm',
  fuel: 'poiCategory_fuel',
  pharmacy: 'poiCategory_pharmacy',
  hospital: 'poiCategory_hospital',
  clinic: 'poiCategory_clinic',
  supermarket: 'poiCategory_supermarket',
  mall: 'poiCategory_mall',
  convenience: 'poiCategory_convenience',
  marketplace: 'poiCategory_marketplace',
  shop: 'poiCategory_shop',
  parking: 'poiCategory_parking',
  bus_station: 'poiCategory_busStation',
  subway_entrance: 'poiCategory_subway',
  train_station: 'poiCategory_trainStation',
  hotel: 'poiCategory_hotel',
  motel: 'poiCategory_motel',
  guest_house: 'poiCategory_guestHouse',
  hostel: 'poiCategory_hostel',
  museum: 'poiCategory_museum',
  cinema: 'poiCategory_cinema',
  theatre: 'poiCategory_theatre',
  park: 'poiCategory_park',
  school: 'poiCategory_school',
  university: 'poiCategory_university',
  library: 'poiCategory_library',
  post_office: 'poiCategory_postOffice',
  police: 'poiCategory_police',
  government: 'poiCategory_government'
};

const SURVEILLANCE_CATEGORY_MAP: Record<string, MessageKey> = {
  surveillance: 'surveillanceCategory_camera',
  atm: 'surveillanceCategory_atm',
  bank: 'surveillanceCategory_bank',
  fuel: 'surveillanceCategory_fuel',
  shop: 'surveillanceCategory_shop',
  mall: 'surveillanceCategory_mall'
};

function normalizeCategory(value: string): string {
  return value.replace(/[:\s]/g, '_').toLowerCase();
}

function localizeCategory(value: string, t: ReturnType<typeof useT>, fallback: string, map: Record<string, MessageKey>): string {
  const normalized = normalizeCategory(value);
  const key = map[normalized] ?? map[value] ?? null;
  return key ? t(key) : fallback || value;
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
      navigator.clipboard.writeText(text).then(markCopied).catch(markCopied);
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

  const similarityQuery = useMemo(() => {
    const parts: string[] = [];
    if (metadata?.cameraMake) parts.push(metadata.cameraMake);
    if (metadata?.cameraModel) parts.push(metadata.cameraModel);
    if (reverseData?.city) parts.push(reverseData.city);
    if (reverseData?.country) parts.push(reverseData.country);
    const shotDate = metadata?.shotDate ?? localContext.iso;
    if (shotDate) {
      const year = new Date(shotDate).getUTCFullYear();
      if (Number.isFinite(year)) {
        parts.push(year.toString());
      }
    }
    if (parts.length < 2) {
      return null;
    }
    const query = parts.join(' ');
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
  }, [localContext.iso, metadata?.cameraMake, metadata?.cameraModel, metadata?.shotDate, reverseData?.city, reverseData?.country]);

  const reverseData = reverseFetch.data ?? null;
  const accuracyMeters = useMemo(() => {
    const candidates = [metadata?.gps?.accuracy, reverseData?.precisionMeters].filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
    );
    if (candidates.length === 0) return null;
    return Math.min(...candidates);
  }, [metadata?.gps?.accuracy, reverseData?.precisionMeters]);

  const locationDetails = useMemo(() => {
    if (!reverseData) return [] as Array<{ label: string; value: string }>;
    const entries: Array<{ label: string; value?: string | null }> = [
      { label: t('insightLocationCountryLabel'), value: reverseData.country },
      { label: t('insightLocationCityLabel'), value: reverseData.city },
      { label: t('insightLocationDistrictLabel'), value: reverseData.district ?? reverseData.state },
      { label: t('insightLocationStreetLabel'), value: reverseData.road },
      { label: t('insightLocationHouseLabel'), value: reverseData.houseNumber }
    ];
    return entries
      .filter((entry): entry is { label: string; value: string } => Boolean(entry.value))
      .map((entry) => ({ label: entry.label, value: entry.value!.toString() }));
  }, [reverseData, t]);

  const timeSummary = useMemo(() => {
    const iso = localContext.iso ?? metadata?.shotDate;
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const timezone = localContext.timezone;
    const formatOptions = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(lang, timezone ? { ...options, timeZone: timezone } : options).format(date);
    const weekday = capitalize(formatOptions({ weekday: 'long' }));
    const day = formatOptions({ day: 'numeric' });
    const month = formatOptions({ month: 'long' });
    const year = formatOptions({ year: 'numeric' });
    const time = formatOptions({ hour: '2-digit', minute: '2-digit', hour12: false });
    const periodKey = (`dayPeriod${capitalize(describeDayPeriod(date))}` as MessageKey);
    const period = t(periodKey);
    const timezoneLabel = timezone ?? t('insightTimeTimezoneUnknown');
    const holidayLine = localContext.holidayName
      ? t('insightTimeHoliday', { holiday: localContext.holidayName, code: localContext.holidayCode ?? t('emptyValue') })
      : t('insightTimeNoHoliday');
    return {
      primary: t('insightTimeFormatted', {
        weekday,
        date: `${day} ${month}`,
        year,
        time,
        period,
        timezone: timezoneLabel
      }),
      holiday: holidayLine
    };
  }, [
    lang,
    localContext.holidayCode,
    localContext.holidayName,
    localContext.timezone,
    localContext.iso,
    metadata?.shotDate,
    t
  ]);

  const poiItems = useMemo(() => {
    if (!poiFetch.data || poiFetch.data.length === 0) return null;
    return poiFetch.data.slice(0, 5);
  }, [poiFetch.data]);

  const surveillanceItems = useMemo(() => {
    if (!surveillanceFetch.data || surveillanceFetch.data.length === 0) return null;
    return surveillanceFetch.data.slice(0, 5);
  }, [surveillanceFetch.data]);

  const rows = useMemo<InsightRow[]>(() => {
    const list: InsightRow[] = [];

    if (coords) {
      const coordinateText = `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`;
      const copyLabel = copied ? t('coordinatesCopied') : coordinateText;
      const accuracyLabel =
        accuracyMeters != null ? t('insightLocationAccuracyInline', { accuracy: formatMeters(accuracyMeters, lang) }) : null;

      const locationTitle = accuracyLabel ? `${t('insightLocationTitle')} · ${accuracyLabel}` : t('insightLocationTitle');

      const detailsContent = () => {
        if (reverseFetch.loading) {
          return <p>{t('insightLoading')}</p>;
        }
        if (reverseFetch.error) {
          return (
            <p>
              {t('insightLocationError', {
                lat: coords.lat.toFixed(5),
                lon: coords.lon.toFixed(5)
              })}
            </p>
          );
        }
        if (locationDetails.length > 0) {
          return (
            <ul className="shock-location__list">
              {locationDetails.map((entry) => (
                <li key={`${entry.label}-${entry.value}`}>
                  <span>{entry.label}</span>
                  <strong>{entry.value}</strong>
                </li>
              ))}
            </ul>
          );
        }
        return <p>{t('insightLocationSummaryFallback')}</p>;
      };

      list.push({
        id: 'location',
        emoji: '📍',
        severity: 'high',
        title: locationTitle,
        content: (
          <div className="shock-location">
            <div className="shock-location__details">
              {detailsContent()}
              <div className="shock-location__meta-row">
                <button
                  type="button"
                  onClick={handleCopyCoordinates}
                  className="coords-button"
                  aria-label={t('copyCoordinates')}
                >
                  {copyLabel}
                </button>
                <div className="shock-location__links">
                  <a className="link-button" href={googleMapsLink(coords.lat, coords.lon)} target="_blank" rel="noreferrer">
                    {t('openMaps')}
                  </a>
                  <a
                    className="link-button"
                    href={streetViewLink(coords.lat, coords.lon, gpsHeading)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('openStreetView')}
                  </a>
                </div>
              </div>
            </div>
            <div className="shock-location__map">
              <MapBlock lat={coords.lat} lon={coords.lon} accuracy={accuracyMeters ?? undefined} />
            </div>
          </div>
        )
      });
    } else {
      list.push({
        id: 'location-missing',
        emoji: '📍',
        severity: 'info',
        title: t('insightLocationTitle'),
        content: <p>{t('insightLocationMissing')}</p>
      });
    }

    if (timeSummary) {
      list.push({
        id: 'time',
        emoji: '🕒',
        severity: 'high',
        title: t('insightTimeTitle'),
        content: (
          <div>
            <p>{timeSummary.primary}</p>
            <p>{timeSummary.holiday}</p>
          </div>
        )
      });
    } else {
      list.push({
        id: 'time-missing',
        emoji: '🕒',
        severity: 'info',
        title: t('insightTimeTitle'),
        content: <p>{t('insightTimeMissing')}</p>
      });
    }

    list.push({
      id: 'similarity',
      emoji: '🔍',
      severity: 'medium',
      title: t('insightSimilarityTitle'),
      content: similarityQuery ? (
        <div className="shock-similarity">
          <p>{t('insightSimilarityHint')}</p>
          <a className="link-button" href={similarityQuery} target="_blank" rel="noreferrer">
            {t('insightSimilarityButton')}
          </a>
        </div>
      ) : (
        <p>{t('insightSimilarityUnavailable')}</p>
      )
    });

    const deviceParts: string[] = [];
    const makeModel = [metadata?.cameraMake, metadata?.cameraModel].filter(Boolean).join(' ').trim();
    if (makeModel) deviceParts.push(makeModel);
    if (software) deviceParts.push(software);
    if (cameraPosition === 'front') {
      deviceParts.push(t('cameraPositionFrontShort'));
    } else if (cameraPosition === 'rear') {
      deviceParts.push(t('cameraPositionRearShort'));
    }
    if (metadata?.focalLength) {
      deviceParts.push(t('cameraFocal', { value: formatNumber(metadata.focalLength, metadata.focalLength < 10 ? 1 : 0) }));
    }
    if (metadata?.aperture) {
      deviceParts.push(t('cameraAperture', { value: formatNumber(metadata.aperture, 1) }));
    }

    list.push({
      id: 'device',
      emoji: '📱',
      severity: 'high',
      title: t('insightDeviceTitle'),
      content: deviceParts.length > 0 ? <p>{deviceParts.join(', ')}</p> : <p>{t('insightDeviceUnknown')}</p>
    });

    if (movement) {
      const speed = movement.speedKmh ? formatNumber(movement.speedKmh, 1) : undefined;
      const key = movement.moving ? 'insightMovementMoving' : 'insightMovementStill';
      list.push({
        id: 'movement',
        emoji: movement.moving ? '🚗' : '🛑',
        severity: movement.moving ? 'high' : 'medium',
        title: t('insightMovementTitle'),
        content: <p>{t(key, speed ? { speed } : {})}</p>
      });
    }

    if (weatherFetch.loading) {
      list.push({
        id: 'weather-loading',
        emoji: '🌦️',
        severity: 'info',
        title: t('insightWeatherTitle'),
        content: <p>{t('insightLoading')}</p>
      });
    } else if (weatherFetch.error) {
      list.push({
        id: 'weather-error',
        emoji: '🌦️',
        severity: 'info',
        title: t('insightWeatherTitle'),
        content: <p>{t('insightWeatherError')}</p>
      });
    } else if (weatherSummary) {
      list.push({
        id: 'weather',
        emoji: '🌦️',
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

    if (poiFetch.loading) {
      list.push({
        id: 'poi-loading',
        emoji: '🏙️',
        severity: 'info',
        title: t('insightPoiTitle'),
        content: <p>{t('insightLoading')}</p>
      });
    } else if (poiFetch.error) {
      list.push({
        id: 'poi-error',
        emoji: '🏙️',
        severity: 'info',
        title: t('insightPoiTitle'),
        content: <p>{t('insightPoiError')}</p>
      });
    } else if (poiItems) {
      list.push({
        id: 'poi',
        emoji: '🏙️',
        severity: 'medium',
        title: t('insightPoiTitle'),
        content: (
          <ul className="shock-poi-list">
            {poiItems.map((poi, index) => {
              const label = poi.name?.trim() ?? '';
              const localized = localizeCategory(poi.category, t, label, POI_CATEGORY_MAP);
              const distance = formatMeters(poi.distance, lang);
              const text = label
                ? t('insightPoiEntryNamed', { category: localized, name: label, distance })
                : t('insightPoiEntryUnnamed', { category: localized, distance });
              return <li key={`poi-${index}`}>{text}</li>;
            })}
          </ul>
        )
      });
    }

    if (surveillanceFetch.loading) {
      list.push({
        id: 'surveillance-loading',
        emoji: '🎥',
        severity: 'info',
        title: t('insightSurveillanceTitle'),
        content: <p>{t('insightLoading')}</p>
      });
    } else if (surveillanceFetch.error) {
      list.push({
        id: 'surveillance-error',
        emoji: '🎥',
        severity: 'info',
        title: t('insightSurveillanceTitle'),
        content: <p>{t('insightSurveillanceError')}</p>
      });
    } else if (surveillanceItems) {
      list.push({
        id: 'surveillance',
        emoji: '🎥',
        severity: 'high',
        title: t('insightSurveillanceTitle'),
        content: (
          <ul className="shock-poi-list">
            {surveillanceItems.map((poi, index) => {
              const label = poi.name?.trim() ?? '';
              const localized = localizeCategory(poi.category, t, label, SURVEILLANCE_CATEGORY_MAP);
              const distance = formatMeters(poi.distance, lang);
              const text = label
                ? t('insightSurveillanceEntryNamed', { category: localized, name: label, distance })
                : t('insightSurveillanceEntryUnnamed', { category: localized, distance });
              return <li key={`surveillance-${index}`}>{text}</li>;
            })}
          </ul>
        )
      });
    }

    return list;
  }, [
    accuracyMeters,
    locationDetails,
    cameraPosition,
    coords,
    copied,
    gpsHeading,
    handleCopyCoordinates,
    lang,
    localContext,
    metadata?.aperture,
    metadata?.cameraMake,
    metadata?.cameraModel,
    metadata?.focalLength,
    movement,
    poiFetch.data,
    poiFetch.error,
    poiFetch.loading,
    similarityQuery,
    surveillanceFetch.data,
    surveillanceFetch.error,
    surveillanceFetch.loading,
    reverseData,
    reverseFetch.error,
    reverseFetch.loading,
    software,
    t,
    timeSummary,
    weatherFetch.error,
    weatherFetch.loading,
    weatherSummary
  ]);

  return (
    <section className="panel shock-panel">
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

      <ul className="shock-list">
        {rows.map((row) => (
          <li key={row.id} className={`shock-item shock-item--${row.severity}`}>
            <span className="shock-item__emoji" aria-hidden="true">
              {row.emoji}
            </span>
            <div className="shock-item__body">
              <h3>{row.title}</h3>
              {row.content}
            </div>
          </li>
        ))}
      </ul>

      <div className="shock-errors">
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
    </section>
  );
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
