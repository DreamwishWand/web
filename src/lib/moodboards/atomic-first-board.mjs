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
export function toggleAtomicFirstBoardItem(db,{boardId,expectedRevision,itemId,verifiedRecords,familyLabel=''}={}){
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
