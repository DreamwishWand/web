import test from 'node:test';
import assert from 'node:assert/strict';
import {COMP03_RELEASE as legacy,COMP03_SPATIAL_RELEASE as spatial,VASE_ADD_RELEASE as vase,placementPinsOk,getComp03SpatialMountInfo,loadProtectedComp03SpatialRustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {createProductComp03SpatialPort,placementReadyOk,productPlacementPortScope} from '../src/lib/dev/product-placement-client.mjs';
import {createLocalComp03DevPort,createLocalComp03SpatialDevPort,installLocalComp03DevWorker,installLocalComp03SpatialDevWorker} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {createProductSteam626Comp03LocalAdapter,createProductSteam626Comp03SpatialLocalAdapter,createProductSteam626VaseAddLocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
test('explicit spatial identity adds exactly one method/export; legacy and Vase remain distinct',()=>{
 assert.equal(spatial.key,'steam626-comp03-spatial');assert.equal(spatial.prefix,'wand.scoped-steam626-comp03-spatial');assert.equal(spatial.assetDir,'worker-wasm-scoped-steam626-comp03-spatial');assert.equal(spatial.operation,legacy.operation);assert.notEqual(spatial.prefix,legacy.prefix);assert.notEqual(spatial.assetDir,legacy.assetDir);
 assert.deepEqual(spatial.features,['product-steam626-comp03-spatial-preview','worker-wasm']);assert.equal(spatial.methods.length,14);assert.equal(spatial.exports.length,23);
 assert.deepEqual(spatial.methods.filter(m=>m!=='preview_steam626_comp03_spatial'),legacy.methods);
 assert.deepEqual(spatial.exports.filter(m=>m!=='workerwasmsource_preview_steam626_comp03_spatial'),legacy.exports);
 const p={contract:spatial.prefix+'.pinned-digests@1',sourceHead:'a'.repeat(40),manifestSha256:'a'.repeat(64),manifestSizeBytes:1,jsSha256:'a'.repeat(64),jsSizeBytes:1,wasmSha256:'a'.repeat(64),wasmSizeBytes:1};
 assert.equal(placementPinsOk(spatial,p),true);assert.equal(placementPinsOk(legacy,p),false);assert.equal(placementPinsOk(vase,p),false);
});
test('optional ready handshake requires explicit true; legacy denies extra capability',()=>{
 const scope={releaseId:'a'.repeat(64),operation:spatial.operation,mode:'private-product-v2',builds:[]};
 const ready={kind:'SCOPED_PLACEMENT_RUNTIME_READY',...scope,writerAuthorized:false};
 assert.equal(placementReadyOk(ready,scope),true);assert.equal(placementReadyOk(ready,{...scope,spatialPreviewEnabled:true}),false);
 assert.equal(placementReadyOk({...ready,spatialPreviewEnabled:true},{...scope,spatialPreviewEnabled:true}),true);
 assert.equal(placementReadyOk({...ready,spatialPreviewEnabled:false},{...scope,spatialPreviewEnabled:true}),false);
 assert.equal(placementReadyOk({...ready,spatialPreviewEnabled:true},scope),false);
 assert.equal(productPlacementPortScope({spatialPreviewEnabled:true}),null);
});
test('null optional anchor denies before Worker construction',async()=>{
 let calls=0;const old=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{Object.defineProperty(globalThis,'document',{configurable:true,value:{}});Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://example.invalid/web/editor/world/comp03/roundtrip')});Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});await assert.rejects(getComp03SpatialMountInfo());await assert.rejects(createProductComp03SpatialPort());await assert.rejects(loadProtectedComp03SpatialRustWasm());assert.equal(calls,0)}
 finally{for(const [k,v] of Object.entries(old)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
});
test('optional fixed RPC exposes only zero-arg spatial; legacy does not dispatch it',async()=>{
 let calls=0;const server={},worker={terminate(){}};server.postMessage=data=>queueMicrotask(()=>worker.onmessage({data:structuredClone(data)}));worker.postMessage=data=>queueMicrotask(()=>server.onmessage({data}));
 const adapter={spatialPreview(){calls++;return {kind:'safe'}},previewPlacement(a){return a}};
 installLocalComp03SpatialDevWorker(server,adapter);const p=createLocalComp03SpatialDevPort(worker);assert.deepEqual(await p.spatialPreview(),{kind:'safe'});await assert.rejects(p.spatialPreview(1));assert.deepEqual(await p.previewPlacement({seedId:1}),{seedId:1});assert.equal(calls,1);p.dispose();
 let replies=[];const raw={postMessage:r=>replies.push(r)};installLocalComp03DevWorker(raw,adapter);await raw.onmessage({data:{id:1,method:'spatialPreview',args:[]}});assert.equal(replies[0].ok,false);assert.equal(calls,1);
 assert.equal(createLocalComp03DevPort({terminate(){},postMessage(){}}).spatialPreview,undefined);
});
test('optional owner and adapter are explicit and phase-gated',async()=>{
 const wasmFactory=async()=>{throw Error('must not open')};
 for(const mode of ['comp03','vase'])assert.equal(createProductWasmReadOwner(wasmFactory,{placementScope:mode}).spatialPreview,undefined);
 const o=createProductWasmReadOwner(wasmFactory,{placementScope:'comp03-spatial'});assert.equal(typeof o.spatialPreview,'function');assert.throws(()=>o.spatialPreview());assert.throws(()=>o.spatialPreview(1));assert.throws(()=>createProductWasmReadOwner(wasmFactory,{placementScope:'comp03-spatial',backpackScope:'steam'}));
 const opts={wasmFactory};assert.equal(createProductSteam626Comp03LocalAdapter(opts).spatialPreview,undefined);assert.equal(createProductSteam626VaseAddLocalAdapter(opts).spatialPreview,undefined);
 const a=createProductSteam626Comp03SpatialLocalAdapter(opts);assert.equal(typeof a.spatialPreview,'function');assert.throws(()=>a.spatialPreview());assert.throws(()=>a.spatialPreview(1));
});
