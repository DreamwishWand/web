import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductSteam626Catalog0LocalAdapter,createProductSwitch626Catalog0LocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {createSteam626Catalog0Transport} from '../src/lib/ddv/core/save/product-scoped-amount-transport.mjs';
const source=async()=>({WorkerWasmSource:class {}});
test('Steam Catalog0 blocks untrusted profile and caller target discovery',()=>{
 for(const o of [{wasmFactory:source,allowCoreDiscoverySource:false},{wasmFactory:source,coreDiscoveryProfile:'linked-crop-chest48'},{wasmFactory:source,discoverScopedTargets:()=>[]}])
  assert.throws(()=>createProductSteam626Catalog0LocalAdapter(o),/DENIED/);
 const api=createProductSteam626Catalog0LocalAdapter({wasmFactory:source});
 assert.equal(Object.isFrozen(api),true);
 for(const n of ['open','backupOriginal','listVerifiedTargets','stageTyped','undo','redo','exportEditedCopy','downloadVerifiedCopy','close'])assert.equal(typeof api[n],'function',n);
 assert.equal(typeof api.originalOverwrite,'undefined');
 assert.equal(typeof api.setRights,'undefined');
});
test('Rust Owner rejects cross-domain Catalog0 flags and nonboolean permissions',()=>{
 for(const x of [{allowSwitch626Catalog0Source:true},{allowSteam626ChestSource:true},{allowScopedAmountSource:true},{allowScopedCollectionSource:true},{allowCollectionCandidateSource:true}])
  assert.throws(()=>createProductWasmReadOwner(source,{allowSteam626Catalog0Source:true,...x}),/PRODUCT_WORKER_SCOPED_SOURCE_CONFLICT/);
 assert.throws(()=>createProductWasmReadOwner(source,{allowSteam626Catalog0Source:'true'}),/PRODUCT_WORKER_SCOPED_SOURCE_CONFLICT/);
 const own=createProductWasmReadOwner(source,{allowSteam626Catalog0Source:true});
 assert.equal(typeof own.openDecoded,'function');assert.equal(typeof own.discoverScopedTargets,'function');
 assert.equal(typeof own.stageScopedAmount,'function');own.close();
});
test('Steam Catalog0 transport rejects Switch Build, forged session, missing Rust ABI',()=>{
 const build={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626};
 const r={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:'2'.repeat(32),decodedSha256:'1'.repeat(64),revision:0,indexGeneration:1,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
 for(const b of [{...build,platform:'switch'},{...build,buildKind:'switch-bid'},{...build,buildId:'9A239D3DB569756D'},{...build,schema:624}])
  assert.throws(()=>createSteam626Catalog0Transport({},r,b,{}),/DENIED/);
 for(const bad of [{...r,writerAuthorized:true},{...r,revision:1},{...r,decodedSha256:'bad'},{...r,productWorkerBound:false}])
  assert.throws(()=>createSteam626Catalog0Transport({},bad,build,{}),/DENIED/);
 assert.throws(()=>createSteam626Catalog0Transport({},r,build,{}),/DENIED/);
});
test('Switch Catalog0 fixed ItemID constructor remains independent',()=>{
 const x=createProductSwitch626Catalog0LocalAdapter({wasmFactory:source});
 assert.equal(typeof x.listVerifiedTargets,'function');
 assert.notEqual(createProductSwitch626Catalog0LocalAdapter,createProductSteam626Catalog0LocalAdapter);
});
