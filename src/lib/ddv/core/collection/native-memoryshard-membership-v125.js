export const NATIVE_MEMORYSHARD_SELECTOR_V125_SHA256 = 'ae32b6c6e36599ec96f1f5f0d53e282c932beafb1fa623e2ba2157cec06feae2';
const SOURCE_SHA='c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb';
const DB_SHA='df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048';
const BID='52BD625D9B4E0053';
const handles=new WeakMap();
const identityOK=(x)=>x?.platform==='switch'&&x?.gameVersion==='1.25.0'&&x?.buildId===BID&&x?.profileSchema===624;
const fail=(code)=>Object.freeze({status:'BLOCKED',code,personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
const idOK=(v)=>Number.isSafeInteger(v)&&v>0;
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function verifyNativeMemoryShardSelectorCandidatesV125(raw, identity) {
  if(!identityOK(identity))return fail('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  if(!(raw instanceof Uint8Array)&&typeof raw!=='string')return fail('SOURCE_BYTES_REQUIRED');
  if(!globalThis.crypto?.subtle)return fail('CRYPTO_UNAVAILABLE');
  const bytes=typeof raw==='string'?new TextEncoder().encode(raw):raw;
  if(bytes.byteLength!==30240)return fail('SOURCE_BYTE_SIZE_MISMATCH');
  const digest=hex(await globalThis.crypto.subtle.digest('SHA-256',bytes));
  if(digest!==NATIVE_MEMORYSHARD_SELECTOR_V125_SHA256)return fail('SOURCE_SHA256_MISMATCH');
  let m;try{m=JSON.parse(new TextDecoder().decode(bytes));}catch{return fail('SOURCE_JSON_INVALID');}
  if(m.schema!=='ddv.collection-memoryshard-selector-predicate-candidates@1'||m.buildId!==BID||m.profileSchema!==624||
     m.sourceSha256?.collectionDefinitionsCompact!==SOURCE_SHA||m.sourceSha256?.canonicalLosslessDb!==DB_SHA||
     m.statistics?.memoryShardItemDataDefinitions!==438||m.statistics?.predicateClosedMemoryShardSelectorOccurrences!==41||
     m.statistics?.sourceMemoryShardIgnoreTrue!==1||m.statistics?.predicateCandidateOccurrences!==445||
     m.evidenceClasses?.nativeFinalCandidateSet!=='UNKNOWN'||m.privacy?.publicCollectionPercentAuthorized!==false||
     !Array.isArray(m.definitions)||m.definitions.length!==41)return fail('SOURCE_SEMANTIC_IDENTITY_INVALID');
  const byDefinition=new Map();let ignored=0;
  for(const d of m.definitions){
    if(!idOK(d.collectionDefinitionId)||!idOK(d.selectorTagId)||d.categoryId!=='CollectionSubMenu_Memories'||
       d.selectorOneof!=='MemoryShard'||!['Universe','MemoryShardSubType'].includes(d.filterCase)||d.groupIndex!==0||
       typeof d.ignore!=='boolean'||!Array.isArray(d.predicateCandidateItemIds)||
       d.predicateCandidateItemIds.some(x=>!idOK(x))||new Set(d.predicateCandidateItemIds).size!==d.predicateCandidateItemIds.length||
       d.finalNativeCandidateMembership!=='UNVERIFIED_POST_SELECTOR_VALIDITY_AND_SAVE_GROUPS')return fail('SOURCE_DEFINITION_INVALID');
    ignored+=Number(d.ignore);
    const rows=byDefinition.get(d.collectionDefinitionId)||[];
    if(rows.some(r=>r.filterCase===d.filterCase && r.selectorTagId===d.selectorTagId))return fail('DUPLICATE_SELECTOR_DEFINITION');
    rows.push(Object.freeze({filterCase:d.filterCase,selectorTagId:d.selectorTagId,ignore:d.ignore,items:new Set(d.predicateCandidateItemIds)}));
    byDefinition.set(d.collectionDefinitionId,rows);
  }
  if(ignored!==1)return fail('IGNORE_SELECTOR_COUNT_INVALID');
  const handle=Object.freeze({status:'VERIFIED_PREDICATE_CANDIDATES_ONLY',platform:'switch',buildId:BID,profileSchema:624,
    sourceSha256:digest,selectorCount:41,remainingNativeUnprovenSelectorsAfterCharacter:182,
    finalCandidateMembershipProven:false,personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
  handles.set(handle,byDefinition);
  return handle;
}
export function inspectNativeMemoryShardPredicateV125({verifiedSource,identity,collectionDefinitionId,itemId}={}) {
  if(!identityOK(identity))return fail('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  const byDefinition=verifiedSource&&handles.get(verifiedSource);
  if(!byDefinition)return fail('VERIFIED_SOURCE_HANDLE_REQUIRED');
  if(!idOK(collectionDefinitionId)||!idOK(itemId))return fail('INVALID_DEFINITION_OR_ITEM_ID');
  const selectors=byDefinition.get(collectionDefinitionId);
  if(!selectors)return Object.freeze({status:'UNKNOWN',code:'MEMORYSHARD_SELECTOR_NOT_VERIFIED',personalCollectionMetricsAuthorized:false});
  const hits=selectors.filter(x=>x.items.has(itemId)).map(x=>Object.freeze({filterCase:x.filterCase,selectorTagId:x.selectorTagId,ignore:x.ignore}));
  return Object.freeze({status:'PREDICATE_ONLY',collectionDefinitionId,itemId,
    predicatesMatched:Object.freeze(hits),anyPredicateMatch:hits.length>0,
    ignoredFinalMembership:'UNKNOWN',finalMembershipKnown:false,denominator:null,collected:'UNKNOWN',owned:'UNKNOWN',
    personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
}
