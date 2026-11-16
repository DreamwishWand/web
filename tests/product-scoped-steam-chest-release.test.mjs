import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {SCOPED_STEAM_CHEST_RELEASE_OP as op,SCOPED_STEAM_CHEST_FEATURES as features,SCOPED_STEAM_CHEST_METHODS as methods,SCOPED_STEAM_CHEST_WASM_EXPORTS as exports,scopedSteamChestManifestOk,scopedSteamChestAnchorShapeOk,scopedSteamChestReleaseIdentityText,validateScopedSteamChestAnchor,getScopedSteamChestMountInfo,loadProtectedScopedSteamChestRustWasm} from '../src/lib/ddv/core/save/product-scoped-steam-chest-release.mjs';
import {createProductSteamChestPort,productSteamChestPortScope,scopedSteamChestReadyOk} from '../src/lib/dev/product-steam-chest-client.mjs';
import {localAmountCopy,DEV_AMOUNT_UI_LOCALES} from '../src/lib/dev/local-amount-copy.mjs';
const h='a'.repeat(64),source='b'.repeat(40),build={platform:'steam-windows',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',productV2EvidenceSha256:h};
const pins={contract:'wand.scoped-steam-chest.pinned-digests@1',sourceHead:source,manifestSha256:h,manifestSizeBytes:10,jsSha256:h,jsSizeBytes:10,wasmSha256:h,wasmSizeBytes:10};
const m={contract:'wand.scoped-steam-chest.runtime@1',operation:op,source:{repository:tuple.repository,commit:source,cargoTomlSha256:h,cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:10,sha256:h},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:10,sha256:h}},abi:{exportClass:'WorkerWasmSource',methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}};
test('Steam Chest manifest and release are fixed exact1 and distinct from Switch / generic Amount',async()=>{
 assert.equal(methods.length,14);assert.equal(exports.length,23);assert.equal(scopedSteamChestManifestOk(m,pins),true);
 for(const patch of [{operation:'switch626.chest.exact1'},{source:{...m.source,features:['product-amount-scoped','worker-wasm']}},{abi:{...m.abi,methods:[...methods,'preview_switch626_chest']}},{release:{...m.release,writerAuthorized:true}}])assert.equal(scopedSteamChestManifestOk({...m,...patch},pins),false);
 const a={contract:'wand.scoped-steam-chest.protected-release@1',...tuple,operation:op,pins,mode:'public-accepted',deliveryOrigin:tuple.origin,builds:[build],releaseId:h,attestationVerifiedAtBuild:true};
 a.releaseId=createHash('sha256').update(scopedSteamChestReleaseIdentityText(a)).digest('hex');assert.equal(await validateScopedSteamChestAnchor(a),true);
 assert.equal(scopedSteamChestAnchorShapeOk({...a,builds:[{...build,platform:'switch'}]}),false);
 const s={releaseId:a.releaseId,operation:op,mode:a.mode,builds:a.builds},r={kind:'SCOPED_STEAM_CHEST_RUNTIME_READY',...s,writerAuthorized:false};assert.equal(scopedSteamChestReadyOk(r,s),true);assert.equal(scopedSteamChestReadyOk({...r,operation:'switch626.chest.exact1'},s),false);
});
test('Steam Chest null anchor denies before Worker; all eight locale product copy fixed to Steam',async()=>{
 let calls=0;const orig=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{Object.defineProperty(globalThis,'document',{configurable:true,value:{}});Object.defineProperty(globalThis,'location',{configurable:true,value:new URL(tuple.origin+tuple.basePath+'/editor/chest/steam/')});Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});await assert.rejects(getScopedSteamChestMountInfo());await assert.rejects(createProductSteamChestPort());await assert.rejects(loadProtectedScopedSteamChestRustWasm());assert.equal(calls,0);assert.equal(productSteamChestPortScope({}),null)}finally{for(const [k,v] of Object.entries(orig)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
 for(const l of DEV_AMOUNT_UI_LOCALES){const w=localAmountCopy(l,false,'public-accepted',true);assert.match(w.title,/Steam/);assert.doesNotMatch(w.title,/Switch|DEV/);assert.match(w.intro,/50\s*→\s*49/);assert.ok(w.confirm)}
});
