import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Polygon } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapBlockProps {
  lat: number;
  lon: number;
  accuracy?: number;
}

export const MapBlock: React.FC<MapBlockProps> = ({ lat, lon, accuracy }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [lon, lat],
      zoom: 15,
      attributionControl: true
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));
    const marker = new maplibregl.Marker({ color: '#38bdf8' }).setLngLat([lon, lat]).addTo(map);

    const resize = () => {
      map.resize();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resize);
    }

    return () => {
      marker.remove();
      clearAccuracy(map);
      map.remove();
      mapRef.current = null;
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', resize);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter([lon, lat]);
      mapRef.current.resize();
    }
  }, [lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      applyAccuracy(map, lat, lon, accuracy);
    } else {
      const handler = () => applyAccuracy(map, lat, lon, accuracy);
      map.once('load', handler);
    }
  }, [lat, lon, accuracy]);

  return <div ref={containerRef} className="map-container" />;
};

const ACCURACY_SOURCE = 'accuracy-circle';
const ACCURACY_LAYER = 'accuracy-circle-fill';
const ACCURACY_OUTLINE_LAYER = 'accuracy-circle-outline';

function applyAccuracy(map: maplibregl.Map, lat: number, lon: number, accuracy?: number) {
  if (!accuracy || accuracy <= 0) {
    clearAccuracy(map);
    return;
  }
  const data = createCircleGeoJson(lat, lon, accuracy);
  const existingSource = map.getSource(ACCURACY_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(data);
    return;
  }
  map.addSource(ACCURACY_SOURCE, {
    type: 'geojson',
    data
  });
  map.addLayer({
    id: ACCURACY_LAYER,
    type: 'fill',
    source: ACCURACY_SOURCE,
    paint: {
      'fill-color': '#38bdf8',
      'fill-opacity': 0.18
    }
  });
  map.addLayer({
    id: ACCURACY_OUTLINE_LAYER,
    type: 'line',
    source: ACCURACY_SOURCE,
    paint: {
      'line-color': '#38bdf8',
      'line-width': 1.5,
      'line-opacity': 0.6
    }
  });
}

function clearAccuracy(map: maplibregl.Map) {
  if (map.getLayer(ACCURACY_LAYER)) {
    map.removeLayer(ACCURACY_LAYER);
  }
  if (map.getLayer(ACCURACY_OUTLINE_LAYER)) {
    map.removeLayer(ACCURACY_OUTLINE_LAYER);
  }
  if (map.getSource(ACCURACY_SOURCE)) {
    map.removeSource(ACCURACY_SOURCE);
  }
}

function createCircleGeoJson(lat: number, lon: number, radiusMeters: number): FeatureCollection<Polygon> {
  const steps = 64;
  const coordinates: [number, number][] = [];
  const earthRadius = 6_371_000;
  const centerLatRad = (lat * Math.PI) / 180;
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    const offsetLat = (radiusMeters / earthRadius) * Math.sin(angle);
    const offsetLon = (radiusMeters / earthRadius) * Math.cos(angle) / Math.cos(centerLatRad);
    const pointLat = lat + (offsetLat * 180) / Math.PI;
    const pointLon = lon + (offsetLon * 180) / Math.PI;
    coordinates.push([pointLon, pointLat]);
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      }
    ]
  };
}
