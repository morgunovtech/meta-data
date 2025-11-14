const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
export async function onRequest(context: { request: Request }) {
  const url = new URL(context.request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');

  if (!lat || !lon) {
    return jsonResponse({ ok: false, error: 'missing_coordinates' }, 400);
  }

  try {
    const response = await fetch(`${NOMINATIM_ENDPOINT}?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18`, {
      headers: {
        'User-Agent': 'meta-data-privacy-analyzer/1.0 (contact@example.com)'
      }
    });
    if (!response.ok) {
      throw new Error(`status_${response.status}`);
    }
    const data = await response.json<any>();
    return jsonResponse({
      ok: true,
      data: {
        address: data.display_name ?? '',
        country: data.address?.country ?? '',
        countryCode: (data.address?.country_code ?? '').toUpperCase(),
        precisionMeters: data.extratags?.distance ? Number(data.extratags.distance) : undefined
      }
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'request_failed' }, 502);
  }
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=3600'
    }
  });
