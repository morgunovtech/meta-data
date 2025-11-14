import React, { useState } from 'react';
import type { ParsedMetadata } from '../types/metadata';
import type {
  PoiResult,
  ReverseGeocodeResult,
  SurveillanceResult,
  TimezoneHolidayResult,
  WeatherSample
} from '../types/api';
import { useI18n } from '../i18n/I18nContext';

export type ShockBlockProps = {
  metadata?: ParsedMetadata;
  timezone?: TimezoneHolidayResult;
  timezoneLoading: boolean;
  timezoneError?: string;
  onRetryTimezone: () => void;
  weather?: WeatherSample;
  weatherLoading: boolean;
  weatherError?: string;
  onRetryWeather: () => void;
  pois?: PoiResult[];
  poiLoading: boolean;
  poiError?: string;
  onRetryPoi: () => void;
  surveillance?: SurveillanceResult[];
  surveillanceLoading: boolean;
  surveillanceError?: string;
  onRetrySurveillance: () => void;
  address?: ReverseGeocodeResult;
  onRetryAddress: () => void;
  addressLoading: boolean;
  addressError?: string;
  onManualCoords: (lat: number, lon: number) => void;
};

export const ShockBlock: React.FC<ShockBlockProps> = ({
  metadata,
  timezone,
  timezoneLoading,
  timezoneError,
  onRetryTimezone,
  weather,
  weatherLoading,
  weatherError,
  onRetryWeather,
  pois,
  poiLoading,
  poiError,
  onRetryPoi,
  surveillance,
  surveillanceLoading,
  surveillanceError,
  onRetrySurveillance,
  address,
  onRetryAddress,
  addressLoading,
  addressError,
  onManualCoords
}) => {
  const { t } = useI18n();
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');

  const applyManual = () => {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      onManualCoords(lat, lon);
    }
  };

  return (
    <section className="shock-block">
      <h2>{t('shockBlockTitle')}</h2>

      <div className="shock-section">
        <h3>{t('timezoneInfo')}</h3>
        {timezoneLoading && <p>{t('timezoneLoading')}</p>}
        {timezoneError && (
          <p>
            {t('reverseGeocodeError')}
            <button type="button" onClick={onRetryTimezone}>
              {t('retry')}
            </button>
          </p>
        )}
        {timezone && (
          <>
            <p>{timezone.localTime}</p>
            <p>{timezone.timezone}</p>
            <p>
              {timezone.isHoliday === undefined
                ? t('holidayUnknown')
                : timezone.isHoliday
                  ? `${t('holidayYes')}${timezone.holidayName ? `: ${timezone.holidayName}` : ''}`
                  : t('holidayNo')}
            </p>
          </>
        )}
        {!metadata?.camera.dateTimeOriginal && <p>{t('noTimeData')}</p>}
      </div>

      <div className="shock-section">
        <h3>{t('mapTitle')}</h3>
        {addressLoading && <p>{t('mapLoading')}</p>}
        {addressError && (
          <p>
            {t('reverseGeocodeError')}
            <button type="button" onClick={onRetryAddress}>
              {t('retry')}
            </button>
          </p>
        )}
        {address && (
          <>
            <p>{address.address}</p>
            {address.country && <p>{address.country}</p>}
          </>
        )}
        <div className="manual-inputs">
          <label>
            {t('manualLatLabel')}
            <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} placeholder="51.5074" />
          </label>
          <label>
            {t('manualLonLabel')}
            <input value={manualLon} onChange={(event) => setManualLon(event.target.value)} placeholder="-0.1278" />
          </label>
          <button type="button" onClick={applyManual}>
            {t('manualApply')}
          </button>
        </div>
      </div>

      <div className="shock-section">
        <h3>{t('weatherTitle')}</h3>
        {weatherLoading && <p>{t('weatherLoading')}</p>}
        {weatherError && (
          <p>
            {t('weatherError')}
            <button type="button" onClick={onRetryWeather}>
              {t('retry')}
            </button>
          </p>
        )}
        {weather && (
          <ul>
            <li>🌡 {weather.temperatureC?.toFixed(1)}°C</li>
            <li>☁️ {weather.cloudCover}%</li>
            <li>💧 {weather.precipitationMm} mm</li>
            <li>💨 {weather.windSpeedKmh} km/h</li>
            <li>📈 {weather.pressureHpa} hPa</li>
          </ul>
        )}
      </div>

      <div className="shock-section">
        <h3>{t('poiTitle')}</h3>
        {poiLoading && <p>{t('poiLoading')}</p>}
        {poiError && (
          <p>
            {t('poiError')}
            <button type="button" onClick={onRetryPoi}>
              {t('retry')}
            </button>
          </p>
        )}
        {pois && (
          <ul>
            {pois.map((poi) => (
              <li key={`${poi.name}-${poi.distance}`}>
                {poi.name ?? 'POI'} — {poi.type ?? '-'} · {Math.round(poi.distance)} m
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shock-section">
        <h3>{t('surveillanceTitle')}</h3>
        {surveillanceLoading && <p>{t('surveillanceLoading')}</p>}
        {surveillanceError && (
          <p>
            {t('surveillanceError')}
            <button type="button" onClick={onRetrySurveillance}>
              {t('retry')}
            </button>
          </p>
        )}
        {surveillance && (
          <ul>
            {surveillance.map((poi) => (
              <li key={`${poi.name}-${poi.distance}`}>
                {poi.name ?? poi.type ?? '—'} · {Math.round(poi.distance)} m
              </li>
            ))}
          </ul>
        )}
      </div>

      {metadata && (
        <div className="shock-section">
          <h3>Device</h3>
          <p>
            {metadata.camera.make} {metadata.camera.model}
          </p>
          <p>{metadata.camera.software}</p>
          <p>
            {metadata.camera.focalLength && `${metadata.camera.focalLength}mm`}{' '}
            {metadata.camera.focalLength35 && `(${metadata.camera.focalLength35}mm eq.)`}
          </p>
        </div>
      )}
    </section>
  );
};
