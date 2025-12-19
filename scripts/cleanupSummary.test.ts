import assert from 'node:assert/strict';
import { buildCleanupSummary } from '../src/utils/cleanupSummary';

const t = (key: string, params?: Record<string, string | number>) => {
  if (!params) return key;
  return Object.entries(params).reduce(
    (acc, [paramKey, paramValue]) => acc.replace(`{${paramKey}}`, String(paramValue)),
    key
  );
};

const summary = buildCleanupSummary({
  removeMetadata: true,
  resolutionSummary: 'resolution',
  blurSummary: 'blur',
  antiSearchEnabled: false,
  antiSearchLevel: 2,
  renameSummary: 'rename',
  watermarkEnabled: false,
  qualityMode: 'medium',
  qualityPercent: 90,
  t
});

assert.ok(summary.includes('privacyDiffAntiSearchNeutral'));
assert.ok(summary.includes('privacyDiffWatermarkOff'));
assert.ok(summary.some((item) => item.includes('qualityMode_medium')));

console.log('buildCleanupSummary: ok');
