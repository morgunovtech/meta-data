import type { PagesEventContext, CfRequestInit } from './_types';

interface TimezoneResponse {
  ok: boolean;
  data?: {
    timezone: string;
    localTimeIso: string;
    holiday?: { name: string; countryCode: string };
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

  try {
    const tzInit: CfRequestInit = {
      cf: { cacheTtl: 900, cacheEverything: true }
    };
    const timezoneRes = await fetch(`https://api.open-meteo.com/v1/timezone?latitude=${lat}&longitude=${lon}`, tzInit);
    if (!timezoneRes.ok) {
      return json({ ok: false, error: `upstream-${timezoneRes.status}` });
    }
    const timezoneData = await timezoneRes.json<any>();
    const timezone = timezoneData.timezone as string | undefined;
    const countryCode = timezoneData.country_code as string | undefined;
    if (!timezone) {
      return json({ ok: false, error: 'timezone-missing' });
    }

    const localTimeIso = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);

    let holiday: { name: string; countryCode: string } | undefined;
    if (countryCode) {
      const year = date.getUTCFullYear();
      const holidayInit: CfRequestInit = {
        cf: { cacheTtl: 86_400, cacheEverything: true }
      };
      const holidaysRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`, holidayInit);
      if (holidaysRes.ok) {
        const holidays = (await holidaysRes.json()) as Array<{ date: string; localName: string; name: string }>;
        const calendarDate = new Intl.DateTimeFormat('sv-SE', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(date);
        const match = holidays.find((entry) => entry.date === calendarDate);
        if (match) {
          holiday = { name: match.localName ?? match.name, countryCode: countryCode.toUpperCase() };
        }
      }
    }

    return json({ ok: true, data: { timezone, localTimeIso, holiday } });
  } catch (error) {
    return json({ ok: false, error: (error as Error).message ?? 'unexpected-error' });
  }
}

function json(payload: TimezoneResponse): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  });
}
