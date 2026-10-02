/* Dreamwish Wand DDV Core — v1.25 destination progression veto projection.
 * Negative-veto/read-preflight only. Absence of a veto is never positive permission.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DdvCoreProgressionDestinationVetoV125=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const CURRENT_GAME_VERSION='1.25.0';
const CURRENT_PROFILE_SCHEMA=624;
const OPS=Object.freeze(['MOVE','ROTATE','REMOVE','DUPLICATE','REPLACE','STATE_EDIT','PRESET_CAPTURE','DESTINATION_OVERWRITE']);
const PROTECTED_OWNERSHIP=new Set(['QUEST_OWNED','PROGRESSION_BOUND','PUZZLE_OWNED','SYSTEM_SPAWNED','GLOBAL_SHARED_STATE','UNKNOWN_OWNERSHIP']);
const identityChanging=new Set(['REMOVE','DUPLICATE','REPLACE']);
const arr=v=>Array.isArray(v)?v:[];
const safeInt=v=>Number.isSafeInteger(Number(v))?Number(v):null;
const addrKey=(g,o)=>String(g)+':'+String(o);
function assert(c,m){if(!c)throw Error(m);}
function unique(xs){return [...new Set(xs)];}
function normalizeObject(o){
  const gridId=safeInt(o?.source?.gridId??o?.gridId??o?.GridID),gridObjectId=safeInt(o?.source?.gridObjectId??o?.gridObjectId??o?.GridObjectID??o?.ID),itemId=safeInt(o?.itemId??o?.ItemID);
  assert(gridId!==null&&gridObjectId!==null,'PROGRESSION_VETO_OBJECT_ADDRESS_REQUIRED');
  return {gridId,gridObjectId,itemId,editorId:o?.editorId??null};
}
function refsForAddress(index,g,o){
  if(!index||index.contract!=='ddv.progression-reference-index@1')throw Error('PROGRESSION_REFERENCE_INDEX_REQUIRED');
  const ids=index.indexes?.byGridObjectAddress?.[addrKey(g,o)]||[];
  const map=new Map(arr(index.references).map(r=>[r.referenceId,r]));
  return ids.map(id=>map.get(id)).filter(Boolean);
}
function deriveDefinitionDisposition(scope){
  if(!scope||typeof scope!=='object')return null;
  const reasonCodes=[],nativeOperationVetoes={};
  let ownershipClass=null;
  if(scope.forPuzzleOnly===true){ownershipClass='PUZZLE_OWNED';reasonCodes.push('FOR_PUZZLE_ONLY');}
  else if(scope.isMissionItem===true){ownershipClass='QUEST_OWNED';reasonCodes.push('IS_MISSION_ITEM');}
  else if(scope.explicitGridEditRestriction===true){ownershipClass='UNKNOWN_OWNERSHIP';reasonCodes.push('GRID_EDIT_RESTRICTION_PRESENT');}
  const signals=scope.progressionOperationSignals||scope.nativeOperationSignals||{};
  for(const [op,sig] of Object.entries(signals)){
    if(!OPS.includes(op))continue;
    if(sig?.kind==='CONSTANT'&&sig.value===false)nativeOperationVetoes[op]=['NATIVE_GRID_EDIT_RESTRICTION_FALSE'];
    else if(sig?.kind==='CONDITIONAL')nativeOperationVetoes[op]=['NATIVE_GRID_EDIT_RESTRICTION_CONDITION_UNRESOLVED'];
  }
  if(!ownershipClass&&!Object.keys(nativeOperationVetoes).length)return null;
  return {ownershipClass:ownershipClass??'UNKNOWN_OWNERSHIP',evidenceStatus:'CONFIRMED',reasonCodes,nativeOperationVetoes};
}
function dispositionForItem(index,itemId){
  if(itemId===null||!index)return null;
  const raw=index[itemId]??index[String(itemId)]??null;
  if(!raw)return null;
  if(raw.schema==='ddv.progression-definition-disposition-record@1'||raw.ownershipClass||raw.nativeOperationVetoes)return raw;
  return deriveDefinitionDisposition(raw);
}
function severityEvidence(refs,disp){
  if(refs.some(r=>r.evidenceStatus==='UNKNOWN')||disp?.evidenceStatus==='UNKNOWN')return 'UNKNOWN';
  if(refs.some(r=>r.evidenceStatus==='HIGH_CONFIDENCE')||disp?.evidenceStatus==='HIGH_CONFIDENCE')return 'HIGH_CONFIDENCE';
  if(refs.length||disp)return 'CONFIRMED';
  return 'UNKNOWN';
}
function projectOne(object,index,definitionDispositionByItemId){
  const obj=normalizeObject(object),refs=refsForAddress(index,obj.gridId,obj.gridObjectId),disp=dispositionForItem(definitionDispositionByItemId,obj.itemId);
  const active=refs.filter(r=>r.activity==='ACTIVE'&&r.activeOwnershipVeto===true);
  const unknown=refs.filter(r=>r.activity==='UNKNOWN'&&r.activeOwnershipVeto===true);
  const hist=refs.filter(r=>r.activity==='HISTORICAL');
  const reasons=[]; const vetoes=Object.fromEntries(OPS.map(op=>[op,[]]));
  let ownership=disp?.ownershipClass??null,phase='UNKNOWN',activeDisposition='NONE_OBSERVED';
  if(active.length){activeDisposition='ACTIVE_EXACT_ADDRESS';ownership=ownership??'PROGRESSION_BOUND';phase='PROGRESSION_ACTIVE_LOCKED';reasons.push('ACTIVE_IDENTITY_REFERENCE');}
  if(unknown.length){activeDisposition=activeDisposition==='ACTIVE_EXACT_ADDRESS'?'ACTIVE_AND_UNKNOWN_SYSTEM_REFERENCE':'UNKNOWN_SYSTEM_REFERENCE';ownership='UNKNOWN_OWNERSHIP';phase='UNKNOWN';reasons.push('UNKNOWN_SYSTEM_REFERENCE');}
  if(!active.length&&!unknown.length&&hist.length)activeDisposition='HISTORICAL_ONLY';
  if(disp){
    ownership=ownership??'UNKNOWN_OWNERSHIP';
    reasons.push(...arr(disp.reasonCodes),'PROGRESSION_RISK_DEFINITION');
    for(const [op,codes] of Object.entries(disp.nativeOperationVetoes||{}))if(vetoes[op])vetoes[op].push(...arr(codes));
  }
  if(active.length)for(const op of identityChanging)vetoes[op].push('REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN');
  if(unknown.length)for(const op of OPS)vetoes[op].push('PROGRESSION_OWNERSHIP_UNKNOWN');
  if(ownership&&PROTECTED_OWNERSHIP.has(ownership)){
    vetoes.DESTINATION_OVERWRITE.push('PROTECTED_PROGRESSION_OBJECT_CONFLICT');
    vetoes.PRESET_CAPTURE.push('PROTECTED_PROGRESSION_SOURCE_CAPTURE_EXCLUDED');
    if(phase==='UNKNOWN')reasons.push('PROTECTED_OWNERSHIP_WITHOUT_POSITIVE_PHASE_PROOF');
  }
  for(const op of OPS)vetoes[op]=unique(vetoes[op]);
  const anyVeto=OPS.some(op=>vetoes[op].length>0);
  return Object.freeze({
    schema:'ddv.progression-destination-veto-record@1',
    gridObjectAddress:{gridId:obj.gridId,gridObjectId:obj.gridObjectId},itemID:obj.itemId,editorId:obj.editorId,
    ownershipClass:ownership??'UNCLASSIFIED_NO_POSITIVE_INFERENCE',phaseClass:phase,activeReferenceDisposition:activeDisposition,
    references:{active:active.map(r=>r.referenceId),unknown:unknown.map(r=>r.referenceId),historical:hist.map(r=>r.referenceId)},
    operationVetoes:vetoes,evidenceStatus:severityEvidence(refs,disp),reasonCodes:unique(reasons),
    destinationProtected:vetoes.DESTINATION_OVERWRITE.length>0,
    negativeVetoFound:anyVeto,
    positivePermission:false,
    noVetoMeaning:'NO_VETO_FOUND_NOT_AUTHORIZED',
    writerAuthorized:false
  });
}
function projectDestinationProgressionVeto({objects,progressionReferenceIndex,definitionDispositionByItemId,scopeIndex,source}={}){
  assert(source?.gameVersion===CURRENT_GAME_VERSION,'PROGRESSION_VETO_VERSION_UNSUPPORTED');
  assert(Number(source?.profileSchemaVersion)===CURRENT_PROFILE_SCHEMA,'PROGRESSION_VETO_SCHEMA_UNSUPPORTED');
  assert(Array.isArray(objects),'PROGRESSION_VETO_OBJECTS_REQUIRED');
  const defs=definitionDispositionByItemId||scopeIndex||{};
  const records=objects.map(o=>projectOne(o,progressionReferenceIndex,defs));
  const byAddress=Object.fromEntries(records.map(r=>[addrKey(r.gridObjectAddress.gridId,r.gridObjectAddress.gridObjectId),r]));
  return Object.freeze({
    schema:'ddv.progression-destination-veto-projection@1',version:'v1.15-candidate',
    target:{gameVersion:CURRENT_GAME_VERSION,profileSchemaVersion:CURRENT_PROFILE_SCHEMA},records,byAddress,
    summary:{objects:records.length,protected:records.filter(r=>r.destinationProtected).length,negativeVeto:records.filter(r=>r.negativeVetoFound).length,unclassifiedNoPositiveInference:records.filter(r=>r.ownershipClass==='UNCLASSIFIED_NO_POSITIVE_INFERENCE').length},
    semantics:{readPreflightOnly:true,absenceOfVetoIsPermission:false,positivePermission:false,consumerMayOnlyUseVetoes:true},
    writerBoundary:{persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,applyAuthorized:false}
  });
}
return Object.freeze({CURRENT_GAME_VERSION,CURRENT_PROFILE_SCHEMA,OPS,deriveDefinitionDisposition,projectDestinationProgressionVeto});
});
