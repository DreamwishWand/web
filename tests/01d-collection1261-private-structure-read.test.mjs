import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('./01d-collection1261-private-structure-read.test.py',import.meta.url));
test('01D Source-only v1.26.1 CollectionSet 305 + schema643 private read: six adversarial Python tests',()=>{
  const py=spawnSync('python3',[source],{encoding:'utf8',timeout:30000});
  assert.equal(py.error,undefined,String(py.error||''));
  assert.equal(py.status,0,py.stderr);
  assert.match(py.stderr,/Ran 6 tests/);
  assert.match(py.stderr,/^OK\s*$/m);
});
