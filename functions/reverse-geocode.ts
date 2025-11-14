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

  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
  nominatimUrl.searchParams.set('format', 'jsonv2');
  nominatimUrl.searchParams.set('lat', lat.toString());
  nominatimUrl.searchParams.set('lon', lon.toString());

  try {
    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'meta-data-privacy-analyzer/1.0 (https://github.com/example)'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }
    const json = await response.json<any>();
    const result = {
      address: json.display_name ?? 'Unknown',
      country: json.address?.country,
      isoCode: json.address?.country_code?.toUpperCase(),
      precisionMeters: json.extratags?.accuracy ? Number(json.extratags.accuracy) : undefined
    };
    return new Response(JSON.stringify({ ok: true, data: result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
