/* Dreamwish Wand DDV Core — v1.25 Building lifecycle read/model/preflight adapter.
 * Promoted from 01B C1 evidence. Persistent writing is never authorized here.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DdvCoreBuildingLifecycleV125=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const CONTRACT='ddv.building-lifecycle-semantics@1';
const CURRENT_GAME_VERSION='1.25.0';
const CURRENT_PROFILE_SCHEMA=624;
const BUILD_ID='52BD625D9B4E0053';
const CLASSES=Object.freeze({
 ORDINARY:'ORDINARY_GRID_BUILDING',
 SPECIAL:'SPECIAL_GRID_BUILDING',
 OFF_GRID:'OFF_GRID_BUILDING',
 UNKNOWN:'UNKNOWN_BUILDING'
});
const ok=(status,extra={})=>({status,persistentWriteAuthorized:false,...extra});
function integer(v){if(v===null||v===undefined||v===''||typeof v==='boolean')return null;const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function explicitFalse(v){return v===false;}
function classifyBuilding(meta={}){
 const type=String(meta.buildingItemType||'');
 if(type==='OffGridBuilding')return ok('CLASSIFIED',{class:CLASSES.OFF_GRID,reasons:['SEPARATE_PROFILEWORLD_OFFGRID_LIFECYCLE']});
 if(type==='PlayerHouse')return ok('CLASSIFIED',{class:CLASSES.SPECIAL,reasons:['PLAYER_HOUSE_INTERIOR_BINDING']});
 if(type==='Stall')return ok('CLASSIFIED',{class:CLASSES.SPECIAL,reasons:['STALL_SHOP_STATE']});
 if(type==='Garden')return ok('CLASSIFIED',{class:CLASSES.SPECIAL,reasons:['GARDEN_SPECIAL_LIFECYCLE']});
 const reasons=[];
 if(meta.characterHouse===true)reasons.push('CHARACTER_HOUSE_LIFECYCLE');
 if(meta.fastTravel===true)reasons.push('FAST_TRAVEL_WORLD_STATE');
 if(meta.sharedSynchronizer===true)reasons.push('SHARED_SYNCHRONIZED_STATE');
 if(meta.globalStateBinding===true)reasons.push('GLOBAL_STATE_BINDING');
 if(meta.unmodeledSpecialLifecycle===true)reasons.push('UNMODELED_SPECIAL_LIFECYCLE');
 if(reasons.length)return ok('CLASSIFIED',{class:CLASSES.SPECIAL,reasons});
 if(type!=='House'&&type!=='Other')return ok('UNKNOWN_UNSUPPORTED',{class:CLASSES.UNKNOWN,blockers:[{code:'BUILDING_ITEM_TYPE_UNSUPPORTED_OR_UNKNOWN'}]});
 const required=['characterHouse','fastTravel','sharedSynchronizer','globalStateBinding','unmodeledSpecialLifecycle'];
 const missing=required.filter(k=>!explicitFalse(meta[k]));
 if(missing.length)return ok('UNKNOWN_UNSUPPORTED',{class:CLASSES.UNKNOWN,blockers:[{code:'BUILDING_CLASSIFICATION_EVIDENCE_INCOMPLETE',fields:missing}]});
 return ok('CLASSIFIED',{class:CLASSES.ORDINARY,reasons:['NO_KNOWN_SPECIAL_LIFECYCLE_BINDING']});
}
function portableBuildingIdentity({itemId}={}){
 const id=integer(itemId);
 if(id===null)return ok('INVALID',{blockers:[{code:'BUILDING_ITEM_ID_INVALID'}]});
 return ok('VALID',{identity:{itemId:id},excludedIdentity:['GridObject.ID']});
}
function resolveDestinationPlayerHouseBinding({houseItemId,destinationPlayerHouses}={}){
 const id=integer(houseItemId);
 if(id===null)return ok('INVALID',{blockers:[{code:'PLAYER_HOUSE_ITEM_INVALID'}]});
 if(!Array.isArray(destinationPlayerHouses))return ok('UNKNOWN_UNSUPPORTED',{blockers:[{code:'PLAYER_HOUSE_DESTINATION_BINDER_NOT_BOUND'}]});
 const matches=[];
 for(let i=0;i<destinationPlayerHouses.length;i++)if(integer(destinationPlayerHouses[i]?.HouseItemID)===id)matches.push(i);
 if(matches.length===1)return ok('BIND_EXISTING_DESTINATION_INTERIOR',{binding:{houseItemId:id,playerHouseIndex:matches[0]},destinationLocalFields:['playerHouseIndex','interiorGridIds']});
 if(matches.length===0)return ok('BLOCKED',{blockers:[{code:'PLAYER_HOUSE_INTERIOR_CREATE_POLICY_UNRESOLVED'}],nativeObservedFallback:'CreatePlayerHouse'});
 return ok('UNKNOWN_UNSUPPORTED',{blockers:[{code:'PLAYER_HOUSE_MULTIPLE_INTERIOR_BINDINGS_UNRESOLVED',matchingIndexes:matches}]});
}
function preflightBuildingOperation(meta={},operation,ctx={}){
 const classified=classifyBuilding(meta);
 if(classified.class===CLASSES.UNKNOWN)return ok('BLOCKED',{class:CLASSES.UNKNOWN,blockers:classified.blockers||[{code:'BUILDING_CLASSIFICATION_EVIDENCE_INCOMPLETE'}]});
 const op=String(operation||'');
 if(op==='READ_MODEL')return ok('VALID_READ_MODEL',{class:classified.class,reasons:classified.reasons||[]});
 if(op==='PERSISTENT_APPLY')return ok('BLOCKED',{class:classified.class,blockers:[{code:'PERSISTENT_WRITE_UNAUTHORIZED'}]});
 if(op==='CROSS_GRID_TRANSFER')return ok('BLOCKED',{class:classified.class,blockers:[{code:'BUILDING_CROSS_GRID_LIFECYCLE_REQUIRED'}]});
 if(op==='REMOVE')return ok('BLOCKED',{class:classified.class,blockers:[{code:'BUILDING_REMOVAL_NATIVE_LIFECYCLE_REQUIRED'}]});
 if(op==='BASE_REPLACE')return ok('BLOCKED',{class:classified.class,blockers:[{code:'BUILDING_BASE_REPLACEMENT_UNRESOLVED'}]});
 if(op==='DUPLICATE')return ok('BLOCKED',{class:classified.class,blockers:[{code:'BUILDING_DUPLICATION_POLICY_UNRESOLVED'}]});
 if(op==='SAME_GRID_TRANSFORM'){
  if(classified.class===CLASSES.ORDINARY)return ok('MODEL_ELIGIBLE_WRITER_DISABLED',{class:classified.class,requiresNativeOperation:'UpdateGridObjectTransform'});
  if(classified.class===CLASSES.OFF_GRID)return ok('BLOCKED',{class:classified.class,blockers:[{code:'BUILDING_OFFGRID_SEPARATE_LIFECYCLE'}]});
  return ok('BLOCKED',{class:classified.class,blockers:[{code:'BUILDING_SPECIAL_LIFECYCLE_UNSUPPORTED'}]});
 }
 if(op==='ADD_PLACEMENT'){
  if(String(meta.buildingItemType)==='PlayerHouse'){
   const binding=resolveDestinationPlayerHouseBinding({houseItemId:ctx.houseItemId??meta.itemId,destinationPlayerHouses:ctx.destinationPlayerHouses});
   const blockers=[];
   if(binding.status!=='BIND_EXISTING_DESTINATION_INTERIOR')blockers.push(...(binding.blockers||[{code:'PLAYER_HOUSE_DESTINATION_BINDING_UNKNOWN'}]));
   if(ctx.multiplicityStatus!=='VALID')blockers.push({code:'BUILDING_NATIVE_MULTIPLICITY_VALIDATION_REQUIRED'});
   if(ctx.nativePlacementStatus!=='NATIVE_VALID_CLEAR')blockers.push({code:'BUILDING_NATIVE_PLACEMENT_VALIDATION_REQUIRED'});
   blockers.push({code:'PLAYER_HOUSE_PLACEMENT_POLICY_UNRESOLVED'});
   return ok('BLOCKED',{class:classified.class,binding:binding.binding||null,blockers});
  }
  if(classified.class!==CLASSES.ORDINARY)return ok('BLOCKED',{class:classified.class,blockers:[{code:'BUILDING_SPECIAL_LIFECYCLE_UNSUPPORTED'}]});
  const blockers=[];
  if(ctx.stockStatus!=='VALID')blockers.push({code:'BUILDING_NATIVE_STOCK_VALIDATION_REQUIRED'});
  if(ctx.multiplicityStatus!=='VALID')blockers.push({code:'BUILDING_NATIVE_MULTIPLICITY_VALIDATION_REQUIRED'});
  if(ctx.nativePlacementStatus!=='NATIVE_VALID_CLEAR')blockers.push({code:'BUILDING_NATIVE_PLACEMENT_VALIDATION_REQUIRED'});
  if(blockers.length)return ok('BLOCKED',{class:classified.class,blockers});
  return ok('PREFLIGHT_VALID_WRITER_DISABLED',{class:classified.class,nativeLifecycle:['AddObjectWithClearing','inventory decrement','category side effects']});
 }
 return ok('INVALID',{class:classified.class,blockers:[{code:'BUILDING_OPERATION_UNSUPPORTED'}]});
}
return Object.freeze({
 CONTRACT,CURRENT_GAME_VERSION,CURRENT_PROFILE_SCHEMA,BUILD_ID,CLASSES,
 classifyBuilding,portableBuildingIdentity,resolveDestinationPlayerHouseBinding,preflightBuildingOperation
});
});
