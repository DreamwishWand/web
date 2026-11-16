import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {COMP03_RELEASE as comp,COMP03_SPATIAL_RELEASE as spatial,VASE_ADD_RELEASE as vase,SR03_RELEASE as sr03,RM01_RELEASE as rm01,R01_RELEASE as r01,validatePlacementAnchor} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
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

test('SR03 fixed exact8 proof identity, private anchor and cross-scope denial',async()=>{
 assert.equal(fixedPlacementProofScope('steam626-sr03'),sr03);
 assert.equal(sr03.operation,'steam626.sr03.mixed-q5.exact8');
 assert.deepEqual(sr03.features,['product-steam626-sr03-scoped','worker-wasm']);
 assert.equal(sr03.methods.length,13);assert.equal(sr03.exports.length,22);
 const own=Buffer.from('export function preview_steam626_sr03(){};export function stage_steam626_sr03(){}');
 const bytes=subject(sr03,wasm(sr03),own),pins=inspectPlacementSubjects(sr03,bytes,source);
 const a=privatePlacementIdentity(sr03,pins,'http://127.0.0.1:4188');
 assert.equal(await validatePlacementAnchor(sr03,a),true);
 assert.equal(a.builds[0].productV2EvidenceSha256,null);
 assert.throws(()=>privatePlacementIdentity(sr03,pins,tuple.origin));
 const prior=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-sr03-release-anchor.mjs',import.meta.url),'utf8');
 const legacy=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-placement-release-anchor.mjs',import.meta.url),'utf8');
 const out=replacePrivatePlacementAnchor(sr03,prior,a);
 assert.ok(out.includes('export const PROTECTED_SR03_RELEASE_ANCHOR=Object.freeze('));
 assert.throws(()=>replacePrivatePlacementAnchor(sr03,legacy,a));
 assert.throws(()=>replacePrivatePlacementAnchor(sr03,out,a));
 assert.throws(()=>replacePrivatePlacementAnchor(sr03,prior,{...a,mode:'public-accepted'}));
 for(const other of [comp,vase]){
  assert.throws(()=>inspectPlacementSubjects(other,bytes,source));
  assert.throws(()=>inspectPlacementSubjects(sr03,subject(other),source));
  assert.throws(()=>inspectPlacementSubjects(sr03,subject(sr03,wasm(other)),source));
  for(const n of ['preview_steam626_sr03','stage_steam626_sr03'])
   assert.throws(()=>inspectPlacementSubjects(other,subject(other,wasm(other),Buffer.from(n)),source));
  for(const n of other.methods.filter(n=>/^(?:preview|stage)_steam626_/.test(n)))
   assert.throws(()=>inspectPlacementSubjects(sr03,subject(sr03,wasm(sr03),Buffer.from(n)),source));
 }
 for(const n of ['preview_steam626_comp03_spatial','stage_switch626_vase_add','preview_steam626_backpack_split','stage_switch626_wardrobe','preview_switch626_catalog0','preview_steam626_chest'])
  assert.throws(()=>inspectPlacementSubjects(sr03,subject(sr03,wasm(sr03),Buffer.from(n)),source));
 assert.throws(()=>inspectPlacementSubjects(sr03,subject(sr03,wasm(sr03,true)),source));
 assert.throws(()=>inspectPlacementSubjects(sr03,bytes,'c'.repeat(40)));
});


test('SR03 and optional spatial fixed proofs retain own separate anchors and reject foreign subjects',async()=>{
 for(const [own,foreign] of [[sr03,spatial],[spatial,sr03]]){
  const bytes=subject(own),p=inspectPlacementSubjects(own,bytes,source);
  const a=privatePlacementIdentity(own,p,'http://127.0.0.1:4188');
  assert.equal(await validatePlacementAnchor(own,a),true);
  assert.throws(()=>inspectPlacementSubjects(foreign,bytes,source));
  assert.throws(()=>inspectPlacementSubjects(own,subject(own,wasm(foreign)),source));
  for(const n of foreign.methods.filter(n=>/^(?:preview|stage)_steam626_/.test(n)))
   assert.throws(()=>inspectPlacementSubjects(own,subject(own,wasm(own),Buffer.from(n)),source));
  for(const n of ['preview_steam626_chest','stage_switch626_vase_add'])
   assert.throws(()=>inspectPlacementSubjects(own,subject(own,wasm(own),Buffer.from(n)),source));
  const path=foreign===sr03?'product-scoped-sr03-release-anchor.mjs':'product-scoped-comp03-spatial-release-anchor.mjs';
  const prior=readFileSync(new URL('../src/lib/ddv/core/save/'+path,import.meta.url),'utf8');
  assert.throws(()=>replacePrivatePlacementAnchor(own,prior,a));
 }
});

 test('current RM01 is a foreign placement scope for existing four proofs',()=>{
 for(const own of [comp,vase,sr03,spatial])for(const n of ['preview_switch626_rm01','stage_switch626_rm01'])
  assert.throws(()=>inspectPlacementSubjects(own,subject(own,wasm(own),Buffer.from(n)),source));
 assert.equal(fixedPlacementProofScope('switch626-rm01'),rm01);
 });

test('RM01 exact Switch626 proof identity, separate anchor and foreign denial',async()=>{
 assert.equal(fixedPlacementProofScope('switch626-rm01'),rm01);
 assert.equal(rm01.operation,'switch626.rm01.mixed-q5.exact8');
 assert.equal(rm01.platform,'switch');assert.equal(rm01.buildId,'9A239D3DB569756D');
 assert.deepEqual(rm01.features,['product-switch626-rm01-scoped','worker-wasm']);
 assert.equal(rm01.methods.length,13);assert.equal(rm01.exports.length,22);
 const own=Buffer.from('export function preview_switch626_rm01(){};export function stage_switch626_rm01(){}');
 const bytes=subject(rm01,wasm(rm01),own),pins=inspectPlacementSubjects(rm01,bytes,source);
 const a=privatePlacementIdentity(rm01,pins,'http://127.0.0.1:4188');
 assert.equal(await validatePlacementAnchor(rm01,a),true);
 assert.deepEqual(a.builds,[{platform:'switch',buildId:'9A239D3DB569756D',productV2EvidenceSha256:null}]);
 await assert.rejects(()=>validatePlacementAnchor(rm01,{...a,builds:[{platform:'steam-windows',buildId:sr03.buildId,productV2EvidenceSha256:null}]}));
 assert.throws(()=>privatePlacementIdentity(rm01,pins,tuple.origin));
 const prior=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-rm01-release-anchor.mjs',import.meta.url),'utf8');
 const old=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-sr03-release-anchor.mjs',import.meta.url),'utf8');
 const out=replacePrivatePlacementAnchor(rm01,prior,a);
 assert.ok(out.includes('export const PROTECTED_RM01_RELEASE_ANCHOR=Object.freeze('));
 assert.throws(()=>replacePrivatePlacementAnchor(rm01,old,a));
 assert.throws(()=>replacePrivatePlacementAnchor(rm01,out,a));
 for(const other of [comp,vase,sr03,spatial]){
  assert.throws(()=>inspectPlacementSubjects(other,bytes,source));
  assert.throws(()=>inspectPlacementSubjects(rm01,subject(other),source));
  assert.throws(()=>inspectPlacementSubjects(rm01,subject(rm01,wasm(other)),source));
  for(const n of ['preview_switch626_rm01','stage_switch626_rm01'])
   assert.throws(()=>inspectPlacementSubjects(other,subject(other,wasm(other),Buffer.from(n)),source));
  for(const n of other.methods.filter(n=>/^(?:preview|stage)_steam626_/.test(n)))
   assert.throws(()=>inspectPlacementSubjects(rm01,subject(rm01,wasm(rm01),Buffer.from(n)),source));
 }
 for(const n of ['preview_steam626_comp03_spatial','stage_switch626_vase_add','preview_steam626_backpack_split','stage_switch626_wardrobe','preview_switch626_catalog0','preview_steam626_chest'])
  assert.throws(()=>inspectPlacementSubjects(rm01,subject(rm01,wasm(rm01),Buffer.from(n)),source));
 assert.throws(()=>inspectPlacementSubjects(rm01,subject(rm01,wasm(rm01,true)),source));
});


 test('Switch626 R01 exact4 private proof is fixed and reciprocal foreign closed',async()=>{
 assert.equal(fixedPlacementProofScope('switch626-r01'),r01);assert.equal(r01.operation,'switch626.r01.orthogonal-q3.exact4');assert.equal(r01.methods.length,13);assert.equal(r01.exports.length,22);
 const bytes=subject(r01),pins=inspectPlacementSubjects(r01,bytes,source),a=privatePlacementIdentity(r01,pins,'http://127.0.0.1:4188');
 assert.equal(await validatePlacementAnchor(r01,a),true);assert.deepEqual(a.builds,[{platform:'switch',buildId:'9A239D3DB569756D',productV2EvidenceSha256:null}]);
 const prior=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-r01-release-anchor.mjs',import.meta.url),'utf8');
 const out=replacePrivatePlacementAnchor(r01,prior,a);assert.ok(out.includes('export const PROTECTED_R01_RELEASE_ANCHOR=Object.freeze('));assert.throws(()=>replacePrivatePlacementAnchor(r01,out,a));
 for(const other of [comp,vase,sr03,spatial,rm01]){
  assert.throws(()=>inspectPlacementSubjects(other,bytes,source));assert.throws(()=>inspectPlacementSubjects(r01,subject(other),source));
  for(const n of other.methods.filter(n=>/^(?:preview|stage)_(?:steam626|switch626)_/.test(n)))assert.throws(()=>inspectPlacementSubjects(r01,subject(r01,wasm(r01),Buffer.from(n)),source));
  for(const n of ['preview_switch626_r01','stage_switch626_r01'])assert.throws(()=>inspectPlacementSubjects(other,subject(other,wasm(other),Buffer.from(n)),source));
 }
 for(const n of ['preview_switch626_r02','stage_steam626_hair','preview_switch626_skin'])assert.throws(()=>inspectPlacementSubjects(r01,subject(r01,wasm(r01),Buffer.from(n)),source));
 assert.throws(()=>inspectPlacementSubjects(r01,subject(r01,wasm(r01,true)),source));assert.throws(()=>privatePlacementIdentity(r01,pins,tuple.origin));
 });
