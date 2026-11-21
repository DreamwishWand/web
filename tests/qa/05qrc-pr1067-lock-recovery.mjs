import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {loadPinnedReadOnlyRustBytes} from '../../src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const APPROVED='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const BASE='80f102fca2c6af4baba69402d0e3406487abed30';
const SOURCE='14db794f05ecbb2b5e5662a0bdb8f1e38f79cc41';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const manifest=(origin,lock=APPROVED)=>({
 contract:'wand.r22.rust-wasm-source-provenance-candidate@1',
 kind:'PUBLIC_READONLY_SIGNED_ASSET_ONLY_UI_OFF',
 source:{repository:'DreamwishWand/web',commit:SOURCE,wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',defaultFeatures:false,features:['indexed-read','worker-wasm'],cargoLockOrigin:origin,cargoLockSha256:lock,cargoTomlSha256:'a'.repeat(64)},
 signature:{status:'UNKNOWN',verified:false},release:{publishedPages:true,autoUpload:false,productConsumerEnabled:false,writerAuthorized:false},
 abi:{exportClass:'WorkerWasmSource',maxPageRecords:8,writerAuthorized:false,nativeV3:false,methods:['append_chunk','finish','issue_saved_diffgrids_typed_cursor','read_saved_diffgrids_typed_page','close']},
 assets:{js:{path:'ddv_save_core.js',sha256:'b'.repeat(64),sizeBytes:1},wasm:{path:'ddv_save_core_bg.wasm',sha256:'c'.repeat(64),sizeBytes:1}}
});
async function probe(origin,lock=APPROVED){
 const mf=Buffer.from(JSON.stringify(manifest(origin,lock)));
 const pins={contract:'wand.r22.candidate-pinned-digests@1',sourceHead:SOURCE,manifestSha256:sha(mf),manifestSizeBytes:mf.length,jsSha256:'b'.repeat(64),wasmSha256:'c'.repeat(64),jsSizeBytes:1,wasmSizeBytes:1,sourceProvenanceOnly:true,verifiedSignature:false};
 const calls=[];let error='';
 globalThis.self={location:new URL('http://127.0.0.1/web/_app/worker.js')};
 try{
  await loadPinnedReadOnlyRustBytes({basePath:'/web',trustedPins:pins,fetcher:async url=>{
   calls.push(new URL(url).pathname);
   if(url.endsWith('/manifest.json'))return {ok:true,status:200,redirected:false,url,type:'basic',headers:{get:()=> 'application/json'},arrayBuffer:async()=>mf};
   throw Error('intentional asset boundary sentinel');
  }});
 }catch(e){error=e.message}finally{delete globalThis.self;}
 return {error,calls};
}
test('historical generated origin reaches asset verification, not fake signature acceptance',async()=>{
 const v=await probe('cargo-generated-this-ci-job');assert.match(v.error,/SAME_ORIGIN_ASSET_FETCH_DENIED/);assert(v.calls.includes('/web/worker-wasm/ddv_save_core.js'));
});
test('approved exact lock provenance MUST reach asset verification',async()=>{
 const v=await probe('approved-repository-lock');
 console.log('QA1067_APPROVED_ORIGIN_ACTUAL',JSON.stringify(v));
 assert.match(v.error,/SAME_ORIGIN_ASSET_FETCH_DENIED/,'approved origin rejected before JS/WASM verification');
 assert(v.calls.includes('/web/worker-wasm/ddv_save_core.js'));
});
test('unknown origin and wrong approved hash rejected before assets',async()=>{
 for(const [o,h] of [['unreviewed-lock',APPROVED],['approved-repository-lock','d'.repeat(64)]]){
  const v=await probe(o,h);assert.match(v.error,/MANIFEST_PROVENANCE_OR_ABI_DENIED/);assert.deepEqual(v.calls,['/web/worker-wasm/manifest.json']);
 }
});
test('actual protected preflight exact lock and independently mutated bytes/base',async()=>{
 const lock='crates/ddv-save-core/Cargo.lock',approved='scripts/wasm-distribution/approved-Cargo.lock';
 const bytes=await readFile(approved);assert.equal(bytes.length,7052);assert.equal(sha(bytes),APPROVED);assert.equal(git('rev-parse',SOURCE+':'+approved),'b667b42cfef2032c2925be7b2aa9b7142bff4b52');
 const cfg=JSON.parse(await readFile('scripts/wasm-distribution/protected-release-inputs.json'));assert.equal(cfg.approvedCargoLockSha256,APPROVED);
 assert.equal(git('rev-parse','refs/remotes/origin/main'),BASE,'live base moved: re-evaluate scope');
 const env={...process.env,WAND_SOURCE_HEAD:git('rev-parse','HEAD'),GITHUB_EVENT_NAME:'pull_request',WAND_PR_BASE_SHA:BASE,WAND_PUBLIC_READONLY_ASSET_GATE:'OWNER_APPROVED_THREE_FILES_20261111',WAND_APPROVED_RELEASE_LOCK:'1'};
 const run=(changes={})=>spawnSync(process.execPath,['scripts/wasm-distribution/verify-protected-release.mjs','inputs'],{env:{...env,...changes},encoding:'utf8'});
 const deny=(r,code)=>{assert.notEqual(r.status,0);assert.match(r.stderr,new RegExp(code));};
 await writeFile(lock,bytes);
 try{
  let r=run();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/R22_RELEASE_INPUTS_ONLY_SOURCE_PINNED/);
  deny(run({WAND_PR_BASE_SHA:cfg.acceptedAncestorProtectedMain}),'PR_BASE_NOT_LIVE_PROTECTED_MAIN');
  deny(run({WAND_SOURCE_HEAD:BASE}),'SOURCE_HEAD_MISMATCH');
  deny(run({WAND_APPROVED_RELEASE_LOCK:'0'}),'CARGO_LOCK_SHA_DRIFT_NEEDS_NEW_REVIEW');
  await writeFile(lock,Buffer.concat([bytes,Buffer.from('\n')]));deny(run(),'CARGO_LOCK_SHA_DRIFT_NEEDS_NEW_REVIEW');
  await writeFile(lock,bytes);await writeFile(approved,Buffer.concat([bytes,Buffer.from('\n')]));deny(run(),'CARGO_LOCK_SHA_DRIFT_NEEDS_NEW_REVIEW');
  await writeFile(lock,Buffer.concat([bytes,Buffer.from('\n')]));deny(run(),'CARGO_LOCK_SHA_DRIFT_NEEDS_NEW_REVIEW');
 }finally{await writeFile(approved,bytes);await writeFile(lock,bytes);}
 console.log('QA1067_PREFLIGHT_EXACT_1POS_6NEG_PASS');
});
