import type { HistoricalWeatherResult, PoiResult, ReverseGeocodeResult, TimezoneHolidayResult } from '../types/api';
import type { StructuredMetadata } from '../types/metadata';
import type { MessageKey } from '../i18n';

type CameraPosition = 'front' | 'rear' | 'unknown';

export interface MovementInsight {
  moving: boolean;
  speedKmh?: number;
}

export function extractSoftware(metadata: StructuredMetadata | null): string | undefined {
  if (!metadata) return undefined;
  const candidates: unknown[] = [
    metadata.groups.exif?.Software,
    metadata.groups.exif?.software,
    metadata.groups.xmp?.Software,
    metadata.groups.xmp?.CreatorTool,
    metadata.groups.xmp?.creatorTool
  ];

  for (const candidate of candidates) {
    const value = toCleanString(candidate);
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function inferCameraPosition(metadata: StructuredMetadata | null): CameraPosition {
  if (!metadata) return 'unknown';
  const descriptors: string[] = [];
  const push = (value: unknown) => {
    const clean = toCleanString(value);
    if (clean) descriptors.push(clean.toLowerCase());
  };

  push(metadata.lensModel);
  push(metadata.groups.exif?.LensModel);
  push(metadata.groups.exif?.lensModel);
  push(metadata.groups.exif?.LensSpecification);
  push(metadata.groups.exif?.lensSpecification);

  if (descriptors.some((entry) => /front|truedepth|selfie|face.?time/.test(entry))) {
    return 'front';
  }
  if (descriptors.some((entry) => /rear|back|wide|tele|main|ultra/.test(entry))) {
    return 'rear';
  }
  return 'unknown';
}

export function inferMovement(metadata: StructuredMetadata | null): MovementInsight | null {
  if (!metadata) return null;
  const exif = metadata.groups.exif ?? {};
  const speedCandidates: unknown[] = [
    (exif as Record<string, unknown>).GPSSpeed,
    (exif as Record<string, unknown>).gpsSpeed,
    (exif as Record<string, unknown>).Speed,
    (exif as Record<string, unknown>).GPSSpeedRaw,
    (exif as Record<string, unknown>).speed
  ];

  let speed = speedCandidates
    .map((candidate) => toNumber(candidate))
    .find((value): value is number => value != null);

  if (speed == null) {
    return null;
  }

  const ref = toCleanString((exif as Record<string, unknown>).GPSSpeedRef ?? (exif as Record<string, unknown>).gpsSpeedRef);
  if (ref) {
    const normalized = ref.toUpperCase();
    if (normalized === 'M') {
      speed *= 1.60934;
    } else if (normalized === 'N') {
      speed *= 1.852;
    }
  }

  // Some devices record speed in meters/second without a ref tag.
  if (!ref && speed < 20) {
    // Assume m/s → km/h.
    speed *= 3.6;
  }

  if (!Number.isFinite(speed)) {
    return null;
  }

  return { moving: speed >= 3, speedKmh: speed };
}

const POI_CATEGORY_MAP: Record<string, MessageKey> = {
  bank: 'poiCategoryBank',
  atm: 'poiCategoryAtm',
  fuel: 'poiCategoryFuel',
  cafe: 'poiCategoryCafe',
  restaurant: 'poiCategoryRestaurant',
  fast_food: 'poiCategoryFastFood',
  bar: 'poiCategoryBar',
  pub: 'poiCategoryPub',
  supermarket: 'poiCategorySupermarket',
  mall: 'poiCategoryMall',
  convenience: 'poiCategoryConvenience',
  shop: 'poiCategoryShop',
  pharmacy: 'poiCategoryPharmacy',
  hospital: 'poiCategoryHospital',
  clinic: 'poiCategoryClinic',
  doctors: 'poiCategoryClinic',
  school: 'poiCategorySchool',
  university: 'poiCategoryUniversity',
  college: 'poiCategoryCollege',
  kindergarten: 'poiCategoryKindergarten',
  library: 'poiCategoryLibrary',
  museum: 'poiCategoryMuseum',
  theatre: 'poiCategoryTheatre',
  cinema: 'poiCategoryCinema',
  hotel: 'poiCategoryHotel',
  motel: 'poiCategoryMotel',
  guest_house: 'poiCategoryGuestHouse',
  hostel: 'poiCategoryGuestHouse',
  marketplace: 'poiCategoryMarket',
  park: 'poiCategoryPark',
  playground: 'poiCategoryPlayground',
  parking: 'poiCategoryParking',
  bus_station: 'poiCategoryTransport',
  taxi: 'poiCategoryTransport',
  charging_station: 'poiCategoryCharging',
  police: 'poiCategoryPolice',
  courthouse: 'poiCategoryCourthouse',
  townhall: 'poiCategoryGovernment',
  government: 'poiCategoryGovernment',
  post_office: 'poiCategoryPost',
  community_centre: 'poiCategoryCommunity',
  embassy: 'poiCategoryGovernment',
  place_of_worship: 'poiCategoryWorship'
};

const SURVEILLANCE_CATEGORY_MAP: Record<string, MessageKey> = {
  surveillance: 'surveillanceCategoryCamera',
  atm: 'surveillanceCategoryAtm',
  bank: 'surveillanceCategoryBank',
  fuel: 'surveillanceCategoryFuel',
  shop: 'surveillanceCategoryStore',
  supermarket: 'surveillanceCategoryStore',
  mall: 'surveillanceCategoryStore',
  police: 'surveillanceCategoryPublic',
  post_office: 'surveillanceCategoryPublic',
  parking: 'surveillanceCategoryTransport',
  bus_station: 'surveillanceCategoryTransport',
  railway_station: 'surveillanceCategoryTransport',
  transport: 'surveillanceCategoryTransport'
};

export function resolvePoiCategoryKey(category: string): MessageKey {
  const normalized = category?.toLowerCase() ?? '';
  return POI_CATEGORY_MAP[normalized] ?? 'poiCategoryGeneric';
}

export function resolveSurveillanceCategoryKey(category: string): MessageKey {
  const normalized = category?.toLowerCase() ?? '';
  return SURVEILLANCE_CATEGORY_MAP[normalized] ?? 'surveillanceCategoryGeneric';
}

export function resolveLocalTime(
  metadata: StructuredMetadata | null,
  timezone: TimezoneHolidayResult | null
): { iso?: string; timezone?: string; holidayName?: string; holidayCode?: string } {
  if (timezone?.localTimeIso) {
    return {
      iso: timezone.localTimeIso,
      timezone: timezone.timezone,
      holidayName: timezone.holiday?.name,
      holidayCode: timezone.holiday?.countryCode
    };
  }
  if (metadata?.shotDate) {
    return { iso: metadata.shotDate, timezone: undefined };
  }
  return {};
}

export function describeDayPeriod(date: Date): 'night' | 'morning' | 'day' | 'evening' {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

export function summarizeWeather(weather: HistoricalWeatherResult | null | undefined) {
  if (!weather) return null;
  return {
    temperature: weather.temperature,
    precipitation: weather.precipitation,
    cloudCover: weather.cloudCover,
    windSpeed: weather.windSpeed,
    pressure: weather.pressure
  };
}

export function hasReverseData(reverse: ReverseGeocodeResult | null | undefined): reverse is ReverseGeocodeResult {
  return Boolean(reverse && reverse.address);
}

function toCleanString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (Array.isArray(value)) {
    const numbers = value
      .map((entry) => toNumber(entry))
      .filter((entry): entry is number => entry != null);
    if (numbers.length === 0) {
      return undefined;
    }
    return numbers.reduce((acc, item) => acc + item, 0) / numbers.length;
  }
  if (typeof value === 'object') {
    const maybe = value as { numerator?: number; denominator?: number };
    if (
      typeof maybe.numerator === 'number' &&
      typeof maybe.denominator === 'number' &&
      maybe.denominator !== 0
    ) {
      return maybe.numerator / maybe.denominator;
    }
  }
  return undefined;
}
