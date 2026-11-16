// ACT1147: one fixed owned top-inner Wardrobe replacement; Core owns all eligibility.
import {createScopedEditLifecycle} from './product-scoped-amount-transport.mjs';
const fail=()=>{throw Error('PRODUCT_SCOPED_WARDROBE_DENIED')};
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',SWITCH='9A239D3DB569756D';
const PACK='9bcf2cf489238074df8ea0b385a6675c8efcd51bb009cac37d8e107ec1a5d0b2',OLD=50000352,NEW=50000214;
export const createSteam626WardrobeTransport=(w,i,b,o)=>create(w,i,b,o,false);
export const createSwitch626WardrobeTransport=(w,i,b,o)=>create(w,i,b,o,true);
function create(wasm,initial,identity,{parse,current,revoke,maxBytes,chunkBytes},sw){
 const prefix=sw?'switch626':'steam626',contract='wand.worker.'+prefix+'.wardrobe-same-slot@1',previewMethod='preview_'+prefix+'_wardrobe',stageMethod='stage_'+prefix+'_wardrobe';
 if(typeof document!=='undefined'||!wasm||typeof wasm[previewMethod]!=='function'||typeof wasm[stageMethod]!=='function'||
 !identity||identity.platform!==(sw?'switch':'steam-windows')||identity.buildKind!==(sw?'switch-bid':'steam-full-version')||identity.buildId!==(sw?SWITCH:STEAM)||identity.schema!==626||
 !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||initial.revision!==0||initial.indexGeneration!==1||
 typeof initial.sessionId!=='string'||!/^[a-f0-9]{32}$/.test(initial.sessionId)||/^0+$/.test(initial.sessionId)||!sha(initial.decodedSha256)||initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)fail();
 let preview=null;
 const life=createScopedEditLifecycle(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes,contract:'wand.worker.scoped-edit@1',stageContract:contract,outputContract:'wand.worker.scoped-edit-output@1',toggleMethod:'toggle_scoped_edit',beginMethod:'begin_scoped_edit_output',nextMethod:'next_scoped_edit_output_chunk',exactCount:1,expectedProjection:()=>preview?.projectedDecodedSha256??null});
 const summary=()=>Object.freeze({slot:0,oldItemId:OLD,newItemId:NEW,exactFieldChangedCount:1,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false});
 function previewTarget(...args){return life.checked(()=>{
  if(args.length||life.hasMutation())fail();
  const p=parse(wasm[previewMethod](...life.args()),4096);
  if(!exact(p,'contract,slot,oldItemId,newItemId,definitionPackSha256,witnessSha256,projectedDecodedSha256,sessionId,revision,indexGeneration,decodedSha256,writerAuthorized,originalOverwriteAuthorized')||
  p.contract!==contract||p.slot!==0||p.oldItemId!==OLD||p.newItemId!==NEW||p.definitionPackSha256!==PACK||!sha(p.witnessSha256)||!sha(p.projectedDecodedSha256)||p.projectedDecodedSha256===initial.decodedSha256||!life.scopeMatches(p)||p.revision!==life.scope().revision||p.indexGeneration!==life.scope().indexGeneration||p.writerAuthorized!==false||p.originalOverwriteAuthorized!==false)fail();
  preview=Object.freeze(p);return summary();
 })}
 const stage=()=>life.checked(()=>{if(!preview||life.hasMutation())fail();return Object.freeze({...summary(),...life.stage((...a)=>wasm[stageMethod](preview.oldItemId,preview.newItemId,preview.witnessSha256,preview.projectedDecodedSha256,...a))})});
 const toggle=redo=>life.checked(()=>Object.freeze({...summary(),...life.toggle(redo)}));
 return Object.freeze({previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation});
}
