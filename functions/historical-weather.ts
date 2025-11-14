const pickHourIndex = (times: string[], targetIso: string) => {
  const target = new Date(targetIso).getTime();
  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });
  return bestIndex;
};

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const time = url.searchParams.get('time');

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !time) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid parameters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const date = new Date(time);
  if (Number.isNaN(date.getTime())) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid date' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const dateStr = date.toISOString().slice(0, 10);

  const apiUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
  apiUrl.searchParams.set('latitude', lat.toString());
  apiUrl.searchParams.set('longitude', lon.toString());
  apiUrl.searchParams.set('start_date', dateStr);
  apiUrl.searchParams.set('end_date', dateStr);
  apiUrl.searchParams.set('hourly', 'temperature_2m,precipitation,cloudcover,windspeed_10m,pressure_msl');
  apiUrl.searchParams.set('timezone', 'UTC');

  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`weather ${response.status}`);
    const json = await response.json<any>();
    if (!json?.hourly?.time?.length) throw new Error('no data');
    const index = pickHourIndex(json.hourly.time, time);
    const result = {
      temperatureC: Number(json.hourly.temperature_2m?.[index] ?? 0),
      precipitationMm: Number(json.hourly.precipitation?.[index] ?? 0),
      cloudCoverPercent: Number(json.hourly.cloudcover?.[index] ?? 0),
      windSpeedKmh: Number(json.hourly.windspeed_10m?.[index] ?? 0),
      pressureHpa: Number(json.hourly.pressure_msl?.[index] ?? 0)
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
