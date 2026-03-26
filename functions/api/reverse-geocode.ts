import type { PagesEventContext, CfRequestInit } from './_types';
import { json, methodNotAllowed } from './_geo';

export async function onRequest({ request }: PagesEventContext): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed();

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
        'User-Agent': 'meta-data-insight/1.0 (https://github.com/nicenemo/meta-data)'
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

    const result = await (await response.json()) as any;
    const boundingBox = (result.boundingbox ?? []).map((value: string) => Number(value));
    const precision = estimatePrecision(boundingBox);
    const data = {
      address: result.display_name ?? 'Unknown address',
      country: result.address?.country ?? 'Unknown',
      countryCode: result.address?.country_code?.toUpperCase(),
      city: result.address?.city ?? result.address?.town ?? result.address?.village,
      state: result.address?.state,
      district: result.address?.suburb ?? result.address?.county ?? result.address?.state_district,
      road: result.address?.road ?? result.address?.pedestrian ?? result.address?.footway,
      houseNumber: result.address?.house_number,
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
  return maxDelta * 111_139;
}
