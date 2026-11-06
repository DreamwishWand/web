// 04 QR-S independent differential QA for PR676 composite Source164–169 SQL.
// Only disposable /tmp; 03 COMM Source helper is exercised, independently attested.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  attestPinnedPeerFiles, assertScratchRoot, prepareCumulative169,
  requireExactPeerHead, PINNED_MIGRATIONS, PEER_HEAD,
} from '../scripts/comm-derived169-cumulative-scratch.mjs';
import {
  prepareDisposableOverlay,
} from '../scripts/comm-immutable82-derived-disposable.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const peer=join(root,'source169-peer');
const peerAvailable=existsSync(join(peer,'.git'));
const peerRequirement={skip:peerAvailable?false:'No source169-peer checkout in generic CI; MUST run in dedicated fixed-head CI'};
const history='20260930025132_community_core_v0_server_rpc.sql';
const original='bbf9bc830440d964c5da8b3c3cac7e926d281881';
const derived='d7991c2c20b7ace6613d6a9cd6493b8c3af0f6ba';
const sourceParent='d2a0b970f666cf86b667d04c8cacb44434d3a6b2';
const sourceCurrent='afeaf2955eb5515624d9ab27b8743e59e5a0145c';
const peerHead='a76e1b9faf4e5eae4b5290fd339688226ee9feca';
const approve={DDVRE_E2_LOCAL_DISPOSABLE:'APPROVED'};

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function blob(cwd,path){return git(cwd,'hash-object',path);}
function marker(x){console.log('QR676_'+x+'_PASS');}
function assertGateFalse(receipt) {
  for(const name of ['original82RawSqlBootstrapPass','source169SignedCumulativeTwoPgPass',
    'managedLedgerCompatible','schemaAuthorityEquivalent','mergeReady','deployReady',
    'productWriterEnabled','communityPublicEnabled']) {
    assert.equal(receipt[name],false,name+' must not promote release');
  }
}

test('pin exact PR676 source, all 3 add-only paths and immutable original82 bytes',()=>{
  assert.equal(git(root,'rev-parse',sourceParent).length,40);
  assert.equal(git(root,'rev-parse',sourceCurrent),sourceCurrent);
  const paths=git(root,'diff','--name-only',sourceParent,sourceCurrent).split('\n').sort();
  assert.deepEqual(paths,[
    '.github/workflows/comm-derived169-cumulative-scratch.yml',
    'scripts/comm-derived169-cumulative-scratch.mjs',
    'tests/comm-derived169-cumulative-scratch.test.mjs'
  ]);
  assert.equal(blob(root,join(root,'supabase/migrations',history)),original);
  assert.equal(git(root,'ls-tree','-r','--name-only',sourceParent,'supabase/migrations').split('\n').length,163);
  marker('EXACT_SOURCE_THREE_ADD_ONLY_ORIGINAL82_IMMUTABLE');
});
test('pin peer HEAD and six independently SHA-attested Source164–169 SQL files',peerRequirement,()=>{
  assert.equal(git(peer,'rev-parse','HEAD'),peerHead);
  assert.equal(PEER_HEAD,peerHead);
  assert.equal(PINNED_MIGRATIONS.length,6);
  const actual=attestPinnedPeerFiles(join(peer,'supabase/migrations'));
  assert.equal(actual.length,6);
  assert.equal(new Set(actual.map(x=>x.file)).size,6);
  assert.deepEqual(actual.map(x=>x.sha),PINNED_MIGRATIONS.map(x=>x[1]));
  for(let i=0;i<6;i++){
    assert.equal(blob(peer,join(peer,'supabase/migrations',actual[i].file)),actual[i].sha);
    assert.match(actual[i].file,new RegExp('source16'+(4+i)));
  }
  assert.throws(()=>requireExactPeerHead('main'),/PEER_HEAD_MISMATCH/);
  assert.throws(()=>requireExactPeerHead(peerHead.slice(0,39)+'0'),/PEER_HEAD_MISMATCH/);
  marker('FIXED_PEER_SIX_SQL_SHA_AND_WRONG_HEAD_DENIED');
});
test('tampered or absent peer SQL is denied independent of Source owner test',peerRequirement,()=>{
  const dir=mkdtempSync(join(tmpdir(),'qr676-peer-neg-'));
  try {
    const files=PINNED_MIGRATIONS.map(([path])=>path);
    for(const file of files) copyFileSync(join(peer,'supabase/migrations',file),join(dir,file));
    assert.equal(attestPinnedPeerFiles(dir).length,6);
    const f=join(dir,files[0]);
    const bytes=readFileSync(f);const change=Buffer.from(bytes);change[20]^=4;
    writeFileSync(f,change);
    assert.throws(()=>attestPinnedPeerFiles(dir),/PEER_MIGRATION_SHA_MISMATCH/);
    writeFileSync(f,bytes);
    rmSync(join(dir,files[5]));
    assert.throws(()=>attestPinnedPeerFiles(dir),/ENOENT/);
  } finally {rmSync(dir,{recursive:true,force:true});}
  marker('MISSING_TAMPERED_PEER_FILES_FAIL_CLOSED');
});
test('remote target or invalid scratch location is blocked',()=>{
  assert.throws(()=>assertScratchRoot(root),/NOT_DISPOSABLE_SCRATCH/);
  const wrong=mkdtempSync(join(tmpdir(),'qr676-wrong-root-'));
  try{assert.throws(()=>assertScratchRoot(wrong),/NOT_DISPOSABLE_SCRATCH/);}
  finally{rmSync(wrong,{recursive:true,force:true});}
  for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_ID','DATABASE_URL','SUPABASE_DB_PASSWORD']){
    assert.throws(()=>prepareCumulative169({
      repoRoot:root,scratchRoot:wrong,peerRoot:peer,
      env:{...approve,[key]:'remote'}
    }),/REMOTE_OR_DB_ENV_FORBIDDEN/);
  }
  assert.throws(()=>prepareCumulative169({repoRoot:root,scratchRoot:wrong,peerRoot:peer,env:{}}),
    /APPROVAL_REQUIRED/);
  marker('DISPOSABLE_BOUNDARY_REMOTE_ENV_NEGATIVES');
});
test('add 6 SQL only in derived scratch; deny parent overwrite, preserve original and destroy',peerRequirement,()=>{
  let dir;const originalFile=join(root,'supabase/migrations',history);
  try{
    const scratch=prepareDisposableOverlay({repoRoot:root,env:approve});
    dir=scratch.workdir;
    const trueTmp=resolve(tmpdir())+sep;
    assert.ok(resolve(dir).startsWith(trueTmp));
    assert.equal(blob(root,originalFile),original);
    assert.equal(blob(root,join(dir,'supabase/migrations',history)),derived);
    const receipt=prepareCumulative169({repoRoot:root,scratchRoot:dir,peerRoot:peer,env:approve});
    assert.equal(receipt.migrationsAdded.length,6);
    assertGateFalse(receipt);
    assert.equal(receipt.source169PeerHead,peerHead);
    assert.equal(receipt.source169MigrationCountExpected,169);
    assert.equal(receipt.original82GitBlob,original);
    assert.equal(receipt.scratchDerived82GitBlob,derived);
    const sqlDir=join(dir,'supabase/migrations');
    const count=execFileSync('find',[sqlDir,'-maxdepth','1','-name','*.sql'],{encoding:'utf8'})
      .trim().split('\n').length;
    assert.equal(count,169);
    for(const [file,sha] of PINNED_MIGRATIONS)assert.equal(blob(root,join(sqlDir,file)),sha);
    assert.equal(blob(root,originalFile),original);
    assert.equal(blob(root,join(sqlDir,history)),derived);
    assert.ok(existsSync(join(dir,'derived169-cumulative-receipt.json')));
    assert.throws(()=>prepareCumulative169({repoRoot:root,scratchRoot:dir,peerRoot:peer,env:approve}),
      /PARENT_NOT_SOURCE163/);
    assert.equal(blob(root,originalFile),original);
  } finally {
    if(dir)rmSync(dir,{force:true,recursive:true});
  }
  assert.ok(!dir||!existsSync(dir));
  marker('DERIVED_ONLY_163_TO_169_MANIFEST_NO_CLOBBER_AND_DELETE');
});
