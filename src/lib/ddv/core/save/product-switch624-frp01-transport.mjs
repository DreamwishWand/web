// Switch624 FRP01 fixed exact7: one existing Rust Worker Session and scoped ledger.
// Only Rust-minted three existing Object IDs / old values / SHA / Next ID are staged.
// Build 624 is intentionally NOT the Switch626 route; no second engine or public grant.
import {createScopedEditLifecycle} from './product-scoped-amount-transport.mjs';

const CONTRACT='wand.worker.switch624.scoped-frp01-exact7@1';
const OUTPUT='wand.worker.switch624.scoped-frp01-exact7-output@1';
const BID='52BD625D9B4E0053';
const fail=()=>{throw Error('PRODUCT_SWITCH624_FRP01_DENIED')};
const u32=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const pos=n=>u32(n)&&n>0;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const ids3=v=>Array.isArray(v)&&v.length===3&&v.every(pos)&&new Set(v).size===3;
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>x===b[i]);
const RAW='contract,layout,gridId,oldIds,nextGridObjectId,oldStock,newStock,inventoryDelta,rootSha256,gridSha256,counterSha256,housesSha256,oldStockSha256,newStockSha256,oldRowsSha256,projectedDecodedSha256,exactFieldChangedCount,sessionId,revision,indexGeneration,decodedSha256,writerAuthorized,editedCopyAuthorized,originalOverwriteAuthorized,productReadAccepted';
export const SWITCH624_FRP01_CONTRACT=CONTRACT;

export function createSwitch624Frp01Transport(wasm,initial,identity,options){
 if(typeof document!=='undefined'||!wasm||typeof wasm.preview_switch624_frp01!=='function'||typeof wasm.stage_switch624_frp01!=='function'||!options||
  !exact(identity,'platform,buildKind,buildId,schema')||identity.platform!=='switch'||identity.buildKind!=='switch-bid'||identity.buildId!==BID||identity.schema!==624||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==624||
  initial.revision!==0||initial.indexGeneration!==1||typeof initial.sessionId!=='string'||!/^[a-f0-9]{32}$/.test(initial.sessionId)||/^0{32}$/.test(initial.sessionId)||
  !sha(initial.decodedSha256)||initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||
  initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)fail();
 const {parse,current,revoke,maxBytes,chunkBytes}=options;
 let mint=null;
 const life=createScopedEditLifecycle(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes,
  contract:CONTRACT,stageContract:CONTRACT,outputContract:OUTPUT,
  toggleMethod:'toggle_switch624_frp01',beginMethod:'begin_switch624_frp01_output',
  nextMethod:'next_switch624_frp01_output_chunk',exactCount:7,
  expectedProjection:()=>mint?.projectedDecodedSha256??null});
 const summary=()=>Object.freeze({
  gridId:mint.gridId,oldIds:Object.freeze([...mint.oldIds]),nextGridObjectId:mint.nextGridObjectId,
  oldStock:mint.oldStock,newStock:mint.newStock,inventoryDelta:0,removedObjects:3,addedObjects:3,
  layout:'PRESERVE_EXISTING',exactFieldChangedCount:7,
  writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false,productReadAccepted:false
 });
 const previewTarget=selection=>life.checked(()=>{
  if(life.hasMutation()||!exact(selection,'gridId,oldIds')||!pos(selection.gridId)||!ids3(selection.oldIds))fail();
  const r=parse(wasm.preview_switch624_frp01(selection.gridId,...selection.oldIds,...life.args()),4096);
  if(!exact(r,RAW)||r.contract!==CONTRACT||r.layout!=='PRESERVE_EXISTING'||r.gridId!==selection.gridId||!same(r.oldIds,selection.oldIds)||
   !pos(r.nextGridObjectId)||r.nextGridObjectId<=Math.max(...r.oldIds)||r.nextGridObjectId>0xffffffff-3||
   !pos(r.oldStock)||r.oldStock>9999||!pos(r.newStock)||r.newStock>9999||r.inventoryDelta!==0||
   ![r.rootSha256,r.gridSha256,r.counterSha256,r.housesSha256,r.oldStockSha256,r.newStockSha256].every(sha)||
   !Array.isArray(r.oldRowsSha256)||r.oldRowsSha256.length!==3||!r.oldRowsSha256.every(sha)||
   !sha(r.projectedDecodedSha256)||r.projectedDecodedSha256===initial.decodedSha256||
   !life.scopeMatches(r)||r.revision!==life.scope().revision||r.indexGeneration!==life.scope().indexGeneration||
   r.exactFieldChangedCount!==7||r.writerAuthorized!==false||r.editedCopyAuthorized!==false||
   r.originalOverwriteAuthorized!==false||r.productReadAccepted!==false)fail();
  mint=Object.freeze({...r,oldIds:Object.freeze([...r.oldIds]),oldRowsSha256:Object.freeze([...r.oldRowsSha256])});
  return summary();
 });
 const stage=()=>life.checked(()=>{
  if(!mint||life.hasMutation())fail();
  const r=life.stage((...a)=>wasm.stage_switch624_frp01(
   mint.gridId,...mint.oldIds,mint.nextGridObjectId,mint.oldStock,mint.newStock,
   mint.rootSha256,mint.gridSha256,mint.counterSha256,mint.housesSha256,
   mint.oldStockSha256,mint.newStockSha256,mint.oldRowsSha256.join(''),
   mint.projectedDecodedSha256,...a));
  return Object.freeze({...summary(),...r});
 });
 const toggle=redo=>life.checked(()=>Object.freeze({...summary(),...life.toggle(redo)}));
 return Object.freeze({previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation});
}
