/** Nintendo Switch v1.25.0 Collection eligibility, static evidence only.
 * Verifies a checked-in source report, not a live GameDB or owner profile.
 * Does not implement runtime registries, virtual dispatch or final membership.
 */
export const NATIVE_ITEM_VALIDITY_EVIDENCE_V125_SHA256 = '4c4d7f060fb85072922ac32b804e495ec928b5bc024dfc854a5a5fdb6600cd6a';
const MAIN = '3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0';
const DUMP = 'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0';
const DEFINITIONS = 'c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb';
const BID = '52BD625D9B4E0053';
const handles = new WeakSet();
const validIdentity = (id) => id?.platform === 'switch' && id?.gameVersion === '1.25.0' && id?.buildId === BID && id?.profileSchema === 624;
const reject = (code) => Object.freeze({status:'BLOCKED',code,finalNativeMembershipAuthorized:false,personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
const hex = (x) => [...new Uint8Array(x)].map(v => v.toString(16).padStart(2,'0')).join('');
const methods = Object.freeze({
  IsValidItemForCollection:['0x4bfa300',832,'7b86791e0fa80577a3358dc9cf5d00f9c6c9bdc8e1a10ba2acc8a51c325f559d'],
  'CollectionSetUtils.GetNewGroup':['0x4f70c90',1040,'42bfdb7c6227da7bb11910e42e6dfb187a7ffddba210407b2ddb567b635f1056'],
  'CollectionGroup.GetItemsInGroup':['0x4bf9bb0',1872,'039858dc0b0843be28bfc5c4a2d78e269a2d0ddcc6cb46248d7f8c24d8a4d1a5']
});
const opcodes = Object.freeze({
  '0x4BFA454':'9b20ae97','0x4BFA458':'60050036','0x4BFA4AC':'00013fd6',
  '0x4BFA4B0':'a0020036','0x4BFA574':'5320ae97','0x4BFA578':'80020036',
  '0x4BFA5F8':'00013fd6','0x4BFA620':'7f02086b','0x4BFA624':'e0179f1a',
  '0x4F70E44':'5b23f297','0x4F70FC8':'ce24f297','0x4F70FCC':'20f60736'
});

export async function verifyNativeItemValidityEvidenceV125(raw, identity) {
  if(!validIdentity(identity)) return reject('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  if(!(raw instanceof Uint8Array) && typeof raw !== 'string') return reject('RAW_SOURCE_BYTES_REQUIRED');
  if(!globalThis.crypto?.subtle) return reject('CRYPTO_UNAVAILABLE');
  const bytes=typeof raw==='string'?new TextEncoder().encode(raw):raw;
  if(bytes.byteLength!==3717) return reject('SOURCE_LENGTH_MISMATCH');
  if(hex(await globalThis.crypto.subtle.digest('SHA-256', bytes)) !== NATIVE_ITEM_VALIDITY_EVIDENCE_V125_SHA256) return reject('SOURCE_SHA256_MISMATCH');
  let evidence;
  try { evidence=JSON.parse(new TextDecoder().decode(bytes)); } catch { return reject('SOURCE_JSON_INVALID'); }
  if(evidence.schema!=='ddv.collection-native-item-validity-callgraph@1' ||
      evidence.platform!=='Nintendo Switch' || evidence.gameVersion!=='1.25.0' || evidence.buildId!==BID || evidence.profileSchema!==624 ||
      evidence.sourceSha256?.mainNso!==MAIN || evidence.sourceSha256?.sameBuildIl2CppDump!==DUMP ||
      evidence.sourceSha256?.collectionDefinitionCompact!==DEFINITIONS ||
      evidence.priorStaticCounts?.collectionDefinitions!==293 || evidence.priorStaticCounts?.typedSelectors!==256 ||
      evidence.priorStaticCounts?.remainingNativePredicates!==182 ||
      evidence.callgraph?.GetItemsInGroupCallsIsValidItemForCollection!==false ||
      evidence.callgraph?.GetNewGroupCallsGetItemsInGroup!==true ||
      evidence.callgraph?.GetNewGroupCallsIsValidItemForCollection!==true ||
      evidence.callgraph?.IsValidCallSiteRva!=='0x4F70FC8' ||
      evidence.callgraph?.runtimeRegistryMeaning!=='UNKNOWN' ||
      evidence.evidenceClass?.finalCollectionMembership!=='UNKNOWN' ||
      evidence.privacy?.personalCollectionMetricsAuthorized!==false ||
      evidence.privacy?.nativeWriterAuthorized!==false) return reject('SOURCE_CONTRACT_MISMATCH');
  for (const [name,[start,length,sha]] of Object.entries(methods)) {
    const m=evidence.methods?.[name];
    if(m?.startRva!==start || m.byteLength!==length || m.sha256!==sha) return reject('SOURCE_METHOD_IDENTITY_MISMATCH');
  }
  for(const [rva,opcode] of Object.entries(opcodes)){
    if(evidence.instructionAnchors?.[rva]?.opcodeLE!==opcode) return reject('SOURCE_OPCODE_MISMATCH');
  }
  const verified=Object.freeze({status:'VERIFIED_NATIVE_VALIDITY_CONTROL_FLOW_ONLY',gameVersion:'1.25.0',buildId:BID,profileSchema:624,
    sourceSha256:NATIVE_ITEM_VALIDITY_EVIDENCE_V125_SHA256,
    nativeFirstRegistryAndVirtualGateConfirmed:true,optionalSecondRegistryAndEnumEqualityGateConfirmed:true,
    isValidInsideGroupSetComposition:false,isValidInvokedByGetNewGroup:true,
    runtimeRegistrySemanticsKnown:false,allSelectorPredicatesKnown:false,finalNativeMembershipAuthorized:false,
    personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
  handles.add(verified);
  return verified;
}

/** A structure probe is not an item classifier. It accepts no caller-provided
 * bool/enum/register values because that would fabricate runtime truth. */
export function inspectNativeItemValidityBoundaryV125({verifiedSource,identity,itemId}={}){
  if(!validIdentity(identity))return reject('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  if(!verifiedSource || !handles.has(verifiedSource))return reject('VERIFIED_SOURCE_CAPABILITY_REQUIRED');
  if(!Number.isSafeInteger(itemId)||itemId<=0)return reject('INVALID_ITEM_ID');
  return Object.freeze({status:'STATIC_VALIDITY_GATES_ONLY',itemId,
    firstRegistryLookup:'REQUIRES_NATIVE_RUNTIME',firstVirtualPredicate:'REQUIRES_NATIVE_RUNTIME',
    secondRegistryLookup:'REQUIRES_NATIVE_RUNTIME',secondVirtualEnumComparison:'REQUIRES_NATIVE_RUNTIME',
    nativeEligibility:'UNKNOWN',finalMembershipKnown:false,denominator:null,collected:'UNKNOWN',owned:'UNKNOWN',
    personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
}
