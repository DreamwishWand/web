// Changed adapter only. Mock imported bridge, mock OPFS; no Rust/Codec retest.
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
let factory;
mock.module('../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs',{namedExports:{createP1gRustWorkerReadOnlyBridge:(...args)=>factory(...args)}});
const {createPr929LocalDevAmountAdapter}=await import('../src/lib/dev/local-amount-worker-adapter.mjs');
const {STEAM626_FULL_VERSION}=await import('../src/lib/dev/local-amount-workflow.mjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytesA=Buffer.alloc(64,0x41),bytesB=Buffer.alloc(65,0x42);
const args=(name,bytes)=>({file:new File([bytes],name),originalSha256:sha(bytes),build:{platform:'steam-windows',buildKind:'steam-full-version',buildId:STEAM626_FULL_VERSION,schema:626,externallyConfirmed:true}});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const inv=()=>({kind:'InventoryExistingAmountDecrease',targetId:4,itemId:30000001,slotIndex:0,compatibleItemType:'ItemType_Ingredient',oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true});
function setup({directory,provider,writeHook,exportHook}={}){
 const entries=new Map(),writes=[],removed=[];let opened=0,closed=0,verify;
 const root={async getFileHandle(name,{create=false}={}){
  if(!entries.has(name)){if(!create)throw new DOMException('missing','NotFoundError');entries.set(name,new Uint8Array())}
  return{async createWritable(){return{async write(b){writes.push(name);if(writeHook)await writeHook(name);entries.set(name,new Uint8Array(b))},async close(){},async abort(){}}},async getFile(){return new File([entries.get(name)],name)}}
 },async removeEntry(n){removed.push(n);entries.delete(n)}};
 Object.defineProperty(globalThis.navigator,'storage',{configurable:true,value:{getDirectory:directory?()=>directory(root):async()=>root}});
 factory=(_f,opts)=>{verify=opts.verifyDurableBackupDev;return{
  close(){closed++},async openEncrypted(){opened++;return{schema:626,writerAuthorized:false,sessionId:'mock',revision:0,indexGeneration:1,decodedSha256:'a'.repeat(64)}},
  devStageTypedAmounts(){return{revision:1,indexGeneration:2}},devUndoTypedAmounts(){return{revision:2,indexGeneration:3}},devRedoTypedAmounts(){return{revision:3,indexGeneration:4}},
  async devCreateEncodedEditedOnce(){if(exportHook)await exportHook();return{writerAuthorized:false,originalOverwriteAuthorized:false,nativeV3Verified:false,editedCiphertext:new Uint8Array([1,2,3]),editedSha256:sha(Buffer.from([1,2,3])),stagedDecodedSha256:'b'.repeat(64)}}
 }};
 const a=createPr929LocalDevAmountAdapter({wasmFactory:()=>{},verifyTargets:provider|| (async()=>[inv()])});
 return{a,root,entries,writes,removed,verify:(x)=>verify(x),counts:()=>({opened,closed})};
}
test('adapter source generation: late A open directory cannot revoke B',async()=>{
 const entered=defer(),end=defer();let n=0;
 const {a,entries}=setup({directory:async root=>{if(++n===1){entered.resolve();await end.promise}return root}});
 const p=a.open(args('A.p1g',bytesA)),denied=assert.rejects(p);await entered.promise;
 await a.open(args('B.p1g',bytesB));end.resolve();await denied;
 const r=await a.backupOriginal();assert.equal(r.originalName,'B.p1g');assert.equal(r.originalSha256,sha(bytesB));assert.equal(r.originalSizeBytes,65);assert.equal(entries.size,1);await a.close();
});
test('adapter late backup write after B cancels old file, keeps B and durable binding',async()=>{
 const entered=defer(),end=defer();let n=0;
 const {a,entries,removed,verify}=setup({writeHook:async()=>{if(++n===1){entered.resolve();await end.promise}}});
 await a.open(args('A.p1g',bytesA));const p=a.backupOriginal(),denied=assert.rejects(p);await entered.promise;await a.close();await a.open(args('B.p1g',bytesB));const r=await a.backupOriginal();end.resolve();await denied;
 assert.equal(entries.size,1);assert.ok(entries.has(r.backupName));assert.equal(removed.length,1);assert.equal(r.originalSha256,sha(bytesB));
 assert.equal((await verify({originalEncryptedSha256:sha(bytesB),originalEncryptedSizeBytes:65})).sha256,sha(bytesB));
 entries.set(r.backupName,bytesA);await assert.rejects(verify({originalEncryptedSha256:sha(bytesB),originalEncryptedSizeBytes:65}));await a.close();
});
test('adapter stale provider list cannot populate new source',async()=>{
 const entered=defer(),end=defer();let n=0;
 const {a}=setup({provider:async()=>{if(++n===1){entered.resolve();await end.promise;return[inv()]}return[]}});
 await a.open(args('A.p1g',bytesA));await a.backupOriginal();const p=a.listVerifiedTargets(),denied=assert.rejects(p);await entered.promise;await a.open(args('B.p1g',bytesB));await a.backupOriginal();end.resolve();await denied;assert.deepEqual((await a.listVerifiedTargets()).targets,[]);
 await assert.rejects(a.stageTyped([{kind:'InventoryExistingAmountDecrease',inventoryId:4,canonicalItemId:30000001,compatibleItemType:'ItemType_Ingredient',expectedOldAmount:50,newAmount:49}]));await a.close();
});
test('adapter stale export before write cannot create Edited-copy or revoke B',async()=>{
 const entered=defer(),end=defer();const {a,entries,writes}=setup({exportHook:async()=>{entered.resolve();await end.promise}});
 await a.open(args('A.p1g',bytesA));await a.backupOriginal();await a.listVerifiedTargets();await a.stageTyped([{kind:'InventoryExistingAmountDecrease',inventoryId:4,canonicalItemId:30000001,compatibleItemType:'ItemType_Ingredient',expectedOldAmount:50,newAmount:49}]);
 const p=a.exportEditedCopy(),denied=assert.rejects(p);await entered.promise;await a.open(args('B.p1g',bytesB));const b=await a.backupOriginal();end.resolve();await denied;
 assert.equal(entries.size,2);assert.equal(writes.length,2);assert.ok(entries.has(b.backupName));assert.ok([...entries.keys()].every(k=>k.startsWith('wand-original-backup-')));await a.close();
});
