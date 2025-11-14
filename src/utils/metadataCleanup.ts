import { ManualMaskRegion } from '../types/cleanup';

function generateRandomToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().split('-')[0];
  }
  const array = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(array);
    return array[0].toString(36);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function ensureRenameToken(current: string | null): string {
  return current ?? generateRandomToken();
}

function shouldDropJpegMarker(marker: number): boolean {
  if (marker >= 0xe1 && marker <= 0xef) {
    return true; // APP1..APP15 except APP0/APP1; drop to strip EXIF/XMP/ICC/other textual
  }
  if (marker === 0xfe) {
    return true; // COM
  }
  if (marker === 0xe0) {
    return false; // keep JFIF
  }
  return false;
}

function stripJpegMetadata(buffer: ArrayBuffer): Uint8Array {
  const view = new DataView(buffer);
  const length = buffer.byteLength;
  const output: number[] = [];
  // ensure JPEG header
  if (view.getUint16(0) !== 0xffd8) {
    return new Uint8Array(buffer);
  }
  output.push(0xff, 0xd8);
  let offset = 2;
  while (offset + 4 < length) {
    if (view.getUint8(offset) !== 0xff) {
      break;
    }
    const marker = view.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xda) {
      const segmentStart = offset - 2;
      for (let i = segmentStart; i < length; i += 1) {
        output.push(view.getUint8(i));
      }
      return new Uint8Array(output);
    }
    const size = view.getUint16(offset);
    const segmentStart = offset - 2;
    const segmentEnd = offset + size;
    if (!shouldDropJpegMarker(marker)) {
      for (let i = segmentStart; i < segmentEnd; i += 1) {
        output.push(view.getUint8(i));
      }
    }
    offset = segmentEnd;
  }
  return new Uint8Array(output);
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_METADATA_CHUNKS = new Set(['tEXt', 'iTXt', 'zTXt', 'iCCP', 'eXIf']);

function stripPngMetadata(buffer: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return bytes;
    }
  }
  const result: number[] = [...PNG_SIGNATURE];
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length =
      (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const totalLength = 12 + length;
    const chunkEnd = offset + totalLength;
    const shouldDrop = PNG_METADATA_CHUNKS.has(type);
    if (!shouldDrop) {
      for (let i = offset; i < chunkEnd; i += 1) {
        result.push(bytes[i]);
      }
    }
    offset = chunkEnd;
    if (type === 'IEND') {
      break;
    }
  }
  return new Uint8Array(result);
}

const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'ICCP', 'XMP ']);

function stripWebpMetadata(buffer: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) {
    return bytes;
  }
  // copy RIFF header
  const result: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    result.push(bytes[i]);
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkTotal = 8 + paddedSize;
    if (!WEBP_METADATA_CHUNKS.has(chunkType)) {
      for (let i = 0; i < chunkTotal && offset + i < bytes.length; i += 1) {
        result.push(bytes[offset + i]);
      }
    }
    offset += chunkTotal;
  }
  const output = new Uint8Array(result);
  // Update RIFF size (bytes length - 8)
  if (output.length >= 8) {
    const size = output.length - 8;
    output[4] = size & 0xff;
    output[5] = (size >> 8) & 0xff;
    output[6] = (size >> 16) & 0xff;
    output[7] = (size >> 24) & 0xff;
  }
  return output;
}

export async function stripMetadataBlob(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  let cleaned: Uint8Array;
  if (file.type === 'image/jpeg') {
    cleaned = stripJpegMetadata(buffer);
  } else if (file.type === 'image/png') {
    cleaned = stripPngMetadata(buffer);
  } else if (file.type === 'image/webp') {
    cleaned = stripWebpMetadata(buffer);
  } else {
    cleaned = new Uint8Array(buffer);
  }
  return new Blob([cleaned], { type: file.type || 'application/octet-stream' });
}

export function normalizeManualMask(mask: ManualMaskRegion): ManualMaskRegion {
  const x = Math.min(Math.max(mask.x, 0), 1);
  const y = Math.min(Math.max(mask.y, 0), 1);
  const width = Math.min(Math.max(mask.width, 0), 1 - x);
  const height = Math.min(Math.max(mask.height, 0), 1 - y);
  return { ...mask, x, y, width, height };
}
