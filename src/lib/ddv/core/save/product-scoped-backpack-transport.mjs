// ACT1143: fixed two-Build Backpack split over existing one-session ledger.
// UI supplies only two slot indices; Core owns eligibility, old value and CAS.
import {createScopedEditLifecycle} from './product-scoped-amount-transport.mjs';
const fail=()=>{throw Error('PRODUCT_SCOPED_BACKPACK_DENIED')};
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const slot=n=>Number.isSafeInteger(n)&&n>=0&&n<256;
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',SWITCH='9A239D3DB569756D';
const DEFINITION='9f9b24ad7ec2fc56149887d1b0824de24128cca6101f374ffd4f4b04bbb099cc';
const keys='contract,containerId,sourceSlot,destinationSlot,itemId,oldAmount,quantity,definitionSha256,effectiveStackBound,witnessSha256,projectedDecodedSha256,sessionId,revision,indexGeneration,decodedSha256,writerAuthorized,editedCopyAuthorized,originalOverwriteAuthorized';
export const createSteam626BackpackTransport=(wasm,initial,identity,options)=>create(wasm,initial,identity,options,false);
export const createSwitch626BackpackTransport=(wasm,initial,identity,options)=>create(wasm,initial,identity,options,true);
function create(wasm,initial,identity,{parse,current,revoke,maxBytes,chunkBytes},sw){
 const platform=sw?'switch':'steam-windows',kind=sw?'switch-bid':'steam-full-version',build=sw?SWITCH:STEAM;
 const prefix=sw?'switch626':'steam626',contract='wand.worker.'+prefix+'.backpack-fruit-split@1';
 const previewMethod='preview_'+prefix+'_backpack_split',stageMethod='stage_'+prefix+'_backpack_split';
 if(typeof document!=='undefined'||!wasm||typeof wasm[previewMethod]!=='function'||typeof wasm[stageMethod]!=='function'||
  !identity||identity.platform!==platform||identity.buildKind!==kind||identity.buildId!==build||identity.schema!==626||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||initial.revision!==0||initial.indexGeneration!==1||
  typeof initial.sessionId!=='string'||!/^[a-f0-9]{32}$/.test(initial.sessionId)||/^0+$/.test(initial.sessionId)||!sha(initial.decodedSha256)||
  initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)fail();
 let preview=null;
 const life=createScopedEditLifecycle(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes,contract:'wand.worker.scoped-edit@1',stageContract:contract,
  outputContract:'wand.worker.scoped-edit-output@1',toggleMethod:'toggle_scoped_edit',beginMethod:'begin_scoped_edit_output',nextMethod:'next_scoped_edit_output_chunk',
  exactCount:3,expectedProjection:()=>preview?.projectedDecodedSha256??null});
 const summary=()=>Object.freeze({containerId:0,sourceSlot:preview.sourceSlot,destinationSlot:preview.destinationSlot,itemId:30200001,oldAmount:preview.oldAmount,
  newSourceAmount:preview.oldAmount-1,newDestinationAmount:1,quantity:1,effectiveStackBound:50,exactFieldChangedCount:3,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false});
 function previewTarget(s){
  return life.checked(()=>{
   if(life.hasMutation()||!exact(s,'sourceSlot,destinationSlot')||!slot(s.sourceSlot)||!slot(s.destinationSlot)||s.sourceSlot===s.destinationSlot)fail();
   const p=parse(wasm[previewMethod](s.sourceSlot,s.destinationSlot,...life.args()),4096);
   if(!exact(p,keys)||p.contract!==contract||p.containerId!==0||p.sourceSlot!==s.sourceSlot||p.destinationSlot!==s.destinationSlot||
    p.itemId!==30200001||!Number.isSafeInteger(p.oldAmount)||p.oldAmount<2||p.oldAmount>50||p.quantity!==1||
    p.definitionSha256!==DEFINITION||p.effectiveStackBound!==50||!sha(p.witnessSha256)||!sha(p.projectedDecodedSha256)||p.projectedDecodedSha256===initial.decodedSha256||
    !life.scopeMatches(p)||p.revision!==life.scope().revision||p.indexGeneration!==life.scope().indexGeneration||
    p.writerAuthorized!==false||p.editedCopyAuthorized!==false||p.originalOverwriteAuthorized!==false)fail();
   preview=Object.freeze(p);return summary();
  });
 }
 const stage=()=>life.checked(()=>{if(!preview||life.hasMutation())fail();return Object.freeze({...summary(),...life.stage((...a)=>wasm[stageMethod](preview.sourceSlot,preview.destinationSlot,preview.oldAmount,preview.witnessSha256,preview.projectedDecodedSha256,...a))})});
 const toggle=redo=>life.checked(()=>Object.freeze({...summary(),...life.toggle(redo)}));
 return Object.freeze({previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation});
}
