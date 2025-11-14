import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

const MapView: React.FC<Props> = ({ latitude, longitude, accuracy }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.setCenter([longitude, latitude]);
      mapRef.current.setZoom(15);
      return;
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [longitude, latitude],
      zoom: 15,
      attributionControl: true
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const marker = new maplibregl.Marker({ color: '#38bdf8' })
      .setLngLat([longitude, latitude])
      .addTo(map);

    if (accuracy) {
      const circle = new maplibregl.LngLatBounds();
      const radius = accuracy / 111320; // approximate degrees per meter
      circle.extend([longitude - radius, latitude - radius]);
      circle.extend([longitude + radius, latitude + radius]);
      map.fitBounds(circle, { padding: 40, maxZoom: 17 });
    }

    mapRef.current = map;

    return () => {
      marker.remove();
      map.remove();
    };
  }, [accuracy, latitude, longitude]);

  return <div className="map-container" ref={containerRef} aria-label="Map preview" />;
};

export default MapView;
