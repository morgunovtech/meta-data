type Lang = 'ru' | 'en' | 'uz';

export type Severity = 'low' | 'medium' | 'high';

export interface TemporalInsight {
  fact: string;
  inference: string;
  severity: Severity;
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function analyzeDateTime(dateTimeOriginal: string | undefined, lang: Lang): TemporalInsight[] {
  if (!dateTimeOriginal) return [];

  const dt = new Date(dateTimeOriginal);
  if (isNaN(dt.getTime())) return [];

  const hour = dt.getHours();
  const dayOfWeek = dt.getDay();
  const insights: TemporalInsight[] = [];

  // Time of day
  if (hour >= 0 && hour < 5) {
    insights.push({
      fact: lang === 'ru' ? `Ночное фото (${hour}:00)` : lang === 'uz' ? `Tungi foto (${hour}:00)` : `Night photo (${hour}:00)`,
      inference: lang === 'ru' ? 'Вы бодрствовали глубокой ночью' : lang === 'uz' ? 'Siz tunda uyg\'oq edingiz' : 'You were awake late at night',
      severity: 'medium',
    });
  } else if (hour >= 5 && hour < 7) {
    insights.push({
      fact: lang === 'ru' ? `Раннее утро (${hour}:00)` : lang === 'uz' ? `Erta tong (${hour}:00)` : `Early morning (${hour}:00)`,
      inference: lang === 'ru' ? 'Ранний подъём — привычка, спорт, или перелёт' : lang === 'uz' ? 'Erta turish — odat, sport yoki parvoz' : 'Early rise — habit, sports, or travel',
      severity: 'low',
    });
  } else if (hour >= 12 && hour < 14) {
    insights.push({
      fact: lang === 'ru' ? 'Обеденное время' : lang === 'uz' ? 'Tushlik vaqti' : 'Lunchtime',
      inference: lang === 'ru' ? 'Вероятно, обеденный перерыв' : lang === 'uz' ? 'Ehtimol tushlik tanaffusi' : 'Probably a lunch break',
      severity: 'low',
    });
  }

  // Day of week + work hours
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    insights.push({
      fact: lang === 'ru' ? 'Выходной день' : lang === 'uz' ? 'Dam olish kuni' : 'Weekend',
      inference: lang === 'ru' ? 'Личное время — отдых, семья, хобби' : lang === 'uz' ? 'Shaxsiy vaqt — dam olish, oila' : 'Personal time — rest, family, hobbies',
      severity: 'low',
    });
  } else if (hour >= 9 && hour <= 18) {
    insights.push({
      fact: lang === 'ru' ? 'Будний день, рабочие часы' : lang === 'uz' ? 'Ish kuni, ish soatlari' : 'Weekday, working hours',
      inference: lang === 'ru' ? 'Вы фотографировали в рабочее время' : lang === 'uz' ? 'Siz ish vaqtida suratga oldingiz' : 'You took a photo during working hours',
      severity: 'medium',
    });
  }

  // Photo age
  const ageMs = Date.now() - dt.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageYears = Math.floor(ageDays / 365);
  const ageMonths = Math.floor(ageDays / 30);

  if (ageDays < 0) {
    // Future date — likely wrong clock
    insights.push({
      fact: lang === 'ru' ? 'Дата в будущем' : lang === 'uz' ? 'Kelajakdagi sana' : 'Future date',
      inference: lang === 'ru' ? 'Часы на устройстве были настроены неправильно' : lang === 'uz' ? 'Qurilma soati noto\'g\'ri sozlangan' : 'Device clock was set incorrectly',
      severity: 'low',
    });
  } else if (ageDays <= 1) {
    insights.push({
      fact: lang === 'ru' ? 'Фото сделано сегодня или вчера' : lang === 'uz' ? 'Foto bugun yoki kecha olingan' : 'Photo taken today or yesterday',
      inference: lang === 'ru' ? 'Свежее фото — геолокация актуальна' : lang === 'uz' ? 'Yangi foto — geolokatsiya dolzarb' : 'Fresh photo — geolocation is current',
      severity: 'high',
    });
  } else if (ageYears > 0) {
    const ageStr = lang === 'ru'
      ? pluralRu(ageYears, 'год', 'года', 'лет')
      : `${ageYears} year${ageYears > 1 ? 's' : ''}`;
    insights.push({
      fact: lang === 'ru' ? `Фото сделано ~${ageStr} назад` : lang === 'uz' ? `Foto ~${ageYears} yil oldin olingan` : `Photo taken ~${ageStr} ago`,
      inference: lang === 'ru' ? 'Старое фото — но метаданные всё ещё содержат информацию' : lang === 'uz' ? 'Eski foto — lekin metadata hali ham ma\'lumot saqlaydi' : 'Old photo — but metadata still contains information',
      severity: 'medium',
    });
  } else if (ageMonths > 1) {
    insights.push({
      fact: lang === 'ru' ? `Фото сделано ~${ageMonths} мес. назад` : lang === 'uz' ? `Foto ~${ageMonths} oy oldin olingan` : `Photo taken ~${ageMonths} months ago`,
      inference: '',
      severity: 'low',
    });
  }

  return insights;
}
