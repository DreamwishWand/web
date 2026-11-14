// Migration-only local file boundary. Retain the existing v2 document/store.
// No network, raw DB, save file, session, merge or new persistence authority.
import {MOODBOARD_STORAGE_KEY,MOODBOARD_BACKUP_KEY,parseMoodboardDocument,serializeMoodboardDocument} from './store.js';
export const MOODBOARD_PORTABLE_MAX_BYTES=16*1024*1024;
const fail=code=>{throw Error('MOODBOARD_PORTABLE_'+code);};
// Validate the ORIGINAL file bytes before the string-level canonical check.
// File.text() is lossy: replacement decoding and BOM stripping are forbidden.
export function decodePortableMoodboardBytes(bytes){
 if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>MOODBOARD_PORTABLE_MAX_BYTES)fail('INVALID');
 if(bytes.byteLength>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)fail('INVALID');
 let raw;
 try{raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('INVALID');}
 const encoded=new TextEncoder().encode(raw);
 if(encoded.byteLength!==bytes.byteLength||encoded.some((byte,index)=>byte!==bytes[index]))fail('INVALID');
 return raw;
}
function exactDocument(raw){
 if(typeof raw!=='string'||!raw.length||raw.length>MOODBOARD_PORTABLE_MAX_BYTES||
    new TextEncoder().encode(raw).byteLength>MOODBOARD_PORTABLE_MAX_BYTES)fail('INVALID');
 let doc;
 try{doc=parseMoodboardDocument(raw);}catch{fail('INVALID');}
 // Current exporter is canonical. Refuse lossy normalization, unknown fields,
 // duplicate keys, unknown version, truncated arrays, missing IDs or references.
 if(serializeMoodboardDocument(doc)!==raw)fail('INVALID');
 return doc;
}
export function readMoodboardMigrationSnapshot(storage){
 return {primary:storage.getItem(MOODBOARD_STORAGE_KEY),backup:storage.getItem(MOODBOARD_BACKUP_KEY)};
}
export function exportPortableMoodboard(storage,previous=false){
 const raw=storage.getItem(previous?MOODBOARD_BACKUP_KEY:MOODBOARD_STORAGE_KEY);
 exactDocument(raw);
 return raw;
}
export function importPortableMoodboard(storage,expected,raw){
 const document=exactDocument(raw);
 const current=readMoodboardMigrationSnapshot(storage);
 if(!expected||current.primary!==expected.primary||current.backup!==expected.backup)fail('STALE');
 // Exact idempotence never rewrites either slot.
 if(current.primary===raw)return {document,status:'UNCHANGED'};
 // Never replace nonempty, corrupt or historical data; even an empty primary
 // with a nonempty previous snapshot is not an empty destination.
 for(const value of [current.primary,current.backup]){
  if(value!==null&&exactDocument(value).boards.length!==0)fail('COLLISION');
 }
 // One atomic Storage.setItem, no write to backup; quota errors leave old
 // slots unchanged per Storage API. Not a cross-tab CAS: close other tabs.
 storage.setItem(MOODBOARD_STORAGE_KEY,raw);
 const reopened=readMoodboardMigrationSnapshot(storage);
 if(reopened.primary!==raw||reopened.backup!==current.backup)fail('REOPEN');
 return {document,status:'IMPORTED'};
}
