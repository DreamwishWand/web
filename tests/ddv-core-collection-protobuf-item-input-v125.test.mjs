import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const audit=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-protobuf-item-input-field7-scope-v125.json','utf8'));
test('01D exact Switch1250 source provenance only',()=>{
 assert.equal(audit.schema,'ddv.collection-protobuf-item-input-field7-scope@1');
 assert.deepEqual(audit.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624});
 assert.equal(audit.source.canonicalPackageSha256,'6bc68479f75f621a6c5582bcf071b34e97886f2362c6dc26fe536fc026dee0c2');
 assert.equal(audit.source.losslessGzipSha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
});
test('Only explicit protobuf field-7 varints, never inferred default values',()=>{
 assert.equal(audit.auditedDefinitionCount,17413);
 assert.equal(audit.explicitCanBeCollectedParameterCount,0);
 const v=audit.explicitIsVariationOf;
 assert.equal(v.count,305);assert.equal(v.fieldNumber,7);assert.equal(v.wireType,0);
 assert.equal(v.field7VarintExactMatchCount,305);assert.equal(v.nonzeroExistingParentCount,305);
 assert.deepEqual(v.concreteTypes,{FenceAndRoadItemData:240,LandscapingItemData:48,EphemeralItemData:17});
 assert.deepEqual(v.confirmedExamples.map(x=>[x.itemId,x.parentItemId,x.concreteType]),[
  [40700002,40700000,'FenceAndRoadItemData'],[40200007,40200003,'LandscapingItemData'],
  [31300004,31300003,'EphemeralItemData']]);
});
test('Source field evidence does not prove concrete interface, getter/default, or candidate membership',()=>{
 assert.equal(audit.evidence.protobufField7ExplicitValues,'CONFIRMED_SAME_BUILD_STATIC');
 for(const key of ['concreteTypeIItemIsVariationOfInterface','nativeVirtualGetterMapping','protobufAbsentFieldDefault','nativeCanBeCollectedGetterValues','nativeSelectorPredicateSixFamilies','nativeFinalMembership'])
  assert.equal(audit.evidence[key],'UNKNOWN');
 assert.equal(audit.safety.absenceOfFieldDoesNotProveInterfaceAbsence,true);
 assert.equal(audit.safety.absenceOfCanBeCollectedDoesNotProveBoolean,true);
 assert.equal(audit.safety.finalMembershipKnown,false);
 assert.equal(audit.safety.denominator,null);
 assert.equal(audit.safety.owned,'UNKNOWN');assert.equal(audit.safety.collected,'UNKNOWN');
 assert.equal(audit.safety.nativeEligibility,'UNKNOWN');
 assert.equal(audit.safety.personalMetricsAuthorized,false);
 assert.equal(audit.safety.nativeWriterAuthorized,false);
 assert.equal(audit.safety.publicConsumerAuthorized,false);
});
test('Unclosed six-family selectors remain exactly 182, not source-promoted',()=>{
 assert.deepEqual(audit.remainingNativeSelectors,{Furniture:63,Clothing:61,Crafting:28,BoardGameFigurine:16,ActivityItem:12,Pet:2,total:182});
 assert.equal(Object.values(audit.remainingNativeSelectors).slice(0,-1).reduce((a,b)=>a+b,0),182);
 assert.match(audit.blocker,/concrete type interface/);
});
