/* Dreamwish Wand DDV Core 01B — v1.25 Building / PlayerHouse / Environment
 * portable-restoration contract. Capture + preflight only; never authorizes persistence.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DdvCoreWorldV125Restoration=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const CURRENT_GAME_VERSION='1.25.0';
const CURRENT_PROFILE_SCHEMA=624;
const ORIENTATION_NAMES=Object.freeze([
 'GridOrientation_Up','GridOrientation_UpUpRight','GridOrientation_UpRight','GridOrientation_UpRightRight',
 'GridOrientation_Right','GridOrientation_DownRightRight','GridOrientation_DownRight','GridOrientation_DownDownRight',
 'GridOrientation_Down','GridOrientation_DownDownLeft','GridOrientation_DownLeft','GridOrientation_DownLeftLeft',
 'GridOrientation_Left','GridOrientation_UpLeftLeft','GridOrientation_UpLeft','GridOrientation_UpUpLeft'
]);
const ORIENTATION_INDEX=new Map(ORIENTATION_NAMES.map((x,i)=>[x,i]));
const CODECS=Object.freeze({
 environment:'ddv.environment-effect@1',
 buildingSkin:'ddv.building-skin@1',
 playerHouseBinding:'ddv.player-house-binding@1'
});
const ENVIRONMENT_TARGET_KINDS=Object.freeze(['AREA','FLOATING_ISLAND']);
const ok=(status,extra={})=>({status,persistentWriteAuthorized:false,...extra});
function integer(v){if(v===null||v===undefined||v===''||typeof v==='boolean')return null;const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function orientationIndex(v){const n=integer(v);if(n!==null)return n>=0&&n<16?n:null;return ORIENTATION_INDEX.has(v)?ORIENTATION_INDEX.get(v):null;}
function stateData(obj){const s=obj?.State;if(!s||typeof s!=='object'||Array.isArray(s))return {kind:'NONE',data:null};const keys=Object.keys(s);if(keys.length!==1)return {kind:keys.length?'MULTI_OR_UNKNOWN':'NONE',data:null};return {kind:keys[0],data:s[keys[0]]};}
function playerHouses(world){return Array.isArray(world?.PlayerHouses)?world.PlayerHouses:null;}
function resolvePlayerHouseBinding(gridObject,world){
 const itemId=integer(gridObject?.ItemID),s=stateData(gridObject);if(itemId===null||s.kind!=='HouseData'||!s.data||typeof s.data!=='object')return ok('NOT_APPLICABLE',{kind:'NOT_HOUSE_DATA'});
 const houses=playerHouses(world);if(!houses)return ok('UNKNOWN_UNSUPPORTED',{kind:'HOUSE_DATA',blockers:[{code:'PLAYER_HOUSES_MISSING'}]});
 const idx=integer(s.data.PlayerHouseIndex),listedIndexes=[];for(let i=0;i<houses.length;i++)if(integer(houses[i]?.HouseItemID)===itemId)listedIndexes.push(i);
 const indexMatch=idx!==null&&idx>=0&&idx<houses.length&&integer(houses[idx]?.HouseItemID)===itemId;
 if(indexMatch)return ok('BOUND_PLAYER_HOUSE',{kind:'PLAYER_HOUSE',houseItemId:itemId,sourcePlayerHouseIndex:idx,listedIndexes});
 if(listedIndexes.length)return ok('AMBIGUOUS_FAIL_CLOSED',{kind:'PLAYER_HOUSE_OR_SPECIAL_HOUSE',houseItemId:itemId,sourcePlayerHouseIndex:idx,listedIndexes,blockers:[{code:'PLAYER_HOUSE_INDEX_ITEM_MISMATCH'}]});
 return ok('NOT_PLAYER_HOUSE',{kind:'BUILDING_HOUSE_DATA',houseItemId:itemId,sourcePlayerHouseIndex:idx,listedIndexes:[]});
}
function captureEnvironmentState(target,{targetKind='AREA'}={}){
 const itemId=integer(target?.EnvironmentEffectItemID),ori=orientationIndex(target?.EnvironmentEffectOrientation),kind=String(targetKind);
 if(itemId===null||ori===null||!ENVIRONMENT_TARGET_KINDS.includes(kind))return ok('UNSUPPORTED_SOURCE',{blockers:[{code:'ENVIRONMENT_STATE_INVALID'}]});
 return ok('CAPTURED',{kind:'ENVIRONMENT',portableState:{codec:CODECS.environment,targetKind:kind,effectItemId:itemId,orientation:ori},excludedSourceFields:['GridIDs','CharacterStates','Unlocked','CustomLocationPositionsPath','SceneItemId']});
}
function captureObjectRestorationState(gridObject,world){
 const itemId=integer(gridObject?.ItemID),s=stateData(gridObject);if(itemId===null)return ok('UNSUPPORTED_SOURCE',{blockers:[{code:'GRID_OBJECT_ITEM_INVALID'}]});
 if(s.kind==='BuildingWithSkinData'||s.kind==='StallData'){
  const skinId=integer(s.data?.CurrentSkinItemID);if(skinId===null)return ok('UNSUPPORTED_SOURCE',{kind:'BUILDING_SKIN',blockers:[{code:'BUILDING_SKIN_STATE_INVALID'}]});
  return ok('CAPTURED',{kind:'BUILDING_SKIN',portableState:{codec:CODECS.buildingSkin,targetBuildingItemId:itemId,skinItemId:skinId},excludedSourceFields:s.kind==='StallData'?['UpgradeState','ShopData']:['UpgradeState']});
 }
 if(s.kind==='HouseData'){
  const binding=resolvePlayerHouseBinding(gridObject,world);
  if(binding.status==='BOUND_PLAYER_HOUSE')return ok('CAPTURED',{kind:'PLAYER_HOUSE',portableState:{codec:CODECS.playerHouseBinding,houseItemId:itemId},excludedSourceFields:['Built','UpgradeState','PlayerHouseIndex'],sourceDiagnostics:{sourcePlayerHouseIndex:binding.sourcePlayerHouseIndex}});
  if(binding.status==='NOT_PLAYER_HOUSE')return ok('SUPPORTED_NO_EXTRA_STATE',{kind:'BUILDING_HOUSE_DATA',portableState:null,excludedSourceFields:['Built','UpgradeState','PlayerHouseIndex']});
  return ok('UNSUPPORTED_SOURCE',{kind:binding.kind,portableState:null,excludedSourceFields:['Built','UpgradeState','PlayerHouseIndex'],blockers:binding.blockers||[{code:'PLAYER_HOUSE_BINDING_UNRESOLVED'}]});
 }
 return ok('NOT_APPLICABLE',{kind:s.kind,portableState:null});
}
function normalizeResolverResult(r,unknownCode){
 if(!r||typeof r!=='object')return ok('UNKNOWN_UNSUPPORTED',{blockers:[{code:unknownCode}]});
 if(r.status==='VALID'||r.status==='VALID_NOOP')return ok(r.status,{issues:r.issues||[],resolution:r.resolution||null});
 if(r.status==='INVALID'||r.status==='BLOCKED_SHORTAGE'||r.status==='BLOCKED')return ok(r.status,{issues:r.issues||[],blockers:r.blockers||[]});
 return ok('UNKNOWN_UNSUPPORTED',{issues:r.issues||[],blockers:r.blockers?.length?r.blockers:[{code:unknownCode}]});
}
function preflightEnvironmentState(portableState,{validateEnvironmentEffect}={}){
 if(portableState?.codec!==CODECS.environment)return ok('INVALID',{blockers:[{code:'ENVIRONMENT_CODEC_UNSUPPORTED'}]});
 const itemId=integer(portableState.effectItemId),ori=orientationIndex(portableState.orientation),kind=String(portableState.targetKind||'');if(itemId===null||ori===null||!ENVIRONMENT_TARGET_KINDS.includes(kind))return ok('INVALID',{blockers:[{code:'ENVIRONMENT_STATE_INVALID'}]});
 if(itemId===0)return ok('VALID',{issues:[],reason:'NATIVE_NONE_EFFECT'});
 if(typeof validateEnvironmentEffect!=='function')return ok('UNKNOWN_UNSUPPORTED',{blockers:[{code:'ENVIRONMENT_EFFECT_OWNERSHIP_VALIDATOR_NOT_BOUND'}]});
 return normalizeResolverResult(validateEnvironmentEffect({effectItemId:itemId,requestedAmount:1,orientation:ori,targetKind:kind}),'ENVIRONMENT_EFFECT_VALIDATION_UNKNOWN');
}
function preflightBuildingSkinState(portableState,{destinationCurrentSkinItemId=null,validateBuildingSkin}={}){
 if(portableState?.codec!==CODECS.buildingSkin)return ok('INVALID',{blockers:[{code:'BUILDING_SKIN_CODEC_UNSUPPORTED'}]});
 const skinId=integer(portableState.skinItemId),targetItemId=integer(portableState.targetBuildingItemId);if(skinId===null||targetItemId===null)return ok('INVALID',{blockers:[{code:'BUILDING_SKIN_STATE_INVALID'}]});
 const current=integer(destinationCurrentSkinItemId);
 if(current!==null&&current===skinId)return ok('VALID_NOOP',{issues:[]});
 if(skinId===0)return ok('UNKNOWN_UNSUPPORTED',{blockers:[{code:'BUILDING_DEFAULT_SKIN_RESET_NOT_PROVEN'}]});
 if(typeof validateBuildingSkin!=='function')return ok('UNKNOWN_UNSUPPORTED',{blockers:[{code:'BUILDING_SKIN_VALIDATOR_NOT_BOUND'}]});
 return normalizeResolverResult(validateBuildingSkin({skinItemId:skinId,targetBuildingItemId:targetItemId}),'BUILDING_SKIN_VALIDATION_UNKNOWN');
}
function preflightPlayerHouseBinding(portableState,{bindPlayerHouse}={}){
 if(portableState?.codec!==CODECS.playerHouseBinding)return ok('INVALID',{blockers:[{code:'PLAYER_HOUSE_CODEC_UNSUPPORTED'}]});
 const houseItemId=integer(portableState.houseItemId);if(houseItemId===null)return ok('INVALID',{blockers:[{code:'PLAYER_HOUSE_ITEM_INVALID'}]});
 if(typeof bindPlayerHouse!=='function')return ok('UNKNOWN_UNSUPPORTED',{blockers:[{code:'PLAYER_HOUSE_DESTINATION_BINDER_NOT_BOUND'}]});
 const r=bindPlayerHouse({houseItemId});if(r?.status==='VALID'){if(r.binding&&Number.isSafeInteger(Number(r.binding.playerHouseIndex))&&integer(r.binding.houseItemId)===houseItemId)return ok('VALID',{binding:{...r.binding,playerHouseIndex:Number(r.binding.playerHouseIndex),houseItemId},issues:r.issues||[]});return ok('UNKNOWN_UNSUPPORTED',{issues:r?.issues||[],blockers:[{code:'PLAYER_HOUSE_DESTINATION_BINDING_UNKNOWN'}]});}
 return normalizeResolverResult(r,'PLAYER_HOUSE_DESTINATION_BINDING_UNKNOWN');
}
function preflightPortableState(portableState,ctx={}){
 switch(portableState?.codec){case CODECS.environment:return preflightEnvironmentState(portableState,ctx);case CODECS.buildingSkin:return preflightBuildingSkinState(portableState,ctx);case CODECS.playerHouseBinding:return preflightPlayerHouseBinding(portableState,ctx);default:return ok('INVALID',{blockers:[{code:'PORTABLE_RESTORATION_CODEC_UNSUPPORTED'}]});}
}
return Object.freeze({CURRENT_GAME_VERSION,CURRENT_PROFILE_SCHEMA,ORIENTATION_NAMES,CODECS,ENVIRONMENT_TARGET_KINDS,orientationIndex,resolvePlayerHouseBinding,captureEnvironmentState,captureObjectRestorationState,preflightEnvironmentState,preflightBuildingSkinState,preflightPlayerHouseBinding,preflightPortableState});
});
