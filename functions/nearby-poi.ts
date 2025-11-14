import { buildOverpassRequest, haversineDistance } from './_shared';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid coordinates' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const query = `[out:json][timeout:25];(
    node(around:250,${lat},${lon})[amenity];
    node(around:250,${lat},${lon})[shop];
    node(around:250,${lat},${lon})[tourism];
  );out body;`;

  try {
    const response = await buildOverpassRequest(query);
    if (!response.ok) throw new Error(`overpass ${response.status}`);
    const json = await response.json<any>();
    const elements = Array.isArray(json.elements) ? json.elements : [];
    const results = elements
      .map((element: any) => ({
        name: element.tags?.name ?? '',
        category: element.tags?.amenity ?? element.tags?.shop ?? element.tags?.tourism ?? 'poi',
        distanceMeters: haversineDistance(lat, lon, element.lat, element.lon)
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 5);

    return new Response(JSON.stringify({ ok: true, data: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
