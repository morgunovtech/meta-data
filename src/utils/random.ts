export function createSeededRandom(seed: number): () => number {
  let t = seed >>> 0;
  if (t === 0) {
    t = 0x9e3779b9; // ensure non-zero seed
  }
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
