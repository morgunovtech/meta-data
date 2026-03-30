import exifr from 'exifr';

type RawMetadata = {
  exifData: Record<string, unknown> | undefined;
  xmpData: Record<string, unknown> | undefined;
  iptcData: Record<string, unknown> | undefined;
  iccData: Record<string, unknown> | undefined;
  gpsRaw: Record<string, unknown> | undefined;
};

export async function extractMetadataFromOriginal(file: File): Promise<RawMetadata> {
  // Parse all segments in one pass — avoids the separate exifr.xmp/iptc/icc
  // calls which have broken types in exifr v7 and silently fail on some files.
  const parsed = await safeExtract(() =>
    exifr.parse(file, {
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

  const gpsRaw = await safeExtract(() => (exifr as any).gps(file));

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
      image = {
        width: nativeImg.naturalWidth,
        height: nativeImg.naturalHeight,
        source: nativeImg,
      };
    } else {
      // Strategy 3: heic2any JS library (universal fallback)
      const mod = await import('heic2any');
      const heic2any = (typeof mod === 'function' ? mod : (mod as any).default) as (options: {
        blob: Blob;
        toType?: string;
        quality?: number;
      }) => Promise<Blob | Blob[]>;

      if (typeof heic2any !== 'function') {
        throw new Error('heic2any module failed to load');
      }

      let jpegBlob: Blob;
      try {
        const converted = await heic2any({ blob: sourceFile, toType: 'image/jpeg', quality: 0.92 });
        jpegBlob = Array.isArray(converted) ? converted[0] : converted;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'heic-convert';
        throw new Error(`heic-convert:${reason}`);
      }

      const imgEl = await createImageFromBlob(jpegBlob);
      image = { width: imgEl.naturalWidth, height: imgEl.naturalHeight, source: imgEl };
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
