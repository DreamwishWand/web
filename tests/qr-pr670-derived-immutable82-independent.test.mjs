// Independent 04 QR-S changed-risk checks for Source PR670.
// Synthetic/disposable local scope ONLY. Do not touch managed DB or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, realpathSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  deriveExactHistoricalRpc,
  ensureDisposableEnvironment,
  prepareDisposableOverlay,
} from '../scripts/comm-immutable82-derived-disposable.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const historical='supabase/migrations/20260930025132_community_core_v0_server_rpc.sql';
const originalSha='bbf9bc830440d964c5da8b3c3cac7e926d281881';
const derivedSha='d7991c2c20b7ace6613d6a9cd6493b8c3af0f6ba';
const originalSourceHead='56c537c51a9be3d764986d66cf4b459a7a624b8d';
const fixedSourceHead='d2a0b970f666cf86b667d04c8cacb44434d3a6b2';
const terminalLines=[30,91,123,194,246,280,359,464,526,547];
const approved={DDVRE_E2_LOCAL_DISPOSABLE:'APPROVED'};
const originalFile=join(root,historical);

function git(...args){return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trimEnd();}
function shaBytes(bytes) {
  return execFileSync('git',['hash-object','--stdin'],{cwd:root,input:bytes,encoding:'utf8'}).trim();
}
function tree(ref){
  const output=git('ls-tree','-r',ref,'supabase/migrations');
  return new Map(output.split('\n').filter(Boolean).map(line=>{
    const m=line.match(/^[0-7]{6} blob ([a-f0-9]{40})\t(.+)$/);
    assert.ok(m,'unexpected git tree entry');
    return [m[2],m[1]];
  }));
}
function logCheck(name,fn) {
  return test(name,()=>{fn();console.log('QR670_'+name.replace(/[^A-Z0-9]/g,'_')+'_PASS');});
}

logCheck('CANONICAL82_ALL_FILES_AND_81_SUCCESSORS_UNCHANGED',()=>{
  const originalTree=tree('origin/main'),sourceTree=tree(fixedSourceHead);
  assert.equal(originalTree.size,82);
  assert.equal(sourceTree.size,163);
  assert.equal(sourceTree.get(historical),originalSha);
  for(const [path,sha] of originalTree) assert.equal(sourceTree.get(path),sha,'historic path drift '+path);
  assert.equal([...sourceTree.keys()].filter(path=>!originalTree.has(path)).length,81);
  const sourceDelta=git('diff','--name-only',originalSourceHead,fixedSourceHead).split('\n').sort();
  assert.deepEqual(sourceDelta,[
    '.github/workflows/comm-immutable82-derived-disposable.yml',
    'docs/community/immutable82-derived-disposable-baseline-20261106.md',
    'scripts/comm-immutable82-derived-disposable.mjs',
    'tests/comm-immutable82-derived-disposable.test.mjs',
  ]);
});

logCheck('INDEPENDENT_BYTE_AND_TEN_LINE_SHA_ORACLE',()=>{
  const original=readFileSync(originalFile);
  assert.equal(original.length,23112);
  assert.equal(shaBytes(original),originalSha);
  const lines=original.toString('utf8').split('\n');
  assert.equal(lines.length,572);
  const observed=lines.flatMap((line,i)=>line.trim()==='$function$'?[i+1]:[]);
  assert.deepEqual(observed,terminalLines);
  // Independently assemble the expected scratch bytes (not using Source helper).
  const derived=Buffer.from(lines.map((line,i)=>
    terminalLines.includes(i+1)?line+';':line).join('\n'));
  assert.equal(derived.length,23122);
  assert.equal(shaBytes(derived),derivedSha);
  assert.deepEqual(deriveExactHistoricalRpc(original).bytes,derived);
  assert.equal(shaBytes(readFileSync(originalFile)),originalSha);
});

logCheck('TAMPER_MISSING_DUPLICATE_CORRECTED_AND_ENV_FAIL_CLOSED',()=>{
  const original=readFileSync(originalFile);
  const tampered=Buffer.from(original);tampered[100]^=8;
  const lines=original.toString('utf8').split('\n');
  const omit=[...lines];omit.splice(29,1);
  const duplicate=[...lines];duplicate.splice(29,0,'$function$');
  const already=Buffer.from(lines.map((line,i)=>
    terminalLines.includes(i+1)?line+';':line).join('\n'));
  for(const input of [tampered,original.subarray(0,original.length-1),
    Buffer.from(omit.join('\n')),Buffer.from(duplicate.join('\n')),already]) {
    assert.throws(()=>deriveExactHistoricalRpc(input),/IMMUTABLE_ORIGINAL82_/);
  }
  for(const value of [{}, {DDVRE_E2_LOCAL_DISPOSABLE:'YES'}, {DDVRE_E2_LOCAL_DISPOSABLE:'APPROVE'}]) {
    assert.throws(()=>ensureDisposableEnvironment(value),/APPROVAL_REQUIRED/);
  }
  for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_ID','DATABASE_URL','SUPABASE_DB_PASSWORD']){
    assert.throws(()=>ensureDisposableEnvironment({...approved,[key]:'remote-unsafe'}),
      new RegExp('REMOTE_OR_DB_ENV_FORBIDDEN_'+key));
  }
  assert.doesNotThrow(()=>ensureDisposableEnvironment({...approved,
    SUPABASE_ACCESS_TOKEN:'',SUPABASE_PROJECT_ID:'',DATABASE_URL:'',SUPABASE_DB_PASSWORD:''}));
});

logCheck('SCRATCH_INSIDE_TMP_MANIFEST_AND_DELETION',()=>{
  const originalBefore=shaBytes(readFileSync(originalFile));
  let workdir;
  try {
    const manifest=prepareDisposableOverlay({repoRoot:root,env:approved});
    workdir=manifest.workdir;
    const scratchReal=realpathSync(workdir);
    assert.ok(scratchReal.startsWith(realpathSync(tmpdir())+sep),'scratch escaped tmp');
    assert.match(scratchReal,/ddvre-immutable82-derived-local-/);
    assert.ok(statSync(join(workdir,'supabase')).isDirectory());
    assert.equal(shaBytes(readFileSync(join(workdir,historical))),derivedSha);
    const m=JSON.parse(readFileSync(join(workdir,'derived-baseline-manifest.json'),'utf8'));
    assert.equal(m.originalGitBlob,originalSha);
    assert.equal(m.derivedScratchGitBlob,derivedSha);
    assert.deepEqual(m.exactInsertedTerminalSemicolonLines,terminalLines);
    for(const k of ['mergeReady','deployReady','productWriterEnabled',
      'originalMigrationBytesChanged','derivedDatabaseLedgerComparableToOriginal',
      'staging116LedgerEquivalent','original82RawSqlBootstrapPass',
      'signedRuntimeTwoPgPass','managedRuntimePass']) assert.equal(m[k],false,k);
    assert.equal(m.source163MigrationCountExpected,163);
    assert.equal(shaBytes(readFileSync(originalFile)),originalBefore);
  } finally {
    if(workdir)rmSync(workdir,{recursive:true,force:true});
  }
  assert.ok(!workdir||!existsSync(workdir),'scratch not deleted');
  assert.equal(shaBytes(readFileSync(originalFile)),originalSha);
});
