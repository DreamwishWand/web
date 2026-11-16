import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSwitch626VaseAddTransport,createSteam626VaseAddTransport} from '../src/lib/ddv/core/save/product-scoped-placement-transport.mjs';
import {SWITCH_VASE_ADD_RELEASE as sw,VASE_ADD_RELEASE as steam,placementPinsOk,getSwitchVaseAddMountInfo,loadProtectedSwitchVaseAddRustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitchVaseAddPort,productPlacementPortScope} from '../src/lib/dev/product-placement-client.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {createLocalPlacementDevWorkflow,SWITCH626_BACKPACK_BUILD} from '../src/lib/dev/local-placement-workflow.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),out=new TextEncoder().encode('synthetic Switch edited bytes'),projected=createHash('sha256').update(out).digest('hex');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const receipt={contract:'wand.worker.switch626.scoped-vase-add@1',itemId:40000066,gridId:7,x:3,y:4,orientation:'GridOrientation_Up',inventoryId:0,nextObjectId:9,oldAmount:3,newAmount:2,entrySha256:h('d'),gridSha256:h('c'),projectedDecodedSha256:projected,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false,exactFieldChangedCount:3};
function setup(patch={}){
 let active=true,rev=0,cursor=0;const calls=[];
 const scope=()=>[id,BigInt(rev),BigInt(rev+1),original];
 const stage=(contract,applied)=>JSON.stringify({contract,sessionId:id,revision:++rev,indexGeneration:rev+1,decodedSha256:original,stagedDecodedSha256:projected,operationCount:3,exactFieldChangedCount:3,applied,writerAuthorized:false,originalOverwriteAuthorized:false});
 const w={preview_switch626_vase_add(...a){calls.push(['preview',...a]);return JSON.stringify({...receipt,...patch})},stage_switch626_vase_add(...a){calls.push(['stage',...a]);return stage(receipt.contract,true)},toggle_scoped_edit(redo,...a){assert.deepEqual(a,scope());return stage('wand.worker.scoped-edit@1',redo)},begin_scoped_edit_output(...a){assert.deepEqual(a,scope());return JSON.stringify({contract:'wand.worker.scoped-edit-output@1',decodedBytes:out.length,decodedSha256:projected,writerAuthorized:false,originalOverwriteAuthorized:false})},next_scoped_edit_output_chunk(){const x=out.slice(cursor,cursor+8);cursor+=x.length;return x}};
 const opts={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8};
 return {w,opts,t:createSwitch626VaseAddTransport(w,initial,identity,opts),calls,active:()=>active};
}
test('Switch fixed exact3 preview and same existing ledger CAS/UndoRedo/output',async()=>{
 const s=setup(),p=s.t.previewTarget({gridId:7,x:3,y:4});assert.equal(p.exactFieldChangedCount,3);assert.equal(p.oldAmount,3);assert.equal(p.newAmount,2);assert.equal(p.sessionId,undefined);assert.equal(p.projectedDecodedSha256,undefined);
 assert.equal(s.t.stage().applied,true);assert.deepEqual(s.calls[1],['stage',7,3,4,3,9,h('d'),h('c'),projected,id,0n,1n,original]);assert.equal(s.t.toggle(false).applied,false);assert.equal(s.t.toggle(true).applied,true);
 const x=await s.t.takeOutput();assert.deepEqual(x.decodedBytes,out);assert.equal(x.decodedSha256,projected);assert.equal(s.active(),false);await assert.rejects(s.t.takeOutput());
});
test('Switch build and preview receipt cannot be substituted by Steam, old BID, or mixed authority',()=>{
 const s=setup();for(const i of [{...identity,buildId:'52BD625D9B4E0053'},{...identity,schema:624},{...identity,platform:'steam-windows',buildKind:'steam-full-version',buildId:steam.buildId}])assert.throws(()=>createSwitch626VaseAddTransport(s.w,initial,i,s.opts));
 assert.throws(()=>createSteam626VaseAddTransport(s.w,initial,identity,s.opts));for(const patch of [{contract:'wand.worker.steam626.scoped-vase-add@1'},{sessionId:'f'.repeat(32)},{revision:1},{writerAuthorized:true},{exactFieldChangedCount:1},{x:9},{inventoryId:1},{newAmount:3},{projectedDecodedSha256:original}]){const x=setup(patch);assert.throws(()=>x.t.previewTarget({gridId:7,x:3,y:4}));assert.equal(x.active(),false);assert.equal(x.calls.length,1)}
 const factory=async()=>{throw Error('must not open')};assert.throws(()=>createProductWasmReadOwner(factory,{placementScope:'vase-switch',backpackScope:'switch'}));assert.equal(typeof createProductWasmReadOwner(factory,{placementScope:'vase-switch'}).previewScopedPlacement,'function');
});
test('Switch independent identity and null anchor deny any Worker construction',async()=>{
 assert.equal(sw.key,'switch626-vase-add');assert.equal(sw.operation,'switch626.vase.add.exact3');assert.equal(sw.platform,'switch');assert.equal(sw.buildId,identity.buildId);assert.equal(sw.path,'/editor/world/vase/switch/');assert.deepEqual(sw.features,['product-switch626-vase-add-scoped','worker-wasm']);assert.equal(sw.methods.length,13);assert.equal(sw.exports.length,22);assert.ok(sw.methods.includes('preview_switch626_vase_add'));assert.ok(!sw.methods.includes('preview_steam626_vase_add'));
 const p={contract:sw.prefix+'.pinned-digests@1',sourceHead:'a'.repeat(40),manifestSha256:h('a'),manifestSizeBytes:1,jsSha256:h('a'),jsSizeBytes:1,wasmSha256:h('a'),wasmSizeBytes:1};assert.equal(placementPinsOk(sw,p),true);assert.equal(placementPinsOk(steam,p),false);
 const old=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let calls=0;
 try{Object.defineProperty(globalThis,'document',{configurable:true,value:{}});Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://example.invalid/web/editor/world/vase/switch/')});Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});await assert.rejects(getSwitchVaseAddMountInfo());await assert.rejects(createProductSwitchVaseAddPort());await assert.rejects(loadProtectedSwitchVaseAddRustWasm());assert.equal(calls,0);assert.equal(productPlacementPortScope({}),null)}
 finally{for(const [k,v] of Object.entries(old)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
});
test('UI fixed Switch route passes external Switch build only and keeps spatial companion unavailable',async()=>{
 const safe=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});let got;
 const adapter={async open(args){got=args.build;return safe('OPEN')},async close(){return safe('CLOSED')},backupOriginal(){},previewPlacement(){},stagePlacement(){},undo(){},redo(){},exportEditedCopy(){},downloadVerifiedCopy(){}};
 const w=createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness:true,operation:'vase-switch'});const r=await w.openFile({file:new File([new Uint8Array(16)],'synthetic.p1g'),buildConfirmed:true});assert.equal(r.phase,'opened');assert.deepEqual(got,SWITCH626_BACKPACK_BUILD);assert.equal(got.buildId,identity.buildId);await w.close();
 assert.throws(()=>createLocalPlacementDevWorkflow({...adapter,spatialPreview(){}},{trustedLocalHarness:true,operation:'vase-switch',spatialPreviewEnabled:true}));
});
