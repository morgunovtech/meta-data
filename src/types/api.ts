export type ApiResponse<T> = {
  ok: true;
  data: T;
  meta?: { durationMs: number };
} | {
  ok: false;
  error: string;
  meta?: { durationMs: number };
};

export type ReverseGeocodeResult = {
  address: string;
  country?: string;
  isoCode?: string;
  precisionMeters?: number;
};

export type TimezoneHolidayResult = {
  timezone: string;
  localTime: string;
  isHoliday: boolean;
  holidayName?: string;
  regionCode?: string;
};

export type WeatherResult = {
  temperatureC: number;
  precipitationMm: number;
  cloudCoverPercent: number;
  windSpeedKmh: number;
  pressureHpa: number;
};

export type PoiResult = {
  name: string;
  category: string;
  distanceMeters: number;
};

export type SurveillanceResult = PoiResult;
