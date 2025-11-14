import { badRequest, fetchJson, respond } from './_utils';

type OverpassResponse = {
  elements: Array<{
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
    type: string;
    center?: {
      lat: number;
      lon: number;
    };
  }>;
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function onRequest({ request }: { request: Request }) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');

  if (!lat || !lon) {
    return badRequest('Missing coordinates');
  }

  const numericLat = Number(lat);
  const numericLon = Number(lon);

  if (!Number.isFinite(numericLat) || !Number.isFinite(numericLon)) {
    return badRequest('Invalid coordinates');
  }

  const query = `[out:json][timeout:25];(
    node(around:250,${numericLat},${numericLon})["amenity"];
    node(around:250,${numericLat},${numericLon})["shop"];
    node(around:250,${numericLat},${numericLon})["tourism"];
 );out body 10;`;

  try {
    const data = await fetchJson<OverpassResponse>('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    });

    const features = (data.elements ?? [])
      .map((element) => {
        const centerLat = element.lat ?? element.center?.lat;
        const centerLon = element.lon ?? element.center?.lon;
        if (centerLat === undefined || centerLon === undefined) return undefined;
        const distance = haversine(numericLat, numericLon, centerLat, centerLon);
        const name = element.tags?.name ?? element.tags?.brand;
        const type = element.tags?.amenity ?? element.tags?.shop ?? element.tags?.tourism;
        return { name, type, distance };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.distance ?? 0) - (b!.distance ?? 0))
      .slice(0, 5);

    return respond({ ok: true, data: features });
  } catch (error) {
    console.error('nearby-poi-error', error);
    return respond({ ok: false, error: 'poi lookup failed' }, { status: 502 });
  }
}
