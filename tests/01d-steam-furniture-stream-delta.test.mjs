import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./01d-steam-furniture-stream-delta.test.py', import.meta.url));
test('01D Steam furniture original source delta: 9 synthetic negative/guard tests', () => {
  const run = spawnSync('python3', [script], { encoding: 'utf8', timeout: 30000 });
  assert.equal(run.error, undefined, String(run.error || ''));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /Ran 9 tests/);
  assert.match(run.stderr, /^OK\s*$/m);
});
