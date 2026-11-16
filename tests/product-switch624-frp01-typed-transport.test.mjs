import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSwitch624Frp01Transport,SWITCH624_FRP01_CONTRACT} from '../src/lib/ddv/core/save/product-switch624-frp01-transport.mjs';

const hash=c=>c.repeat(64),session='a'.repeat(32),original=hash('b');
const bytes=new TextEncoder().encode('synthetic-624-FRP01-scoped-edit-output');
const projected=createHash('sha256').update(bytes).digest('hex');
const BID='52BD625D9B4E0053',ids=[10,11,12],rowHashes=[hash('1'),hash('2'),hash('3')];
const initial={contract:'wand.product.single-save-session.boundary@1',schema:624,sessionId:session,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'switch',buildKind:'switch-bid',buildId:BID,schema:624};
const selector={gridId:90001,oldIds:ids};
function setup(patch={},stagePatch={}){
 const contract=SWITCH624_FRP01_CONTRACT,output='wand.worker.switch624.scoped-frp01-exact7-output@1';
 const receipt={contract,layout:'PRESERVE_EXISTING',gridId:90001,oldIds:ids,nextGridObjectId:50,
  oldStock:10,newStock:20,inventoryDelta:0,rootSha256:hash('c'),gridSha256:hash('d'),
  counterSha256:hash('e'),housesSha256:hash('f'),oldStockSha256:hash('4'),newStockSha256:hash('5'),
  oldRowsSha256:rowHashes,projectedDecodedSha256:projected,exactFieldChangedCount:7,
  sessionId:session,revision:0,indexGeneration:1,decodedSha256:original,
  writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false,productReadAccepted:false,...patch};
 let active=true,revision=0,cursor=0;
 const calls=[],scope=()=>[session,BigInt(revision),BigInt(revision+1),original];
 const staged=applied=>JSON.stringify({contract,sessionId:session,revision:++revision,indexGeneration:revision+1,
  decodedSha256:original,stagedDecodedSha256:projected,operationCount:7,exactFieldChangedCount:7,
  applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const wasm={
  preview_switch624_frp01(...a){calls.push(['preview',...a]);return JSON.stringify(receipt)},
  stage_switch624_frp01(...a){calls.push(['stage',...a]);return staged(true)},
  toggle_switch624_frp01(redo,...a){assert.deepEqual(a,scope());return staged(redo)},
  begin_switch624_frp01_output(...a){assert.deepEqual(a,scope());return JSON.stringify({contract:output,decodedBytes:bytes.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})},
  next_switch624_frp01_output_chunk(){let part=bytes.slice(cursor,cursor+8);cursor+=part.length;return part}
 };
 const options={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {wasm,options,calls,selector,t:createSwitch624Frp01Transport(wasm,initial,identity,options),active:()=>active};
}
test('FRP624 exact7 Worker-minted ordered 3 old IDs, stock unchanged, typed CAS, Undo/Redo, once export',async()=>{
 const q=setup(),p=q.t.previewTarget(q.selector);
 assert.deepEqual(q.calls[0],['preview',90001,10,11,12,session,0n,1n,original]);
 assert.deepEqual(p.oldIds,[10,11,12]);assert.equal(Object.isFrozen(p.oldIds),true);
 assert.equal(p.nextGridObjectId,50);assert.equal(p.oldStock,10);assert.equal(p.newStock,20);
 assert.equal(p.inventoryDelta,0);assert.equal(p.removedObjects,3);assert.equal(p.addedObjects,3);
 assert.equal(p.exactFieldChangedCount,7);assert.equal(p.layout,'PRESERVE_EXISTING');
 for(const k of ['rootSha256','gridSha256','counterSha256','oldRowsSha256','sessionId','projectedDecodedSha256'])assert.equal(k in p,false);
 assert.equal(p.writerAuthorized,false);assert.equal(p.editedCopyAuthorized,false);assert.equal(p.productReadAccepted,false);
 assert.equal(q.t.stage().applied,true);
 assert.deepEqual(q.calls[1],['stage',90001,10,11,12,50,10,20,hash('c'),hash('d'),hash('e'),hash('f'),hash('4'),hash('5'),rowHashes.join(''),projected,session,0n,1n,original]);
 assert.equal(q.t.toggle(false).applied,false);assert.equal(q.t.toggle(true).applied,true);
 assert.deepEqual((await q.t.takeOutput()).decodedBytes,bytes);
 assert.equal(q.active(),false);await assert.rejects(q.t.takeOutput());
});
test('FRP624 wrong Schema/BID/platform/receipt grant/selector or stale-stage receipt fails closed',()=>{
 const x=setup();
 for(const bad of [{...identity,schema:626},{...identity,buildId:'9A239D3DB569756D'},{...identity,platform:'steam-windows'},{...identity,buildKind:'steam-full-version'},{...identity,extra:true}]){
  assert.throws(()=>createSwitch624Frp01Transport(x.wasm,initial,bad,x.options));
 }
 for(const b of [{...initial,schema:626},{...initial,writerAuthorized:true},{...initial,fullDocumentJsonValidated:false},{...initial,revision:1}]){
  assert.throws(()=>createSwitch624Frp01Transport(x.wasm,b,identity,x.options));
 }
 for(const s of [{...selector,nextGridObjectId:50},{...selector,gridId:0},{...selector,oldIds:[10,11,11]},{...selector,oldIds:[10,11]},{...selector,oldIds:[10,11,0]},{...selector,oldIds:[12,11,10,13]}]){
  const q=setup();assert.throws(()=>q.t.previewTarget(s));assert.equal(q.calls.length,0);assert.equal(q.active(),false);
 }
 for(const patch of [{contract:'cross-626'},{layout:'MODIFY_EXISTING'},{oldIds:[11,10,12]},{oldIds:[10,10,12]},
  {oldStock:0},{newStock:0},{oldStock:10000},{newStock:10000},{inventoryDelta:-3},
  {nextGridObjectId:12},{nextGridObjectId:0xffffffff},{gridSha256:'bad'},{oldStockSha256:'bad'},
  {oldRowsSha256:rowHashes.slice(0,2)},{oldRowsSha256:[...rowHashes.slice(0,2),'g'.repeat(64)]},
  {projectedDecodedSha256:original},{sessionId:'f'.repeat(32)},{revision:1},{exactFieldChangedCount:8},
  {productReadAccepted:true},{writerAuthorized:true},{editedCopyAuthorized:true},{originalOverwriteAuthorized:true},{extra:true}]){
  const q=setup(patch);assert.throws(()=>q.t.previewTarget(q.selector));assert.equal(q.active(),false);
 }
 const q=setup({},{stagedDecodedSha256:original});q.t.previewTarget(q.selector);assert.throws(()=>q.t.stage());assert.equal(q.active(),false);
});
