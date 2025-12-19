import React, { useMemo, useState } from 'react';
import type { HistoricalWeatherResult, PoiResult, ReverseGeocodeResult } from '../types/api';
import type { MovementInsight } from '../utils/insights';
import { useI18n, useT } from '../i18n';
import { MapBlock } from './MapBlock';
import { formatCoords, formatDateTime, formatDistance, formatWeatherLine, localizeCategoryKey, localizePlaceParts } from '../utils/insightsCompact';
import { googleMapsLink, streetViewLink } from '../utils/mapLinks';

interface DataInsightsCompactProps {
  reverseData: ReverseGeocodeResult | null;
  reverseLoading: boolean;
  reverseError: boolean;
  coords: { lat: number; lon: number } | null;
  accuracyMeters: number | null;
  shotDate: string | Date | undefined;
  movement: MovementInsight | null;
  weather: HistoricalWeatherResult | null;
  weatherLoading: boolean;
  weatherError: boolean;
  poiItems: PoiResult[];
  poiLoading: boolean;
  poiError: boolean;
  surveillanceItems: PoiResult[];
  surveillanceLoading: boolean;
  surveillanceError: boolean;
  gpsHeading?: number;
}

export const DataInsightsCompact: React.FC<DataInsightsCompactProps> = ({
  reverseData,
  reverseLoading,
  reverseError,
  coords,
  accuracyMeters,
  shotDate,
  movement,
  weather,
  weatherLoading,
  weatherError,
  poiItems,
  poiLoading,
  poiError,
  surveillanceItems,
  surveillanceLoading,
  surveillanceError,
  gpsHeading
}) => {
  const t = useT();
  const { lang } = useI18n();
  const [copied, setCopied] = useState(false);

  const placeInfo = useMemo(() => localizePlaceParts(reverseData, lang), [reverseData, lang]);
  const dateLabel = useMemo(() => formatDateTime(shotDate, lang), [shotDate, lang]);
  const coordsLabel = coords ? formatCoords(coords.lat, coords.lon) : null;
  const accuracyLabel = accuracyMeters != null ? formatDistance(accuracyMeters, lang) : null;
  const weatherLine = useMemo(() => formatWeatherLine(weather, lang), [weather, lang]);

  const movementLabel = useMemo(() => {
    if (!movement) return t('insightCompactMovementUnknown');
    if (movement.moving && movement.speedKmh) {
      return t('insightCompactMovementMoving', { speed: Math.round(movement.speedKmh) });
    }
    return t('insightCompactMovementStill');
  }, [movement, t]);

  const handleCopy = async () => {
    if (!coords) return;
    const value = formatCoords(coords.lat, coords.lon);
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } finally {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const locationLine = reverseLoading
    ? t('insightCompactLoading')
    : reverseError
    ? t('insightCompactLocationUnavailable')
    : placeInfo.place || t('insightCompactLocationUnknown');

  return (
    <div className="insight-compact">
      <div className="insight-compact__header">
        <h3>{t('shockBlockTitle')}</h3>
        <p>{t('insightDisclaimer')}</p>
      </div>
      <div className="insight-compact__divider" />
      <div className="insight-compact__grid">
        <dl>
          <div className="insight-compact__item">
            <dt>{t('insightCompactLocation')}</dt>
            <dd>
              <span>{locationLine}</span>
              {accuracyLabel ? <span className="insight-compact__muted">{accuracyLabel}</span> : null}
            </dd>
          </div>
          <div className="insight-compact__item">
            <dt>{t('insightCompactCoordinates')}</dt>
            <dd className="insight-compact__coords">
              <span className="insight-compact__mono">{coordsLabel ?? t('emptyValue')}</span>
              {coords ? (
                <button
                  type="button"
                  className="button button--ghost insight-compact__icon-button"
                  onClick={handleCopy}
                  aria-label={t('insightCompactCopyCoordinates')}
                  title={t('insightCompactCopyCoordinates')}
                >
                  {copied ? t('coordinatesCopied') : '📋'}
                </button>
              ) : null}
            </dd>
          </div>
          <div className="insight-compact__item">
            <dt>{t('insightCompactTime')}</dt>
            <dd>{dateLabel ?? t('insightTimeMissing')}</dd>
          </div>
          <div className="insight-compact__item">
            <dt>{t('insightCompactMovement')}</dt>
            <dd>{movementLabel}</dd>
          </div>
          <div className="insight-compact__item">
            <dt>{t('insightCompactWeather')}</dt>
            <dd>
              {weatherLoading
                ? t('insightCompactLoading')
                : weatherError
                ? t('insightCompactWeatherUnavailable')
                : weatherLine ?? t('insightCompactWeatherUnavailable')}
            </dd>
          </div>
        </dl>
        <div className="insight-compact__map">
          {coords ? <MapBlock lat={coords.lat} lon={coords.lon} accuracy={accuracyMeters ?? undefined} /> : null}
          {coords ? (
            <div className="insight-compact__map-actions">
              <a
                className="button button--ghost"
                href={googleMapsLink(coords.lat, coords.lon)}
                target="_blank"
                rel="noreferrer"
                aria-label={t('openMaps')}
                title={t('openMaps')}
              >
                {t('openMaps')}
              </a>
              <a
                className="button button--ghost"
                href={streetViewLink(coords.lat, coords.lon, gpsHeading)}
                target="_blank"
                rel="noreferrer"
                aria-label={t('openStreetView')}
                title={t('openStreetView')}
              >
                {t('openStreetView')}
              </a>
            </div>
          ) : null}
        </div>
      </div>
      <div className="insight-compact__divider" />
      <div className="insight-compact__lists">
        <div className="insight-compact__list">
          <h4>{t('insightPoiTitle')}</h4>
          {poiLoading ? (
            <p className="insight-compact__muted">{t('insightCompactLoading')}</p>
          ) : poiError ? (
            <p className="insight-compact__muted">{t('insightPoiError')}</p>
          ) : poiItems.length === 0 ? (
            <p className="insight-compact__muted">{t('insightPoiEmpty')}</p>
          ) : (
            <ul>
              {poiItems.map((poi, index) => (
                <li key={`${poi.name}-${index}`}>
                  <span>{poi.name}</span>
                  <span className="insight-compact__distance">{t('insightPoiDistance', { distance: Math.round(poi.distance) })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="insight-compact__list">
          <h4>{t('insightSurveillanceTitle')}</h4>
          <p className="insight-compact__muted">{t('insightSurveillanceHelper')}</p>
          {surveillanceLoading ? (
            <p className="insight-compact__muted">{t('insightCompactLoading')}</p>
          ) : surveillanceError ? (
            <p className="insight-compact__muted">{t('insightSurveillanceError')}</p>
          ) : surveillanceItems.length === 0 ? (
            <p className="insight-compact__muted">{t('insightSurveillanceEmpty')}</p>
          ) : (
            <ul>
              {surveillanceItems.map((poi, index) => (
                <li key={`${poi.name}-${index}`}>
                  <span>{localizeCategoryKey(poi.category, t)}</span>
                  <span className="insight-compact__distance">{t('insightPoiDistance', { distance: Math.round(poi.distance) })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
