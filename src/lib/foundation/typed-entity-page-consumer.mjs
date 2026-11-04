// 08 WEB / W-ENTITY-016: adapters for the ONE canonical 06 PRODUCT Typed EntityRef.
// A source-bound preview link is NOT a public canonical URL, ownership grant,
// authorization, verified alias, Native SPECIALIZATION, or HTTP200/301.
import { makeEntityRef, makeSourceScope, nativeEntityPath, sameSourceScope } from '../entity/shared-entity-identity.mjs';
import { resolveSharedCatalogEntity, sharedEntityHref } from '../entity/shared-catalog-detail.mjs';

export const TYPED_CATALOG_CONSUMER = 'wand.web.typed-catalog-consumer@1';
export const CATALOG_SOURCE_SCOPE = makeSourceScope({
  platform:'Nintendo Switch',fullVersion:'1.25.0',
  bid:'52BD625D9B4E0053',schema:624,dlc:[]
});
export const TYPED_CATALOG_PUBLIC_ENABLED = false;
export const TYPED_CATALOG_PERSONAL_READ_ENABLED = false;

const fail = status => Object.freeze({
  status,ref:null,sourceScope:null,href:null,record:null,
  publicIndexable:false,canonicalUrl:null,relations:Object.freeze([]),
  aliases:Object.freeze([]),personalOverlay:null,writerAuthorized:false
});
function provenIndex(index) {
  return index?.s==='wand.collection.runtime@1' &&
    index?.t?.platform===CATALOG_SOURCE_SCOPE.platform &&
    index?.t?.gameVersion===CATALOG_SOURCE_SCOPE.fullVersion &&
    index?.t?.buildID===CATALOG_SOURCE_SCOPE.bid &&
    (index?.t?.schema === undefined || index.t.schema===CATALOG_SOURCE_SCOPE.schema);
}

export function typedItemPreviewHref(base,locale,rawId) {
  try {
    const ref=makeEntityRef({kind:'ITEM',primaryId:String(rawId)});
    const path=nativeEntityPath(ref,locale,{base});
    // Keep the preaccepted Item route exactly stable (not a new public URL).
    if (path===null || path!==sharedEntityHref(base,locale,rawId)) return null;
    return path;
  } catch {return null;}
}

export function resolveTypedCatalogItem(index,rows,rawId,locale='en',base='') {
  if(!provenIndex(index))return fail('SOURCE_MISMATCH');
  const href=typedItemPreviewHref(base,locale,rawId);
  if(!href)return fail('INVALID_REF_OR_LOCALE');
  const outcome=resolveSharedCatalogEntity(index,rows,String(rawId),locale);
  if(outcome.status!=='FOUND')return fail(outcome.status);
  const ref=makeEntityRef({kind:'ITEM',primaryId:String(outcome.item.itemId)});
  if(!sameSourceScope(CATALOG_SOURCE_SCOPE,makeSourceScope(CATALOG_SOURCE_SCOPE)))return fail('SOURCE_MISMATCH');
  return Object.freeze({
    status:'FOUND_REFERENCE_ONLY',ref,sourceScope:CATALOG_SOURCE_SCOPE,href,
    record:outcome.item,publicIndexable:false,canonicalUrl:null,
    relations:Object.freeze([]),aliases:Object.freeze([]),personalOverlay:null,
    writerAuthorized:false
  });
}
export function isTypedItemDirectorySource(directory) {
 const s=directory?.source;
 return directory?.status==='READY' && s?.platform===CATALOG_SOURCE_SCOPE.platform &&
   s?.gameVersion===CATALOG_SOURCE_SCOPE.fullVersion &&
   s?.buildID===CATALOG_SOURCE_SCOPE.bid &&
   (s?.schema===undefined||s.schema===CATALOG_SOURCE_SCOPE.schema);
}
export function typedDirectoryItemHref(base,locale,item,directory) {
 if(!isTypedItemDirectorySource(directory) ||
    !Array.isArray(directory.entries) ||
    !directory.entries.some(x=>x===item&&x.itemId===item?.itemId))
   return null;
 return typedItemPreviewHref(base,locale,item.itemId);
}
// Generic typed detail source is intentionally absent. Real Creator/Work/Preset
// ownership/public eligibility belongs to Community Core, not a client-side UUID.
export function nonItemPublicDetailStatus(kind,primaryId,secondaryId=null) {
 try {
  const ref=makeEntityRef({kind,primaryId:String(primaryId),secondaryId});
  return Object.freeze({status:'SOURCE_UNVERIFIED',ref,
   publicIndexable:false,href:null,canonicalUrl:null,personalOverlay:null});
 } catch {
  return Object.freeze({status:'INVALID_REF',ref:null,
   publicIndexable:false,href:null,canonicalUrl:null,personalOverlay:null});
 }
}
