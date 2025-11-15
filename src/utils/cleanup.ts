import type { AntiSearchParams, ManualMask } from '../types/cleanup';
import type { BoundingBox } from '../types/detection';

interface BlurRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_MASK_SIZE = 12;

function clampRect(rect: BlurRegion, maxWidth: number, maxHeight: number): BlurRegion | null {
  const x = Math.max(0, Math.min(rect.x, maxWidth));
  const y = Math.max(0, Math.min(rect.y, maxHeight));
  const width = Math.max(0, Math.min(rect.width, maxWidth - x));
  const height = Math.max(0, Math.min(rect.height, maxHeight - y));
  if (width < MIN_MASK_SIZE || height < MIN_MASK_SIZE) {
    return null;
  }
  return { x, y, width, height };
}

export function blurDetections(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  detections: BoundingBox[],
  strength: number
) {
  detections.forEach((det) => {
    const pad = Math.max(det.width, det.height) * 0.08;
    const faceWidth = det.width * 0.55;
    const faceHeight = det.height * 0.45;
    const centerX = det.x + det.width / 2;
    const faceX = centerX - faceWidth / 2;
    const region: BlurRegion = {
      x: faceX - pad,
      y: det.y - pad * 0.6,
      width: faceWidth + pad * 2,
      height: faceHeight + pad * 1.5
    };
    const clamped = clampRect(region, ctx.canvas.width, ctx.canvas.height);
    if (!clamped) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(clamped.x, clamped.y, clamped.width, clamped.height);
    ctx.clip();
    ctx.filter = `blur(${Math.round(strength)}px)`;
    ctx.drawImage(
      source,
      clamped.x,
      clamped.y,
      clamped.width,
      clamped.height,
      clamped.x,
      clamped.y,
      clamped.width,
      clamped.height
    );
    ctx.filter = 'none';
    ctx.restore();
  });
}

export function blurManualMasks(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  masks: ManualMask[],
  strength: number
) {
  masks.forEach((mask) => {
    const clamped = clampRect(mask, ctx.canvas.width, ctx.canvas.height);
    if (!clamped) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(clamped.x, clamped.y, clamped.width, clamped.height);
    ctx.clip();
    ctx.filter = `blur(${Math.round(strength)}px)`;
    ctx.drawImage(
      source,
      clamped.x,
      clamped.y,
      clamped.width,
      clamped.height,
      clamped.x,
      clamped.y,
      clamped.width,
      clamped.height
    );
    ctx.filter = 'none';
    ctx.restore();
  });
}

function seededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function generateAntiSearchParams(level: number): AntiSearchParams {
  const safeLevel = Math.max(1, Math.min(level, 3));
  const seed = Math.floor(Math.random() * 1_000_000) + Date.now();
  const rand = seededRandom(seed);
  const baseCrop = safeLevel + 1;
  const crop = {
    top: 1 + Math.floor(rand() * baseCrop),
    right: 1 + Math.floor(rand() * baseCrop),
    bottom: 1 + Math.floor(rand() * baseCrop),
    left: 1 + Math.floor(rand() * baseCrop)
  };
  const rotation = ((rand() - 0.5) * Math.PI) / (180 / (0.8 + safeLevel * 0.2));
  const noiseAmplitude = 3 + safeLevel * 2;
  const brightnessShift = (rand() - 0.5) * 0.03 * safeLevel;
  const contrastShift = (rand() - 0.5) * 0.04 * safeLevel;
  const warpStrength = 0.6 + safeLevel * 0.35;
  const hueShift = (rand() - 0.5) * 0.18 * safeLevel;
  const saturationShift = (rand() - 0.5) * 0.12 * safeLevel;
  return {
    level: safeLevel,
    crop,
    rotation,
    noiseSeed: seed,
    noiseAmplitude,
    brightnessShift,
    contrastShift,
    warpStrength,
    hueShift,
    saturationShift
  };
}

function cropCanvas(
  input: HTMLCanvasElement,
  crop: { top: number; right: number; bottom: number; left: number }
): HTMLCanvasElement {
  const width = Math.max(1, input.width - crop.left - crop.right);
  const height = Math.max(1, input.height - crop.top - crop.bottom);
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const ctx = output.getContext('2d');
  if (!ctx) {
    throw new Error('canvas');
  }
  ctx.drawImage(input, crop.left, crop.top, width, height, 0, 0, width, height);
  return output;
}

export function applyAntiSearch(
  base: HTMLCanvasElement,
  params: AntiSearchParams
): HTMLCanvasElement {
  const cropped = cropCanvas(base, params.crop);
  const cos = Math.cos(params.rotation);
  const sin = Math.sin(params.rotation);
  const rotatedWidth = Math.abs(cos) * cropped.width + Math.abs(sin) * cropped.height;
  const rotatedHeight = Math.abs(sin) * cropped.width + Math.abs(cos) * cropped.height;
  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = Math.ceil(rotatedWidth);
  rotatedCanvas.height = Math.ceil(rotatedHeight);
  const rctx = rotatedCanvas.getContext('2d');
  if (!rctx) {
    throw new Error('canvas');
  }
  rctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  rctx.rotate(params.rotation);
  rctx.drawImage(cropped, -cropped.width / 2, -cropped.height / 2);
  rctx.setTransform(1, 0, 0, 1, 0, 0);

  const imageData = rctx.getImageData(0, 0, rotatedCanvas.width, rotatedCanvas.height);
  const data = imageData.data;
  const rand = seededRandom(params.noiseSeed);
  const brightness = params.brightnessShift;
  const contrast = params.contrastShift;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  const hueShift = params.hueShift;
  const saturationShift = params.saturationShift;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rand() - 0.5) * params.noiseAmplitude;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let vR = r + noise + brightness * 255;
    let vG = g + noise + brightness * 255;
    let vB = b + noise + brightness * 255;
    vR = factor * (vR - 128) + 128;
    vG = factor * (vG - 128) + 128;
    vB = factor * (vB - 128) + 128;
    const [h, s, l] = rgbToHsl(clamp255(vR), clamp255(vG), clamp255(vB));
    let newH = h + hueShift;
    while (newH < 0) newH += 1;
    while (newH > 1) newH -= 1;
    const newS = clamp01(s + saturationShift);
    const [nr, ng, nb] = hslToRgb(newH, newS, l);
    data[i] = clamp255(nr);
    data[i + 1] = clamp255(ng);
    data[i + 2] = clamp255(nb);
  }
  rctx.putImageData(imageData, 0, 0);

  const warpRand = seededRandom(params.noiseSeed + 1337);
  const warpX = (warpRand() - 0.5) * params.warpStrength * 0.01;
  const warpY = (warpRand() - 0.5) * params.warpStrength * 0.01;

  const margin = Math.max(2, params.level + 1);
  const finalWidth = Math.max(1, cropped.width - margin * 2);
  const finalHeight = Math.max(1, cropped.height - margin * 2);
  const sx = Math.max(0, (rotatedCanvas.width - finalWidth) / 2);
  const sy = Math.max(0, (rotatedCanvas.height - finalHeight) / 2);
  const output = document.createElement('canvas');
  output.width = finalWidth;
  output.height = finalHeight;
  const octx = output.getContext('2d');
  if (!octx) {
    throw new Error('canvas');
  }
  octx.setTransform(1 + warpX, warpY, warpY, 1 - warpX, 0, 0);
  octx.drawImage(
    rotatedCanvas,
    sx,
    sy,
    finalWidth,
    finalHeight,
    0,
    0,
    finalWidth,
    finalHeight
  );
  octx.setTransform(1, 0, 0, 1, 0, 0);
  return output;
}

export function applyColorReduction(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas');
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const quantised = Math.round(luminance / 12) * 12;
    data[i] = quantised;
    data[i + 1] = quantised;
    data[i + 2] = quantised;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function applyWatermark(
  canvas: HTMLCanvasElement,
  text: string
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas');
  }
  const fontSize = Math.max(16, Math.round(canvas.width * 0.025));
  ctx.save();
  ctx.font = `600 ${fontSize}px 'Inter', 'Segoe UI', sans-serif`;
  ctx.textBaseline = 'bottom';
  const margin = Math.max(12, Math.round(canvas.width * 0.02));
  const x = canvas.width - margin;
  const y = canvas.height - margin;
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = Math.max(1, fontSize * 0.08);
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
  return canvas;
}

export function applyPaletteCollapse(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas');
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let brightCount = 0;
  let darkCount = 0;
  const brightSum = [0, 0, 0];
  const darkSum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (luminance >= 140) {
      brightSum[0] += data[i];
      brightSum[1] += data[i + 1];
      brightSum[2] += data[i + 2];
      brightCount += 1;
    } else {
      darkSum[0] += data[i];
      darkSum[1] += data[i + 1];
      darkSum[2] += data[i + 2];
      darkCount += 1;
    }
  }
  const brightColor = brightCount
    ? brightSum.map((value) => Math.round(value / brightCount))
    : [200, 200, 200];
  const darkColor = darkCount
    ? darkSum.map((value) => Math.round(value / darkCount))
    : [40, 40, 40];

  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const useBright = luminance >= 140;
    const color = useBright ? brightColor : darkColor;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function applyPrnuSuppression(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const width = canvas.width;
  const height = canvas.height;
  const baseCtx = canvas.getContext('2d');
  if (!baseCtx) {
    throw new Error('canvas');
  }
  const blurred = document.createElement('canvas');
  blurred.width = width;
  blurred.height = height;
  const bctx = blurred.getContext('2d');
  if (!bctx) {
    throw new Error('canvas');
  }
  bctx.filter = 'blur(1.4px)';
  bctx.drawImage(canvas, 0, 0, width, height);
  const baseData = baseCtx.getImageData(0, 0, width, height);
  const blurData = bctx.getImageData(0, 0, width, height);
  const data = baseData.data;
  const blurPixels = blurData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * 0.65 + blurPixels[i] * 0.35);
    data[i + 1] = Math.round(data[i + 1] * 0.65 + blurPixels[i + 1] * 0.35);
    data[i + 2] = Math.round(data[i + 2] * 0.65 + blurPixels[i + 2] * 0.35);
  }
  baseCtx.putImageData(baseData, 0, 0);
  return canvas;
}

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const grey = Math.round(l * 255);
    return [grey, grey, grey];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
