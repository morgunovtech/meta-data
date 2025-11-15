import { createSeededRandom } from './random';

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function stripJpegMetadata(data: Uint8Array): Uint8Array {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return data;
  }
  const segments: number[] = [0xff, 0xd8];
  let offset = 2;
  while (offset + 1 < data.length) {
    if (data[offset] !== 0xff) {
      // corrupted marker, copy remainder
      segments.push(...data.slice(offset));
      break;
    }
    const marker = data[offset + 1];
    offset += 2;
    if (marker === 0xd9) {
      segments.push(0xff, 0xd9);
      break;
    }
    if (marker === 0xda) {
      // start of scan - copy rest untouched
      if (offset + 1 >= data.length) {
        break;
      }
      const length = (data[offset] << 8) | data[offset + 1];
      segments.push(0xff, 0xda, data[offset], data[offset + 1]);
      offset += 2;
      if (length > 2) {
        segments.push(...data.slice(offset, offset + length - 2));
        offset += length - 2;
      }
      segments.push(...data.slice(offset));
      break;
    }
    if (offset + 1 >= data.length) {
      break;
    }
    const length = (data[offset] << 8) | data[offset + 1];
    if (length < 2 || offset + length > data.length) {
      break;
    }
    const isMetadataSegment =
      (marker >= 0xe1 && marker <= 0xef) || // APP1..APP15 (leave APP0/JFIF)
      marker === 0xfe; // COM
    if (!isMetadataSegment) {
      segments.push(0xff, marker, data[offset], data[offset + 1]);
      if (length > 2) {
        segments.push(...data.slice(offset + 2, offset + length));
      }
    }
    offset += length;
  }
  return new Uint8Array(segments);
}

function stripPngMetadata(data: Uint8Array): Uint8Array {
  const signature = data.slice(0, 8);
  if (signature.length !== 8) {
    return data;
  }
  const chunks: Uint8Array[] = [signature];
  let offset = 8;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const dropTypes = new Set(['tEXt', 'iTXt', 'zTXt', 'iCCP', 'eXIf', 'tIME']);
  while (offset + 8 <= data.length) {
    const length = view.getUint32(offset);
    const typeBytes = data.slice(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const chunkTotal = 12 + length;
    if (offset + chunkTotal > data.length) {
      break;
    }
    if (!dropTypes.has(type)) {
      chunks.push(data.slice(offset, offset + chunkTotal));
    }
    offset += chunkTotal;
    if (type === 'IEND') {
      break;
    }
  }
  return concatUint8Arrays(chunks);
}

function stripWebpMetadata(data: Uint8Array): Uint8Array {
  if (data.length < 16) {
    return data;
  }
  const header = String.fromCharCode(...data.slice(0, 4));
  if (header !== 'RIFF') {
    return data;
  }
  const riffSizeView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const formType = String.fromCharCode(...data.slice(8, 12));
  if (formType !== 'WEBP') {
    return data;
  }
  let offset = 12;
  const keptChunks: Uint8Array[] = [];
  while (offset + 8 <= data.length) {
    const chunkFourCC = String.fromCharCode(...data.slice(offset, offset + 4));
    const chunkSize = riffSizeView.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkEnd = chunkStart + paddedSize;
    if (chunkEnd > data.length) {
      break;
    }
    const shouldDrop = chunkFourCC === 'EXIF' || chunkFourCC === 'XMP ' || chunkFourCC === 'ICCP' || chunkFourCC === 'META';
    if (!shouldDrop) {
      const chunkData = data.slice(offset, chunkStart + chunkSize);
      if (chunkFourCC === 'VP8X') {
        // clear ICC/EXIF/XMP flags (bits 4, 2, 3 -> 0 based?) 0: reserved, 1: ICC, 2: Alpha, 3: EXIF, 4: XMP, 5: Animation
        const flags = chunkData.slice(8, 9);
        if (flags.length === 1) {
          const cleared = flags[0] & ~(1 << 4) & ~(1 << 3) & ~(1 << 1);
          const updated = new Uint8Array(chunkData);
          updated[8] = cleared;
          keptChunks.push(updated);
        } else {
          keptChunks.push(chunkData);
        }
      } else {
        keptChunks.push(chunkData);
      }
    }
    offset = chunkEnd;
  }
  let totalSize = 4; // WEBP form type already counted separately
  for (const chunk of keptChunks) {
    totalSize += chunk.length;
    if (chunk.length % 2 === 1) {
      totalSize += 1; // padding byte when reserialising
    }
  }
  const output = new Uint8Array(8 + totalSize);
  output.set([82, 73, 70, 70], 0); // RIFF
  const view = new DataView(output.buffer);
  view.setUint32(4, totalSize, true);
  output.set([87, 69, 66, 80], 8); // WEBP
  let writeOffset = 12;
  keptChunks.forEach((chunk) => {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
    if (chunk.length % 2 === 1) {
      output[writeOffset] = 0; // pad byte
      writeOffset += 1;
    }
  });
  return output.slice(0, writeOffset);
}

export async function stripImageMetadata(blob: Blob, mimeType: string): Promise<Blob> {
  try {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let stripped = bytes;
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      stripped = stripJpegMetadata(bytes);
    } else if (mimeType.includes('png')) {
      stripped = stripPngMetadata(bytes);
    } else if (mimeType.includes('webp')) {
      stripped = stripWebpMetadata(bytes);
    }
    if (stripped === bytes) {
      return blob;
    }
    return new Blob([stripped], { type: mimeType });
  } catch (error) {
    console.error('strip-metadata', error);
    return blob;
  }
}

export function generateAnonFileName(extension: string, seed: number): string {
  const rng = createSeededRandom(seed);
  const token = Math.floor(rng() * 0xfffff).toString(36).padStart(4, '0');
  return `photo-${token}.${extension}`;
}
