export const NATIVE_CHARACTER_SELECTOR_V125_SCHEMA = 'ddv.collection-native-selector-predicate-candidates@1';
export const NATIVE_CHARACTER_SELECTOR_V125_SHA256 = '9ec2a38f9462c0ab2f0dd73e8833dcb1953f34aa58effec557028e72119fa25c';
const BID = '52BD625D9B4E0053';
const DB_SHA = 'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048';
const SOURCE_SHA = 'c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb';
const verified = new WeakMap();
const hex = (array) => [...new Uint8Array(array)].map(x => x.toString(16).padStart(2, '0')).join('');
const fail = (code) => Object.freeze({ status: 'BLOCKED', code, personalCollectionMetricsAuthorized: false, ownedAuthorized: false, nativeWriterAuthorized: false });
const isID = (v) => Number.isSafeInteger(v) && v > 0;
const identityOK = (id) => id?.platform === 'switch' && id?.gameVersion === '1.25.0' && id?.buildId === BID && id?.profileSchema === 624;

/** Data attestations are only for original Switch1250 selector predicates, NOT saved groups. */
export async function verifyNativeCharacterSelectorCandidatesV125(raw, identity) {
  if (!identityOK(identity)) return fail('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  if (!(raw instanceof Uint8Array) && typeof raw !== 'string') return fail('SOURCE_BYTES_REQUIRED');
  if (!globalThis.crypto?.subtle) return fail('CRYPTO_UNAVAILABLE');
  const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
  if (bytes.byteLength !== 21014) return fail('SOURCE_BYTE_SIZE_MISMATCH');
  const digest = hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  if (digest !== NATIVE_CHARACTER_SELECTOR_V125_SHA256) return fail('SOURCE_SHA256_MISMATCH');
  let m;
  try { m = JSON.parse(new TextDecoder().decode(bytes)); } catch { return fail('SOURCE_JSON_INVALID'); }
  if (m.schema !== NATIVE_CHARACTER_SELECTOR_V125_SCHEMA || m.buildId !== BID || m.profileSchema !== 624 ||
      m.source !== 'Nintendo Switch v1.25.0' || m.sourceSha256?.canonicalLosslessDb !== DB_SHA ||
      m.sourceSha256?.collectionDefinitionsCompact !== SOURCE_SHA || !Array.isArray(m.definitions) ||
      m.definitions.length !== 33 || m.statistics?.nativePredicateClosedSelectorOccurrences !== 33 ||
      m.statistics?.selectorCount !== 256 || m.statistics?.ignoredSelectorCount !== 20 ||
      m.statistics?.nativeCharacterDefinitions !== 122 || m.statistics?.characterDebugExcluded !== 48 ||
      m.evidenceClasses?.nativeFinalCandidateSet !== 'UNKNOWN' ||
      m.privacy?.publicCollectionPercentAuthorized !== false) return fail('SOURCE_SEMANTIC_IDENTITY_INVALID');
  const byId = new Map();
  for (const d of m.definitions) {
    if (!isID(d.collectionDefinitionId) || byId.has(d.collectionDefinitionId) || d.categoryId !== 'CollectionSubMenu_Characters' ||
        d.selectorOneof !== 'CharacterUniverse' || d.groupIndex !== 0 || !isID(d.universeTagId) ||
        !Array.isArray(d.predicateCandidateItemIds) || !Array.isArray(d.isDebugExcludedItemIds) ||
        d.finalNativeCandidateMembership !== 'UNVERIFIED_POST_SELECTOR_VALIDITY_AND_SAVE_GROUPS') return fail('SOURCE_DEFINITION_INVALID');
    const ids = [...d.predicateCandidateItemIds, ...d.isDebugExcludedItemIds];
    if (ids.some(x => !isID(x)) || new Set(ids).size !== ids.length ||
        [...d.predicateCandidateItemIds].sort((a,b)=>a-b).some((x,i)=>x!==d.predicateCandidateItemIds[i])) return fail('SOURCE_CANDIDATE_ID_INVALID');
    byId.set(d.collectionDefinitionId, Object.freeze({
      categoryId:d.categoryId, universeTagId:d.universeTagId,
      included:new Set(d.predicateCandidateItemIds), debugExcluded:new Set(d.isDebugExcludedItemIds),
      candidates: Object.freeze([...d.predicateCandidateItemIds]),
      debugExcludedIds: Object.freeze([...d.isDebugExcludedItemIds])
    }));
  }
  const handle=Object.freeze({status:'VERIFIED_PREDICATE_CANDIDATES_ONLY',platform:'switch',gameVersion:'1.25.0',buildId:BID,profileSchema:624,
    sourceSha256:digest,definitionCount:33,remainingUnknownSelectorCount:223,personalCollectionMetricsAuthorized:false,
    ownedAuthorized:false,finalCandidateMembershipProven:false,nativeWriterAuthorized:false});
  verified.set(handle,byId);
  return handle;
}

/** No caller-controlled JSON, owner inventory or runtime eligibility is consumed. */
export function inspectNativeCharacterUniversePredicateV125({verifiedSource, identity, collectionDefinitionId, itemId} = {}) {
  if (!identityOK(identity)) return fail('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  const records = verifiedSource && verified.get(verifiedSource);
  if (!records) return fail('VERIFIED_SOURCE_HANDLE_REQUIRED');
  if (!isID(collectionDefinitionId) || !isID(itemId)) return fail('INVALID_ITEM_OR_COLLECTION_DEFINITION_ID');
  const record=records.get(collectionDefinitionId);
  if (!record) return Object.freeze({status:'UNKNOWN',code:'SELECTOR_FAMILY_NOT_NATIVE_PROVEN',finalMembershipKnown:false,personalCollectionMetricsAuthorized:false});
  const state = record.included.has(itemId) ? 'MATCHES_CHARACTER_UNIVERSE_PREDICATE' :
    record.debugExcluded.has(itemId) ? 'REJECTED_NATIVE_ISDEBUG' : 'DOES_NOT_MATCH_CHARACTER_UNIVERSE_PREDICATE';
  return Object.freeze({status:'PREDICATE_ONLY',state,collectionDefinitionId,itemId,
    categoryId:record.categoryId,universeTagId:record.universeTagId,finalMembershipKnown:false,
    collected:'UNKNOWN',owned:'UNKNOWN',denominator:null,personalCollectionMetricsAuthorized:false,
    nativeWriterAuthorized:false});
}
