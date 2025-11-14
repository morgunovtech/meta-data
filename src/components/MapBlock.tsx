import React, { useEffect, useRef } from 'react';
import type { GpsMetadata } from '../types/metadata';
import { useI18n } from '../i18n/I18nContext';
import { googleMapsLink, streetViewLink } from '../utils/links';
import type { ReverseGeocodeResult } from '../types/api';

export const MapBlock: React.FC<{ gps?: GpsMetadata; address?: ReverseGeocodeResult }> = ({ gps, address }) => {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gps?.latitude || !gps?.longitude) return;
    let map: any;

    (async () => {
      const maplibre = await import('maplibre-gl');
      map = new maplibre.Map({
        container: mapContainerRef.current!,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [gps.longitude!, gps.latitude!],
        zoom: 15
      });
      map.addControl(new maplibre.NavigationControl(), 'top-right');
      map.on('load', () => {
        map.addSource('point', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [gps.longitude!, gps.latitude!]
                }
              }
            ]
          }
        });
        map.addLayer({
          id: 'point',
          type: 'circle',
          source: 'point',
          paint: {
            'circle-radius': 8,
            'circle-color': '#2563eb',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#0f172a'
          }
        });
        if (gps.accuracy) {
          const radius = gps.accuracy;
          map.addSource('accuracy', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [createCircle(gps.longitude!, gps.latitude!, radius)]
              }
            }
          });
          map.addLayer({
            id: 'accuracy',
            type: 'fill',
            source: 'accuracy',
            paint: {
              'fill-color': '#60a5fa',
              'fill-opacity': 0.25
            }
          });
        }
      });
    })();

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [gps?.latitude, gps?.longitude, gps?.accuracy]);

  if (!gps?.latitude || !gps.longitude) {
    return <p>{t('geolocationMissing')}</p>;
  }

  return (
    <div className="map-block">
      <div ref={mapContainerRef} className="map-container" aria-label={t('mapTitle')} />
      <div className="map-info">
        <p>
          {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
        </p>
        {gps.accuracy && (
          <p>
            {t('gpsAccuracy')}: ±{Math.round(gps.accuracy)} m
          </p>
        )}
        {address && (
          <>
            <p>{address.address}</p>
            {address.country && <p>{address.country}</p>}
          </>
        )}
        <div className="map-links">
          <a href={googleMapsLink(gps.latitude, gps.longitude)} target="_blank" rel="noopener noreferrer">
            {t('openMaps')}
          </a>
          <a href={streetViewLink(gps.latitude, gps.longitude, gps.heading)} target="_blank" rel="noopener noreferrer">
            {t('openStreetView')}
          </a>
        </div>
      </div>
    </div>
  );
};

function createCircle(lon: number, lat: number, radiusInMeters: number, points = 64) {
  const coords = [] as [number, number][];
  const distanceX = radiusInMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInMeters / 110574;

  for (let i = 0; i < points; i += 1) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lon + x, lat + y]);
  }

  coords.push(coords[0]);
  return coords;
}
