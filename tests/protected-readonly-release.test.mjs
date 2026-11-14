import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RELEASE_TUPLES,LEGACY_RELEASE_TUPLE,ACTIVE_RELEASE_TUPLE,RELEASE_REPOSITORY_ID,matchReleaseTuple,releaseDelivery,manifestMatchesRelease,protectedPagesContextMatches} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {createHash} from 'node:crypto';
import {readonlyReleaseIdentityText,loadProtectedReadonlyRustWasm} from '../src/lib/ddv/core/save/product-rust-wasm-release-loader.mjs';
import {PROTECTED_READONLY_RELEASE_ANCHOR} from '../src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs';
import {loadPinnedReadOnlyRustBytes,loadSourcePinnedRustWasmCandidate} from '../src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';

test('unsealed source and QA candidate cannot promote to product provenance',async()=>{
 assert.equal(PROTECTED_READONLY_RELEASE_ANCHOR,null);
 await assert.rejects(loadProtectedReadonlyRustWasm({qaCandidate:true}),/CALLER_AUTHORITY_DENIED/);
 globalThis.self={location:new URL('https://dreamwishwand.github.io/web/_app/test.js')};
 try{
  await assert.rejects(loadProtectedReadonlyRustWasm(),/BUILD_ANCHOR_MISSING_OR_INVALID/);
  await assert.rejects(loadProtectedReadonlyRustWasm(),/LOAD_REPLAY_DENIED/);
  await assert.rejects(loadSourcePinnedRustWasmCandidate({qaCandidate:false}),/UNSIGNED_PRODUCT_DISTRIBUTION_OFF/);
 }finally{delete globalThis.self}
});
test('immutable release identity changes with any subject, source or delivery scope',()=>{
 const pins={sourceHead:'a'.repeat(40),manifestSha256:'b'.repeat(64),manifestSizeBytes:100,
 jsSha256:'c'.repeat(64),jsSizeBytes:200,wasmSha256:'d'.repeat(64),wasmSizeBytes:300};
 const a={repository:'DreamwishWand/web',signerWorkflow:'DreamwishWand/web/.github/workflows/pages.yml',
 sourceRef:'refs/heads/main',origin:'https://dreamwishwand.github.io',basePath:'/web',pins};
 const hash=x=>createHash('sha256').update(readonlyReleaseIdentityText(x)).digest('hex');
 for(const k of Object.keys(pins)){
  const v=pins[k],next=typeof v==='number'?v+1:'f'.repeat(v.length);
  assert.notEqual(hash(a),hash({...a,pins:{...pins,[k]:next}}),k);
 }
 for(const [k,v] of [['origin','https://other.invalid'],['basePath',''],['sourceRef','refs/heads/other'],
  ['signerWorkflow','DreamwishWand/web/.github/workflows/other.yml']])
  assert.notEqual(hash(a),hash({...a,[k]:v}),k);
});
test('Pages source signs before sealing and bundling, then checks exact build bytes; formal authority OFF and scoped preformal Reader',async()=>{
 const y=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 const order=['actions/attest-build-provenance@v2','scripts/readonly-release/seal.mjs seal',
  '- name: Build static site','scripts/readonly-release/seal.mjs check-built','actions/upload-pages-artifact@v3'];
 assert.ok(order.every((s,i)=>y.includes(s)&&(!i||y.indexOf(order[i-1])<y.indexOf(s))));
 assert.match(y,/--features worker-wasm,indexed-read/);
 assert.match(y,/find build\/worker-wasm -maxdepth 1 -type f \| wc -l\)" -eq 3/);
 const worker=await readFile(new URL('../src/lib/wep/steam-saved-diffgrids.consumer.worker.ts',import.meta.url),'utf8');
 assert.match(worker,/PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false/);
 assert.match(worker,/PREFORMAL_STEAM_READER_ENABLED=true/);
 assert.match(worker,/if\(PRODUCT_READONLY_CONSUMER_OWNER_ENABLED\|\|!PREFORMAL_STEAM_READER_ENABLED\)/);
 assert.match(worker,/allowSyntheticFixture:false/);
});

test('protected release uses the exact previously reviewed Cargo lock, not floating dependency resolution',async()=>{
 const root=new URL('../',import.meta.url);
 const read=path=>readFile(new URL(path,root));
 const lock=await read('scripts/wasm-distribution/approved-Cargo.lock');
 const config=JSON.parse(await read('scripts/wasm-distribution/protected-release-inputs.json'));
 assert.equal(lock.length,7052);
 assert.equal(createHash('sha256').update(lock).digest('hex'),config.approvedCargoLockSha256);
 for(const path of ['.github/workflows/pages.yml','.github/workflows/01a-protected-main-signed-wasm-release-off.yml']){
  const y=(await read(path)).toString('utf8');
  const copy='cp scripts/wasm-distribution/approved-Cargo.lock crates/ddv-save-core/Cargo.lock';
  assert.ok(y.includes("WAND_APPROVED_RELEASE_LOCK: '1'"));
  assert.ok(y.includes(copy));
  assert.ok(y.indexOf(copy)<y.indexOf('verify-protected-release.mjs inputs'));
  assert.ok(y.indexOf('verify-protected-release.mjs inputs')<y.indexOf('cargo build --locked'));
  assert.doesNotMatch(y,/cargo generate-lockfile/);
 }
 const verifier=(await read('scripts/wasm-distribution/verify-protected-release.mjs')).toString('utf8');
 assert.match(verifier,/CARGO_LOCK_SHA_DRIFT_NEEDS_NEW_REVIEW/);
 assert.match(verifier,/!locked\.equals\(approvedLock\)/);
 assert.match(verifier,/refs\/remotes\/origin\/main/);
 assert.match(verifier,/PR_BASE_NOT_LIVE_PROTECTED_MAIN/);
 assert.match(verifier,/cargoLockOrigin!=='approved-repository-lock'/);
 const builder=(await read('scripts/wasm-distribution/build-candidate.mjs')).toString('utf8');
 assert.match(builder,/APPROVED_CARGO_LOCK_MISMATCH/);
 assert.match(builder,/cargoLockOrigin:approvedLockMode\?'approved-repository-lock':'cargo-generated-this-ci-job'/);
});

test('shared loader accepts reviewed lock provenance only with the approved digest; historical generated candidates still work',async()=>{
 const lock='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
 const head='a'.repeat(40), js='b'.repeat(64), wasm='c'.repeat(64);
 const probe=async(origin,digest)=>{
  const manifest={contract:'wand.r22.rust-wasm-source-provenance-candidate@1',
   kind:'PUBLIC_READONLY_SIGNED_ASSET_ONLY_UI_OFF',
   source:{repository:'DreamwishWand/web',commit:head,wasmBindgen:'0.2.105',
    wasmTarget:'wasm32-unknown-unknown',profile:'release',defaultFeatures:false,
    features:['indexed-read','worker-wasm'],cargoLockOrigin:origin,
    cargoLockSha256:digest,cargoTomlSha256:'d'.repeat(64)},
   signature:{status:'UNKNOWN',verified:false},
   release:{publishedPages:true,autoUpload:false,productConsumerEnabled:false,writerAuthorized:false},
   abi:{exportClass:'WorkerWasmSource',maxPageRecords:8,writerAuthorized:false,nativeV3:false,
    methods:['append_chunk','finish','issue_saved_diffgrids_typed_cursor','read_saved_diffgrids_typed_page','close']},
   assets:{js:{path:'ddv_save_core.js',sizeBytes:1,sha256:js},
    wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:1,sha256:wasm}}};
  const bytes=Buffer.from(JSON.stringify(manifest));
  const pins={contract:'wand.r22.candidate-pinned-digests@1',sourceHead:head,
   manifestSha256:createHash('sha256').update(bytes).digest('hex'),manifestSizeBytes:bytes.length,
   jsSha256:js,wasmSha256:wasm,jsSizeBytes:1,wasmSizeBytes:1,
   sourceProvenanceOnly:true,verifiedSignature:false};
  const calls=[];
  globalThis.self={location:new URL('http://127.0.0.1/web/_app/worker.js')};
  try{
   await loadPinnedReadOnlyRustBytes({basePath:'/web',trustedPins:pins,fetcher:async url=>{
    calls.push(new URL(url).pathname);
    if(url.endsWith('/manifest.json'))return {ok:true,status:200,redirected:false,url,type:'basic',
     headers:{get:()=> 'application/json'},arrayBuffer:async()=>bytes};
    throw Error('intentional asset boundary sentinel');
   }});
   assert.fail('sentinel must deny asset load');
  }catch(error){return {error:error.message,calls}}finally{delete globalThis.self;}
 };
 for(const [origin,digest] of [['approved-repository-lock',lock],['cargo-generated-this-ci-job','e'.repeat(64)]]){
  const v=await probe(origin,digest);
  assert.match(v.error,/SAME_ORIGIN_ASSET_FETCH_DENIED/);
  assert.ok(v.calls.includes('/web/worker-wasm/ddv_save_core.js'));
  assert.ok(v.calls.includes('/web/worker-wasm/ddv_save_core_bg.wasm'));
 }
 for(const [origin,digest] of [['approved-repository-lock','e'.repeat(64)],['unreviewed-lock',lock],
  ['approved-repository-lock',undefined],['cargo-generated-this-ci-job','not-a-sha']]){
  const v=await probe(origin,digest);
  assert.match(v.error,/MANIFEST_PROVENANCE_OR_ABI_DENIED/);
  assert.deepEqual(v.calls,['/web/worker-wasm/manifest.json']);
 }
});

test('ACT505 finite trust tuples: exact cross product, no dev/fork or unknown origin',()=>{
 assert.equal(ACTIVE_RELEASE_TUPLE,LEGACY_RELEASE_TUPLE);
 assert.equal(RELEASE_REPOSITORY_ID,'1371485649');
 assert.equal(RELEASE_TUPLES.length,3);
 const repos=['DreamwishWand/web','DreamwishWand/site','DreamwishWand/dev','fork/web'];
 const workflows=[...repos.map(r=>r+'/.github/workflows/pages.yml'),'DreamwishWand/web/.github/workflows/other.yml'];
 const origins=['https://dreamwishwand.github.io','https://dreamwishwand.com','https://other.invalid','https://dreamwishwand.com:444','http://dreamwishwand.com'];
 const bases=['/web','','/site','/web/','//web'];
 let positive=0,negative=0;
 for(const repository of repos)for(const signerWorkflow of workflows)for(const sourceRef of ['refs/heads/main','refs/heads/dev','refs/pull/1/merge'])for(const origin of origins)for(const basePath of bases){
  const value={repository,signerWorkflow,sourceRef,origin,basePath};
  const match=matchReleaseTuple(value);
  const expected=sourceRef==='refs/heads/main'&&signerWorkflow===repository+'/.github/workflows/pages.yml'&&
   ((repository==='DreamwishWand/web'&&origin==='https://dreamwishwand.github.io'&&basePath==='/web')||
    (['DreamwishWand/web','DreamwishWand/site'].includes(repository)&&origin==='https://dreamwishwand.com'&&basePath===''));
  assert.equal(!!match,expected,JSON.stringify(value));if(expected)positive++;else negative++;
 }
 assert.equal(positive,3);assert.equal(negative,1497);
 assert.ok(Object.isFrozen(RELEASE_TUPLES)&&RELEASE_TUPLES.every(Object.isFrozen));
});
test('ACT505 historical manifest is legacy only; root signed delivery metadata exact, no relabel',()=>{
 for(const t of RELEASE_TUPLES){
  const manifest={source:{repository:t.repository},...(t===LEGACY_RELEASE_TUPLE?{}:{delivery:releaseDelivery(t)})};
  for(const other of RELEASE_TUPLES)assert.equal(manifestMatchesRelease(manifest,other),t===other);
  if(t!==LEGACY_RELEASE_TUPLE){
   for(const key of Object.keys(manifest.delivery)){
    assert.equal(manifestMatchesRelease({...manifest,delivery:{...manifest.delivery,[key]:'wrong'}},t),false,key);
    const missing={...manifest.delivery};delete missing[key];assert.equal(manifestMatchesRelease({...manifest,delivery:missing},t),false,key);
   }
   assert.equal(manifestMatchesRelease({...manifest,delivery:{...manifest.delivery,extra:true}},t),false);
  }
 }
});
test('ACT505 Pages context binds immutable repo ID, exact workflow/ref/source and committed legacy selector',()=>{
 const sha='a'.repeat(40),t=ACTIVE_RELEASE_TUPLE;
 const e={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY_ID:RELEASE_REPOSITORY_ID,GITHUB_REPOSITORY:t.repository,
  GITHUB_REF:t.sourceRef,GITHUB_SHA:sha,GITHUB_WORKFLOW_SHA:sha,GITHUB_WORKFLOW_REF:t.signerWorkflow+'@'+t.sourceRef,
  GITHUB_EVENT_NAME:'push',WAND_PUBLIC_READONLY_ASSET_GATE:'OWNER_APPROVED_THREE_FILES_20261111'};
 assert.equal(protectedPagesContextMatches(e,sha,sha),true);
 assert.equal(protectedPagesContextMatches({...e,GITHUB_EVENT_NAME:'workflow_dispatch'},sha,sha),true);
 for(const [key,value] of Object.entries(e)){
  assert.equal(protectedPagesContextMatches({...e,[key]:'wrong'},sha,sha),false,key);
  const missing={...e};delete missing[key];assert.equal(protectedPagesContextMatches(missing,sha,sha),false,key);
 }
 assert.equal(protectedPagesContextMatches(e,'b'.repeat(40),sha),false);
 assert.equal(protectedPagesContextMatches(e,sha,'b'.repeat(40)),false);
 const next=RELEASE_TUPLES[2];
 assert.equal(protectedPagesContextMatches({...e,GITHUB_REPOSITORY:next.repository,GITHUB_WORKFLOW_REF:next.signerWorkflow+'@'+next.sourceRef},sha,sha),false);
 // Env cannot select the future root or change the active tuple.
 assert.equal(protectedPagesContextMatches({...e,WAND_RELEASE_BASE_PATH:'',WAND_RELEASE_ORIGIN:'https://dreamwishwand.com'},sha,sha),true);
 assert.equal(ACTIVE_RELEASE_TUPLE,LEGACY_RELEASE_TUPLE);
});
