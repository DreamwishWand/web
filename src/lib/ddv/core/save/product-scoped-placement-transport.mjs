// Fixed Steam626 placement wrappers over the existing Worker-owned ledger.
// UI selectors are untrusted; old values and hashes come only from Rust.
import {createScopedEditLifecycle} from './product-scoped-amount-transport.mjs';
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const fail=()=>{throw Error('PRODUCT_SCOPED_PLACEMENT_DENIED')};
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const positive=n=>uint(n)&&n>0;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
const common='contract,itemId,gridId,nextObjectId,oldAmount,newAmount,gridSha256,projectedDecodedSha256,sessionId,revision,indexGeneration,decodedSha256,exactFieldChangedCount,scopedCandidate,writerAuthorized,editedCopyAuthorized';
const sr03Raw='contract,itemId,gridId,retainedId,movedId,expectedNextId,oldAmount,newAmount,inventoryDelta,gridSha256,inventoryEntrySha256,projectedDecodedSha256,exactFieldChangedCount,sessionId,revision,indexGeneration,decodedSha256,productWriterAuthorized,originalOverwriteAuthorized';
const mixedRoad=Object.freeze({contract:'wand.worker.steam626.scoped-sr03-mixed-q5@1',count:8,item:40100068,preview:'preview_steam626_sr03',stage:'stage_steam626_sr03',
  keys:common+',retainedId,movedId,inventoryDelta,inventoryEntrySha256',
  selector:s=>exact(s,'gridId,retainedId,movedId')&&positive(s.gridId)&&positive(s.retainedId)&&positive(s.movedId)&&s.retainedId!==s.movedId,
  previewArgs:s=>[s.gridId,s.retainedId,s.movedId],
  normalize:r=>{if(!exact(r,sr03Raw)||r.productWriterAuthorized!==false||r.originalOverwriteAuthorized!==false)fail();const {expectedNextId,productWriterAuthorized,originalOverwriteAuthorized,...rest}=r;return {...rest,nextObjectId:expectedNextId,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false}},
  valid:(r,s)=>r.gridId===s.gridId&&r.retainedId===s.retainedId&&r.movedId===s.movedId&&r.oldAmount>=3&&r.newAmount===r.oldAmount-3&&r.inventoryDelta===-3&&sha(r.inventoryEntrySha256)&&r.nextObjectId>Math.max(r.retainedId,r.movedId)&&r.nextObjectId<=0xfffffffd,
  stageArgs:r=>[r.gridId,r.retainedId,r.movedId,r.nextObjectId,r.oldAmount,r.gridSha256,r.inventoryEntrySha256,r.projectedDecodedSha256],
  summary:r=>({retainedId:r.retainedId,movedId:r.movedId,inventoryDelta:-3,addObjects:3})});
const fixed=Object.freeze({
 sr03:mixedRoad,
 rm01:Object.freeze({...mixedRoad,contract:'wand.worker.switch626.scoped-rm01-mixed-q5@1',preview:'preview_switch626_rm01',stage:'stage_switch626_rm01'}),
 comp03:Object.freeze({contract:'wand.worker.steam626.scoped-comp03-layout@1',count:9,item:40100038,preview:'preview_steam626_comp03',stage:'stage_steam626_comp03',
  keys:common+',seedId,inventoryDelta,seedSha256,inventoryEntrySha256',
  selector:s=>exact(s,'seedId')&&positive(s.seedId),previewArgs:s=>[s.seedId],
  valid:(r,s)=>r.seedId===s.seedId&&positive(r.seedId)&&r.inventoryDelta===0&&r.oldAmount===r.newAmount&&sha(r.seedSha256)&&sha(r.inventoryEntrySha256),
  stageArgs:r=>[r.seedId,r.gridId,r.nextObjectId,r.oldAmount,r.gridSha256,r.seedSha256,r.inventoryEntrySha256,r.projectedDecodedSha256],
  summary:r=>({seedId:r.seedId,inventoryDelta:0,retainSeed:1,addObjects:8})}),
 vase:Object.freeze({contract:'wand.worker.steam626.scoped-vase-add@1',count:3,item:40000066,preview:'preview_steam626_vase_add',stage:'stage_steam626_vase_add',
  keys:common+',inventoryId,x,y,orientation,entrySha256',
  selector:s=>exact(s,'gridId,x,y')&&positive(s.gridId)&&uint(s.x)&&uint(s.y),previewArgs:s=>[s.gridId,s.x,s.y],
  valid:(r,s)=>r.gridId===s.gridId&&r.x===s.x&&r.y===s.y&&r.inventoryId===0&&r.orientation==='GridOrientation_Up'&&r.oldAmount===r.newAmount+1&&sha(r.entrySha256),
  stageArgs:r=>[r.gridId,r.x,r.y,r.oldAmount,r.nextObjectId,r.entrySha256,r.gridSha256,r.projectedDecodedSha256],
  summary:r=>({inventoryId:0,x:r.x,y:r.y,orientation:r.orientation,inventoryDelta:-1,addObjects:1})})
});
export const createSteam626Sr03Transport=(wasm,initial,identity,options)=>create(wasm,initial,identity,options,fixed.sr03);
export const createSwitch626Rm01Transport=(wasm,initial,identity,options)=>create(wasm,initial,identity,options,fixed.rm01);
export const createSteam626Comp03Transport=(wasm,initial,identity,options)=>create(wasm,initial,identity,options,fixed.comp03);
// Explicit companion factory: only a separately accepted, signed spatial
// runtime may select it. Existing COMP03 @1 and Vase factories remain exact.
export const createSteam626Comp03SpatialTransport=(wasm,initial,identity,options)=>create(wasm,initial,identity,options,fixed.comp03,true);
export const createSteam626VaseAddTransport=(wasm,initial,identity,options)=>create(wasm,initial,identity,options,fixed.vase);
function create(wasm,initial,identity,{parse,current,revoke,maxBytes,chunkBytes},op,spatial=false){
 if(spatial&&(op!==fixed.comp03||typeof wasm?.preview_steam626_comp03_spatial!=='function'))fail();
 if(typeof document!=='undefined'||!wasm||typeof wasm[op.preview]!=='function'||typeof wasm[op.stage]!=='function'||
  !identity||identity.schema!==626||!(op===fixed.rm01?(identity.platform==='switch'&&identity.buildKind==='switch-bid'&&identity.buildId==='9A239D3DB569756D'):(identity.platform==='steam-windows'&&identity.buildKind==='steam-full-version'&&identity.buildId===STEAM))||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||initial.revision!==0||initial.indexGeneration!==1||
  typeof initial.sessionId!=='string'||!/^[a-f0-9]{32}$/.test(initial.sessionId)||/^0+$/.test(initial.sessionId)||!sha(initial.decodedSha256)||
  initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)fail();
 let preview=null;
 const life=createScopedEditLifecycle(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes,
  contract:'wand.worker.scoped-edit@1',stageContract:op.contract,outputContract:'wand.worker.scoped-edit-output@1',
  toggleMethod:'toggle_scoped_edit',beginMethod:'begin_scoped_edit_output',nextMethod:'next_scoped_edit_output_chunk',
  exactCount:op.count,expectedProjection:()=>preview?.projectedDecodedSha256??null});
 const summary=()=>Object.freeze({itemId:preview.itemId,gridId:preview.gridId,nextObjectId:preview.nextObjectId,
  oldAmount:preview.oldAmount,newAmount:preview.newAmount,exactFieldChangedCount:op.count,...op.summary(preview),
  scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false});
 function previewTarget(selector){
  return life.checked(()=>{
   if(life.hasMutation()||!op.selector(selector))fail();
   const raw=parse(wasm[op.preview](...op.previewArgs(selector),...life.args()),4096),r=op.normalize?op.normalize(raw):raw;
   if(!exact(r,op.keys)||r.contract!==op.contract||r.itemId!==op.item||!positive(r.gridId)||!positive(r.nextObjectId)||
    !positive(r.oldAmount)||!uint(r.newAmount)||!sha(r.gridSha256)||!sha(r.projectedDecodedSha256)||r.projectedDecodedSha256===initial.decodedSha256||
    !life.scopeMatches(r)||r.revision!==life.scope().revision||r.indexGeneration!==life.scope().indexGeneration||
    r.exactFieldChangedCount!==op.count||r.scopedCandidate!==true||r.writerAuthorized!==false||r.editedCopyAuthorized!==false||!op.valid(r,selector))fail();
   preview=Object.freeze(r);return summary();
  });
 }
 // Companion is bound to the private, already validated @1 Preview.
 // UI cannot supply seed, projection hash, Session or coordinate claims.
 function spatialPreview(){return life.checked(()=>{
  if(!spatial||!preview||life.hasMutation()||life.scope().revision!==0||life.scope().indexGeneration!==1)fail();
  const r=parse(wasm.preview_steam626_comp03_spatial(preview.seedId,preview.projectedDecodedSha256,...life.args()),4096);
  if(!exact(r,'contract,rootSceneItemId,gridId,seedId,nextObjectId,anchors,sessionId,revision,indexGeneration,decodedSha256,projectedDecodedSha256,writerAuthorized,editedCopyAuthorized')||
   r.contract!=='wand.worker.steam626.comp03-spatial-preview@1'||r.rootSceneItemId!==1540000150||
   r.gridId!==preview.gridId||r.seedId!==preview.seedId||r.nextObjectId!==preview.nextObjectId||
   !life.scopeMatches(r)||r.revision!==life.scope().revision||r.indexGeneration!==life.scope().indexGeneration||
   r.projectedDecodedSha256!==preview.projectedDecodedSha256||r.writerAuthorized!==false||r.editedCopyAuthorized!==false||
   !Array.isArray(r.anchors)||r.anchors.length!==9)fail();
  const ids=new Set(),positions=new Set(),anchors=[];
  for(let i=0;i<9;i++){
   const a=r.anchors[i];
   if(!exact(a,'objectId,x,y,role')||!positive(a.objectId)||!uint(a.x)||!uint(a.y)||a.x>260||a.y>260||
    a.role!==(i===0?'retained':'proposed')||a.objectId!==(i===0?preview.seedId:preview.nextObjectId+i-1)||
    ids.has(a.objectId)||positions.has(a.x+':'+a.y))fail();
   ids.add(a.objectId);positions.add(a.x+':'+a.y);
   anchors.push(Object.freeze({objectId:a.objectId,x:a.x,y:a.y,role:a.role}));
  }
  // Only presentation fields leave the transport. No hashes, scope tokens,
  // raw data, or new permission; Stage uses the original @1 receipt only.
  return Object.freeze({rootSceneItemId:r.rootSceneItemId,gridId:r.gridId,seedId:r.seedId,nextObjectId:r.nextObjectId,
   anchors:Object.freeze(anchors),writerAuthorized:false,editedCopyAuthorized:false});
 })}
 function stage(){return life.checked(()=>{
  if(!preview||life.hasMutation())fail();
  return Object.freeze({...summary(),...life.stage((...a)=>wasm[op.stage](...op.stageArgs(preview),...a))});
 })}
 const toggle=redo=>life.checked(()=>Object.freeze({...summary(),...life.toggle(redo)}));
 const api={previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation};
 return Object.freeze(spatial?{...api,spatialPreview}:api);
}
