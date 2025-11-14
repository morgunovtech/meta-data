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
    node(around:300,${lat},${lon})[surveillance];
    node(around:300,${lat},${lon})[amenity~"^(bank|atm|police|post_office)$"];
    node(around:300,${lat},${lon})[shop~"^(mall|department_store|supermarket)$"];
    node(around:300,${lat},${lon})[amenity~"^(fuel_station)$"];
  );out body;`;

  try {
    const response = await buildOverpassRequest(query);
    if (!response.ok) throw new Error(`overpass ${response.status}`);
    const json = await response.json<any>();
    const elements = Array.isArray(json.elements) ? json.elements : [];
    const results = elements
      .map((element: any) => ({
        category: element.tags?.surveillance
          ? `surveillance=${element.tags.surveillance}`
          : element.tags?.amenity ?? element.tags?.shop ?? 'poi',
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
