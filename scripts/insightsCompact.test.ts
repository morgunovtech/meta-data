import assert from 'node:assert/strict';
import { dedupeByNameAndDistance, localizeCategoryKey } from '../src/utils/insightsCompact';

const t = (key: string, params?: Record<string, string | number>) => {
  if (!params) return key;
  return Object.entries(params).reduce(
    (acc, [paramKey, paramValue]) => acc.replace(`{${paramKey}}`, String(paramValue)),
    key
  );
};

const deduped = dedupeByNameAndDistance([
  { name: 'Cafe', category: 'cafe', distance: 20 },
  { name: 'Cafe', category: 'cafe', distance: 21 },
  { name: 'Cafe', category: 'cafe', distance: 20 }
]);

assert.equal(deduped.length, 2);
assert.equal(localizeCategoryKey('fast_food', t), 'poiCategory_fast_food');
assert.equal(localizeCategoryKey('unknown_type', t), 'poiCategory_other');

console.log('insightsCompact: ok');
