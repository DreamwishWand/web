import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source=fileURLToPath(new URL('./01d-steam-native-icon-delta.test.py',import.meta.url));
test('01D native v1.25 Steam original-guid source: 7 actual Python synthetic/negative tests',()=>{
  const py=spawnSync('python3',[source],{encoding:'utf8',timeout:30000});
  assert.equal(py.error,undefined,String(py.error||''));
  assert.equal(py.status,0,py.stderr);
  assert.match(py.stderr,/Ran 7 tests/);
  assert.match(py.stderr,/^OK\s*$/m);
});
