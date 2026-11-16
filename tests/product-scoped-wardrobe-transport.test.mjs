import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSteam626WardrobeTransport,createSwitch626WardrobeTransport} from '../src/lib/ddv/core/save/product-scoped-wardrobe-transport.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),bytes=new TextEncoder().encode('synthetic wardrobe output'),out=createHash('sha256').update(bytes).digest('hex'),pack='9bcf2cf489238074df8ea0b385a6675c8efcd51bb009cac37d8e107ec1a5d0b2';
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const steam={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626},sw={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
function setup(isSwitch,patch={},stagePatch={}){
 const prefix=isSwitch?'switch626':'steam626',contract='wand.worker.'+prefix+'.wardrobe-same-slot@1';let active=true,rev=0,cursor=0,previews=0,stages=0;
 const args=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const p={contract,slot:0,oldItemId:50000352,newItemId:50000214,definitionPackSha256:pack,witnessSha256:h('c'),projectedDecodedSha256:out,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,writerAuthorized:false,originalOverwriteAuthorized:false};
 const receipt=(c,applied)=>JSON.stringify({contract:c,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:out,operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const w={toggle_scoped_edit(redo,...a){assert.deepEqual(a,args());return receipt('wand.worker.scoped-edit@1',redo)},begin_scoped_edit_output(...a){assert.deepEqual(a,args());return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:bytes.length,decodedSha256:out,writerAuthorized:false,originalOverwriteAuthorized:false})},next_scoped_edit_output_chunk(){const p=bytes.slice(cursor,cursor+8);cursor+=p.length;return p}};
 w['preview_'+prefix+'_wardrobe']=(...a)=>{previews++;assert.deepEqual(a,args());return JSON.stringify({...p,...patch})};
 w['stage_'+prefix+'_wardrobe']=(...a)=>{stages++;assert.deepEqual(a,[50000352,50000214,h('c'),out,...args()]);return receipt(contract,true)};
 const create=isSwitch?createSwitch626WardrobeTransport:createSteam626WardrobeTransport,opts={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {t:create(w,initial,isSwitch?sw:steam,opts),active:()=>active,previews:()=>previews,stages:()=>stages,w,opts,create};
}
for(const isSwitch of [false,true]){
 const label=isSwitch?'Switch626':'Steam626';
 test(label+' Wardrobe fixed same-slot exact1 Core-owned preview/CAS and one-time output',async()=>{
  const s=setup(isSwitch);assert.deepEqual(s.t.previewTarget(),{slot:0,oldItemId:50000352,newItemId:50000214,exactFieldChangedCount:1,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false});
  assert.equal(s.t.stage().applied,true);assert.equal(s.t.toggle(false).applied,false);assert.equal(s.t.toggle(true).applied,true);
  const o=await s.t.takeOutput();assert.deepEqual(o.decodedBytes,bytes);assert.equal(o.decodedSha256,out);assert.equal(s.active(),false);await assert.rejects(s.t.takeOutput());
 });
 test(label+' Wardrobe denies caller selectors, foreign receipt/pack/scope/projection and mutation count',()=>{
  for(const a of [0,{slot:0},{oldItemId:50000352,newItemId:50000214}]){const s=setup(isSwitch);assert.throws(()=>s.t.previewTarget(a));assert.equal(s.previews(),0);assert.equal(s.active(),false)}
  for(const p of [{contract:'other'},{slot:1},{oldItemId:1},{newItemId:1},{definitionPackSha256:h('f')},{witnessSha256:'x'},{projectedDecodedSha256:original},{sessionId:'f'.repeat(32)},{revision:1},{indexGeneration:2},{decodedSha256:h('f')},{writerAuthorized:true},{originalOverwriteAuthorized:true},{extra:true}]){const s=setup(isSwitch,p);assert.throws(()=>s.t.previewTarget());assert.equal(s.active(),false);assert.equal(s.stages(),0)}
  for(const p of [{operationCount:3},{exactFieldChangedCount:3},{stagedDecodedSha256:h('f')},{writerAuthorized:true}]){const s=setup(isSwitch,{},p);s.t.previewTarget();assert.throws(()=>s.t.stage());assert.equal(s.active(),false)}
  const s=setup(isSwitch);assert.throws(()=>s.create(s.w,initial,isSwitch?steam:sw,s.opts));
 });
}
