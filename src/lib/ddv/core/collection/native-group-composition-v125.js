export const NATIVE_GROUP_COMPOSITION_V125_SHA256 = '418d9805ab59ab60941072afd206161f205f6daa4bcadd9a95f960226a6ad699';
const BUILD_ID = '52BD625D9B4E0053';
const GROUP_FUNCTION_SHA = '039858dc0b0843be28bfc5c4a2d78e269a2d0ddcc6cb46248d7f8c24d8a4d1a5';
const SOURCE_SHA = 'c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb';
const MAIN_SHA = '3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0';
const verified = new WeakMap();
const identityValid = (identity) => identity?.platform === 'switch' && identity?.gameVersion === '1.25.0' && identity?.buildId === BUILD_ID && identity?.profileSchema === 624;
const fail = (code) => Object.freeze({status:'BLOCKED',code,finalNativeMembershipAuthorized:false,personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
const hex = (value) => [...new Uint8Array(value)].map(n => n.toString(16).padStart(2,'0')).join('');
const idsValid = (list) => Array.isArray(list) && list.length <= 17413 && list.every(id => Number.isSafeInteger(id) && id > 0);

export async function verifyNativeGroupCompositionEvidenceV125(sourceBytes, identity) {
  if (!identityValid(identity)) return fail('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  if (!(sourceBytes instanceof Uint8Array) && typeof sourceBytes !== 'string') return fail('RAW_SOURCE_BYTES_REQUIRED');
  if (!globalThis.crypto?.subtle) return fail('CRYPTO_UNAVAILABLE');
  const bytes = typeof sourceBytes === 'string' ? new TextEncoder().encode(sourceBytes) : sourceBytes;
  if (bytes.byteLength !== 4024) return fail('SOURCE_BYTE_LENGTH_MISMATCH');
  if (hex(await globalThis.crypto.subtle.digest('SHA-256',bytes)) !== NATIVE_GROUP_COMPOSITION_V125_SHA256) return fail('SOURCE_SHA256_MISMATCH');
  let evidence;
  try { evidence = JSON.parse(new TextDecoder().decode(bytes)); } catch { return fail('SOURCE_JSON_INVALID'); }
  const sites=evidence.instructionAnchors;
  if (evidence.schema!=='ddv.collection-native-group-composition-evidence@1'||
      evidence.platform!=='Nintendo Switch'||evidence.gameVersion!=='1.25.0'||evidence.buildId!==BUILD_ID||evidence.profileSchema!==624||
      evidence.sourceSha256?.mainNso!==MAIN_SHA||evidence.sourceSha256?.collectionDefinitionsCompact!==SOURCE_SHA||
      evidence.methodByteSlices?.GetItemsInGroup?.sha256!==GROUP_FUNCTION_SHA||
      evidence.methodByteSlices?.GetItemsInGroup?.startRva!=='0x4BF9BB0'||
      evidence.operationTargets?.union!=='0x3BC4500'||evidence.operationTargets?.except!=='0x3BC4AF0'||
      sites?.['0x4BF9EC4']?.opcodeLE!=='8f29bf97'||sites?.['0x4BF9F40']?.opcodeLE!=='7029bf97'||
      sites?.['0x4BFA034']?.opcodeLE!=='55010036'||sites?.['0x4BFA170']?.opcodeLE!=='602abf97'||
      sites?.['0x4BFA2A8']?.opcodeLE!=='122abf97'||
      evidence.sourceCounts?.typedSelectors!==256||evidence.sourceCounts?.typedIgnore!==20||
      evidence.sourceCounts?.explicitIncludeOccurrences!==150||evidence.sourceCounts?.explicitExcludeOccurrences!==273||
      evidence.safety?.percentageAuthorized!==false||evidence.safety?.finalCandidateSetAuthorized!==false)
    return fail('SOURCE_CONTRACT_MISMATCH');
  const handle=Object.freeze({status:'VERIFIED_NATIVE_GROUP_CONTROL_FLOW_ONLY',gameVersion:'1.25.0',buildId:BUILD_ID,
    sha256:NATIVE_GROUP_COMPOSITION_V125_SHA256,nativeUnionExcludeOrderingConfirmed:true,
    familyPredicatesRemainingUnknown:182,finalNativeMembershipAuthorized:false,
    personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
  verified.set(handle,true);
  return handle;
}

/** This simulates proven HashSet ordering over untrusted caller-provided predicate results.
 * It MUST NOT infer real GetItemsFromType output, native candidate membership, a collection denominator or save status.
 */
export function previewNativeGroupCompositionV125({verifiedSource,identity,typedSelectorResults,explicitItemFilters,includeIgnored=false}={}) {
  if(!identityValid(identity)) return fail('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  if(!verifiedSource || !verified.get(verifiedSource)) return fail('VERIFIED_SOURCE_CAPABILITY_REQUIRED');
  if(typeof includeIgnored!=='boolean'||!Array.isArray(typedSelectorResults)||!Array.isArray(explicitItemFilters)||
     typedSelectorResults.length > 256 || explicitItemFilters.length > 293) return fail('FILTER_INPUT_MALFORMED');
  const validate=(f,isTyped)=>f && typeof f.ignore==='boolean' && idsValid(f.itemIds) &&
    (!isTyped || (typeof f.family==='string' && f.family.length>0 && f.predicateCoverage==='CALLER_SUPPLIED_UNVERIFIED'));
  if (typedSelectorResults.some(f=>!validate(f,true)) || explicitItemFilters.some(f=>!validate(f,false)))
    return fail('UNVERIFIED_OR_MALFORMED_PREDICATE_INPUT');
  const all=[...typedSelectorResults,...explicitItemFilters];
  const result=new Set();
  for(const filter of all) if(includeIgnored || !filter.ignore) for(const id of filter.itemIds) result.add(id);
  if(!includeIgnored) for(const filter of all) if(filter.ignore) for(const id of filter.itemIds) result.delete(id);
  return Object.freeze({status:'UNTRUSTED_PREDICATE_COMPOSITION_PREVIEW_ONLY',
    resultItemIds:Object.freeze([...result].sort((a,b)=>a-b)),
    sourceInputsAttested:false,typedNativeCandidateComplete:false,
    finalNativeMembershipAuthorized:false,finalMembershipKnown:false,denominator:null,
    collected:'UNKNOWN',owned:'UNKNOWN',eligibility:'UNKNOWN',
    personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
}
