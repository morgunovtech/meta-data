import type { AntiSearchParams } from '../types/cleanup';
import { createSeed, mulberry32 } from './random';

interface GenerateParamsOptions {
  strength: number;
}

export function generateAntiSearchParams({ strength }: GenerateParamsOptions): AntiSearchParams {
  const clamped = Math.max(1, Math.min(strength, 3));
  const crop = clamped; // 1-3 pixels per side
  const rotationDeg = (mulberry32(createSeed())() - 0.5) * (0.6 + (clamped - 1) * 0.45) * 2;
  const noiseAmplitude = 2 + (clamped - 1) * 1.5;
  const brightnessDelta = (mulberry32(createSeed())() - 0.5) * (1.2 + (clamped - 1) * 0.8);
  return {
    crop,
    rotationDeg,
    noiseAmplitude,
    brightnessDelta,
    seed: createSeed()
  };
}

export function applyAntiSearch(baseCanvas: HTMLCanvasElement, params: AntiSearchParams): HTMLCanvasElement {
  let working = baseCanvas;

  if (params.crop > 0 && working.width > params.crop * 2 && working.height > params.crop * 2) {
    const cropped = document.createElement('canvas');
    const targetWidth = Math.max(1, working.width - params.crop * 2);
    const targetHeight = Math.max(1, working.height - params.crop * 2);
    cropped.width = targetWidth;
    cropped.height = targetHeight;
    const ctx = cropped.getContext('2d');
    if (!ctx) {
      return working;
    }
    ctx.drawImage(
      working,
      params.crop,
      params.crop,
      working.width - params.crop * 2,
      working.height - params.crop * 2,
      0,
      0,
      targetWidth,
      targetHeight
    );
    working = cropped;
  }

  if (Math.abs(params.rotationDeg) > 0.01) {
    const rotated = document.createElement('canvas');
    rotated.width = working.width;
    rotated.height = working.height;
    const ctx = rotated.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.translate(rotated.width / 2, rotated.height / 2);
      const scale = 1 + Math.abs(params.rotationDeg) * 0.0025;
      ctx.scale(scale, scale);
      ctx.rotate((params.rotationDeg * Math.PI) / 180);
      ctx.drawImage(working, -working.width / 2, -working.height / 2);
      ctx.restore();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(working, 0, 0, rotated.width, rotated.height);
      working = rotated;
    }
  }

  if (params.noiseAmplitude > 0 || Math.abs(params.brightnessDelta) > 0.01) {
    const ctx = working.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, working.width, working.height);
      const { data } = imageData;
      const rng = mulberry32(params.seed);
      for (let index = 0; index < data.length; index += 4) {
        const noise = (rng() - 0.5) * params.noiseAmplitude * 2;
        const brightness = params.brightnessDelta;
        for (let channel = 0; channel < 3; channel += 1) {
          const current = data[index + channel];
          let next = current + brightness + noise;
          if (next < 0) next = 0;
          else if (next > 255) next = 255;
          data[index + channel] = next;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }
  }

  return working;
}
