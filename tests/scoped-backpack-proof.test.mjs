import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {STEAM_BACKPACK_RELEASE as steam,SWITCH_BACKPACK_RELEASE as sw,validatePlacementAnchor} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {fixedBackpackProofScope,inspectBackpackSubjects,privateBackpackIdentity,replacePrivateBackpackAnchor} from '../scripts/readonly-release/scoped-backpack-proof.mjs';
const source='a'.repeat(40),sha=b=>createHash('sha256').update(b).digest('hex');
const u=n=>{const a=[];do{let v=n&127;n>>>=7;a.push(v|(n?128:0))}while(n);return a};
const str=s=>[...u(Buffer.byteLength(s)),...Buffer.from(s)],sec=(id,b)=>[id,...u(b.length),...b];
function wasm(s,extra=false){
 const es=[...s.exports,...(extra===true?['workerwasmsource_stage_extra']:typeof extra==='string'?[extra]:[])];
 const exports=es.flatMap(n=>[...str(n),n==='memory'?2:n==='__wbindgen_externrefs'?1:0,0]);
 return Buffer.from([0,97,115,109,1,0,0,0,...sec(1,[1,96,0,0]),...sec(3,[1,0]),...sec(4,[1,111,0,1]),...sec(5,[1,0,1]),...sec(7,[...u(es.length),...exports]),...sec(10,[1,2,0,11])]);
}
function subject(s,w=wasm(s),js=Buffer.from('export default function(){}'),patch={}){
 const m={contract:s.prefix+'.runtime@1',operation:s.operation,source:{repository:tuple.repository,commit:source,cargoTomlSha256:'b'.repeat(64),cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features:s.features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:js.length,sha256:sha(js)},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:w.length,sha256:sha(w)}},abi:{exportClass:'WorkerWasmSource',methods:s.methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false},...patch};
 return [Buffer.from(JSON.stringify(m)),js,w];
}
for(const [s,o] of [[steam,sw],[sw,steam]])test(s.key+' fixed three subject inspection and private anchor only',async()=>{
 assert.equal(fixedBackpackProofScope(s.key),s);assert.equal(s.methods.length,13);assert.equal(s.exports.length,22);assert.throws(()=>inspectBackpackSubjects(s,subject(s,undefined,undefined,{source:{...JSON.parse(subject(s)[0]).source,features:['product-backpack-scoped','worker-wasm']}}),source));
 const bytes=subject(s),p=inspectBackpackSubjects(s,bytes,source);
 for(const n of ['preview_switch626_vase_add','stage_switch626_vase_add']){
  assert.throws(()=>inspectBackpackSubjects(s,subject(s,wasm(s),Buffer.from(n)),source));
  assert.throws(()=>inspectBackpackSubjects(s,subject(s,wasm(s,'workerwasmsource_'+n)),source));
 }
 assert.equal(p.jsSha256,sha(bytes[1]));assert.equal(p.wasmSha256,sha(bytes[2]));
 assert.throws(()=>inspectBackpackSubjects(o,bytes,source));
 assert.throws(()=>inspectBackpackSubjects(s,subject(s,wasm(o)),source));
 assert.throws(()=>inspectBackpackSubjects(s,subject(s,wasm(s,true)),source));
 assert.throws(()=>inspectBackpackSubjects(s,subject(s,wasm(s),Buffer.from(o.methods.find(n=>n.startsWith('stage_')))),source));
 // Current PR1553 loader also denies either Wardrobe scope in JS, even when
 // the actual WASM module and all Backpack manifest/digest fields are valid.
 for(const platform of ['steam626','switch626'])for(const action of ['preview','stage']){
  const name=action+'_'+platform+'_wardrobe';
  assert.throws(()=>inspectBackpackSubjects(s,subject(s,wasm(s),Buffer.from(name)),source),/SCOPED_BACKPACK_PROOF_DENIED/);
 }

 assert.throws(()=>inspectBackpackSubjects(s,subject(s,wasm(s),undefined,{operation:o.operation}),source));
 assert.throws(()=>inspectBackpackSubjects(s,bytes,'c'.repeat(40)));
 const a=privateBackpackIdentity(s,p,'http://127.0.0.1:4188');assert.equal(await validatePlacementAnchor(s,a),true);
 assert.equal(a.builds[0].productV2EvidenceSha256,null);assert.throws(()=>privateBackpackIdentity(s,p,tuple.origin));
 const prior=readFileSync(new URL('../src/lib/ddv/core/save/product-scoped-backpack-release-anchor.mjs',import.meta.url),'utf8');
 const out=replacePrivateBackpackAnchor(s,prior,a);
 assert.ok(out.includes('export const '+(s===steam?'PROTECTED_SWITCH_BACKPACK_RELEASE_ANCHOR':'PROTECTED_STEAM_BACKPACK_RELEASE_ANCHOR')+'=null;'));
 assert.throws(()=>replacePrivateBackpackAnchor(o,out,privateBackpackIdentity(o,inspectBackpackSubjects(o,subject(o),source),'http://127.0.0.1:4188')));
 assert.throws(()=>replacePrivateBackpackAnchor(s,prior,{...a,mode:'public-accepted'}));
});
test('unknown operation is never a selectable proof scope',()=>assert.throws(()=>fixedBackpackProofScope('steam626')));
