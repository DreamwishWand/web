import { p1gPackagedProfileCodec } from '../ddv/core/save/p1g-packaged-profile-codec.js';
import { parseSafeJson } from '../ddv/core/save/safe-edit-session.js';

export const NATIVE_PRESET_READ_CONTRACT='ddv.native-preset-read@1';
export const NATIVE_PRESET_BACKUP_SCHEMA='wand.in-game-preset-backup@1';
export const NATIVE_PRESET_LIBRARY_SCHEMA='wand.in-game-preset-library@1';
export const NATIVE_PRESET_LIBRARY_KEY='dreamwishwand:in-game-preset-library:v1';
export const NATIVE_PRESET_PROFILE_SCHEMA=624;
export const NATIVE_PRESET_ACTIVE_LIMIT=20;
export const NATIVE_PRESET_LOCAL_BACKUP_LIMIT=100;

function asRecord(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)?value:null;}
function safeInt(value){const n=Number(value);return Number.isSafeInteger(n)?n:null;}
function cleanName(value){const text=String(value??'').trim();return text.slice(0,160)||'Untitled In-Game Preset';}

function decodePlainJson(bytes){
  try{
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
    return text.trimStart().startsWith('{')?text:null;
  }catch{return null;}
}

export async function openNativePresetProfile(sourceBytes){
  if(!(sourceBytes instanceof Uint8Array)||sourceBytes.length===0)throw new Error('NATIVE_PRESET_SOURCE_EMPTY');
  const plain=decodePlainJson(sourceBytes);
  let inputFormat='plain-json', jsonText=plain;
  if(jsonText===null){
    inputFormat='packaged';
    const decoded=await p1gPackagedProfileCodec.loadProfile(sourceBytes.slice());
    jsonText=decoded.jsonText;
  }
  const profile=parseSafeJson(jsonText);
  const gameInfo=asRecord(profile.GameInfo), world=asRecord(profile.World);
  if(!gameInfo||!world)throw new Error('NATIVE_PRESET_PROFILE_REQUIRED_SECTIONS_MISSING');
  if(safeInt(gameInfo.Version)!==NATIVE_PRESET_PROFILE_SCHEMA)throw new Error('NATIVE_PRESET_PROFILE_SCHEMA_UNSUPPORTED');
  if(!Array.isArray(world.DecorationPresets))throw new Error('NATIVE_PRESET_LIST_MISSING');
  return {
    contract:NATIVE_PRESET_READ_CONTRACT,
    inputFormat,
    profileSchemaVersion:NATIVE_PRESET_PROFILE_SCHEMA,
    exactBuildKnown:false,
    persistentWriteAuthorized:false,
    profile,
    snapshots:extractNativePresetSnapshots(profile)
  };
}

function presetWarnings(payload){
  const warnings=[];
  const grids=asRecord(asRecord(payload?.GridCollection)?.Grids);
  if(!grids){warnings.push('GRID_COLLECTION_MISSING');return warnings;}
  const gridIds=[];
  for(const [key,value] of Object.entries(grids)){
    const grid=asRecord(value);
    const keyId=safeInt(key), id=safeInt(grid?.ID);
    if(keyId===null||id===null||keyId<0||id<0)warnings.push('GRID_ID_INVALID');
    else{
      gridIds.push(id);
      if(keyId!==id)warnings.push('GRID_KEY_ID_MISMATCH');
    }
    const objects=asRecord(grid?.Objects)??{};
    const objectIds=[];
    for(const [objectKey,rawObject] of Object.entries(objects)){
      const object=asRecord(rawObject);
      const keyObjectId=safeInt(objectKey), objectId=safeInt(object?.ID);
      if(keyObjectId===null||objectId===null||keyObjectId<0||objectId<0)warnings.push('GRID_OBJECT_ID_INVALID');
      else{
        objectIds.push(objectId);
        if(keyObjectId!==objectId)warnings.push('GRID_OBJECT_KEY_ID_MISMATCH');
      }
    }
    const nextObjectId=safeInt(grid?.NextGridObjectID);
    if(objectIds.length&& (nextObjectId===null||nextObjectId<=Math.max(...objectIds)))warnings.push('NEXT_GRID_OBJECT_ID_NOT_ABOVE_OBSERVED');
  }
  if(!Object.prototype.hasOwnProperty.call(grids,'0'))warnings.push('ROOT_GRID_0_MISSING');
  const nextGridId=safeInt(payload?.GridCollection?.NextGridID);
  if(gridIds.length&&(nextGridId===null||nextGridId<=Math.max(...gridIds)))warnings.push('NEXT_GRID_ID_NOT_ABOVE_OBSERVED');
  return [...new Set(warnings)];
}

function presetSummary(payload){
  const grids=asRecord(asRecord(payload?.GridCollection)?.Grids)??{};
  let objectCount=0, subGridReferenceCount=0;
  for(const grid of Object.values(grids)){
    const objects=asRecord(asRecord(grid)?.Objects)??{};
    objectCount+=Object.keys(objects).length;
    for(const object of Object.values(objects)){
      const state=asRecord(asRecord(object)?.State);
      if(asRecord(state?.SubGrid))subGridReferenceCount+=1;
    }
  }
  return {
    presetName:cleanName(payload?.PresetName),
    gridCount:Object.keys(grids).length,
    objectCount,
    subGridReferenceCount,
    thumbnailItems:Array.isArray(payload?.ThumbnailItems)?payload.ThumbnailItems.filter((x)=>Number.isSafeInteger(Number(x))).map(Number):[],
    shareInfoPresent:payload?.ShareInfo!==null&&payload?.ShareInfo!==undefined,
    stateFlags:safeInt(payload?.StateFlags)??0
  };
}

export function extractNativePresetSnapshots(profile){
  const presets=asRecord(profile?.World)?.DecorationPresets;
  if(!Array.isArray(presets))throw new Error('NATIVE_PRESET_LIST_MISSING');
  let activeOrdinal=0;
  return presets.map((rawPreset,physicalPresetIndex)=>{
    const payload=structuredClone(rawPreset);
    const deleted=Boolean(payload?.Deleted);
    const activeSlotOrdinalZeroBased=deleted?null:activeOrdinal++;
    return {
      contract:NATIVE_PRESET_READ_CONTRACT,
      physicalPresetIndex,
      activeSlotOrdinalZeroBased,
      deleted,
      summary:presetSummary(payload),
      warnings:presetWarnings(payload),
      payload
    };
  });
}

export function createNativePresetBackup(snapshot,{sourceName=null,now=new Date().toISOString(),idFactory}={}){
  if(!snapshot||snapshot.contract!==NATIVE_PRESET_READ_CONTRACT)throw new TypeError('NATIVE_PRESET_SNAPSHOT_INVALID');
  const stamp=new Date(now);
  if(Number.isNaN(stamp.getTime()))throw new TypeError('NATIVE_PRESET_BACKUP_TIME_INVALID');
  const token=typeof idFactory==='function'?String(idFactory()):globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2);
  return {
    schema:NATIVE_PRESET_BACKUP_SCHEMA,
    version:1,
    id:'native_'+token.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,96),
    createdAt:stamp.toISOString(),
    source:{
      sourceName:sourceName?String(sourceName).slice(0,240):null,
      profileSchemaVersion:NATIVE_PRESET_PROFILE_SCHEMA,
      physicalPresetIndex:snapshot.physicalPresetIndex,
      activeSlotOrdinalZeroBased:snapshot.activeSlotOrdinalZeroBased
    },
    deleted:Boolean(snapshot.deleted),
    summary:structuredClone(snapshot.summary),
    warnings:[...snapshot.warnings],
    payload:structuredClone(snapshot.payload),
    persistentWriteAuthorized:false
  };
}

export function validateNativePresetBackup(input){
  if(!input||input.schema!==NATIVE_PRESET_BACKUP_SCHEMA||input.version!==1)throw new TypeError('NATIVE_PRESET_BACKUP_SCHEMA_UNSUPPORTED');
  if(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload))throw new TypeError('NATIVE_PRESET_BACKUP_PAYLOAD_INVALID');
  if(safeInt(input?.source?.physicalPresetIndex)===null)throw new TypeError('NATIVE_PRESET_BACKUP_INDEX_INVALID');
  return structuredClone(input);
}

export function createEmptyNativePresetLibrary(){
  return {schema:NATIVE_PRESET_LIBRARY_SCHEMA,version:1,updatedAt:new Date(0).toISOString(),backups:[]};
}

export function normalizeNativePresetLibrary(input){
  if(!input||input.schema!==NATIVE_PRESET_LIBRARY_SCHEMA||input.version!==1)throw new TypeError('NATIVE_PRESET_LIBRARY_SCHEMA_UNSUPPORTED');
  const backups=Array.isArray(input.backups)?input.backups.map(validateNativePresetBackup):[];
  if(backups.length>NATIVE_PRESET_LOCAL_BACKUP_LIMIT)throw new RangeError('NATIVE_PRESET_LIBRARY_LIMIT_EXCEEDED');
  const ids=new Set();
  for(const backup of backups){if(ids.has(backup.id))throw new TypeError('NATIVE_PRESET_LIBRARY_DUPLICATE_ID');ids.add(backup.id);}
  return {...structuredClone(input),backups};
}

export function addNativePresetBackup(library,backup,{now=new Date().toISOString()}={}){
  const current=normalizeNativePresetLibrary(library);
  if(current.backups.length>=NATIVE_PRESET_LOCAL_BACKUP_LIMIT)throw new RangeError('NATIVE_PRESET_LIBRARY_LIMIT_REACHED');
  const valid=validateNativePresetBackup(backup);
  return {...current,updatedAt:new Date(now).toISOString(),backups:[valid,...current.backups]};
}

export function removeNativePresetBackup(library,id,{now=new Date().toISOString()}={}){
  const current=normalizeNativePresetLibrary(library);
  const backups=current.backups.filter((entry)=>entry.id!==id);
  if(backups.length===current.backups.length)throw new RangeError('NATIVE_PRESET_BACKUP_NOT_FOUND');
  return {...current,updatedAt:new Date(now).toISOString(),backups};
}

export function serializeNativePresetLibrary(library){return JSON.stringify(normalizeNativePresetLibrary(library),null,2)+'\n';}
export function parseNativePresetLibrary(text){
  let parsed;try{parsed=JSON.parse(String(text));}catch{throw new TypeError('NATIVE_PRESET_LIBRARY_JSON_INVALID');}
  return normalizeNativePresetLibrary(parsed);
}

export function nativePresetRestoreReadiness(snapshotOrBackup){
  const deleted=Boolean(snapshotOrBackup?.deleted);
  const warnings=Array.isArray(snapshotOrBackup?.warnings)?snapshotOrBackup.warnings:[];
  return {
    canPreserveBackup:true,
    restoreShapeClean:!warnings.length,
    activeSlotEligible:!deleted,
    nativeActiveLimit:NATIVE_PRESET_ACTIVE_LIMIT,
    persistentWriteAuthorized:false,
    reason:'NATIVE_PRESET_PERSISTENT_INSTALL_NOT_AUTHORIZED'
  };
}
