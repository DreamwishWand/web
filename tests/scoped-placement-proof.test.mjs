import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {COMP03_RELEASE as comp,COMP03_SPATIAL_RELEASE as spatial,VASE_ADD_RELEASE as vase,SWITCH_VASE_ADD_RELEASE as switchVase,validatePlacementAnchor} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {fixedPlacementProofScope,inspectPlacementSubjects,privatePlacementIdentity,replacePrivatePlacementAnchor} from '../scripts/readonly-release/scoped-placement-proof.mjs';
const source='a'.repeat(40),sha=b=>createHash('sha256').update(b).digest('hex');
const u=n=>{const a=[];do{let v=n&127;n>>>=7;a.push(v|(n?128:0))}while(n);return a};
const str=s=>[...u(Buffer.byteLength(s)),...Buffer.from(s)],sec=(id,b)=>[id,...u(b.length),...b];
function wasm(s,extra=false){
 const es=[...s.exports,...(extra?['workerwasmsource_stage_extra']:[])];
 const exports=es.flatMap(n=>[...str(n),n==='memory'?2:n==='__wbindgen_externrefs'?1:0,0]);
 return Buffer.from([0,97,115,109,1,0,0,0,...sec(1,[1,96,0,0]),...sec(3,[1,0]),...sec(4,[1,111,0,1]),...sec(5,[1,0,1]),...sec(7,[...u(es.length),...exports]),...sec(10,[1,2,0,11])]);
}
function subject(s,w=wasm(s),js=Buffer.from('export default function(){}'),patch={}){
 const m={contract:s.prefix+'.runtime@1',operation:s.operation,source:{repository:tuple.repository,commit:source,cargoTomlSha256:'b'.repeat(64),cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features:s.features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:js.length,sha256:sha(js)},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:w.length,sha256:sha(w)}},abi:{exportClass:'WorkerWasmSource',methods:s.methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false},...patch};
 return [Buffer.from(JSON.stringify(m)),js,w];
}
for(const [s,o] of [[comp,vase],[vase,comp]])test(s.key+' fixed three subject inspection and private anchor only',async()=>{
 assert.equal(fixedPlacementProofScope(s.key),s);
 const bytes=subject(s),p=inspectPlacementSubjects(s,bytes,source);
 assert.equal(p.jsSha256,sha(bytes[1]));assert.equal(p.wasmSha256,sha(bytes[2]));
 assert.throws(()=>inspectPlacementSubjects(o,bytes,source));
 assert.throws(()=>inspectPlacementSubjects(s,subject(s,wasm(o)),source));
 assert.throws(()=>inspectPlacementSubjects(s,subject(s,wasm(s,true)),source));
 assert.throws(()=>inspectPlacementSubjects(s,subject(s,wasm(s),Buffer.from(o.methods.find(n=>n.startsWith('stage_')))),source));
 assert.throws(()=>inspectPlacementSubjects(s,subject(s,wasm(s),undefined,{operation:o.operation}),source));
 assert.throws(()=>inspectPlacementSubjects(s,bytes,'c'.repeat(40)));
 const a=privatePlacementIdentity(s,p,'http://127.0.0.1:4188');assert.equal(await validatePlacementAnchor(s,a),true);
 assert.equal(a.builds[0].productV2EvidenceSha256,null);assert.throws(()=>privatePlacementIdentity(s,p,tuple.origin));
 const prior=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-placement-release-anchor.mjs',import.meta.url),'utf8');
 const out=replacePrivatePlacementAnchor(s,prior,a);
 assert.ok(out.includes('export const '+(s===comp?'PROTECTED_VASE_ADD_RELEASE_ANCHOR':'PROTECTED_COMP03_RELEASE_ANCHOR')+'=null;'));
 assert.throws(()=>replacePrivatePlacementAnchor(o,out,privatePlacementIdentity(o,inspectPlacementSubjects(o,subject(o),source),'http://127.0.0.1:4188')));
 assert.throws(()=>replacePrivatePlacementAnchor(s,prior,{...a,mode:'public-accepted'}));
});
test('unknown operation is never a selectable proof scope',()=>assert.throws(()=>fixedPlacementProofScope('steam626')));

test('optional COMP03 spatial release exact separate identity, no legacy upgrade',async()=>{
 assert.equal(spatial.operation,comp.operation);
 assert.notEqual(spatial.key,comp.key);assert.notEqual(spatial.assetDir,comp.assetDir);assert.notEqual(spatial.prefix,comp.prefix);
 assert.deepEqual(spatial.features,['product-steam626-comp03-spatial-preview','worker-wasm']);
 assert.equal(comp.methods.length,13);assert.equal(comp.exports.length,22);
 assert.equal(spatial.methods.length,14);assert.equal(spatial.exports.length,23);
 assert.deepEqual(spatial.methods.filter(n=>n!=='preview_steam626_comp03_spatial'),comp.methods);
 assert.deepEqual(spatial.exports.filter(n=>n!=='workerwasmsource_preview_steam626_comp03_spatial'),comp.exports);
 assert.equal(fixedPlacementProofScope(spatial.key),spatial);
 const b=subject(spatial),p=inspectPlacementSubjects(spatial,b,source),a=privatePlacementIdentity(spatial,p,'http://127.0.0.1:4188');
 assert.equal(await validatePlacementAnchor(spatial,a),true);
 await assert.rejects(()=>validatePlacementAnchor(comp,a));
 assert.throws(()=>inspectPlacementSubjects(comp,b,source));assert.throws(()=>inspectPlacementSubjects(spatial,subject(comp),source));
 assert.throws(()=>inspectPlacementSubjects(spatial,subject(spatial,wasm(comp)),source));
 assert.throws(()=>inspectPlacementSubjects(spatial,subject(spatial,wasm(vase)),source));
 assert.throws(()=>inspectPlacementSubjects(comp,subject(comp,wasm(comp),Buffer.from('preview_steam626_comp03_spatial')),source));
 for(const n of ['stage_steam626_vase_add','stage_steam626_backpack_split','preview_switch626_wardrobe']){
  assert.throws(()=>inspectPlacementSubjects(spatial,subject(spatial,wasm(spatial),Buffer.from(n)),source));
 }
 const prior=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-comp03-spatial-release-anchor.mjs',import.meta.url),'utf8');
 const legacy=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-placement-release-anchor.mjs',import.meta.url),'utf8');
 const out=replacePrivatePlacementAnchor(spatial,prior,a);assert.ok(out.includes('export const PROTECTED_COMP03_SPATIAL_RELEASE_ANCHOR=Object.freeze('));
 assert.throws(()=>replacePrivatePlacementAnchor(spatial,legacy,a));
 assert.throws(()=>replacePrivatePlacementAnchor(comp,prior,privatePlacementIdentity(comp,inspectPlacementSubjects(comp,subject(comp),source),'http://127.0.0.1:4188')));
 assert.throws(()=>replacePrivatePlacementAnchor(spatial,out,a));
});

test('Switch626 Vase separate fixed Build proof identity and foreign rejection',async()=>{
 assert.equal(fixedPlacementProofScope('switch626-vase-add'),switchVase);
 assert.equal(switchVase.platform,'switch');assert.equal(switchVase.buildId,'9A239D3DB569756D');
 assert.deepEqual(switchVase.features,['product-switch626-vase-add-scoped','worker-wasm']);
 assert.equal(switchVase.methods.length,13);assert.equal(switchVase.exports.length,22);
 const bytes=subject(switchVase),pins=inspectPlacementSubjects(switchVase,bytes,source),a=privatePlacementIdentity(switchVase,pins,'http://127.0.0.1:4188');
 assert.equal(await validatePlacementAnchor(switchVase,a),true);
 assert.deepEqual(a.builds,[{platform:'switch',buildId:'9A239D3DB569756D',productV2EvidenceSha256:null}]);
 await assert.rejects(()=>validatePlacementAnchor(switchVase,{...a,builds:[{...a.builds[0],platform:'steam-windows',buildId:comp.buildId}]}));
 for(const other of [comp,vase,spatial]){
  assert.throws(()=>inspectPlacementSubjects(other,bytes,source));
  assert.throws(()=>inspectPlacementSubjects(switchVase,subject(other),source));
  assert.throws(()=>inspectPlacementSubjects(switchVase,subject(switchVase,wasm(other)),source));
  for(const n of ['preview_switch626_vase_add','stage_switch626_vase_add'])assert.throws(()=>inspectPlacementSubjects(other,subject(other,wasm(other),Buffer.from(n)),source));
  assert.throws(()=>inspectPlacementSubjects(switchVase,subject(switchVase,wasm(switchVase),Buffer.from(other.methods.find(n=>n.startsWith('stage_')))),source));
 }
 const prior=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-switch-vase-release-anchor.mjs',import.meta.url),'utf8');
 const legacy=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-placement-release-anchor.mjs',import.meta.url),'utf8');
 const spatialAnchor=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-comp03-spatial-release-anchor.mjs',import.meta.url),'utf8');
 const out=replacePrivatePlacementAnchor(switchVase,prior,a);
 assert.ok(out.includes('export const PROTECTED_SWITCH_VASE_ADD_RELEASE_ANCHOR=Object.freeze('));
 assert.throws(()=>replacePrivatePlacementAnchor(switchVase,out,a));assert.throws(()=>replacePrivatePlacementAnchor(switchVase,legacy,a));assert.throws(()=>replacePrivatePlacementAnchor(switchVase,spatialAnchor,a));
});
