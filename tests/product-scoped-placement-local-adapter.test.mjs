import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {createProductSteam626Comp03LocalAdapter,createProductSteam626VaseAddLocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const hash=b=>createHash('sha256').update(b).digest('hex'),utf=s=>new TextEncoder().encode(s),id='a'.repeat(32),h=c=>c.repeat(64);
const build={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const source={GameInfo:{Version:626},World:{GridCollection:{Grids:{7:{NextGridObjectID:9,Objects:{4:{ID:4,ItemID:40100038,X:4,Y:4,Orientation:'GridOrientation_Down',State:null}}}}}},Player:{ListInventories:{0:{Inventory:{40000066:{Amount:3},40100038:{Amount:30}}}}},Unknown:{future:true}};
const enc=makeSyntheticP1gProfile(source),file=new File([enc],'source.p1g'),originalSha256=hash(enc);
const decodedHash=hash(utf((await p1gPackagedProfileCodec.loadProfile(enc)).jsonText));
const openReceipt={contract:'wand.product.single-save-session.boundary@1',sessionId:id,decodedSha256:decodedHash,revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false,allDomainReferencesVerified:false,productReadAccepted:false};
function mock(mode){
 const count=mode==='comp03'?9:3,contract=mode==='comp03'?'wand.worker.steam626.scoped-comp03-layout@1':'wand.worker.steam626.scoped-vase-add@1';
 const expected=structuredClone(source),grid=expected.World.GridCollection.Grids[7];
 if(mode==='comp03'){let n=9;for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(x||y)grid.Objects[n]={ID:n++,ItemID:40100038,X:4+x*4,Y:4+y*4,Orientation:'GridOrientation_Down',State:null};grid.NextGridObjectID=17}
 else{grid.Objects[9]={ID:9,ItemID:40000066,X:8,Y:8,Orientation:'GridOrientation_Up',State:null};grid.NextGridObjectID=10;expected.Player.ListInventories[0].Inventory[40000066].Amount=2}
 const bytes=utf(JSON.stringify(expected)),projected=hash(bytes);
 const p={contract,itemId:mode==='comp03'?40100038:40000066,gridId:7,nextObjectId:9,oldAmount:mode==='comp03'?30:3,newAmount:mode==='comp03'?30:2,gridSha256:h('c'),projectedDecodedSha256:projected,sessionId:id,revision:0,indexGeneration:1,decodedSha256:decodedHash,exactFieldChangedCount:count,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false,...(mode==='comp03'?{seedId:4,inventoryDelta:0,seedSha256:h('d'),inventoryEntrySha256:h('e')}:{inventoryId:0,x:8,y:8,orientation:'GridOrientation_Up',entrySha256:h('d')})};
 let opens=0,stages=0,closes=0;
 class Mock{
  constructor(){this.rev=0;opens++}append_chunk(){}finish(){return JSON.stringify(openReceipt)}
  check(a){assert.deepEqual(a,[id,BigInt(this.rev),BigInt(this.rev+1),decodedHash])}
  preview_steam626_comp03(s,...a){assert.equal(mode,'comp03');assert.equal(s,4);this.check(a);return JSON.stringify(p)}
  preview_steam626_vase_add(g,x,y,...a){assert.equal(mode,'vase');assert.deepEqual([g,x,y],[7,8,8]);this.check(a);return JSON.stringify(p)}
  receipt(c,applied){return JSON.stringify({contract:c,sessionId:id,revision:++this.rev,indexGeneration:this.rev+1,decodedSha256:decodedHash,stagedDecodedSha256:projected,operationCount:count,exactFieldChangedCount:count,applied,writerAuthorized:false,originalOverwriteAuthorized:false})}
  stage_steam626_comp03(s,g,n,o,gs,ss,is,ps,...a){assert.equal(mode,'comp03');assert.deepEqual([s,g,n,o,gs,ss,is,ps],[4,7,9,30,h('c'),h('d'),h('e'),projected]);this.check(a);stages++;return this.receipt(contract,true)}
  stage_steam626_vase_add(g,x,y,o,n,es,gs,ps,...a){assert.equal(mode,'vase');assert.deepEqual([g,x,y,o,n,es,gs,ps],[7,8,8,3,9,h('d'),h('c'),projected]);this.check(a);stages++;return this.receipt(contract,true)}
  toggle_scoped_edit(redo,...a){this.check(a);return this.receipt('wand.worker.scoped-edit@1',redo)}
  begin_scoped_edit_output(...a){this.check(a);return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:bytes.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})}
  next_scoped_edit_output_chunk(){return bytes.slice()}close(){closes++}
 }
 return {factory:async()=>({WorkerWasmSource:Mock}),expected,count,opens:()=>opens,stages:()=>stages,closes:()=>closes};
}
function storage(){
 const files=new Map();return {files,root:{async getFileHandle(name,opts){if(!files.has(name)){if(!opts?.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});files.set(name,new Uint8Array())}return {async getFile(){return new File([files.get(name)],name)},async createWritable(){let pending;return {async write(b){pending=new Uint8Array(b)},async close(){files.set(name,pending)},async abort(){pending=null}}}}},async removeEntry(name){files.delete(name)}}};
}
for(const [mode,create,selector] of [['comp03',createProductSteam626Comp03LocalAdapter,{seedId:4}],['vase',createProductSteam626VaseAddLocalAdapter,{gridId:7,x:8,y:8}]]){
 test(mode+' fixed local adapter uses one owner and actual synthetic P1G / durable backup / exact projection / fresh reopen',async()=>{
  const m=mock(mode),{files,root}=storage(),old=Object.getOwnPropertyDescriptor(navigator,'locks');
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,fn)=>fn()}});
  try{
   const a=create({wasmFactory:m.factory,getDirectory:async()=>root,freshCodecReopen:async(b,sha)=>hash(utf((await p1gPackagedProfileCodec.loadProfile(b)).jsonText))===sha});
   assert.equal(a.stageTyped,undefined);assert.equal(a.stageCollectionTarget,undefined);
   assert.throws(()=>createProductWasmReadOwner(m.factory,{placementScope:mode,allowScopedAmountSource:true}));
   assert.throws(()=>createProductWasmReadOwner(m.factory,{placementScope:mode,allowCollectionCandidateSource:true}));
   await a.open({file,build,originalSha256});assert.equal(m.opens(),1);
   await assert.rejects(async()=>a.previewPlacement(selector));await assert.rejects(async()=>a.stagePlacement());assert.equal(m.stages(),0);
   await a.backupOriginal();const preview=await a.previewPlacement(selector);
   assert.equal(preview.exactFieldChangedCount,m.count);assert.equal(preview.sessionId,undefined);
   assert.equal((await a.stagePlacement()).exactFieldChangedCount,m.count);assert.equal(m.stages(),1);
   await a.undo();await assert.rejects(async()=>a.exportEditedCopy());await a.redo();await a.exportEditedCopy();
   const b=await a.downloadVerifiedCopy('backup'),e=await a.downloadVerifiedCopy('edited');
   assert.equal(hash(b.encryptedBytes),originalSha256);assert.equal((await p1gPackagedProfileCodec.loadProfile(e.encryptedBytes)).jsonText,JSON.stringify(m.expected));assert.notEqual(b.name,e.name);assert.equal(hash(new Uint8Array(await file.arrayBuffer())),originalSha256);assert.equal(m.opens(),1);assert.equal(m.closes(),1);
   await a.close();await assert.rejects(async()=>a.downloadVerifiedCopy('edited'));assert.equal(files.has(b.name),true);
   await assert.rejects(a.open({file,originalSha256,build:{...build,platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D'}}));assert.equal(m.opens(),1);
  }finally{if(old)Object.defineProperty(navigator,'locks',old);else delete navigator.locks}
 });
}
