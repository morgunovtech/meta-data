import { access, copyFile, mkdir } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public', 'ocr');

const assets = [
  { from: ['tesseract.js', 'dist', 'worker.min.js'], to: 'worker.min.js' },
  { from: ['tesseract.js-core', 'tesseract-core.wasm.js'], to: 'tesseract-core.wasm.js' },
  { from: ['tesseract.js-core', 'tesseract-core.wasm'], to: 'tesseract-core.wasm' },
  { from: ['tesseract.js-core', 'tessdata', 'eng.traineddata'], to: 'eng.traineddata' }
];

async function ensureDir() {
  await mkdir(publicDir, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

async function copyAssets() {
  await ensureDir();
  const messages = [];

  for (const asset of assets) {
    const source = path.join(projectRoot, 'node_modules', ...asset.from);
    const target = path.join(publicDir, asset.to);
    // eslint-disable-next-line no-await-in-loop
    const exists = await fileExists(source);
    if (!exists) {
      messages.push(`⚠️  Missing OCR asset: ${source}`);
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await copyFile(source, target);
    messages.push(`✓ Copied ${asset.to}`);
  }

  if (messages.length > 0) {
    console.log(messages.join('\n'));
  }
}

copyAssets().catch((error) => {
  console.warn('[prepare:ocr] failed to stage assets', error);
});
