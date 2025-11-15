export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ReverseGeocodeResult {
  address: string;
  country: string;
  countryCode?: string;
  city?: string;
  state?: string;
  district?: string;
  road?: string;
  houseNumber?: string;
  precisionMeters?: number;
  lat: number;
  lon: number;
}

export interface TimezoneHolidayResult {
  timezone: string;
  localTimeIso: string;
  holiday?: {
    name: string;
    countryCode: string;
  };
}

export interface HistoricalWeatherResult {
  temperature: number;
  precipitation: number;
  cloudCover: number;
  windSpeed: number;
  pressure: number;
}

export interface PoiResult {
  name: string;
  category: string;
  distance: number;
}

export interface ImageUniquenessMatch {
  label: string;
  similarity: number;
}

export interface ImageUniquenessResult {
  score: number;
  matches: ImageUniquenessMatch[];
}
