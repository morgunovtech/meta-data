import { describe, it, expect } from 'vitest';
import { computeMetadataCompleteness } from '../metadataScore';

describe('computeMetadataCompleteness', () => {
  it('returns 0 for empty metadata', () => {
    expect(computeMetadataCompleteness({})).toBe(0);
  });

  it('counts GPS with lat=0 lon=0 as present', () => {
    const result = computeMetadataCompleteness({ gps: { lat: 0, lon: 0 } });
    expect(result).toBeGreaterThan(0);
  });

  it('does not count GPS with null lat/lon', () => {
    const result = computeMetadataCompleteness({ gps: undefined });
    expect(result).toBe(0);
  });

  it('returns 1 when all fields are filled', () => {
    const result = computeMetadataCompleteness({
      shotDate: '2024-01-01T12:00:00Z',
      cameraMake: 'Apple',
      cameraModel: 'iPhone',
      lensModel: '4mm',
      exposureTime: '1/60',
      aperture: 2.8,
      iso: 100,
      focalLength: 4,
      gps: { lat: 41.0, lon: 29.0 }
    });
    expect(result).toBe(1);
  });

  it('returns correct fraction for partial metadata', () => {
    const result = computeMetadataCompleteness({
      shotDate: '2024-01-01',
      cameraMake: 'Canon'
    });
    expect(result).toBeCloseTo(2 / 9);
  });
});
