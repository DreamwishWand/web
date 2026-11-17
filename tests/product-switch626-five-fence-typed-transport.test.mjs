import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 createSwitch626Fd01Transport,createSwitch626Fd02Transport,createSwitch626Fd03Transport,
 createSwitch626OrthoLTransport,createSwitch626Diagonal90Transport,createSwitch626OrthoTTransport
} from '../src/lib/ddv/core/save/product-scoped-placement-transport.mjs';

const ops=[
 {slug:'fd02',method:'fd02',count:4,factory:createSwitch626Fd02Transport},
 {slug:'fd03',method:'fd03',count:4,factory:createSwitch626Fd03Transport},
 {slug:'ortho-l',method:'ortho_l',count:6,factory:createSwitch626OrthoLTransport},
 {slug:'diagonal90',method:'diagonal90',count:6,factory:createSwitch626Diagonal90Transport},
 {slug:'ortho-t',method:'ortho_t',count:8,factory:createSwitch626OrthoTTransport}
];
const hash=c=>c.repeat(64),id='a'.repeat(32),original=hash('b'),bytes=new TextEncoder().encode('synthetic exact fence ADD output'),projected=createHash('sha256').update(bytes).digest('hex');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const selector={gridId:90001,x:20,y:40};

function setup(op,patch={},stagePatch={}){
 const contract='wand.worker.switch626.scoped-'+op.slug+'-layout@1';
 const output='wand.worker.switch626.scoped-'+op.slug+'-layout-output@1';
 const receipt={contract,layout:'PRESERVE_EXISTING',...selector,oldAmount:10,newAmount:10,inventoryEntrySha256:hash('f'),expectedNextId:50,inventoryDelta:0,rootSha256:hash('c'),gridSha256:hash('d'),counterSha256:hash('e'),housesSha256:hash('6'),projectedDecodedSha256:projected,exactFieldChangedCount:op.count,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWriterAuthorized:false,originalOverwriteAuthorized:false,...patch};
 let active=true,rev=0,offset=0;
 const calls=[];
 const scope=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const stage=applied=>JSON.stringify({contract,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:projected,operationCount:op.count,exactFieldChangedCount:op.count,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const w={
  ['preview_switch626_'+op.method](...a){calls.push(['preview',...a]);return JSON.stringify(receipt)},
  ['stage_switch626_'+op.method](...a){calls.push(['stage',...a]);return stage(true)},
  ['toggle_switch626_'+op.method](redo,...a){assert.deepEqual(a,scope());return stage(redo)},
  ['begin_switch626_'+op.method+'_output'](...a){assert.deepEqual(a,scope());return JSON.stringify({contract:output,decodedBytes:bytes.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})},
  ['next_switch626_'+op.method+'_output_chunk'](){const r=bytes.slice(offset,offset+8);offset+=r.length;return r}
 };
 const opts={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {w,opts,calls,factory:op.factory,selector,t:op.factory(w,initial,identity,opts),active:()=>active};
}

for(const op of ops){
 test(op.slug+' exact'+op.count+' typed preview/Stage/CAS/Undo/Redo/one-time output',async()=>{
  const q=setup(op),p=q.t.previewTarget(q.selector);
  assert.equal(p.itemId,40700246);assert.equal(p.exactFieldChangedCount,op.count);
  assert.equal(p.inventoryDelta,0);assert.equal(p.layout,'PRESERVE_EXISTING');
  assert.equal(p.addObjects,op.count-1);assert.equal(p.oldAmount,10);assert.equal(p.newAmount,10);
  assert.equal('rootSha256' in p,false);assert.equal('inventoryEntrySha256' in p,false);
  assert.deepEqual(q.calls[0],['preview',90001,20,40,id,0n,1n,original]);
  assert.equal(q.t.stage().applied,true);
  assert.deepEqual(q.calls[1],['stage',90001,20,40,50,hash('c'),hash('d'),hash('e'),hash('6'),10,hash('f'),projected,id,0n,1n,original]);
  assert.equal(q.t.toggle(false).applied,false);assert.equal(q.t.toggle(true).applied,true);
  assert.deepEqual((await q.t.takeOutput()).decodedBytes,bytes);
  assert.equal(q.active(),false);
  await assert.rejects(q.t.takeOutput());
 });
 test(op.slug+' denies foreign build, cross ABI, caller CAS, invalid receipt and stale Stage',()=>{
  const x=setup(op);
  for(const b of [{...identity,platform:'steam-windows'},{...identity,buildId:'0000000000000000'},{...identity,schema:624}])
   assert.throws(()=>x.factory(x.w,initial,b,x.opts));
  assert.throws(()=>createSwitch626Fd01Transport(x.w,initial,identity,x.opts));
  for(const s of [{...selector,nextObjectId:50},{...selector,gridId:0},{...selector,x:-1},{...selector,y:0.5}]){
   const q=setup(op);assert.throws(()=>q.t.previewTarget(s));assert.equal(q.calls.length,0);
  }
  for(const patch of [{contract:'foreign'},{layout:'APPLY'},{inventoryDelta:-1},{productWriterAuthorized:true},{originalOverwriteAuthorized:true},{sessionId:hash('1').slice(0,32)},{revision:1},{x:21},{oldAmount:0},{newAmount:9},{inventoryEntrySha256:'bad'},{counterSha256:'bad'},{expectedNextId:0xffffffff},{projectedDecodedSha256:original},{exactFieldChangedCount:op.count+1}]){
   const q=setup(op,patch);assert.throws(()=>q.t.previewTarget(q.selector));assert.equal(q.active(),false);
  }
  const q=setup(op,{},{stagedDecodedSha256:original});q.t.previewTarget(q.selector);assert.throws(()=>q.t.stage());assert.equal(q.active(),false);
 });
}
