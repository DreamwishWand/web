import {ATOMIC_MOODBOARD_DB,ATOMIC_MOODBOARD_STORE,readAtomicFirstBoard} from '../moodboards/atomic-first-board.mjs';
export const WEP_ATOMIC_IDB_HANDOFF='WEP_ATOMIC_IDB_BOARD_TO_WORLD_EDITOR_READONLY_DRAFT_HANDOFF';
const fail=code=>{throw Error('WEP_ATOMIC_'+code);};
// Never create an empty IndexedDB when opening from the Editor; abort absent-DB upgrade.
export async function readExistingAtomicBoard(factory=globalThis.indexedDB){
 if(!factory?.open)fail('IDB_UNAVAILABLE');
 const db=await new Promise((resolve,reject)=>{
  let req;
  try{req=factory.open(ATOMIC_MOODBOARD_DB,1);}catch(e){reject(e);return;}
  req.onupgradeneeded=()=>{try{req.transaction.abort();}catch{}};
  req.onerror=()=>reject(Error('WEP_ATOMIC_DB_NOT_EXISTING'));
  req.onblocked=()=>reject(Error('WEP_ATOMIC_DB_BLOCKED'));
  req.onsuccess=()=>{
   const handle=req.result;
   if(!handle.objectStoreNames.contains(ATOMIC_MOODBOARD_STORE)){
    handle.close();reject(Error('WEP_ATOMIC_STORE_MISSING'));return;
   }
   handle.onversionchange=()=>handle.close();resolve(handle);
  };
 });
 try{return await readAtomicFirstBoard(db);}finally{db.close();}
}
export function verifyAtomicBoardReference(snapshot,{boardId,revision,referenceId,itemId},catalog){
 if(!snapshot||snapshot.deleted!==false||snapshot.schema!=='wand.moodboards.atomic-first@1'||
  typeof boardId!=='string'||!/^board_atomic_[a-zA-Z0-9_-]{10,80}$/.test(boardId)||
  snapshot.boardId!==boardId||!Number.isSafeInteger(revision)||revision<1||
  snapshot.revision!==revision)fail('BOARD_STALE_REVISION');
 const doc=snapshot.document,board=doc?.boards?.[0];
 if(doc?.schema!=='wand.moodboards.local@1'||doc.version!==2||
  doc.boards.length!==1||board?.id!==boardId||
  typeof referenceId!=='string'||!referenceId)fail('DOCUMENT');
 if(!Number.isSafeInteger(itemId)||itemId<=0||!(catalog instanceof Map))fail('ITEM_SCOPE');
 const record=catalog.get(itemId);
 if(!record||record.itemId!==itemId||typeof record.label!=='string'||!record.label.trim())
  fail('ITEM_UNVERIFIED');
 const reference=board.references.find(x=>x.id===referenceId);
 if(!reference||reference.type!=='ITEM'||reference.entityId!==String(itemId)||
  !Array.isArray(reference.groupIds)||reference.groupIds.length!==0)
  fail('REFERENCE_CHANGED');
 return {reference,record,persistentWriteAuthorized:false};
}
export function verifyAtomicHandoffIdentity(live,pin){
 if(!live||!pin||live.sourceSurface!=='atomic-moodboard'||pin.sourceSurface!=='atomic-moodboard'||
  live.intent!=='ATOMIC_MOODBOARD'||pin.intent!=='ATOMIC_MOODBOARD'||
  live.boardId!==pin.boardId||live.revision!==pin.revision||
  live.referenceId!==pin.referenceId||live.createdAt!==pin.createdAt||
  live.persistentWriteAuthorized!==false||live.productApplyAuthorized!==false||
  live.directSourceReplacementAuthorized!==false)fail('HANDOFF_CHANGED');
 return true;
}
