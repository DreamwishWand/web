// ACT965 thin adapter to PR1361 fixed effective Collection ABI. No new
// Session, registry, codec, ledger, arbitrary bool or public edit authority.
import {createScopedEditLifecycle} from './product-scoped-amount-transport.mjs';
const deny=()=>{throw Error('PRODUCT_SCOPED_COLLECTION_DENIED')};
const exact=(r,k)=>r!==null&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const sha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',SWITCH='9A239D3DB569756D';
// Actual Core-fixed ABI scope, not a JS eligibility registry.
const DEF=2120000159,ITEM=40004511,PEER=40004668;
export const FIXED_COLLECTION_SELECTOR=Object.freeze({definitionId:DEF,groupIndex:0,itemId:ITEM});
export function createFixedCollectionTransport(wasm,initial,identity,options){
 if(typeof document!=='undefined'||!options||typeof options.current!=='function'||
  !identity||identity.schema!==626||
  !((identity.platform==='steam-windows'&&identity.buildKind==='steam-full-version'&&identity.buildId===STEAM)||
    (identity.platform==='switch'&&identity.buildKind==='switch-bid'&&identity.buildId===SWITCH))||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||
  initial.revision!==0||initial.indexGeneration!==1||typeof initial.sessionId!=='string'||!/^([a-f0-9]{32})$/.test(initial.sessionId)||/^0+$/.test(initial.sessionId)||!sha(initial.decodedSha256)||
  initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||
  initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false||
  typeof wasm?.preview_fixed_collection!=='function'||typeof wasm?.stage_fixed_collection!=='function')deny();
 const {parse}=options;
 const life=createScopedEditLifecycle(wasm,initial,{...options,
  contract:'wand.worker.scoped-edit@1',outputContract:'wand.worker.scoped-edit-output@1',
  toggleMethod:'toggle_scoped_edit',beginMethod:'begin_scoped_edit_output',nextMethod:'next_scoped_edit_output_chunk'});
 let preview=null;
 const summary=()=>Object.freeze({definitionId:DEF,groupIndex:0,itemId:ITEM,
  oldValue:false,newValue:true,groupState:'NotComplete',falseCount:3,remainingFalseCount:2,
  fixedDefinitionVerified:true,installedRuntimeParityVerified:false,
  writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});
 const previewTarget=selector=>life.checked(()=>{
  if(life.hasMutation()||!exact(selector,'definitionId,groupIndex,itemId')||selector.definitionId!==DEF||selector.groupIndex!==0||selector.itemId!==ITEM)deny();
  const x=parse(wasm.preview_fixed_collection(DEF,0,ITEM,...life.args()),4096);
  if(!exact(x,'contract,definitionId,groupIndex,itemId,peerItemId,old,new,falseCount,entrySha256,sessionId,revision,indexGeneration,decodedSha256,fixedDefinitionVerified,installedRuntimeParityVerified,writerAuthorized,editedCopyAuthorized,applyAuthorized')||
   x.contract!=='wand.worker.collection-fixed-edit@1'||x.definitionId!==DEF||x.groupIndex!==0||x.itemId!==ITEM||x.peerItemId!==PEER||
   x.old!==false||x.new!==true||x.falseCount!==3||!sha(x.entrySha256)||!life.scopeMatches(x)||
   x.revision!==life.scope().revision||x.indexGeneration!==life.scope().indexGeneration||
   x.fixedDefinitionVerified!==true||x.installedRuntimeParityVerified!==false||
   x.writerAuthorized!==false||x.editedCopyAuthorized!==false||x.applyAuthorized!==false)deny();
  preview=Object.freeze({entrySha256:x.entrySha256});return summary();
 });
 const stage=()=>life.checked(()=>{
  if(!preview||life.hasMutation())deny();
  return Object.freeze({...summary(),...life.stage((...a)=>wasm.stage_fixed_collection(DEF,0,ITEM,preview.entrySha256,...a))});
 });
 const toggle=redo=>life.checked(()=>Object.freeze({...summary(),...life.toggle(redo)}));
 return Object.freeze({previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation});
}
