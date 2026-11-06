import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  assertScratchRoot, attestPinnedPeerFiles, requireExactPeerHead,
  PINNED_MIGRATIONS, PEER_HEAD, CUMULATIVE_SCOPE
} from '../scripts/comm-derived169-cumulative-scratch.mjs';

test('six distinct Source164-169 SQL and fixed independently accepted Source169 HEAD',()=>{
 assert.equal(PINNED_MIGRATIONS.length,6);
 assert.equal(new Set(PINNED_MIGRATIONS.map(([name])=>name)).size,6);
 assert.ok(PINNED_MIGRATIONS.every(([name,sha])=>name.endsWith('.sql')&&/^[a-f0-9]{40}$/.test(sha)));
 assert.match(CUMULATIVE_SCOPE,/NO_SIGNED_OR_MANAGED_ACCEPTANCE/);
 assert.doesNotThrow(()=>requireExactPeerHead(PEER_HEAD));
 assert.throws(()=>requireExactPeerHead(PEER_HEAD.slice(0,39)+'0'),/PEER_HEAD_MISMATCH/);
 assert.throws(()=>requireExactPeerHead('main'),/PEER_HEAD_MISMATCH/);
});

test('only a verified disposable /tmp prefix can receive derived Source169',()=>{
 assert.throws(()=>assertScratchRoot(process.cwd()),/NOT_DISPOSABLE_SCRATCH/);
 const tmp=mkdtempSync(join(tmpdir(),'comm-non-ddvre-'));
 try { assert.throws(()=>assertScratchRoot(tmp),/NOT_DISPOSABLE_SCRATCH/); }
 finally {rmSync(tmp,{recursive:true,force:true});}
});

test('missing or tampered six peer migration SQL bytes fail before writes',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'comm-peer-negative-'));
 try {
  assert.throws(()=>attestPinnedPeerFiles(tmp),/ENOENT/);
  mkdirSync(join(tmp,'fallback'));
  for(const [file] of PINNED_MIGRATIONS) writeFileSync(join(tmp,file),'-- injected invalid SQL\n');
  assert.throws(()=>attestPinnedPeerFiles(tmp),/PEER_MIGRATION_SHA_MISMATCH/);
 } finally {rmSync(tmp,{recursive:true,force:true});}
});
