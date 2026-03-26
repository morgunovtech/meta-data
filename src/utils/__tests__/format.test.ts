import { describe, it, expect } from 'vitest';
import { formatBytes, formatBytesPrecise, formatMegapixels } from '../format';

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });
});

describe('formatBytesPrecise', () => {
  it('formats with precision', () => {
    const result = formatBytesPrecise(1536);
    expect(result).toContain('KB');
  });
});

describe('formatMegapixels', () => {
  it('calculates megapixels', () => {
    const result = formatMegapixels(4000, 3000);
    expect(result).toBe('12.00');
  });

  it('handles small images', () => {
    const result = formatMegapixels(100, 100);
    expect(result).toBe('0.01');
  });
});
