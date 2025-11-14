export async function stripMetadata(file: File): Promise<Blob> {
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const segments: number[] = [];

    let offset = 2; // skip SOI
    segments.push(0xff);
    segments.push(0xd8);

    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if (marker === 0xda) {
        segments.push(bytes[offset]);
        segments.push(bytes[offset + 1]);
        segments.push(...bytes.slice(offset + 2));
        break;
      }
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      const end = offset + 2 + length;
      const remove = marker >= 0xe1 && marker <= 0xef;
      if (!remove) {
        segments.push(bytes[offset]);
        segments.push(bytes[offset + 1]);
        segments.push(bytes[offset + 2]);
        segments.push(bytes[offset + 3]);
        segments.push(...bytes.slice(offset + 4, end));
      }
      offset = end;
    }

    return new Blob([new Uint8Array(segments)], { type: file.type });
  }

  if (file.type === 'image/png') {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const out: number[] = [];
    out.push(...bytes.slice(0, 8));
    let offset = 8;
    while (offset < bytes.length) {
      const length =
        (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      const crcEnd = dataEnd + 4;
      if (!['tEXt', 'iTXt', 'zTXt', 'iCCP'].includes(type)) {
        out.push(...bytes.slice(offset, crcEnd));
      }
      offset = crcEnd;
    }
    return new Blob([new Uint8Array(out)], { type: file.type });
  }

  // fallback: re-encode through canvas
  const imageBitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(imageBitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: file.type });
  return blob;
}

export async function blurFaces(
  file: File,
  boxes: { x: number; y: number; width: number; height: number }[],
  quality = 0.92
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0);
  boxes.forEach((box) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
    ctx.filter = 'blur(20px)';
    ctx.drawImage(bitmap, 0, 0);
    ctx.restore();
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('toBlob failed'));
        return;
      }
      resolve(blob);
    }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
  });
}
