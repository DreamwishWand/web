import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root='static/ddv/core/collection/v1.25/';
const now=JSON.parse(readFileSync(root+'native-meal-getter-ingredient-selector-original-v125.json','utf8'));
const before=JSON.parse(readFileSync(root+'native-activity-meal-original-predicate-v125.json','utf8'));
const compact=JSON.parse(readFileSync(root+'collection-definition-source-compact-v125.json','utf8')).records;

test('QR204 only +1 Ingredient selector beyond QR203 and prior Meal Where remains accepted',()=>{
 assert.equal(before.coverage.nowStaticPredicate,100);
 assert.equal(now.coverage.previousSelectorsStatic,100);
 assert.equal(now.coverage.newSelectorStatic,1);
 assert.equal(now.coverage.currentSelectorsStatic,101);
 assert.equal(now.coverage.totalSelectors,256);
 assert.equal(now.coverage.remainingUnknown,155);
 assert.deepEqual(now.coverage.unresolvedByFamily,{ActivityItem:3,Crafting:28,Clothing:61,Furniture:63});
 assert.deepEqual(now.coverage.remainingActivityTypes,['Fish','Mineral subtype16','CraftingMaterial']);
 assert.deepEqual(now.mealGetterClosure.selectorIDs,[2120000022,2120000032,2120000111]);
 assert.equal(now.mealGetterClosure.doesNotReplaceAcceptedMealWhere,true);
});

test('QR204 full getter condition is Mission false AND not original MealItemData.RubbishItem',()=>{
 const m=now.mealGetterClosure;
 assert.equal(m.cctor.secondStaticField.value,30300494);
 assert.equal(m.cctor.secondStaticField.symbol,'MealItemData.RubbishItem');
 assert.equal(m.cctor.secondStaticField.offset,'0x14');
 assert.equal(m.cctor.firstStaticField.value,2001500005);
 assert.equal(m.cctor.firstStaticField.offset,'0x10');
 assert.notEqual(m.cctor.firstStaticField.value,m.cctor.secondStaticField.value);
 assert.equal(m.getter.staticTypeUsage.slotRva,m.cctor.sharedMealTypeInfoUsageRva);
 assert.equal(m.getter.comparatorRead.instruction,'ldr w8,[x21,#0x14]');
 assert.equal(m.getter.result.instruction,'cset w0,ne');
 assert.equal(m.resolvedRubbishItemId,30300494);
 assert.equal(m.exactStaticGetterExpression,'!meal.IsMissionItem && meal.ID != MealItemData.RubbishItem');
 assert.equal(m.cctor.runtimeInitializationObserved,false);
 assert.equal(m.cctor.runtimeInitializationResult,'UNKNOWN');
 assert.deepEqual(m.rawSourceCounts,{totalMealItemData:578,missionTrue:92,nonMission:486,nonMissionRubbishId:1,getterStaticTrue:485,getterStaticFalse:93,notRuntimeMembership:true});
});

test('QR204 original source Meal examples include both disjoint negative routes',()=>{
 const m=now.mealGetterClosure;
 const input=new Map(m.examples.map(e=>[e.id,e]));
 for(const [id,selector] of [[30300001,2120000022],[30300010,2120000032],[30300009,2120000111]]){
  const e=input.get(id);assert.equal(e.selectorOnly,selector);assert.equal(e.getterStatic,true);
 }
 assert.equal(input.get(30300119).missionField12Wire,'6001');
 assert.equal(input.get(30300119).getterStatic,false);
 assert.equal(input.get(30300494).name,'GenericSlop');
 assert.equal(input.get(30300494).missionDefault,false);
 assert.equal(input.get(30300494).getterStatic,false);
 assert.equal(input.get(30300494).sourceRawSha256,m.originalTypedRubbish.rawPayloadSha256);
});

test('QR204 only Ingredient case5 matches source and keeps independent ByItem ID',()=>{
 const x=now.ingredientNewSelector,d=x.rawDefinition;
 assert.equal(x.definitionId,2120000023);assert.equal(x.outerCase,6);assert.equal(x.innerCase,5);
 assert.equal(d.bytes,137);
 assert.equal(d.sha256,'eefeb1cb3fbe31899d82829fd7bc92d49584e4bbf44c121e64c4b394729c5a30');
 assert.equal(d.ingredientSelectorValue,2001400001);
 assert.equal(d.byTypeIgnoreFieldPresent,false);
 assert.equal(d.byItemSeparateExplicitId,30200200);
 const row=compact.find(z=>z[0]===x.definitionId);
 assert.ok(row);assert.equal(row[2],d.sha256);
 assert.deepEqual(row[5].filter(z=>z[0]==='ActivityItem'),[['ActivityItem',{Ingredient:2001400001},0]]);
 assert.equal(x.native.methodSpecIndex,98732);
 assert.equal(x.native.concreteTypeDef,9674);
 assert.equal(x.native.lambdaSha256,'3606e397fb2d5d0ca19a12fe3006fb3d4e45844ddec3c0a937617b6d4254e312');
 assert.equal(x.native.exactSelectorExpression,'GetAllByType<IngredientItemData>(ItemType3).Where(i => i.CookingIngredientType == selector.Activity.Ingredient).Select(i => i.ID)');
 assert.equal(x.native.commonIsValidSeparate,true);
});

test('QR204 Ingredient typed source match is three, Egg is negative even with getter true',()=>{
 const a=now.ingredientNewSelector.originalIngredientTypedSource;
 assert.equal(a.totalRecords,196);
 assert.equal(a.directCookingTypeValue2001400001,3);
 assert.deepEqual(a.examples.filter(x=>x.predicateMatch).map(x=>x.id),[31100030,31100031,31100032]);
 const egg=a.examples.find(x=>x.id===31100000);
 assert.equal(egg.predicateMatch,false);
 assert.equal(egg.staticGetter,true);
 for(const a0 of a.examples)assert.equal(a0.missionField11Absent,true);
 assert.equal(a.sourceRowsNotNativeCollectionDenominator,true);
});

test('QR204 source and runtime permissions remain fail-closed and version-pinned',()=>{
 assert.deepEqual(now.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',bid:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(now.sources.historicalD548.rawSource,'NEED_SOURCE');
 assert.equal(now.sources.historicalD548.equatedToOriginal,false);
 const s=now.safety;assert.equal(s.runtimeEligibility,'UNKNOWN');assert.equal(s.denominator,null);
 for(const k of ['ownerStatus','collectedStatus','missingStatus'])assert.equal(s[k],'UNKNOWN');
 for(const k of ['finalMembershipKnown','personalPercentageEnabled','nativeWriterEnabled','presetApplyEnabled','communityPublishingEnabled','entitlementEditingEnabled','switch1253OrSteamTransferred','independentQrAccepted'])assert.equal(s[k],false);
});
