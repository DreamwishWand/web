// Steam626 exact Male Makeup slot1 ColorIndex1 53->60.
// Thin Worker-local adapter: single existing Rust SaveSession and scoped ledger.
// No caller-selected item, palette, field, rights, stock, source SHA, or update plan.
import {createScopedEditLifecycle} from './product-scoped-amount-transport.mjs';

const CONTRACT='wand.worker.steam626.makeup-color1-exact1@1';
const OUTPUT='wand.worker.steam626.makeup-color1-exact1-output@1';
const BUILD='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const SWITCH_BID='9A239D3DB569756D';
const SWITCH_CONTRACT='wand.worker.switch626.makeup-color1-exact1@1';
const SWITCH_OUTPUT='wand.worker.switch626.makeup-color1-exact1-output@1';
const deny=()=>{throw Error('STEAM626_MAKEUP_COLOR1_FIXED_DENIED')};
const sha=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const plain=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join(',')===keys.split(',').sort().join(',');
const fields='contract,makeupItemId,slot,field,oldColorIndex,newColorIndex,sessionId,revision,indexGeneration,decodedSha256,tokenSha256,entrySha256,femaleSha256,maleSha256,routesSha256,projectedDecodedSha256,exactFieldChangedCount,inventoryDelta,scopedCandidate,writerAuthorized,editedCopyAuthorized,originalOverwriteAuthorized';

export const STEAM626_MAKEUP_COLOR1_CONTRACT=CONTRACT;
export const SWITCH626_MAKEUP_COLOR1_CONTRACT=SWITCH_CONTRACT;
export function createSteam626MakeupColor1Transport(wasm,initial,identity,options){return fixedMakeupColor1(wasm,initial,identity,options,false)}
export function createSwitch626MakeupColor1Transport(wasm,initial,identity,options){return fixedMakeupColor1(wasm,initial,identity,options,true)}
function fixedMakeupColor1(wasm,initial,identity,options,switchBuild){
 const contract=switchBuild?SWITCH_CONTRACT:CONTRACT;
 const output=switchBuild?SWITCH_OUTPUT:OUTPUT;
 const prefix=switchBuild?'switch626':'steam626';
 const previewMethod='preview_'+prefix+'_makeup_color1';
 const stageMethod='stage_'+prefix+'_makeup_color1';
 if(typeof document!=='undefined'||!wasm||typeof wasm[previewMethod]!=='function'||
  typeof wasm[stageMethod]!=='function'||!options||
  !plain(identity,'platform,buildKind,buildId,schema')||!(switchBuild?(identity.platform==='switch'&&identity.buildKind==='switch-bid'&&identity.buildId===SWITCH_BID):(identity.platform==='steam-windows'&&identity.buildKind==='steam-full-version'&&identity.buildId===BUILD))||identity.schema!==626||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||
  initial.revision!==0||initial.indexGeneration!==1||!sha(initial.decodedSha256)||
  typeof initial.sessionId!=='string'||!/^[a-f0-9]{32}$/.test(initial.sessionId)||/^0{32}$/.test(initial.sessionId)||
  initial.fullDocumentJsonValidated!==true||initial.productWorkerBound!==true||
  initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)deny();
 const {parse,current,revoke,maxBytes,chunkBytes}=options;
 let captured=null;
 const life=createScopedEditLifecycle(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes,
  contract,stageContract:contract,outputContract:output,exactCount:1,
  toggleMethod:'toggle_'+prefix+'_makeup_color1',
  beginMethod:'begin_'+prefix+'_makeup_color1_output',
  nextMethod:'next_'+prefix+'_makeup_color1_output_chunk',
  expectedProjection:()=>captured?.projectedDecodedSha256??null});
 const display=()=>Object.freeze({
  makeupItemId:140100014,slot:1,field:'ColorIndex1',
  oldColorIndex:53,newColorIndex:60,inventoryDelta:0,exactFieldChangedCount:1,
  scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false
 });
 const previewTarget=(...args)=>life.checked(()=>{
  if(args.length!==0||life.hasMutation())deny();
  const p=parse(wasm[previewMethod](...life.args()),4096);
  if(!plain(p,fields)||p.contract!==contract||p.makeupItemId!==140100014||p.slot!==1||
   p.field!=='ColorIndex1'||p.oldColorIndex!==53||p.newColorIndex!==60||
   !life.scopeMatches(p)||p.revision!==life.scope().revision||p.indexGeneration!==life.scope().indexGeneration||
   ![p.tokenSha256,p.entrySha256,p.femaleSha256,p.maleSha256,p.routesSha256,p.projectedDecodedSha256].every(sha)||
   p.projectedDecodedSha256===initial.decodedSha256||p.exactFieldChangedCount!==1||p.inventoryDelta!==0||
   p.scopedCandidate!==true||p.writerAuthorized!==false||p.editedCopyAuthorized!==false||
   p.originalOverwriteAuthorized!==false)deny();
  captured=Object.freeze({...p});
  return display();
 });
 const stage=()=>life.checked(()=>{
  if(!captured||life.hasMutation())deny();
  return Object.freeze({...display(),...life.stage((...args)=>wasm[stageMethod](
   captured.tokenSha256,captured.entrySha256,captured.femaleSha256,
   captured.maleSha256,captured.routesSha256,captured.projectedDecodedSha256,...args))});
 });
 const toggle=redo=>life.checked(()=>Object.freeze({...display(),...life.toggle(redo)}));
 return Object.freeze({previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation});
}
