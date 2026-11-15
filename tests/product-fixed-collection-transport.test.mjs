import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createFixedCollectionTransport} from '../src/lib/ddv/core/save/product-fixed-collection-transport.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const src=new Uint8Array([1,2,3]),edited=new Uint8Array([1,2,4]),id='a'.repeat(32),sha=hash(src),outSha=hash(edited),entry='b'.repeat(64);
const STEAM={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626};
const SWITCH={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const sel={definitionId:2120000159,groupIndex:0,itemId:40004511};
const initial={contract:'wand.product.single-save-session.boundary@1',sessionId:id,decodedSha256:sha,revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const preview={contract:'wand.worker.collection-fixed-edit@1',...sel,peerItemId:40004668,old:false,new:true,falseCount:3,entrySha256:entry,sessionId:id,revision:0,indexGeneration:1,decodedSha256:sha,fixedDefinitionVerified:true,installedRuntimeParityVerified:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
class Mock{
 rev=0;pos=0;applied=false;calls=[];
 check(a){assert.deepEqual(a,[id,BigInt(this.rev),BigInt(this.rev+1),sha])}
 preview_fixed_collection(d,g,i,...a){this.check(a);assert.deepEqual([d,g,i],[sel.definitionId,0,sel.itemId]);this.calls.push('preview');return JSON.stringify(preview)}
 mutation(applied){this.applied=applied;this.rev++;return JSON.stringify({contract:'wand.worker.scoped-edit@1',sessionId:id,revision:this.rev,indexGeneration:this.rev+1,decodedSha256:sha,stagedDecodedSha256:outSha,operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,originalOverwriteAuthorized:false})}
 stage_fixed_collection(d,g,i,e,...a){this.check(a);assert.deepEqual([d,g,i,e],[sel.definitionId,0,sel.itemId,entry]);this.calls.push('stage');return this.mutation(true)}
 toggle_scoped_edit(redo,...a){this.check(a);this.calls.push('toggle');return this.mutation(redo)}
 begin_scoped_edit_output(...a){this.check(a);assert.equal(this.applied,true);this.calls.push('export');return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:edited.length,decodedSha256:outSha,writerAuthorized:false,originalOverwriteAuthorized:false})}
 next_scoped_edit_output_chunk(){const start=this.pos;this.pos+=2;return edited.slice(start,this.pos)}
}
const make=(identity=STEAM,wasm=new Mock())=>{let active=true;const t=createFixedCollectionTransport(wasm,initial,identity,{parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:128,chunkBytes:2});return {t,wasm,active:()=>active,close:()=>{active=false}}};
test('PR1361 fixed ABI projection dual Build, private CAS, shared exact1 undo redo chunk export',async()=>{
 for(const b of [STEAM,SWITCH]){
  const {t,wasm,active}=make(b),p=t.previewTarget(sel);
  assert.deepEqual(p,{...sel,oldValue:false,newValue:true,groupState:'NotComplete',falseCount:3,remainingFalseCount:2,fixedDefinitionVerified:true,installedRuntimeParityVerified:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});
  assert.equal(t.stage().applied,true);assert.equal(t.hasMutation(),true);assert.equal(t.toggle(false).applied,false);assert.equal(t.toggle(true).applied,true);
  const o=await t.takeOutput();assert.deepEqual(o.decodedBytes,edited);assert.equal(o.decodedSha256,outSha);assert.equal(active(),false);await assert.rejects(t.takeOutput());assert.deepEqual(wasm.calls,['preview','stage','toggle','toggle','export']);
 }
});
test('fixed Collection selector, old/peer/definition scope, private hash/authority receipt deny and revoke',()=>{
 for(const patch of [{definitionId:1},{groupIndex:1},{itemId:40004668},{peerItemId:40004511},{old:true},{new:false},{falseCount:2},{entrySha256:'bad'},{sessionId:'c'.repeat(32)},{revision:1},{indexGeneration:2},{decodedSha256:'c'.repeat(64)},{fixedDefinitionVerified:false},{installedRuntimeParityVerified:true},{writerAuthorized:true},{editedCopyAuthorized:true},{applyAuthorized:true},{unexpected:true}]){
  const wasm=new Mock();wasm.preview_fixed_collection=()=>JSON.stringify({...preview,...patch});const {t,active}=make(STEAM,wasm);assert.throws(()=>t.previewTarget(sel));assert.equal(active(),false);
 }
 for(const bad of [{...sel,itemId:40004668},{...sel,groupIndex:1},{...sel,new:true}]){
  const {t,wasm,active}=make();assert.throws(()=>t.previewTarget(bad));assert.equal(wasm.calls.length,0);assert.equal(active(),false);
 }
 assert.throws(()=>make({...STEAM,buildId:'unknown'}));
});
test('shared lifecycle rejects stale or forged Stage, undo export, replay and malformed output',async()=>{
 for(const patch of [{revision:2},{indexGeneration:3},{exactFieldChangedCount:2},{operationCount:2},{applied:false},{writerAuthorized:true},{originalOverwriteAuthorized:true},{stagedDecodedSha256:sha},{contract:'wand.worker.steam626.scoped-amount@1'}]){
  const wasm=new Mock(),orig=wasm.stage_fixed_collection.bind(wasm);wasm.stage_fixed_collection=(...a)=>JSON.stringify({...JSON.parse(orig(...a)),...patch});const {t,active}=make(STEAM,wasm);t.previewTarget(sel);assert.throws(()=>t.stage());assert.equal(active(),false);
 }
 let x=make();x.t.previewTarget(sel);x.t.stage();assert.throws(()=>x.t.stage());assert.equal(x.active(),false);
 x=make();x.t.previewTarget(sel);x.t.stage();x.t.toggle(false);await assert.rejects(x.t.takeOutput());assert.equal(x.active(),false);
 const corrupt=new Mock();corrupt.next_scoped_edit_output_chunk=()=>new Uint8Array([9]);x=make(STEAM,corrupt);x.t.previewTarget(sel);x.t.stage();await assert.rejects(x.t.takeOutput());assert.equal(x.active(),false);
 x=make();x.t.previewTarget(sel);x.close();assert.throws(()=>x.t.stage());assert.equal(x.wasm.calls.length,1);
 x=make();x.t.previewTarget(sel);x.t.stage();const pending=x.t.takeOutput();x.close();await assert.rejects(pending);
});
