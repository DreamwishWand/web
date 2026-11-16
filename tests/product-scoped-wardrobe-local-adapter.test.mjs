import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {createProductSteam626WardrobeLocalAdapter,createProductSwitch626WardrobeLocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalWardrobeDevWorker,createLocalWardrobeDevPort} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
import {createLocalWardrobeDevWorkflow} from '../src/lib/dev/local-placement-workflow.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),utf=s=>new TextEncoder().encode(s),id='a'.repeat(32),h=c=>c.repeat(64);
const steam={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true},sw={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626,externallyConfirmed:true};
const source={GameInfo:{Version:626},World:{Unknown:{keep:1}},Player:{AvatarIsMale:true,MaleAvatar:{Clothes:{0:50000352,1:50100047}},ListInventories:{1:{Inventory:{50000352:{Amount:8},50000214:{Amount:9}}}}},Unknown:{future:true}};
const enc=makeSyntheticP1gProfile(source),file=new File([enc],'source.p1g'),originalSha256=hash(enc),decodedHash=hash(utf((await p1gPackagedProfileCodec.loadProfile(enc)).jsonText));
const expected=structuredClone(source);expected.Player.MaleAvatar.Clothes[0]=50000214;
const bytes=utf(JSON.stringify(expected)),projected=hash(bytes);
const receipt={contract:'wand.product.single-save-session.boundary@1',sessionId:id,decodedSha256:decodedHash,revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false,allDomainReferencesVerified:false,productReadAccepted:false};
function storage(){const files=new Map();return {files,root:{async getFileHandle(name,opts){if(!files.has(name)){if(!opts?.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});files.set(name,new Uint8Array())}return {async getFile(){return new File([files.get(name)],name)},async createWritable(){let pending;return {async write(b){pending=new Uint8Array(b)},async close(){files.set(name,pending)},async abort(){pending=null}}}}},async removeEntry(name){files.delete(name)}}}}
for(const [mode,create,build,foreign] of [['steam',createProductSteam626WardrobeLocalAdapter,steam,sw],['switch',createProductSwitch626WardrobeLocalAdapter,sw,steam]]){
 test(mode+' Wardrobe fixed local adapter synthetic P1G / one owner / exact1 / separate encrypted copy',async()=>{
  let opens=0,stages=0,closes=0;const prefix=mode+'626',contract='wand.worker.'+prefix+'.wardrobe-same-slot@1';
  class Mock{
   constructor(p,k,b){assert.deepEqual([p,k,b],[build.platform,build.buildKind,build.buildId]);this.rev=0;opens++}append_chunk(){}finish(){return JSON.stringify(receipt)}
   check(a){assert.deepEqual(a,[id,BigInt(this.rev),BigInt(this.rev+1),decodedHash])}
   preview(...a){this.check(a);return JSON.stringify({contract,slot:0,oldItemId:50000352,newItemId:50000214,definitionPackSha256:'9bcf2cf489238074df8ea0b385a6675c8efcd51bb009cac37d8e107ec1a5d0b2',witnessSha256:h('c'),projectedDecodedSha256:projected,sessionId:id,revision:0,indexGeneration:1,decodedSha256:decodedHash,writerAuthorized:false,originalOverwriteAuthorized:false})}
   mutation(c,applied){return JSON.stringify({contract:c,sessionId:id,revision:++this.rev,indexGeneration:this.rev+1,decodedSha256:decodedHash,stagedDecodedSha256:projected,operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,originalOverwriteAuthorized:false})}
   stage(o,n,w,p,...a){assert.deepEqual([o,n,w,p],[50000352,50000214,h('c'),projected]);this.check(a);stages++;return this.mutation(contract,true)}
   toggle_scoped_edit(redo,...a){this.check(a);return this.mutation('wand.worker.scoped-edit@1',redo)}
   begin_scoped_edit_output(...a){this.check(a);return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:bytes.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})}
   next_scoped_edit_output_chunk(){return bytes.slice()}close(){closes++}
  }
  Mock.prototype['preview_'+prefix+'_wardrobe']=Mock.prototype.preview;Mock.prototype['stage_'+prefix+'_wardrobe']=Mock.prototype.stage;
  const factory=async()=>({WorkerWasmSource:Mock}),{files,root}=storage(),old=Object.getOwnPropertyDescriptor(navigator,'locks');
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,fn)=>fn()}});
  try{
   const a=create({wasmFactory:factory,getDirectory:async()=>root,freshCodecReopen:async(b,s)=>hash(utf((await p1gPackagedProfileCodec.loadProfile(b)).jsonText))===s});
   assert.equal(a.stageTyped,undefined);assert.equal(a.previewPlacement,undefined);assert.equal(a.previewBackpack,undefined);assert.equal(a.stageCollectionTarget,undefined);
   for(const opts of [{allowScopedAmountSource:true},{allowScopedCollectionSource:true},{allowCollectionCandidateSource:true},{placementScope:'vase'},{backpackScope:'steam'},{allowSwitch626ChestSource:true},{allowSteam626ChestSource:true},{allowSwitch626Catalog0Source:true}])assert.throws(()=>createProductWasmReadOwner(factory,{wardrobeScope:mode,...opts}));
   await assert.rejects(a.open({file,build:foreign,originalSha256}));assert.equal(opens,0);
   await a.open({file,build,originalSha256});assert.equal(opens,1);await assert.rejects(async()=>a.previewWardrobe());await assert.rejects(async()=>a.stageWardrobe());assert.equal(stages,0);
   await a.backupOriginal();const p=await a.previewWardrobe();assert.equal(p.oldItemId,50000352);assert.equal(p.newItemId,50000214);assert.equal(p.witnessSha256,undefined);
   assert.equal((await a.stageWardrobe()).exactFieldChangedCount,1);await a.undo();await assert.rejects(async()=>a.exportEditedCopy());await a.redo();await a.exportEditedCopy();
   const b=await a.downloadVerifiedCopy('backup'),e=await a.downloadVerifiedCopy('edited');assert.equal(hash(b.encryptedBytes),originalSha256);assert.equal((await p1gPackagedProfileCodec.loadProfile(e.encryptedBytes)).jsonText,JSON.stringify(expected));assert.notEqual(b.name,e.name);assert.equal(hash(new Uint8Array(await file.arrayBuffer())),originalSha256);assert.equal(opens,1);assert.equal(stages,1);assert.equal(closes,1);
   await a.close();assert.equal(files.has(b.name),true);await assert.rejects(async()=>a.downloadVerifiedCopy('edited'));
   const server={},worker={terminate(){}};server.postMessage=data=>{const copy=structuredClone(data);queueMicrotask(()=>worker.onmessage({data:copy}))};worker.postMessage=data=>queueMicrotask(()=>server.onmessage({data}));
   installLocalWardrobeDevWorker(server,a);const port=createLocalWardrobeDevPort(worker);const ui=createLocalWardrobeDevWorkflow(port,{trustedLocalHarness:true,platform:build.platform});
   assert.equal(port.previewPlacement,undefined);assert.equal(port.previewBackpack,undefined);assert.equal(port.stageTyped,undefined);
   await ui.openFile({file,buildConfirmed:true});await ui.backupOriginal();await assert.rejects(port.previewWardrobe({slot:0}));await assert.rejects(port.stageWardrobe({newItemId:50000214}));assert.equal(stages,1);
   await ui.preview();assert.equal(ui.snapshot().preview.newItemId,50000214);await ui.stage();await ui.undo();await ui.redo();await ui.exportEditedCopy();
   const out=await ui.downloadVerifiedCopy('edited');assert.equal((await p1gPackagedProfileCodec.loadProfile(out.encryptedBytes)).jsonText,JSON.stringify(expected));assert.equal(opens,2);assert.equal(stages,2);await ui.close();port.dispose();
  }finally{if(old)Object.defineProperty(navigator,'locks',old);else delete navigator.locks}
 });
}
