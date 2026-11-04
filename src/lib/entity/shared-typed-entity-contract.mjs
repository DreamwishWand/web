// Shared Wand Database: safe test-only typed EntityRef/P-S boundary.
// This file contains no authoritative Quest/Creator/Work/Preset data, aliases, or rights grants.
// Never interpret an AccountId, MediaId, RevisionId, EntryId or runtime Grid Object ID as a Creator/Work/Preset canonical ID.
import { parseSharedPrimaryId, resolveSharedCatalogEntity, SUPPORTED_DETAIL_LOCALES } from './shared-catalog-detail.mjs';

export const SHARED_TYPED_ENTITY_CONTRACT = 'wand.shared-entity.typed@1';
export const ENTITY_KINDS = Object.freeze(['ITEM','QUEST','CREATOR','WORK','PRESET']);
export const RELATION_TYPES = Object.freeze([
  'SAME_PUBLIC_ENTITY','SPECIALIZATION','RELATED_DISTINCT_ENTITY','OWNERSHIP_CANONICAL',
  'CARRIER_OR_WRAPPER','RUNTIME_INSTANCE'
]);
export const SWITCH_1250_CATALOG_SCOPE = Object.freeze({
  platform:'Nintendo Switch',fullVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624
});
export const SHARED_TYPED_PUBLIC_URL_AUTHORIZED = false;

function validOpaqueId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}
export function parseTypedEntityRef(kind, primaryId, secondaryId=null) {
  if (!ENTITY_KINDS.includes(kind)) return null;
  if (secondaryId !== null && kind !== 'ITEM' && kind !== 'QUEST') return null;
  if ((kind === 'ITEM' || kind === 'QUEST') &&
      (parseSharedPrimaryId(primaryId) === null ||
       (secondaryId !== null && (parseSharedPrimaryId(secondaryId) === null || primaryId === secondaryId))))
    return null;
  if (kind !== 'ITEM' && kind !== 'QUEST' && !validOpaqueId(primaryId)) return null;
  return Object.freeze({kind,primaryId,secondaryId});
}
export function exactSourceScope(value, expected) {
  if (!value || !expected || typeof value !== 'object' || typeof expected !== 'object') return false;
  for(const k of ['platform','fullVersion','bid','schema']){
    if (value[k] !== expected[k]) return false;
  }
  if(!Number.isSafeInteger(value.schema)||value.schema<1) return false;
  if ((value.dlc??null)!==(expected.dlc??null)) return false;
  if (expected.sourceDigest && value.sourceDigest!==expected.sourceDigest) return false;
  return true;
}

// A Source record must have independently verified meaning before being displayed.
// Only main-accepted Switch1.25.0 Item catalog has an existing trusted runtime reader.
// All other kinds, aliases, secondary IDs and author/private records stay absent.
export function resolveTypedEntityFromCatalog({kind,primaryId,secondaryId=null,locale='en',index=null,rows=null}={}) {
  const ref=parseTypedEntityRef(kind,primaryId,secondaryId);
  const empty=(status)=>Object.freeze({
    status,ref,publicIndexable:false,canonicalUrl:null,aliases:Object.freeze([]),
    relations:Object.freeze([]),personalOverlay:null,source:null,record:null
  });
  if (!ref || !SUPPORTED_DETAIL_LOCALES.includes(locale)) return empty('INVALID');
  if (kind !== 'ITEM' || secondaryId !== null) return empty('NOT_VERIFIED');
  if (index?.t?.platform !== SWITCH_1250_CATALOG_SCOPE.platform ||
      index?.t?.gameVersion !== SWITCH_1250_CATALOG_SCOPE.fullVersion ||
      index?.t?.buildID !== SWITCH_1250_CATALOG_SCOPE.bid)
    return empty('SOURCE_MISMATCH');
  const result=resolveSharedCatalogEntity(index,rows,primaryId,locale);
  if (result.status!=='FOUND')return empty(result.status);
  return Object.freeze({
    status:'FOUND',ref,record:result.item,
    source:SWITCH_1250_CATALOG_SCOPE,relations:Object.freeze([]),
    aliases:Object.freeze([]),canonicalUrl:null,publicIndexable:false,
    personalOverlay:null,writerAuthorized:false
  });
}
export function inspectNativeComposite(primaryId, secondaryId) {
  const p=parseSharedPrimaryId(primaryId),s=parseSharedPrimaryId(secondaryId);
  return Object.freeze({
    status:p===null||s===null||p===s?'INVALID':'UNVERIFIED_RELATION',
    primaryId:p===null?null:String(p),secondaryId:s===null?null:String(s),
    // No source-proven SPECIALIZATION, alias or P/S redirect in current main.
    publicIndexable:false,canonicalUrl:null,redirectUrl:null,record:null,
    relationType:null
  });
}
// Identity alias/redirect cannot be inferred from label, raw ID equality or a client field.
export function resolveUnverifiedAlias(){return Object.freeze({
  status:'UNVERIFIED_ALIAS',canonicalUrl:null,redirectUrl:null,publicIndexable:false
});}
export function safeTypedEntityReference(kind,primaryId) {
  const ref=parseTypedEntityRef(kind,primaryId);
  return ref ? Object.freeze({kind:ref.kind,primaryId:ref.primaryId,status:'NOT_VERIFIED'}) : null;
}
