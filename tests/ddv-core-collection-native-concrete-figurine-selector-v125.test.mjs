import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const x=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-concrete-figurine-selector-v125.json','utf8'));
const selectors=x.selectorOccurrences;

test('Figurine proof is pinned to the original Nintendo Switch 1.25.0 build and original RomFS v31 digest',()=>{
  assert.equal(x.schema,'ddv.collection-native-figurine-predicate-v125@1');
  assert.deepEqual(x.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',bid:'52BD625D9B4E0053',saveSchema:624});
  assert.equal(x.originalSource.nso.sha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
  assert.equal(x.originalSource.dumpCs.sha256,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0');
  assert.equal(x.originalSource.originalRomfsMetadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
});

test('Original metadata provenance conflict is documented and not silently equated',()=>{
  assert.notEqual(x.originalSource.originalRomfsMetadata.sha256,x.originalSource.historicalMethodSpecMetadata.claimedSha256);
  assert.equal(x.originalSource.historicalMethodSpecMetadata.provenance,'UNKNOWN_NOT_EQUATED_OR_REUSED');
  assert.equal(x.concrete.metadataTypeDef.typeEntrySha256,'d43cdf72b2c6b32b739560f3fd10201abf983b325ca02d50922e4f985cb900dc');
  assert.equal(x.concrete.metadataInterfaceOffsets.entriesSha256,'03d2899ffb6d98855086d1f37835f105b61cc867ba9629b0cae7680783d9ea40');
});

test('Figurine concrete ICollectionItem method slot resolves to original native constant true getter',()=>{
 const c=x.concrete;
 assert.equal(c.typeDefIndex,9314);
 assert.equal(c.metadataVtable.start,90769);
 assert.equal(c.icollectionItem.interfaceTypeIndex,'0xFDA4');
 assert.equal(c.icollectionItem.interfaceOffsetSlot,32);
 assert.equal(c.icollectionItem.interfaceMethodSlot,1);
 assert.equal(c.icollectionItem.concreteVtableSlot,33);
 assert.equal(c.icollectionItem.encodedMethodRef,'0x6002AA91');
 assert.equal(c.icollectionItem.getterRva,'0x4685D50');
 assert.equal(c.icollectionItem.getterCodeHex,'20008052c0035fd6');
 assert.equal(c.icollectionItem.getterCodeSha256,'5103ba3de080c52a046485f800433848701faa49ab8f60241a80987ca249d7ac');
 assert.equal(c.icollectionItem.nativeMeaning,'CONSTANT_TRUE');
 assert.equal(c.iItemIsVariationOf.presentInConcreteInterfaceOffsetTable,false);
 assert.equal(c.iItemIsVariationOf.interfaceTypeIndex,'0x10127');
});

test('Figurine Tags source is native get_Tags at +0x70 and protobuf packed Field 13',()=>{
 const t=x.concrete.tags;
 assert.equal(t.protobufFieldNumber,13);
 assert.equal(t.rawWireType,2);
 assert.equal(t.packedRepeatedInt32,true);
 assert.equal(t.instanceFieldOffset,'0x70');
 assert.equal(t.getterRva,'0x4682110');
 assert.equal(t.getterCodeHex,'003840f9c0035fd6');
 assert.equal(t.getterCodeSha256,'36cc23bb70bc1c1b59cc307e6204dbafdeee922c2168929d194e21890ad85195');
 assert.equal(x.canonicalInputAudit.rawProtobufPackedField13MatchedNamedTags,35);
 assert.equal(x.canonicalInputAudit.concreteFigurineItems,35);
});

test('Same Native lambda checks BoardGameFigurine oneof case, Universe field and RepeatedField.Contains',()=>{
 const n=x.selectorNative;
 assert.equal(n.collectionItemTypeOneofFieldNumber,9);
 assert.equal(n.collectionItemTypeOneofCase,9);
 assert.equal(n.selectorTypeDefIndex,10357);
 assert.equal(n.selectorUniverseFieldNumber,1);
 assert.equal(n.selectorUniverseOneofCase,1);
 assert.equal(n.nativeSelectorGetterRva,'0x4BF0CF0');
 assert.equal(n.nativeLambdaRva,'0x4C007A0');
 assert.equal(n.nativeLambdaSize,288);
 assert.equal(n.nativeLambdaSha256,'c8ba88b1136efb1acbd74483b29d589af3b9d9d97a8544cf6920bf331472dcbc');
 assert.deepEqual(n.instructionEvidence.map(z=>z.rva),['0x4C007F4','0x4C0081C','0x4C00820','0x4C00844','0x4C00848','0x4C00874','0x4C00898','0x4C008A0']);
 assert.equal(n.nativePredicateForSixteenSelectors,'FigurineItemData.Tags.Contains(CollectionBoardGameFigurine.Universe)');
});

test('All sixteen source-matched Universe selectors are distinct and remain source-only',()=>{
 assert.equal(selectors.length,16);
 assert.ok(selectors.every(s=>s.selector==='BoardGameFigurine' && s.selectorOneof==='Universe=1' && s.ignore===false));
 assert.ok(selectors.every(s=>s.sourceMatchCount===s.sourceMatchItemIds.length&&s.sourceMatchCount>0));
 assert.equal(new Set(selectors.map(s=>s.definitionId)).size,16);
 assert.equal(new Set(selectors.map(s=>s.universe)).size,16);
 assert.equal(selectors.reduce((n,s)=>n+s.sourceMatchCount,0),35);
 assert.equal(new Set(selectors.flatMap(s=>s.sourceMatchItemIds)).size,35);
 assert.equal(x.canonicalInputAudit.sourceMatchTotal,35);
});

test('Positive and negative native predicate exemplars do not imply saved collection membership',()=>{
 const byId=new Map(selectors.map(s=>[s.definitionId,s]));
 for(const item of x.exemplars){
  assert.ok(byId.get(item.positiveSelectorId).sourceMatchItemIds.includes(item.itemId));
  assert.ok(!byId.get(item.negativeSelectorId).sourceMatchItemIds.includes(item.itemId));
  assert.ok(item.rawPackedTags.includes(byId.get(item.positiveSelectorId).universe));
  assert.ok(!item.rawPackedTags.includes(byId.get(item.negativeSelectorId).universe));
 }
 assert.equal(x.safety.finalMembershipKnown,false);
 assert.equal(x.safety.denominator,null);
});

test('Only sixteen selector predicates advance and all personal or writer capabilities remain fail-closed',()=>{
 const c=x.coverage;
 assert.equal(c.priorPredicateConfirmed,76);
 assert.equal(c.newConfirmed,16);
 assert.equal(c.updatedPredicateConfirmed,92);
 assert.equal(c.total,256);
 assert.equal(c.remainingUnknown,164);
 assert.deepEqual(c.unknownFamilyCounts,{Furniture:63,Clothing:61,Crafting:28,ActivityItem:12,BoardGameFigurine:0});
 const s=x.safety;
 for(const flag of ['runtimeRegistryLookupConfirmed','finalMembershipKnown','personalCollectionMetricsAuthorized','premiumEntitlementInferenceAuthorized','nativeWriterAuthorized','presetApplyAuthorized','communityPublishingAuthorized','schema626SemanticsTransferred','steamSemanticsTransferred'])assert.equal(s[flag],false);
 assert.equal(s.denominator,null);
 assert.equal(s.owned,'UNKNOWN');assert.equal(s.collected,'UNKNOWN');assert.equal(s.missing,'UNKNOWN');
});
