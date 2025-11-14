import type { PagesEventContext, CfRequestInit } from './_types';

interface ReverseGeocodeResponse {
  ok: boolean;
  data?: {
    address: string;
    country: string;
    countryCode?: string;
    precisionMeters?: number;
    lat: number;
    lon: number;
  };
  error?: string;
}

export async function onRequest({ request }: PagesEventContext): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json({ ok: false, error: 'invalid-coordinates' });
  }

  try {
    const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const init: CfRequestInit = {
      headers: {
        'User-Agent': 'meta-data-insight/1.0 (https://github.com/)'
      },
      cf: {
        cacheTtl: 900,
        cacheEverything: true
      }
    };
    const response = await fetch(apiUrl, init);

    if (!response.ok) {
      return json({ ok: false, error: `upstream-${response.status}` });
    }

    const result = await response.json<any>();
    const boundingBox = (result.boundingbox ?? []).map((value: string) => Number(value));
    const precision = estimatePrecision(boundingBox);
    const data = {
      address: result.display_name ?? 'Unknown address',
      country: result.address?.country ?? 'Unknown',
      countryCode: result.address?.country_code?.toUpperCase(),
      precisionMeters: precision,
      lat,
      lon
    };

    return json({ ok: true, data });
  } catch (error) {
    return json({ ok: false, error: (error as Error).message ?? 'unexpected-error' });
  }
}

function estimatePrecision(boundingBox: number[]): number | undefined {
  if (boundingBox.length !== 4) return undefined;
  const [latMin, latMax, lonMin, lonMax] = boundingBox;
  const latDelta = Math.abs(latMax - latMin);
  const lonDelta = Math.abs(lonMax - lonMin);
  const maxDelta = Math.max(latDelta, lonDelta);
  if (!Number.isFinite(maxDelta)) return undefined;
  return maxDelta * 111_139; // approx meters per degree
}

function json(payload: ReverseGeocodeResponse): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  });
}
