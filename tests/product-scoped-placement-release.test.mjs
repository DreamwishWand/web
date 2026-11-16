import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {COMP03_RELEASE as comp,VASE_ADD_RELEASE as vase,placementPinsOk,placementManifestOk,placementAnchorShapeOk,placementIdentityText,validatePlacementAnchor,placementDeliveryOk,getComp03MountInfo,getVaseAddMountInfo,loadProtectedComp03RustWasm,loadProtectedVaseAddRustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {createProductComp03Port,createProductVaseAddPort,productPlacementPortScope,placementReadyOk} from '../src/lib/dev/product-placement-client.mjs';
const h='a'.repeat(64),source='b'.repeat(40),hash=s=>createHash('sha256').update(s).digest('hex'),build={platform:'steam-windows',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',productV2EvidenceSha256:h};
const pins=s=>({contract:s.prefix+'.pinned-digests@1',sourceHead:source,manifestSha256:h,manifestSizeBytes:10,jsSha256:h,jsSizeBytes:10,wasmSha256:h,wasmSizeBytes:10});
const manifest=s=>({contract:s.prefix+'.runtime@1',operation:s.operation,source:{repository:tuple.repository,commit:source,cargoTomlSha256:h,cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features:s.features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:10,sha256:h},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:10,sha256:h}},abi:{exportClass:'WorkerWasmSource',methods:s.methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}});
const anchor=s=>({contract:s.prefix+'.protected-release@1',...tuple,operation:s.operation,pins:pins(s),mode:'public-accepted',deliveryOrigin:tuple.origin,builds:[build],releaseId:h,attestationVerifiedAtBuild:true});
for(const [s,other] of [[comp,vase],[vase,comp]])test(s.operation+' fixed manifest/anchor, wrong scope and unsigned deny',async()=>{
 const p=pins(s),m=manifest(s),a=anchor(s);a.releaseId=hash(placementIdentityText(s,a));
 assert.equal(s.methods.length,13);assert.equal(s.exports.length,22);assert.equal(placementPinsOk(s,p),true);assert.equal(placementManifestOk(s,m,p),true);assert.equal(await validatePlacementAnchor(s,a),true);
 assert.equal(placementManifestOk(other,m,p),false);assert.equal(placementAnchorShapeOk(other,a),false);
 for(const patch of [{operation:other.operation},{source:{...m.source,features:other.features}},{source:{...m.source,features:['product-amount-scoped','worker-wasm']}},{abi:{...m.abi,methods:[...s.methods,...other.methods]}},{release:{...m.release,writerAuthorized:true}}])assert.equal(placementManifestOk(s,{...m,...patch},p),false);
 for(const patch of [{builds:[{...build,platform:'switch'}]},{builds:[{...build,productV2EvidenceSha256:null}]},{attestationVerifiedAtBuild:false},{origin:'https://example.com'},{releaseId:h}])await assert.rejects(validatePlacementAnchor(s,{...a,...patch}));
 const pv={...a,mode:'private-product-v2',deliveryOrigin:'http://127.0.0.1:4188',builds:[{...build,productV2EvidenceSha256:null}]};pv.releaseId=hash(placementIdentityText(s,pv));assert.equal(await validatePlacementAnchor(s,pv),true);
 assert.equal(placementDeliveryOk(s,pv,new URL(pv.deliveryOrigin+tuple.basePath+s.path)),true);assert.equal(placementDeliveryOk(s,pv,new URL(tuple.origin+tuple.basePath+s.path)),false);
 const scope={releaseId:a.releaseId,operation:s.operation,mode:a.mode,builds:a.builds},ready={kind:'SCOPED_PLACEMENT_RUNTIME_READY',...scope,writerAuthorized:false};
 assert.equal(placementReadyOk(ready,scope),true);assert.equal(placementReadyOk({...ready,operation:other.operation},scope),false);assert.equal(placementReadyOk({...ready,writerAuthorized:true},scope),false);
});
test('both null anchors deny before Worker construction and no arbitrary port brand',async()=>{
 let calls=0;const originals=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{}});
  Object.defineProperty(globalThis,'location',{configurable:true,value:new URL(tuple.origin+tuple.basePath+comp.path)});
  Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});
  await assert.rejects(getComp03MountInfo());await assert.rejects(getVaseAddMountInfo());await assert.rejects(createProductComp03Port());await assert.rejects(createProductVaseAddPort());await assert.rejects(loadProtectedComp03RustWasm());await assert.rejects(loadProtectedVaseAddRustWasm());assert.equal(calls,0);assert.equal(productPlacementPortScope({}),null);
 }finally{for(const [k,v] of Object.entries(originals)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
});
