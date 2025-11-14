declare module 'exifr' {
  export function parse(file: Blob, options?: Record<string, unknown>): Promise<Record<string, unknown> & {
    exif?: Record<string, unknown>;
    xmp?: Record<string, unknown>;
    iptc?: Record<string, unknown>;
    icc?: Record<string, unknown>;
  }>;
}
