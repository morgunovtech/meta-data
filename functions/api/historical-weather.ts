import type { PagesEventContext, CfRequestInit } from './_types';

interface WeatherResponse {
  ok: boolean;
  data?: {
    temperature: number;
    precipitation: number;
    cloudCover: number;
    windSpeed: number;
    pressure: number;
  };
  error?: string;
}

export async function onRequest({ request }: PagesEventContext): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const timestamp = url.searchParams.get('timestamp');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !timestamp) {
    return json({ ok: false, error: 'invalid-parameters' });
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return json({ ok: false, error: 'invalid-timestamp' });
  }

  const dateStr = date.toISOString().split('T')[0];
  const hour = date.getUTCHours();

  const apiUrl =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${dateStr}&end_date=${dateStr}` +
    '&hourly=temperature_2m,precipitation,cloudcover,wind_speed_10m,pressure_msl&timezone=UTC';

  try {
    const init: CfRequestInit = {
      cf: { cacheTtl: 900, cacheEverything: true }
    };
    const response = await fetch(apiUrl, init);
    if (!response.ok) {
      return json({ ok: false, error: `upstream-${response.status}` });
    }
    const payload = await response.json<any>();
    const times: string[] = payload.hourly?.time ?? [];
    const index = times.findIndex((time) => time.endsWith(`T${hour.toString().padStart(2, '0')}:00`));
    if (index === -1) {
      return json({ ok: false, error: 'no-hourly-data' });
    }
    const temperature = payload.hourly.temperature_2m?.[index];
    const precipitation = payload.hourly.precipitation?.[index];
    const cloudcover = payload.hourly.cloudcover?.[index];
    const wind = payload.hourly.wind_speed_10m?.[index];
    const pressure = payload.hourly.pressure_msl?.[index];

    return json({
      ok: true,
      data: {
        temperature: Number(temperature ?? 0),
        precipitation: Number(precipitation ?? 0),
        cloudCover: Number(cloudcover ?? 0),
        windSpeed: Number(wind ?? 0),
        pressure: Number(pressure ?? 0)
      }
    });
  } catch (error) {
    return json({ ok: false, error: (error as Error).message ?? 'unexpected-error' });
  }
}

function json(payload: WeatherResponse): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  });
}
