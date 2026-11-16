import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSteam626BackpackTransport,createSwitch626BackpackTransport} from '../src/lib/ddv/core/save/product-scoped-backpack-transport.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),bytes=new TextEncoder().encode('synthetic split output'),out=createHash('sha256').update(bytes).digest('hex');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const steam={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626},sw={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const selection={sourceSlot:0,destinationSlot:1},definition='9f9b24ad7ec2fc56149887d1b0824de24128cca6101f374ffd4f4b04bbb099cc';
function setup(isSwitch,patch={},stagePatch={}){
 const prefix=isSwitch?'switch626':'steam626',contract='wand.worker.'+prefix+'.backpack-fruit-split@1',log=[];let active=true,rev=0,cursor=0;
 const args=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const preview={contract,containerId:0,sourceSlot:0,destinationSlot:1,itemId:30200001,oldAmount:4,quantity:1,definitionSha256:definition,effectiveStackBound:50,witnessSha256:h('c'),projectedDecodedSha256:out,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false};
 const mutation=(c,applied)=>JSON.stringify({contract:c,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:out,operationCount:3,exactFieldChangedCount:3,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const w={toggle_scoped_edit(redo,...a){assert.deepEqual(a,args());return mutation('wand.worker.scoped-edit@1',redo)},begin_scoped_edit_output(...a){assert.deepEqual(a,args());return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:bytes.length,decodedSha256:out,writerAuthorized:false,originalOverwriteAuthorized:false})},next_scoped_edit_output_chunk(){const p=bytes.slice(cursor,cursor+8);cursor+=p.length;return p}};
 w['preview_'+prefix+'_backpack_split']=(...a)=>{log.push(['preview',...a]);assert.deepEqual(a,[0,1,...args()]);return JSON.stringify({...preview,...patch})};
 w['stage_'+prefix+'_backpack_split']=(...a)=>{log.push(['stage',...a]);assert.deepEqual(a,[0,1,4,h('c'),out,...args()]);return mutation(contract,true)};
 const create=isSwitch?createSwitch626BackpackTransport:createSteam626BackpackTransport;
 const opts={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {t:create(w,initial,isSwitch?sw:steam,opts),log,active:()=>active,w,opts,create};
}
for(const isSwitch of [false,true]){
 const label=isSwitch?'Switch626':'Steam626';
 test(label+' Backpack fixed exact3 transport with Core-only CAS, neutral ledger and one-time output',async()=>{
  const s=setup(isSwitch),p=s.t.previewTarget(selection);
  assert.deepEqual(p,{containerId:0,sourceSlot:0,destinationSlot:1,itemId:30200001,oldAmount:4,newSourceAmount:3,newDestinationAmount:1,quantity:1,effectiveStackBound:50,exactFieldChangedCount:3,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false});
  assert.equal(s.t.stage().applied,true);assert.equal(s.t.toggle(false).applied,false);assert.equal(s.t.toggle(true).applied,true);
  const o=await s.t.takeOutput();assert.deepEqual(o.decodedBytes,bytes);assert.equal(o.decodedSha256,out);assert.equal(s.active(),false);await assert.rejects(s.t.takeOutput());
 });
 test(label+' Backpack rejects malformed selectors, foreign receipts, scope, projection and mutation count',()=>{
  for(const p of [{sourceSlot:0,destinationSlot:0},{sourceSlot:256,destinationSlot:1},{sourceSlot:-1,destinationSlot:1},{sourceSlot:0,destinationSlot:1,oldAmount:4},{sourceSlot:0,destinationSlot:1,witnessSha256:h('c')}]){const s=setup(isSwitch);assert.throws(()=>s.t.previewTarget(p));assert.equal(s.log.length,0);assert.equal(s.active(),false)}
  for(const p of [{contract:'wand.worker.other@1'},{containerId:1},{sourceSlot:2},{destinationSlot:2},{itemId:30200002},{oldAmount:1},{oldAmount:51},{quantity:2},{definitionSha256:h('f')},{effectiveStackBound:99},{witnessSha256:'x'},{projectedDecodedSha256:original},{sessionId:'f'.repeat(32)},{revision:1},{indexGeneration:2},{decodedSha256:h('f')},{writerAuthorized:true},{editedCopyAuthorized:true},{originalOverwriteAuthorized:true},{extra:true}]){const s=setup(isSwitch,p);assert.throws(()=>s.t.previewTarget(selection));assert.equal(s.active(),false);assert.equal(s.log.length,1)}
  for(const p of [{operationCount:1},{exactFieldChangedCount:1},{stagedDecodedSha256:h('f')},{writerAuthorized:true}]){const s=setup(isSwitch,{},p);s.t.previewTarget(selection);assert.throws(()=>s.t.stage());assert.equal(s.active(),false)}
  const s=setup(isSwitch);assert.throws(()=>s.create(s.w,initial,isSwitch?steam:sw,s.opts));assert.throws(()=>s.create(s.w,initial,{...(isSwitch?sw:steam),buildId:'unknown'},s.opts));
 });
}
