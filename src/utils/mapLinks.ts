export function googleMapsLink(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

export function streetViewLink(lat: number, lon: number, heading?: number): string {
  const base = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
  if (heading == null) {
    return base;
  }
  return `${base}&heading=${heading}`;
}
