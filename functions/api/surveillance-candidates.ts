import type { PagesEventContext, CfRequestInit } from './_types';

interface SurveillanceResponse {
  ok: boolean;
  data?: Array<{ name: string; category: string; distance: number }>;
  error?: string;
}

export async function onRequest({ request }: PagesEventContext): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json({ ok: false, error: 'invalid-coordinates' });
  }

  const query = `
[out:json][timeout:25];
(
  node["man_made"="surveillance"](around:300,${lat},${lon});
  node["surveillance"](around:300,${lat},${lon});
  node["amenity"~"bank|atm|bureau_de_change"](around:300,${lat},${lon});
  node["shop"~"mall|supermarket|convenience"](around:300,${lat},${lon});
  way["man_made"="surveillance"](around:300,${lat},${lon});
  way["amenity"~"bank|atm"](around:300,${lat},${lon});
  relation["man_made"="surveillance"](around:300,${lat},${lon});
);
out center;`;

  try {
    const init: CfRequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      cf: { cacheTtl: 600, cacheEverything: true }
    };
    const response = await fetch('https://overpass-api.de/api/interpreter', init);

    if (!response.ok) {
      return json({ ok: false, error: `upstream-${response.status}` });
    }

    const result = await response.json<any>();
    const items: Array<{ name: string; category: string; distance: number }> = [];
    for (const element of result.elements ?? []) {
      const position = getPosition(element);
      if (!position) continue;
      const distance = haversine(lat, lon, position.lat, position.lon);
      const tags = element.tags ?? {};
      const name = tags.name ?? tags.brand ?? '';
      const category = tags.surveillance || tags.man_made || tags.amenity || tags.shop || 'surveillance';
      items.push({ name, category, distance });
    }

    const data = items
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map((item) => ({ ...item, distance: Math.round(item.distance) }));

    return json({ ok: true, data });
  } catch (error) {
    return json({ ok: false, error: (error as Error).message ?? 'unexpected-error' });
  }
}

function getPosition(element: any): { lat: number; lon: number } | null {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center && typeof element.center.lat === 'number' && typeof element.center.lon === 'number') {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function json(payload: SurveillanceResponse): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  });
}
