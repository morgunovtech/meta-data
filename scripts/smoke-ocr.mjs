import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWorker } from 'tesseract.js';

const FONT = {
  T: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100'
  ],
  E: [
    '11111',
    '10000',
    '11110',
    '10000',
    '10000',
    '10000',
    '11111'
  ],
  S: [
    '01111',
    '10000',
    '11110',
    '00001',
    '00001',
    '10001',
    '01110'
  ],
  '1': [
    '00100',
    '01100',
    '00100',
    '00100',
    '00100',
    '00100',
    '01110'
  ],
  '2': [
    '01110',
    '10001',
    '00001',
    '00010',
    '00100',
    '01000',
    '11111'
  ],
  '3': [
    '11110',
    '00001',
    '00001',
    '00110',
    '00001',
    '00001',
    '11110'
  ],
  ' ': [
    '000',
    '000',
    '000',
    '000',
    '000',
    '000',
    '000'
  ]
};

function renderTextToPbm(text) {
  const rows = FONT.T.length;
  const colsPerChar = FONT.T[0].length;
  const spacing = 1;
  const width = text.split('').reduce((acc) => acc + colsPerChar + spacing, 0) + spacing;
  const matrix = Array.from({ length: rows }, () => Array(width).fill(0));

  let offset = spacing;
  for (const char of text.toUpperCase()) {
    const glyph = FONT[char] ?? FONT[' '];
    glyph.forEach((row, y) => {
      row.split('').forEach((pixel, x) => {
        const targetX = offset + x;
        if (targetX < width) {
          matrix[y][targetX] = pixel === '1' ? 1 : 0;
        }
      });
    });
    offset += colsPerChar + spacing;
  }

  const header = `P1\n${width} ${rows}\n`;
  const body = matrix.map((row) => row.join(' ')).join('\n');
  return header + body + '\n';
}

async function main() {
  const pbm = renderTextToPbm('TEST 123');
  const tempFile = path.join(os.tmpdir(), `ocr-smoke-${Date.now()}.pbm`);
  fs.writeFileSync(tempFile, pbm, 'utf8');

  const localBase = path.join(process.cwd(), 'public', 'ocr');
  const sources = [
    fs.existsSync(path.join(localBase, 'worker.min.js'))
      ? {
          label: 'local',
          workerPath: path.join(localBase, 'worker.min.js'),
          corePath: path.join(localBase, 'tesseract-core.wasm.js'),
          langPath: `${localBase}${path.sep}`
        }
      : null,
    {
      label: 'cdn',
      workerPath: 'https://unpkg.com/tesseract.js@4.1.1/dist/worker.min.js',
      corePath: 'https://unpkg.com/tesseract.js-core@5.0.1/tesseract-core.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast/'
    }
  ].filter(Boolean);

  let worker;
  for (const source of sources) {
    try {
      worker = await createWorker({
        workerPath: source.workerPath,
        corePath: source.corePath,
        langPath: source.langPath,
        logger: (message) => {
          if (message?.status) {
            // eslint-disable-next-line no-console
            console.log(`[ocr:${source.label}:${message.status}]`, message.progress ?? '');
          }
        }
      });
      break;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`worker-init-${source.label}`, error);
    }
  }

  if (!worker) {
    throw new Error('No OCR worker could be initialized.');
  }

  try {
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data } = await worker.recognize(tempFile);
    const normalized = data.text.trim().toUpperCase();
    if (!normalized.includes('TEST') || !normalized.includes('123')) {
      throw new Error(`OCR smoke failed. Got: ${normalized || '<empty>'}`);
    }
    // eslint-disable-next-line no-console
    console.log('OCR smoke passed:', normalized);
  } finally {
    await worker.terminate();
    fs.rmSync(tempFile, { force: true });
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
