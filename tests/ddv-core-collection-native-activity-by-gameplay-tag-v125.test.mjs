import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-activity-by-gameplay-tag-v125.json','utf8'));
const definitions=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json','utf8')).records;
const byId=new Map(definitions.map(x=>[x[0],x]));
const cases=source.selectorOccurrences;

test('Activity native subfamily is original Switch v1.25.0 v31 only, historical d548 remains unknown',()=>{
 assert.deepEqual(source.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',bid:'52BD625D9B4E0053',profileSchema:624});
 assert.equal(source.originalSource.originalExeFsMain.sha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(source.originalSource.originalRomFsGlobalMetadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(source.originalSource.originalRomFsGlobalMetadata.bytes,36538728);
 assert.equal(source.originalSource.originalDumpCs.sha256,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0');
 assert.equal(source.originalSource.historicalUntracedMetadata.provenance,'NEED_SOURCE_NOT_EQUATED');
 assert.notEqual(source.originalSource.originalRomFsGlobalMetadata.sha256,source.originalSource.historicalUntracedMetadata.claimedSha256);
});

test('All four ByGameplayTag selector definitions use ActivityItem case6 and CollectionActivity inner case8',()=>{
 assert.equal(cases.length,4);
 assert.deepEqual(cases.map(x=>x.definitionId),[2120000015,2120000016,2120000017,2120000018]);
 assert.deepEqual(cases.map(x=>x.byGameplayTag),[2001200013,2001200014,2001200011,2001200012]);
 for(const x of cases){
  const r=byId.get(x.definitionId);
  assert.ok(r,x.definitionId.toString());
  const entry=r[5].filter(q=>q[0]==='ActivityItem');
  assert.equal(entry.length,1);
  assert.deepEqual(entry[0][1],{ByGameplayTag:x.byGameplayTag});
  assert.equal(entry[0][2],0);
  assert.equal(x.ignore,false);
  assert.equal(x.outerOneofCase,6);
  assert.equal(x.innerOneofCase,8);
 }
});

test('Original Native lambda calls HasTag, with distinct fallback, NOT raw-Tags-only predicate',()=>{
 const n=source.native;
 assert.equal(n.innerSelector.getterRva,'0x4BE6B30');
 assert.equal(n.lambda.rva,'0x4C00680');
 assert.equal(n.lambda.sha256,'283754ced925c3c116a54704d2093269ccb0348a5c4d4b8abab724865e0007e5');
 assert.equal(n.dispatch.innerCase8CompareRva,'0x4BFDF90');
 assert.equal(n.helper.method,'Definitions.Items.ItemDataExtensions.HasTag(IHasTags, Item)');
 assert.equal(n.helper.rva,'0x4CC92D0');
 assert.equal(n.helper.directContainsCall,'0x4CC93F8');
 assert.equal(n.helper.containsAdditionalFallback,true);
 assert.equal(n.helper.fallbackToItemDatabaseRva,'0x4CC9414');
 assert.match(n.importantCaveat,/does not prove a final negative/);
});

test('Crop/Ingredient original interfaceOffset and getter opcodes prove !IsMissionItem, no variation interface',()=>{
 assert.deepEqual(source.concreteItemData.map(x=>x.typeDefIndex),[9050,9674]);
 const got=new Map(source.concreteItemData.map(x=>[x.name,x]));
 const crop=got.get('CropItemData'),ingredient=got.get('IngredientItemData');
 for(const v of [crop,ingredient]){
   assert.equal(v.icollectionItemTypeIndex,64932);
   assert.equal(v.icollectionItemOffset,37);
   assert.equal(v.icollectionItemVtableSlot,38);
   assert.equal(v.variationInterfaceAbsent,true);
   assert.equal(v.ihasTagsInterfaceTypeIndex,65701);
   assert.equal(v.ihasTagsGetterSlot,32);
   assert.equal(v.defaultValue,false);
   assert.equal(v.canBeCollectedExpression,'!IsMissionItem');
   assert.equal(v.canBeCollectedGetterBytes.slice(8),'1f010071e0179f1ac0035fd6');
 }
 assert.equal(crop.icollectionGetterEncodedMethod,'0x60028969');
 assert.equal(crop.icollectionGetterMethodDef,83124);
 assert.equal(crop.canBeCollectedGetterRva,'0x44FEFD0');
 assert.equal(crop.tagsProtobufField,30);
 assert.equal(crop.isMissionItemProtobufField,20);
 assert.equal(crop.tagsBackingOffset,'0x70');
 assert.equal(ingredient.icollectionGetterEncodedMethod,'0x6002d9bd');
 assert.equal(ingredient.icollectionGetterMethodDef,93406);
 assert.equal(ingredient.canBeCollectedGetterRva,'0x48869F0');
 assert.equal(ingredient.tagsProtobufField,13);
 assert.equal(ingredient.isMissionItemProtobufField,11);
 assert.equal(ingredient.tagsBackingOffset,'0x68');
});

test('Raw protobuf source-positive examples include two concrete types; absent direct Tags is not a native-negative',()=>{
 assert.deepEqual(cases.map(x=>x.sourceDirectMatchCount),[41,39,23,12]);
 assert.equal(source.rawInputAudit.rowsChecked,348);
 assert.equal(source.rawInputAudit.positiveDirectTagCandidateOccurrences,115);
 assert.equal(source.rawInputAudit.allDirectPositiveCandidatesMissionFalse,true);
 assert.deepEqual(source.rawInputAudit.positiveTypeBreakdown,{CropItemData:113,IngredientItemData:2});
 assert.deepEqual(cases[1].sourceTypes,{CropItemData:37,IngredientItemData:2});
 assert.equal(cases[0].representativePositive,30200001);
 assert.equal(cases[1].representativePositive,31100072);
 assert.equal(cases[2].representativePositive,30200086);
 assert.equal(cases[3].representativePositive,30200003);
 for(const x of cases)assert.equal(x.sourceMatchType,'DIRECT_RAW_TAG_PATH_ONLY');
 assert.equal(source.safety.rawTagAbsenceIsFinalNegative,false);
});

test('Activity is a partial four-case advance; Crafting and remaining eight activity cases are deliberately UNKNOWN',()=>{
 assert.equal(source.compareScope.craftingRecipeHasICollectionItem,false);
 assert.match(source.compareScope.decision,/NOT_PROMOTED/);
 assert.deepEqual(source.coverage,{priorConfirmedPredicateOnly:92,newConfirmedPredicateOnly:4,updatedConfirmedPredicateOnly:96,totalSelectorOccurrences:256,remainingUnknown:160,unknownFamilyCounts:{Furniture:63,Clothing:61,Crafting:28,ActivityItem:8}});
 assert.equal(source.safety.independentQrAcceptance,false);
});

test('Native predicate proof does not permit live Item eligibility, Collection denominator, writers or cross-version transfer',()=>{
 const s=source.safety;
 assert.equal(s.runtimeEligibility,'UNKNOWN');
 assert.equal(s.finalMembershipKnown,false);
 assert.equal(s.denominator,null);
 assert.equal(s.owned,'UNKNOWN');assert.equal(s.collected,'UNKNOWN');assert.equal(s.missing,'UNKNOWN');
 for(const k of ['personalMetricsAuthorized','nativeSaveWriterAuthorized','presetApplyAuthorized','communityPublishingAuthorized','entitlementInferenceAuthorized','steamOrSchema626Transferred','rawTagAbsenceIsFinalNegative'])assert.equal(s[k],false,k);
});
