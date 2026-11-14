import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ACTIVE_RELEASE_TUPLE,LEGACY_RELEASE_TUPLE,RELEASE_TUPLES,manifestMatchesRelease,releaseDelivery} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {readonlyReleaseIdentityText,loadProtectedReadonlyRustWasm} from '../../src/lib/ddv/core/save/product-rust-wasm-release-loader.mjs';
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const base='51fde043e024e2d84fd1c4c28a0c787748b82277';
const t=ACTIVE_RELEASE_TUPLE;
const lock='crates/ddv-save-core/Cargo.lock';
const anchor='src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs';
const initial=await readFile(anchor);
const sha=b=>createHash('sha256').update(b).digest('hex');
const env={...process.env,GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'DreamwishWand/web',GITHUB_REPOSITORY_ID:'1371485649',GITHUB_REF:'refs/heads/main',GITHUB_SHA:head,GITHUB_WORKFLOW_SHA:head,GITHUB_WORKFLOW_REF:'DreamwishWand/web/.github/workflows/pages.yml@refs/heads/main',GITHUB_EVENT_NAME:'push',WAND_SOURCE_HEAD:head,WAND_PUBLIC_READONLY_ASSET_GATE:'OWNER_APPROVED_THREE_FILES_20261111',WAND_APPROVED_RELEASE_LOCK:'1',WAND_RELEASE_BASE_PATH:'/web'};
const run=(path,args,delta={})=>spawnSync(process.execPath,[path,...args],{env:{...env,...delta},encoding:'utf8'});
const deny=(r,code)=>{assert.notEqual(r.status,0,r.stdout);assert.match(r.stderr,new RegExp(code));};
const verifier='scripts/wasm-distribution/verify-protected-release.mjs';
const sealer='scripts/readonly-release/seal.mjs';
test('ACT506 actual verifier enforces protected tuple and repository identity before lock/build',async()=>{
 await copyFile('scripts/wasm-distribution/approved-Cargo.lock',lock);
 const good=run(verifier,['inputs']);assert.equal(good.status,0,good.stderr);assert.match(good.stdout,/R22_RELEASE_INPUTS_ONLY_SOURCE_PINNED/);
 const cases=[
 [{GITHUB_REPOSITORY_ID:'1371485650'},'REPOSITORY_IDENTITY_DENIED'],
 [{GITHUB_REPOSITORY:'DreamwishWand/dev'},'REPOSITORY_IDENTITY_DENIED'],
 [{GITHUB_REPOSITORY:'DreamwishWand/site',GITHUB_WORKFLOW_REF:'DreamwishWand/site/.github/workflows/pages.yml@refs/heads/main'},'REPOSITORY_IDENTITY_DENIED'],
 [{GITHUB_REPOSITORY:'fork/web'},'REPOSITORY_IDENTITY_DENIED'],
 [{GITHUB_ACTIONS:'false'},'REPOSITORY_IDENTITY_DENIED'],
 [{GITHUB_WORKFLOW_REF:'DreamwishWand/web/.github/workflows/other.yml@refs/heads/main'},'RELEASE_WORKFLOW_DENIED'],
 [{GITHUB_WORKFLOW_SHA:base},'PROTECTED_PAGES_TUPLE_DENIED'],
 [{GITHUB_SHA:base},'PROTECTED_PAGES_TUPLE_DENIED'],
 [{GITHUB_EVENT_NAME:'pull_request'},'PROTECTED_PAGES_TUPLE_DENIED'],
 [{WAND_RELEASE_BASE_PATH:''},'PROTECTED_PAGES_TUPLE_DENIED'],
 [{WAND_RELEASE_BASE_PATH:'/site'},'PROTECTED_PAGES_TUPLE_DENIED'],
 [{WAND_SOURCE_HEAD:base},'SOURCE_HEAD_MISMATCH'],
 [{WAND_PUBLIC_READONLY_ASSET_GATE:'false'},'PROTECTED_PAGES_TUPLE_DENIED'],
 [{GITHUB_REF:'refs/heads/other'},'NOT_PROTECTED_MAIN_PUSH']
 ];
 for(const [delta,code] of cases)deny(run(verifier,['inputs'],delta),code);
 console.log('ACT506_ACTUAL_VERIFIER_1POS_14NEG_PASS');
});
test('ACT506 actual sealer refuses context spoof before any anchor write',async()=>{
 for(const delta of [
 {GITHUB_REPOSITORY_ID:'1371485650'},{GITHUB_REPOSITORY:'DreamwishWand/dev'},
 {GITHUB_REPOSITORY:'DreamwishWand/site',GITHUB_WORKFLOW_REF:'DreamwishWand/site/.github/workflows/pages.yml@refs/heads/main'},
 {GITHUB_WORKFLOW_REF:'DreamwishWand/web/.github/workflows/01a-protected-main-signed-wasm-release-off.yml@refs/heads/main'},
 {GITHUB_EVENT_NAME:'pull_request'},{GITHUB_WORKFLOW_SHA:base},{GITHUB_SHA:base},
 {WAND_SOURCE_HEAD:base},{GITHUB_REF:'refs/heads/other'},{WAND_PUBLIC_READONLY_ASSET_GATE:'false'}
 ]){deny(run(sealer,['seal'],delta),'PROTECTED_PAGES_CONTEXT_REQUIRED');assert.deepEqual(await readFile(anchor),initial);}
 // Even a valid context with no real bundle cannot mint an anchor.
 deny(run(sealer,['seal'],{WAND_SIGSTORE_BUNDLE:''}),'ATTESTATION_BUNDLE_REQUIRED');
 assert.deepEqual(await readFile(anchor),initial);
 console.log('ACT506_ACTUAL_SEALER_11NEG_NO_ANCHOR_WRITE_PASS');
});
test('ACT506 real historical signed manifest cannot be moved across tuples or become product authority',async()=>{
 const path=process.env.QA_LEGACY_ASSET_DIR;
 const bytes=await readFile(path+'/manifest.json');
 assert.equal(bytes.length,1912);assert.equal(sha(bytes),'c35ac62499ec12bb70eae806b50ea924536871f000dc05fc3f84d264d7646096');
 const m=JSON.parse(bytes);
 assert.equal(m.source.commit,base);assert.equal(manifestMatchesRelease(m,LEGACY_RELEASE_TUPLE),true);
 for(const other of RELEASE_TUPLES.slice(1)){
  assert.equal(manifestMatchesRelease(m,other),false);
  const relabeled={...m,source:{...m.source,repository:other.repository},delivery:releaseDelivery(other)};
  assert.equal(manifestMatchesRelease(relabeled,other),true); // vocabulary only, NOT signature
  assert.notEqual(sha(Buffer.from(JSON.stringify(relabeled))),sha(bytes));
  const pins={sourceHead:base,manifestSha256:sha(bytes),manifestSizeBytes:bytes.length,jsSha256:m.assets.js.sha256,jsSizeBytes:m.assets.js.sizeBytes,wasmSha256:m.assets.wasm.sha256,wasmSizeBytes:m.assets.wasm.sizeBytes};
  assert.notEqual(readonlyReleaseIdentityText({...other,pins}),readonlyReleaseIdentityText({...LEGACY_RELEASE_TUPLE,pins}));
 }
 assert.equal(t,LEGACY_RELEASE_TUPLE);
 globalThis.self={location:new URL('https://dreamwishwand.github.io/web/_app/test.js')};
 try{
  await assert.rejects(loadProtectedReadonlyRustWasm({repository:'DreamwishWand/site'}),/CALLER_AUTHORITY_DENIED/);
  await assert.rejects(loadProtectedReadonlyRustWasm(),/BUILD_ANCHOR_MISSING_OR_INVALID/);
 }finally{delete globalThis.self;}
 console.log('ACT506_HISTORICAL_BYTES_REPLAY_IDENTITY_AND_NULL_ANCHOR_PASS');
});
