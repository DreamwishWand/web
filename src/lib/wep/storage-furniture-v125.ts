import { SafeProfileEditSession } from '../ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../ddv/core/save/p1g-packaged-profile-codec.js';
import { BuildIdentityKind, PlatformFamily } from '../ddv/core/save/versioning.js';
import { createVerifiedCandidateExportBundle } from '../ddv/core/save/verified-export-bundle.js';
import { buildStorageActiveReferenceIndexV125, selectStorageActiveReferenceEvidenceV125 } from '../ddv/core/world/storage-active-reference-index-v125.js';
import {
  compileStorageCrossGridMoveV125, compileStoragePutAwayNonemptyV125,
  compileStorageRePlaceNonemptyV125, compileStorageSameGridMoveV125,
  resolvePlacedStorageFurnitureV125, resolveStoredStorageContainerV125
} from '../ddv/core/world/storage-container-v125.js';
import {
  bindStorageGridObjectTemplateEvidenceV125,
  buildStorageCrossGridMoveTransactionPlanV125,
  buildStoragePutAwayNonemptyTransactionPlanV125,
  buildStorageReplaceNonemptyTransactionPlanV125,
  buildStorageSameGridMoveTransactionPlanV125,
  STORAGE_TRANSACTION_BINDING_CONTRACT
} from '../ddv/core/world/storage-transition-binding-v125.js';
import {
  createVerifiedStorageBindingCandidateFromCurrentSaveV125,
  verifyStorageBindingCandidateFromCurrentSaveV125
} from '../ddv/core/world/storage-binding-candidate-v125.js';
import { analyzeMinimumTransformDraft } from './min-verified-transform-export-v1.ts';
import { openWorldSaveBytes } from './world-save-source.ts';

type AnyRecord = Record<string, any>;
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const STORAGE_FURNITURE_DEFINITION_PACK_PATH='/ddv/wep/world/v1.25/storage-furniture-definition-pack-v125.json';
export const STORAGE_FURNITURE_DEFINITION_PACK_SHA256='9c8413291c283ef14fdbc7968b53944f46e055a45e917d6b049c89f22501fe17';
export const STORAGE_FURNITURE_VERIFIED_EXPORT_CONTRACT='dreamwish-wand-wep-storage-furniture-verified-export@1';
export const STORAGE_FURNITURE_CAPABILITY_CONTRACT='dreamwish-wand-wep-storage-furniture-capability@1';
export const SWITCH_V125_BID='52BD625D9B4E0053';
export const STORAGE_RUNTIME_ACCEPTANCE=Object.freeze({
  artifact:'DDV_01E_STORAGE_CONTAINER_TRANSITION_FINAL_ACCEPTANCE_CLOSED_2026-10-07.json',
  driveId:'1qj3XWmjoLIfqpbE4iedTC6XE20Rj-w6n',
  sha256:'72b3bb7a04b6c30dbad762549a3064d096e49d5138ee7702226c0f9a06ccd242',
  status:'CLOSED_PASS'
});
const sourceContract=Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:SWITCH_V125_BID});
const targetBuild=Object.freeze({platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:SWITCH_V125_BID});
const clone=<T>(v:T):T=>structuredClone(v);
const eq=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

function fail(code:string,detail:unknown=null):never { const e:any=new Error(code);e.code=code;e.detail=detail;throw e; }
async function sha256Hex(bytes:Uint8Array) {
  if(!globalThis.crypto?.subtle) fail('WEP_STORAGE_SHA256_UNAVAILABLE');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function definitionFor(index:AnyRecord,itemId:number){return index?.[String(itemId)]??index?.[itemId]??null;}
function rawObject(profile:AnyRecord,g:number,o:number){return profile?.World?.GridCollection?.Grids?.[String(g)]?.Objects?.[String(o)]??null;}
function cidOf(o:AnyRecord){const n=Number(o?.State?.Storage?.ContainerInventoryID);return Number.isSafeInteger(n)&&n>=0?n:null;}
function listInventoryIdFor(profile:AnyRecord,itemId:number) {
  const matches=Object.entries(profile?.Player?.ListInventories??{}).filter(([,v]:any)=>v?.Inventory?.[String(itemId)]&&typeof v.Inventory[String(itemId)]==='object').map(([k,v]:any)=>Number(v?.ID??k)).filter(Number.isSafeInteger);
  if(matches.length!==1) fail(matches.length?'WEP_STORAGE_LIST_INVENTORY_AMBIGUOUS':'WEP_STORAGE_LIST_INVENTORY_ENTRY_MISSING',{itemId,matches});
  return matches[0];
}
function exactActiveIndex(profile:AnyRecord,itemDefinitionsById:AnyRecord){
  const index=buildStorageActiveReferenceIndexV125({source:sourceContract,profile,itemDefinitionsById});
  if(index?.status!=='COMPLETE_CURRENT_SAVE') fail('WEP_STORAGE_ACTIVE_REFERENCE_INDEX_INCOMPLETE',clone(index?.reasonCodes??[]));
  return index;
}
function resolvePlacedExact(profile:AnyRecord,itemDefinitionsById:AnyRecord,gridId:number,gridObjectId:number){
  const object=rawObject(profile,gridId,gridObjectId);
  if(!object) fail('WEP_STORAGE_SOURCE_OBJECT_MISSING');
  const itemId=Number(object.ItemID),definition=definitionFor(itemDefinitionsById,itemId);
  if(!definition) fail('WEP_STORAGE_ITEM_DEFINITION_UNKNOWN',{itemId});
  if(definition.interaction==='HomeStorage') fail('WEP_STORAGE_HOME_STORAGE_UNSUPPORTED',{itemId});
  if(!Number.isSafeInteger(Number(definition.defaultContainerSize))||Number(definition.defaultContainerSize)<=0) fail('WEP_STORAGE_DEFAULT_SIZE_UNRESOLVED',{itemId});
  const cid=cidOf(object);if(cid===null) fail('WEP_STORAGE_CONTAINER_ID_INVALID',{itemId});
  const index=exactActiveIndex(profile,itemDefinitionsById);
  const evidence=selectStorageActiveReferenceEvidenceV125({index,containerInventoryId:cid,expectedReferenceCount:1});
  const listInventoryId=listInventoryIdFor(profile,itemId);
  const resolved=resolvePlacedStorageFurnitureV125({source:sourceContract,profile,gridId,gridObjectId,itemDefinition:definition,activeReferenceEvidence:evidence,listInventoryId});
  if(resolved?.status!=='READY') fail('WEP_STORAGE_PLACED_RESOLUTION_REJECTED',clone(resolved?.reasonCodes??[]));
  if(resolved.contentsNonEmpty!==true) fail('WEP_STORAGE_EMPTY_UNSUPPORTED');
  return {resolved,evidence,definition,listInventoryId};
}
function assertOpened(opened:AnyRecord,exact:boolean){
  if(exact!==true) fail('WEP_STORAGE_EXACT_BUILD_CONFIRMATION_REQUIRED');
  if(opened?.inputFormat!=='packaged'||opened?.saveIdentity?.sourcePlatform!=='switch'||opened?.compatibility?.gameVersion!=='1.25.0'||Number(opened?.profileSchemaVersion)!==624) fail('WEP_STORAGE_UNSUPPORTED_VERSION_BUILD');
}

export async function loadStorageFurnitureDefinitionPack({basePath='',fetchImpl=globalThis.fetch.bind(globalThis)}:{basePath?:string;fetchImpl?:FetchLike}={}){
  const prefix=String(basePath??'').replace(/\/$/,'');
  const response=await fetchImpl(`${prefix}${STORAGE_FURNITURE_DEFINITION_PACK_PATH}`);
  if(!response.ok) fail('WEP_STORAGE_DEFINITION_PACK_FETCH_FAILED');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(await sha256Hex(bytes)!==STORAGE_FURNITURE_DEFINITION_PACK_SHA256) fail('WEP_STORAGE_DEFINITION_PACK_HASH_MISMATCH');
  let pack:any;try{pack=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('WEP_STORAGE_DEFINITION_PACK_JSON_INVALID');}
  if(pack?.schema!=='dreamwish-wand-v125-storage-furniture-definition-pack'||Number(pack?.version)!==2||pack?.platform!=='Nintendo Switch'||pack?.gameVersion!=='1.25.0'||pack?.buildID!==SWITCH_V125_BID||Number(pack?.profileSchemaVersion)!==624||Number(pack?.authority?.containerDefinitionCount)!==134||Number(pack?.authority?.homeStorageDefinitionCount)!==2||Number(pack?.authority?.resolvedGenericContainerCount)!==79||!pack?.records) fail('WEP_STORAGE_DEFINITION_PACK_CONTRACT_MISMATCH');
  const itemDefinitionsById:AnyRecord={};
  for(const [key,row] of Object.entries(pack.records) as any){
    if(!Array.isArray(row)||row.length!==3) fail('WEP_STORAGE_DEFINITION_PACK_ROW_INVALID',{key});
    const itemId=Number(key),interaction=String(row[0]),size=row[1]===null?null:Number(row[1]);
    if(!Number.isSafeInteger(itemId)||!['Container','HomeStorage'].includes(interaction)||!(size===null||[16,32,48].includes(size))||typeof row[2]!=='string'||!/^[0-9a-f]{64}$/.test(row[2])) fail('WEP_STORAGE_DEFINITION_PACK_ROW_INVALID',{key});
    itemDefinitionsById[key]=Object.freeze({itemId,concreteType:'FurnitureItemData',interaction,defaultContainerSize:size,rawPayloadSha256:String(row[2])});
  }
  return Object.freeze({contract:pack.schema,itemDefinitionsById:Object.freeze(itemDefinitionsById),authority:Object.freeze(clone(pack.authority)),hardFlags:Object.freeze(clone(pack.hardFlags))});
}

export function annotateStorageFurnitureDocumentV125({document,profile,itemDefinitionsById}:{document:AnyRecord;profile:AnyRecord;itemDefinitionsById:AnyRecord}){
  const out=clone(document);
  if(out?.target?.gameVersion!=='1.25.0'||out?.target?.platform!=='Nintendo Switch'||Number(out?.target?.profileSchemaVersion)!==624) return out;
  let index:any=null,indexError:string|null=null;
  try{index=exactActiveIndex(profile,itemDefinitionsById);}catch(e:any){indexError=String(e?.code??e?.message??e);}
  out.objects=(out.objects??[]).map((object:any)=>{
    if(object?.metadata?.stateKind!=='Storage') return object;
    const copy=clone(object),prior=(copy.metadata?.reasons??[]).map(String).filter((x:string)=>x!=='STATE_Storage_UNSUPPORTED'),blocked:string[]=[];
    const itemId=Number(copy.itemId),definition=definitionFor(itemDefinitionsById,itemId),g=Number(copy?.source?.gridId),o=Number(copy?.source?.gridObjectId),raw=rawObject(profile,g,o),cid=cidOf(raw);
    if(indexError) blocked.push(indexError);
    if(!definition) blocked.push('WEP_STORAGE_ITEM_DEFINITION_UNKNOWN');
    else if(definition.interaction==='HomeStorage') blocked.push('WEP_STORAGE_HOME_STORAGE_UNSUPPORTED');
    else if(!Number.isSafeInteger(Number(definition.defaultContainerSize))) blocked.push('WEP_STORAGE_DEFAULT_SIZE_UNRESOLVED');
    if(cid===null) blocked.push('WEP_STORAGE_CONTAINER_ID_INVALID');
    let resolved:any=null;
    if(!blocked.length){
      try{
        const evidence=selectStorageActiveReferenceEvidenceV125({index,containerInventoryId:cid,expectedReferenceCount:1});
        const listInventoryId=listInventoryIdFor(profile,itemId);
        resolved=resolvePlacedStorageFurnitureV125({source:sourceContract,profile,gridId:g,gridObjectId:o,itemDefinition:definition,activeReferenceEvidence:evidence,listInventoryId});
        if(resolved?.status!=='READY') blocked.push(...(resolved?.reasonCodes??['WEP_STORAGE_RESOLUTION_REJECTED']).map(String));
        else if(resolved.contentsNonEmpty!==true) blocked.push('WEP_STORAGE_EMPTY_UNSUPPORTED');
      }catch(e:any){blocked.push(String(e?.code??e?.message??e));}
    }
    const reasons=[...new Set([...prior,...blocked])];
    copy.editability=resolved?.status==='READY'&&resolved.contentsNonEmpty===true&&reasons.length===0?'editable':'readonly';
    copy.metadata={...(copy.metadata??{}),reasons};
    if(resolved?.status==='READY'&&resolved.contentsNonEmpty===true){
      copy.metadata.storageCapability=Object.freeze({
        contract:STORAGE_FURNITURE_CAPABILITY_CONTRACT,status:'SUPPORTED_NONEMPTY',
        bindingContract:STORAGE_TRANSACTION_BINDING_CONTRACT,
        containerInventoryId:Number(resolved.containerInventoryId),expectedContainerSize:Number(resolved.expectedContainerSize),
        contents:'PROTECTED_ATTACHED_STATE',contentsEditable:false,containerInventoryPortable:false,
        operations:Object.freeze({sameGridMove:'UI_PRESENT',rotate:'BLOCKED',crossGridMove:'INTERNAL_ONLY',putAwayNonempty:'INTERNAL_ONLY',replaceNonempty:'INTERNAL_ONLY'}),
        hardFlags:Object.freeze({persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false})
      });
    }
    return copy;
  });
  return out;
}
export function isStorageFurnitureEditorObjectV125(object:AnyRecord){return object?.metadata?.storageCapability?.contract===STORAGE_FURNITURE_CAPABILITY_CONTRACT&&object?.metadata?.storageCapability?.status==='SUPPORTED_NONEMPTY';}

export async function reviewStorageSameGridMoveVerifiedExportV125({sourceBytes,sourceName,sourceEpoch,opened,baselineDocument,draftDocument,placementBinding,itemDefinitionsById,exactBuildConfirmed=false}:AnyRecord){
  if(!(sourceBytes instanceof Uint8Array)||!sourceBytes.length) fail('WEP_STORAGE_SOURCE_REQUIRED');
  assertOpened(opened,exactBuildConfirmed);
  const change:any=analyzeMinimumTransformDraft({baselineDocument,draftDocument});
  if(change.operation!=='MOVE') fail('WEP_STORAGE_ROTATE_NOT_PROMOTED');
  if(!isStorageFurnitureEditorObjectV125(change.beforeObject)||(change.beforeObject?.metadata?.reasons??[]).length) fail('WEP_STORAGE_OBJECT_NOT_BOUND');
  const rawPlacement=placementBinding?.classifyMinimumTransformPlacement?.({document:draftDocument,editorId:change.editorId});
  if(rawPlacement?.result?.status!=='VALID'||rawPlacement?.result?.valid!==true||rawPlacement?.result?.verdict!=='VALID'||rawPlacement?.clearArea!==false) fail('WEP_STORAGE_INVALID_DESTINATION',clone(rawPlacement));
  const session=await SafeProfileEditSession.open({sourceBytes:sourceBytes.slice(),codec:p1gPackagedProfileCodec as any,sourcePlatform:PlatformFamily.Switch});
  const profile=session.getSnapshot(),exact=resolvePlacedExact(profile,itemDefinitionsById,change.gridId,change.gridObjectId),orientation=String(exact.resolved.object.Orientation);
  const placementEvidence={status:'VALID',valid:true,clearArea:false,gridId:Number(change.gridId),itemId:Number(change.itemId),x:Number(change.after.x),y:Number(change.after.y),orientation};
  const transition=compileStorageSameGridMoveV125({resolved:exact.resolved,profile,destination:{x:change.after.x,y:change.after.y,orientation},placementEvidence});
  const ctx=session.getPreflightContext();
  const transactionInput={platform:PlatformFamily.Switch,gameVersion:'1.25.0',profileGameInfoVersion:624,originalFileLength:session.source.length,originalSha256:ctx.saveIdentity.sourceRawSha256,codecContract:ctx.codecContract,targetBuild:{...targetBuild}};
  const plan=buildStorageSameGridMoveTransactionPlanV125({transition,resolved:exact.resolved,profile,transactionInput,activeReferenceEvidence:exact.evidence,planId:`wep-storage-same-grid-${change.gridId}-${change.gridObjectId}-${String(ctx.saveIdentity.sourceRawSha256).slice(0,12)}`});
  return Object.freeze({contract:STORAGE_FURNITURE_VERIFIED_EXPORT_CONTRACT,status:'READY',semanticOperation:'STORAGE SAME-GRID MOVE',sourceEpoch:Number(sourceEpoch),sourceName:String(sourceName||'profile'),sourceSha256:String(ctx.saveIdentity.sourceRawSha256),sourceByteLength:session.source.length,targetBuild,change,plan,placementEvidence,protectedStorage:Object.freeze({containerInventoryId:Number(exact.resolved.containerInventoryId),itemId:Number(exact.resolved.itemId),contents:'PROTECTED_ATTACHED_STATE',editable:false,portable:false}),runtimeAcceptance:STORAGE_RUNTIME_ACCEPTANCE,persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false});
}

export async function commitStorageFurnitureVerifiedExportV125({review,currentSourceEpoch,sourceBytes,baselineDocument,draftDocument,itemDefinitionsById}:AnyRecord){
  if(review?.contract!==STORAGE_FURNITURE_VERIFIED_EXPORT_CONTRACT||review?.status!=='READY') fail('WEP_STORAGE_REVIEW_REQUIRED');
  if(Number(currentSourceEpoch)!==Number(review.sourceEpoch)) fail('WEP_STORAGE_SOURCE_CHANGED_SINCE_PLAN');
  if(!eq(analyzeMinimumTransformDraft({baselineDocument,draftDocument}),review.change)) fail('WEP_STORAGE_REVIEW_STALE');
  const sourceHashBefore=await sha256Hex(sourceBytes);if(sourceHashBefore!==review.sourceSha256||sourceBytes.length!==review.sourceByteLength) fail('WEP_STORAGE_SOURCE_CHANGED_SINCE_PLAN');
  const session=await SafeProfileEditSession.open({sourceBytes:sourceBytes.slice(),codec:p1gPackagedProfileCodec as any,sourcePlatform:PlatformFamily.Switch});
  let candidateBundle:any;try{candidateBundle=await createVerifiedStorageBindingCandidateFromCurrentSaveV125({session,plan:review.plan,itemDefinitionsById});}catch(e:any){fail('WEP_STORAGE_CANDIDATE_GENERATION_FAILED',{causeCode:String(e?.code??e?.message??e)});}
  let verified:any;try{verified=await verifyStorageBindingCandidateFromCurrentSaveV125({candidate:candidateBundle.candidate,codec:p1gPackagedProfileCodec,itemDefinitionsById});}catch(e:any){fail('WEP_STORAGE_CANDIDATE_VERIFICATION_FAILED',{causeCode:String(e?.code??e?.message??e)});}
  const coreVerification=verified?.verification?.coreVerification;if(coreVerification?.status!=='PASS') fail('WEP_STORAGE_CANDIDATE_VERIFICATION_FAILED');
  const artifacts=await createVerifiedCandidateExportBundle({candidate:candidateBundle.candidate,verification:coreVerification,gameVersion:'1.25.0',targetBuild:{...targetBuild},sourceName:review.sourceName});
  const reopened=await openWorldSaveBytes(candidateBundle.candidate.candidateBytes,{sourcePlatform:PlatformFamily.Switch});
  const g=Number(review.change.gridId),o=Number(review.change.gridObjectId),cid=Number(review.protectedStorage.containerInventoryId),after=rawObject(reopened.profile,g,o),before=rawObject(session.getSnapshot(),g,o);
  if(!after||!before||Number(after.ID)!==o||Number(after.ItemID)!==Number(review.change.itemId)||Number(after?.State?.Storage?.ContainerInventoryID)!==cid||Number(after.X)!==Number(review.change.after.x)||Number(after.Y)!==Number(review.change.after.y)||String(after.Orientation)!==String(before.Orientation)||!eq(session.getSnapshot()?.Player?.ContainerInventories,reopened.profile?.Player?.ContainerInventories)||!eq(session.getSnapshot()?.Player?.ListInventories,reopened.profile?.Player?.ListInventories)) fail('WEP_STORAGE_RELOAD_IDENTITY_OR_PRESERVATION_MISMATCH');
  const sourceHashAfter=await sha256Hex(sourceBytes);if(sourceHashAfter!==sourceHashBefore) fail('WEP_STORAGE_SOURCE_MUTATED');
  return Object.freeze({contract:STORAGE_FURNITURE_VERIFIED_EXPORT_CONTRACT,status:'PASS',semanticOperation:review.semanticOperation,review:clone(review),verification:clone(verified),artifacts,source:{sha256Before:sourceHashBefore,sha256After:sourceHashAfter,untouched:true},protectedStorage:clone(review.protectedStorage),persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false});
}

export function planStorageCrossGridMoveInternalV125({profile,itemDefinitionsById,transactionInput,gridId,gridObjectId,destination,placementEvidence,planId}:AnyRecord){
  const x=resolvePlacedExact(profile,itemDefinitionsById,Number(gridId),Number(gridObjectId)),transition=compileStorageCrossGridMoveV125({resolved:x.resolved,profile,destination,placementEvidence});
  const plan=buildStorageCrossGridMoveTransactionPlanV125({transition,resolved:x.resolved,profile,transactionInput,activeReferenceEvidence:x.evidence,planId});
  return Object.freeze({status:'INTERNAL_ONLY',semanticOperation:'STORAGE CROSS-GRID MOVE',plan,protectedStorage:{containerInventoryId:x.resolved.containerInventoryId,contents:'PROTECTED_ATTACHED_STATE'},persistentWriteAuthorized:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false});
}
export function planStoragePutAwayNonemptyInternalV125({profile,itemDefinitionsById,transactionInput,gridId,gridObjectId,planId}:AnyRecord){
  const x=resolvePlacedExact(profile,itemDefinitionsById,Number(gridId),Number(gridObjectId)),transition=compileStoragePutAwayNonemptyV125({resolved:x.resolved});
  const plan=buildStoragePutAwayNonemptyTransactionPlanV125({transition,resolved:x.resolved,profile,transactionInput,activeReferenceEvidence:x.evidence,planId});
  return Object.freeze({status:'INTERNAL_ONLY',semanticOperation:'STORAGE PUT AWAY',plan,protectedStorage:{containerInventoryId:x.resolved.containerInventoryId,contents:'PROTECTED_ATTACHED_STATE'},persistentWriteAuthorized:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false});
}
export function planStorageReplaceNonemptyInternalV125({profile,itemDefinitionsById,transactionInput,itemId,containerInventoryId,gridObjectTemplate,destination,placementEvidence,planId}:AnyRecord){
  const definition=definitionFor(itemDefinitionsById,Number(itemId));if(!definition||definition.interaction!=='Container'||!Number.isSafeInteger(Number(definition.defaultContainerSize))) fail('WEP_STORAGE_ITEM_DEFINITION_NOT_REPLACEABLE');
  const index=exactActiveIndex(profile,itemDefinitionsById),evidence=selectStorageActiveReferenceEvidenceV125({index,containerInventoryId:Number(containerInventoryId),expectedReferenceCount:0}),listInventoryId=listInventoryIdFor(profile,Number(itemId));
  const templateEvidence=bindStorageGridObjectTemplateEvidenceV125({transactionInput,itemId:Number(itemId),containerInventoryId:Number(containerInventoryId),gridObject:gridObjectTemplate});
  const resolvedStored=resolveStoredStorageContainerV125({source:sourceContract,profile,containerInventoryId:Number(containerInventoryId),itemDefinition:definition,activeReferenceEvidence:evidence,listInventoryId,gridObjectTemplateEvidence:templateEvidence});
  if(resolvedStored?.status!=='READY') fail('WEP_STORAGE_STORED_RESOLUTION_REJECTED',clone(resolvedStored?.reasonCodes??[]));
  const transition=compileStorageRePlaceNonemptyV125({resolvedStored,profile,destination,placementEvidence});
  const plan=buildStorageReplaceNonemptyTransactionPlanV125({transition,resolvedStored,profile,transactionInput,activeReferenceEvidence:evidence,planId});
  return Object.freeze({status:'INTERNAL_ONLY',semanticOperation:'STORAGE RE-PLACE',plan,protectedStorage:{containerInventoryId:Number(containerInventoryId),contents:'PROTECTED_ATTACHED_STATE'},sameSaveHashBound:templateEvidence.sourceSha256,persistentWriteAuthorized:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false});
}
