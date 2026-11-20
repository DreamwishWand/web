import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source=fileURLToPath(new URL('./01d-steam-native-icon-delta.test.py',import.meta.url));
test('01D original Steam item-guid source plus opt-in v1.26.1: 8 Python synthetic/negative tests',()=>{
  const py=spawnSync('python3',[source],{encoding:'utf8',timeout:30000});
  assert.equal(py.error,undefined,String(py.error||''));
  assert.equal(py.status,0,py.stderr);
  assert.match(py.stderr,/Ran 8 tests/);
  assert.match(py.stderr,/^OK\s*$/m);
});
