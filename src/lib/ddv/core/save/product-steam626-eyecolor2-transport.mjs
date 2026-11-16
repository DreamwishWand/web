// Steam626 Eyeball ColorIndex2 exact1 (64->69) fixed product Worker adapter.
// One existing Rust SaveSession / typed ledger, no new operation registry or caller edit plan.
// Core owns every old value, inventory reference, Branch and byte-level CAS witness.
import {createScopedEditLifecycle} from './product-scoped-amount-transport.mjs';

const CONTRACT='wand.worker.steam626.eyecolor2-exact1@1';
const OUTPUT='wand.worker.steam626.eyecolor2-exact1-output@1';
const BUILD='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const SWITCH_BID='9A239D3DB569756D';
const SWITCH_CONTRACT='wand.worker.switch626.eyecolor2-exact1@1';
const SWITCH_OUTPUT='wand.worker.switch626.eyecolor2-exact1-output@1';
const deny=()=>{throw Error('STEAM626_EYECOLOR2_FIXED_DENIED')};
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join(',')===k.split(',').sort().join(',');
const receiptFields='contract,eyeballItemId,field,oldColorIndex,newColorIndex,sessionId,revision,indexGeneration,decodedSha256,activeEyeSha256,inactiveEyeSha256,maleSha256,femaleSha256,stockEntrySha256,routeSha256,selectedTokenSha256,projectedDecodedSha256,exactFieldChangedCount,inventoryDelta,writerAuthorized,editedCopyAuthorized,originalOverwriteAuthorized,productReadAccepted';
export const STEAM626_EYECOLOR2_CONTRACT=CONTRACT;
export const SWITCH626_EYECOLOR2_CONTRACT=SWITCH_CONTRACT;
export function createSteam626EyeColor2Transport(wasm,initial,identity,options){return fixedEyeColor2(wasm,initial,identity,options,false)}
export function createSwitch626EyeColor2Transport(wasm,initial,identity,options){return fixedEyeColor2(wasm,initial,identity,options,true)}
function fixedEyeColor2(wasm,initial,identity,options,switchBuild){
 const contract=switchBuild?SWITCH_CONTRACT:CONTRACT;
 const output=switchBuild?SWITCH_OUTPUT:OUTPUT;
 const prefix=switchBuild?'switch626':'steam626';
 const previewMethod='preview_'+prefix+'_eyecolor2';
 const stageMethod='stage_'+prefix+'_eyecolor2';
 if(typeof document!=='undefined'||!wasm||typeof wasm[previewMethod]!=='function'||typeof wasm[stageMethod]!=='function'||!options||
  !exact(identity,'platform,buildKind,buildId,schema')||!(switchBuild?(identity.platform==='switch'&&identity.buildKind==='switch-bid'&&identity.buildId===SWITCH_BID):(identity.platform==='steam-windows'&&identity.buildKind==='steam-full-version'&&identity.buildId===BUILD))||identity.schema!==626||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||initial.revision!==0||initial.indexGeneration!==1||
  typeof initial.sessionId!=='string'||!/^[a-f0-9]{32}$/.test(initial.sessionId)||/^0{32}$/.test(initial.sessionId)||
  !sha(initial.decodedSha256)||initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||
  initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)deny();
 const {parse,current,revoke,maxBytes,chunkBytes}=options;
 let preview=null;
 const life=createScopedEditLifecycle(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes,
  contract,stageContract:contract,outputContract:output,exactCount:1,
  toggleMethod:'toggle_'+prefix+'_eyecolor2',beginMethod:'begin_'+prefix+'_eyecolor2_output',
  nextMethod:'next_'+prefix+'_eyecolor2_output_chunk',
  expectedProjection:()=>preview?.projectedDecodedSha256??null});
 const summary=()=>Object.freeze({
  eyeballItemId:70000010,field:'ColorIndex2',oldColorIndex:64,newColorIndex:69,
  exactFieldChangedCount:1,inventoryDelta:0,
  writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false,productReadAccepted:false
 });
 const previewTarget=(...args)=>life.checked(()=>{
  if(args.length||life.hasMutation())deny();
  const r=parse(wasm[previewMethod](...life.args()),4096);
  if(!exact(r,receiptFields)||r.contract!==contract||r.eyeballItemId!==70000010||r.field!=='ColorIndex2'||
   r.oldColorIndex!==64||r.newColorIndex!==69||r.exactFieldChangedCount!==1||r.inventoryDelta!==0||
   !life.scopeMatches(r)||r.revision!==life.scope().revision||r.indexGeneration!==life.scope().indexGeneration||
   ![r.activeEyeSha256,r.inactiveEyeSha256,r.maleSha256,r.femaleSha256,r.stockEntrySha256,r.routeSha256,
     r.selectedTokenSha256,r.projectedDecodedSha256].every(sha)||
   r.projectedDecodedSha256===initial.decodedSha256||r.writerAuthorized!==false||r.editedCopyAuthorized!==false||
   r.originalOverwriteAuthorized!==false||r.productReadAccepted!==false)deny();
  preview=Object.freeze({...r});
  return summary();
 });
 const stage=()=>life.checked(()=>{
  if(!preview||life.hasMutation())deny();
  return Object.freeze({...summary(),...life.stage((...scope)=>wasm[stageMethod](
   preview.activeEyeSha256,preview.inactiveEyeSha256,preview.maleSha256,preview.femaleSha256,
   preview.stockEntrySha256,preview.routeSha256,preview.selectedTokenSha256,preview.projectedDecodedSha256,...scope))});
 });
 const toggle=redo=>life.checked(()=>Object.freeze({...summary(),...life.toggle(redo)}));
 return Object.freeze({previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation});
}
