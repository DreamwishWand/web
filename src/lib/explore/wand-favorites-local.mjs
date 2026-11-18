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
// Read current storage each time to avoid overwriting another tab's newer state.
// Backup always precedes commit, so an unsuccessful current write never
// silently changes the accepted primary document in memory.
export function persistWandFavorite(storage,itemId,enabled){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw Error('WAND_FAVORITES_STORAGE_UNAVAILABLE');
  const previous=storage.getItem(WAND_FAVORITES_STORAGE_KEY);
  const current=previous===null?emptyWandFavorites():parseWandFavorites(previous);
  const next=changeWandFavorite(current,itemId,enabled);
  if(JSON.stringify(current.itemIds)===JSON.stringify(next.itemIds))return current;
  const serialized=JSON.stringify(next);
  if(previous!==null)storage.setItem(WAND_FAVORITES_BACKUP_KEY,previous);
  storage.setItem(WAND_FAVORITES_STORAGE_KEY,serialized);
  return next;
}
