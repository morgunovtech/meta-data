import React, { useEffect, useMemo, useState } from 'react';
import type { BasicExifData } from '@/types/exif';
import { useAPIFetch } from '@/hooks/useAPIFetch';
import type {
  PoiResult,
  ReverseGeocodeResult,
  SurveillanceResult,
  TimezoneHolidayResult,
  WeatherResult
} from '@/types/api';
import { useI18n } from '@/i18n/I18nContext';
import { MapBlock } from './MapBlock';
import { createGoogleMapsLink, createStreetViewLink } from '@/utils/map';
import { toIsoIfPossible } from '@/utils/date';
import { buildProcessingChainHint } from '@/utils/metadata';
import type { MetadataGroups } from '@/types/exif';

export type ShockBlockProps = {
  metadata?: BasicExifData;
  groups?: MetadataGroups;
};

export const ShockBlock: React.FC<ShockBlockProps> = ({ metadata, groups }) => {
  const { t } = useI18n();
  const [manualInput, setManualInput] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | undefined>();

  const timezoneFetch = useAPIFetch<TimezoneHolidayResult>();
  const reverseFetch = useAPIFetch<ReverseGeocodeResult>();
  const weatherFetch = useAPIFetch<WeatherResult>();
  const poiFetch = useAPIFetch<PoiResult[]>();
  const surveillanceFetch = useAPIFetch<SurveillanceResult[]>();

  useEffect(() => {
    if (metadata?.gps) {
      setCoords({ latitude: metadata.gps.latitude, longitude: metadata.gps.longitude });
    }
  }, [metadata?.gps?.latitude, metadata?.gps?.longitude]);

  const triggerAll = async (targetCoords: { latitude: number; longitude: number }) => {
    const iso = toIsoIfPossible(metadata?.dateTimeOriginal) ?? new Date().toISOString();
    timezoneFetch.fetchWithRetry(
      `/functions/timezone-and-holiday?lat=${targetCoords.latitude}&lon=${targetCoords.longitude}&time=${encodeURIComponent(iso)}`
    );
    reverseFetch.fetchWithRetry(
      `/functions/reverse-geocode?lat=${targetCoords.latitude}&lon=${targetCoords.longitude}`
    );
    weatherFetch.fetchWithRetry(
      `/functions/historical-weather?lat=${targetCoords.latitude}&lon=${targetCoords.longitude}&time=${encodeURIComponent(iso)}`
    );
    poiFetch.fetchWithRetry(
      `/functions/nearby-poi?lat=${targetCoords.latitude}&lon=${targetCoords.longitude}`
    );
    surveillanceFetch.fetchWithRetry(
      `/functions/surveillance-candidates?lat=${targetCoords.latitude}&lon=${targetCoords.longitude}`
    );
  };

  useEffect(() => {
    if (coords) {
      triggerAll(coords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.latitude, coords?.longitude]);

  const parseManualInput = () => {
    const [lat, lon] = manualInput.split(',').map((value) => parseFloat(value.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const target = { latitude: lat, longitude: lon };
      setCoords(target);
      triggerAll(target);
    }
  };

  const chainHint = useMemo(() => {
    if (!metadata || !groups) return undefined;
    return buildProcessingChainHint(metadata, groups);
  }, [metadata, groups]);

  return (
    <section className="shock-block">
      <h2>{t('shock_title')}</h2>
      <div className="card">
        <h3>{t('timezone_title')}</h3>
        {!coords || !metadata?.dateTimeOriginal ? (
          <p>{t('timezone_missing')}</p>
        ) : timezoneFetch.loading ? (
          <p>{t('loading_generic')}</p>
        ) : timezoneFetch.error ? (
          <p>
            {t('error_api', { service: t('timezone_service') })}
            <button type="button" onClick={() => triggerAll(coords)}>{t('timezone_retry')}</button>
          </p>
        ) : timezoneFetch.data ? (
          <ul>
            <li>
              {t('timezone_local_time')}: {timezoneFetch.data.localTime} ({timezoneFetch.data.timezone})
            </li>
            <li>
              {t('timezone_holiday')}: {timezoneFetch.data.isHoliday ? `${t('holiday_yes')} (${timezoneFetch.data.holidayName ?? ''})` : t('holiday_no')}
            </li>
          </ul>
        ) : null}
      </div>

      <div className="card">
        <h3>{t('map_title')}</h3>
        {!coords ? (
          <>
            <p>{t('map_missing')}</p>
            <label className="manual-input">
              <span>{t('map_manual_label')}</span>
              <input
                value={manualInput}
                onChange={(event) => setManualInput(event.target.value)}
                placeholder={t('map_manual_placeholder')}
              />
              <button type="button" onClick={parseManualInput}>{t('map_manual_button')}</button>
            </label>
            <p className="hint">{t('manual_input_hint')}</p>
          </>
        ) : (
          <>
            <MapBlock latitude={coords.latitude} longitude={coords.longitude} accuracy={metadata?.gps?.accuracyMeters} />
            {reverseFetch.error && <p>{t('error_api', { service: t('reverse_geocode_service') })}</p>}
            {reverseFetch.data && (
              <ul>
                <li>
                  {t('map_address')}: {reverseFetch.data.address}
                </li>
                <li>
                  {t('map_iso_label')}: {reverseFetch.data.isoCode ?? t('no_data')}
                </li>
              </ul>
            )}
            <div className="links">
              <a href={createGoogleMapsLink(coords.latitude, coords.longitude)} target="_blank" rel="noreferrer">
                {t('map_open_maps')}
              </a>
              <a
                href={createStreetViewLink(coords.latitude, coords.longitude, metadata?.gps?.heading)}
                target="_blank"
                rel="noreferrer"
              >
                {t('map_open_street')}
              </a>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>{t('weather_title')}</h3>
        {!coords || !metadata?.dateTimeOriginal ? (
          <p>{t('weather_missing')}</p>
        ) : weatherFetch.loading ? (
          <p>{t('loading_generic')}</p>
        ) : weatherFetch.error ? (
          <p>{t('error_api', { service: t('weather_service') })}</p>
        ) : weatherFetch.data ? (
          <p>
            {t('weather_summary', {
              temperature: weatherFetch.data.temperatureC.toFixed(1),
              precip: weatherFetch.data.precipitationMm.toFixed(1),
              cloudCover: weatherFetch.data.cloudCoverPercent.toFixed(0),
              wind: weatherFetch.data.windSpeedKmh.toFixed(0),
              pressure: weatherFetch.data.pressureHpa.toFixed(0)
            })}
          </p>
        ) : null}
      </div>

      <div className="card">
        <h3>{t('poi_title')}</h3>
        {poiFetch.loading ? (
          <p>{t('loading_generic')}</p>
        ) : poiFetch.error ? (
          <p>{t('error_api', { service: t('poi_service') })}</p>
        ) : poiFetch.data ? (
          <ul>
            {poiFetch.data.map((poi) => (
              <li key={`${poi.category}-${poi.name}`}>
                {poi.name || poi.category} · {t('poi_distance', { distance: poi.distanceMeters.toFixed(0) })}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="card">
        <h3>{t('surveillance_title')}</h3>
        {surveillanceFetch.loading ? (
          <p>{t('loading_generic')}</p>
        ) : surveillanceFetch.error ? (
          <p>{t('error_api', { service: t('surveillance_service') })}</p>
        ) : surveillanceFetch.data ? (
          <ul>
            {surveillanceFetch.data.map((item, index) => (
              <li key={`${item.category}-${index}`}>
                {item.category} · {t('poi_distance', { distance: item.distanceMeters.toFixed(0) })}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="card">
        <h3>{t('camera_chain')}</h3>
        {chainHint ? <p>{t('chain_hint', { value: chainHint })}</p> : <p>{t('chain_insufficient')}</p>}
      </div>
    </section>
  );
};
