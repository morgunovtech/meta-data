function dct1D(vector: number[], size: number): number[] {
  const result = new Array<number>(size).fill(0);
  const factor = Math.PI / size;
  for (let u = 0; u < size; u += 1) {
    let sum = 0;
    for (let x = 0; x < size; x += 1) {
      sum += vector[x] * Math.cos((x + 0.5) * u * factor);
    }
    const coef = u === 0 ? Math.sqrt(1 / size) : Math.sqrt(2 / size);
    result[u] = coef * sum;
  }
  return result;
}

function dct2D(matrix: number[][], size: number): number[][] {
  const temp: number[][] = new Array(size);
  for (let y = 0; y < size; y += 1) {
    temp[y] = dct1D(matrix[y], size);
  }
  const result: number[][] = new Array(size);
  for (let x = 0; x < size; x += 1) {
    const column = new Array(size);
    for (let y = 0; y < size; y += 1) {
      column[y] = temp[y][x];
    }
    const transformed = dct1D(column, size);
    result[x] = transformed;
  }
  // Transpose result to keep original orientation
  const finalResult: number[][] = new Array(size);
  for (let y = 0; y < size; y += 1) {
    finalResult[y] = new Array(size);
    for (let x = 0; x < size; x += 1) {
      finalResult[y][x] = result[x][y];
    }
  }
  return finalResult;
}

export async function computePhash(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) {
    return null;
  }
  if (typeof document === 'undefined') {
    return null;
  }
  const image = new Image();
  image.src = dataUrl;
  return new Promise((resolve) => {
    image.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const grayscale: number[][] = new Array(size);
        for (let y = 0; y < size; y += 1) {
          grayscale[y] = new Array(size);
          for (let x = 0; x < size; x += 1) {
            const index = (y * size + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            grayscale[y][x] = 0.299 * r + 0.587 * g + 0.114 * b;
          }
        }
        const dctMatrix = dct2D(grayscale, size);
        const sampleSize = 8;
        const coefficients: number[] = [];
        for (let y = 0; y < sampleSize; y += 1) {
          for (let x = 0; x < sampleSize; x += 1) {
            coefficients.push(dctMatrix[y][x]);
          }
        }
        const dc = coefficients[0];
        const withoutDc = coefficients.slice(1);
        const mean = withoutDc.reduce((sum, value) => sum + value, 0) / withoutDc.length;
        let hashBits = '';
        for (let i = 1; i < coefficients.length; i += 1) {
          hashBits += coefficients[i] > mean ? '1' : '0';
        }
        const chunks = hashBits.match(/.{1,4}/g) ?? [];
        const hex = chunks
          .map((chunk) => Number.parseInt(chunk.padEnd(4, '0'), 2).toString(16))
          .join('');
        // include DC coefficient metadata to avoid collisions for flat images
        const dcNormalized = Math.max(0, Math.min(255, Math.round(dc / 4)))
          .toString(16)
          .padStart(2, '0');
        resolve(`${dcNormalized}${hex}`);
      } catch (error) {
        console.warn('phash-failed', error);
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
  });
}
