import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root='static/ddv/core/collection/v1.25/';
const n=JSON.parse(readFileSync(root+'native-universe-124-original-native-v125.json','utf8'));
const source=JSON.parse(readFileSync(root+'native-universe-source-candidate-124-v125.json','utf8'));

test('124 original Native predicate closures retain strict Switch1250 identity and exact five-source boundaries',()=>{
 assert.deepEqual(n.scope,{platform:'Nintendo Switch',version:'1.25.0',bid:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(n.originalSource.exeFsMain.sha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(n.originalSource.metadataV31.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(n.originalSource.dumpCs.sha256,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0');
 assert.equal(n.originalSource.losslessItemDb.sha256,source.originalSource.losslessGzipSha256);
 assert.equal(n.originalSource.supportTables.sha256,source.originalSource.supportGzipSha256);
 assert.equal(n.originalSource.historicalMetadataD548,'NEED_SOURCE_NOT_EQUIVALENT_TO_V31');
});

test('original GetItemData generic MethodSpec maps to SetItemData and not wrong concrete/list/unknown type',()=>{
 const x=n.originalNative.commonSetLookup;
 assert.equal(x.encodedUsageRva,'0xB1EFA70');
 assert.equal(x.encodedUsageValue,'0xC00304A7');
 assert.equal(x.methodSpecIndex,98899);
 assert.equal(x.methodSpecHex,'2f950100ffffffff35230000');
 assert.equal(x.methodDefIndex,103727);
 assert.equal(x.genericInstantiationIndex,9013);
 assert.equal(x.typeRawHex,'c0250000000000000000120000000000');
 assert.equal(x.typeDefIndex,9664);
 assert.equal(x.typeName,'SetItemData');
 assert.equal(x.setTagsFieldNumber,6);
 assert.equal(x.setTagsOffset,'0x40');
 assert.equal(x.nullSetItemData,'SKIP');
});

test('Clothing case4/Universe case2 and Furniture case3/Universe case2 preserve distinct generic provenance',()=>{
 const {clothing:c,furniture:f}=n.originalNative;
 assert.deepEqual([c.outerOneofCase,c.innerOneofCase,c.concreteTypeDef,c.itemType,c.getAllMethodSpecIndex,c.genericInstIndex,c.setItemIdOffset],[4,2,9204,5,98706,8166,'0x48']);
 assert.deepEqual([f.outerOneofCase,f.innerOneofCase,f.concreteTypeDef,f.itemType,f.getAllMethodSpecIndex,f.genericInstIndex,f.setItemIdOffset],[3,2,9078,4,98722,8574,'0x4C']);
 assert.equal(c.getAllMethodDefIndex,103721);assert.equal(f.getAllMethodDefIndex,103721);
 assert.equal(c.setItemIdField,8);assert.equal(f.setItemIdField,8);
 assert.equal(c.idOffset,'0x18');assert.equal(f.idOffset,'0x18');
 assert.notEqual(c.dispatchSha256,f.dispatchSha256);
 assert.notEqual(c.loopSha256,f.loopSha256);
 assert.equal(c.setLookupCallRva,'0x4BFC664');
 assert.equal(f.setLookupCallRva,'0x4BFCF78');
 assert.equal(c.containsCallRva,'0x4BFC71C');
 assert.equal(f.containsCallRva,'0x4BFD02C');
 assert.equal(c.addResultRva,'0x4BFC77C');
 assert.equal(f.addResultRva,'0x4BFD08C');
});

test('Selector-stage call chain closes only Set.Tags.Contains(original Universe int32) and yields original ID',()=>{
 assert.equal(n.originalNative.commonContains.collectionUniverseProtoFieldNumber,2);
 assert.equal(n.originalNative.commonContains.nativeCallTarget,'0x39349D0');
 assert.match(n.selectorPredicate,/GetItemData<SetItemData>/);
 assert.match(n.selectorPredicate,/IsValidItemForCollection \/ Group Ignore/);
 assert.equal(n.originalNative.clothing.typeSpecificWhere,'NONE_IN_THIS_UNIVERSE_ARM');
 assert.equal(n.originalNative.furniture.typeSpecificWhere,'NONE_IN_THIS_UNIVERSE_ARM');
 for(const arm of [n.originalNative.clothing,n.originalNative.furniture]){
  assert.match(arm.dispatchSha256,/^[a-f0-9]{64}$/);
  assert.match(arm.loopSha256,/^[a-f0-9]{64}$/);
  assert.match(arm.predicateSha256,/^[a-f0-9]{64}$/);
 }
});

test('all 124 distinct original selector occurrences have family-specific arguments without deduplicating IDs',()=>{
 assert.equal(n.entries.length,124);
 const key=x=>[x.definitionId,x.family,Number(x.universeTag??x.selectorUniverseTag)].join('/');
 assert.deepEqual(n.entries.map(key).sort(),source.entries.map(key).sort());
 assert.equal(n.entries.filter(e=>e.family==='Clothing').length,61);
 assert.equal(n.entries.filter(e=>e.family==='Furniture').length,63);
 for(const e of n.entries){
  assert.equal(e.outerCase,e.family==='Clothing'?4:3);
  assert.equal(e.innerCase,2);
  assert.ok(Number.isInteger(e.universeTag));
  assert.equal(e.selectorStatus,'OWNER_SAME_BUILD_NATIVE_PREDICATE_STATIC_CONFIRMED__QR_PENDING');
  assert.equal(e.sourceCandidateCountNotFinalMembership,true);
  assert.equal(e.originalIgnore,'ByType Ignore absent/default false; separate ByItem and unrelated ByType groups remain independent');
 }
 const total=f=>n.entries.filter(e=>e.family===f).reduce((s,e)=>s+e.sourceCandidateCount,0);
 assert.equal(total('Clothing'),1900);assert.equal(total('Furniture'),4004);
});

test('five source-empty Universe cases remain runtime UNKNOWN and are not denominators',()=>{
 assert.deepEqual(n.entries.filter(e=>e.sourceCandidateCount===0).map(e=>[e.definitionId,e.family,e.universeTag]),[
 [2120000162,'Clothing',2000500047],[2120000367,'Clothing',2000500069],
 [2120000248,'Furniture',2000500062],[2120000254,'Furniture',2000500066],
 [2120000368,'Furniture',2000500069]]);
 assert.equal(n.originalTypedInputScope.sourceEmptySelectorOccurrenceCount,5);
 assert.equal(n.originalTypedInputScope.sourceOnlyCandidateCountsNotRuntime,true);
});

test('Owner 132+124 is distinct from QR103; no premature acceptance or release',()=>{
 assert.equal(n.coverage.previousOwnerStatic,132);
 assert.equal(n.coverage.newOwnerStatic,124);
 assert.equal(n.coverage.ownerStatic,256);
 assert.equal(n.coverage.totalTypedSelectors,256);
 assert.equal(n.coverage.remainingOwnerStaticUnknown,0);
 assert.equal(n.coverage.independentQrLastVerified,103);
 assert.equal(n.coverage.independentQrPendingFromPrior,29);
 assert.equal(n.coverage.independentQrNewPending,124);
 assert.equal(n.coverage.independentQrPendingTotal,153);
 assert.equal(n.coverage.unpromotedFinalMembership,true);
});

test('fail-closed: no personal, writer, entitlement, publish, schema626, or Steam promotion',()=>{
 const s=n.safety;assert.equal(s.denominator,null);
 for(const k of ['owned','collected','missing'])assert.equal(s[k],'UNKNOWN');
 for(const k of ['personalMetrics','nativeWriter','presetApply','communityPublisher','entitlementEditing','switch1253SemanticTransfer','steamSemanticTransfer'])assert.equal(s[k],false,k);
 assert.equal(s.draftOnly,true);assert.equal(s.doNotMerge,true);assert.equal(s.doNotDeploy,true);
});
