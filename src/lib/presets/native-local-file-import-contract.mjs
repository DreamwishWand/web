/**
 * Offline PC-file import gate for already exported DDV-native preset backups.
 * This does not import anything INTO a DDV save. It never writes storage,
 * sends data over the network or grants a published Wand Preset capability.
 * An unknown native Touch-of-Magic design format is a separate contract.
 */
import {
  NATIVE_PRESET_BACKUP_SCHEMA,
  NATIVE_PRESET_LIBRARY_KEY,
  createEmptyNativePresetLibrary,
  normalizeNativePresetLibrary,
  serializeNativePresetLibrary,
  NATIVE_PRESET_LIBRARY_SCHEMA,
  NATIVE_PRESET_LOCAL_BACKUP_LIMIT,
  NATIVE_PRESET_PROFILE_SCHEMA,
  nativePresetPayloadIsDeleted,
  nativePresetPayloadWarnings,
  validateNativePresetBackup
} from './native-preset-runtime.js';
import {nativeLocalPresetQuarantineWarnings} from './native-local-preset-quarantine.mjs';

export const NATIVE_LOCAL_PRESET_FILE_CONTRACT='wand.native-preset.local-file-import@1';
export const NATIVE_LOCAL_PRESET_FILE_MAX_BYTES=32*1024*1024;
export const NATIVE_LOCAL_TOM_FILE_SUPPORTED=false;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeNonnegative=x=>Number.isSafeInteger(x)&&x>=0;
const digestHex=x=>Array.from(new Uint8Array(x),v=>v.toString(16).padStart(2,'0')).join('');
const rejected=(code)=>Object.freeze({
  schema:NATIVE_LOCAL_PRESET_FILE_CONTRACT,status:'BLOCKED',code,
  backups:null,localFileReady:false,gameSaveApplyAuthorized:false,
  publicSharingAuthorized:false,sourceBuildAttested:false
});
function inspectBackup(backup){
  if(!object(backup)||backup.schema!==NATIVE_PRESET_BACKUP_SCHEMA||
     backup.version!==1||backup.persistentWriteAuthorized!==false||
     backup.productApplyAuthorized===true||backup.publicSharingAuthorized===true||
     typeof backup.id!=='string'||!/^native_[A-Za-z0-9_-]{1,96}$/.test(backup.id)||
     !object(backup.source)||backup.source.profileSchemaVersion!==NATIVE_PRESET_PROFILE_SCHEMA||
     !safeNonnegative(backup.source.physicalPresetIndex)||
     !(backup.source.activeSlotOrdinalZeroBased===null||
       safeNonnegative(backup.source.activeSlotOrdinalZeroBased))||
     !object(backup.payload)||!object(backup.payload.GridCollection)||
     !object(backup.payload.GridCollection.Grids)||
     !Array.isArray(backup.payload.ThumbnailItems)||
     typeof backup.payload.PresetName!=='string'||
     !safeNonnegative(backup.payload.StateFlags)||
     !Object.hasOwn(backup.payload,'ShareInfo'))
    throw Error('LOCAL_PRESET_BACKUP_SOURCE_OR_STRUCTURE_INVALID');
  const deleted=nativePresetPayloadIsDeleted(backup.payload);
  if(Boolean(backup.deleted)!==deleted||
     (deleted!== (backup.source.activeSlotOrdinalZeroBased===null)))
    throw Error('LOCAL_PRESET_BACKUP_TOMBSTONE_CONFLICT');
  const warnings=[...new Set([...nativePresetPayloadWarnings(backup.payload),
    ...nativeLocalPresetQuarantineWarnings(backup.payload)])];
  const copy=validateNativePresetBackup(backup);
  const quarantined=warnings.length>0 || backup.payload.ShareInfo!==null ||
      deleted;
  return Object.freeze({
    // No source Build/BID/rights is proved by the old schema624 backup format.
    backup:copy,
    physicalIndex:backup.source.physicalPresetIndex,
    structuralWarnings:Object.freeze([...warnings]),
    quarantine:quarantined,
    reason:quarantined?'PRESERVE_ONLY_NOT_RESTORE_VALIDATED':'SOURCE_BUILD_AND_RESTORE_NOT_AUTHORIZED',
    sourceSchema:624,sourceBuildAttested:false,sourceFullVersion:null,
    nativeGameSaveApplyAuthorized:false,publicSharingAuthorized:false
  });
}
function reviver(k,v) {
  // A portable backup JSON must not contain meta-object keys that might become
  // executable prototype mutation after downstream Library normalization.
  if(k==='__proto__'||k==='constructor'||k==='prototype')
    throw Error('LOCAL_PRESET_BACKUP_FORBIDDEN_KEY');
  return v;
}

/**
 * Validate imported JSON file bytes before a UI *may* add it to a local
 * library or prompt Save As. The payload is kept offline and is not trusted
 * as a native/restorable item solely because its JSON is structurally valid.
 */
export async function inspectNativePresetLocalFileBytes(bytes,{cryptoRef=globalThis.crypto}={}){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<2||
      bytes.byteLength>NATIVE_LOCAL_PRESET_FILE_MAX_BYTES)
    return rejected('LOCAL_PRESET_FILE_BYTES_OUT_OF_BOUNDS');
  if(!cryptoRef?.subtle?.digest)
    return rejected('LOCAL_PRESET_FILE_SHA256_UNAVAILABLE');
  const snapshot=Uint8Array.from(bytes);
  let parsed;
  try{
    const text=new TextDecoder('utf-8',{fatal:true}).decode(snapshot).replace(/^\uFEFF/,'');
    parsed=JSON.parse(text,reviver);
  }catch{return rejected('LOCAL_PRESET_FILE_UTF8_OR_JSON_INVALID');}
  let list;
  if(parsed?.schema===NATIVE_PRESET_BACKUP_SCHEMA)list=[parsed];
  else if(parsed?.schema===NATIVE_PRESET_LIBRARY_SCHEMA &&
          parsed.version===1 && Array.isArray(parsed.backups) &&
          parsed.backups.length<=NATIVE_PRESET_LOCAL_BACKUP_LIMIT)
    list=parsed.backups;
  else return rejected('LOCAL_PRESET_FILE_SCHEMA_UNSUPPORTED');
  if(!list.length) return rejected('LOCAL_PRESET_FILE_EMPTY');
  let checked;
  try{
    checked=list.map(inspectBackup);
    if(new Set(checked.map(x=>x.backup.id)).size!==checked.length)
      return rejected('LOCAL_PRESET_FILE_DUPLICATE_ID');
  }catch{return rejected('LOCAL_PRESET_FILE_BACKUP_VALIDATION_FAILED');}
  // The digest identifies the imported FILE, not a genuine game source or
  // a public image license. A byte copy prevents mutation during async hash.
  let fileSha;
  try{fileSha=digestHex(await cryptoRef.subtle.digest('SHA-256',snapshot));}
  catch{return rejected('LOCAL_PRESET_FILE_SHA256_UNAVAILABLE');}
  return Object.freeze({
    schema:NATIVE_LOCAL_PRESET_FILE_CONTRACT,
    status:checked.some(x=>x.quarantine)?
      'LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS':'LOCAL_FILE_VALIDATED_PRESERVE_ONLY',
    informationalFileSha256:fileSha,sourceBytes:snapshot.byteLength,
    backups:Object.freeze(checked),localFileReady:true,
    sourceProfileSchema:624,sourceGameVersion:null,sourceBID:null,
    sourceBuildAttested:false,
    // SaveFile -> native install is a DIFFERENT operation and always OFF.
    gameSaveApplyAuthorized:false,saveWriterAuthorized:false,
    publicSharingAuthorized:false,communityPresetCreated:false,
    originalSourceModified:false,localFileWrittenByThisFunction:false
  });
}

/** ToM designs are NOT native DecorationPreset backups or Community Presets. */
export function inspectNativeToMLocalFileContract(){
  return rejected('NATIVE_TOM_FORMAT_AND_OWNER_PROVENANCE_NOT_YET_VERIFIED');
}

// Local migration continuity. All current UI mutations use this same origin
// lock; a fresh storage read and an exact raw-value guard precede the write.
// Old/uncooperative tabs are not lock participants: close them before migration.
export const NATIVE_PRESET_LIBRARY_LOCK=NATIVE_PRESET_LIBRARY_KEY+':exclusive';
const fail=code=>{throw Error('NATIVE_PRESET_LIBRARY_'+code);};
const utf8=text=>new TextEncoder().encode(text);
async function readCurrentLibrary(storage){
 const raw=storage.getItem(NATIVE_PRESET_LIBRARY_KEY);
 if(raw===null)return {raw,library:createEmptyNativePresetLibrary()};
 if(typeof raw!=='string'||!raw.length||utf8(raw).length>NATIVE_LOCAL_PRESET_FILE_MAX_BYTES)fail('STORAGE_BOUNDS');
 let parsed;
 try{parsed=JSON.parse(raw,reviver);}catch{fail('STORAGE_INVALID');}
 if(parsed?.schema!==NATIVE_PRESET_LIBRARY_SCHEMA||parsed.version!==1||!Array.isArray(parsed.backups))fail('STORAGE_INVALID');
 const library=normalizeNativePresetLibrary(parsed);
 if(library.backups.length){
  const reviewed=await inspectNativePresetLocalFileBytes(utf8(raw));
  if(!reviewed.localFileReady||!reviewed.backups)fail('STORAGE_INVALID');
 }
 return {raw,library};
}
export function mergeNativePresetBackups(library,incoming,{now=new Date().toISOString()}={}){
 const current=normalizeNativePresetLibrary(library);
 const byId=new Map(current.backups.map(b=>[b.id,b]));
 let added=0;
 for(const entry of incoming){
  if(byId.has(entry.id)){
   // Conservative exact JSON equality: no same-ID replacement, including
   // changes to opaque fields, quarantine metadata, tombstones or payload.
   if(JSON.stringify(byId.get(entry.id))!==JSON.stringify(entry))fail('ID_COLLISION');
   continue;
  }
  byId.set(entry.id,entry);added++;
 }
 if(byId.size>NATIVE_PRESET_LOCAL_BACKUP_LIMIT)fail('LIMIT');
 return {added,library:added?normalizeNativePresetLibrary({...current,updatedAt:now,backups:[...byId.values()]}):current};
}
/** @param {{storage?:Storage,locks?:LockManager,operation:'read'|'merge'|'remove',backups?:any[],id?:string}} options */
export async function transactNativePresetLibrary({storage=globalThis.localStorage,locks=globalThis.navigator?.locks,operation,backups=[],id}){
 if(!storage||typeof locks?.request!=='function')fail('LOCK_UNAVAILABLE');
 return locks.request(NATIVE_PRESET_LIBRARY_LOCK,{mode:'exclusive'},async()=>{
  const {raw,library}=await readCurrentLibrary(storage);
  if(operation==='read')return {library,raw,changed:false};
  let next,changed;
  if(operation==='merge'){
   if(!Array.isArray(backups)||!backups.length)fail('EMPTY_IMPORT');
   const reviewed=await inspectNativePresetLocalFileBytes(utf8(JSON.stringify({
    schema:NATIVE_PRESET_LIBRARY_SCHEMA,version:1,backups
   })));
   if(!reviewed.localFileReady||!reviewed.backups)fail('IMPORT_INVALID');
   const merged=mergeNativePresetBackups(library,reviewed.backups.map(x=>x.backup));
   next=merged.library;changed=merged.added>0;
  }else if(operation==='remove'){
   if(!library.backups.some(b=>b.id===id))fail('ENTRY_MISSING');
   next=normalizeNativePresetLibrary({...library,updatedAt:new Date().toISOString(),backups:library.backups.filter(b=>b.id!==id)});
   changed=true;
  }else fail('OPERATION_INVALID');
  if(storage.getItem(NATIVE_PRESET_LIBRARY_KEY)!==raw)fail('STALE_STORAGE');
  if(!changed)return {library,raw,changed:false};
  const serialized=serializeNativePresetLibrary(next);
  if(utf8(serialized).length>NATIVE_LOCAL_PRESET_FILE_MAX_BYTES)fail('STORAGE_BOUNDS');
  storage.setItem(NATIVE_PRESET_LIBRARY_KEY,serialized);
  if(storage.getItem(NATIVE_PRESET_LIBRARY_KEY)!==serialized)fail('REOPEN_MISMATCH');
  return {library:next,raw:serialized,changed:true};
 });
}
