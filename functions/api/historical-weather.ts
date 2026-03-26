import type { PagesEventContext, CfRequestInit } from './_types';
import { json, methodNotAllowed } from './_geo';

export async function onRequest({ request }: PagesEventContext): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed();

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
    const payload = await (await response.json()) as any;
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
        temperature: temperature != null ? Number(temperature) : null,
        precipitation: precipitation != null ? Number(precipitation) : null,
        cloudCover: cloudcover != null ? Number(cloudcover) : null,
        windSpeed: wind != null ? Number(wind) : null,
        pressure: pressure != null ? Number(pressure) : null
      }
    });
  } catch (error) {
    return json({ ok: false, error: (error as Error).message ?? 'unexpected-error' });
  }
}
