import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {createProductFixedCollectionLocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {createCollectionExact1Consumer} from '../src/lib/collection/collection-exact1-consumer.mjs';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {createFixedCollectionTransport} from '../src/lib/ddv/core/save/product-fixed-collection-transport.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {createP1gRustWorkerReadOnlyBridge} from '../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
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

const ownerReceipt={...initial,allDomainReferencesVerified:false,productReadAccepted:false};
const chunks=async function*(){yield src};
const opened=(w,b=STEAM)=>w.openDecoded({build:{...b,externallyConfirmed:true},decodedChunks:chunks()});
class OwnerMock extends Mock{
 static instances=[];
 constructor(){super();OwnerMock.instances.push(this)}
 append_chunk(){}
 finish(){return JSON.stringify(ownerReceipt)}
 close(){this.closed=true}
}
const owner=(C=OwnerMock,opts={allowScopedCollectionSource:true})=>createProductWasmReadOwner(async()=>({WorkerWasmSource:C}),opts);
test('one existing owner selects only one scoped domain; default read-only stays off; candidate is not edit grant',async()=>{
 assert.throws(()=>owner(OwnerMock,{allowScopedAmountSource:true,allowScopedCollectionSource:true}));
 assert.throws(()=>createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource:OwnerMock}),{allowScopedAmountSource:true,allowScopedCollectionSource:true}));
 const off=owner(OwnerMock,{});await opened(off);assert.equal(off.stageFixedCollection,undefined);assert.equal(off.getCapabilities().canStage,false);off.close();
 for(const b of [STEAM,SWITCH]){
  const w=owner();await opened(w,b);const n=OwnerMock.instances.length;w.previewFixedCollection(sel);w.stageFixedCollection();assert.equal(w.getReceipt(),null);
  assert.equal(w.toggleFixedCollection(false).applied,false);assert.equal(w.toggleFixedCollection(true).applied,true);
  // Owner uses production 1MiB chunk bound.
  OwnerMock.instances.at(-1).next_scoped_edit_output_chunk=()=>edited.slice();
  const out=await w.takeFixedCollectionOutput();assert.deepEqual(out.decodedBytes,edited);
  assert.equal(OwnerMock.instances.length,n);assert.equal(OwnerMock.instances.at(-1).closed,true);assert.equal(w.getReceipt(),null);
 }
});
test('Collection owner failed close retains old instance for explicit retry; no new wasm is constructed',async()=>{
 class BadClose extends OwnerMock{close(){if(!this.failed){this.failed=true;throw Error('close denied')}super.close()}}
 const w=owner(BadClose);await opened(w);const n=OwnerMock.instances.length;
 assert.throws(()=>w.close(),/CLOSE_UNVERIFIED/);assert.equal(w.getReceipt(),null);
 await assert.rejects(opened(w,SWITCH),/CLOSE_UNVERIFIED/);assert.equal(OwnerMock.instances.length,n);
 assert.deepEqual(w.close(),{closed:true,writerAuthorized:false});await opened(w,SWITCH);assert.equal(OwnerMock.instances.length,n+1);
 assert.throws(()=>w.close(),/CLOSE_UNVERIFIED/);w.close();
});
test('Collection owner pending open cannot acknowledge close or construct B before cleanup',async()=>{
 let release,entered;const held=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const w=createProductWasmReadOwner(async()=>{entered();await held;return {WorkerWasmSource:OwnerMock}},{allowScopedCollectionSource:true});
 const pending=assert.rejects(opened(w),/OPEN_REVOKED/);await started;
 assert.throws(()=>w.close(),/CLOSE_PENDING/);await assert.rejects(opened(w,SWITCH),/CLOSE_UNVERIFIED/);
 release();await pending;assert.deepEqual(w.close(),{closed:true,writerAuthorized:false});await opened(w,SWITCH);w.close();
});
test('shared lifecycle never releases decoded output if final owner cleanup fails',async()=>{
 // The common output helper must not deliver a valid byte receipt if close fails.
 const w=owner(class extends OwnerMock{close(){throw Error('denied')}});await opened(w);w.previewFixedCollection(sel);w.stageFixedCollection();
 OwnerMock.instances.at(-1).next_scoped_edit_output_chunk=()=>edited.slice();
 await assert.rejects(w.takeFixedCollectionOutput());assert.equal(w.getReceipt(),null);await assert.rejects(opened(w,SWITCH),/CLOSE_UNVERIFIED/);
});

test('existing candidate projection can coexist with one fixed edit domain but cannot read after Stage',async()=>{
 class CandidateAndEdit extends OwnerMock{
  constructor(p,k,b,...rest){super(p,k,b,...rest);this.build={platform:p,kind:k,id:b}}
  preview_scoped_collection_candidate(d,g,i,s,r,n,dig){
   this.check([s,r,n,dig]);return JSON.stringify({contract:'wand.worker.collection-scoped-candidate@1',
    platform:this.build.platform==='steam-windows'?'SteamWindows':'Switch',
    buildKind:this.build.kind==='steam-full-version'?'SteamFullVersion':'SwitchBid',buildId:this.build.id,
    sessionId:s,revision:Number(r),indexGeneration:Number(n),decodedSha256:dig,definitionId:d,groupIndex:g,itemId:i,old:false,new:true,falseCount:3,positiveStock:1,
    itemDefinitionSha256:dig,collectionDefinitionSha256:dig,groupDefinitionSha256:dig,entrySha256:dig,groupSha256:dig,mapSha256:dig,stockEntrySha256:dig,
    packagedCandidateVerified:true,sourcePhysicalVerified:true,effectiveEligibilityVerified:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false})
  }
 }
 const w=owner(CandidateAndEdit,{allowScopedCollectionSource:true,allowCollectionCandidateSource:true});
 await opened(w,SWITCH);const x=await w.readCollectionCandidate(sel);assert.equal(x.effectiveEligibilityVerified,false);
 w.previewFixedCollection(sel);w.stageFixedCollection();
 await assert.rejects(w.readCollectionCandidate(sel),/CANDIDATE_OFF/);w.close();
});
test('same P1G bridge blocks Stage before Backup and blocks both OPEN APIs after failed close',async()=>{
 class CloseOnce extends OwnerMock{close(){if(!this.failed){this.failed=true;throw Error('close denied')}super.close()}}
 const bytes=makeSyntheticP1gProfile({GameInfo:{Version:626},World:{},Player:{},Unknown:1}),file=new File([bytes],'source.p1g'),originalSha256=hash(bytes);
 const build={...SWITCH,externallyConfirmed:true},args={file,build,originalSha256};
 const b=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource:CloseOnce}),{allowScopedCollectionSource:true,readDurableOriginalBackup:async()=>new File([bytes],'durable.p1g')});
 await b.openScopedEncrypted(args);assert.equal(b.inspectFixedCollection(sel).fixedDefinitionVerified,true);
 await assert.rejects(b.stageFixedCollection(),/BACKUP_REQUIRED/);
 const n=OwnerMock.instances.length;assert.throws(()=>b.close(),/CLOSE_UNVERIFIED/);
 await assert.rejects(b.openScopedEncrypted(args),/CLOSE_UNVERIFIED/);
 await assert.rejects(b.openEncrypted({build,encryptedBytes:bytes}),/CLOSE_UNVERIFIED/);
 assert.equal(OwnerMock.instances.length,n);assert.deepEqual(b.close(),{closed:true,writerAuthorized:false});
 await b.openScopedEncrypted(args);await b.verifyScopedOriginalBackup(new File([bytes],'candidate.p1g'));
 b.previewFixedCollection(sel);assert.equal((await b.stageFixedCollection()).applied,true);
 assert.throws(()=>b.close(),/CLOSE_UNVERIFIED/);b.close();
});

test('protected Collection consumer binds existing local copy lifecycle: dual Build exact1, actual synthetic P1G codec, stale selection and close',async()=>{
 // Synthetic file and storage double only. Real Chrome OPFS/fresh Worker and
 // generated Rust are independent affected acceptance; no product V2 claim.
 const doc={GameInfo:{Version:626},World:{},Player:{CollectionSets:[{CollectionDefinitionID:2120000159,GroupData:[{GroupIndex:0,State:'SetState_NotComplete',GroupsCollectionItems:{40004511:false,40004668:false,40004669:false}}]}]},Unknown:{future:true}};
 const enc=makeSyntheticP1gProfile(doc),f=new File([enc],'synthetic.p1g'),origHash=hash(enc);
 const decoded=(await p1gPackagedProfileCodec.loadProfile(enc)).jsonText,decodedHash=hash(new TextEncoder().encode(decoded));
 const expected=structuredClone(doc);expected.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems[40004511]=true;
 const editedBytes=new TextEncoder().encode(JSON.stringify(expected)),editedHash=hash(editedBytes);
 let stages=0,opens=0;
 class LocalMock{
  constructor(){this.rev=0;opens++}
  append_chunk(){}
  finish(){return JSON.stringify({...ownerReceipt,decodedSha256:decodedHash})}
  check(s,r,g,h){assert.deepEqual([s,r,g,h],[id,BigInt(this.rev),BigInt(this.rev+1),decodedHash])}
  preview_fixed_collection(d,g,i,...args){this.check(...args);assert.deepEqual([d,g,i],[sel.definitionId,0,sel.itemId]);return JSON.stringify({...preview,decodedSha256:decodedHash})}
  mutation(applied){this.rev++;return JSON.stringify({contract:'wand.worker.scoped-edit@1',sessionId:id,revision:this.rev,indexGeneration:this.rev+1,decodedSha256:decodedHash,stagedDecodedSha256:editedHash,operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,originalOverwriteAuthorized:false})}
  stage_fixed_collection(d,g,i,e,...args){this.check(...args);assert.equal(e,entry);stages++;return this.mutation(true)}
  toggle_scoped_edit(redo,...args){this.check(...args);return this.mutation(redo)}
  begin_scoped_edit_output(...args){this.check(...args);return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:editedBytes.length,decodedSha256:editedHash,writerAuthorized:false,originalOverwriteAuthorized:false})}
  next_scoped_edit_output_chunk(){return editedBytes.slice()}
  close(){}
 }
 const files=new Map(),root={
  async getFileHandle(name,opts){
   if(!files.has(name)){if(!opts?.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});files.set(name,new Uint8Array())}
   return {async getFile(){return new File([files.get(name)],name)},async createWritable(){
    let pending;return {async write(b){pending=new Uint8Array(b)},async close(){files.set(name,pending)},async abort(){pending=null}}
   }}
  },async removeEntry(name){files.delete(name)}
 };
 const old=Object.getOwnPropertyDescriptor(navigator,'locks');
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,fn)=>fn()}});
 try{
  const make=()=>createProductFixedCollectionLocalAdapter({wasmFactory:async()=>({WorkerWasmSource:LocalMock}),getDirectory:async()=>root,
   freshCodecReopen:async(b,h)=>hash(new TextEncoder().encode((await p1gPackagedProfileCodec.loadProfile(b)).jsonText))===h});
  for(const identity of [STEAM,SWITCH]){
   const a=make(),build={...identity,externallyConfirmed:true},args={file:f,build,originalSha256:origHash};
   await a.open(args);const c=createCollectionExact1Consumer(a,{trustedLocalHarness:true});
   await c.load();assert.equal(c.snapshot().targets.length,1);
   const initialSelection=(await a.inspectCollectionTargets()).selection;
   await assert.rejects(async()=>a.stageCollectionTarget(initialSelection,0));assert.equal(stages,identity===STEAM?0:1);
   await c.backupOriginal();await c.preview(0);await c.stage();await c.undo();await assert.rejects(c.exportEditedCopy());await c.redo();await c.exportEditedCopy();
   const b=await c.downloadVerifiedCopy('backup'),e=await c.downloadVerifiedCopy('edited');
   assert.equal(hash(b.encryptedBytes),origHash);assert.equal((await p1gPackagedProfileCodec.loadProfile(e.encryptedBytes)).jsonText,JSON.stringify(expected));
   assert.notEqual(b.name,e.name);assert.notEqual(f.name,b.name);assert.equal(hash(new Uint8Array(await f.arrayBuffer())),origHash);
   await c.close();assert.equal(c.snapshot().phase,'closed');assert.equal(files.has(b.name),true);
   await a.open(args);const newer=await a.inspectCollectionTargets();assert.notEqual(newer.selection,initialSelection);
   await assert.rejects(async()=>a.backupOriginal(initialSelection));await a.backupOriginal(newer.selection);
   assert.deepEqual(await a.close(),{kind:'CLOSED',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
  }
  assert.equal(stages,2);assert.equal(opens,4);
 }finally{if(old)Object.defineProperty(navigator,'locks',old);else delete navigator.locks}
});
