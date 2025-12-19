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

