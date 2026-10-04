import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Product completion routes are present and keep Collection media fail-closed', () => {
  const moodboards = readFileSync(new URL('../src/routes/moodboards/+page.svelte', import.meta.url), 'utf8');
  const collection = readFileSync(new URL('../src/routes/collection/+page.svelte', import.meta.url), 'utf8');
  assert.match(moodboards, /MOODBOARD_STORAGE_KEY/);
  assert.match(moodboards, /exportBackup/);
  assert.match(collection, /loadCollectionRuntime/);
  assert.match(collection, /copy\.media/);
  assert.doesNotMatch(collection, /<img\b/i);
});
