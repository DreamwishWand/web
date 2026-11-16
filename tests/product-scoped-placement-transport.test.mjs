import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSteam626Comp03Transport,createSteam626VaseAddTransport} from '../src/lib/ddv/core/save/product-scoped-placement-transport.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),out=new TextEncoder().encode('synthetic edited bytes'),projected=createHash('sha256').update(out).digest('hex');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626};
const base={gridSha256:h('c'),projectedDecodedSha256:projected,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false};
const comp={...base,contract:'wand.worker.steam626.scoped-comp03-layout@1',itemId:40100038,gridId:90001,seedId:500,nextObjectId:510,oldAmount:30,newAmount:30,inventoryDelta:0,seedSha256:h('d'),inventoryEntrySha256:h('e'),exactFieldChangedCount:9};
const vase={...base,contract:'wand.worker.steam626.scoped-vase-add@1',itemId:40000066,gridId:7,x:3,y:4,orientation:'GridOrientation_Up',inventoryId:0,nextObjectId:9,oldAmount:3,newAmount:2,entrySha256:h('d'),exactFieldChangedCount:3};
function setup(mode,patch={},stagePatch={}){
 const v=mode==='comp'?comp:vase,log=[],count=v.exactFieldChangedCount;
 let current=true,rev=0,cursor=0;
 const scope=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const receipt=(contract,applied)=>JSON.stringify({contract,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:projected,operationCount:count,exactFieldChangedCount:count,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const w={toggle_scoped_edit(redo,...a){assert.deepEqual(a,scope());return receipt('wand.worker.scoped-edit@1',redo)},begin_scoped_edit_output(...a){assert.deepEqual(a,scope());return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:out.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})},next_scoped_edit_output_chunk(){const x=out.slice(cursor,cursor+8);cursor+=x.length;return x}};
 const pm=mode==='comp'?'preview_steam626_comp03':'preview_steam626_vase_add',sm=mode==='comp'?'stage_steam626_comp03':'stage_steam626_vase_add';
 w[pm]=(...a)=>{log.push(['preview',...a]);return JSON.stringify({...v,...patch})};w[sm]=(...a)=>{log.push(['stage',...a]);return receipt(v.contract,true)};
 const create=mode==='comp'?createSteam626Comp03Transport:createSteam626VaseAddTransport;
 const t=create(w,initial,identity,{parse:JSON.parse,current:()=>current,revoke:()=>{current=false},maxBytes:4096,chunkBytes:8});
 return {t,log,w,active:()=>current,scope,create};
}
for(const [mode,selector,view,expected] of [
 ['comp',{seedId:500},comp,[500,90001,510,30,h('c'),h('d'),h('e'),projected]],
 ['vase',{gridId:7,x:3,y:4},vase,[7,3,4,3,9,h('d'),h('c'),projected]]
]){
 test(mode+' fixed placement typed preview / exact CAS / neutral UndoRedo / one-time output',async()=>{
  const s=setup(mode),p=s.t.previewTarget(selector);
  assert.equal(p.exactFieldChangedCount,view.exactFieldChangedCount);assert.equal(p.oldAmount,view.oldAmount);assert.equal(p.newAmount,view.newAmount);
  assert.equal(p.sessionId,undefined);assert.equal(p.projectedDecodedSha256,undefined);
  assert.equal(s.t.stage().applied,true);assert.deepEqual(s.log[1],['stage',...expected,id,0n,1n,original]);
  assert.equal(s.t.toggle(false).applied,false);assert.equal(s.t.toggle(true).applied,true);
  const o=await s.t.takeOutput();assert.deepEqual(o.decodedBytes,out);assert.equal(o.decodedSha256,projected);assert.equal(s.active(),false);await assert.rejects(s.t.takeOutput());
 });
 test(mode+' rejects foreign receipt, mutation count, projection and untrusted selector',()=>{
  for(const patch of [{sessionId:'f'.repeat(32)},{revision:1},{indexGeneration:2},{decodedSha256:h('f')},{writerAuthorized:true},{exactFieldChangedCount:1},{projectedDecodedSha256:original},{itemId:1},{unexpected:true},...(mode==='comp'?[{inventoryDelta:-1},{seedId:501},{newAmount:29}]:[{x:9},{inventoryId:1},{orientation:'GridOrientation_Down'},{newAmount:3}])]){
   const s=setup(mode,patch);assert.throws(()=>s.t.previewTarget(selector));assert.equal(s.active(),false);assert.equal(s.log.some(x=>x[0]==='stage'),false);
  }
  for(const patch of [{operationCount:1},{exactFieldChangedCount:1},{stagedDecodedSha256:h('f')},{writerAuthorized:true}]){
   const s=setup(mode,{},patch);s.t.previewTarget(selector);assert.throws(()=>s.t.stage());assert.equal(s.active(),false);
  }
  const s=setup(mode);assert.throws(()=>s.t.previewTarget({...selector,expectedOldAmount:3}));assert.equal(s.log.length,0);
  assert.throws(()=>s.create(s.w,initial,{...identity,platform:'switch'},{}));
 });
}
