import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
const raw='bbf9bc830440d964c5da8b3c3cac7e926d281881';
const derived='d7991c2c20b7ace6613d6a9cd6493b8c3af0f6ba';
function gitBlob(buf) { return createHash('sha1').update(Buffer.from(`blob ${buf.length}\0`)).update(buf).digest('hex'); }
test('a derived82 candidate exists ONLY under a fresh disposable temp root with exact 10 changes and original SHA immutable',()=>{
  const script = resolve('scripts/09p-sql-derive82-temporary-bootstrap.mjs');
  const source = resolve('supabase/migrations/20260930025132_community_core_v0_server_rpc.sql');
  const before = gitBlob(readFileSync(source));
  assert.equal(before, raw);
  const run = spawnSync(process.execPath,[script],{encoding:'utf8',timeout:15000});
  assert.equal(run.status,0,run.stderr);
  const scratch = run.stdout.trim();
  assert.equal(scratch.startsWith(join(tmpdir(),'wand-derived82-disposable-')),true);
  try {
    const manifest=JSON.parse(readFileSync(join(scratch,'DERIVED82_TEST_ONLY_PROVENANCE.json'),'utf8'));
    assert.equal(manifest.label,'DERIVED82_TEST_ONLY_NOT_RAW_IMMUTABLE_REPLAY');
    assert.equal(manifest.rawOriginalGitBlob,raw);
    assert.equal(manifest.derivedTemporaryGitBlob,derived);
    assert.equal(manifest.originalFilesMutated,false);
    assert.equal(manifest.mergeReady,false);
    assert.equal(manifest.deployReady,false);
    assert.equal(manifest.publicOrWriterGate,false);
    assert.deepEqual(manifest.exactAddedSemicolonLines,[30,91,123,194,246,280,359,464,526,547]);
    const migrated=join(scratch,'supabase','migrations');
    assert.equal(readdirSync(migrated).filter(n=>n.endsWith('.sql')).length,82);
    const corrected = readFileSync(join(migrated,'20260930025132_community_core_v0_server_rpc.sql'));
    assert.equal(gitBlob(corrected),derived);
    assert.equal(corrected.length,readFileSync(source).length+10);
    assert.equal(gitBlob(readFileSync(source)),before);
  } finally {
    rmSync(scratch,{force:true,recursive:true});
  }
});
