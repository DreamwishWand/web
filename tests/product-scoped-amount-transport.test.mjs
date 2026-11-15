import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {createP1gRustWorkerReadOnlyBridge} from '../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const BUILD={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const original=new Uint8Array([1,2,3]),edited=new Uint8Array([1,2,4]),id='a'.repeat(32),sha=hash(original),editedSha=hash(edited),entry='b'.repeat(64);
const c='wand.worker.steam626.scoped-amount@1',sel={profile:'catalog0-furniture',id:0,selector:40000048,newAmount:2};
const receipt={contract:'wand.product.single-save-session.boundary@1',sessionId:id,decodedSha256:sha,revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,allDomainReferencesVerified:false,productReadAccepted:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const src=async function*(){yield original};
class Mock{
 constructor(){this.rev=0;this.closed=false;this.applied=false;this.consumed=false;}
 append_chunk(){}
 finish(){return JSON.stringify(receipt)}
 close(){this.closed=true}
 check(id0,r,g,s){assert.equal(id0,id);assert.equal(r,BigInt(this.rev));assert.equal(g,BigInt(this.rev+1));assert.equal(s,sha);}
 preview_scoped_amount(profile,i,selector,n,...a){this.check(...a);return JSON.stringify({contract:c,profile,id:i,selector,itemId:selector,oldAmount:3,newAmount:n,entrySha256:entry,sessionId:id,revision:0,indexGeneration:1,decodedSha256:sha,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false})}
 stage_scoped_amount(profile,i,selector,old,n,e,...a){this.check(...a);assert.deepEqual([profile,i,selector,old,n,e],[sel.profile,0,sel.selector,3,2,entry]);return this.stage(true)}
 stage(applied){this.applied=applied;this.rev++;return JSON.stringify({contract:c,sessionId:id,revision:this.rev,indexGeneration:this.rev+1,decodedSha256:sha,stagedDecodedSha256:editedSha,operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,originalOverwriteAuthorized:false})}
 toggle_scoped_amount(redo,...a){this.check(...a);return this.stage(redo)}
 begin_scoped_amount_output(...a){this.check(...a);assert.equal(this.applied,true);this.consumed=true;return JSON.stringify({contract:'wand.worker.steam626.scoped-amount-output@1',decodedBytes:3,decodedSha256:editedSha,writerAuthorized:false,originalOverwriteAuthorized:false})}
 next_scoped_amount_output_chunk(){assert.equal(this.consumed,true);return edited.slice()}
}
const make=(C=Mock,enable=true)=>createProductWasmReadOwner(async()=>({WorkerWasmSource:C}),{allowScopedAmountSource:enable});
const open=async w=>w.openDecoded({build:BUILD,decodedChunks:src()});
test('default owner and P1G bridge expose no scoped mutation or export and keep capabilities off',async()=>{
 const w=make(Mock,false);await open(w);assert.equal(w.previewScopedAmount,undefined);assert.equal(w.getCapabilities().canStage,false);
 const b=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource:Mock}));assert.equal(b.openScopedEncrypted,undefined);
});
test('same owner preview redaction, CAS stage, revisioned undo/redo and one-time exact output',async()=>{
 const w=make();await open(w);const p=w.previewScopedAmount(sel);
 assert.deepEqual(p,{...sel,itemId:sel.selector,oldAmount:3,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false});
 assert.equal(w.stageScopedAmount().applied,true);assert.equal(w.getReceipt(),null);assert.equal(w.toggleScopedAmount(false).applied,false);
 assert.equal(w.toggleScopedAmount(true).applied,true);const out=await w.takeScopedAmountOutput();assert.deepEqual(out.decodedBytes,edited);assert.equal(out.decodedSha256,editedSha);assert.equal(w.getReceipt(),null);await assert.rejects(async()=>w.takeScopedAmountOutput(),/OFF/);
});
test('forged preview receipt, stage revision, output digest, replay and unknown profile revoke fail closed',async()=>{
 for(const [method,patch] of [['preview_scoped_amount',{entrySha256:'bad'}],['preview_scoped_amount',{writerAuthorized:true}],['preview_scoped_amount',{sessionId:'c'.repeat(32)}],['stage_scoped_amount',{revision:2}],['stage_scoped_amount',{exactFieldChangedCount:2}],['begin_scoped_amount_output',{decodedSha256:sha}]]){
  class Bad extends Mock{};Bad.prototype[method]=function(...a){return JSON.stringify({...JSON.parse(Mock.prototype[method].apply(this,a)),...patch})};
  const w=make(Bad);await open(w);
  await assert.rejects(async()=>{w.previewScopedAmount(sel);w.stageScopedAmount();await w.takeScopedAmountOutput()},/DENIED/);
  assert.equal(w.getReceipt(),null);
 }
 const w=make();await open(w);assert.throws(()=>w.previewScopedAmount({...sel,profile:'unknown'}),/DENIED/);assert.equal(w.getReceipt(),null);
 const v=make();await open(v);v.previewScopedAmount(sel);v.stageScopedAmount();assert.throws(()=>v.stageScopedAmount(),/DENIED/);assert.equal(v.getReceipt(),null);
});
test('actual bounded output corruption and stale async digest cannot export or close newer session',async()=>{
 class Corrupt extends Mock{next_scoped_amount_output_chunk(){return new Uint8Array([1,2,5])}}
 const w=make(Corrupt);await open(w);w.previewScopedAmount(sel);w.stageScopedAmount();await assert.rejects(w.takeScopedAmountOutput(),/DENIED/);assert.equal(w.getReceipt(),null);
 const q=make();await open(q);q.previewScopedAmount(sel);q.stageScopedAmount();const out=q.takeScopedAmountOutput();q.close();await open(q);
 await assert.rejects(out,/DENIED/);assert.equal(q.getReceipt().revision,0);q.close();
});
