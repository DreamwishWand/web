import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const e=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-meal-getter-ingredient-selector-original-v125.json','utf8'));
const compact=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json','utf8')).records;
function varint(b,p){let v=0,shift=0;for(;;){assert.ok(p<b.length);const x=b[p++];v+=(x&127)*2**shift;if(x<128)return [v,p];shift+=7;assert.ok(shift<=56);}}
function parse(b){let p=0,r=[];while(p<b.length){let k;[k,p]=varint(b,p);let n=k>>>3,w=k&7,v;if(w===0){[v,p]=varint(b,p)}else if(w===2){let l;[l,p]=varint(b,p);assert.ok(p+l<=b.length);v=b.subarray(p,p+l);p+=l;}else throw Error('wire type '+w);r.push({n,w,v});}return r;}
const field=(b,n)=>parse(b).filter(x=>x.n===n);
const one=(b,n)=>{const z=field(b,n);assert.equal(z.length,1);return z[0];};
const hex=h=>Buffer.from(h,'hex');

test('All evidence pins only original v1.25.0 build/metadata and keeps d548 untraced',()=>{
 assert.deepEqual(e.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',bid:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(e.sources.originalNso.sha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(e.sources.originalMetadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(e.sources.sameBuildDump.sha256,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0');
 assert.equal(e.sources.losslessItemDB.sha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(e.sources.supportTables.sha256,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(e.sources.historicalD548.rawSource,'NEED_SOURCE');assert.equal(e.sources.historicalD548.equatedToOriginal,false);
});
test('Meal original full function and class cctor prove RubbishItem = 30300494, not guessed Item.Invalid',()=>{
 const m=e.mealGetterClosure;const g=m.getter,c=m.cctor;
 assert.equal(g.sha256,'913fbf182330f29304f52dd8fe5a7278776cad6ab3afc1d64bf046c8bf94ff30');
 assert.equal(g.bytes,400);assert.equal(g.nonMissionIDLoad.rva,'0x487E194');
 assert.equal(g.comparatorRead.rva,'0x487E1E0');assert.equal(g.compare.instruction,'cmp w19,w8');assert.equal(g.result.instruction,'cset w0,ne');
 assert.equal(g.staticTypeUsage.slotRva,c.sharedMealTypeInfoUsageRva);
 assert.equal(g.staticTypeUsage.slotRva,'0xB13BB18');
 assert.equal(c.rva,'0x4881250');assert.equal(c.bytes,1104);
 assert.equal(c.sha256,'7cad2e9c735d8a55cd73e877a967b04b197de30c8db6bf452926c08f080a0f76');
 assert.equal(c.firstStaticField.symbol,'MealItemData.MealQuestType');
 assert.equal(c.firstStaticField.value,2001500005);
 assert.equal(c.secondStaticField.symbol,'MealItemData.RubbishItem');assert.equal(c.secondStaticField.offset,'0x14');
 assert.equal(c.secondStaticField.value,30300494);assert.equal(c.secondStaticField.storeAt,'0x4881510');
 assert.equal(m.exactStaticGetterExpression,'!meal.IsMissionItem && meal.ID != MealItemData.RubbishItem');
 assert.equal(m.originalTypedRubbish.name,'GenericSlop');
 assert.equal(m.originalTypedRubbish.rawPayloadSha256,'387b04bcbe4eeb638e5fe1492d0d589cffc101b68d279f19ce1a895051f83a6a');
});
test('Meal typed original examples and static counts respect selector-stage versus getter-stage',()=>{
 const m=e.mealGetterClosure;assert.equal(m.rawSourceCounts.totalMealItemData,578);
 assert.equal(m.rawSourceCounts.missionTrue,92);assert.equal(m.rawSourceCounts.nonMission,486);
 assert.equal(m.rawSourceCounts.getterStaticTrue,485);assert.equal(m.rawSourceCounts.getterStaticFalse,93);
 const byId=new Map(m.examples.map(z=>[z.id,z]));
 for(const [id,selector] of [[30300001,2120000022],[30300010,2120000032],[30300009,2120000111]]){
  const r=byId.get(id);assert.equal(r.selectorOnly,selector);assert.equal(r.getterStatic,true);
 }
 assert.equal(byId.get(30300119).missionField12Wire,'6001');
 assert.equal(byId.get(30300119).getterStatic,false);
 assert.equal(byId.get(30300494).missionDefault,false);
 assert.equal(byId.get(30300494).getterStatic,false);
 assert.equal(m.doesNotReplaceAcceptedMealWhere,true);
});
test('Ingredient exact original row encodes Activity case6, Ingredient case5, enum and independent ByItem group',()=>{
 const x=e.ingredientNewSelector,d=x.rawDefinition;
 assert.equal(x.definitionId,2120000023);assert.equal(x.innerCase,5);assert.equal(x.outerCase,6);
 assert.equal(d.bytes,137);
 assert.equal(d.sha256,'eefeb1cb3fbe31899d82829fd7bc92d49584e4bbf44c121e64c4b394729c5a30');
 const g=one(hex(d.groupField9Wire),9).v,typ=one(g,2).v,act=one(typ,6).v;
 assert.equal(one(act,5).v,2001400001);
 assert.equal(field(typ,1).length,0);
 assert.equal(d.byTypeIgnoreDefault,false);
 assert.equal(d.byItemSeparateExplicitId,30200200);
 const byItem=one(g,1).v;assert.equal(one(one(byItem,2).v,1).v,30200200);
 const s=compact.find(z=>z[0]===2120000023);assert.ok(s);
 assert.deepEqual(s[5].filter(t=>t[0]==='ActivityItem'),[['ActivityItem',{Ingredient:2001400001},0]]);
});
test('Ingredient Native generic MethodSpec98732 and original lambda compare actual cooking subtype not a tag or collection membership',()=>{
 const n=e.ingredientNewSelector.native,c=e.ingredientNewSelector.concrete;
 assert.equal(n.genericEncoded,'0xC0030359');assert.equal(n.methodSpecIndex,98732);
 assert.equal(n.methodSpecRawHex,'29950100ffffffffc7210000');
 assert.equal(n.methodDefIndex,103721);assert.equal(n.methodInstIndex,8647);assert.equal(n.concreteTypeDef,9674);
 assert.equal(n.lambdaRva,'0x4C004B0');assert.equal(n.lambdaBytes,224);
 assert.equal(n.lambdaSha256,'3606e397fb2d5d0ca19a12fe3006fb3d4e45844ddec3c0a937617b6d4254e312');
 assert.equal(n.innerCase5CmpRva,'0x4C00524');assert.equal(n.compareRva,'0x4C00554');
 assert.equal(n.itemCookingTypeLoadRva,'0x4C004D0');
 assert.equal(n.whereNativeRva,'0x3756AE0');assert.equal(n.commonIsValidSeparate,true);
 assert.equal(c.typeDefIndex,9674);assert.equal(c.icollectionGetterSlot,38);assert.equal(c.variationInterfaceAbsent,true);
 assert.equal(c.cookingIngredientTypeProtobufField,8);assert.equal(c.isMissionProtobufField,11);
 assert.equal(c.getterExpression,'!IsMissionItem');
});
test('Original raw Ingredient candidates three positive, one typed negative, no personal or runtime promotion',()=>{
 const a=e.ingredientNewSelector.originalIngredientTypedSource;
 assert.equal(a.totalRecords,196);assert.equal(a.directCookingTypeValue2001400001,3);
 assert.deepEqual(a.examples.filter(z=>z.predicateMatch).map(z=>z.id),[31100030,31100031,31100032]);
 assert.equal(a.examples.find(z=>z.id===31100000).predicateMatch,false);
 for(const r of a.examples){
  assert.equal(one(hex(r.field8Wire),8).v,r.predicateMatch?2001400001:2001400006);
  assert.equal(r.missionField11Absent,true);assert.equal(r.staticGetter,true);
  assert.match(r.rawSha256,/^[0-9a-f]{64}$/);
 }
 assert.equal(a.sourceRowsNotNativeCollectionDenominator,true);
 assert.deepEqual(e.coverage,{previousSelectorsStatic:100,newSelectorStatic:1,currentSelectorsStatic:101,totalSelectors:256,remainingUnknown:155,unresolvedByFamily:{ActivityItem:3,Crafting:28,Clothing:61,Furniture:63},remainingActivityTypes:['Fish','Mineral subtype16','CraftingMaterial']});
 const safe=e.safety;assert.equal(safe.runtimeEligibility,'UNKNOWN');assert.equal(safe.finalMembershipKnown,false);
 assert.equal(safe.denominator,null);assert.equal(safe.ownerStatus,'UNKNOWN');
 for(const k of ['personalPercentageEnabled','nativeWriterEnabled','presetApplyEnabled','communityPublishingEnabled','entitlementEditingEnabled','switch1253OrSteamTransferred','independentQrAccepted'])assert.equal(safe[k],false);
});
