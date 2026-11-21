// 04 QR-W distinct Web Worker contract L2 for original 01A PR2356, SOURCE FIXED.
// Synthetic Worker is untrusted at the JS boundary. Rust ABI and actual
// encrypted Owner P1G tests belong to 05 QR-C/05 QR-L, not this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSteam626Catalog0Transport,createSwitch626Catalog0Transport} from
 '../src/lib/ddv/core/save/product-scoped-amount-transport.mjs';
import {createProductWasmReadOwner} from
 '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {createProductSteam626Catalog0LocalAdapter} from
 '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';

const BUILD=Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',
 buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626});
const S='1'.repeat(32),H='a'.repeat(64),ENTRY='b'.repeat(64),ITEM=40000048;
const CONTRACT='wand.worker.steam626.scoped-amount@1';
const ENCODED=new TextEncoder().encode('{"GameInfo":{"Version":626},"Unknown":{"retained":true}}');
const STAGED=createHash('sha256').update(ENCODED).digest('hex');
const INITIAL=Object.freeze({contract:'wand.product.single-save-session.boundary@1',
 sessionId:S,decodedSha256:H,revision:0,indexGeneration:1,schema:626,
 productWorkerBound:true,fullDocumentJsonValidated:true,
 allDomainReferencesVerified:false,productReadAccepted:false,
 writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});
const SELECTION=Object.freeze({profile:'catalog0-furniture',id:0,
 selector:ITEM,newAmount:2});
const ROW=Object.freeze({profile:'catalog0-furniture',id:0,
 selector:ITEM,itemId:ITEM,oldAmount:3});
const hash=v=>createHash('sha256').update(v).digest('hex');

function make(changes={}){
 let revoked=false,revision=0,next=0,partCopies=[];
 const scoped=()=>({sessionId:S,revision,indexGeneration:revision+1,decodedSha256:H});
 const packet=(obj)=>JSON.stringify(obj);
 const change=(key,record)=>typeof changes[key]==='function'?changes[key](record):record;
 const methods={
  discover_scoped_amount(profile,offset,s,rev,gen,sha){
   assert.equal(profile,'catalog0-furniture');
   assert.deepEqual([offset,s,rev,gen,sha],[0,S,0n,1n,H]);
   return packet(change('discover',{contract:'wand.worker.steam626.scoped-amount-discovery@1',
    profile,...scoped(),offset:0,nextOffset:null,scanned:1,rows:[{...ROW}],
    writerAuthorized:false,editedCopyAuthorized:false}));
  },
  preview_scoped_amount(profile,id,selector,newAmount,s,rev,gen,sha){
   assert.deepEqual([profile,id,selector,newAmount,s,rev,gen,sha],
    ['catalog0-furniture',0,ITEM,2,S,BigInt(revision),BigInt(revision+1),H]);
   return packet(change('preview',{contract:CONTRACT,...ROW,newAmount,
    entrySha256:ENTRY,...scoped(),scopedCandidate:true,
    writerAuthorized:false,editedCopyAuthorized:false}));
  },
  stage_scoped_amount(profile,id,selector,oldAmount,newAmount,entry,s,rev,gen,sha){
   assert.deepEqual([profile,id,selector,oldAmount,newAmount,entry,s,rev,gen,sha],
    ['catalog0-furniture',0,ITEM,3,2,ENTRY,S,BigInt(revision),BigInt(revision+1),H]);
   revision++;return packet(change('stage',stageReceipt(true)));
  },
  toggle_scoped_amount(redo,s,rev,gen,sha){
   assert.deepEqual([s,rev,gen,sha],[S,BigInt(revision),BigInt(revision+1),H]);
   revision++;return packet(change('toggle',stageReceipt(redo)));
  },
  begin_scoped_amount_output(s,rev,gen,sha){
   assert.deepEqual([s,rev,gen,sha],[S,BigInt(revision),BigInt(revision+1),H]);
   return packet(change('begin',{contract:'wand.worker.steam626.scoped-amount-output@1',
    decodedBytes:ENCODED.length,decodedSha256:STAGED,
    writerAuthorized:false,originalOverwriteAuthorized:false}));
  },
  next_scoped_amount_output_chunk(){
   const p=ENCODED.slice(next,next+16);next+=p.length;partCopies.push(p);
   return change('chunk',p);
  }
 };
 function stageReceipt(applied){
  return {contract:CONTRACT,...scoped(),stagedDecodedSha256:STAGED,
   operationCount:1,exactFieldChangedCount:1,applied,
   writerAuthorized:false,originalOverwriteAuthorized:false};
 }
 const parse=(raw,max)=>{assert.ok(Buffer.byteLength(raw,'utf8')<=max);return JSON.parse(raw)};
 const instance=createSteam626Catalog0Transport(methods,INITIAL,BUILD,{
  parse,current:()=>!revoked,revoke:()=>{revoked=true},maxBytes:512,chunkBytes:16
 });
 return {instance,methods,revoked:()=>revoked,parts:()=>partCopies};
}
const use=(x)=>x.instance;

test('valid fixed Steam InventoryID0 one-amount Rust receipts, undo redo and one-time decoded copy',async()=>{
 const m=make(),t=use(m);
 const targets=t.discoverTargets('catalog0-furniture');
 assert.deepEqual(targets,[ROW]);
 assert.equal(Object.isFrozen(targets[0]),true);
 assert.deepEqual(t.previewTarget(SELECTION),{
  profile:'catalog0-furniture',id:0,selector:ITEM,itemId:ITEM,oldAmount:3,
  newAmount:2,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false
 });
 assert.deepEqual(t.stage(),{
  profile:'catalog0-furniture',id:0,selector:ITEM,itemId:ITEM,oldAmount:3,
  newAmount:2,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false,
  applied:true,exactFieldChangedCount:1
 });
 assert.equal(t.toggle(false).applied,false);
 assert.equal(t.toggle(true).applied,true);
 const output=await t.takeOutput();
 assert.equal(output.decodedSha256,STAGED);
 assert.equal(hash(output.decodedBytes),STAGED);
 assert.ok(m.parts().length>1);
 assert.ok(m.parts().every(p=>p.every(b=>b===0)),'decoded chunk temporaries wiped');
 assert.equal(m.revoked(),true);
 await assert.rejects(t.takeOutput(),/PRODUCT_SCOPED_AMOUNT_DENIED/);
 output.decodedBytes.fill(0);
});
test('foreign Build and untrusted initial receipt cannot activate Steam Catalog0 transport',()=>{
 const good=make().methods;
 for(const b of [{...BUILD,platform:'switch'},
  {...BUILD,buildKind:'switch-bid'}, {...BUILD,buildId:'9A239D3DB569756D'},
  {...BUILD,schema:624},{...BUILD,schema:626,additional:true}]){
  if(b.additional)continue; // build identity allows only exact trusted four fields
  assert.throws(()=>createSteam626Catalog0Transport(good,INITIAL,b,{}),
   /PRODUCT_SCOPED_AMOUNT_DENIED/);
 }
 for(const s of [{...INITIAL,sessionId:'0'.repeat(32)},
  {...INITIAL,decodedSha256:'bad'},{...INITIAL,revision:1},
  {...INITIAL,indexGeneration:2},{...INITIAL,writerAuthorized:true},
  {...INITIAL,editedCopyAuthorized:true},{...INITIAL,applyAuthorized:true},
  {...INITIAL,productWorkerBound:false},{...INITIAL,fullDocumentJsonValidated:false}]){
  assert.throws(()=>createSteam626Catalog0Transport(good,s,BUILD,{}),
   /PRODUCT_SCOPED_AMOUNT_DENIED/);
 }
 assert.throws(()=>createSwitch626Catalog0Transport(good,INITIAL,BUILD,{}),
  /PRODUCT_SCOPED_AMOUNT_DENIED/);
});
test('Catalog0 discovery denies foreign profile, duplicate, wrong InventoryID and forged authority',()=>{
 const transforms=[
  r=>({...r,contract:'wand.worker.switch626.scoped-chest-discovery@1'}),
  r=>({...r,profile:'linked-crop-chest48'}),
  r=>({...r,writerAuthorized:true}),
  r=>({...r,editedCopyAuthorized:true}),
  r=>({...r,nextOffset:16}),
  r=>({...r,offset:1}),
  r=>({...r,rows:[{...ROW,id:2}]}),
  r=>({...r,rows:[{...ROW,selector:40000049}]}),
  r=>({...r,rows:[{...ROW,oldAmount:1}]}),
  r=>({...r,rows:[{...ROW,oldAmount:10000}]}),
  r=>({...r,rows:[{...ROW},{...ROW}]}),
  r=>({...r,sessionId:'f'.repeat(32)}),
  r=>({...r,extra:'caller supplied'})
 ];
 for(let i=0;i<transforms.length;i++){
  const m=make({discover:transforms[i]});
  assert.throws(()=>use(m).discoverTargets('catalog0-furniture'),
   /PRODUCT_SCOPED_AMOUNT_DENIED/,'malformed discovery case '+i);
  assert.equal(m.revoked(),true,'bad Worker result poisons active Rust owner '+i);
 }
 const m=make();
 assert.throws(()=>use(m).discoverTargets('linked-crop-chest48'),
  /PRODUCT_SCOPED_AMOUNT_DENIED/);
 assert.equal(m.revoked(),true);
});
test('preview never trusts ItemID, quantity, foreign contract, Rev or writable flag',()=>{
 const transforms=[
  r=>({...r,contract:'wand.worker.switch626.scoped-catalog0@1'}),
  r=>({...r,itemId:40000049}),
  r=>({...r,oldAmount:4}),
  r=>({...r,newAmount:3}),
  r=>({...r,entrySha256:'invalid'}),
  r=>({...r,revision:1}),
  r=>({...r,indexGeneration:2}),
  r=>({...r,scopedCandidate:false}),
  r=>({...r,writerAuthorized:true}),
  r=>({...r,editedCopyAuthorized:true}),
  r=>({...r,profile:'linked-crop-chest48'}),
  r=>({...r,bonus:true})
 ];
 for(let i=0;i<transforms.length;i++){
  const m=make({preview:transforms[i]});
  assert.throws(()=>use(m).previewTarget(SELECTION),/PRODUCT_SCOPED_AMOUNT_DENIED/,
   'forged Rust preview '+i);
  assert.equal(m.revoked(),true);
 }
 for(const s of [{...SELECTION,id:12},{...SELECTION,newAmount:1},
  {...SELECTION,selector:0},{...SELECTION,profile:'linked-crop-chest48'},
  {...SELECTION,untrustedTarget:true}]){
  const m=make();assert.throws(()=>use(m).previewTarget(s),/PRODUCT_SCOPED_AMOUNT_DENIED/);
  assert.equal(m.revoked(),true);
 }
});
test('Stage requires exact one authorized CAS field, session, digest and positive apply',()=>{
 const transforms=[
  r=>({...r,sessionId:'f'.repeat(32)}),
  r=>({...r,revision:0}),r=>({...r,indexGeneration:1}),
  r=>({...r,operationCount:2}),r=>({...r,exactFieldChangedCount:2}),
  r=>({...r,stagedDecodedSha256:'bad'}),r=>({...r,applied:false}),
  r=>({...r,writerAuthorized:true}),r=>({...r,originalOverwriteAuthorized:true}),
  r=>({...r,contract:'wand.worker.switch626.scoped-chest@1'})
 ];
 for(let i=0;i<transforms.length;i++){
  const m=make({stage:transforms[i]});use(m).previewTarget(SELECTION);
  assert.throws(()=>use(m).stage(),/PRODUCT_SCOPED_AMOUNT_DENIED/,'stage '+i);
  assert.equal(m.revoked(),true);
 }
});
test('Undo disables export and wrong replay/extra Stage invalidates owner',async()=>{
 let m=make(),t=use(m);t.previewTarget(SELECTION);t.stage();t.toggle(false);
 await assert.rejects(t.takeOutput(),/PRODUCT_SCOPED_AMOUNT_DENIED/);
 assert.equal(m.revoked(),true);
 m=make();t=use(m);t.previewTarget(SELECTION);t.stage();
 assert.throws(()=>t.stage(),/PRODUCT_SCOPED_AMOUNT_DENIED/);
 assert.equal(m.revoked(),true);
 m=make();t=use(m);t.previewTarget(SELECTION);t.stage();
 assert.throws(()=>t.toggle(true),/PRODUCT_SCOPED_AMOUNT_DENIED/);
 assert.equal(m.revoked(),true);
});
test('forged output grant and same-length corrupted decoded bytes fail and wipe each Worker chunk',async()=>{
 for(const begin of [
  r=>({...r,writerAuthorized:true}),r=>({...r,originalOverwriteAuthorized:true}),
  r=>({...r,decodedBytes:513}),r=>({...r,decodedSha256:'f'.repeat(64)}),
  r=>({...r,contract:'wand.worker.switch626.scoped-edit-output@1'})
 ]){
  const m=make({begin}),t=use(m);t.previewTarget(SELECTION);t.stage();
  await assert.rejects(t.takeOutput(),/PRODUCT_SCOPED_AMOUNT_DENIED/);
  assert.equal(m.revoked(),true);
 }
 const m=make({chunk:p=>{if(p[0]!==undefined)p[0]^=0xff;return p}}),t=use(m);
 t.previewTarget(SELECTION);t.stage();
 await assert.rejects(t.takeOutput(),/PRODUCT_SCOPED_AMOUNT_DENIED/);
 assert.equal(m.revoked(),true);
 assert.ok(m.parts().every(p=>p.every(b=>b===0)),
  'on SHA mismatch even all delivered raw chunk memory must be wiped');
});
test('one owner factory never mixes Steam Catalog0 with Chest, Switch, rights or caller discovery',()=>{
 const f=async()=>({WorkerWasmSource:class{}});
 for(const combo of [
  {allowScopedAmountSource:true},{allowSteam626ChestSource:true},
  {allowSwitch626Catalog0Source:true},{allowScopedCollectionSource:true},
  {allowCollectionCandidateSource:true},{placementScope:'comp03'},
  {allowSteam626BambooReadOnlySource:true},{allowSteam626Catalog0Source:'true'}
 ]){
  assert.throws(()=>createProductWasmReadOwner(f,{allowSteam626Catalog0Source:true,...combo}),
   /PRODUCT_WORKER_SCOPED_SOURCE_CONFLICT/);
 }
 const owner=createProductWasmReadOwner(f,{allowSteam626Catalog0Source:true});
 assert.equal(typeof owner.openDecoded,'function');
 assert.equal(typeof owner.discoverScopedTargets,'function');
 assert.equal(typeof owner.stageScopedAmount,'function');
 owner.close();
 for(const args of [{wasmFactory:f,coreDiscoveryProfile:'linked-crop-chest48'},
  {wasmFactory:f,discoverScopedTargets:()=>[]},
  {wasmFactory:f,allowCoreDiscoverySource:false}]){
  assert.throws(()=>createProductSteam626Catalog0LocalAdapter(args),
   /PRODUCT_SCOPED_AMOUNT|DENIED/);
 }
 const adapter=createProductSteam626Catalog0LocalAdapter({wasmFactory:f});
 assert.equal(Object.isFrozen(adapter),true);
 assert.equal(typeof adapter.originalOverwrite,'undefined');
 assert.equal(typeof adapter.setEntitlement,'undefined');
 assert.equal(typeof adapter.releaseSignedWriter,'undefined');
});
