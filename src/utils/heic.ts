import exifr from 'exifr';

type RawMetadata = {
  exifData: Record<string, unknown> | undefined;
  xmpData: Record<string, unknown> | undefined;
  iptcData: Record<string, unknown> | undefined;
  iccData: Record<string, unknown> | undefined;
  gpsRaw: Record<string, unknown> | undefined;
};

/**
 * Extract EXIF TIFF blob from HEIC/HEIF ISO BMFF container.
 * HEIC stores EXIF data as 'Exif\x00\x00' + TIFF stream inside a metadata item.
 * exifr cannot parse HEIC containers directly, so we extract the TIFF blob first.
 */
async function extractExifFromHeic(file: File): Promise<ArrayBuffer | null> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Search for 'Exif\x00\x00' followed by TIFF header ('II' or 'MM')
    for (let i = 0; i < bytes.length - 8; i++) {
      if (
        bytes[i] === 0x45 && bytes[i + 1] === 0x78 && // Ex
        bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66 && // if
        bytes[i + 4] === 0x00 && bytes[i + 5] === 0x00    // \0\0
      ) {
        // Check next 2 bytes for TIFF byte order mark
        const b0 = bytes[i + 6];
        const b1 = bytes[i + 7];
        if ((b0 === 0x49 && b1 === 0x49) || (b0 === 0x4D && b1 === 0x4D)) {
          // Found TIFF header — extract a generous chunk (64KB should cover any EXIF)
          const tiffStart = i + 6;
          const tiffEnd = Math.min(tiffStart + 65536, bytes.length);
          return buffer.slice(tiffStart, tiffEnd);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

const HEIC_MIME_PREFIXES = ['image/heic', 'image/heif'];

function isHeicFile(file: File): boolean {
  if (HEIC_MIME_PREFIXES.some(m => file.type.toLowerCase().startsWith(m))) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

export async function extractMetadataFromOriginal(file: File): Promise<RawMetadata> {
  // For HEIC files: extract EXIF TIFF blob from the ISO BMFF container,
  // then parse that blob with exifr (which doesn't support HEIC natively).
  let parseSource: File | ArrayBuffer = file;
  if (isHeicFile(file)) {
    const exifBlob = await extractExifFromHeic(file);
    if (exifBlob) {
      parseSource = exifBlob;
    }
    // If no EXIF found in HEIC, fall through to try parsing the file directly
    // (will likely return empty, but no harm)
  }

  const parsed = await safeExtract(() =>
    exifr.parse(parseSource, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      icc: true,
      translateKeys: true,
      translateValues: false,
    })
  ) as Record<string, unknown> | undefined;

  const gpsRaw = await safeExtract(() => (exifr as any).gps(parseSource));

  const base = parsed ?? {};

  // exifr returns all segments merged into one flat object when parsed together.
  // Split them back into logical groups for the rest of the pipeline.
  const GPS_KEYS = new Set(['latitude', 'longitude', 'altitude', 'latitudeRef', 'longitudeRef',
    'altitudeRef', 'speed', 'speedRef', 'heading', 'headingRef', 'accuracy',
    'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSLatitudeRef', 'GPSLongitudeRef',
    'GPSAltitudeRef', 'GPSSpeed', 'GPSSpeedRef', 'GPSImgDirection', 'GPSImgDirectionRef',
    'lat', 'lon', 'gpsHPositioningError', 'GPSDOP']);
  const XMP_KEYS = new Set(['Rating', 'Label', 'Subject', 'Description', 'Title',
    'Creator', 'Rights', 'CreatorTool', 'CreateDate', 'ModifyDate', 'MetadataDate',
    'xmp', 'dc', 'photoshop', 'xmpMM', 'crs']);
  const IPTC_KEYS = new Set(['ObjectName', 'Caption', 'Keywords', 'Byline', 'BylineTitle',
    'Credit', 'Source', 'CopyrightNotice', 'City', 'Province', 'Country',
    'CountryCode', 'Category', 'SupplementalCategories', 'Headline', 'SpecialInstructions']);
  const ICC_KEYS = new Set(['ProfileDescription', 'ColorSpaceData', 'ProfileConnectionSpace',
    'ProfileClass', 'RenderingIntent', 'MediaWhitePoint', 'MediaBlackPoint',
    'RedColorant', 'GreenColorant', 'BlueColorant']);

  const exifData: Record<string, unknown> = {};
  const xmpData: Record<string, unknown> = {};
  const iptcData: Record<string, unknown> = {};
  const iccData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(base)) {
    if (ICC_KEYS.has(key)) { iccData[key] = value; }
    else if (IPTC_KEYS.has(key)) { iptcData[key] = value; }
    else if (XMP_KEYS.has(key)) { xmpData[key] = value; }
    else { exifData[key] = value; }
  }

  return {
    exifData,
    xmpData,
    iptcData,
    iccData,
    gpsRaw: (gpsRaw ?? {}) as Record<string, unknown>,
  };
}

type HeicDecodeResult = {
  file: File;
  width: number;
  height: number;
};

const HEIC_MAX_SIDE = 2200;

function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image-load'));
    };
    image.src = url;
  });
}

/**
 * Try native browser HEIC decoding via createImageBitmap.
 * Works on Safari 17+, macOS Chrome (with system HEIC codec).
 */
async function tryNativeBitmapDecode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width < 2 || bitmap.height < 2) {
      bitmap.close();
      return null;
    }
    return bitmap;
  } catch {
    return null;
  }
}

/**
 * Try decoding HEIC via <img> tag with object URL.
 * macOS browsers can often decode HEIC through system codecs
 * even when createImageBitmap doesn't support it.
 */
async function tryImgTagDecode(file: File): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    const loaded = await Promise.race([
      new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
    ]);
    if (!loaded || img.naturalWidth < 2 || img.naturalHeight < 2) {
      URL.revokeObjectURL(url);
      return null;
    }
    // Don't revoke URL yet — caller needs it for canvas drawing
    return img;
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

export async function decodeHeicToJpegForPreview(sourceFile: File): Promise<HeicDecodeResult> {
  let image: { width: number; height: number; source: CanvasImageSource; cleanup?: () => void };

  // Strategy 1: createImageBitmap (Safari 17+, some macOS Chrome)
  const nativeBitmap = await tryNativeBitmapDecode(sourceFile);
  if (nativeBitmap) {
    image = {
      width: nativeBitmap.width,
      height: nativeBitmap.height,
      source: nativeBitmap,
      cleanup: () => nativeBitmap.close(),
    };
  } else {
    // Strategy 2: <img> tag with system codec (macOS)
    const nativeImg = await tryImgTagDecode(sourceFile);
    if (nativeImg) {
      const imgSrc = nativeImg.src; // object URL to revoke after canvas draw
      image = {
        width: nativeImg.naturalWidth,
        height: nativeImg.naturalHeight,
        source: nativeImg,
        cleanup: () => { if (imgSrc.startsWith('blob:')) URL.revokeObjectURL(imgSrc); },
      };
    } else {
      // Strategy 3: libheif-js WASM decoder (supports all HEIC variants)
      const libheifModule = await import('libheif-js');
      const libheif = (libheifModule as any).default ?? libheifModule;
      const decoder = new libheif.HeifDecoder();
      const buffer = await sourceFile.arrayBuffer();
      const data = new Uint8Array(buffer);
      const images = decoder.decode(data);

      if (!images || images.length === 0) {
        throw new Error('heic-convert: libheif could not decode image');
      }

      const heifImage = images[0];
      const w = heifImage.get_width();
      const h = heifImage.get_height();

      // Render HEIC to canvas via display() callback
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');

      const imageData = ctx.createImageData(w, h);
      await new Promise<void>((resolve, reject) => {
        heifImage.display(imageData, (result: ImageData | null) => {
          if (!result) {
            reject(new Error('heic-convert: libheif display failed'));
            return;
          }
          ctx.putImageData(result, 0, 0);
          resolve();
        });
      });

      image = { width: w, height: h, source: canvas };
    }
  }

  const maxSide = Math.max(image.width, image.height);
  const scale = Math.min(1, HEIC_MAX_SIDE / Math.max(1, maxSide));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    image.cleanup?.();
    throw new Error('canvas');
  }
  ctx.drawImage(image.source, 0, 0, targetWidth, targetHeight);
  image.cleanup?.();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('jpeg-encode'));
        return;
      }
      resolve(result);
    }, 'image/jpeg', 0.92);
  });

  const safeName = sourceFile.name.replace(/\.(heic|heif)$/i, '') || 'photo';
  const file = new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' });

  return {
    file,
    width: image.width,
    height: image.height
  };
}

async function safeExtract<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    console.warn('metadata-optional-extract', error);
    return undefined;
  }
}
