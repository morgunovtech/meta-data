export const createGoogleMapsLink = (lat: number, lon: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

export const createStreetViewLink = (lat: number, lon: number, heading?: number) => {
  const params = new URLSearchParams({
    api: '1',
    map_action: 'pano',
    viewpoint: `${lat},${lon}`
  });
  if (typeof heading === 'number') {
    params.set('heading', heading.toFixed(0));
  }
  return `https://www.google.com/maps/@?${params.toString()}`;
};
