import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyNativeIsValidRegistryEvidenceV125,inspectNativeIsValidRegistryBoundaryV125} from '../src/lib/ddv/core/collection/native-isvalid-registry-v125.js';

const base='static/ddv/core/collection/v1.25/';
const raw=readFileSync(base+'native-isvalid-registry-methodidentity-v125.json');
const original=JSON.parse(readFileSync(base+'native-isvalid-original-romfs-replay-v125.json'));
const old=JSON.parse(raw);
const pet=JSON.parse(readFileSync(base+'native-concrete-pet-selector-v125.json'));
const figurine=JSON.parse(readFileSync(base+'native-concrete-figurine-selector-v125.json'));
const id=Object.freeze({platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624});
const verify=(rawBytes=raw,identity=id)=>verifyNativeIsValidRegistryEvidenceV125(rawBytes,identity);
const checkUnknown=(cap,itemId=180000000)=>{
 const state=inspectNativeIsValidRegistryBoundaryV125({verifiedSource:cap,identity:id,itemId});
 assert.equal(state.status,'STATIC_SEMANTIC_PREDICATE_ONLY');
 assert.equal(state.evidenceTier,'DERIVED_JSON_ONLY');
 assert.equal(state.originalMetadataAttested,false);
 assert.equal(state.originalMethodSpecAttestedByVerifier,false);
 assert.equal(state.nativeEligibility,'UNKNOWN');
 assert.equal(state.firstLookupRuntime,'UNKNOWN');
 assert.equal(state.secondLookupRuntime,'UNKNOWN');
 assert.equal(state.finalMembershipKnown,false);
 assert.equal(state.denominator,null);
 assert.equal(state.owned,'UNKNOWN');
 assert.equal(state.collected,'UNKNOWN');
 assert.equal(state.personalCollectionMetricsAuthorized,false);
 assert.equal(state.nativeWriterAuthorized,false);
};

test('QR195-FIX-01 original source replay is separate from historical JSON verifier authority',async()=>{
 const cap=await verify();
 assert.equal(cap.status,'STATIC_ISVALID_REGISTRY_REPORT_INTEGRITY_ONLY');
 assert.equal(cap.reportIntegrity,'SHA256_VERIFIED');
 assert.equal(cap.evidenceTier,'DERIVED_JSON_ONLY');
 assert.equal(cap.originalMetadataAttested,false);
 assert.equal(cap.originalMethodSpecAttestedByVerifier,false);
 assert.equal(cap.metadataDigestRelationship,'DIFFERENT_UNRECONCILED_SOURCES');
 assert.equal(cap.historicalMetadataSha256,old.sourceSha256.globalMetadataV31);
 assert.notEqual(cap.originalRomfsMetadataSha256,cap.historicalMetadataSha256);
 assert.equal(cap.originalRomfsMetadataSha256,original.source.originalRomFsMetadata.sha256);
 assert.equal(original.scopeLimits.thisArtifactShaOnlyCannotAttestOriginalBytes,true);
 assert.equal(original.scopeLimits.previousD548SemanticClaimsOriginalAuthenticated,false);
 checkUnknown(cap);
});

test('QR195-FIX-02 arbitrary source manifest / fake original attestation cannot mint a verified capability',async()=>{
 const good=await verify();
 const foreign=[original,original.source,old,{...good,originalMetadataAttested:true},
  {status:good.status,evidenceTier:'ORIGINAL_VERIFIED',sourceSha256:good.sourceSha256},
  Object.create(good),new Proxy(good,{})];
 for(const cap of foreign){
  const got=inspectNativeIsValidRegistryBoundaryV125({verifiedSource:cap,identity:id,itemId:120000000});
  assert.equal(got.status,'BLOCKED');
  assert.equal(got.code,'VERIFIED_SOURCE_CAPABILITY_REQUIRED');
  assert.equal(got.nativeWriterAuthorized,false);
 }
 checkUnknown(good,120000000);
});

test('QR195-FIX-03 original raw replay claims do not bypass bytes, exact BID or historical report discrepancy',async()=>{
 const cap=await verify();
 const changed=Buffer.from(raw);
 changed[80]^=1;
 assert.equal((await verify(changed)).code,'SOURCE_SHA256_MISMATCH');
 for(const bad of [
  {...id,buildId:'9A239D3DB569756D'}, {...id,profileSchema:626},
  {...id,platform:'steam-windows'}, {...id,gameVersion:'1.25.3'}
 ]){
  assert.equal((await verify(raw,bad)).code,'EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  const probe=inspectNativeIsValidRegistryBoundaryV125({verifiedSource:cap,identity:bad,itemId:120000000});
  assert.equal(probe.status,'BLOCKED');
 }
 checkUnknown(cap);
});

test('QR195-FIX-04 source evidence keeps Pet/Figurine predicate-only without attested personal membership',()=>{
 assert.equal(original.scope.bid,'52BD625D9B4E0053');
 assert.equal(original.scope.profileSchema,624);
 assert.equal(original.source.originalRomFsMetadata.version,31);
 assert.equal(original.source.originalRomFsMetadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(original.source.historicalMethodSpecMetadata.status,'NEED_SOURCE');
 assert.equal(original.source.historicalMethodSpecMetadata.equivalenceToOriginalRomfsProven,false);
 assert.equal(original.scopeLimits.selectorPredicateOwnerReported,92);
 assert.equal(original.scopeLimits.selectorPredicateUnknown,164);
 assert.equal(original.scopeLimits.selectorPredicateQRAcceptedAgainstOriginal,false);
 assert.equal(pet.coverage.newPredicateProven,76);
 assert.equal(figurine.selectorOccurrences.length,16);
 assert.equal(original.concreteReplays.length,2);
 assert.deepEqual(original.concreteReplays.map(x=>x.name),['PetItemData','FigurineItemData']);
 assert.equal(pet.safety.predicateOnly,true);
 assert.equal(pet.safety.finalMembershipKnown,false);
 assert.equal(pet.safety.personalCollectionMetricsAuthorized,false);
});

test('QR195-FIX-05 a purported post-source-original verified object stays non-authoritative at each consumer boundary',async()=>{
 const cap=await verify();
 const amplified={...original.scopeLimits,source:original.source,
  originalMetadataAttested:true,verifiedSource:cap,originalMethodSpecAttestedByVerifier:true,
  nativeEligibility:true,finalMembershipKnown:true,denominator:224,collected:true,owned:true,
  nativeWriterAuthorized:true,presetApplyAuthorized:true,communityPublishingAuthorized:true};
 const probed=inspectNativeIsValidRegistryBoundaryV125({...amplified,identity:id,itemId:120000000});
 checkUnknown(cap,120000000);
 assert.equal(probed.nativeEligibility,'UNKNOWN');
 assert.equal(probed.denominator,null);
 assert.equal(probed.owned,'UNKNOWN');
 assert.equal(probed.collected,'UNKNOWN');
 assert.equal(probed.nativeWriterAuthorized,false);
 assert.equal(original.scopeLimits.nativeWriterAuthorized,false);
 assert.equal(original.scopeLimits.presetApplyAuthorized,false);
 assert.equal(original.scopeLimits.communityPublishingAuthorized,false);
 assert.equal(original.scopeLimits.personalMetricsAuthorized,false);
 assert.equal(original.scopeLimits.steamOrSchema626Transferred,false);
});

test('QR195-FIX-06 checked-in replay report is pinned data, never a self-sufficient proof of live source bytes',()=>{
 const src=readFileSync(base+'native-isvalid-original-romfs-replay-v125.json');
 const gitBlob=createHash('sha1').update(`blob ${src.length}\0`).update(src).digest('hex');
 assert.equal(gitBlob,'797df86edca77e4ef0b472fa6b6ba67f82b9d742');
 assert.equal(original.classification,'OWNER_ORIGINAL_BYTES_REPLAYED_INDEPENDENT_QR_PENDING_NOT_RUNTIME_ATTESTATION');
 assert.equal(original.scopeLimits.notABrowserOriginalMetadataVerificationCapability,true);
 assert.equal(original.scopeLimits.fullNativeCodeRegistrationMethodPointerMap,false);
 assert.equal(original.scopeLimits.realOwnerConsentedSaveReplay,false);
 assert.equal(original.scopeLimits.finalMembershipKnown,false);
 assert.equal(original.scopeLimits.denominator,null);
 assert.equal(original.scopeLimits.collected,'UNKNOWN');
 assert.equal(original.scopeLimits.owned,'UNKNOWN');
});
