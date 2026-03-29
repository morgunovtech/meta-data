import React, { useEffect, useMemo } from 'react';
import { useT } from '../i18n';
import type { StructuredMetadata } from '../types/metadata';
import type { ReverseGeocodeResult, HistoricalWeatherResult, PoiResult } from '../types/api';
import { useAPIFetch } from '../hooks/useAPIFetch';
import { inferMovement, summarizeWeather } from '../utils/insights';
import { dedupeByNameAndDistance, localizeCategoryKey } from '../utils/insightsCompact';
import { DataInsightsCompact } from './DataInsightsCompact';

interface ShockBlockProps {
  metadata: StructuredMetadata | null;
}

export const ShockBlock: React.FC<ShockBlockProps> = ({ metadata }) => {
  const t = useT();
  const gpsHeading = metadata?.gps?.heading;

  const coords = useMemo(() => {
    if (metadata?.gps) {
      return { lat: metadata.gps.lat, lon: metadata.gps.lon };
    }
    return null;
  }, [metadata?.gps?.lat, metadata?.gps?.lon]);

  const timestamp = useMemo(() => metadata?.shotDate ?? new Date().toISOString(), [metadata?.shotDate]);

  const reverseFetch = useAPIFetch<ReverseGeocodeResult>();
  const weatherFetch = useAPIFetch<HistoricalWeatherResult>();
  const poiFetch = useAPIFetch<PoiResult[]>();
  const surveillanceFetch = useAPIFetch<PoiResult[]>();

  useEffect(() => {
    if (!coords) return;
    reverseFetch.request(`/api/reverse-geocode?lat=${coords.lat}&lon=${coords.lon}`);
  }, [coords]);

  useEffect(() => {
    if (!coords || !timestamp) return;
    weatherFetch.request(`/api/historical-weather?lat=${coords.lat}&lon=${coords.lon}&timestamp=${encodeURIComponent(timestamp)}`);
  }, [coords, timestamp]);

  useEffect(() => {
    if (!coords) return;
    poiFetch.request(`/api/nearby-poi?lat=${coords.lat}&lon=${coords.lon}`);
    surveillanceFetch.request(`/api/surveillance-candidates?lat=${coords.lat}&lon=${coords.lon}`);
  }, [coords]);

  const movement = useMemo(() => inferMovement(metadata), [metadata]);
  const weatherSummary = useMemo(() => summarizeWeather(weatherFetch.data ?? null), [weatherFetch.data]);
  const reverseData = reverseFetch.data ?? null;

  const accuracyMeters = useMemo(() => {
    const candidates = [metadata?.gps?.accuracy, reverseData?.precisionMeters]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    if (candidates.length === 0) {
      return null;
    }
    return Math.min(...candidates);
  }, [metadata?.gps?.accuracy, reverseData?.precisionMeters]);

  const poiItems = useMemo(() => {
    if (!poiFetch.data) return [];
    return dedupeByNameAndDistance(poiFetch.data)
      .slice(0, 8)
      .map((poi) => ({
        ...poi,
        name: poi.name?.trim()?.length ? poi.name : localizeCategoryKey(poi.category, t)
      }));
  }, [poiFetch.data, t]);

  const surveillanceItems = useMemo(() => {
    if (!surveillanceFetch.data) return [];
    return dedupeByNameAndDistance(surveillanceFetch.data).slice(0, 8);
  }, [surveillanceFetch.data]);

  return (
    <section className="panel insights-panel">
      <DataInsightsCompact
        reverseData={reverseData}
        reverseLoading={reverseFetch.loading}
        reverseError={reverseFetch.error}
        coords={coords}
        accuracyMeters={accuracyMeters}
        shotDate={metadata?.shotDate}
        movement={movement}
        weather={weatherSummary}
        weatherLoading={weatherFetch.loading}
        weatherError={weatherFetch.error}
        poiItems={poiItems}
        poiLoading={poiFetch.loading}
        poiError={poiFetch.error}
        surveillanceItems={surveillanceItems}
        surveillanceLoading={surveillanceFetch.loading}
        surveillanceError={surveillanceFetch.error}
        gpsHeading={gpsHeading}
      />

    </section>
  );
};
