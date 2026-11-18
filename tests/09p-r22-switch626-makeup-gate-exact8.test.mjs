import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyAcceptedRustScope} from '../scripts/wasm-distribution/r22-accepted-rust-scope.mjs';

const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const trustedBase='d37a774a8ce2ac08ef05389f0d14d3442063edeb';
const gatePath='scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const inputPath='scripts/wasm-distribution/protected-release-inputs.json';
const originalInputBlob='5d2b35f6bc9f0b8544fc52f25a35614b59913d96';
const expectedFutureInputBlob='30551c7cc566614f64c8ba04748c3aef44b419bb';
const products=[
 ['.github/workflows/core-product-session-boundary.yml','8de94431af1e6d58e216fa06bf91a1329a7f7063'],
 ['crates/ddv-save-core/Cargo.toml','751a73da41d8b58f7de70643f50b97722a3c1260'],
 ['crates/ddv-save-core/src/product_makeup_color1.rs','749831d8c41a24585a490b5ed23640fc8d50fc3d'],
 ['crates/ddv-save-core/src/worker_session.rs','254af029304f6a357c8c0a0e7a1376b80313d038'],
 ['crates/ddv-save-core/src/wasm_worker.rs','5fbb1f3d393df127da67f1eafe9796fbb7ce3a56'],
 ['crates/ddv-save-core/src/worker_switch626_makeup_color1.rs','945d6dee10f62396d894ea631e40c3fe26e6d0f0'],
 ['crates/ddv-save-core/src/wasm_switch626_makeup_color1.rs','b8a24a1e288f763349355bd05bf3b7cfd51b0b4a']
];
const gitEnv={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'Wand CI local exact gate',GIT_AUTHOR_EMAIL:'gate@example.invalid',
 GIT_COMMITTER_NAME:'Wand CI local exact gate',GIT_COMMITTER_EMAIL:'gate@example.invalid'};
const raw=(args,extraEnv={})=>execFileSync('git',args,{
 cwd,env:{...gitEnv,...extraEnv},encoding:'utf8',
 stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024}).trim();
const git=(...args)=>raw(args);
const objectExists=sha=>{try{git('cat-file','-e',sha+'^{blob}');return true}catch{return false}};
const gateBlob=git('rev-parse','HEAD:'+gatePath);
function synthetic(parent,updates){
 const dir=mkdtempSync(join(tmpdir(),'wand-gate-exact8-'));
 try{
  const env={GIT_INDEX_FILE:join(dir,'index')};
  raw(['read-tree',parent+'^{tree}'],env);
  for(const [path,sha,mode='100644'] of updates){
   if(!objectExists(sha))throw Error('SOURCE_BLOB_NOT_AVAILABLE_'+path+'_'+sha);
   raw(['update-index','--add','--cacheinfo',mode,sha,path],env);
  }
  const tree=raw(['write-tree'],env);
  return raw(['commit-tree',tree,'-p',parent,'-m','Synthetic fixed R22 candidate (local Git object, NO REF)']);
 }finally{rmSync(dir,{recursive:true,force:true})}
}
test('ACT1581 protected release CLI pins trusted Git/on-disk Gate before importing candidate Rust policy',()=>{
 const actual=git('show','HEAD:scripts/wasm-distribution/verify-protected-release.mjs');
 assert.ok(!actual.includes("import {verifyAcceptedRustScope} from './r22-accepted-rust-scope.mjs'"));
 const guarded=actual.indexOf('assertTrustedRustGateBeforeImport(prBase,expectedSource)');
 const loaded=actual.indexOf("await import('./r22-accepted-rust-scope.mjs')");
 assert.ok(guarded>0&&loaded>guarded,'actual candidate gate must be pinned BEFORE import');
 for(const path of ['scripts/wasm-distribution/verify-protected-release.mjs',
   'scripts/wasm-distribution/r22-accepted-rust-scope.mjs','scripts/int-selection-preflight.mjs'])
  assert.ok(actual.includes("'"+path+"'"),'missing protected source '+path);
 for(const exact of ['CANDIDATE_MUTATED_TRUSTED_GATE','CHECKED_OUT_TRUSTED_GATE_DRIFT',
   "const exact=\'100644 blob \'+trusted+String.fromCharCode(9)+path;",
   "git('ls-tree',base,'--',path)","git('ls-tree',source,'--',path)",
   "git('hash-object','--no-filters','--',path)",'GIT_NO_REPLACE_OBJECTS'])
  assert.ok(actual.includes(exact),'missing literal raw-gate control '+exact);
});

test('ACT1581 exact fixed R22 source selector static immutable eight-mint contract and prior release stays off',()=>{
 assert.equal(git('rev-parse',trustedBase+':crates/ddv-save-core'),'b5416aa726caea9d311075599ac606e11285b295');
 assert.equal(git('rev-parse',trustedBase+':'+inputPath),originalInputBlob);
 const gateSource=git('show','HEAD:'+gatePath);
 for(const sha of ['42086449f9deef26ed48b21d7edab0f5685da7c2',
  '751a73da41d8b58f7de70643f50b97722a3c1260',expectedFutureInputBlob]){
  assert.ok(gateSource.includes(sha));
 }
 assert.ok(!gateSource.includes('mergeAuthorized:true'));
 assert.ok(gateSource.includes('mergeAuthorized:false,writerAuthorized:false,operationOn:false'));
 // The accepted Gate-only main has the ORIGINAL cargo pin. After the exact
 // reviewed product transition, only the immutable FUTURE pin is permitted.
 // A mismatched Core/config pair must fail, never silently inherit a generic
 // pin or skip this regression when product Rust becomes present.
 const currentCore=git('rev-parse','HEAD:crates/ddv-save-core');
 const currentConfigBlob=git('rev-parse','HEAD:'+inputPath);
 const approvedStagePairs=new Map([
  ['b5416aa726caea9d311075599ac606e11285b295',originalInputBlob],
  ['42086449f9deef26ed48b21d7edab0f5685da7c2',expectedFutureInputBlob]
 ]);
 assert.ok(approvedStagePairs.has(currentCore),'UNAPPROVED_R22_CORE_STAGE');
 assert.equal(currentConfigBlob,approvedStagePairs.get(currentCore),
  'R22_CORE_CONFIG_STAGE_PIN_MISMATCH');
 const config=JSON.parse(git('show','HEAD:'+inputPath));
 assert.deepEqual(config.features,['indexed-read','worker-wasm']);
 assert.equal(config.defaultFeatures,false);
 assert.equal(config.writerEnabled,false);
 assert.equal(config.productConsumerEnabled,false);
 assert.equal(config.approvedCargoLockSha256,'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c');
});
test('ACT1581 proposed 8 exact Rust+R22 blobs accept immutable synthetic source and deny mismatches',t=>{
 const unavailable=products.filter(([,sha])=>!objectExists(sha));
 if(unavailable.length){
  if(process.env.WAND_REQUIRE_SWITCH_MAKEUP_GATE_FOCUS==='1')
   throw Error('FOCUSED_EXACT_PRODUCT_BLOBS_NOT_FETCHED_'+JSON.stringify(unavailable));
  t.skip('PR2217 fixed Source Git objects not included in this generic checkout');
  return;
 }
 // Build only Git objects in a disposable index; never modify refs/main/files.
 const gateBase=synthetic(trustedBase,[[gatePath,gateBlob]]);
 // Keep exact original Git Blob bytes including trailing newline; the
 // text-trimming Git helper is appropriate for SHA output, not JSON byte pins.
 const cfg=execFileSync('git',['show',trustedBase+':'+inputPath],{
  cwd,env:gitEnv,encoding:'utf8'});
 const from='aa6b1dd771da305bf7a21c6101fb4620a8b74b93',
  to='751a73da41d8b58f7de70643f50b97722a3c1260';
 assert.equal(cfg.split(from).length,2);
 // Use Git blob object SHA for approved reviewed R22 tuple. The next product
 // branch will physically contain this same blob; do not change current config.
 const future=cfg.replace(from,to);
 const configBlob=execFileSync('git',['hash-object','-w','--stdin'],{
  cwd,env:gitEnv,encoding:'utf8',input:future}).trim();
 assert.equal(configBlob,expectedFutureInputBlob);
 const accepted=synthetic(gateBase,[...products,[inputPath,configBlob]]);
 const receipt=verifyAcceptedRustScope(cwd,gateBase,accepted);
 assert.equal(receipt.entryCount,8);
 assert.equal(receipt.sourcePr,2217);
 assert.equal(receipt.mergeAuthorized,false);
 assert.equal(receipt.writerAuthorized,false);
 assert.equal(receipt.operationOn,false);
 assert.equal(receipt.candidateHead,accepted);
 assert.equal(receipt.base,gateBase);
 const docsSha=execFileSync('git',['hash-object','-w','--stdin'],{
  cwd,env:gitEnv,encoding:'utf8',input:'unrelated safe markdown only\n'}).trim();
 const later=synthetic(accepted,[['docs/gate-unrelated-later-ci-only.md',docsSha]]);
 // This verifier is an EXACT candidate selector; extra later paths must be
  // excluded by a new selection, not silently accepted here.
  assert.throws(()=>verifyAcceptedRustScope(cwd,gateBase,later),/SOURCE_PATH_SET_MISMATCH/);
 const badCargo=synthetic(gateBase,[...products.map(([p,s])=>[p,p.endsWith('Cargo.toml')?
  'aa6b1dd771da305bf7a21c6101fb4620a8b74b93':s]),[inputPath,configBlob]]);
 const badConfig=synthetic(gateBase,[...products,[inputPath,originalInputBlob]]);
 const badMissing=synthetic(gateBase,[...products.filter(([p])=>!p.endsWith('worker_switch626_makeup_color1.rs')),[inputPath,configBlob]]);
 const badGate=synthetic(accepted,[[gatePath,git('rev-parse',trustedBase+':'+gatePath)]]);
 for(const bad of [badCargo,badConfig,badMissing,badGate]){
  assert.throws(()=>verifyAcceptedRustScope(cwd,gateBase,bad),/R22_ACCEPTED_SCOPE_|SOURCE_PATH_SET_MISMATCH/);
 }
 const badExtraSource=synthetic(accepted,[['crates/ddv-save-core/src/zzz_unapproved_makeup.rs',docsSha]]);
 assert.throws(()=>verifyAcceptedRustScope(cwd,gateBase,badExtraSource),/R22_ACCEPTED_SCOPE_|SOURCE_PATH_SET_MISMATCH/);
});
