// Read-only navigation over the existing canonical Collection record projection.
// This does not infer save ownership, entitlement, quantity, or discovered state.
export const COLLECTION_SUPPORTED_VERSION = '1.25.0';
const SUPPORTED_VIEWS = Object.freeze(['category','world','universe']);
const VALID_ID = /^(0|[1-9][0-9]{0,15})$/;

export function collectionReferenceSelection(records, rawItemId, version = COLLECTION_SUPPORTED_VERSION) {
  if (version !== COLLECTION_SUPPORTED_VERSION) return { status:'unsupported-version', item:null };
  if (rawItemId === null || rawItemId === '') return { status:'browse', item:null };
  if (typeof rawItemId !== 'string' || !VALID_ID.test(rawItemId) ||
      !Number.isSafeInteger(Number(rawItemId))) return { status:'unknown-item', item:null };
  const item = records.find(row => row.itemId === Number(rawItemId)) ?? null;
  return { status:item ? 'found' : 'unknown-item', item };
}
export function collectionWorkspaceState(url) {
  const params = url.searchParams;
  const view = params.get('view') || 'category';
  return {
    view:SUPPORTED_VIEWS.includes(view) ? view : 'category',
    query:(params.get('q') || '').slice(0,256),
    family:(params.get('family') || '').slice(0,100),
    world:(params.get('world') || '').slice(0,100),
    universe:(params.get('universe') || '').slice(0,100),
    version:params.get('version') || COLLECTION_SUPPORTED_VERSION,
    itemId:params.get('item') || ''
  };
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
