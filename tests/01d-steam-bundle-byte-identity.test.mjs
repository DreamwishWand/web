import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tests=fileURLToPath(new URL('./01d-steam-bundle-byte-identity.test.py',import.meta.url));
test('01D Steam original v1.25 bundle source SHA: 7 Python negative tests',()=>{
  const out=spawnSync('python3',[tests],{encoding:'utf8',timeout:30000});
  assert.equal(out.error,undefined,String(out.error||''));
  assert.equal(out.status,0,out.stderr);
  assert.match(out.stderr,/Ran 7 tests/);
  assert.match(out.stderr,/^OK\s*$/m);
});
