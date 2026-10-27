// Read-only navigation over the existing canonical Collection record projection.
// This does not infer save ownership, entitlement, quantity, or discovered state.
export const COLLECTION_SUPPORTED_VERSION = '1.25.0';
const VALID_ID = /^(0|[1-9][0-9]{0,15})$/;
// Owner Stage1: one Category-first workspace; Universe and Expansion are
// contextual facets, NOT permanent independent ViewModes.
const ALLOWED_PARAMS = new Set(['q','family','universe','expansion','version','item']);
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
  const query = params.get('q') ?? '';
  const family = params.get('family') ?? '';
  const universe = params.get('universe') ?? '';
  const expansion = params.get('expansion') ?? '';
  const version = params.get('version') ?? COLLECTION_SUPPORTED_VERSION;
  const itemId = params.get('item') ?? '';
  if (query.length > 256 || family.length > 100 || universe.length > 100 ||
      expansion.length > 100 ||
      (params.has('q') && !query) ||
      (params.has('family') && !family) ||
      (params.has('universe') && !universe) ||
      (params.has('expansion') && !expansion) ||
      (params.has('version') && !version) ||
      (params.has('item') && !isCanonicalCollectionItemID(itemId))) invalid = true;
  return invalid
    ? {invalid:true,view:'category',query:'',family:'',world:'',universe:'',expansion:'',version:COLLECTION_SUPPORTED_VERSION,itemId:''}
    : {invalid:false,view:'category',query,family,world:'',universe,expansion,version,itemId};
}
export function collectionWorkspaceHref(basePath = '', state = {}, itemId = null) {
  if (state.view && state.view !== 'category') {
    throw new TypeError('Unsupported permanent Collection ViewMode.');
  }
  const params = new URLSearchParams();
  for (const [key,max] of [['query',256],['family',100],['universe',100],['expansion',100]]) {
    const value = state[key];
    if (value !== undefined && value !== '' && (typeof value !== 'string' || value.length > max)) {
      throw new TypeError('Invalid Collection facet: '+key);
    }
  }
  if (state.query) params.set('q',state.query);
  if (state.family) params.set('family',state.family);
  if (state.universe) params.set('universe',state.universe);
  if (state.expansion) params.set('expansion',state.expansion);
  if (state.version && state.version !== COLLECTION_SUPPORTED_VERSION) params.set('version',state.version);
  if (itemId !== null) {
    if (!Number.isSafeInteger(itemId) || itemId < 0) throw new TypeError('Invalid Collection ItemID.');
    params.set('item',String(itemId));
  }
  const q = params.toString();
  return String(basePath).replace(/[/]$/,'') + '/collection/' + (q ? '?' + q : '');
}
