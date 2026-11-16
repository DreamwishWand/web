import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {STEAM_BACKPACK_RELEASE as steam,SWITCH_BACKPACK_RELEASE as sw,placementPinsOk,placementManifestOk,placementAnchorShapeOk,placementIdentityText,validatePlacementAnchor,getSteamBackpackMountInfo,getSwitchBackpackMountInfo,loadProtectedSteamBackpackRustWasm,loadProtectedSwitchBackpackRustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSteamBackpackPort,createProductSwitchBackpackPort,productPlacementPortScope,placementReadyOk} from '../src/lib/dev/product-placement-client.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
import {COLLECTION_EXACT1_LOCALES} from '../src/lib/collection/collection-exact1-copy.mjs';
const h='a'.repeat(64),source='b'.repeat(40),hash=s=>createHash('sha256').update(s).digest('hex');
const pins=s=>({contract:s.prefix+'.pinned-digests@1',sourceHead:source,manifestSha256:h,manifestSizeBytes:10,jsSha256:h,jsSizeBytes:10,wasmSha256:h,wasmSizeBytes:10});
const manifest=s=>({contract:s.prefix+'.runtime@1',operation:s.operation,source:{repository:tuple.repository,commit:source,cargoTomlSha256:h,cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features:s.features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:10,sha256:h},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:10,sha256:h}},abi:{exportClass:'WorkerWasmSource',methods:s.methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}});
const anchor=s=>({contract:s.prefix+'.protected-release@1',...tuple,operation:s.operation,pins:pins(s),mode:'public-accepted',deliveryOrigin:tuple.origin,builds:[{platform:s.platform,buildId:s.buildId,productV2EvidenceSha256:h}],releaseId:h,attestationVerifiedAtBuild:true});
for(const [s,other] of [[steam,sw],[sw,steam]])test(s.operation+' fixed Build seal, dedicated exact Backpack feature and isolated release identity',async()=>{
 const p=pins(s),m=manifest(s),a=anchor(s);a.releaseId=hash(placementIdentityText(s,a));
 assert.deepEqual(s.features,[s===steam?'product-steam626-backpack-scoped':'product-switch626-backpack-scoped','worker-wasm']);assert.equal(s.methods.length,13);assert.equal(s.exports.length,22);assert.equal(s.methods.includes(other.methods.find(n=>n.startsWith('stage_'))),false);assert.equal(placementPinsOk(s,p),true);assert.equal(placementManifestOk(s,m,p),true);assert.equal(await validatePlacementAnchor(s,a),true);
 assert.equal(placementManifestOk(other,m,p),false);assert.equal(placementAnchorShapeOk(other,a),false);
 for(const patch of [{operation:other.operation},{source:{...m.source,features:['product-amount-scoped','worker-wasm']}},{source:{...m.source,features:['product-backpack-scoped','worker-wasm']}},{source:{...m.source,features:other.features}},{source:{...m.source,features:[s.features[0],other.features[0],'worker-wasm']}},{abi:{...m.abi,methods:[...s.methods,'stage_scoped_amount']}},{release:{...m.release,writerAuthorized:true}}])assert.equal(placementManifestOk(s,{...m,...patch},p),false);
 for(const patch of [{builds:anchor(other).builds},{builds:[...a.builds,...anchor(other).builds]},{builds:[{...a.builds[0],productV2EvidenceSha256:null}]},{attestationVerifiedAtBuild:false},{releaseId:h}])await assert.rejects(validatePlacementAnchor(s,{...a,...patch}));
 const scope={releaseId:a.releaseId,operation:s.operation,mode:a.mode,builds:a.builds},ready={kind:'SCOPED_PLACEMENT_RUNTIME_READY',...scope,writerAuthorized:false};
 assert.equal(placementReadyOk(ready,scope),true);assert.equal(placementReadyOk({...ready,operation:other.operation},scope),false);
});
test('Backpack both null anchors deny before Worker and eight localized labels are fixed',async()=>{
 let calls=0;const originals=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{Object.defineProperty(globalThis,'document',{configurable:true,value:{}});Object.defineProperty(globalThis,'location',{configurable:true,value:new URL(tuple.origin+tuple.basePath+steam.path)});Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});
  await assert.rejects(getSteamBackpackMountInfo());await assert.rejects(getSwitchBackpackMountInfo());await assert.rejects(createProductSteamBackpackPort());await assert.rejects(createProductSwitchBackpackPort());await assert.rejects(loadProtectedSteamBackpackRustWasm());await assert.rejects(loadProtectedSwitchBackpackRustWasm());assert.equal(calls,0);assert.equal(productPlacementPortScope({}),null);
 }finally{for(const [k,v] of Object.entries(originals)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
 for(const l of COLLECTION_EXACT1_LOCALES){const w=localPlacementCopy(l);assert.match(w.backpackSteamTitle,/Steam/);assert.match(w.backpackSwitchTitle,/Switch/);assert.match(w.backpackDetail,/1/);assert.match(w.backpackSafety,/30200001/);assert.ok(w.sourceSlot&&w.destinationSlot)}
});
