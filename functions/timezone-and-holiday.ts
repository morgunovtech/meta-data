import { badRequest, fetchJson, respond } from './_utils';

type ReverseGeo = {
  countryCode?: string;
  countryName?: string;
  timeZone?: {
    id?: string;
  };
};

type Holiday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
};

export async function onRequest({ request }: { request: Request }) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const timestamp = url.searchParams.get('timestamp');

  if (!lat || !lon || !timestamp) {
    return badRequest('Missing coordinates or timestamp');
  }

  try {
    const reverse = await fetchJson<ReverseGeo>(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`
    );

    const timezone = reverse.timeZone?.id;
    const dateIso = new Date(timestamp);
    if (Number.isNaN(dateIso.getTime())) {
      return badRequest('Invalid timestamp');
    }

    const dateString = dateIso.toISOString();
    let holidayInfo: Holiday | undefined;

    if (reverse.countryCode) {
      const holidays = await fetchJson<Holiday[]>(
        `https://date.nager.at/api/v3/PublicHolidays/${dateIso.getUTCFullYear()}/${reverse.countryCode}`
      );
      holidayInfo = holidays.find((holiday) => holiday.date === dateString.slice(0, 10));
    }

    return respond({
      ok: true,
      data: {
        timezone,
        localTime: timezone
          ? new Intl.DateTimeFormat('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: timezone
            }).format(dateIso)
          : dateString,
        isHoliday: holidayInfo ? true : false,
        holidayName: holidayInfo?.localName ?? holidayInfo?.name,
        regionCode: reverse.countryCode ?? reverse.countryName
      }
    });
  } catch (error) {
    console.error('timezone-holiday-error', error);
    return respond({ ok: false, error: 'timezone lookup failed' }, { status: 502 });
  }
}
