import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createScopedEditLifecycle} from '../src/lib/ddv/core/save/product-scoped-amount-transport.mjs';
import {createSteam626Sr03Transport} from '../src/lib/ddv/core/save/product-scoped-placement-transport.mjs';
import {SR03_RELEASE as s,COMP03_RELEASE,placementPinsOk,getSr03MountInfo} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSr03Port} from '../src/lib/dev/product-placement-client.mjs';
import {createLocalSr03DevPort} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
import {createLocalPlacementDevWorkflow,STEAM626_PLACEMENT_BUILD} from '../src/lib/dev/local-placement-workflow.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),out=new TextEncoder().encode('synthetic SR03 edited bytes'),projected=createHash('sha256').update(out).digest('hex');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'steam-windows',buildKind:'steam-full-version',buildId:STEAM626_PLACEMENT_BUILD.buildId,schema:626};
const selector={gridId:90001,retainedId:10,movedId:11};
const receipt={contract:'wand.worker.steam626.scoped-sr03-mixed-q5@1',itemId:40100068,...selector,expectedNextId:50,oldAmount:10,newAmount:7,inventoryDelta:-3,gridSha256:h('c'),inventoryEntrySha256:h('d'),projectedDecodedSha256:projected,exactFieldChangedCount:8,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWriterAuthorized:false,originalOverwriteAuthorized:false};
function setup(patch={},stagePatch={}){
 let active=true,rev=0,cursor=0;const calls=[];
 const scope=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const stage=(contract,applied)=>JSON.stringify({contract,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:projected,operationCount:8,exactFieldChangedCount:8,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const w={preview_steam626_sr03(...a){calls.push(['preview',...a]);return JSON.stringify({...receipt,...patch})},stage_steam626_sr03(...a){calls.push(['stage',...a]);return stage(receipt.contract,true)},toggle_scoped_edit(redo,...a){assert.deepEqual(a,scope());return stage('wand.worker.scoped-edit@1',redo)},begin_scoped_edit_output(...a){assert.deepEqual(a,scope());return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:out.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})},next_scoped_edit_output_chunk(){const x=out.slice(cursor,cursor+8);cursor+=x.length;return x}};
 const opts={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {w,opts,t:createSteam626Sr03Transport(w,initial,identity,opts),calls,active:()=>active};
}
test('SR03 fixed raw receipt -> typed view, exact8 CAS and existing one-time lifecycle',async()=>{
 const x=setup(),p=x.t.previewTarget(selector);assert.deepEqual(p,{itemId:40100068,gridId:90001,nextObjectId:50,oldAmount:10,newAmount:7,exactFieldChangedCount:8,retainedId:10,movedId:11,inventoryDelta:-3,addObjects:3,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false});
 assert.deepEqual(x.calls[0],['preview',90001,10,11,id,0n,1n,original]);assert.equal(x.t.stage().applied,true);assert.deepEqual(x.calls[1],['stage',90001,10,11,50,10,h('c'),h('d'),projected,id,0n,1n,original]);assert.equal(x.t.toggle(false).applied,false);assert.equal(x.t.toggle(true).applied,true);assert.deepEqual((await x.t.takeOutput()).decodedBytes,out);assert.equal(x.active(),false);await assert.rejects(x.t.takeOutput());
});
test('SR03 rejects wrong Build, caller plan, stale and foreign receipt, count, authority',()=>{
 const x=setup();assert.throws(()=>createSteam626Sr03Transport(x.w,initial,{...identity,platform:'switch'},x.opts));
 for(const sel of [{...selector,retainedId:11},{...selector,expectedNextId:50},{...selector,movedId:0}]){const t=setup();assert.throws(()=>t.t.previewTarget(sel));assert.equal(t.calls.length,0)}
 for(const patch of [{contract:'wand.worker.steam626.scoped-comp03-layout@1'},{productWriterAuthorized:true},{originalOverwriteAuthorized:true},{writerAuthorized:false},{revision:1},{sessionId:'f'.repeat(32)},{expectedNextId:11},{movedId:10},{oldAmount:2},{newAmount:8},{inventoryDelta:0},{exactFieldChangedCount:7},{projectedDecodedSha256:original}]){const t=setup(patch);assert.throws(()=>t.t.previewTarget(selector));assert.equal(t.active(),false)}
 for(const patch of [{operationCount:7},{exactFieldChangedCount:7},{stagedDecodedSha256:original},{writerAuthorized:true}]){const t=setup({},patch);t.t.previewTarget(selector);assert.throws(()=>t.t.stage());assert.equal(t.active(),false)}
});
test('dedicated release 13/22 and null anchor deny Worker; eight locales',async()=>{
 assert.equal(s.key,'steam626-sr03');assert.equal(s.operation,'steam626.sr03.mixed-q5.exact8');assert.equal(s.path,'/editor/world/sr03/');assert.deepEqual(s.features,['product-steam626-sr03-scoped','worker-wasm']);assert.equal(s.methods.length,13);assert.equal(s.exports.length,22);assert.ok(s.methods.includes('preview_steam626_sr03'));assert.ok(!s.methods.includes('preview_steam626_comp03'));
 const p={contract:s.prefix+'.pinned-digests@1',sourceHead:'a'.repeat(40),manifestSha256:h('a'),manifestSizeBytes:1,jsSha256:h('a'),jsSizeBytes:1,wasmSha256:h('a'),wasmSizeBytes:1};assert.equal(placementPinsOk(s,p),true);assert.equal(placementPinsOk(COMP03_RELEASE,p),false);
 const old=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let calls=0;
 try{Object.defineProperty(globalThis,'document',{configurable:true,value:{}});Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://example.invalid/web/editor/world/sr03/')});Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});await assert.rejects(getSr03MountInfo());await assert.rejects(createProductSr03Port());assert.equal(calls,0)}
 finally{for(const [k,v] of Object.entries(old)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
 for(const l of ['en','ja','fr','de','it','es-ES','zh-CN','pt-BR']){const w=localPlacementCopy(l);for(const k of ['sr03Title','sr03Detail','retainedId','movedId'])assert.ok(w[k]);assert.match(w.sr03Detail,/3/)}
});
test('SR03 UI workflow fixed Build and typed selector/receipt',async()=>{
 const ack=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});let got,selected;
 const adapter={async open(a){got=a;return ack('OPEN')},async close(){return ack('CLOSED')},async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,originalName:got.file.name,originalSha256:got.originalSha256,originalSizeBytes:got.file.size,backupName:'backup.p1g'}},async previewPlacement(a){selected=a;return setup().t.previewTarget(a)},async stagePlacement(){return {...ack('STAGED'),exactFieldChangedCount:8}},undo(){},redo(){},exportEditedCopy(){},downloadVerifiedCopy(){}};
 const w=createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness:true,operation:'sr03'});await w.openFile({file:new File([new Uint8Array(16)],'synthetic.p1g'),buildConfirmed:true});assert.deepEqual(got.build,STEAM626_PLACEMENT_BUILD);await w.backupOriginal();assert.equal((await w.preview(selector)).preview.exactFieldChangedCount,8);assert.deepEqual(selected,selector);assert.equal((await w.stage()).phase,'staged');await w.close();
 const port=createLocalSr03DevPort({postMessage(){throw Error('unexpected dispatch')},terminate(){}});await assert.rejects(port.previewPlacement({gridId:90001,x:1,y:2}));port.dispose();
});

test('exact8 ledger admission belongs only to fixed SR03 lifecycle contract',()=>{
 const x=setup(),o={...x.opts,contract:'wand.worker.scoped-edit@1',stageContract:receipt.contract,outputContract:'wand.worker.scoped-edit-output@1',toggleMethod:'toggle_scoped_edit',beginMethod:'begin_scoped_edit_output',nextMethod:'next_scoped_edit_output_chunk',exactCount:8};
 assert.equal(typeof createScopedEditLifecycle(x.w,initial,o).stage,'function');for(const p of [{stageContract:'wand.worker.steam626.scoped-comp03-layout@1'},{stageContract:'wand.worker.steam626.scoped-vase-add@1'},{contract:'foreign'},{outputContract:'foreign'},{exactCount:7},{exactCount:10}])assert.throws(()=>createScopedEditLifecycle(x.w,initial,{...o,...p}));
});
