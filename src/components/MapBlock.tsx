import React, { useEffect, useRef } from 'react';
import maplibregl, { Map } from 'maplibre-gl';

type MapBlockProps = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export const MapBlock: React.FC<MapBlockProps> = ({ latitude, longitude, accuracy }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [longitude, latitude],
      zoom: 15
    });

    const marker = new maplibregl.Marker({ color: '#38bdf8' }).setLngLat([longitude, latitude]).addTo(mapRef.current);

    if (accuracy) {
      const circle = document.createElement('div');
      circle.className = 'map-accuracy';
      const radiusMeters = accuracy;
      const metersPerPixel = (40075016.686 * Math.abs(Math.cos((latitude * Math.PI) / 180))) / Math.pow(2, 15 + 8);
      const radiusPixels = radiusMeters / metersPerPixel;
      circle.style.width = `${radiusPixels * 2}px`;
      circle.style.height = `${radiusPixels * 2}px`;
      circle.style.marginLeft = `${-radiusPixels}px`;
      circle.style.marginTop = `${-radiusPixels}px`;
      const overlay = document.createElement('div');
      overlay.className = 'map-accuracy-overlay';
      overlay.appendChild(circle);
      mapRef.current.on('load', () => {
        marker.getElement().appendChild(overlay);
      });
    }

    return () => {
      marker.remove();
      mapRef.current?.remove();
    };
  }, [latitude, longitude, accuracy]);

  return <div className="map-container" ref={containerRef} aria-hidden="true" />;
};
