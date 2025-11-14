import { badRequest, fetchJson, respond } from './_utils';

type NominatimResponse = {
  display_name?: string;
  address?: {
    country?: string;
    country_code?: string;
  };
  extratags?: Record<string, string>;
};

export async function onRequest({ request }: { request: Request }) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');

  if (!lat || !lon) {
    return badRequest('Missing lat/lon');
  }

  try {
    const data = await fetchJson<NominatimResponse>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=16`
    );

    return respond({
      ok: true,
      data: {
        address: data.display_name ?? 'Unknown location',
        country: data.address?.country,
        countryCode: data.address?.country_code?.toUpperCase()
      }
    });
  } catch (error) {
    console.error('reverse-geocode-error', error);
    return respond({ ok: false, error: 'reverse geocoding failed' }, { status: 502 });
  }
}
