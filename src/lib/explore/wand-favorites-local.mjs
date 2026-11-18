// DEC-UX-31/34: private Wand-only decoration Item favorites.
// NEVER the save-backed DDV Game Favorite/ownership marker, a Reader flag,
// a cloud/account preference, or an authorization to edit original Save bytes.
export const WAND_FAVORITES_STORAGE_KEY='dreamwishwand:explore:wand-favorites:v1';
export const WAND_FAVORITES_BACKUP_KEY='dreamwishwand:explore:wand-favorites:v1:previous';
export const WAND_FAVORITES_SCHEMA='wand.explore.local-favorites@1';
export const WAND_FAVORITES_MAX_ITEMS=5000;
const MAX_BYTES=100000;

function validItemId(value){
  return typeof value==='number' && Number.isSafeInteger(value) && value>0 && value<=4294967295;
}
export function emptyWandFavorites(){
  return {schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[]};
}
export function parseWandFavorites(raw){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX_BYTES)throw Error('WAND_FAVORITES_INVALID_OR_OVERSIZE');
  let parsed;
  try{parsed=JSON.parse(raw);}catch{throw Error('WAND_FAVORITES_INVALID_JSON');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||parsed.schema!==WAND_FAVORITES_SCHEMA||parsed.version!==1||!Array.isArray(parsed.itemIds)||parsed.itemIds.length>WAND_FAVORITES_MAX_ITEMS)throw Error('WAND_FAVORITES_SCHEMA_MISMATCH');
  const unique=new Set();
  for(const itemId of parsed.itemIds){
    if(!validItemId(itemId)||unique.has(itemId))throw Error('WAND_FAVORITES_INVALID_ITEM_IDS');
    unique.add(itemId);
  }
  return {schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[...unique].sort((a,b)=>a-b)};
}
export function isWandFavorite(document,itemId){
  return validItemId(itemId)&&Array.isArray(document?.itemIds)&&document.itemIds.includes(itemId);
}
export function changeWandFavorite(document,itemId,enabled){
  if(!validItemId(itemId)||typeof enabled!=='boolean')throw Error('WAND_FAVORITES_TARGET_INVALID');
  const current=parseWandFavorites(JSON.stringify(document));
  const values=new Set(current.itemIds);
  if(enabled){
    if(values.size>=WAND_FAVORITES_MAX_ITEMS&&!values.has(itemId))throw Error('WAND_FAVORITES_CAPACITY_EXCEEDED');
    values.add(itemId);
  }else values.delete(itemId);
  return {schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[...values].sort((a,b)=>a-b)};
}
// Always read the current document; never overwrite a newer tab's state from
// an old UI snapshot. Both localStorage keys are part of one logical update.
// Web Storage has atomic setItem per key, but no cross-key transaction: when
// either write fails, compensate BOTH keys and verify the exact old raw bytes.
// A failed rollback is explicitly unsafe, never a successful Favorite update.
export function persistWandFavorite(storage,itemId,enabled){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw Error('WAND_FAVORITES_STORAGE_UNAVAILABLE');
  const previous=storage.getItem(WAND_FAVORITES_STORAGE_KEY);
  const previousBackup=storage.getItem(WAND_FAVORITES_BACKUP_KEY);
  const current=previous===null?emptyWandFavorites():parseWandFavorites(previous);
  const next=changeWandFavorite(current,itemId,enabled);
  if(JSON.stringify(current.itemIds)===JSON.stringify(next.itemIds))return current;
  const serialized=JSON.stringify(next);
  const restore=(key,raw)=>{
    if(storage.getItem(key)===raw)return;
    if(raw===null){
      if(typeof storage.removeItem!=='function')throw Error('WAND_FAVORITES_REMOVE_UNAVAILABLE');
      storage.removeItem(key);
    }else storage.setItem(key,raw);
  };
  try{
    if(previous!==null)storage.setItem(WAND_FAVORITES_BACKUP_KEY,previous);
    storage.setItem(WAND_FAVORITES_STORAGE_KEY,serialized);
    if(storage.getItem(WAND_FAVORITES_STORAGE_KEY)!==serialized||
       (previous!==null&&storage.getItem(WAND_FAVORITES_BACKUP_KEY)!==previous))
      throw Error('WAND_FAVORITES_COMMIT_UNVERIFIED');
  }catch(error){
    // Restore the last recoverable snapshot FIRST. A partially committed
    // primary whose own rollback is denied must not prevent an independent
    // attempt to recover the older Previous key. No Web Storage cross-key
    // transaction is available, so verify both exact raw values afterward.
    let restored=true;
    for(const [key,raw] of [
      [WAND_FAVORITES_BACKUP_KEY,previousBackup],
      [WAND_FAVORITES_STORAGE_KEY,previous]
    ]){
      try{restore(key,raw);}catch{restored=false}
    }
    try{
      if(storage.getItem(WAND_FAVORITES_STORAGE_KEY)!==previous||
         storage.getItem(WAND_FAVORITES_BACKUP_KEY)!==previousBackup)
        restored=false;
    }catch{restored=false}
    if(!restored)throw Error('WAND_FAVORITES_ROLLBACK_UNVERIFIED',{cause:error});
    throw error;
  }
  return next;
}
