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

export async function decodeHeicToJpegForPreview(sourceFile: File): Promise<HeicDecodeResult> {
  // heic2any is a UMD module — dynamic import wraps it as { default: fn }
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

  const image = await createImageFromBlob(jpegBlob);
  const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, HEIC_MAX_SIDE / Math.max(1, maxSide));
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas');
  }
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

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
    width: image.naturalWidth,
    height: image.naturalHeight
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
