// 07 DBK: the private v1.26.1 image GUID dedupe worklist must stay synthetic in CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('07DBK Steam v1.26.1 GUID reuse/extract queue: nine synthetic-only tests including exact 8-original mock integration',()=>{
  const script=fileURLToPath(new URL('./07dbk-steam1261-image-batch-queue.test.py',import.meta.url));
  const run=spawnSync('python3',[script],{encoding:'utf8',timeout:30000});
  assert.equal(run.error,undefined,String(run.error));
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stderr,/Ran 9 tests/);
  assert.match(run.stderr,/^OK\s*$/m);
  assert.equal(run.stdout,'','private or game item names cannot appear in CI stdout');
});
