import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-concrete-pet-selector-v125.json','utf8'));
const assertFailClosed=(x)=>{
 assert.equal(x.predicateOnly,true);
 assert.equal(x.nativeItemLookupRuntimeAccepted,false);
 assert.equal(x.finalMembershipKnown,false);
 assert.equal(x.denominator,null);
 assert.equal(x.collected,'UNKNOWN');
 assert.equal(x.owned,'UNKNOWN');
 assert.equal(x.personalCollectionMetricsAuthorized,false);
 assert.equal(x.nativeWriterAuthorized,false);
 assert.equal(x.presetApplyAuthorized,false);
 assert.equal(x.communityPublishingAuthorized,false);
 assert.equal(x.schema626SemanticsTransferred,false);
 assert.equal(x.steamSemanticsTransferred,false);
};

test('Source pins original Nintendo Switch 1.25.0 BID/schema/NSO/dump',()=>{
 assert.equal(source.schema,'ddv.collection-switch-v125-concrete-pet-selector-predicate@1');
 assert.deepEqual(source.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624});
 assert.equal(source.sourceSha256.originalNsoMain,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(source.sourceSha256.sameBuildDumpCs,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0');
 assert.equal(source.sourceSha256.canonicalZip,'6bc68479f75f621a6c5582bcf071b34e97886f2362c6dc26fe536fc026dee0c2');
});

test('Original retail global-metadata v31 SHA does NOT silently equal prior evidence digest',()=>{
 assert.equal(source.metadataSourceDifference.originalRomfsMagic,'0xFAB11BAF');
 assert.equal(source.metadataSourceDifference.version,31);
 assert.equal(source.sourceSha256.originalRomfsGlobalMetadataV31,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(source.sourceSha256.priorMethodIdentityMetadataClaim,'d5487eb7c2341d8fd245d4815cc55eae0c64f0822f4a55fa495fc0afcd1c2b08');
 assert.notEqual(source.sourceSha256.originalRomfsGlobalMetadataV31,source.sourceSha256.priorMethodIdentityMetadataClaim);
 assert.equal(source.metadataSourceDifference.originalVsPriorClaimShaEqual,false);
});

test('Pet interface table and virtual slot resolve native constant TRUE getter',()=>{
 const p=source.concretePet;
 assert.equal(p.typeDefIndex,9619);
 assert.equal(p.interfaceOffsetsStart,20458);
 assert.equal(p.collection.interfaceTypeDefIndex,10722);
 assert.equal(p.collection.interfaceOffset,26);
 assert.equal(p.collection.interfaceMethodSlot,1);
 assert.equal(p.collection.concreteVtableSlot,27);
 assert.equal(p.collection.encodedVtableMethod,'0x6002D223');
 assert.equal(p.collection.getterRva,'0x4835F20');
 assert.deepEqual(p.collection.opcodesLE,['20008052','c0035fd6']);
 assert.equal(p.collection.getterSha256,'5103ba3de080c52a046485f800433848701faa49ab8f60241a80987ca249d7ac');
 assert.equal(p.collection.result,true);
 assert.equal(p.variation.implemented,false);
 assert.equal(p.variation.interfaceOffsetEntryPresent,false);
 assert.equal(p.variation.byvalTypeIndex,'0x10127');
});

test('Pet IsNotable getter reads protobuf 8 / field 0x50; does not infer missing interface',()=>{
 const x=source.concretePet.notable;
 assert.equal(x.protobufField,8);
 assert.equal(x.wireType,0);
 assert.equal(x.instanceFieldOffset,'0x50');
 assert.equal(x.nativeGetterRva,'0x4832000');
 assert.equal(x.nativeGetterSha256,'eaa8f5bab95d1713110a3774aeaebf65c0af3605085769e01b2fdfa404ba8cfd');
 assert.deepEqual(x.opcodesLE,['00404139','c0035fd6']);
});

test('Pet selector native Pet=10 dispatch, delegate predicate and item/source bool match',()=>{
 const p=source.petSelector;
 assert.equal(p.oneofCase,'Pet=10');assert.equal(p.caseRva,'0x4BFCC28');
 assert.equal(p.enumerationRva,'0x4BFD690');
 assert.equal(p.predicateRva,'0x4C008C0');
 assert.equal(p.predicateSize,160);
 assert.equal(p.predicateSha256,'926a65c2e0ea6c454b4cb2cf0d22c08634754f195e5dd60955de393399794d1e');
 assert.equal(p.petFieldLoadRva,'0x4C008E0');
 assert.equal(p.oneofCompareRva,'0x4C00908');
 assert.equal(p.selectorFieldLoadRva,'0x4C00930');
 assert.equal(p.equalityRva,'0x4C0094C');
 assert.equal(p.selectorTypeDefIndex,10327);
 assert.equal(p.selectorProtobufField,1);
 assert.equal(p.selectorFieldOffset,'0x18');
 assert.equal(p.formula,'PetItemData.IsNotable === CollectionPet.IsNotable');
});

test('Only existing 2 Pet selectors are newly predicate-closed',()=>{
 assert.deepEqual(source.definitionSelectors.map(x=>[x.definitionId,x.selectorIsNotable,x.predicateCandidates]),[[2120000305,false,201],[2120000306,true,23]]);
 assert.ok(source.definitionSelectors.every(x=>x.ignore===false && x.explicitFiltersCount===0));
 const d=source.canonicalPetInputs;
 assert.equal(d.petItemsCount,224);
 assert.equal(d.field8ExplicitTrueCount,23);
 assert.equal(d.field8ExplicitFalseCount,0);
 assert.equal(d.field8AbsentCount,201);
 assert.equal(d.notableItemIds.length,23);
 assert.equal(new Set(d.notableItemIds).size,23);
 assert.ok(d.notableItemIds.every(x=>Number.isSafeInteger(x)&&x>0));
 assert.equal(source.coverage.oldPredicateProven,74);
 assert.equal(source.coverage.newPetProven,2);
 assert.equal(source.coverage.newPredicateProven,76);
 assert.equal(source.coverage.remainingUnknown,180);
 assert.deepEqual(source.coverage.remainingFamilies,{Furniture:63,Clothing:61,Crafting:28,BoardGameFigurine:16,ActivityItem:12,Pet:0});
});

test('Native matched Pet exemplar IDs never imply final membership or ownership',()=>{
 assert.deepEqual(source.exemplarPetItems.map(x=>[x.itemId,x.petNotable,x.animalsPredicate,x.notablePredicate]),[[120000000,true,false,true],[120000001,false,true,false]]);
 for(const v of source.exemplarPetItems){assert.equal(v.canBeCollected,true);assert.equal(v.variationInterfacePresent,false);}
 assertFailClosed(source.safety);
});

test('Fence protobuf field7 concrete native getter is correlated but not promoted as Collection eligibility',()=>{
 const f=source.concreteFenceField7CrossCheck;
 assert.equal(f.typeDefIndex,9118);
 assert.equal(f.iitemIsVariationOfInterfaceOffset,30);
 assert.equal(f.icollectionItemInterfaceOffset,33);
 assert.equal(f.variationVirtualSlot,30);
 assert.equal(f.getterRva,'0x456A800');
 assert.equal(f.getterSha256,'5a3dbf09a4e8bdcceec86da53e57e6eb7ac66ceb50eedbff297fa2d5d118a7be');
 assert.deepEqual(f.opcodesLE,['004840b9','c0035fd6']);
 assert.equal(f.protobufFieldNumber,7);
 assert.equal(f.instanceFieldOffset,'0x48');
 assert.deepEqual(f.example,{itemId:40700002,explicitParentId:40700000});
 assert.equal(f.nativeCanBeCollectedForExample,'UNKNOWN_NO_ELIGIBILITY_PROMOTION');
 assertFailClosed(source.safety);
});
