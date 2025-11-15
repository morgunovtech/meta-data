const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function getRandomValues(length: number): Uint32Array {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return array;
  }
  const array = new Uint32Array(length);
  for (let index = 0; index < length; index += 1) {
    array[index] = Math.floor(Math.random() * 0xffffffff);
  }
  return array;
}

export function createRandomId(length = 6): string {
  const randomValues = getRandomValues(length);
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += ALPHABET[randomValues[index] % ALPHABET.length];
  }
  return result;
}

export function createSeed(): number {
  const random = getRandomValues(1)[0];
  return random === 0 ? 1 : random;
}

export function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
