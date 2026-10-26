import { validateCollectionRuntimeIndex } from './runtime.js';

export const ITEM_REFERENCE_LINK_SCHEMA = 'wand.shared-item-reference@1';
export const ITEM_REFERENCE_TARGET = Object.freeze({
  platform: 'Nintendo Switch', gameVersion: '1.25.0', buildID: '52BD625D9B4E0053'
});
export const ITEM_REFERENCE_MANIFEST = 'COLLECTION_SEED_MANIFEST_DDV_v1.25.0_2026-10-02_V2';
export const DECORATE_ITEM_FAMILIES = Object.freeze([
  'Buildings','Furniture','Landscaping','Roads & Fences','Touch of Magic','Wallpaper & Flooring'
]);
const POSITIVE_ID = /^[1-9][0-9]{0,15}$/;
const RETIRED = new Set(['RETIRED','UNAVAILABLE','WITHDRAWN']);
const surfaces = new Set(['collection','decorate']);
const fail = (reason) => Object.freeze({schema:ITEM_REFERENCE_LINK_SCHEMA,status:'unavailable',reason,href:null});

function numericId(value) {
  const raw=typeof value==='number' && Number.isSafeInteger(value) ? String(value) : value;
  if(typeof raw!=='string' || !POSITIVE_ID.test(raw)) return null;
  const id=Number(raw);
  return Number.isSafeInteger(id) && id>0 && String(id)===raw ? id : null;
}
function sameFacets(a,b) {
  return a.family===b.family && ['worlds','universes','expansions'].every(k=>
    Array.isArray(a[k]) && Array.isArray(b[k]) &&
    a[k].length===b[k].length && a[k].every((v,i)=>v===b[k][i]));
}
function sourceGood(index,target) {
  try {validateCollectionRuntimeIndex(index);} catch{return false;}
  return index?.a===ITEM_REFERENCE_MANIFEST && Object.keys(ITEM_REFERENCE_TARGET).every(k=>
    index.t?.[k]===ITEM_REFERENCE_TARGET[k] && target?.[k]===ITEM_REFERENCE_TARGET[k]);
}
function unique(records,id) {
  if(!Array.isArray(records)) return {reason:'UNVERIFIED_RECORDS'};
  const rows=records.filter(x=>x?.itemId===id);
  return rows.length===1 ? {item:rows[0]} : {reason: rows.length>1 ? 'AMBIGUOUS_ITEM_ID' : 'UNKNOWN_ITEM_ID'};
}
function safePath(base,suffix) {
  if(typeof base!=='string' || (base && (!base.startsWith('/') || base.includes('..') || /[?#]/.test(base)))) return null;
  return base.replace(/\/$/,'')+suffix;
}
/** Reference-only. Uses existing 08 WEB/01D-derived decoded Collection item records. */
/** @param {any} options */
export function resolveSharedItemLink(options={}) {
  const {index,records,itemId,identityKind,from,to,basePath='',requestedTarget=ITEM_REFERENCE_TARGET,
    sourceRecord=null,targetRecord=null,lifecycle=null}=options;
  if(identityKind!=='DDV_ITEM_ID') return fail('UNSUPPORTED_IDENTITY_KIND');
  if(!surfaces.has(from)||!surfaces.has(to)||from===to) return fail('UNSUPPORTED_SURFACE');
  if(!sourceGood(index,requestedTarget)) return fail('UNSUPPORTED_SOURCE_BUILD');
  const id=numericId(itemId);
  if(id===null) return fail('INVALID_ITEM_ID');
  const x=unique(records,id);
  if(!x.item) return fail(x.reason);
  if(sourceRecord && (sourceRecord.itemId!==id || !sameFacets(sourceRecord,x.item))) return fail('SOURCE_IDENTITY_CONFLICT');
  if(targetRecord && (targetRecord.itemId!==id || !sameFacets(targetRecord,x.item))) return fail('TARGET_IDENTITY_CONFLICT');
  if(lifecycle!==null && RETIRED.has(lifecycle)) return fail('ITEM_UNAVAILABLE');
  if(lifecycle!==null && lifecycle!=='REFERENCE_ONLY') return fail('ITEM_LIFECYCLE_UNKNOWN');
  if(to==='decorate' && !DECORATE_ITEM_FAMILIES.includes(x.item.family)) return fail('NOT_DECORATE_FAMILY');
  const path=safePath(basePath,to==='decorate'?'/explore/':'/collection/');
  if(!path) return fail('INVALID_BASE_PATH');
  return Object.freeze({schema:ITEM_REFERENCE_LINK_SCHEMA,status:'linked',reason:null,
    identity:Object.freeze({kind:'DDV_ITEM_ID',itemId:id,...ITEM_REFERENCE_TARGET}),
    href:path+'?item='+String(id)});
}
/** 01D Tag/Set IDs must be explicitly evidenced; family/world matching is not a relation. */
/** @param {any} options */
export function resolveRelatedItemLink(options={}) {
  const {index,records,sourceItemId,relation,reviewedRelations=[],requestedTarget=ITEM_REFERENCE_TARGET,basePath=''}=options;
  const id=numericId(sourceItemId);
  if(id===null) return fail('INVALID_ITEM_ID');
  if(!relation || !['TAG','SET'].includes(relation.kind) ||
    numericId(relation.sourceItemId)!==id ||
    numericId(relation.targetItemId)===null ||
    numericId(relation.relationId)===null ||
    relation.authority!=='01D_VERIFIED_ITEM_RELATION' ||
    relation.platform!==ITEM_REFERENCE_TARGET.platform ||
    relation.gameVersion!==ITEM_REFERENCE_TARGET.gameVersion ||
    relation.buildID!==ITEM_REFERENCE_TARGET.buildID ||
    !/^[a-f0-9]{64}$/.test(relation.evidenceSha256||'')) return fail('UNVERIFIED_RELATED_IDENTITY');
  if(!unique(records,id).item) return fail('UNKNOWN_SOURCE_ITEM');
  // An alleged relation alone is not evidence. It must also be an exact
  // member of a separately integrity-checked 01D relationship registry.
  const verified=Array.isArray(reviewedRelations) ? reviewedRelations.filter(e=>
    e.kind===relation.kind && e.sourceItemId===relation.sourceItemId &&
    e.targetItemId===relation.targetItemId && e.relationId===relation.relationId &&
    e.evidenceSha256===relation.evidenceSha256 &&
    e.authority===relation.authority && e.platform===relation.platform &&
    e.gameVersion===relation.gameVersion && e.buildID===relation.buildID) : [];
  if(verified.length!==1) return fail('UNVERIFIED_RELATED_IDENTITY');
  return resolveSharedItemLink({index,records,itemId:relation.targetItemId,identityKind:'DDV_ITEM_ID',from:'decorate',to:'collection',requestedTarget,basePath});
}
/** No Guide relationships/pages have reached public approval. Caller must provide both reviewed registries. */
/** @param {any} options */
export function resolvePublishedGuideItemLink(options={}) {
  const {index,records,itemId,approvedRelations=[],publishedPages=[],requestedTarget=ITEM_REFERENCE_TARGET,basePath=''}=options;
  if(!sourceGood(index,requestedTarget)) return fail('UNSUPPORTED_SOURCE_BUILD');
  const id=numericId(itemId);
  if(id===null || !unique(records,id).item) return fail('UNKNOWN_ITEM_ID');
  if(!Array.isArray(approvedRelations) || !Array.isArray(publishedPages)) return fail('GUIDE_RELATION_UNAPPROVED');
  const links=approvedRelations.filter(e=>e?.kind==='DDV_ITEM_ID' && e.itemId===id &&
    e.status==='APPROVED_PUBLIC' && e.platform===ITEM_REFERENCE_TARGET.platform &&
    e.gameVersion===ITEM_REFERENCE_TARGET.gameVersion && e.buildID===ITEM_REFERENCE_TARGET.buildID);
  if(links.length!==1) return fail('GUIDE_RELATION_UNAPPROVED');
  const pages=publishedPages.filter(p=>p?.pageId===links[0].pageId &&
    p.publicationState==='PUBLISHED_APPROVED' && p.publicRouteApproved===true &&
    /^\/guide\/(?:systems|quests|star-paths|events)\/[a-z0-9][a-z0-9-]*\/$/.test(p.href) &&
    p.platform===ITEM_REFERENCE_TARGET.platform && p.gameVersion===ITEM_REFERENCE_TARGET.gameVersion &&
    p.buildID===ITEM_REFERENCE_TARGET.buildID);
  if(pages.length!==1) return fail('GUIDE_PAGE_UNPUBLISHED');
  const path=safePath(basePath,pages[0].href);
  return path?Object.freeze({schema:ITEM_REFERENCE_LINK_SCHEMA,status:'linked',reason:null,
    identity:{kind:'DDV_ITEM_ID',itemId:id,...ITEM_REFERENCE_TARGET},href:path}):fail('INVALID_BASE_PATH');
}

/**
 * Canonical cross-product inbound link for Explore. A duplicate or foreign
 * query key is never interpreted by URLSearchParams.get's first-value rule.
 * The record source must be supplied by the already checked Collection loader.
 * @param {any} options
 */
export function resolveSharedItemInboundLink(options={}) {
  const {url,index,records,basePath=''}=options;
  const params=url?.searchParams;
  if(!params || typeof params.getAll!=='function' || typeof params.entries!=='function') {
    return fail('INVALID_ITEM_QUERY');
  }
  const counts=new Map();
  const allowed=new Set(['item','version','buildID']);
  for(const [key] of params.entries()){
    if(!allowed.has(key)) return fail('UNKNOWN_ITEM_QUERY_PARAMETER');
    counts.set(key,(counts.get(key)||0)+1);
    if(counts.get(key)>1) return fail('DUPLICATE_ITEM_QUERY_PARAMETER');
  }
  if(counts.get('item')!==1) return fail('INVALID_ITEM_QUERY');
  const version=params.get('version') ?? ITEM_REFERENCE_TARGET.gameVersion;
  const buildID=params.get('buildID') ?? ITEM_REFERENCE_TARGET.buildID;
  if(version!==ITEM_REFERENCE_TARGET.gameVersion || buildID!==ITEM_REFERENCE_TARGET.buildID) {
    return fail('UNSUPPORTED_SOURCE_BUILD');
  }
  return resolveSharedItemLink({index,records,itemId:params.get('item'),
    identityKind:'DDV_ITEM_ID',from:'collection',to:'decorate',basePath,
    requestedTarget:{...ITEM_REFERENCE_TARGET,gameVersion:version,buildID}});
}
