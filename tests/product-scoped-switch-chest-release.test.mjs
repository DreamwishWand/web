import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProductSwitchChestPort,productSwitchChestPortScope,scopedSwitchChestReadyOk} from '../src/lib/dev/product-switch-chest-client.mjs';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {SCOPED_SWITCH_CHEST_RELEASE_OP as op,SCOPED_SWITCH_CHEST_FEATURES as features,SCOPED_SWITCH_CHEST_METHODS as methods,
 scopedSwitchChestManifestOk,scopedSwitchChestAnchorShapeOk,scopedSwitchChestReleaseIdentityText,validateScopedSwitchChestAnchor,scopedSwitchChestDeliveryOk,getScopedSwitchChestMountInfo,loadProtectedScopedSwitchChestRustWasm} from '../src/lib/ddv/core/save/product-scoped-switch-chest-release.mjs';
const h='a'.repeat(64),source='b'.repeat(40),hash=x=>createHash('sha256').update(x).digest('hex');
const pins={contract:'wand.scoped-switch-chest.pinned-digests@1',sourceHead:source,manifestSha256:h,manifestSizeBytes:10,jsSha256:h,jsSizeBytes:10,wasmSha256:h,wasmSizeBytes:10};
const manifest={contract:'wand.scoped-switch-chest.runtime@1',operation:op,source:{repository:tuple.repository,commit:source,cargoTomlSha256:h,cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test-only)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:10,sha256:h},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:10,sha256:h}},abi:{exportClass:'WorkerWasmSource',methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}};
const build={platform:'switch',buildId:'9A239D3DB569756D',productV2EvidenceSha256:h};
const anchor={contract:'wand.scoped-switch-chest.protected-release@1',...tuple,operation:op,pins,mode:'public-accepted',deliveryOrigin:tuple.origin,builds:[build],releaseId:h,attestationVerifiedAtBuild:true};
test('scoped release manifest fixed exact opt-in feature and ABI, no self authority',()=>{
 assert.equal(scopedSwitchChestManifestOk(manifest,pins),true);
 for(const p of [
  {...manifest,operation:'amount'}, {...manifest,extra:true}, {...manifest,source:{...manifest.source,features:['indexed-read','worker-wasm']}},
  {...manifest,source:{...manifest.source,features:[...features,'product-amount-scoped']}},
  {...manifest,source:{...manifest.source,cargoLockSha256:h}}, {...manifest,source:{...manifest.source,defaultFeatures:true}},
  {...manifest,abi:{...manifest.abi,methods:[...methods,'stage_scoped_amount']}},
  {...manifest,abi:{...manifest.abi,writerAuthorized:true}},
  {...manifest,release:{...manifest.release,productConsumerEnabled:true}}, {...manifest,assets:{...manifest.assets,js:{...manifest.assets.js,path:'../other.js'}}}
 ])assert.equal(scopedSwitchChestManifestOk(p,pins),false);
 assert.equal(scopedSwitchChestManifestOk(manifest,{...pins,sourceHead:'c'.repeat(40)}),false);
});
test('scoped anchor requires exact build-specific V2 receipt digest and bound release identity; null default fails closed',async()=>{
 assert.equal(scopedSwitchChestAnchorShapeOk(anchor),true);
 const a={...anchor,releaseId:hash(scopedSwitchChestReleaseIdentityText(anchor))};assert.equal(await validateScopedSwitchChestAnchor(a),true);
 for(const p of [null,{...a,builds:[]},{...a,builds:[build,build]},
  {...a,builds:[{...build,buildId:'unknown'}]},{...a,builds:[{...build,productV2EvidenceSha256:'unknown'}]},
  {...a,builds:[{...build,productV2EvidenceSha256:'c'.repeat(64)}]},
  {...a,operation:'amount'},{...a,attestationVerifiedAtBuild:false},{...a,origin:'https://example.org'}, {...a,releaseId:h}])await assert.rejects(validateScopedSwitchChestAnchor(p));
 await assert.rejects(loadProtectedScopedSwitchChestRustWasm({pins}));await assert.rejects(loadProtectedScopedSwitchChestRustWasm());
});

test('private V2 seal is loopback-only, no public grant, and cannot assert prior V2 evidence',async()=>{
 const p={...anchor,mode:'private-product-v2',deliveryOrigin:'http://127.0.0.1:4188',
  builds:[{...build,productV2EvidenceSha256:null}]};
 p.releaseId=hash(scopedSwitchChestReleaseIdentityText(p));assert.equal(await validateScopedSwitchChestAnchor(p),true);
 assert.equal(scopedSwitchChestDeliveryOk(p,new URL(p.deliveryOrigin+tuple.basePath+'/editor/chest/')),true);
 assert.equal(scopedSwitchChestDeliveryOk(p,new URL(tuple.origin+tuple.basePath+'/editor/chest/')),false);
 assert.equal(scopedSwitchChestDeliveryOk(anchor,new URL('http://127.0.0.1:4188'+tuple.basePath+'/editor/chest/')),false);
 for(const patch of [{deliveryOrigin:'http://localhost:4188'},{deliveryOrigin:'https://example.org'},
  {deliveryOrigin:'http://127.0.0.1:4188/path'},{deliveryOrigin:'http://127.0.0.1:65536'},
  {deliveryOrigin:'http://127.0.0.1:80'},{mode:'public-accepted'},{builds:[build]}])
  await assert.rejects(validateScopedSwitchChestAnchor({...p,...patch}));
 await assert.rejects(getScopedSwitchChestMountInfo());
});


test('Switch-only seal rejects mixed Amount/Collection exports and foreign Build; null anchor creates no Worker',async()=>{
 assert.deepEqual(features,['product-switch626-chest-scoped','worker-wasm']);
 assert.ok(methods.includes('discover_switch626_chest'));assert.ok(methods.includes('toggle_scoped_edit'));
 assert.equal(methods.some(n=>n.includes('scoped_amount')||n.includes('collection')),false);
 for(const b of [{...build,platform:'steam-windows'},{...build,buildId:'624'},{...build,productV2EvidenceSha256:null}])assert.equal(scopedSwitchChestAnchorShapeOk({...anchor,builds:[b]}),false);
 const scope={releaseId:h,operation:op,mode:'private-product-v2',builds:[{...build,productV2EvidenceSha256:null}]};
 const ready={kind:'SCOPED_SWITCH_CHEST_RUNTIME_READY',...scope,writerAuthorized:false};
 assert.equal(scopedSwitchChestReadyOk(ready,scope),true);
 for(const patch of [{operation:'collection.fixed-exact1'},{releaseId:'c'.repeat(64)},{mode:'public-accepted'},{writerAuthorized:true},{builds:[build]}])assert.equal(scopedSwitchChestReadyOk({...ready,...patch},scope),false);
 assert.equal(productSwitchChestPortScope({}),null);
 let workers=0;const originals=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{}});
  Object.defineProperty(globalThis,'location',{configurable:true,value:new URL(tuple.origin+tuple.basePath+'/editor/chest/')});
  Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){workers++}}});
  await assert.rejects(createProductSwitchChestPort());assert.equal(workers,0);
 }finally{for(const [k,v] of Object.entries(originals)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
});

import {SCOPED_SWITCH_CHEST_WASM_EXPORTS as sr03ForeignProofOwnExports} from '../src/lib/ddv/core/save/product-scoped-switch-chest-release.mjs';
import {inspectScopedSwitchChestSubjects as inspectSr03ForeignSwitchChestSubjects} from '../scripts/readonly-release/seal-scoped-switch-chest-private.mjs';
test('SR03 foreign symbols rejected with valid own WASM and rebound manifest',()=>{
 const u=n=>{const a=[];do{const v=n&127;n>>>=7;a.push(v|(n?128:0))}while(n);return a};
 const str=s=>[...u(Buffer.byteLength(s)),...Buffer.from(s)],sec=(id,b)=>[id,...u(b.length),...b];
 const wasm=names=>{const e=names.flatMap(n=>[...str(n),n==='memory'?2:n==='__wbindgen_externrefs'?1:0,0]);return Buffer.from([0,97,115,109,1,0,0,0,...sec(1,[1,96,0,0]),...sec(3,[1,0]),...sec(4,[1,111,0,1]),...sec(5,[1,0,1]),...sec(7,[...u(names.length),...e]),...sec(10,[1,2,0,11])])};
 const subject=(js,w)=>[Buffer.from(JSON.stringify({...manifest,assets:{js:{path:'ddv_save_core.js',sizeBytes:js.length,sha256:hash(js)},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:w.length,sha256:hash(w)}}})),js,w];
 const clean=Buffer.from('export default function(){}'),own=wasm(sr03ForeignProofOwnExports);
 assert.equal(inspectSr03ForeignSwitchChestSubjects(subject(clean,own),source).wasmSha256,hash(own));
 for(const n of ['preview_steam626_sr03','stage_steam626_sr03']){
  assert.throws(()=>inspectSr03ForeignSwitchChestSubjects(subject(Buffer.from(n),own),source));
  assert.throws(()=>inspectSr03ForeignSwitchChestSubjects(subject(clean,wasm([...sr03ForeignProofOwnExports,'workerwasmsource_'+n])),source));
 }
});
