import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {createProductSteam626BackpackLocalAdapter,createProductSwitch626BackpackLocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),utf=s=>new TextEncoder().encode(s),id='a'.repeat(32),h=c=>c.repeat(64);
const steam={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true},sw={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626,externallyConfirmed:true};
const source={GameInfo:{Version:626},World:{Unknown:{keep:1}},Player:{ContainerInventories:{0:{ID:0,Size:2,ExtraSize:0,BelongsToPlayer:true,BlockMoveTo:false,ParentItemID:null,Inventory:[{ItemID:30200001,Amount:4,State:null,Unknown:'keep'},{ItemID:0,Amount:0,State:null}]}}},Unknown:{future:true}};
const enc=makeSyntheticP1gProfile(source),file=new File([enc],'source.p1g'),originalSha256=hash(enc),decodedHash=hash(utf((await p1gPackagedProfileCodec.loadProfile(enc)).jsonText));
const expected=structuredClone(source);expected.Player.ContainerInventories[0].Inventory[0].Amount=3;expected.Player.ContainerInventories[0].Inventory[1].ItemID=30200001;expected.Player.ContainerInventories[0].Inventory[1].Amount=1;
const bytes=utf(JSON.stringify(expected)),projected=hash(bytes),selector={sourceSlot:0,destinationSlot:1};
const receipt={contract:'wand.product.single-save-session.boundary@1',sessionId:id,decodedSha256:decodedHash,revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false,allDomainReferencesVerified:false,productReadAccepted:false};
function storage(){const files=new Map();return {files,root:{async getFileHandle(name,opts){if(!files.has(name)){if(!opts?.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});files.set(name,new Uint8Array())}return {async getFile(){return new File([files.get(name)],name)},async createWritable(){let pending;return {async write(b){pending=new Uint8Array(b)},async close(){files.set(name,pending)},async abort(){pending=null}}}}},async removeEntry(name){files.delete(name)}}}}
for(const [mode,create,build,foreign] of [['steam',createProductSteam626BackpackLocalAdapter,steam,sw],['switch',createProductSwitch626BackpackLocalAdapter,sw,steam]]){
 test(mode+' Backpack fixed local adapter actual synthetic P1G / strict one owner / exact3 / separate encrypted copy',async()=>{
  let opens=0,stages=0,closes=0;const prefix=mode+'626',contract='wand.worker.'+prefix+'.backpack-fruit-split@1';
  class Mock{
   constructor(p,k,b){assert.deepEqual([p,k,b],[build.platform,build.buildKind,build.buildId]);this.rev=0;opens++}append_chunk(){}finish(){return JSON.stringify(receipt)}
   check(a){assert.deepEqual(a,[id,BigInt(this.rev),BigInt(this.rev+1),decodedHash])}
   preview(s,d,...a){assert.deepEqual([s,d],[0,1]);this.check(a);return JSON.stringify({contract,containerId:0,sourceSlot:s,destinationSlot:d,itemId:30200001,oldAmount:4,quantity:1,definitionSha256:'9f9b24ad7ec2fc56149887d1b0824de24128cca6101f374ffd4f4b04bbb099cc',effectiveStackBound:50,witnessSha256:h('c'),projectedDecodedSha256:projected,sessionId:id,revision:0,indexGeneration:1,decodedSha256:decodedHash,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false})}
   mutation(c,applied){return JSON.stringify({contract:c,sessionId:id,revision:++this.rev,indexGeneration:this.rev+1,decodedSha256:decodedHash,stagedDecodedSha256:projected,operationCount:3,exactFieldChangedCount:3,applied,writerAuthorized:false,originalOverwriteAuthorized:false})}
   stage(s,d,o,w,p,...a){assert.deepEqual([s,d,o,w,p],[0,1,4,h('c'),projected]);this.check(a);stages++;return this.mutation(contract,true)}
   toggle_scoped_edit(redo,...a){this.check(a);return this.mutation('wand.worker.scoped-edit@1',redo)}
   begin_scoped_edit_output(...a){this.check(a);return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:bytes.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})}
   next_scoped_edit_output_chunk(){return bytes.slice()}close(){closes++}
  }
  Mock.prototype['preview_'+prefix+'_backpack_split']=Mock.prototype.preview;Mock.prototype['stage_'+prefix+'_backpack_split']=Mock.prototype.stage;
  const factory=async()=>({WorkerWasmSource:Mock}),{files,root}=storage(),old=Object.getOwnPropertyDescriptor(navigator,'locks');
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,fn)=>fn()}});
  try{
   const a=create({wasmFactory:factory,getDirectory:async()=>root,freshCodecReopen:async(b,s)=>hash(utf((await p1gPackagedProfileCodec.loadProfile(b)).jsonText))===s});
   assert.equal(a.stageTyped,undefined);assert.equal(a.previewPlacement,undefined);assert.equal(a.stageCollectionTarget,undefined);
   for(const opts of [{allowScopedAmountSource:true},{allowScopedCollectionSource:true},{allowCollectionCandidateSource:true},{placementScope:'vase'}])assert.throws(()=>createProductWasmReadOwner(factory,{backpackScope:mode,...opts}));
   await assert.rejects(a.open({file,build:foreign,originalSha256}));assert.equal(opens,0);
   await a.open({file,build,originalSha256});assert.equal(opens,1);await assert.rejects(async()=>a.previewBackpack(selector));await assert.rejects(async()=>a.stageBackpack());assert.equal(stages,0);
   await a.backupOriginal();const p=await a.previewBackpack(selector);assert.equal(p.oldAmount,4);assert.equal(p.newSourceAmount,3);assert.equal(p.newDestinationAmount,1);assert.equal(p.witnessSha256,undefined);
   assert.equal((await a.stageBackpack()).exactFieldChangedCount,3);await a.undo();await assert.rejects(async()=>a.exportEditedCopy());await a.redo();await a.exportEditedCopy();
   const b=await a.downloadVerifiedCopy('backup'),e=await a.downloadVerifiedCopy('edited');assert.equal(hash(b.encryptedBytes),originalSha256);assert.equal((await p1gPackagedProfileCodec.loadProfile(e.encryptedBytes)).jsonText,JSON.stringify(expected));assert.notEqual(b.name,e.name);assert.equal(hash(new Uint8Array(await file.arrayBuffer())),originalSha256);assert.equal(opens,1);assert.equal(stages,1);assert.equal(closes,1);
   await a.close();assert.equal(files.has(b.name),true);await assert.rejects(async()=>a.downloadVerifiedCopy('edited'));
  }finally{if(old)Object.defineProperty(navigator,'locks',old);else delete navigator.locks}
 });
}
