/**
 * Integrity gate for a HISTORICAL DERIVED MethodIdentity JSON report.
 * Its SHA-256 authenticates report bytes, NEVER the original IL2CPP metadata.
 * The report references an untraced d548... metadata digest that differs from
 * the recovered original RomFS v31 metadata digest (07e...).
 * Original-byte MethodSpec replays require a separate, source-bound offline audit.
 * Not a runtime registry, native eligibility oracle, save/entitlement probe or writer.
 */
export const NATIVE_ISVALID_REGISTRY_SOURCE_SHA256_V125 = '5f563d7c95bd365a779cb4531e9bdc4532102d87adbc7c0d049f8adbc68cabfb';
const SOURCE_BYTES = 5438;
const BUILD_ID = '52BD625D9B4E0053';
const MAIN_SHA = '3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0';
const DUMP_SHA = 'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0';
const HISTORICAL_REPORT_METADATA_SHA = 'd5487eb7c2341d8fd245d4815cc55eae0c64f0822f4a55fa495fc0afcd1c2b08';
const ORIGINAL_ROMFS_METADATA_SHA = '07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c';
const DEFINITION_SHA = 'c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb';
const VALIDITY_SHA = '7b86791e0fa80577a3358dc9cf5d00f9c6c9bdc8e1a10ba2acc8a51c325f559d';
const handles = new WeakSet();
const validScope = (x) => x?.platform === 'switch' && x?.gameVersion === '1.25.0' && x?.buildId === BUILD_ID && x?.profileSchema === 624;
const reject = (code) => Object.freeze({status:'BLOCKED',code,originalMetadataAttested:false,finalNativeMembershipAuthorized:false,personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
const digestHex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

export async function verifyNativeIsValidRegistryEvidenceV125(raw, identity) {
  if (!validScope(identity)) return reject('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  if (!(raw instanceof Uint8Array) && typeof raw !== 'string') return reject('SOURCE_BYTES_REQUIRED');
  if (!globalThis.crypto?.subtle) return reject('CRYPTO_UNAVAILABLE');
  const b = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
  if (b.byteLength !== SOURCE_BYTES) return reject('SOURCE_LENGTH_MISMATCH');
  const digest = digestHex(await globalThis.crypto.subtle.digest('SHA-256',b));
  if (digest !== NATIVE_ISVALID_REGISTRY_SOURCE_SHA256_V125) return reject('SOURCE_SHA256_MISMATCH');
  let source;
  try { source=JSON.parse(new TextDecoder().decode(b)); } catch { return reject('SOURCE_JSON_INVALID'); }
  const f=source.methodIdentity?.first;
  const s=source.methodIdentity?.second;
  const typ=source.methodIdentity;
  const logic=source.nativeBooleanConditions;
  if (source.schema!=='ddv.collection-native-isvalid-registry-semantics@1' ||
      source.scope?.buildId!==BUILD_ID || source.scope?.profileSchema!==624 || source.scope?.gameVersion!=='1.25.0' || source.scope?.platform!=='Nintendo Switch' ||
      source.sourceSha256?.originalNsoMain!==MAIN_SHA || source.sourceSha256?.sameBuildDumpCs!==DUMP_SHA ||
      source.sourceSha256?.globalMetadataV31!==HISTORICAL_REPORT_METADATA_SHA || source.sourceSha256?.compactCollectionDefinitions!==DEFINITION_SHA ||
      typ?.itemDatabaseGenericTryGetItemDataRva!=='0x37826c0' || typ?.itemDatabaseTypeInfo?.typeDefIndex!==10610 ||
      f?.genericArgument?.genericArgTypeDefIndex!==10722 || f?.genericArgument?.encodedMethodRef!=='0xc0030503' ||
      f?.genericArgument?.methodSpecIndex!==98945 || f?.interfaceTypeInfo?.typeDefIndex!==10722 ||
      f?.virtualInterfaceMethod!=='Definitions.Items.ICollectionItem.get_CanBeCollected' || f?.virtualSlot!==1 ||
      s?.genericArgument?.genericArgTypeDefIndex!==10720 || s?.genericArgument?.encodedMethodRef!=='0xc0030527' ||
      s?.genericArgument?.methodSpecIndex!==98963 || s?.interfaceTypeInfo?.typeDefIndex!==10720 ||
      s?.virtualInterfaceMethod!=='Definitions.Items.IItemIsVariationOf.get_IsVariationOf' || s?.virtualSlot!==0 ||
      s?.absentInterfaceReturns!==true || typ?.staticCompareItemTypeInfo?.typeDefIndex!==10554 ||
      logic?.secondInterfacePresent?.ItemInvalidItemId!==0 || logic?.firstLookupMissing!==false ||
      logic?.firstCanBeCollectedFalse!==false || logic?.firstCanBeCollectedTrueAndSecondInterfaceMissing!==true ||
      source.codeByteSlices?.IsValidItemForCollection?.sha256!==VALIDITY_SHA ||
      source.opcodeLE?.['0X4C521B4']!=='1f0100b9' ||
      source.opcodeLE?.['0X4BFA620']!=='7f02086b' ||
      JSON.stringify(source.directNativeCallers?.IsValidItemForCollection)!=='["0x4f70fc8"]' ||
      source.required?.nativeSelectorsUnknown!==182 || source.required?.anyPersonalMetricAuthorized!==false ||
      source.required?.nativeWriterAuthorized!==false || source.required?.publicConsumerAuthorized!==false) {
    return reject('SOURCE_SEMANTIC_IDENTITY_MISMATCH');
  }
  // A hash-pinned derived report is NOT proof of original metadata MethodSpec identity.
  // Preserve the opaque handle for backward-compatible UNKNOWN-only inspection.
  // Neither user-supplied metadata-attested flags nor source URLs/handles can elevate it.
  const cap = Object.freeze({status:'STATIC_ISVALID_REGISTRY_REPORT_INTEGRITY_ONLY',buildId:BUILD_ID,profileSchema:624,
    sourceSha256:digest,reportIntegrity:'SHA256_VERIFIED',evidenceTier:'DERIVED_JSON_ONLY',
    originalMetadataAttested:false,originalMethodSpecAttestedByVerifier:false,
    historicalMetadataSha256:HISTORICAL_REPORT_METADATA_SHA,
    originalRomfsMetadataSha256:ORIGINAL_ROMFS_METADATA_SHA,
    metadataDigestRelationship:'DIFFERENT_UNRECONCILED_SOURCES',
    firstGenericType:'ICollectionItem',secondGenericType:'IItemIsVariationOf',
    firstMethod:'get_CanBeCollected',secondMethod:'get_IsVariationOf',
    invalidItemId:0,directIsValidCallerCount:1,remainingUnverifiedSelectorCount:182,
    finalNativeMembershipAuthorized:false,personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
  handles.add(cap);
  return cap;
}

/** Never returns a bool for an actual ItemID. Caller-supplied runtime booleans are NOT accepted. */
export function inspectNativeIsValidRegistryBoundaryV125({verifiedSource,identity,itemId}={}) {
  if (!validScope(identity)) return reject('EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  if (!verifiedSource || !handles.has(verifiedSource)) return reject('VERIFIED_SOURCE_CAPABILITY_REQUIRED');
  if (!Number.isSafeInteger(itemId) || itemId<=0) return reject('INVALID_ITEM_ID');
  return Object.freeze({status:'STATIC_SEMANTIC_PREDICATE_ONLY',itemId,
    reportIntegrity:'SHA256_VERIFIED',evidenceTier:'DERIVED_JSON_ONLY',
    originalMetadataAttested:false,originalMethodSpecAttestedByVerifier:false,
    firstLookupType:'ICollectionItem',firstVirtual:'get_CanBeCollected',
    secondLookupType:'IItemIsVariationOf',secondVirtual:'get_IsVariationOf',
    invalidVariationOfItemId:0,firstLookupRuntime:'UNKNOWN',firstVirtualResult:'UNKNOWN',
    secondLookupRuntime:'UNKNOWN',secondVirtualResult:'UNKNOWN',
    finalMembershipKnown:false,nativeEligibility:'UNKNOWN',collected:'UNKNOWN',owned:'UNKNOWN',denominator:null,
    personalCollectionMetricsAuthorized:false,nativeWriterAuthorized:false});
}
