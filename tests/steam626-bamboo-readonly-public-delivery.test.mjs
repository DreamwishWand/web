import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 BAMBOO_FEATURES,BAMBOO_METHODS,BAMBOO_BUILD,BAMBOO_READONLY_OPERATION,
 BAMBOO_READONLY_ASSET_DIR,bambooReadPinsOk,bambooReadManifestOk,
 bambooReadAnchorOk,validateBambooReadAnchor,bambooReadDeliveryOk,loadProtectedBambooReadonlyWorker
} from '../src/lib/ddv/core/save/product-steam626-bamboo-readonly-release.mjs';
import {PROTECTED_BAMBOO40700007_READONLY_ANCHOR} from '../src/lib/ddv/core/save/product-steam626-bamboo-readonly-anchor.mjs';
import {ACTIVE_RELEASE_TUPLE} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
const h40='a'.repeat(40),h64='b'.repeat(64);
const pins={
 contract:'wand.bamboo40700007.pinned-digests@1',sourceHead:h40,
 manifestSha256:h64,manifestSizeBytes:1400,jsSha256:h64,jsSizeBytes:18207,
 wasmSha256:h64,wasmSizeBytes:436008
};
const manifest={
 contract:'wand.bamboo40700007.public-readonly-candidate@1',
 operation:BAMBOO_READONLY_OPERATION,
 source:{repository:ACTIVE_RELEASE_TUPLE.repository,commit:h40,buildId:BAMBOO_BUILD,
  platform:'SteamWindows',schema:626,cargoTomlGitBlob:'e4f2e2c5d4451baba2dea699fe497cb7b40668d4',
  cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',
  cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',
  profile:'release',features:BAMBOO_FEATURES,defaultFeatures:false,toolchain:'rustc 1.99.1 (test)'},
 assets:{js:{path:'ddv_save_core.js',sizeBytes:pins.jsSizeBytes,sha256:pins.jsSha256},
  wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:pins.wasmSizeBytes,sha256:pins.wasmSha256}},
 abi:{exportClass:'WorkerWasmSource',methods:BAMBOO_METHODS,itemId:40700007,
  platform:'SteamWindows',schema:626,buildId:BAMBOO_BUILD,readOnly:true,
  writerAuthorized:false,stageAuthorized:false,originalOverwriteAuthorized:false},
 release:{candidateOnly:true,productConsumerEnabled:false,writerAuthorized:false,
  stageAuthorized:false,editedCopyAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}
};
const clone=()=>structuredClone(manifest);
test('exact Bamboo only and default unsigned anchor denies',async()=>{
 assert.equal(BAMBOO_READONLY_ASSET_DIR,'worker-wasm-steam626-bamboo-readonly');
 assert.equal(BAMBOO_FEATURES.includes('semantic-writer-dev'),false);
 assert.equal(BAMBOO_METHODS.includes('read_steam626_bamboo_single_target'),true);
 assert.equal(bambooReadPinsOk(pins),true);
 assert.equal(bambooReadManifestOk(manifest,pins),true);
 assert.equal(PROTECTED_BAMBOO40700007_READONLY_ANCHOR,null);
 assert.equal(bambooReadAnchorOk(null),false);
 await assert.rejects(validateBambooReadAnchor(null),/BAMBOO40700007_READONLY_DELIVERY_DENIED/);
 await assert.rejects(loadProtectedBambooReadonlyWorker(),/BAMBOO40700007_READONLY_DELIVERY_DENIED/);
});
test('28 scope/rights/build/source/unknown field substitutions are denied',()=>{
 const edits=[
  m=>m.contract='foreign',m=>m.operation='steam626.other',
  m=>m.source.repository='foreign/repo',m=>m.source.commit='0'.repeat(40),
  m=>m.source.buildId='9A239D3DB569756D',m=>m.source.platform='Switch',
  m=>m.source.schema=624,m=>m.source.cargoTomlGitBlob='0'.repeat(40),
  m=>m.source.cargoLockSha256='0'.repeat(64),m=>m.source.cargoLockOrigin='unreviewed',
  m=>m.source.wasmBindgen='0.2.106',m=>m.source.wasmTarget='x86_64-unknown-linux-gnu',
  m=>m.source.profile='dev',m=>m.source.defaultFeatures=true,
  m=>m.source.features=['indexed-read','worker-wasm'],
  m=>m.source.features.push('semantic-writer-dev'),
  m=>m.assets.js.path='evil.js',m=>m.assets.js.sha256='0'.repeat(64),
  m=>m.assets.wasm.sizeBytes++,m=>m.abi.itemId=40700006,
  m=>m.abi.methods=['stage_steam626_bamboo'],m=>m.abi.readOnly=false,
  m=>m.abi.writerAuthorized=true,m=>m.abi.stageAuthorized=true,
  m=>m.release.candidateOnly=false,m=>m.release.productConsumerEnabled=true,
  m=>m.release.writerAuthorized=true,m=>m.release.editedCopyAuthorized=true,
  m=>m.release.originalOverwriteAuthorized=true
 ];
 for(const change of edits){const m=clone();change(m);assert.equal(bambooReadManifestOk(m,pins),false)}
 const foreign=clone();foreign.unknownAuthorizer=true;
 assert.equal(bambooReadManifestOk(foreign,pins),false);
 const wrong=structuredClone(pins);wrong.sourceHead='c'.repeat(40);
 assert.equal(bambooReadManifestOk(manifest,wrong),false);
 wrong.sourceHead=h40;wrong.jsSha256='z'.repeat(64);
 assert.equal(bambooReadManifestOk(manifest,wrong),false);
});
test('anchor fields, issuer, mode, source, and protocol must all match',async()=>{
 const fake={contract:'wand.bamboo40700007.protected-readonly-release@1',
  ...ACTIVE_RELEASE_TUPLE,operation:BAMBOO_READONLY_OPERATION,pins,
  mode:'public-accepted',buildId:BAMBOO_BUILD,releaseId:h64,
  attestationVerifiedAtBuild:true,readOnlyOperationAuthorized:true};
 assert.equal(bambooReadAnchorOk(fake),true);
 assert.equal(bambooReadDeliveryOk(fake,{origin:fake.origin,protocol:'https:',pathname:fake.basePath+'/editor'}),true);
 assert.equal(bambooReadDeliveryOk(fake,{origin:fake.origin,protocol:'http:',pathname:fake.basePath+'/editor'}),false);
 assert.equal(bambooReadDeliveryOk(fake,{origin:'https://evil.example',protocol:'https:',pathname:fake.basePath+'/editor'}),false);
 assert.equal(bambooReadDeliveryOk({...fake,mode:'private-product-v2'},{origin:fake.origin,protocol:'https:',pathname:'/web/editor'}),false);
 await assert.rejects(validateBambooReadAnchor(fake),/BAMBOO40700007_READONLY_DELIVERY_DENIED/);
 for(const [key,val] of [['mode','proof-only'],['readOnlyOperationAuthorized',false],['attestationVerifiedAtBuild',false],['buildId','Switch626'],['sourceRef','refs/heads/dev'],['signerWorkflow','foreign/workflow']]){
  assert.equal(bambooReadAnchorOk({...fake,[key]:val}),false,key);
 }
});
