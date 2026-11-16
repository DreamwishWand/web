import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSwitch626ChestTransport} from '../src/lib/ddv/core/save/product-scoped-amount-transport.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const edited=new Uint8Array([1,2,4]),sessionId='a'.repeat(32),decodedSha256=hash(new Uint8Array([1,2,3])),out=hash(edited),entry='b'.repeat(64);
const identity={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId,revision:0,indexGeneration:1,decodedSha256,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const selection={profile:'linked-crop-chest48',id:12,selector:0,newAmount:49};
const row={profile:selection.profile,id:12,selector:0,itemId:40000048,oldAmount:50};
const candidate='wand.worker.switch626.scoped-chest@1',neutral='wand.worker.scoped-edit@1',discovery='wand.worker.switch626.scoped-chest-discovery@1';
const flags={writerAuthorized:false,editedCopyAuthorized:false};
class Mock{
 rev=0;pos=0;calls=[];patch={};applied=false;
 scope(){return {sessionId,revision:this.rev,indexGeneration:this.rev+1,decodedSha256}}
 check(a){assert.deepEqual(a,[sessionId,BigInt(this.rev),BigInt(this.rev+1),decodedSha256])}
 discover_switch626_chest(offset,...a){this.check(a);assert.equal(offset,0);this.calls.push('discover');return JSON.stringify({contract:discovery,profile:row.profile,...this.scope(),offset,nextOffset:null,scanned:1,rows:[row],...flags,...this.patch.discovery})}
 preview_switch626_chest(id,slot,n,...a){this.check(a);assert.deepEqual([id,slot,n],[12,0,49]);this.calls.push('preview');return JSON.stringify({contract:candidate,...row,newAmount:n,entrySha256:entry,...this.scope(),scopedCandidate:true,...flags,...this.patch.preview})}
 receipt(contract,applied){this.rev++;this.applied=applied;return JSON.stringify({contract,...this.scope(),stagedDecodedSha256:out,operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...this.patch.stage})}
 stage_switch626_chest(id,slot,old,n,e,...a){this.check(a);assert.deepEqual([id,slot,old,n,e],[12,0,50,49,entry]);this.calls.push('stage');return this.receipt(candidate,true)}
 toggle_scoped_edit(redo,...a){this.check(a);this.calls.push('toggle');return this.receipt(neutral,redo)}
 begin_scoped_edit_output(...a){this.check(a);assert.equal(this.applied,true);this.calls.push('output');return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:edited.length,decodedSha256:out,writerAuthorized:false,originalOverwriteAuthorized:false})}
 next_scoped_edit_output_chunk(){const start=this.pos;this.pos+=2;return edited.slice(start,this.pos)}
}
const make=(w=new Mock(),b=identity,r=initial)=>{let live=true;const t=createSwitch626ChestTransport(w,r,b,{parse:JSON.parse,current:()=>live,revoke:()=>{live=false},maxBytes:128,chunkBytes:2});return {t,w,live:()=>live}};
test('Switch626 explicit ABI, exact50->49, neutral shared lifecycle, one-time output',async()=>{
 const {t,w,live}=make();assert.deepEqual(t.discoverTargets(row.profile),[row]);assert.equal(t.previewTarget(selection).newAmount,49);assert.equal(t.stage().applied,true);assert.equal(t.toggle(false).applied,false);assert.equal(t.toggle(true).applied,true);
 const output=await t.takeOutput();assert.deepEqual(output.decodedBytes,edited);assert.equal(output.decodedSha256,out);assert.equal(live(),false);await assert.rejects(t.takeOutput());assert.deepEqual(w.calls,['discover','preview','stage','toggle','toggle','output']);
});
test('Switch scope rejects foreign Build, profile, old/new and forged receipts',()=>{
 for(const b of [{...identity,buildId:'other'},{...identity,platform:'steam-windows'},{...identity,schema:624}])assert.throws(()=>make(new Mock(),b));
 for(const r of [{...initial,writerAuthorized:true},{...initial,revision:1},{...initial,sessionId:'0'.repeat(32)}])assert.throws(()=>make(new Mock(),identity,r));
 for(const s of [{...selection,newAmount:48},{...selection,profile:'catalog0-furniture'},{...selection,selector:48},{...selection,id:1}]){const {t,w,live}=make();assert.throws(()=>t.previewTarget(s));assert.equal(w.calls.length,0);assert.equal(live(),false)}
 for(const p of [{contract:'wand.worker.steam626.scoped-amount@1'},{oldAmount:51},{writerAuthorized:true},{entrySha256:'bad'},{revision:1}]){const w=new Mock();w.patch.preview=p;const {t,live}=make(w);assert.throws(()=>t.previewTarget(selection));assert.equal(live(),false)}
 for(const p of [{contract:'wand.worker.steam626.scoped-amount-discovery@1'},{rows:[{...row,oldAmount:51}]},{nextOffset:16},{writerAuthorized:true}]){const w=new Mock();w.patch.discovery=p;const {t,live}=make(w);assert.throws(()=>t.discoverTargets(row.profile));assert.equal(live(),false)}
 for(const p of [{contract:neutral},{operationCount:2},{writerAuthorized:true}]){const w=new Mock();w.patch.stage=p;const {t,live}=make(w);t.previewTarget(selection);assert.throws(()=>t.stage());assert.equal(live(),false)}
 const x=make();assert.throws(()=>x.t.discoverTargets('catalog0-furniture'));assert.equal(x.w.calls.length,0);
});
test('Switch neutral toggle cannot accept Steam or Switch stage tags',()=>{
 for(const contract of [candidate,'wand.worker.steam626.scoped-amount@1']){const x=make();x.t.previewTarget(selection);x.t.stage();x.w.patch.stage={contract};assert.throws(()=>x.t.toggle(false));assert.equal(x.live(),false)}
});
