import { badRequest, fetchJson, respond } from './_utils';

type WeatherResponse = {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    cloudcover: number[];
    windspeed_10m: number[];
    pressure_msl: number[];
  };
};

export async function onRequest({ request }: { request: Request }) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const timestamp = url.searchParams.get('timestamp');

  if (!lat || !lon || !timestamp) {
    return badRequest('Missing coordinates or timestamp');
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return badRequest('Invalid timestamp');
  }

  const dateStr = date.toISOString().slice(0, 10);

  try {
    const data = await fetchJson<WeatherResponse>(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,pressure_msl&timezone=UTC`
    );

    if (!data.hourly) {
      return respond({ ok: false, error: 'No weather data' }, { status: 404 });
    }

    const index = data.hourly.time.findIndex((time) => time.startsWith(dateStr));
    const safeIndex = index >= 0 ? index : 0;

    return respond({
      ok: true,
      data: {
        temperatureC: data.hourly.temperature_2m[safeIndex],
        precipitationMm: data.hourly.precipitation[safeIndex],
        cloudCover: data.hourly.cloudcover[safeIndex],
        windSpeedKmh: data.hourly.windspeed_10m[safeIndex],
        pressureHpa: data.hourly.pressure_msl[safeIndex]
      }
    });
  } catch (error) {
    console.error('weather-error', error);
    return respond({ ok: false, error: 'weather lookup failed' }, { status: 502 });
  }
}
