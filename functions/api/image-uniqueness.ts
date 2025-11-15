import type { ImageUniquenessMatch, ImageUniquenessResult, ApiResponse } from '../../src/types/api';
import type { PagesEventContext } from './_types';

const KNOWN_HASHES: Array<{ label: string; hash: string }> = [
  { label: 'Lenna test portrait', hash: 'f23c9a7bd68c5a0ff23c9a7bd68c5a0f' },
  { label: 'Earthrise NASA Apollo 8', hash: '0ff0f0f00ff0f0f00ff0f0f00ff0f0f0' },
  { label: 'Stock office handshake', hash: 'acac5a5aacac5a5aacac5a5aacac5a5a' }
];

function hexToBinary(hex: string): string {
  return hex
    .split('')
    .map((char) => Number.parseInt(char, 16).toString(2).padStart(4, '0'))
    .join('');
}

function hamming(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  let distance = Math.abs(a.length - b.length);
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) {
      distance += 1;
    }
  }
  return distance;
}

function compareHash(phash: string): ImageUniquenessResult {
  const binary = hexToBinary(phash);
  const matches: ImageUniquenessMatch[] = [];
  let bestScore = 0;
  KNOWN_HASHES.forEach((entry) => {
    const candidateBinary = hexToBinary(entry.hash);
    const distance = hamming(binary, candidateBinary);
    const similarity = 1 - distance / Math.max(candidateBinary.length, binary.length);
    if (similarity > 0.72) {
      matches.push({ label: entry.label, similarity: Number(similarity.toFixed(2)) });
    }
    if (similarity > bestScore) {
      bestScore = similarity;
    }
  });
  matches.sort((a, b) => b.similarity - a.similarity);
  return { score: Number(bestScore.toFixed(2)), matches };
}

export async function onRequest({ request }: PagesEventContext) {
  const url = new URL(request.url);
  const phash = url.searchParams.get('phash');
  if (!phash || !/^[0-9a-fA-F]{8,64}$/.test(phash)) {
    const response: ApiResponse<ImageUniquenessResult> = {
      ok: false,
      error: 'invalid_phash'
    };
    return new Response(JSON.stringify(response), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const result = compareHash(phash);
  const payload: ApiResponse<ImageUniquenessResult> = {
    ok: true,
    data: result
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60'
    }
  });
}
