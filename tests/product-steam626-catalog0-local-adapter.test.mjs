import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {createProductSteam626Catalog0LocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION} from '../src/lib/dev/local-amount-workflow.mjs';
import {installLocalDevAmountWorker,createLocalAmountDevPort} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const sw={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626,externallyConfirmed:true};
const steam={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const id='a'.repeat(32),entry='b'.repeat(64),profile='catalog0-furniture',tag='wand.worker.steam626.scoped-amount@1';
const command={kind:'InventoryExistingAmountDecrease',inventoryId:0,canonicalItemId:40000048,compatibleItemType:'ItemType_Furniture',expectedOldAmount:3,newAmount:2};
const doc={GameInfo:{Version:626},World:{},Player:{ListInventories:{0:{ID:0,CompatibleItemType:'ItemType_Furniture',Inventory:{'40000048':{Amount:3,Marker:'ItemMarker_None'}}}}},Unknown:{future:true}};
const enc=makeSyntheticP1gProfile(doc),file=new File([enc],'synthetic.p1g'),originalSha256=hash(enc);
const decodedSha256=hash(new TextEncoder().encode((await p1gPackagedProfileCodec.loadProfile(enc)).jsonText));
const expected=structuredClone(doc);expected.Player.ListInventories[0].Inventory['40000048'].Amount=2;
const outBytes=new TextEncoder().encode(JSON.stringify(expected)),outSha=hash(outBytes);
const row={profile,id:0,selector:40000048,itemId:40000048,oldAmount:3};
class Mock {
 static opens=0;static stages=0;static last=null;
 constructor(p,k,b){assert.deepEqual([p,k,b],[steam.platform,steam.buildKind,steam.buildId]);Mock.opens++;Mock.last=this;this.rev=0;}
 scope(){return {sessionId:id,revision:this.rev,indexGeneration:this.rev+1,decodedSha256}}
 check(s,r,g,h){assert.deepEqual([s,r,g,h],[id,BigInt(this.rev),BigInt(this.rev+1),decodedSha256])}
 append_chunk(){}
 finish(){return JSON.stringify({contract:'wand.product.single-save-session.boundary@1',...this.scope(),schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,allDomainReferencesVerified:false,productReadAccepted:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false})}
 discover_scoped_amount(p,offset,...a){assert.equal(p,profile);this.check(...a);assert.equal(offset,0);return JSON.stringify({contract:'wand.worker.steam626.scoped-amount-discovery@1',profile,...this.scope(),offset,nextOffset:null,scanned:1,rows:[row],writerAuthorized:false,editedCopyAuthorized:false})}
 preview_scoped_amount(p,container,slot,n,...a){assert.equal(p,profile);this.check(...a);assert.deepEqual([container,slot,n],[0,40000048,2]);return JSON.stringify({contract:tag,...row,newAmount:n,entrySha256:entry,...this.scope(),scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false})}
 mutation(contract,applied){this.rev++;return JSON.stringify({contract,...this.scope(),stagedDecodedSha256:outSha,operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,originalOverwriteAuthorized:false})}
 stage_scoped_amount(p,container,slot,old,n,e,...a){assert.equal(p,profile);this.check(...a);assert.deepEqual([container,slot,old,n,e],[0,40000048,3,2,entry]);Mock.stages++;return this.mutation(tag,true)}
 toggle_scoped_amount(redo,...a){this.check(...a);return this.mutation('wand.worker.steam626.scoped-amount@1',redo)}
 begin_scoped_amount_output(...a){this.check(...a);return JSON.stringify({contract:'wand.worker.steam626.scoped-amount-output@1',decodedBytes:outBytes.length,decodedSha256:outSha,writerAuthorized:false,originalOverwriteAuthorized:false})}
 next_scoped_amount_output_chunk(){return outBytes.slice()}
 close(){this.closed=true}
}
const factory=async()=>({WorkerWasmSource:Mock});
test('Steam Catalog0 local adapter uses one owner, actual synthetic P1G codec, durable Backup, exact typed Stage and separate Reopen',async()=>{
 const files=new Map(),root={async getFileHandle(name,opts){if(!files.has(name)){if(!opts?.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});files.set(name,new Uint8Array())}return {async getFile(){return new File([files.get(name)],name)},async createWritable(){let pending;return {async write(b){pending=new Uint8Array(b)},async close(){files.set(name,pending)},async abort(){pending=null}}}}},async removeEntry(name){files.delete(name)}};
 const old=Object.getOwnPropertyDescriptor(navigator,'locks');Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,fn)=>fn()}});
 try{
  const a=createProductSteam626Catalog0LocalAdapter({wasmFactory:factory,getDirectory:async()=>root,freshCodecReopen:async(b,h)=>hash(new TextEncoder().encode((await p1gPackagedProfileCodec.loadProfile(b)).jsonText))===h});
  await assert.rejects(a.open({file,build:sw,originalSha256}));assert.equal(Mock.opens,0);
  await a.open({file,build:steam,originalSha256});assert.equal(Mock.opens,1);
  await assert.rejects(async()=>a.stageTyped([command]));assert.equal(Mock.stages,0);
  await a.backupOriginal();const list=await a.listVerifiedTargets();assert.equal(list.targets[0].oldAmount,3);assert.equal(list.targets[0].slotIndex,0);
  await a.stageTyped([command]);assert.equal(Mock.stages,1);await a.undo();await assert.rejects(async()=>a.exportEditedCopy());await a.redo();await a.exportEditedCopy();
  const backup=await a.downloadVerifiedCopy('backup'),edit=await a.downloadVerifiedCopy('edited');
  assert.equal(hash(backup.encryptedBytes),originalSha256);assert.equal((await p1gPackagedProfileCodec.loadProfile(edit.encryptedBytes)).jsonText,JSON.stringify(expected));assert.notEqual(backup.name,edit.name);
  assert.equal(hash(new Uint8Array(await file.arrayBuffer())),originalSha256);assert.equal(Mock.opens,1);assert.equal(Mock.last.closed,true);assert.equal((await a.close()).kind,'CLOSED');
 }finally{if(old)Object.defineProperty(navigator,'locks',old);else delete navigator.locks}
});
test('Steam Catalog0 scope is constructor-fixed, exclusive; failed Close prevents new session',async()=>{
 assert.throws(()=>createProductSteam626Catalog0LocalAdapter({wasmFactory:factory,coreDiscoveryProfile:'linked-crop-chest48'}));
 assert.throws(()=>createProductSteam626Catalog0LocalAdapter({wasmFactory:factory,discoverScopedTargets:()=>[]}));
 for(const opts of [{allowScopedAmountSource:true},{allowScopedCollectionSource:true},{allowCollectionCandidateSource:true}])assert.throws(()=>createProductWasmReadOwner(factory,{allowSteam626Catalog0Source:true,...opts}));
 class CloseOnce extends Mock{close(){if(!this.failed){this.failed=true;throw Error('denied')}super.close()}}
 const owner=createProductWasmReadOwner(async()=>({WorkerWasmSource:CloseOnce}),{allowSteam626Catalog0Source:true});
 const chunks=async function*(){yield new Uint8Array([1])};const open=build=>owner.openDecoded({build,decodedChunks:chunks()});
 await assert.rejects(open(sw));await open(steam);const count=Mock.opens;assert.throws(()=>owner.close(),/CLOSE_UNVERIFIED/);
 await assert.rejects(open(steam),/CLOSE_UNVERIFIED/);assert.equal(Mock.opens,count);assert.deepEqual(owner.close(),{closed:true,writerAuthorized:false});
 await open(steam);assert.equal(Mock.opens,count+1);assert.throws(()=>owner.close(),/CLOSE_UNVERIFIED/);owner.close();
});

