// Public Work navigation only. Constructing a URL never confers read/media rights.
// Signed server authorization remains mandatory in the destination consumer.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL = '00000000-0000-0000-0000-000000000000';
const TYPES = Object.freeze({
  gallery: Object.freeze({path:'/gallery/',param:'work',availability:'existing-public-consumer'}),
  question: Object.freeze({path:'/qa/',param:'question',availability:'existing-public-consumer'}),
  tip: Object.freeze({path:'/qa/',param:'tip',availability:'existing-public-consumer'}),
  dreamsnap: Object.freeze({path:'/dreamsnaps/community/',param:'work',availability:'pending-public-detail-authority'})
});

export function canonicalWorkId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) return null;
  const id = value.toLowerCase();
  return id === NIL ? null : id;
}

function sourceCannotBePublic(source) {
  if (!source || typeof source !== 'object') return false;
  if (source.accessible === false || source.retired === true || source.isRetired === true ||
      source.deleted === true || source.privacySuppressed === true) return true;
  const visibility = source.visibility ?? source.work_visibility;
  if (visibility != null && String(visibility).toLowerCase() !== 'public') return true;
  const lifecycle = source.lifecycleState ?? source.lifecycle_state;
  if (lifecycle != null && String(lifecycle).toLowerCase() !== 'published') return true;
  const moderation = source.moderationState ?? source.moderation_state;
  if (moderation != null && !['clear','approved'].includes(String(moderation).toLowerCase())) return true;
  const account = source.accountState ?? source.account_state;
  if (account != null && !['active'].includes(String(account).toLowerCase())) return true;
  return false;
}
export function resolveTypedWorkRoute(basePath, workType, workId, source = null) {
  const id = canonicalWorkId(workId);
  if (!id || typeof workType !== 'string' || !Object.hasOwn(TYPES,workType) ||
      sourceCannotBePublic(source)) return {status:'unavailable',href:null,workType:null};
  const entry = TYPES[workType];
  const root = String(basePath ?? '').replace(/[/]$/,'');
  return {
    status:workType === 'dreamsnap' ? 'gated' : 'ready',
    href:root+entry.path+'?'+entry.param+'='+encodeURIComponent(id),
    workType,
    // The "ready" status identifies a preexisting route ONLY, not Work visibility.
    availability:entry.availability
  };
}

// Strict entry parser shared by typed Work destinations. Invalid/ambiguous
// Deep Links MUST NOT trigger public RPCs, media signing, or redirect fallback.
export function parseTypedWorkQuery(search, expectedParam='work') {
  if (!['work','question','tip'].includes(expectedParam)) return {status:'invalid',workId:null};
  let params;
  try {params = search instanceof URLSearchParams ? search : new URLSearchParams(search);}
  catch {return {status:'invalid',workId:null};}
  if ([...params.keys()].length !== 1 || params.getAll(expectedParam).length !== 1)
    return {status:'invalid',workId:null};
  const id = canonicalWorkId(params.get(expectedParam));
  return id ? {status:'valid',workId:id} : {status:'invalid',workId:null};
}
