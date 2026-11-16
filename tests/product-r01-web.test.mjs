import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSwitch626R01Transport,createSteam626Sr03Transport} from '../src/lib/ddv/core/save/product-scoped-placement-transport.mjs';
import {R01_RELEASE,SR03_RELEASE,placementPinsOk,getR01MountInfo} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {createProductR01Port} from '../src/lib/dev/product-placement-client.mjs';
import {createLocalR01DevPort} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
import {createLocalPlacementDevWorkflow,SWITCH626_BACKPACK_BUILD} from '../src/lib/dev/local-placement-workflow.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),out=new TextEncoder().encode('synthetic R01 edited bytes'),projected=createHash('sha256').update(out).digest('hex');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const selector={gridId:90001,x:10,y:11},contract='wand.worker.switch626.scoped-r01-orthogonal-q3@1';
const receipt={contract,itemId:40100068,...selector,expectedNextId:50,oldAmount:10,newAmount:10,inventoryDelta:0,gridSha256:h('c'),inventoryEntrySha256:h('d'),projectedDecodedSha256:projected,exactFieldChangedCount:4,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWriterAuthorized:false,originalOverwriteAuthorized:false};
function setup(patch={},stagePatch={}){
 let active=true,rev=0,cursor=0;const calls=[];
 const scope=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const stage=(c,applied)=>JSON.stringify({contract:c,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:projected,operationCount:4,exactFieldChangedCount:4,applied,writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch});
 const w={preview_switch626_r01(...a){calls.push(['preview',...a]);return JSON.stringify({...receipt,...patch})},stage_switch626_r01(...a){calls.push(['stage',...a]);return stage(contract,true)},toggle_scoped_edit(redo,...a){assert.deepEqual(a,scope());return stage('wand.worker.scoped-edit@1',redo)},begin_scoped_edit_output(...a){assert.deepEqual(a,scope());return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:out.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})},next_scoped_edit_output_chunk(){const x=out.slice(cursor,cursor+8);cursor+=x.length;return x}};
 const opts={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {w,opts,t:createSwitch626R01Transport(w,initial,identity,opts),calls,active:()=>active};
}
test('Switch626 R01 exact4 uses existing lifecycle, exact BID and Core-owned CAS',async()=>{
 const x=setup(),p=x.t.previewTarget(selector);assert.deepEqual(p,{itemId:40100068,gridId:90001,nextObjectId:50,oldAmount:10,newAmount:10,exactFieldChangedCount:4,x:10,y:11,inventoryDelta:0,addObjects:3,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false});
 assert.deepEqual(x.calls[0],['preview',90001,10,11,id,0n,1n,original]);assert.equal(x.t.stage().applied,true);assert.deepEqual(x.calls[1],['stage',90001,10,11,50,10,h('c'),h('d'),projected,id,0n,1n,original]);assert.equal(x.t.toggle(false).applied,false);assert.equal(x.t.toggle(true).applied,true);assert.deepEqual((await x.t.takeOutput()).decodedBytes,out);assert.equal(x.active(),false);await assert.rejects(x.t.takeOutput());
});
test('R01 rejects Steam, legacy Switch, foreign receipt and authority, caller CAS and stale projection',()=>{
 const x=setup();for(const b of [{...identity,platform:'steam-windows',buildKind:'steam-full-version',buildId:SR03_RELEASE.buildId},{...identity,buildId:'0000000000000000'},{...identity,schema:624}])assert.throws(()=>createSwitch626R01Transport(x.w,initial,b,x.opts));
 assert.throws(()=>createSteam626Sr03Transport(x.w,initial,identity,x.opts));
 for(const sel of [{...selector,x:-1},{...selector,expectedNextId:50},{...selector,y:0.5}]){const q=setup();assert.throws(()=>q.t.previewTarget(sel));assert.equal(q.calls.length,0)}
 for(const patch of [{contract:'wand.worker.steam626.scoped-sr03-orthogonal-q3@1'},{productWriterAuthorized:true},{originalOverwriteAuthorized:true},{revision:1},{sessionId:'f'.repeat(32)},{expectedNextId:4294967295},{newAmount:8},{exactFieldChangedCount:7},{projectedDecodedSha256:original}]){const q=setup(patch);assert.throws(()=>q.t.previewTarget(selector));assert.equal(q.active(),false)}
 const q=setup({},{stagedDecodedSha256:original});q.t.previewTarget(selector);assert.throws(()=>q.t.stage());assert.equal(q.active(),false);
});
test('R01 dedicated 13/22 release, Switch-only null anchor and no Worker',async()=>{
 const s=R01_RELEASE;assert.equal(s.key,'switch626-r01');assert.equal(s.operation,'switch626.r01.orthogonal-q3.exact4');assert.equal(s.path,'/editor/world/r01/switch/');assert.equal(s.platform,'switch');assert.equal(s.buildId,identity.buildId);assert.deepEqual(s.features,['product-switch626-r01-scoped','worker-wasm']);assert.equal(s.methods.length,13);assert.equal(s.exports.length,22);assert.ok(s.methods.includes('preview_switch626_r01'));assert.ok(!s.methods.includes('preview_steam626_sr03'));assert.ok(!s.methods.includes('preview_switch626_rm01'));
 const p={contract:s.prefix+'.pinned-digests@1',sourceHead:'a'.repeat(40),manifestSha256:h('a'),manifestSizeBytes:1,jsSha256:h('a'),jsSizeBytes:1,wasmSha256:h('a'),wasmSizeBytes:1};assert.equal(placementPinsOk(s,p),true);assert.equal(placementPinsOk(SR03_RELEASE,p),false);
 const old=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let calls=0;
 try{Object.defineProperty(globalThis,'document',{configurable:true,value:{}});Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://example.invalid/web/editor/world/r01/switch/')});Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});await assert.rejects(getR01MountInfo());await assert.rejects(createProductR01Port());assert.equal(calls,0)}
 finally{for(const [k,v] of Object.entries(old)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
 for(const l of ['en','ja','fr','de','it','es-ES','zh-CN','pt-BR']){const w=localPlacementCopy(l);assert.match(w.r01Title,/R01/);assert.match(w.rm01Safety,/Switch626/);assert.match(w.r01Detail,/3/)}
});
test('R01 UI reuses typed placement controller but binds Switch626 Build',async()=>{
 const ack=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});let got,selected;
 const adapter={async open(a){got=a;return ack('OPEN')},async close(){return ack('CLOSED')},async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,originalName:got.file.name,originalSha256:got.originalSha256,originalSizeBytes:got.file.size,backupName:'backup.p1g'}},async previewPlacement(a){selected=a;return setup().t.previewTarget(a)},async stagePlacement(){return {...ack('STAGED'),exactFieldChangedCount:4}},undo(){},redo(){},exportEditedCopy(){},downloadVerifiedCopy(){}};
 const w=createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness:true,operation:'r01'});await w.openFile({file:new File([new Uint8Array(16)],'synthetic.p1g'),buildConfirmed:true});assert.deepEqual(got.build,SWITCH626_BACKPACK_BUILD);await w.backupOriginal();assert.equal((await w.preview(selector)).preview.exactFieldChangedCount,4);assert.deepEqual(selected,selector);assert.equal((await w.stage()).phase,'staged');await w.close();
 const port=createLocalR01DevPort({postMessage(){throw Error('unexpected dispatch')},terminate(){}});await assert.rejects(port.previewPlacement({gridId:90001,retainedId:1,movedId:2}));port.dispose();
});
