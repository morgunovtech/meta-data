import type { PagesEventContext, CfRequestInit } from './_types';
import { json, methodNotAllowed, getPosition, haversine } from './_geo';

export async function onRequest({ request }: PagesEventContext): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed();

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json({ ok: false, error: 'invalid-coordinates' });
  }

  const query = `
[out:json][timeout:25];
(
  node["amenity"](around:250,${lat},${lon});
  node["shop"](around:250,${lat},${lon});
  node["tourism"](around:250,${lat},${lon});
  node["leisure"](around:250,${lat},${lon});
  way["amenity"](around:250,${lat},${lon});
  way["shop"](around:250,${lat},${lon});
  relation["amenity"](around:250,${lat},${lon});
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

    const result = await (await response.json()) as any;
    const items: Array<{ name: string; category: string; distance: number }> = [];
    for (const element of result.elements ?? []) {
      const position = getPosition(element);
      if (!position) continue;
      const distance = haversine(lat, lon, position.lat, position.lon);
      const tags = element.tags ?? {};
      const name = tags.name ?? tags.brand ?? '';
      const category =
        tags.amenity ||
        tags.shop ||
        tags.tourism ||
        tags.leisure ||
        tags.man_made ||
        'poi';
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
