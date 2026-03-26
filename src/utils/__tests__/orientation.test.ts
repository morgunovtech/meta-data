import { describe, it, expect } from 'vitest';
import { inferOrientation } from '../orientation';

describe('inferOrientation', () => {
  it('detects landscape', () => {
    expect(inferOrientation(1920, 1080)).toBe('landscape');
  });

  it('detects portrait', () => {
    expect(inferOrientation(1080, 1920)).toBe('portrait');
  });

  it('detects square', () => {
    expect(inferOrientation(1000, 1000)).toBe('square');
  });

  it('swaps dimensions for EXIF orientation 6', () => {
    // 1080x1920 with tag 6 → swaps to 1920x1080 → landscape
    expect(inferOrientation(1080, 1920, 6)).toBe('landscape');
  });

  it('swaps dimensions for EXIF orientation 8', () => {
    expect(inferOrientation(1080, 1920, 8)).toBe('landscape');
  });

  it('swaps dimensions for EXIF orientation 5', () => {
    expect(inferOrientation(1080, 1920, 5)).toBe('landscape');
  });

  it('swaps dimensions for EXIF orientation 7', () => {
    expect(inferOrientation(1080, 1920, 7)).toBe('landscape');
  });

  it('handles string orientation tag with "90"', () => {
    expect(inferOrientation(1080, 1920, 'Rotate 90 CW')).toBe('landscape');
  });
});
