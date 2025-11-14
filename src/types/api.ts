export interface ReverseGeocodeResult {
  address: string;
  country: string;
  countryCode: string;
  precisionMeters?: number;
}

export interface TimezoneHolidayResult {
  timezone: string;
  localTime: string;
  holiday?: {
    name: string;
    region: string;
  } | null;
}

export interface HistoricalWeatherResult {
  temperatureC: number;
  precipitationMm: number;
  cloudCoverPercent: number;
  windSpeedKmh: number;
  pressureHpa: number;
}

export interface PoiItem {
  name: string;
  category: string;
  distanceMeters: number;
}

export interface SurveillanceItem {
  type: string;
  distanceMeters: number;
}

export interface ProxyResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
