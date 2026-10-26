// Read-only navigation over the existing canonical Collection record projection.
// This does not infer save ownership, entitlement, quantity, or discovered state.
export const COLLECTION_SUPPORTED_VERSION = '1.25.0';
const SUPPORTED_VIEWS = Object.freeze(['category','world','universe']);
const VALID_ID = /^(0|[1-9][0-9]{0,15})$/;
const ALLOWED_PARAMS = new Set(['view','q','family','world','universe','version','item']);
export function isCanonicalCollectionItemID(value) {
  return typeof value === 'string' && VALID_ID.test(value) && Number.isSafeInteger(Number(value));
}

export function collectionReferenceSelection(records, rawItemId, version = COLLECTION_SUPPORTED_VERSION) {
  if (version !== COLLECTION_SUPPORTED_VERSION) return { status:'unsupported-version', item:null };
  if (rawItemId === null || rawItemId === '') return { status:'browse', item:null };
  if (!isCanonicalCollectionItemID(rawItemId)) return { status:'unknown-item', item:null };
  const matches = records.filter(row => row.itemId === Number(rawItemId));
  return matches.length === 1 ? { status:'found', item:matches[0] } : { status:'unknown-item', item:null };
}
export function collectionWorkspaceState(url) {
  const params = url.searchParams;
  let invalid = false;
  const seen = new Set();
  for (const key of params.keys()) {
    if (!ALLOWED_PARAMS.has(key) || seen.has(key)) invalid = true;
    seen.add(key);
  }
  const view = params.get('view') ?? 'category';
  const query = params.get('q') ?? '';
  const family = params.get('family') ?? '';
  const world = params.get('world') ?? '';
  const universe = params.get('universe') ?? '';
  const version = params.get('version') ?? COLLECTION_SUPPORTED_VERSION;
  const itemId = params.get('item') ?? '';
  if (!SUPPORTED_VIEWS.includes(view) || query.length > 256 ||
      family.length > 100 || world.length > 100 || universe.length > 100 ||
      (params.has('version') && !version) ||
      (params.has('item') && !isCanonicalCollectionItemID(itemId)) ||
      (params.has('family') && (view !== 'category' || !family)) ||
      (params.has('world') && (view !== 'world' || !world)) ||
      (params.has('universe') && (view !== 'universe' || !universe)) ||
      (params.has('q') && !query)) invalid = true;
  return invalid
    ? {invalid:true,view:'category',query:'',family:'',world:'',universe:'',version:COLLECTION_SUPPORTED_VERSION,itemId:''}
    : {invalid:false,view,query,family,world,universe,version,itemId};
}
export function collectionWorkspaceHref(basePath = '', state = {}, itemId = null) {
  const params = new URLSearchParams();
  const view = SUPPORTED_VIEWS.includes(state.view) ? state.view : 'category';
  if (view !== 'category') params.set('view',view);
  if (typeof state.query === 'string' && state.query) params.set('q',state.query.slice(0,256));
  if (view === 'category' && typeof state.family === 'string' && state.family) params.set('family',state.family);
  if (view === 'world' && typeof state.world === 'string' && state.world) params.set('world',state.world);
  if (view === 'universe' && typeof state.universe === 'string' && state.universe) params.set('universe',state.universe);
  if (state.version && state.version !== COLLECTION_SUPPORTED_VERSION) params.set('version',state.version);
  if (itemId !== null) {
    if (!Number.isSafeInteger(itemId) || itemId < 0) throw new TypeError('Invalid Collection ItemID.');
    params.set('item',String(itemId));
  }
  const q = params.toString();
  return String(basePath).replace(/\/$/,'') + '/collection/' + (q ? '?' + q : '');
}
