import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSwitch626Fm01Transport,createSwitch626Rm01Transport} from '../src/lib/ddv/core/save/product-scoped-placement-transport.mjs';
import {FM01_RELEASE,RM01_RELEASE,placementPinsOk,getFm01MountInfo} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {createProductFm01Port} from '../src/lib/dev/product-placement-client.mjs';
import {createLocalFm01DevPort} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
import {createLocalPlacementDevWorkflow,SWITCH626_BACKPACK_BUILD} from '../src/lib/dev/local-placement-workflow.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),out=new TextEncoder().encode('synthetic FM01 edited bytes'),projected=createHash('sha256').update(out).digest('hex');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const ids=[10,11,12,13,14],selector={gridId:90001,oldIds:ids},contract='wand.worker.switch626.scoped-fm01-layout@1',output='wand.worker.switch626.scoped-fm01-layout-output@1',rows=['1','2','3','4','5'].map(h);
const receipt={contract,layout:'PRESERVE_EXISTING',...selector,retainedId:10,deletedIds:ids.slice(1),expectedNextId:50,oldAmount:10,newAmount:10,inventoryDelta:0,rootSha256:h('c'),gridSha256:h('d'),counterSha256:h('e'),inventoryEntrySha256:h('f'),housesSha256:h('6'),oldRowsSha256:rows,projectedDecodedSha256:projected,exactFieldChangedCount:8,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWriterAuthorized:false,originalOverwriteAuthorized:false};
function setup(patch={},stagePatch={}){
 let active=true,rev=0,cursor=0;const calls=[];
 const scope=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const stage=applied=>JSON.stringify({contract,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:projected,operationCount:8,exactFieldChangedCount:8,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const w={preview_switch626_fm01(...a){calls.push(['preview',...a]);return JSON.stringify({...receipt,...patch})},stage_switch626_fm01(...a){calls.push(['stage',...a]);return stage(true)},toggle_switch626_fm01(redo,...a){assert.deepEqual(a,scope());return stage(redo)},begin_switch626_fm01_output(...a){assert.deepEqual(a,scope());return JSON.stringify({contract:output,decodedBytes:out.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})},next_switch626_fm01_output_chunk(){const x=out.slice(cursor,cursor+8);cursor+=x.length;return x}};
 const opts={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {w,opts,t:createSwitch626Fm01Transport(w,initial,identity,opts),calls,active:()=>active};
}
test('FM01 exact8 uses dedicated lifecycle and exact private 320-ASCII Core row CAS',async()=>{
 const x=setup(),p=x.t.previewTarget(selector);assert.deepEqual(p,{itemId:40700246,gridId:90001,nextObjectId:50,oldAmount:10,newAmount:10,exactFieldChangedCount:8,layout:'PRESERVE_EXISTING',oldIds:ids,retainedId:10,deletedIds:ids.slice(1),inventoryDelta:0,addObjects:3,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false});
 assert.deepEqual(x.calls[0],['preview',90001,Uint32Array.from(ids),id,0n,1n,original]);assert.equal(x.t.stage().applied,true);
 assert.deepEqual(x.calls[1],['stage',90001,Uint32Array.from(ids),50,10,h('c'),h('d'),h('e'),h('f'),h('6'),rows.join(''),projected,id,0n,1n,original]);
 assert.equal(x.t.toggle(false).applied,false);assert.equal(x.t.toggle(true).applied,true);assert.deepEqual((await x.t.takeOutput()).decodedBytes,out);assert.equal(x.active(),false);await assert.rejects(x.t.takeOutput());
});
test('FM01 rejects mixed/foreign Build, wrong 5 IDs, layout, stock, row digest and CAS',()=>{
 const x=setup();for(const b of [{...identity,platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'},{...identity,buildId:'0000000000000000'},{...identity,schema:624}])assert.throws(()=>createSwitch626Fm01Transport(x.w,initial,b,x.opts));
 assert.throws(()=>createSwitch626Rm01Transport(x.w,initial,identity,x.opts));
 for(const sel of [{...selector,oldIds:[10,11,12,13,13]},{...selector,oldIds:[10,11]},{...selector,oldIds:[10,11,12,13,0]},{...selector,expectedNextId:50},{...selector,gridId:0}]){const q=setup();assert.throws(()=>q.t.previewTarget(sel));assert.equal(q.calls.length,0)}
 for(const patch of [{contract:'wand.worker.switch626.scoped-rm01-mixed-q5@1'},{productWriterAuthorized:true},{originalOverwriteAuthorized:true},{revision:1},{sessionId:'f'.repeat(32)},{expectedNextId:14},{expectedNextId:0xffffffff},{newAmount:9},{inventoryDelta:-1},{layout:'APPLY'},{retainedId:11},{deletedIds:[11,12,13,15]},{oldRowsSha256:rows.slice(1)},{oldRowsSha256:[...rows.slice(0,4),'g'.repeat(64)]},{housesSha256:'0'},{exactFieldChangedCount:7},{projectedDecodedSha256:original}]){const q=setup(patch);assert.throws(()=>q.t.previewTarget(selector));assert.equal(q.active(),false)}
 const q=setup({},{stagedDecodedSha256:original});q.t.previewTarget(selector);assert.throws(()=>q.t.stage());assert.equal(q.active(),false);
});
test('FM01 dedicated 13/22 release Switch-only null anchor and no Worker',async()=>{
 const s=FM01_RELEASE;assert.equal(s.key,'switch626-fm01');assert.equal(s.operation,'switch626.fm01.layout.exact8');assert.equal(s.path,'/editor/world/fm01/switch/');assert.equal(s.platform,'switch');assert.equal(s.buildId,identity.buildId);assert.deepEqual(s.features,['product-switch626-fm01-scoped','worker-wasm']);assert.equal(s.methods.length,13);assert.equal(s.exports.length,22);assert.ok(s.methods.includes('toggle_switch626_fm01'));assert.ok(!s.methods.includes('toggle_scoped_edit'));
 const p={contract:s.prefix+'.pinned-digests@1',sourceHead:'a'.repeat(40),manifestSha256:h('a'),manifestSizeBytes:1,jsSha256:h('a'),jsSizeBytes:1,wasmSha256:h('a'),wasmSizeBytes:1};assert.equal(placementPinsOk(s,p),true);assert.equal(placementPinsOk(RM01_RELEASE,p),false);
 const old=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let calls=0;
 try{Object.defineProperty(globalThis,'document',{configurable:true,value:{}});Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://example.invalid/web/editor/world/fm01/switch/')});Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});await assert.rejects(getFm01MountInfo());await assert.rejects(createProductFm01Port());assert.equal(calls,0)}
 finally{for(const [k,v] of Object.entries(old)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
 for(const l of ['en','ja','fr','de','it','es-ES','zh-CN','pt-BR']){const w=localPlacementCopy(l);assert.match(w.fm01Title,/FM01/);assert.ok(w.fm01Detail&&w.fm01DeleteId)}
});
test('FM01 UI requires ordered 5 distinct IDs, Switch626 Build, Core preview and exact8 stage',async()=>{
 const ack=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});let got,selected;
 const adapter={async open(a){got=a;return ack('OPEN')},async close(){return ack('CLOSED')},async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,originalName:got.file.name,originalSha256:got.originalSha256,originalSizeBytes:got.file.size,backupName:'backup.p1g'}},async previewPlacement(a){selected=a;return setup().t.previewTarget(a)},async stagePlacement(){return {...ack('STAGED'),exactFieldChangedCount:8}},undo(){},redo(){},exportEditedCopy(){},downloadVerifiedCopy(){}};
 const w=createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness:true,operation:'fm01'});await w.openFile({file:new File([new Uint8Array(16)],'synthetic.p1g'),buildConfirmed:true});assert.deepEqual(got.build,SWITCH626_BACKPACK_BUILD);await w.backupOriginal();assert.equal((await w.preview(selector)).preview.exactFieldChangedCount,8);assert.deepEqual(selected,selector);assert.equal((await w.stage()).phase,'staged');await w.close();
 const port=createLocalFm01DevPort({postMessage(){throw Error('unexpected dispatch')},terminate(){}});await assert.rejects(port.previewPlacement({gridId:90001,x:1,y:2}));await assert.rejects(port.previewPlacement({gridId:90001,oldIds:[10,11,12,13,13]}));port.dispose();
});
