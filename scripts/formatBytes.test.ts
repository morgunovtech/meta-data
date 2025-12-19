import assert from 'node:assert/strict';
import { formatBytesPrecise } from '../src/utils/format';

const cases: Array<{ input: number; expected: string }> = [
  { input: 0, expected: '0 B' },
  { input: 1024, expected: '1.00 KB' },
  { input: 1536, expected: '1.50 KB' },
  { input: 2_097_152, expected: '2.00 MB' }
];

for (const { input, expected } of cases) {
  assert.equal(formatBytesPrecise(input), expected);
}

console.log('formatBytesPrecise: ok');
