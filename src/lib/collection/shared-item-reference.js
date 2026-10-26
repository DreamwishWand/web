import { isVerifiedCollectionReferenceCapability, verifiedCollectionReferenceItem } from './runtime.js';

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
function supportedTarget(target) {
  return target !== null && typeof target === 'object' &&
    Object.keys(ITEM_REFERENCE_TARGET).every(k => target[k] === ITEM_REFERENCE_TARGET[k]);
}
function safePath(base,suffix) {
  if(typeof base!=='string' || (base && (!base.startsWith('/') || base.includes('..') || /[?#]/.test(base)))) return null;
  return base.replace(/\/$/,'')+suffix;
}
/** Reference-only. Uses existing 08 WEB/01D-derived decoded Collection item records. */
/** @param {any} options */
export function resolveSharedItemLink(options={}) {
  if(!options || typeof options!=='object' ||
    'index' in options || 'records' in options || 'verified' in options) {
    return fail('UNVERIFIED_SOURCE_DATASET');
  }
  const {capability,itemId,identityKind,from,to,basePath='',requestedTarget=ITEM_REFERENCE_TARGET,
    sourceRecord=null,targetRecord=null,lifecycle=null}=options;
  if(identityKind!=='DDV_ITEM_ID') return fail('UNSUPPORTED_IDENTITY_KIND');
  if(!surfaces.has(from)||!surfaces.has(to)||from===to) return fail('UNSUPPORTED_SURFACE');
  if(!supportedTarget(requestedTarget)) return fail('UNSUPPORTED_SOURCE_BUILD');
  if(!isVerifiedCollectionReferenceCapability(capability)) return fail('UNVERIFIED_SOURCE_DATASET');
  const id=numericId(itemId);
  if(id===null) return fail('INVALID_ITEM_ID');
  const item=verifiedCollectionReferenceItem(capability,id);
  if(!item) return fail('UNKNOWN_ITEM_ID');
  if(sourceRecord && (sourceRecord.itemId!==id || !sameFacets(sourceRecord,item))) return fail('SOURCE_IDENTITY_CONFLICT');
  if(targetRecord && (targetRecord.itemId!==id || !sameFacets(targetRecord,item))) return fail('TARGET_IDENTITY_CONFLICT');
  if(lifecycle!==null && RETIRED.has(lifecycle)) return fail('ITEM_UNAVAILABLE');
  if(lifecycle!==null && lifecycle!=='REFERENCE_ONLY') return fail('ITEM_LIFECYCLE_UNKNOWN');
  if(to==='decorate' && !DECORATE_ITEM_FAMILIES.includes(item.family)) return fail('NOT_DECORATE_FAMILY');
  const path=safePath(basePath,to==='decorate'?'/explore/':'/collection/');
  if(!path) return fail('INVALID_BASE_PATH');
  return Object.freeze({schema:ITEM_REFERENCE_LINK_SCHEMA,status:'linked',reason:null,
    identity:Object.freeze({kind:'DDV_ITEM_ID',itemId:id,...ITEM_REFERENCE_TARGET}),
    href:path+'?item='+String(id)});
}
/**
 * The 01D Tag/Set public relation registry is empty. Caller-supplied
 * reviewedRelations or claimed evidence hashes do not grant authority.
 * No positive relationship is possible before a separately attested issuer exists.
 */
export function resolveRelatedItemLink() {
  return fail('UNVERIFIED_RELATED_IDENTITY');
}

/**
 * No publicly approved Guide Item-to-Page registry exists. Caller-supplied
 * approvedRelations and publishedPages are not a publication authority.
 */
export function resolvePublishedGuideItemLink() {
  return fail('GUIDE_RELATION_UNAPPROVED');
}

/**
 * Canonical cross-product inbound link for Explore. A duplicate or foreign
 * query key is never interpreted by URLSearchParams.get's first-value rule.
 * The opaque capability is issued only by the completely verified Collection loader.
 * @param {any} options
 */
export function resolveSharedItemInboundLink(options={}) {
  if(!options || typeof options!=='object' ||
    'index' in options || 'records' in options || 'verified' in options) {
    return fail('UNVERIFIED_SOURCE_DATASET');
  }
  const {url,capability,basePath=''}=options;
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
  return resolveSharedItemLink({capability,itemId:params.get('item'),
    identityKind:'DDV_ITEM_ID',from:'collection',to:'decorate',basePath,
    requestedTarget:{...ITEM_REFERENCE_TARGET,gameVersion:version,buildID}});
}
