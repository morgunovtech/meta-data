const WEATHER_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';
export async function onRequest(context: { request: Request }) {
  const url = new URL(context.request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const timestamp = url.searchParams.get('timestamp');

  if (!lat || !lon || !timestamp) {
    return jsonResponse({ ok: false, error: 'missing_parameters' }, 400);
  }

  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      throw new Error('invalid_timestamp');
    }
    const day = date.toISOString().split('T')[0];
    const urlRequest = `${WEATHER_ENDPOINT}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(
      lon
    )}&start_date=${day}&end_date=${day}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,pressure_msl&timezone=UTC`;
    const response = await fetch(urlRequest);
    if (!response.ok) {
      throw new Error(`status_${response.status}`);
    }
    const data = await response.json<any>();
    const index = data.hourly?.time?.findIndex((value: string) => value.startsWith(day));
    const idx = index && index >= 0 ? index : 0;
    return jsonResponse({
      ok: true,
      data: {
        temperatureC: Number(data.hourly?.temperature_2m?.[idx] ?? 0),
        precipitationMm: Number(data.hourly?.precipitation?.[idx] ?? 0),
        cloudCoverPercent: Number(data.hourly?.cloudcover?.[idx] ?? 0),
        windSpeedKmh: Number(data.hourly?.windspeed_10m?.[idx] ?? 0),
        pressureHpa: Number(data.hourly?.pressure_msl?.[idx] ?? 0)
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
