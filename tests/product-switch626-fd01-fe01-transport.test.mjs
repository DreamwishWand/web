import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSwitch626Fd01Transport,createSwitch626Fe01Transport,createSwitch626Rm01Transport} from '../src/lib/ddv/core/save/product-scoped-placement-transport.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),out=new TextEncoder().encode('synthetic fence transport output'),projected=createHash('sha256').update(out).digest('hex');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const rows=['1','2','3','4'].map(h),ids=[10,11,12,13];
function setup(op,patch={},stagePatch={}){
 const fd=op==='fd01',count=fd?4:7,factory=fd?createSwitch626Fd01Transport:createSwitch626Fe01Transport;
 const contract='wand.worker.switch626.scoped-'+op+'-layout@1',output='wand.worker.switch626.scoped-'+op+'-layout-output@1';
 const selector=fd?{gridId:90001,x:20,y:40}:{gridId:90001,oldIds:ids};
 const receipt={contract,layout:'PRESERVE_EXISTING',...selector,...(fd?{oldAmount:10,newAmount:10,inventoryEntrySha256:h('f')}:{retainedIds:ids.slice(0,2),deletedIds:ids.slice(2),oldRowsSha256:rows}),expectedNextId:50,inventoryDelta:0,rootSha256:h('c'),gridSha256:h('d'),counterSha256:h('e'),housesSha256:h('6'),projectedDecodedSha256:projected,exactFieldChangedCount:count,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWriterAuthorized:false,originalOverwriteAuthorized:false,...patch};
 let active=true,rev=0,cursor=0;const calls=[];
 const scope=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const stage=applied=>JSON.stringify({contract,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:projected,operationCount:count,exactFieldChangedCount:count,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const w={['preview_switch626_'+op](...a){calls.push(['preview',...a]);return JSON.stringify(receipt)},['stage_switch626_'+op](...a){calls.push(['stage',...a]);return stage(true)},['toggle_switch626_'+op](redo,...a){assert.deepEqual(a,scope());return stage(redo)},['begin_switch626_'+op+'_output'](...a){assert.deepEqual(a,scope());return JSON.stringify({contract:output,decodedBytes:out.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})},['next_switch626_'+op+'_output_chunk'](){const x=out.slice(cursor,cursor+8);cursor+=x.length;return x}};
 const opts={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {w,opts,factory,selector,t:factory(w,initial,identity,opts),calls,active:()=>active};
}
for(const op of ['fd01','fe01']){
 const fd=op==='fd01',count=fd?4:7;
 test(op+' exact'+count+' dedicated CAS, undo/redo, one-time output',async()=>{
  const q=setup(op),p=q.t.previewTarget(q.selector);
  assert.equal(p.exactFieldChangedCount,count);assert.equal(p.inventoryDelta,0);assert.equal(p.layout,'PRESERVE_EXISTING');assert.equal(p.addObjects,fd?3:4);
  assert.equal('rootSha256' in p,false);assert.equal('oldRowsSha256' in p,false);assert.equal('oldAmount' in p,fd);
  if(fd)assert.equal(p.oldAmount,p.newAmount);else{assert.deepEqual(p.retainedIds,[10,11]);assert.deepEqual(p.deletedIds,[12,13]);assert.ok(Object.isFrozen(p.oldIds))}
  assert.deepEqual(q.calls[0],['preview',90001,...(fd?[20,40]:[Uint32Array.from(ids)]),id,0n,1n,original]);
  assert.equal(q.t.stage().applied,true);
  assert.deepEqual(q.calls[1],['stage',90001,...(fd?[20,40,50,h('c'),h('d'),h('e'),h('6'),10,h('f'),projected]:[Uint32Array.from(ids),50,h('c'),h('d'),h('e'),h('6'),rows.join(''),projected]),id,0n,1n,original]);
  assert.equal(q.t.toggle(false).applied,false);assert.equal(q.t.toggle(true).applied,true);assert.deepEqual((await q.t.takeOutput()).decodedBytes,out);assert.equal(q.active(),false);await assert.rejects(q.t.takeOutput());
 });
 test(op+' rejects foreign build, cross ABI, invalid selector, old values and stale CAS',()=>{
  const x=setup(op);for(const b of [{...identity,platform:'steam-windows'},{...identity,buildId:'0000000000000000'},{...identity,schema:624}])assert.throws(()=>x.factory(x.w,initial,b,x.opts));
  assert.throws(()=>createSwitch626Rm01Transport(x.w,initial,identity,x.opts));
  assert.throws(()=>(fd?createSwitch626Fe01Transport:createSwitch626Fd01Transport)(x.w,initial,identity,x.opts));
  for(const sel of [{...x.selector,expectedNextId:50},{...x.selector,gridId:0},...(fd?[{...x.selector,x:-1},{...x.selector,y:1.5}]:[{...x.selector,oldIds:[10,11,12,12]},{...x.selector,oldIds:[10,11,12]},{...x.selector,oldIds:[10,11,12,0]}])]){const q=setup(op);assert.throws(()=>q.t.previewTarget(sel));assert.equal(q.calls.length,0)}
  for(const patch of [{contract:'foreign'},{productWriterAuthorized:true},{originalOverwriteAuthorized:true},{revision:1},{sessionId:'f'.repeat(32)},{expectedNextId:0xffffffff},{inventoryDelta:-1},{layout:'APPLY'},{housesSha256:'0'},{exactFieldChangedCount:count+1},{projectedDecodedSha256:original},...(fd?[{newAmount:9},{oldAmount:0},{x:21},{inventoryEntrySha256:'bad'}]:[{expectedNextId:13},{retainedIds:[11,10]},{deletedIds:[12,14]},{oldRowsSha256:rows.slice(1)},{oldRowsSha256:[...rows.slice(0,3),'g'.repeat(64)]},{oldAmount:10}])]){const q=setup(op,patch);assert.throws(()=>q.t.previewTarget(q.selector));assert.equal(q.active(),false)}
  const q=setup(op,{},{stagedDecodedSha256:original});q.t.previewTarget(q.selector);assert.throws(()=>q.t.stage());assert.equal(q.active(),false);
 });
}
