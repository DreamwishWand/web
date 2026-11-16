import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {createProductCatalog0PortableLocalAdapter,createProductChestPortableLocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {createLocalPlacementDevWorkflow,STEAM626_PLACEMENT_BUILD} from '../src/lib/dev/local-placement-workflow.mjs';
import {createLocalCatalog0PortablePort,createLocalChestPortablePort,installLocalCatalog0PortableWorker,installLocalChestPortableWorker} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
import {CATALOG0_PORTABLE_RELEASE,CHEST_PORTABLE_RELEASE,getCatalog0PortableMountInfo,getChestPortableMountInfo} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),utf=s=>new TextEncoder().encode(s),h=c=>c.repeat(64),id='a'.repeat(32);
const build=STEAM626_PLACEMENT_BUILD;
function storage(){const files=new Map();return {files,root:{async getFileHandle(name,opts){if(!files.has(name)){if(!opts?.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});files.set(name,new Uint8Array())}return {async getFile(){return new File([files.get(name)],name)},async createWritable(){let pending;return {async write(b){pending=new Uint8Array(b)},async close(){files.set(name,pending)},async abort(){pending=null}}}}},async removeEntry(name){files.delete(name)}}}}
for(const [mode,create,install,portFactory,spec,mount] of [['catalog0',createProductCatalog0PortableLocalAdapter,installLocalCatalog0PortableWorker,createLocalCatalog0PortablePort,CATALOG0_PORTABLE_RELEASE,getCatalog0PortableMountInfo],['chest',createProductChestPortableLocalAdapter,installLocalChestPortableWorker,createLocalChestPortablePort,CHEST_PORTABLE_RELEASE,getChestPortableMountInfo]]){
 test(mode+' portable Restore actual local adapter + P1G + RPC with mock Rust ABI',async()=>{
  const chest=mode==='chest',item=chest?30200001:40000048,old=chest?50:3,next=old-1,selector=chest?{containerId:7,slotIndex:0}:{itemId:item},args=Object.values(selector),contract='wand.worker.steam626.'+mode+'-portable-restore@1';
  const source={GameInfo:{Version:626},Player:{Amount:old,Unknown:{keep:1}},Unknown:{future:true}},expected=structuredClone(source);expected.Player.Amount=next;
  const enc=makeSyntheticP1gProfile(source),file=new File([enc],'source.p1g'),originalSha256=hash(enc),decodedHash=hash(utf((await p1gPackagedProfileCodec.loadProfile(enc)).jsonText)),bytes=utf(JSON.stringify(expected)),projected=hash(bytes);
  const backup= utf('{"synthetic":"'+mode+'"}'),backupSha=hash(backup);
  const receipt={contract:'wand.product.single-save-session.boundary@1',sessionId:id,decodedSha256:decodedHash,revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false,allDomainReferencesVerified:false,productReadAccepted:false};
  let opens=0,closes=0,stages=0;
  class Mock{
   constructor(p,k,b){assert.deepEqual([p,k,b],[build.platform,build.buildKind,build.buildId]);this.rev=0;opens++}
   append_chunk(){}finish(){return JSON.stringify(receipt)}close(){closes++}
   check(a){assert.deepEqual(a,[id,BigInt(this.rev),BigInt(this.rev+1),decodedHash])}
   capture(...a){assert.deepEqual(a.slice(0,args.length),args);this.check(a.slice(args.length));return backup.slice()}
   preview(...a){assert.deepEqual(a.slice(0,args.length),args);assert.deepEqual(a[args.length],backup);this.check(a.slice(args.length+1));return JSON.stringify({contract,itemId:item,oldAmount:old,newAmount:next,entrySha256:h('b'),backupSha256:backupSha,projectedSha256:projected,writerAuthorized:false,...(chest?selector:{})})}
   mutation(applied){return JSON.stringify({contract,sessionId:id,revision:++this.rev,indexGeneration:this.rev+1,decodedSha256:decodedHash,stagedDecodedSha256:projected,operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,originalOverwriteAuthorized:false})}
   stage(...a){assert.deepEqual(a.slice(0,args.length),args);assert.deepEqual(a[args.length],backup);assert.deepEqual(a.slice(args.length+1,args.length+6),[old,next,h('b'),backupSha,projected]);this.check(a.slice(args.length+6));stages++;return this.mutation(true)}
   toggle(redo,...a){this.check(a);return this.mutation(redo)}
   begin(...a){this.check(a);return JSON.stringify({contract:'wand.worker.steam626.'+mode+'-portable-restore-output@1',decodedBytes:bytes.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})}
   chunk(){return bytes.slice()}
  }
  for(const [k,v] of [['capture_'+mode+'_portable_backup','capture'],['preview_'+mode+'_portable_restore','preview'],['stage_'+mode+'_portable_restore','stage'],['toggle_'+mode+'_portable_restore','toggle'],['begin_'+mode+'_portable_restore_output','begin'],['next_'+mode+'_portable_restore_output_chunk','chunk']])Mock.prototype[k]=Mock.prototype[v];
  const factory=async()=>({WorkerWasmSource:Mock}),{files,root}=storage(),lock=Object.getOwnPropertyDescriptor(navigator,'locks');
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_n,fn)=>fn()}});
  try{
   assert.equal(spec.methods.length,14);assert.equal(spec.exports.length,23);await assert.rejects(mount());
   const owner=createProductWasmReadOwner(factory,{portableScope:mode});assert.equal(typeof owner.capturePortableBackup,'function');assert.equal(owner.previewScopedAmount,undefined);assert.throws(()=>createProductWasmReadOwner(factory,{portableScope:mode,allowScopedAmountSource:true}));assert.throws(()=>createProductWasmReadOwner(factory,{portableScope:mode,placementScope:'rm01'}));
   const adapter=create({wasmFactory:factory,getDirectory:async()=>root,freshCodecReopen:async(b,s)=>hash(utf((await p1gPackagedProfileCodec.loadProfile(b)).jsonText))===s});
   await assert.rejects(adapter.open({file,originalSha256,build:{...build,platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D'}}));assert.equal(opens,0);
   const server={},worker={terminate(){}};server.postMessage=data=>{const copy=structuredClone(data);queueMicrotask(()=>worker.onmessage({data:copy}))};worker.postMessage=data=>{const copy=structuredClone(data);queueMicrotask(()=>server.onmessage({data:copy}))};
   install(server,adapter);const port=portFactory(worker),ui=createLocalPlacementDevWorkflow(port,{trustedLocalHarness:true,operation:'portable-'+mode});
   await ui.openFile({file,buildConfirmed:true});await assert.rejects(port.capturePortableBackup(selector));await ui.backupOriginal();
   await assert.rejects(port.capturePortableBackup(chest?{containerId:7,slotIndex:48}:{itemId:30200001}));await assert.rejects(port.previewPortableRestore(selector,new Uint8Array(1048577)));
   const b=await ui.capturePortableBackup(selector);assert.deepEqual(b.portableBytes,backup);assert.equal(b.name,'wand-'+mode+'-backup.wand.json');
   const restore=new File([b.portableBytes],b.name);await ui.preview(selector,restore);assert.equal(ui.snapshot().preview.newAmount,next);assert.equal(ui.snapshot().preview.entrySha256,undefined);
   await assert.rejects(port.stagePortableRestore({oldAmount:old}));await ui.stage();await ui.undo();await ui.redo();await ui.exportEditedCopy();
   const output=await ui.downloadVerifiedCopy('edited'),original=await ui.downloadVerifiedCopy('backup');assert.equal(hash(original.encryptedBytes),originalSha256);assert.equal((await p1gPackagedProfileCodec.loadProfile(output.encryptedBytes)).jsonText,JSON.stringify(expected));assert.notEqual(original.name,output.name);assert.equal(opens,1);assert.equal(stages,1);assert.equal(hash(new Uint8Array(await file.arrayBuffer())),originalSha256);await ui.close();assert.equal(closes,1);assert.equal(files.has(original.name),true);port.dispose();
  }finally{if(lock)Object.defineProperty(navigator,'locks',lock);else delete navigator.locks}
 });
}
