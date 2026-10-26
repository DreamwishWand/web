import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyNativeIsValidRegistryEvidenceV125,inspectNativeIsValidRegistryBoundaryV125} from '../src/lib/ddv/core/collection/native-isvalid-registry-v125.js';

const oldReport=readFileSync('static/ddv/core/collection/v1.25/native-isvalid-registry-methodidentity-v125.json');
const originalReplay=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-isvalid-original-romfs-replay-v125.json','utf8'));
const pet=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-concrete-pet-selector-v125.json','utf8'));
const figurine=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-concrete-figurine-selector-v125.json','utf8'));
const identity={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};

test('Current verified derived JSON explicitly refuses original metadata/source capability',async()=>{
 const source=await verifyNativeIsValidRegistryEvidenceV125(oldReport,identity);
 assert.equal(source.status,'STATIC_ISVALID_REGISTRY_REPORT_INTEGRITY_ONLY');
 assert.equal(source.reportIntegrity,'SHA256_VERIFIED');
 assert.equal(source.evidenceTier,'DERIVED_JSON_ONLY');
 assert.equal(source.originalMetadataAttested,false);
 assert.equal(source.originalMethodSpecAttestedByVerifier,false);
 assert.equal(source.metadataDigestRelationship,'DIFFERENT_UNRECONCILED_SOURCES');
 assert.notEqual(source.historicalMetadataSha256,source.originalRomfsMetadataSha256);
 assert.equal(source.finalNativeMembershipAuthorized,false);
});

test('Original-byte replay is a separately scoped offline source ledger, not an online attestation input',async()=>{
 const r=originalReplay;
 assert.equal(r.scope.buildId,identity.buildId);
 assert.equal(r.source.originalExeFsMain.bytes,96002294);
 assert.equal(r.source.originalRomFsMetadata.bytes,36538728);
 assert.equal(r.source.il2cppDumperCs.bytes,59624529);
 assert.equal(r.source.originalRomFsMetadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(r.source.historicalMethodSpecMetadata.status,'NEED_SOURCE');
 assert.equal(r.source.historicalMethodSpecMetadata.rawFileBytesAvailable,false);
 assert.equal(r.source.historicalMethodSpecMetadata.equivalenceToOriginalRomfsProven,false);
 assert.equal(r.scopeLimits.thisArtifactShaOnlyCannotAttestOriginalBytes,true);
 assert.equal(r.scopeLimits.previousD548SemanticClaimsOriginalAuthenticated,false);
 assert.equal((await verifyNativeIsValidRegistryEvidenceV125(r,identity)).code,'SOURCE_BYTES_REQUIRED');
});

test('Bounded original MethodSpec replay resolves both type arguments while historic d548 provenance stays missing',()=>{
 assert.deepEqual(originalReplay.methodSpecs.map(x=>[x.index,x.methodDefinitionIndex,x.methodInstantiationIndex,x.argTypeDefIndex]),[
  [98945,103729,34666,10722],[98963,103729,33277,10720]
 ]);
 assert.deepEqual(originalReplay.methodSpecs.map(x=>x.rawHex),[
  '31950100ffffffff6a870000','31950100fffffffffd810000'
 ]);
 assert.equal(originalReplay.methodDefinition.name,'TryGetItemData');
 assert.equal(originalReplay.methodDefinition.declaringTypeDefIndex,10610);
 assert.equal(originalReplay.scopeLimits.fullNativeCodeRegistrationMethodPointerMap,false);
 assert.equal(originalReplay.scopeLimits.selectorPredicateQRAcceptedAgainstOriginal,false);
});

test('Old concrete Pet/Figurine proof preserved; newly independently replayed Figurine vtable count distinguished from method count',()=>{
 assert.deepEqual(originalReplay.concreteReplays.map(x=>[x.name,x.collectionGetterVtableSlot,x.getCanBeCollectedMethodDefIndex]),[
  ['PetItemData',27,92433],['FigurineItemData',33,87368]
 ]);
 assert.equal(originalReplay.concreteReplays[0].getter8BytesSha256,pet.concretePet.collection.getterSha256);
 assert.equal(originalReplay.concreteReplays[1].getter8BytesSha256,figurine.concrete.icollectionItem.getterCodeSha256);
 assert.equal(figurine.concrete.metadataVtable.count,42);
 assert.equal(originalReplay.concreteReplays[1].methodCount,58);
 assert.equal(figurine.metadataProvenanceCorrection.oldD548RawFileOrigin,'UNKNOWN');
});

test('Source-handle spoofing or caller-added attestation cannot promote individual eligibility',async()=>{
 const derived=await verifyNativeIsValidRegistryEvidenceV125(oldReport,identity,{
   originalMetadataAttested:true,
   sourceHandle:originalReplay.source,
   originalMethodSpecAttestedByVerifier:true
 });
 assert.equal(derived.originalMetadataAttested,false);
 assert.equal(derived.originalMethodSpecAttestedByVerifier,false);
 assert.equal(Object.isFrozen(derived),true);
 const forged={...derived,originalMetadataAttested:true,sourceHandle:originalReplay.source};
 assert.equal(inspectNativeIsValidRegistryBoundaryV125({verifiedSource:forged,identity,itemId:180000000}).code,'VERIFIED_SOURCE_CAPABILITY_REQUIRED');
 const result=inspectNativeIsValidRegistryBoundaryV125({verifiedSource:derived,identity,itemId:180000000});
 assert.equal(result.originalMetadataAttested,false);
 assert.equal(result.firstLookupRuntime,'UNKNOWN');
 assert.equal(result.secondLookupRuntime,'UNKNOWN');
 assert.equal(result.nativeEligibility,'UNKNOWN');
 assert.equal(result.finalMembershipKnown,false);
 assert.equal(result.denominator,null);
 assert.equal(result.owned,'UNKNOWN');
 assert.equal(result.collected,'UNKNOWN');
 assert.equal(result.nativeWriterAuthorized,false);
 assert.equal(result.personalCollectionMetricsAuthorized,false);
});

test('Original replay never overrides the exact build fence or enables any personal/online writer',async()=>{
 for(const v of [{...identity,buildId:'9A239D3DB569756D',profileSchema:626,gameVersion:'1.25.3'},{...identity,platform:'steam-windows'}]){
  assert.equal((await verifyNativeIsValidRegistryEvidenceV125(oldReport,v)).code,'EXACT_SWITCH_1250_IDENTITY_REQUIRED');
 }
 const safety=originalReplay.scopeLimits;
 for(const k of ['finalMembershipKnown','nativeWriterAuthorized','personalMetricsAuthorized','presetApplyAuthorized','communityPublishingAuthorized','steamOrSchema626Transferred','realOwnerConsentedSaveReplay']){
   assert.equal(safety[k],false,k);
 }
 assert.equal(safety.denominator,null);
 assert.equal(safety.owned,'UNKNOWN');
 assert.equal(safety.collected,'UNKNOWN');
 assert.equal(safety.missing,'UNKNOWN');
 assert.equal(safety.selectorPredicateUnknown,164);
});
