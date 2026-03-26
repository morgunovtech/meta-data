import { describe, it, expect } from 'vitest';
import { formatCoords, formatDistance, formatWeatherLine, dedupeByNameAndDistance } from '../insightsCompact';

describe('formatCoords', () => {
  it('formats coordinates', () => {
    expect(formatCoords(41.0082, 28.9784)).toBe('41.00820, 28.97840');
  });

  it('formats zero coordinates', () => {
    expect(formatCoords(0, 0)).toBe('0.00000, 0.00000');
  });
});

describe('formatDistance', () => {
  it('returns empty for undefined', () => {
    expect(formatDistance(undefined)).toBe('');
  });

  it('formats small distances', () => {
    const result = formatDistance(50, 'en');
    expect(result).toContain('50');
  });
});

describe('formatWeatherLine', () => {
  it('returns null for null weather', () => {
    expect(formatWeatherLine(null, 'en')).toBeNull();
  });

  it('returns null when temperature is null', () => {
    expect(formatWeatherLine({ temperature: null as any, precipitation: 0, cloudCover: 50, windSpeed: 10, pressure: 1013 }, 'en')).toBeNull();
  });

  it('uses English units for en locale', () => {
    const result = formatWeatherLine({ temperature: 20, precipitation: 0, cloudCover: 50, windSpeed: 10, pressure: 1013 }, 'en');
    expect(result).toContain('km/h');
    expect(result).toContain('hPa');
  });

  it('uses Russian units for ru locale', () => {
    const result = formatWeatherLine({ temperature: 20, precipitation: 0, cloudCover: 50, windSpeed: 10, pressure: 1013 }, 'ru');
    expect(result).toContain('км/ч');
    expect(result).toContain('гПа');
  });
});

describe('dedupeByNameAndDistance', () => {
  it('removes duplicates by name and distance', () => {
    const items = [
      { name: 'Cafe A', category: 'cafe', distance: 100 },
      { name: 'Cafe A', category: 'cafe', distance: 100 },
      { name: 'Shop B', category: 'shop', distance: 200 }
    ];
    expect(dedupeByNameAndDistance(items)).toHaveLength(2);
  });

  it('keeps items with same name but different distance', () => {
    const items = [
      { name: 'Cafe A', category: 'cafe', distance: 100 },
      { name: 'Cafe A', category: 'cafe', distance: 200 }
    ];
    expect(dedupeByNameAndDistance(items)).toHaveLength(2);
  });
});
