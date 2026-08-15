const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('notification catalog contains 50+ pharmacy events and defaults', () => {
  const file = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'notification-types.ts'), 'utf8');
  const match = file.match(/export const NOTIFICATION_TYPES = \[([\s\S]*?)\] as const/);
  assert.ok(match, 'notification catalog should exist');
  const types = [...match[1].matchAll(/"([A-Za-z0-9]+)"/g)].map((m) => m[1]);
  assert.ok(types.length >= 50, `expected 50+ notification types, got ${types.length}`);
  assert.match(file, /DEFAULT_NOTIFICATION_PREFERENCES/);
  assert.match(file, /forceSale/);
  assert.match(file, /saleReturned/);
  assert.match(file, /medicineLowStock/);
  assert.match(file, /syncConflict/);
});
