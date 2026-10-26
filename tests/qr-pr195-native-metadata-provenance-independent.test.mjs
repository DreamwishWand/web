import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifyNativeIsValidRegistryEvidenceV125, inspectNativeIsValidRegistryBoundaryV125 } from '../src/lib/ddv/core/collection/native-isvalid-registry-v125.js';

const originalSha='07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c';
const historicalSha='d5487eb7c2341d8fd245d4815cc55eae0c64f0822f4a55fa495fc0afcd1c2b08';
const mainSha='3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0';
const dumpSha='a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0';
const base='static/ddv/core/collection/v1.25/';
const oldBytes=readFileSync(base+'native-isvalid-registry-methodidentity-v125.json');
const originalClaimBytes=readFileSync(base+'native-concrete-pet-selector-v125.json');
const old=JSON.parse(oldBytes);
const pet=JSON.parse(originalClaimBytes);
const sha=b=>createHash('sha256').update(b).digest('hex');
const id={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
const uint=x=>Number(BigInt(x)&0x1fffffffn);

test('QR195-PROV-01 two metadata digests demonstrably disagree; both reports share stated NSO/dump identity, but no equivalent source witness',()=>{
  assert.notEqual(originalSha,historicalSha);
  assert.equal(pet.sourceSha256.originalRomfsGlobalMetadataV31,originalSha);
  assert.equal(pet.sourceSha256.priorMethodIdentityMetadataClaim,historicalSha);
  assert.equal(old.sourceSha256.globalMetadataV31,historicalSha);
  for(const x of [pet,old]) {
    assert.equal(x.sourceSha256.originalNsoMain,mainSha);
    assert.equal(x.sourceSha256.sameBuildDumpCs,dumpSha);
    assert.equal(x.scope.buildId,id.buildId);
    assert.equal(x.scope.profileSchema,id.profileSchema);
  }
  assert.equal(pet.metadataSourceDifference.version,31);
  assert.equal(pet.metadataSourceDifference.originalRomfsMagic,'0xFAB11BAF');
  assert.equal(pet.metadataSourceDifference.priorDigestProvenance,'UNKNOWN_DO_NOT_EQUATE');
  assert.equal(pet.metadataSourceDifference.originalVsPriorClaimShaEqual,false);
  assert.equal(oldBytes.length,5438); // source *report*, not native metadata bytes
  assert.equal(sha(oldBytes),'5f563d7c95bd365a779cb4531e9bdc4532102d87adbc7c0d049f8adbc68cabfb');
  console.log('QR195_METADATA_DIGEST_DIVERGENCE_REPRODUCED_NO_RAW_EQUIVALENCE',originalSha,historicalSha);
});

test('QR195-PROV-02 MethodSpec indices and address deltas are internally coherent only; native NSO refs do not independently attest metadata tables',()=>{
  const first=old.methodIdentity.first.genericArgument, second=old.methodIdentity.second.genericArgument;
  const decodeRef=v=>uint(v)>>1;
  assert.equal(decodeRef(first.encodedMethodRef),first.methodSpecIndex);
  assert.equal(decodeRef(second.encodedMethodRef),second.methodSpecIndex);
  assert.equal(first.methodSpecIndex,98945);
  assert.equal(second.methodSpecIndex,98963);
  assert.equal(second.methodSpecIndex-first.methodSpecIndex,18);
  assert.equal(Number(BigInt(second.methodSpecAddress)-BigInt(first.methodSpecAddress)),18*12);
  assert.equal(first.genericMethodDefIndex,second.genericMethodDefIndex);
  assert.equal(first.genericMethodDefIndex,103729);
  assert.equal(first.genericArgTypeDefIndex,10722);
  assert.equal(second.genericArgTypeDefIndex,10720);
  assert.equal(old.methodIdentity.first.interfaceTypeInfo.typeDefIndex,10722);
  assert.equal(old.methodIdentity.second.interfaceTypeInfo.typeDefIndex,10720);
  assert.equal(old.methodIdentity.staticCompareItemTypeInfo.typeDefIndex,10554);
  // The arithmetic checks do NOT recompute original 07e... MethodSpec/TypeDef tables.
  assert.notEqual(old.sourceSha256.globalMetadataV31,originalSha);
});

test('QR195-PROV-03 Pet and Fence 8-byte native opcodes reproduce their reported slice SHA, not original metadata-dependent VTable mapping',()=>{
  const a=pet.concretePet.collection;
  const b=pet.concretePet.notable;
  const c=pet.concreteFenceField7CrossCheck;
  for(const [x,digest] of [[a,a.getterSha256],[b,b.nativeGetterSha256],[c,c.getterSha256]]) {
    assert.equal(x.getterSize??x.nativeGetterSize,8);
    assert.equal(sha(Buffer.from(x.opcodesLE.join(''),'hex')),digest);
  }
  assert.equal(a.getterRva,'0x4835F20');
  assert.equal(a.collectionTypeDefIndex,undefined);
  assert.equal(pet.concretePet.typeDefIndex,9619);
  assert.equal(a.interfaceTypeDefIndex,10722);
  assert.equal(a.interfaceOffset+a.interfaceMethodSlot,a.concreteVtableSlot);
  assert.equal(a.concreteVtableSlot,27);
  assert.equal(pet.concretePet.variation.implemented,false);
  assert.equal(b.nativeGetterRva,'0x4832000');
  assert.equal(c.getterRva,'0x456A800');
  assert.equal(pet.petSelector.predicateSha256,'926a65c2e0ea6c454b4cb2cf0d22c08634754f195e5dd60955de393399794d1e');
  // Raw original NSO, original metadata and disassembler trace are not attached to these checked-in reports.
  console.log('QR195_PET_OPCODE_SLICE_REPORT_SELF_CONSISTENT_ORIGINAL_BINARY_REPLAY_BLOCKED');
});

test('QR195-PROV-04 witnessed provenance trust promotion: historical JSON rehash validates even though original RomFS SHA differs; consumer remains deny-only',async()=>{
  const sourceHandle=await verifyNativeIsValidRegistryEvidenceV125(oldBytes,id);
  assert.equal(sourceHandle.status,'STATIC_ISVALID_REGISTRY_SEMANTICS_VERIFIED');
  assert.equal(sourceHandle.sourceSha256,sha(oldBytes));
  assert.equal(old.sourceSha256.globalMetadataV31,historicalSha);
  assert.notEqual(historicalSha,originalSha);
  const x=inspectNativeIsValidRegistryBoundaryV125({verifiedSource:sourceHandle,identity:id,itemId:120000000});
  assert.equal(x.status,'STATIC_SEMANTIC_PREDICATE_ONLY');
  assert.equal(x.firstLookupRuntime,'UNKNOWN');
  assert.equal(x.secondLookupRuntime,'UNKNOWN');
  assert.equal(x.nativeEligibility,'UNKNOWN');
  assert.equal(x.finalMembershipKnown,false);
  assert.equal(x.collected,'UNKNOWN');
  assert.equal(x.owned,'UNKNOWN');
  assert.equal(x.denominator,null);
  assert.equal(x.personalCollectionMetricsAuthorized,false);
  assert.equal(x.nativeWriterAuthorized,false);
  const malicious={...id,gameVersion:'1.25.3',profileSchema:626};
  assert.equal((await verifyNativeIsValidRegistryEvidenceV125(oldBytes,malicious)).status,'BLOCKED');
  assert.equal(pet.safety.finalMembershipKnown,false);
  assert.equal(pet.safety.personalCollectionMetricsAuthorized,false);
  assert.equal(pet.safety.nativeWriterAuthorized,false);
  assert.equal(pet.safety.communityPublishingAuthorized,false);
  console.log('QR195_PROVENANCE_VERIFIER_REPORT_NOT_ORIGINAL_METADATA_RED__PERSONAL_METRICS_FAIL_CLOSED_PASS');
});
