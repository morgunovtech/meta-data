export const googleMapsSearchUrl = (lat: number, lon: number): string =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

export const googleStreetViewUrl = (lat: number, lon: number, heading?: number): string => {
  const base = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
  if (heading === undefined) {
    return base;
  }
  return `${base}&heading=${heading}`;
};
