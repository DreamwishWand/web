// New opt-in, isolated local-first operation. NEVER writes to legacy v1 localStorage.
// A non-cooperating historical tab can mutate its own v1 keys at any time;
// it cannot overwrite this transactional IndexedDB namespace. No automatic
// migration or claim that the TWO stores form a single global authoritative store.
import {
  createEmptyMoodboardDocument, createMoodboard, addMoodboardReference,
  removeMoodboardReference, deleteMoodboard, parseMoodboardDocument,
  serializeMoodboardDocument
} from './store.js';

export const ATOMIC_FIRST_BOARD_OPERATION='WEB_LOCAL_FIRST_MOODBOARD_ATOMIC_CREATE';
export const ATOMIC_FIRST_BOARD_GATE='ISOLATED_LOCAL_ONLY__NOT_LEGACY_MIGRATED';
export const ATOMIC_MOODBOARD_DB='dreamwishwand:moodboards:atomic-first:v1';
export const ATOMIC_MOODBOARD_STORE='snapshots';
export const ATOMIC_MOODBOARD_SLOT='first';
const RECORD_SCHEMA='wand.moodboards.atomic-first@1';
const OWN=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function fail(code){throw new Error('ATOMIC_FIRST_BOARD_'+code);}
function exact(o,keys){return o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&keys.every(k=>OWN(o,k));}
function validateRow(row){
 if(row===undefined)return null;
 if(!exact(row,['schema','revision','boardId','primary','backup','deleted'])||
    row.schema!==RECORD_SCHEMA||!Number.isSafeInteger(row.revision)||row.revision<1||
    typeof row.boardId!=='string'||!/^board_atomic_[a-zA-Z0-9_-]{10,80}$/.test(row.boardId)||
    typeof row.primary!=='string'||typeof row.backup!=='string'||
    typeof row.deleted!=='boolean')fail('CORRUPT_SNAPSHOT');
 let current,previous;
 try{current=parseMoodboardDocument(row.primary);previous=parseMoodboardDocument(row.backup);}
 catch{fail('CORRUPT_SNAPSHOT');}
 if(current.boards.length!==(row.deleted?0:1)||
   (!row.deleted&&current.boards[0].id!==row.boardId)||
   previous.boards.length>1||
   (previous.boards.length===1&&previous.boards[0].id!==row.boardId))
   fail('CORRUPT_SNAPSHOT');
 return {schema:row.schema,revision:row.revision,boardId:row.boardId,
  primary:row.primary,backup:row.backup,deleted:row.deleted,
  document:current,backupDocument:previous};
}
export function openAtomicFirstBoardDatabase(factory=globalThis.indexedDB){
 if(!factory||typeof factory.open!=='function')return Promise.reject(new Error('ATOMIC_FIRST_BOARD_INDEXEDDB_UNAVAILABLE'));
 return new Promise((resolve,reject)=>{
  let request;
  try{request=factory.open(ATOMIC_MOODBOARD_DB,1);}catch(e){reject(e);return;}
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(ATOMIC_MOODBOARD_STORE))
    db.createObjectStore(ATOMIC_MOODBOARD_STORE);
  };
  request.onerror=()=>reject(request.error||new Error('ATOMIC_FIRST_BOARD_OPEN_FAILED'));
  request.onblocked=()=>reject(new Error('ATOMIC_FIRST_BOARD_DB_BLOCKED'));
  request.onsuccess=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(ATOMIC_MOODBOARD_STORE)){
    db.close();reject(new Error('ATOMIC_FIRST_BOARD_MISSING_STORE'));return;
   }
   db.onversionchange=()=>db.close();
   resolve(db);
  };
 });
}
function runTransaction(db,mode,operate){
 if(!db||typeof db.transaction!=='function')return Promise.reject(new TypeError('IndexedDB transaction required'));
 return new Promise((resolve,reject)=>{
  let tx,request,value,error;
  try{
   tx=db.transaction(ATOMIC_MOODBOARD_STORE,mode);
   const store=tx.objectStore(ATOMIC_MOODBOARD_STORE);
   request=store.get(ATOMIC_MOODBOARD_SLOT);
   request.onsuccess=()=>{
    try{
     const output=operate(validateRow(request.result));
     value=output.value;
     if(OWN(output,'row'))store.put(output.row,ATOMIC_MOODBOARD_SLOT);
    }catch(e){error=e;try{tx.abort();}catch{}}
   };
  }catch(e){reject(e);return;}
  tx.oncomplete=()=>resolve(value);
  tx.onabort=()=>reject(error||tx.error||new Error('ATOMIC_FIRST_BOARD_ABORTED'));
  tx.onerror=()=>{if(!error)error=tx.error||new Error('ATOMIC_FIRST_BOARD_TRANSACTION_FAILED');};
 });
}
export function readAtomicFirstBoard(db){
 return runTransaction(db,'readonly',row=>({value:row}));
}
export function createAtomicFirstBoard(db,title,{idFactory=()=>globalThis.crypto?.randomUUID?.()}={}){
 if(typeof title!=='string'||!title.trim()||title.trim().length>120) return Promise.reject(new TypeError('Valid board title required'));
 const random=idFactory();
 if(typeof random!=='string'||!/^[a-zA-Z0-9_-]{10,80}$/.test(random))
  return Promise.reject(new TypeError('Strong random BoardID required'));
 return runTransaction(db,'readwrite',current=>{
  // IDB serializes readwrite transaction scopes ACROSS TABS. Only ONE first
  // create may commit; all later attempts reject, including after tombstone.
  if(current)fail('ALREADY_CREATED');
  const empty=createEmptyMoodboardDocument();
  const result=createMoodboard(empty,{title:title.trim()},{idFactory:()=> 'atomic_'+random});
  const next={schema:RECORD_SCHEMA,revision:1,boardId:result.board.id,
   primary:serializeMoodboardDocument(result.document),
   backup:serializeMoodboardDocument(empty),deleted:false};
  return {row:next,value:{boardId:next.boardId,revision:1}};
 });
}
/**
 * @param {IDBDatabase} db
 * @param {{boardId:string,expectedRevision:number,itemId:number,verifiedRecords:Array<{itemId:number,label:string}>,familyLabel?:string}} request
 */
export function toggleAtomicFirstBoardItem(db,{boardId,expectedRevision,itemId,verifiedRecords,familyLabel=''}){
 if(!Number.isSafeInteger(itemId)||itemId<=0||!Array.isArray(verifiedRecords))
  return Promise.reject(new TypeError('Verified numeric ItemID and rows required'));
 const record=verifiedRecords.find(row=>row?.itemId===itemId&&
   typeof row.label==='string'&&row.label.trim());
 if(!record)return Promise.reject(new TypeError('ItemID missing in verified source scope'));
 if(typeof boardId!=='string'||!Number.isSafeInteger(expectedRevision))
  return Promise.reject(new TypeError('BoardID and Revision required'));
 return runTransaction(db,'readwrite',row=>{
  if(!row||row.deleted||row.boardId!==boardId)fail('BOARD_NOT_FOUND');
  if(row.revision!==expectedRevision)fail('STALE_REVISION');
  const board=row.document.boards[0],key=String(itemId);
  const existing=board.references.find(ref=>ref.type==='ITEM'&&ref.entityId===key);
  const next=existing
    ?removeMoodboardReference(row.document,boardId,existing.id)
    :addMoodboardReference(row.document,boardId,{
       type:'ITEM',entityId:key,label:record.label,
       note:typeof familyLabel==='string'?familyLabel:''
     }).document;
  const output={schema:RECORD_SCHEMA,revision:row.revision+1,boardId,
   primary:serializeMoodboardDocument(next),backup:row.primary,deleted:false};
  return {row:output,value:{boardId,revision:output.revision,
    action:existing?'removed':'added',entityId:key}};
 });
}
export function deleteAtomicFirstBoard(db,{boardId,expectedRevision}={}){
 return runTransaction(db,'readwrite',row=>{
  if(!row||row.deleted||row.boardId!==boardId)fail('BOARD_NOT_FOUND');
  if(!Number.isSafeInteger(expectedRevision)||row.revision!==expectedRevision)fail('STALE_REVISION');
  const empty=deleteMoodboard(row.document,boardId);
  const next={schema:RECORD_SCHEMA,revision:row.revision+1,boardId,
   primary:serializeMoodboardDocument(empty),backup:row.primary,deleted:true};
  return {row:next,value:{boardId,revision:next.revision,deleted:true}};
 });
}
export async function verifiedAtomicFirstBoardReopen(db){
 // Separate read transaction, no optimistic client state or fake success.
 const row=await readAtomicFirstBoard(db);
 if(!row)return null;
 return {boardId:row.boardId,revision:row.revision,deleted:row.deleted,
  document:row.document,backupDocument:row.backupDocument,
  primary:row.primary,backup:row.backup};
}

/* Explicit same-store portable file for an isolated Board; never a legacy DB dump.
   A portable file is untrusted planning data, not catalog/Writer authority. */
export const ATOMIC_BOARD_PORTABLE_SCHEMA='wand.moodboards.atomic-first.portable@1';
export const ATOMIC_BOARD_PORTABLE_MAX_BYTES=16*1024*1024;
function portableRow(row){
 const r=validateRow(row);
 if(!r||r.revision>=Number.MAX_SAFE_INTEGER||
    (r.revision===1&&(r.deleted||r.backupDocument.boards.length!==0))||
    (r.revision>1&&r.backupDocument.boards.length!==1)||
    serializeMoodboardDocument(r.document)!==r.primary||
    serializeMoodboardDocument(r.backupDocument)!==r.backup)fail('PORTABLE_INVALID');
 for(const b of [...r.document.boards,...r.backupDocument.boards]){
  if(b.groups.length!==0||b.references.some(x=>x.type!=='ITEM'||x.url!==null||
     !/^[1-9][0-9]{0,15}$/.test(x.entityId??'')||!Number.isSafeInteger(Number(x.entityId))||
     String(Number(x.entityId))!==x.entityId||x.groupIds.length!==0))fail('PORTABLE_INVALID');
 }
 return {schema:r.schema,revision:r.revision,boardId:r.boardId,primary:r.primary,backup:r.backup,deleted:r.deleted};
}
function encodePortable(row){
 const raw=JSON.stringify({schema:ATOMIC_BOARD_PORTABLE_SCHEMA,version:1,snapshot:portableRow(row)},null,2)+'\n';
 if(new TextEncoder().encode(raw).byteLength>ATOMIC_BOARD_PORTABLE_MAX_BYTES)fail('PORTABLE_INVALID');
 return raw;
}
export function decodeAtomicBoardPortable(raw,verifiedRecords){
 if(typeof raw!=='string'||!raw.length||raw.length>ATOMIC_BOARD_PORTABLE_MAX_BYTES||
    new TextEncoder().encode(raw).byteLength>ATOMIC_BOARD_PORTABLE_MAX_BYTES||
    !Array.isArray(verifiedRecords))fail('PORTABLE_INVALID');
 let value;
 try{value=JSON.parse(raw);}catch{fail('PORTABLE_INVALID');}
 if(!exact(value,['schema','version','snapshot'])||value.schema!==ATOMIC_BOARD_PORTABLE_SCHEMA||
    value.version!==1||encodePortable(value.snapshot)!==raw)fail('PORTABLE_INVALID');
 const row=portableRow(value.snapshot);
 const parsed=validateRow(row),catalog=new Set(verifiedRecords.filter(x=>Number.isSafeInteger(x?.itemId)&&
  x.itemId>0&&typeof x.label==='string'&&x.label.trim()).map(x=>String(x.itemId)));
 for(const b of [...parsed.document.boards,...parsed.backupDocument.boards])
  for(const r of b.references)if(!catalog.has(r.entityId))fail('PORTABLE_ITEM_UNVERIFIED');
 return row;
}
export async function exportAtomicBoardPortable(db){
 const row=await readAtomicFirstBoard(db);
 if(!row)fail('PORTABLE_EMPTY');
 const {document,backupDocument,...raw}=row;
 return encodePortable(raw);
}
export async function importAtomicBoardPortable(db,raw,verifiedRecords){
 const row=decodeAtomicBoardPortable(raw,verifiedRecords);
 // Existing transaction serializes concurrent create/import across tabs.
 const receipt=await runTransaction(db,'readwrite',current=>{
  if(current)fail('PORTABLE_DESTINATION_OCCUPIED');
  return {row,value:{boardId:row.boardId,revision:row.revision,deleted:row.deleted}};
 });
 const reopened=await readAtomicFirstBoard(db);
 if(!reopened)fail('PORTABLE_REOPEN');
 const {document,backupDocument,...actual}=reopened;
 if(encodePortable(actual)!==raw)fail('PORTABLE_REOPEN');
 return receipt;
}
