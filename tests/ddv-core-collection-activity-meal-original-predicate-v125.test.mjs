import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const evidence=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-activity-meal-original-predicate-v125.json','utf8'));
const defs=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json','utf8')).records;
const bytes=h=>Buffer.from(h,'hex');
function vi(b,p){let n=0,s=0;while(p<b.length){let z=b[p++];n+=(z&127)*2**s;if(z<128)return [n,p];s+=7;}throw new Error('varint');}
function parse(b){let r=[],p=0;while(p<b.length){let w;[w,p]=vi(b,p);let n=w>>3,t=w&7,v;if(t===0)[v,p]=vi(b,p);else if(t===2){let len;[len,p]=vi(b,p);assert.ok(p+len<=b.length);v=b.subarray(p,p+len);p+=len;}else throw Error('unexpected protobuf wire type '+t);r.push({n,t,v});}return r;}
const field=(b,n)=>parse(b).filter(v=>v.n===n);
const only=(b,n)=>{const f=field(b,n);assert.equal(f.length,1);return f[0];};

test('Meal native evidence separates original Switch v31 sources from unresolved historical metadata',()=>{
 const s=evidence.originalSources;assert.equal(evidence.scope.bid,'52BD625D9B4E0053');assert.equal(evidence.scope.profileSchema,624);
 assert.equal(s.exeFsMain.sha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(s.romFsMetadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(s.losslessGzip.sha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a367cefa585f8048');
 assert.equal(s.supportGzip.sha256,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(s.historicalD548Metadata.originalBytes,'NEED_SOURCE');assert.equal(s.historicalD548Metadata.equatedToRomFs,false);
});
test('Original three Meal definition wire excerpts decode exact nested MealType and independently separate ByItem Ignore',()=>{
 assert.deepEqual(evidence.originalCollectionDefinitions.records.map(z=>[z.definitionId,z.mealType]),[[2120000022,2001500000],[2120000032,2001500001],[2120000111,2001500003]]);
 for(const z of evidence.originalCollectionDefinitions.records){
  assert.match(z.rawSha256,/^[a-f0-9]{64}$/);assert.ok(z.rawBytes>=100);
  const group=only(bytes(z.field9WireHex),9).v;
  const typed=only(group,2).v,activity=only(typed,6).v,meal=only(activity,2).v;
  assert.equal(only(meal,1).v,z.mealType);
  assert.equal(only(meal,1).t,0);
  assert.equal(field(typed,1).length,0);
  const byItem=only(group,1).v;assert.equal(only(byItem,1).v,1);
  assert.deepEqual(z.byTypeIgnore,{present:false,default:false});
  assert.deepEqual(z.byItemIgnore,{present:true,value:true});
  const d=defs.find(r=>r[0]===z.definitionId);assert.ok(d);assert.deepEqual(d[5].filter(q=>q[0]==='ActivityItem'),[['ActivityItem',{Meal:{MealType:z.mealType}},0]]);
 }
});
test('Same original NSO generic MethodSpec and MealType Where lambda underlie exactly three selectors',()=>{
 const n=evidence.native, g=n.getAllByType, p=n.sharedPredicateLambda;
 assert.equal(n.innerCase2CmpRva,'0x4BFDD28');
 assert.equal(g.methodSpecIndex,98734);assert.equal(g.methodSpecHex,'29950100ffffffff39220000');
 assert.equal(g.methodDefIndex,103721);assert.equal(g.genericInstantiationIndex,8761);assert.equal(g.concreteTypeDefIndex,9672);
 assert.equal(g.encodedUsage,'0xC003035D');assert.equal(g.itemTypeConstant,3);
 assert.equal(p.rva,'0x4C00590');assert.equal(p.bytes,240);
 assert.equal(p.sha256,'e0b189c431058f8cc3f80385b8fba01f2234a462ab4dc1dbc424321c50e26628');
 assert.equal(p.outerCase6GuardRva,'0x4C005DC');assert.equal(p.innerCase2GuardRva,'0x4C0062C');
 assert.equal(p.compareRva,'0x4C00654');assert.equal(p.comparison,'selector.Meal.MealType == mealData.MealType');
 assert.equal(n.whereNativeRva,'0x3756AE0');assert.equal(n.selectNativeRva,'0x3752680');assert.equal(n.commonIsValidSeparate,true);
});
test('MealItemData concrete original interface and getter retain additional unresolved static ID check',()=>{
 const c=evidence.concrete;assert.equal(c.typeDefIndex,9672);assert.equal(c.interfaceOffsetsCount,20);
 assert.equal(c.icollectionItemTypeIndex,64932);assert.equal(c.icollectionOffset+c.icollectionVirtualSlot,c.icollectionConcreteVtableSlot);
 assert.equal(c.encodedGetterMethod,'0x6002D8D1');assert.equal(c.getterMethodDefIndex,93288);assert.equal(c.variationInterfaceAbsent,true);
 assert.equal(c.mealTypeProtobufField,15);assert.equal(c.missionProtobufField,12);
 assert.equal(c.getMealType.opcode8Hex,'005c40b9c0035fd6');
 assert.equal(c.getCanBeCollected.missionShortCircuitReadRva,'0x487E164');
 assert.equal(c.getCanBeCollected.additionalCompareRva,'0x487E1E4');
 assert.equal(c.getCanBeCollected.preciseStaticComparatorValue,'UNKNOWN');
 assert.equal(c.getCanBeCollected.size,400);
});
test('Individual original typed Meal protobuf excerpts witness typed predicate true/false, not complete getter positive',()=>{
 const x=evidence.originalTypedMealInput;
 assert.equal(x.totalRowsIndividuallyShaVerified,578);
 assert.deepEqual(x.mealTypeCounts,{"2001500000":162,"2001500001":230,"2001500003":96,"2001500005":90});
 assert.equal(x.sourceMissionTrue,92);assert.equal(x.sourceMissionFalseOrDefault,486);
 const byId=new Map(x.examples.map(z=>[z.itemId,z]));
 for(const [id,mt,sel] of [[30300001,2001500000,2120000022],[30300010,2001500001,2120000032],[30300009,2001500003,2120000111]]){
  const t=byId.get(id);assert.ok(t);assert.equal(only(bytes(t.field15WireHex),15).v,mt);
  assert.equal(t.missionField12Present,false);assert.equal(t.getter,'UNKNOWN_STATIC_ID_COMPARISON');
  assert.deepEqual(t.nativeMealTypeSelectorMatches.filter(q=>q.matched).map(q=>q.definitionId),[sel]);
 }
 const r=byId.get(30300119);assert.equal(only(bytes(r.missionField12WireHex),12).v,1);
 assert.equal(r.getter,'FALSE_MISSION_SHORT_CIRCUIT');assert.ok(r.nativeMealTypeSelectorMatches.every(q=>q.matched===false));
});
test('Three Meal selectors update predicate count only; runtime membership, version and writer are fail-closed',()=>{
 const c=evidence.coverage;assert.equal(c.previousStaticPredicate,97);assert.equal(c.newStaticPredicateClosed,3);
 assert.equal(c.nowStaticPredicate,100);assert.equal(c.remainingUnknown,156);
 assert.deepEqual(c.unknownByFamily,{ActivityItem:4,Crafting:28,Clothing:61,Furniture:63});
 assert.equal(evidence.remainingNativeSelectorKinds.length,4);
 const s=evidence.safety;
 for(const k of ['runtimeItemDatabaseAccepted','fullNativeGetterPositiveFromSource','finalMembershipKnown','personalMetricsAuthorized','entitlementEditingAuthorized','nativeWriterAuthorized','presetApplyAuthorized','communityPublishingAuthorized','steamOrSwitchSchema626Transferred','independentQrAccepted'])assert.equal(s[k],false,k);
 for(const k of ['owned','collected','missing'])assert.equal(s[k],'UNKNOWN');assert.equal(s.denominator,null);
});
