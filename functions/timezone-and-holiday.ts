const formatLocalTime = (iso: string, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso));
  } catch (error) {
    return iso;
  }
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

  try {
    const timezoneUrl = new URL('https://api.open-meteo.com/v1/timezone');
    timezoneUrl.searchParams.set('latitude', lat.toString());
    timezoneUrl.searchParams.set('longitude', lon.toString());
    timezoneUrl.searchParams.set('date', time.slice(0, 10));

    const [timezoneRes, reverseRes] = await Promise.all([
      fetch(timezoneUrl, { signal: AbortSignal.timeout(8000) }),
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
        headers: { 'User-Agent': 'meta-data-privacy-analyzer/1.0 (https://github.com/example)' },
        signal: AbortSignal.timeout(8000)
      })
    ]);

    if (!timezoneRes.ok) throw new Error(`timezone ${timezoneRes.status}`);
    if (!reverseRes.ok) throw new Error(`nominatim ${reverseRes.status}`);

    const timezoneJson = await timezoneRes.json<any>();
    const reverseJson = await reverseRes.json<any>();

    const timezone = timezoneJson.timezone ?? timezoneJson.timezone_abbreviation ?? 'UTC';
    const isoDate = new Date(time).toISOString();
    const localTime = formatLocalTime(isoDate, timezone);

    const countryCode = reverseJson.address?.country_code?.toUpperCase();
    let holidayInfo: { isHoliday: boolean; name?: string } = { isHoliday: false };
    if (countryCode) {
      const year = new Date(time).getUTCFullYear();
      const holidaysRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (holidaysRes.ok) {
        const holidays = await holidaysRes.json<any[]>();
        const targetDate = isoDate.slice(0, 10);
        const match = holidays.find((entry) => entry.date === targetDate);
        if (match) {
          holidayInfo = { isHoliday: true, name: match.localName ?? match.name };
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          timezone,
          localTime,
          isHoliday: holidayInfo.isHoliday,
          holidayName: holidayInfo.name,
          regionCode: countryCode
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
