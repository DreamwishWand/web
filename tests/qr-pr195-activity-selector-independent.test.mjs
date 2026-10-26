import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const base='static/ddv/core/collection/v1.25/';
const evidence=JSON.parse(readFileSync(base+'native-activity-by-gameplay-tag-v125.json'));
const compact=JSON.parse(readFileSync(base+'collection-definition-source-compact-v125.json'));
const original=JSON.parse(readFileSync(base+'native-isvalid-original-romfs-replay-v125.json'));
const definitions=new Map(compact.records.map(r=>[r[0],r]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('QR200-01 exactly four distinct original definition selector coordinates; no inherited group ID auto-count',()=>{
 const ids=[2120000015,2120000016,2120000017,2120000018];
 const tags=[2001200013,2001200014,2001200011,2001200012];
 assert.deepEqual(evidence.selectorOccurrences.map(x=>x.definitionId),ids);
 const seen=new Set();
 for(const [i,id] of ids.entries()){
  const r=definitions.get(id);assert.ok(r);
  const [category,rule,ignore]=r[5][0];
  assert.equal(r[5].length,1);
  assert.equal(category,'ActivityItem');
  assert.deepEqual(rule,{ByGameplayTag:tags[i]});
  assert.equal(ignore,0);
  assert.equal(evidence.selectorOccurrences[i].byGameplayTag,tags[i]);
  assert.equal(seen.has(id),false);seen.add(id);
 }
 assert.equal(seen.size,4);
 assert.equal(evidence.native.outerSelector.case,6);
 assert.equal(evidence.native.innerSelector.case,8);
 assert.notEqual(evidence.native.innerSelector.case,evidence.native.outerSelector.case);
});

test('QR200-02 predicate identity SHA and branch guard positions are explicitly source-only, not fabricated membership',()=>{
 assert.equal(evidence.originalSource.originalRomFsGlobalMetadata.sha256,original.source.originalRomFsMetadata.sha256);
 assert.equal(evidence.originalSource.originalExeFsMain.sha256,original.source.originalExeFsMain.sha256);
 assert.equal(evidence.originalSource.originalDumpCs.sha256,original.source.il2cppDumperCs.sha256);
 assert.equal(evidence.originalSource.historicalUntracedMetadata.provenance,'NEED_SOURCE_NOT_EQUATED');
 assert.equal(evidence.native.lambda.rva,'0x4C00680');
 assert.equal(evidence.native.lambda.sha256,'283754ced925c3c116a54704d2093269ccb0348a5c4d4b8abab724865e0007e5');
 assert.equal(evidence.native.helper.rva,'0x4CC92D0');
 assert.equal(evidence.native.helper.sha256,'8da02b30c4d1fa6c0cb133663892e7df9e58f3d1f9278dfdb363004c3f80f3c1');
 assert.equal(evidence.native.helper.directContainsCallee,'0x39349D0');
 assert.equal(evidence.native.helper.containsAdditionalFallback,true);
 assert.equal(evidence.native.helper.fallbackToItemDatabaseRva,'0x4CC9414');
 assert.match(evidence.native.importantCaveat,/negative raw Tags lookup does not prove a final negative/);
 assert.equal(evidence.safety.rawTagAbsenceIsFinalNegative,false);
});

test('QR200-03 two concrete native getter contracts are scoped to their own TypeDef/offsets',()=>{
 const [crop,ingredient]=evidence.concreteItemData;
 assert.deepEqual([crop.typeDefIndex,ingredient.typeDefIndex],[9050,9674]);
 for(const item of [crop,ingredient]){
  assert.equal(item.icollectionItemTypeIndex,64932);
  assert.equal(item.icollectionItemOffset,37);
  assert.equal(item.icollectionItemMethodSlot,1);
  assert.equal(item.icollectionItemVtableSlot,38);
  assert.equal(item.ihasTagsInterfaceTypeIndex,65701);
  assert.equal(item.ihasTagsInterfaceOffset,31);
  assert.equal(item.ihasTagsGetterSlot,32);
  assert.equal(item.variationInterfaceAbsent,true);
  assert.equal(item.canBeCollectedExpression,'!IsMissionItem');
  assert.equal(item.defaultValue,false);
  assert.equal(sha(Buffer.from(item.canBeCollectedGetterBytes,'hex')),item.canBeCollectedGetterSha256);
  assert.equal(sha(Buffer.from(item.tagsGetterBytes,'hex')),item.tagsGetterSha256);
 }
 assert.equal(crop.tagsProtobufField,30); assert.equal(crop.isMissionItemProtobufField,20);
 assert.equal(ingredient.tagsProtobufField,13); assert.equal(ingredient.isMissionItemProtobufField,11);
 assert.notEqual(crop.icollectionGetterEncodedMethod,ingredient.icollectionGetterEncodedMethod);
 assert.notEqual(crop.tagsGetterRva,ingredient.tagsGetterRva);
});

test('QR200-04 source raw candidate-positive counts are explicitly unaccepted until independent item raw payloads; negative exemplars are NOT final false',()=>{
 const counts=evidence.selectorOccurrences.map(r=>r.sourceDirectMatchCount);
 assert.deepEqual(counts,[41,39,23,12]);
 assert.equal(counts.reduce((a,b)=>a+b,0),115);
 assert.equal(evidence.rawInputAudit.rowsChecked,348);
 assert.equal(evidence.rawInputAudit.positiveDirectTagCandidateOccurrences,115);
 assert.deepEqual(evidence.rawInputAudit.positiveTypeBreakdown,{CropItemData:113,IngredientItemData:2});
 const directPos=new Set(evidence.selectorOccurrences.map(x=>x.representativePositive));
 const directAbsence=new Set(evidence.selectorOccurrences.map(x=>x.representativeNegativeDirectTagOnly));
 assert.equal(directPos.size,4);
 assert.ok(directAbsence.size>=2);
 for(const row of evidence.selectorOccurrences){
  assert.equal(row.sourceMatchType,'DIRECT_RAW_TAG_PATH_ONLY');
  assert.equal(row.predicateStatus,'CONFIRMED_SAME_BUILD_NATIVE_PREDICATE_ONLY');
 }
 // Actual raw ItemData protobuf payload is NOT in this repo; these are source-report coordinates,
 // not independent item-level positive/negative proofs or a personal denominator.
 assert.equal(evidence.safety.finalMembershipKnown,false);
 assert.equal(evidence.safety.rawTagAbsenceIsFinalNegative,false);
});

test('QR200-05 deliberately partial family arithmetic plus fail-closed data path',()=>{
 const {coverage:c,safety:s}=evidence;
 assert.equal(c.priorConfirmedPredicateOnly,92);
 assert.equal(c.newConfirmedPredicateOnly,4);
 assert.equal(c.updatedConfirmedPredicateOnly,96);
 assert.equal(c.totalSelectorOccurrences,256);
 assert.equal(c.remainingUnknown,160);
 assert.deepEqual(c.unknownFamilyCounts,{Furniture:63,Clothing:61,Crafting:28,ActivityItem:8});
 assert.equal(Object.values(c.unknownFamilyCounts).reduce((a,b)=>a+b,0),160);
 assert.equal(c.updatedConfirmedPredicateOnly+c.remainingUnknown,c.totalSelectorOccurrences);
 assert.equal(evidence.compareScope.craftingRecipeHasICollectionItem,false);
 assert.match(evidence.compareScope.decision,/NOT_PROMOTED/);
 assert.equal(s.independentQrAcceptance,false);
 assert.equal(s.runtimeEligibility,'UNKNOWN');
 assert.equal(s.finalMembershipKnown,false);
 assert.equal(s.denominator,null);
 assert.equal(s.owned,'UNKNOWN');
 assert.equal(s.collected,'UNKNOWN');
 assert.equal(s.missing,'UNKNOWN');
 for(const k of ['personalMetricsAuthorized','nativeSaveWriterAuthorized','presetApplyAuthorized','communityPublishingAuthorized','entitlementInferenceAuthorized','steamOrSchema626Transferred'])assert.equal(s[k],false,k);
});
