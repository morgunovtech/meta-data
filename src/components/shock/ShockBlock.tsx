import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ParsedMetadata, ManualCoordinates } from '../../types/metadata';
import type {
  HistoricalWeatherResult,
  PoiItem,
  ReverseGeocodeResult,
  SurveillanceItem,
  TimezoneHolidayResult
} from '../../types/api';
import NotificationBanner from '../common/NotificationBanner';
import { formatLocalDateTime } from '../../utils/datetime';
import { googleMapsSearchUrl, googleStreetViewUrl } from '../../utils/maps';
import MapView from './MapView';

interface FetchState<T> {
  execute: (options: { path: string; params?: Record<string, string | number | undefined> }) => Promise<T | null>;
  loading: boolean;
  error: string | null;
  data: T | null;
}

interface Props {
  metadata: ParsedMetadata | null;
  gps: ManualCoordinates | null;
  timestampIso: string | null;
  timezoneFetch: FetchState< TimezoneHolidayResult >;
  reverseGeoFetch: FetchState< ReverseGeocodeResult >;
  weatherFetch: FetchState< HistoricalWeatherResult >;
  poiFetch: FetchState< PoiItem[] >;
  surveillanceFetch: FetchState< SurveillanceItem[] >;
  onManualCoords: (coords: ManualCoordinates | null) => void;
}

const ShockBlock: React.FC<Props> = ({
  metadata,
  gps,
  timestampIso,
  timezoneFetch,
  reverseGeoFetch,
  weatherFetch,
  poiFetch,
  surveillanceFetch,
  onManualCoords
}) => {
  const { t } = useLanguage();
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');

  const gpsAccuracy = metadata?.exif.gpsHPositioningError ?? metadata?.exif.gpsDop ?? metadata?.exif.gpsSatellites;
  const deviceChain = useMemo(() => {
    if (!metadata) return '—';
    const chain: string[] = [];
    if (metadata.exif.make || metadata.exif.model) {
      chain.push(`${metadata.exif.make ?? ''} ${metadata.exif.model ?? ''}`.trim());
    }
    if (metadata.exif.lensModel) {
      chain.push(metadata.exif.lensModel);
    }
    if (metadata.counts.xmp > 0 || metadata.counts.iptc > 0) {
      chain.push('Editing software detected');
    }
    if (metadata.counts.icc > 0) {
      chain.push('ICC profile embedded');
    }
    return chain.length > 0 ? chain.join(' → ') : 'Insufficient data';
  }, [metadata]);

  const handleManualSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!latInput || !lonInput) return;
    const latitude = Number(latInput);
    const longitude = Number(lonInput);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    onManualCoords({ latitude, longitude });
  };

  return (
    <section className="panel">
      <h2>{t('shock_title')}</h2>
      <div className="grid-two" style={{ marginTop: '1.5rem' }}>
        <div>
          <h3>{t('shock_timezone')}</h3>
          {!timestampIso && <p style={{ opacity: 0.6 }}>{t('timezone_missing')}</p>}
          {timestampIso && timezoneFetch.loading && <p>{t('timezone_loading')}</p>}
          {timestampIso && timezoneFetch.error && (
            <NotificationBanner
              tone="info"
              messageKey="notification_api_error"
              messageParams={{ service: 'timezone' }}
              onRetry={() => {
                if (gps && timestampIso) {
                  timezoneFetch.execute({
                    path: '/api/timezone-and-holiday',
                    params: { lat: gps.latitude, lon: gps.longitude, timestamp: timestampIso }
                  });
                }
              }}
              retryKey="timezone_retry"
            />
          )}
          {timezoneFetch.data && (
            <div>
              <p>{formatLocalDateTime(timezoneFetch.data.localTime, timezoneFetch.data.timezone)}</p>
              {timezoneFetch.data.holiday ? (
                <p>
                  {timezoneFetch.data.holiday.name} ({timezoneFetch.data.holiday.region})
                </p>
              ) : (
                <p style={{ opacity: 0.65 }}>—</p>
              )}
            </div>
          )}
        </div>

        <div>
          <h3>{t('shock_map')}</h3>
          {!gps && (
            <div>
              <p style={{ opacity: 0.6 }}>{t('map_missing')}</p>
              <form onSubmit={handleManualSubmit} style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                <label>
                  {t('manual_lat')}
                  <input value={latInput} onChange={(event) => setLatInput(event.target.value)} />
                </label>
                <label>
                  {t('manual_lon')}
                  <input value={lonInput} onChange={(event) => setLonInput(event.target.value)} />
                </label>
                <button className="button-secondary" type="submit">
                  {t('manual_apply')}
                </button>
              </form>
            </div>
          )}
          {gps && (
            <div>
              <MapView latitude={gps.latitude} longitude={gps.longitude} accuracy={gpsAccuracy ?? undefined} />
              {reverseGeoFetch.error && (
                <NotificationBanner
                  tone="info"
                  messageKey="notification_api_error"
                  messageParams={{ service: 'reverse geocode' }}
                  onRetry={() =>
                    reverseGeoFetch.execute({
                      path: '/api/reverse-geocode',
                      params: { lat: gps.latitude, lon: gps.longitude }
                    })
                  }
                  retryKey="map_retry"
                />
              )}
              <p style={{ marginTop: '0.75rem' }}>
                {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} {gpsAccuracy ? `±${gpsAccuracy}m` : ''}
              </p>
              {reverseGeoFetch.data && (
                <p>
                  {reverseGeoFetch.data.address}
                  <br />
                  {reverseGeoFetch.data.country} ({reverseGeoFetch.data.countryCode})
                </p>
              )}
              <div className="chip-list" style={{ marginTop: '0.5rem' }}>
                <a className="chip" href={googleMapsSearchUrl(gps.latitude, gps.longitude)} target="_blank" rel="noreferrer">
                  {t('map_links_maps')}
                </a>
                <a
                  className="chip"
                  href={googleStreetViewUrl(gps.latitude, gps.longitude, metadata?.exif.gpsImgDirection)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('map_links_street')}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid-two" style={{ marginTop: '1.5rem' }}>
        <div>
          <h3>{t('shock_weather')}</h3>
          {gps && timestampIso && weatherFetch.error && (
            <NotificationBanner
              tone="info"
              messageKey="notification_api_error"
              messageParams={{ service: 'weather' }}
              onRetry={() =>
                weatherFetch.execute({
                  path: '/api/historical-weather',
                  params: { lat: gps.latitude, lon: gps.longitude, timestamp: timestampIso }
                })
              }
              retryKey="weather_retry"
            />
          )}
          {weatherFetch.data && (
            <p>
              {t('weather_summary', {
                temp: weatherFetch.data.temperatureC,
                precip: weatherFetch.data.precipitationMm,
                cloud: weatherFetch.data.cloudCoverPercent
              })}
            </p>
          )}
        </div>
        <div>
          <h3>{t('shock_poi')}</h3>
          {gps && poiFetch.error && (
            <NotificationBanner
              tone="info"
              messageKey="notification_api_error"
              messageParams={{ service: 'POI' }}
              onRetry={() =>
                poiFetch.execute({
                  path: '/api/nearby-poi',
                  params: { lat: gps.latitude, lon: gps.longitude, radius: 250 }
                })
              }
              retryKey="poi_retry"
            />
          )}
          {poiFetch.data && poiFetch.data.length === 0 && <p>{t('poi_empty')}</p>}
          {poiFetch.data && poiFetch.data.length > 0 && (
            <ul>
              {poiFetch.data.map((poi) => (
                <li key={`${poi.name}-${poi.category}`}>
                  {poi.name || poi.category} — {Math.round(poi.distanceMeters)} м
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid-two" style={{ marginTop: '1.5rem' }}>
        <div>
          <h3>{t('shock_surveillance')}</h3>
          {gps && surveillanceFetch.error && (
            <NotificationBanner
              tone="info"
              messageKey="notification_api_error"
              messageParams={{ service: 'surveillance' }}
              onRetry={() =>
                surveillanceFetch.execute({
                  path: '/api/surveillance-candidates',
                  params: { lat: gps.latitude, lon: gps.longitude, radius: 300 }
                })
              }
              retryKey="surveillance_retry"
            />
          )}
          {surveillanceFetch.data && surveillanceFetch.data.length === 0 && <p>{t('surveillance_empty')}</p>}
          {surveillanceFetch.data && surveillanceFetch.data.length > 0 && (
            <ul>
              {surveillanceFetch.data.map((item, index) => (
                <li key={`${item.type}-${index}`}>
                  {item.type} — {Math.round(item.distanceMeters)} м
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>{t('shock_device')}</h3>
          <p>{deviceChain}</p>
        </div>
      </div>
    </section>
  );
};

export default ShockBlock;
