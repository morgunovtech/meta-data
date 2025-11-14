const TIMEZONE_ENDPOINT = 'https://api.open-meteo.com/v1/timezone';
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const HOLIDAY_ENDPOINT = 'https://date.nager.at/api/v3/PublicHolidays';
export async function onRequest(context: { request: Request }) {
  const url = new URL(context.request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const timestamp = url.searchParams.get('timestamp');

  if (!lat || !lon || !timestamp) {
    return jsonResponse({ ok: false, error: 'missing_parameters' }, 400);
  }

  try {
    const [tzResponse, geoResponse] = await Promise.all([
      fetch(`${TIMEZONE_ENDPOINT}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&timestamp=${encodeURIComponent(timestamp)}`),
      fetch(`${NOMINATIM_ENDPOINT}?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=5`, {
        headers: {
          'User-Agent': 'meta-data-privacy-analyzer/1.0 (contact@example.com)'
        }
      })
    ]);

    if (!tzResponse.ok) throw new Error(`tz_${tzResponse.status}`);
    if (!geoResponse.ok) throw new Error(`geo_${geoResponse.status}`);

    const tzData = await tzResponse.json<any>();
    const geoData = await geoResponse.json<any>();
    const countryCode = (geoData.address?.country_code ?? '').toUpperCase();

    let holiday: { name: string; region: string } | null = null;
    if (countryCode) {
      const date = new Date(timestamp);
      const year = date.getUTCFullYear();
      const dayString = date.toISOString().split('T')[0];
      const holidayResponse = await fetch(`${HOLIDAY_ENDPOINT}/${year}/${countryCode}`);
      if (holidayResponse.ok) {
        const holidayData = await holidayResponse.json<any[]>();
        const match = holidayData.find((item) => item.date === dayString);
        if (match) {
          holiday = { name: match.localName ?? match.name ?? 'Holiday', region: match.countryCode };
        }
      }
    }

    return jsonResponse({
      ok: true,
      data: {
        timezone: tzData.timezone ?? 'UTC',
        localTime: tzData.local_time ?? timestamp,
        holiday
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
      'Cache-Control': 's-maxage=900'
    }
  });
