export type ApiResponse<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
};

export type ReverseGeocodeResult = {
  address: string;
  country?: string;
  countryCode?: string;
  precision?: number;
};

export type TimezoneHolidayResult = {
  timezone?: string;
  localTime?: string;
  isHoliday?: boolean;
  holidayName?: string;
  regionCode?: string;
};

export type WeatherSample = {
  temperatureC?: number;
  precipitationMm?: number;
  cloudCover?: number;
  windSpeedKmh?: number;
  pressureHpa?: number;
};

export type PoiResult = {
  name?: string;
  type?: string;
  distance: number;
};

export type SurveillanceResult = PoiResult;
