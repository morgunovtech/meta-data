const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const DEFAULT_RADIUS = 300;

const surveillanceTags = [
  'surveillance',
  'atm',
  'bank',
  'security',
  'police',
  'shop',
  'mall',
  'fuel',
  'gas_station'
];

export async function onRequest(context: { request: Request }) {
  const url = new URL(context.request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const radiusParam = Number(url.searchParams.get('radius') ?? DEFAULT_RADIUS);

  if (!lat || !lon) {
    return jsonResponse({ ok: false, error: 'missing_coordinates' }, 400);
  }

  const radius = Number.isNaN(radiusParam) ? DEFAULT_RADIUS : Math.min(Math.max(radiusParam, 50), 400);

  const query = `
  [out:json][timeout:25];
  (
    node["surveillance"](${lat},${lon},${radius});
    way["surveillance"](${lat},${lon},${radius});
    node["amenity"="bank"](${lat},${lon},${radius});
    node["amenity"="atm"](${lat},${lon},${radius});
    node["shop"](${lat},${lon},${radius});
    node["amenity"="fuel"](${lat},${lon},${radius});
  );
  out center 10;
  `;

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query
    });
    if (!response.ok) throw new Error(`status_${response.status}`);
    const data = await response.json<any>();
    const results = (data.elements ?? [])
      .map((item: any) => {
        const tagEntry = Object.entries(item.tags ?? {}).find(([key]) => surveillanceTags.includes(key));
        const label = tagEntry ? `${tagEntry[0]}:${tagEntry[1]}` : 'surveillance';
        const latNode = item.lat ?? item.center?.lat ?? 0;
        const lonNode = item.lon ?? item.center?.lon ?? 0;
        const distanceMeters = haversine(Number(lat), Number(lon), latNode, lonNode);
        return { type: label, distanceMeters };
      })
      .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters)
      .slice(0, 5);

    return jsonResponse({ ok: true, data: results });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'request_failed' }, 502);
  }
}

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=600'
    }
  });
