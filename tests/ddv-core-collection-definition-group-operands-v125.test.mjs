import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 verifyCollectionDefinitionSourceV125,planCollectionDefinitionGroupV125,previewCollectionDefinitionGroupV125
} from '../src/lib/ddv/core/collection/category-definition-provenance-v125.js';
import {verifyNativeGroupCompositionEvidenceV125} from '../src/lib/ddv/core/collection/native-group-composition-v125.js';

const source=readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json');
const native=readFileSync('static/ddv/core/collection/v1.25/native-group-composition-evidence-v125.json');
const identity={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
const verified=async()=>({
 verifiedSource:await verifyCollectionDefinitionSourceV125(source),
 verifiedGroup:await verifyNativeGroupCompositionEvidenceV125(native,identity),
 identity
});
const input=(slot,family,itemIds)=>({slot,family,itemIds,predicateCoverage:'CALLER_SUPPLIED_UNVERIFIED'});

test('Original source operand plan preserves 293 definitions/256 selector occurrences, Ignore, 17 categories and per-definition identity',async()=>{
 const v=await verified();
 const records=JSON.parse(source).records,counts=new Map();
 let selectors=0,typedIgnored=0,explicitIgnored=0;
 for(const record of records){
  const p=planCollectionDefinitionGroupV125({...v,collectionDefinitionId:record[0]});
  assert.equal(p.status,'SOURCE_GROUP_OPERAND_PLAN_ONLY');
  assert.equal(p.definitionRawSha256,record[2]);
  assert.equal(p.typedSelectors.length,record[5].length);
  assert.equal(p.explicitItemFilters.length,record[4].length);
  assert.equal(p.groupCount,1);assert.equal(p.groupIndex,0);
  assert.equal(p.denominator,null);assert.equal(p.owned,'UNKNOWN');
  assert.equal(p.finalMembershipKnown,false);
  for(let i=0;i<record[5].length;i++){
   const t=p.typedSelectors[i],s=record[5][i];
   assert.equal(t.selectorKey,`${record[0]}:0:${i}`);
   assert.equal(t.family,s[0]);assert.deepEqual(t.argument,s[1]);assert.equal(t.ignore,s[2]===1);
   assert.equal(t.itemIds,'UNKNOWN');
   selectors++;if(t.ignore)typedIgnored++;
  }
  for(let i=0;i<record[4].length;i++){
   const e=p.explicitItemFilters[i],f=record[4][i];
   assert.equal(e.ignore,f[0]===1);assert.deepEqual(e.itemIds,f[1]);
   if(e.ignore)explicitIgnored++;
  }
  counts.set(p.categoryId,(counts.get(p.categoryId)||0)+1);
 }
 assert.equal(records.length,293);assert.equal(selectors,256);assert.equal(typedIgnored,20);
 assert.equal(counts.size,17);assert.ok(explicitIgnored>0);
});

test('Original definition2120000121 has TWO distinct Crafting selector slots, one ignored explicit and correct union/except preview',async()=>{
 const v=await verified(),id=2120000121;
 const plan=planCollectionDefinitionGroupV125({...v,collectionDefinitionId:id});
 assert.equal(plan.categoryId,'CollectionSubMenu_Crafting');
 assert.deepEqual(plan.typedSelectors.map(x=>x.argument.RecipeType),[2001100002,2001100006]);
 assert.deepEqual(plan.explicitItemFilters.map(x=>[x.ignore,x.itemIds]),[[true,[40700049]]]);
 const req={...v,collectionDefinitionId:id,typedSelectorInputs:[
  input(1,'Crafting',[40700051]),input(0,'Crafting',[40700049,40700050])
 ]};
 const r=previewCollectionDefinitionGroupV125(req);
 assert.equal(r.status,'SOURCE_DEFINITION_NATIVE_ORDER_PREVIEW_UNTRUSTED');
 assert.deepEqual(r.untrustedPreviewItemIds,[40700050,40700051]);
 assert.equal(r.selectorSlotsBound,2);
 assert.equal(r.finalMembershipKnown,false);
 assert.equal(r.runtimeItemDatabaseKnown,false);
 assert.equal(r.denominator,null);assert.equal(r.collected,'UNKNOWN');assert.equal(r.owned,'UNKNOWN');
 const withIgnored=previewCollectionDefinitionGroupV125({...req,includeIgnored:true});
 assert.deepEqual(withIgnored.untrustedPreviewItemIds,[40700049,40700050,40700051]);
 assert.equal(withIgnored.finalMembershipKnown,false);
});

test('Missing, duplicated, spoofed and wrong family selector inputs fail closed instead of falsely zero membership',async()=>{
 const v=await verified(),collectionDefinitionId=2120000121;
 const base={...v,collectionDefinitionId};
 assert.equal(previewCollectionDefinitionGroupV125({...base,typedSelectorInputs:[]}).code,'COLLECTION_SELECTOR_SLOT_COVERAGE_INCOMPLETE');
 assert.equal(previewCollectionDefinitionGroupV125({...base,typedSelectorInputs:[input(0,'Crafting',[])]}).code,'COLLECTION_SELECTOR_SLOT_COVERAGE_INCOMPLETE');
 assert.equal(previewCollectionDefinitionGroupV125({...base,typedSelectorInputs:[input(0,'Crafting',[]),input(0,'Crafting',[])]}).status,'BLOCKED');
 assert.equal(previewCollectionDefinitionGroupV125({...base,typedSelectorInputs:[input(0,'Crafting',[]),input(1,'Furniture',[])]}).code,'COLLECTION_SELECTOR_SLOT_OR_FAMILY_MISMATCH');
 assert.equal(previewCollectionDefinitionGroupV125({...base,typedSelectorInputs:[{...input(0,'Crafting',[]),ignore:true},input(1,'Crafting',[])]}).status,'BLOCKED');
 assert.equal(previewCollectionDefinitionGroupV125({...base,typedSelectorInputs:[input(0,'Crafting',[0]),input(1,'Crafting',[])]}).status,'BLOCKED');
 assert.equal(previewCollectionDefinitionGroupV125({...base,typedSelectorInputs:[input(0,'Crafting',[]),input(1,'Crafting',[])]}).finalMembershipKnown,false);
});

test('Original explicit ByItem zero sentinel is preserved and never treated as ItemID or silently ignored',async()=>{
 const v=await verified(),collectionDefinitionId=2120000259;
 const p=planCollectionDefinitionGroupV125({...v,collectionDefinitionId});
 assert.equal(p.hasUnresolvedZeroSentinel,true);
 assert.deepEqual(p.explicitItemFilters[0].itemIds,[0]);
 assert.equal(p.typedSelectors[0].family,'Furniture');
 const out=previewCollectionDefinitionGroupV125({...v,collectionDefinitionId,typedSelectorInputs:[input(0,'Furniture',[123])]});
 assert.equal(out.status,'BLOCKED');assert.equal(out.code,'COLLECTION_ZERO_SENTINEL_NATIVE_MEANING_UNRESOLVED');
 assert.equal(out.personalMetricAuthorized,false);
});

test('Verified source capabilities and Switch identity are strict, not forgeable from objects',async()=>{
 const v=await verified(),collectionDefinitionId=2120000017;
 assert.equal(planCollectionDefinitionGroupV125({...v,identity:{...identity,profileSchema:626},collectionDefinitionId}).status,'BLOCKED');
 assert.equal(planCollectionDefinitionGroupV125({...v,identity:{...identity,gameVersion:'1.25.3'},collectionDefinitionId}).status,'BLOCKED');
 assert.equal(planCollectionDefinitionGroupV125({...v,identity:{...identity,platform:'steam'},collectionDefinitionId}).status,'BLOCKED');
 assert.equal(planCollectionDefinitionGroupV125({...v,verifiedSource:{status:'SOURCE_VERIFIED_STATIC_ONLY'},collectionDefinitionId}).status,'BLOCKED');
 assert.equal(previewCollectionDefinitionGroupV125({...v,verifiedGroup:{status:'VERIFIED_NATIVE_GROUP_CONTROL_FLOW_ONLY'},collectionDefinitionId,typedSelectorInputs:[input(0,'ActivityItem',[30200058])]}).status,'BLOCKED');
 assert.equal(planCollectionDefinitionGroupV125({...v,collectionDefinitionId:2120000999}).code,'COLLECTION_OPERAND_DEFINITION_UNKNOWN');
});
