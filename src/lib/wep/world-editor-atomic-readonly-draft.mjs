// 02 WEP READ-ONLY receiver for the opt-in IndexedDB atomic-first Board.
// NOT the legacy localStorage world-editor handoff and NOT Native placement.
// Reuse the accepted atomic IDB session, canonical row validation and read path;
// this module never opens a readwrite transaction or modifies a Draft/Save.
import {
 openAtomicFirstBoardDatabase,verifiedAtomicFirstBoardReopen
} from '../moodboards/atomic-first-board.mjs';

export const WEP_ATOMIC_IDB_DRAFT_OPERATION='WEP_ATOMIC_IDB_BOARD_TO_WORLD_EDITOR_READONLY_DRAFT_HANDOFF';
export const WEP_ATOMIC_IDB_DRAFT_GATE='READONLY_PENDING_SELECTION__NO_NATIVE_PLACEMENT';
const keys=['atomicBoard','atomicRevision','atomicReference','atomicItem'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function deny(reason){throw new Error('WEP_ATOMIC_DRAFT_'+reason);}
const validBoard=x=>typeof x==='string'&&/^board_atomic_[A-Za-z0-9_-]{10,80}$/.test(x);
const validRef=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(x);
const positive=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0;
const decimal=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x)&&
 positive(Number(x))&&String(Number(x))===x;

/** Parse just one explicit optional URL intent. A forged URL is never authorization. */
export function parseAtomicWorldEditorDraftFragment(fragment){
 if(typeof fragment!=='string'||(fragment!==''&&!fragment.startsWith('#')))deny('FRAGMENT_TYPE');
 const params=new URLSearchParams(fragment.slice(1));
 if(!keys.some(k=>params.has(k)))return null;
 if(Array.from(params.keys()).length!==keys.length||
    !keys.every(k=>params.getAll(k).length===1))deny('QUERY_SHAPE');
 const boardId=params.get('atomicBoard'),revisionText=params.get('atomicRevision'),
  referenceId=params.get('atomicReference'),itemText=params.get('atomicItem');
 if(!validBoard(boardId)||!validRef(referenceId)||!decimal(revisionText)||
   !decimal(itemText))deny('QUERY_IDENTITY');
 return Object.freeze({
  sourceSurface:'atomic-idb',intent:'READONLY_DRAFT_PREVIEW',
  boardId,revision:Number(revisionText),referenceId,itemId:Number(itemText),
  persistentWriteAuthorized:false,productApplyAuthorized:false,
  nativePlacementAuthorized:false,directSourceReplacementAuthorized:false
 });
}

/** Re-reads CURRENT IDB BoardID/Revision and independently verifies Item catalog.
 * @param {IDBDatabase} db
 * @param {ReturnType<typeof parseAtomicWorldEditorDraftQuery>} requested
 * @param {Map<number,{itemId:number,label:string}>} verifiedItemById
 */
export async function verifyCurrentAtomicWorldEditorDraft(db,requested,verifiedItemById){
 if(!requested||typeof requested!=='object'||
    Object.keys(requested).length!==10||
    !['sourceSurface','intent','boardId','revision','referenceId','itemId',
      'persistentWriteAuthorized','productApplyAuthorized',
      'nativePlacementAuthorized','directSourceReplacementAuthorized'].every(k=>own(requested,k))||
    requested.sourceSurface!=='atomic-idb'||
    requested.intent!=='READONLY_DRAFT_PREVIEW'||
    requested.persistentWriteAuthorized!==false||
    requested.productApplyAuthorized!==false||
    requested.nativePlacementAuthorized!==false||
    requested.directSourceReplacementAuthorized!==false||
    !validBoard(requested.boardId)||!validRef(requested.referenceId)||
    !positive(requested.revision)||!positive(requested.itemId))deny('INTENT_INVALID');
 if(!(verifiedItemById instanceof Map))deny('VERIFIED_CATALOG_REQUIRED');
 const trusted=verifiedItemById.get(requested.itemId);
 if(!trusted||trusted.itemId!==requested.itemId||
    typeof trusted.label!=='string'||!trusted.label.trim())deny('ITEM_NOT_VERIFIED');
 const snapshot=await verifiedAtomicFirstBoardReopen(db); // existing validated readonly IDB tx
 if(!snapshot||snapshot.deleted||snapshot.boardId!==requested.boardId)deny('BOARD_NOT_FOUND');
 if(snapshot.revision!==requested.revision)deny('STALE_REVISION');
 if(snapshot.document.boards.length!==1||
    snapshot.document.boards[0].id!==snapshot.boardId)deny('BOARD_DOCUMENT');
 const refs=snapshot.document.boards[0].references.filter(ref=>
   ref.id===requested.referenceId);
 if(refs.length!==1||refs[0].type!=='ITEM'||
    refs[0].entityId!==String(requested.itemId))deny('REFERENCE_NOT_VERIFIED');
 // This is NOT a Native item. Platform/Build/BID/Footprint/ObjectID/Ownership and
 // coordinates are unknown; never attach it to pendingItemId or insertDraftGraph.
 return Object.freeze({
  sourceSurface:'atomic-idb',intent:'READONLY_DRAFT_PREVIEW',
  boardId:snapshot.boardId,revision:snapshot.revision,
  referenceId:refs[0].id,itemId:trusted.itemId,
  label:trusted.label,boardTitle:snapshot.document.boards[0].title,
  persistentWriteAuthorized:false,productApplyAuthorized:false,
  nativePlacementAuthorized:false,directSourceReplacementAuthorized:false
 });
}

/** A transient readonly IndexedDB connection, closed even on stale/corruption. */
export async function readCurrentAtomicWorldEditorDraft(requested,verifiedItemById){
 const db=await openAtomicFirstBoardDatabase();
 try{return await verifyCurrentAtomicWorldEditorDraft(db,requested,verifiedItemById);}
 finally{db.close();}
}
