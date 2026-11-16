import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {SCOPED_STEAM_CHEST_RELEASE_OP as op,SCOPED_STEAM_CHEST_FEATURES as features,SCOPED_STEAM_CHEST_METHODS as methods,SCOPED_STEAM_CHEST_WASM_EXPORTS as exports,validateScopedSteamChestAnchor} from '../src/lib/ddv/core/save/product-scoped-steam-chest-release.mjs';
import {inspectScopedSteamChestSubjects,privateScopedSteamChestIdentity} from '../scripts/readonly-release/seal-scoped-steam-chest-private.mjs';
const source='a'.repeat(40),sha=b=>createHash('sha256').update(b).digest('hex');
const u=n=>{const a=[];do{let v=n&127;n>>>=7;a.push(v|(n?128:0))}while(n);return a};
const str=s=>[...u(Buffer.byteLength(s)),...Buffer.from(s)],sec=(id,b)=>[id,...u(b.length),...b];
function wasm(names=exports){
 const e=names.flatMap(n=>[...str(n),n==='memory'?2:n==='__wbindgen_externrefs'?1:0,0]);
 return Buffer.from([0,97,115,109,1,0,0,0,...sec(1,[1,96,0,0]),...sec(3,[1,0]),...sec(4,[1,111,0,1]),...sec(5,[1,0,1]),...sec(7,[...u(names.length),...e]),...sec(10,[1,2,0,11])]);
}
function bytes(w=wasm(),js=Buffer.from('export default function(){}'),patch={}){
 const m={contract:'wand.scoped-steam-chest.runtime@1',operation:op,source:{repository:tuple.repository,commit:source,cargoTomlSha256:'b'.repeat(64),cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:js.length,sha256:sha(js)},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:w.length,sha256:sha(w)}},abi:{exportClass:'WorkerWasmSource',methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false},...patch};
 return [Buffer.from(JSON.stringify(m)),js,w];
}
test('Steam Chest proof exact subjects, legacy six aliases only and private fixed Steam build',async()=>{
 const b=bytes(),p=inspectScopedSteamChestSubjects(b,source);
 assert.equal(p.wasmSha256,sha(b[2]));assert.equal(p.jsSha256,sha(b[1]));
 assert.equal(exports.length,23);assert.equal(methods.length,14);
 for(const n of ['preview_switch626_chest','stage_switch626_catalog0','stage_fixed_collection','stage_steam626_vase_add','toggle_scoped_edit']){
  assert.throws(()=>inspectScopedSteamChestSubjects(bytes(wasm([...exports,'workerwasmsource_'+n])),source));
  assert.throws(()=>inspectScopedSteamChestSubjects(bytes(wasm(),Buffer.from(n)),source));
 }
 assert.throws(()=>inspectScopedSteamChestSubjects(bytes(wasm(),undefined,{operation:'switch626.chest.exact1'}),source));
 assert.throws(()=>inspectScopedSteamChestSubjects(b,'c'.repeat(40)));
 const a=privateScopedSteamChestIdentity(p,'http://127.0.0.1:4188',['steam-windows']);assert.equal(await validateScopedSteamChestAnchor(a),true);
 assert.equal(a.builds[0].productV2EvidenceSha256,null);
 for(const scope of [['switch'],['steam-windows','switch'],[]])assert.throws(()=>privateScopedSteamChestIdentity(p,'http://127.0.0.1:4188',scope));
 assert.throws(()=>privateScopedSteamChestIdentity(p,tuple.origin,['steam-windows']));
});
