import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
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
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [lon, lat],
      zoom: 15,
      attributionControl: true
    });
    mapRef.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));
    const marker = new maplibregl.Marker({ color: '#38bdf8' }).setLngLat([lon, lat]).addTo(mapRef.current);

    return () => {
      marker.remove();
      mapRef.current?.remove();
    };
  }, [lat, lon]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter([lon, lat]);
    }
  }, [lat, lon]);

  return <div ref={containerRef} className="map-container" />;
};
