import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
  verifyCollectionDefinitionSourceV125,
  planCollectionDefinitionGroupV125,
  previewCollectionDefinitionGroupV125
} from '../src/lib/ddv/core/collection/category-definition-provenance-v125.js';
import {verifyNativeGroupCompositionEvidenceV125} from '../src/lib/ddv/core/collection/native-group-composition-v125.js';

const SOURCE='static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json';
const GROUP='static/ddv/core/collection/v1.25/native-group-composition-evidence-v125.json';
const original=readFileSync(SOURCE), groupOriginal=readFileSync(GROUP);
const manifest=JSON.parse(original.toString('utf8'));
const identity=Object.freeze({platform:'switch',gameVersion:'1.25.0',
  buildId:'52BD625D9B4E0053',profileSchema:624});
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const SOURCE_SHA='c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb';
const GROUP_SHA='418d9805ab59ab60941072afd206161f205f6daa4bcadd9a95f960226a6ad699';
const FAMILIES={ActivityItem:12,Furniture:63,Crafting:28,Clothing:61,MemoryShard:41,
  CharacterUniverse:33,BoardGameFigurine:16,Pet:2};
const CATEGORIES=[[0,'Crop',7],[1,'Fish',2],[2,'Meals',3],[3,'FurnitureSets',63],
 [4,'ClothingSets',61],[6,'Memories',40],[7,'Characters',33],[8,'Foraging',2],
 [9,'Minerals',2],[10,'Crafting',4],[11,'TimeBending',5],[12,'BoardGame',16],
 [13,'Snippets',3],[14,'Stories',39],[15,'Companions',2],[16,'Mounts',5],
 [18,'QuestPuzzles',6]];
const sealed=async()=>({
  verifiedSource:await verifyCollectionDefinitionSourceV125(original),
  verifiedGroup:await verifyNativeGroupCompositionEvidenceV125(groupOriginal,identity),identity
});
const selector=(slot,family,itemIds)=>({slot,family,itemIds,predicateCoverage:'CALLER_SUPPLIED_UNVERIFIED'});
const previewSafe=(p)=>{
  assert.equal(p.finalMembershipKnown,false);
  assert.equal(p.personalCollectionMetricsAuthorized,false);
  assert.equal(p.nativeWriterAuthorized,false);
  assert.equal(p.denominator,null);
  assert.equal(p.owned,'UNKNOWN');
  assert.equal(p.collected,'UNKNOWN');
  assert.equal(p.missing,'UNKNOWN');
};
const sorted=(xs)=>[...xs].sort((a,b)=>a-b);

test('independent SHA-pinned source envelope: 293 definitions, 17 categories, 256 original selector occurrences',async()=>{
  assert.equal(original.byteLength,50078);
  assert.equal(groupOriginal.byteLength,4024);
  assert.equal(sha(original),SOURCE_SHA);
  assert.equal(sha(groupOriginal),GROUP_SHA);
  assert.equal(manifest.schema,'ddv.collection-definition-source-compact@1');
  assert.deepEqual(manifest.target,{platform:'Nintendo Switch',gameVersion:'1.25.0',
    buildId:identity.buildId,profileSchemaVersion:624});
  assert.equal(manifest.itemDbCount,17413);
  assert.equal(manifest.itemDbSha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
  assert.equal(manifest.sourceSupportSha256,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
  assert.equal(manifest.sourceRawSha256,'e4887dc5729b8660caadc0d8f875a199a331973ccfeb97c740542a27ac44cc87');
  assert.equal(manifest.records.length,293);
  assert.deepEqual(manifest.categoryCounts,CATEGORIES.map(([i,n,count])=>[i,'CollectionSubMenu_'+n,count]));
  const counts=new Map(),families={},seen=new Set();
  let prev=-1,selectors=0,ignored=0,include=0,exclude=0,zero=[];
  for(const row of manifest.records){
    assert.equal(row.length,6);
    assert.ok(Number.isSafeInteger(row[0])&&row[0]>prev);
    prev=row[0];assert.ok(!seen.has(row[0]));seen.add(row[0]);
    assert.match(row[2],/^[0-9a-f]{64}$/);
    counts.set(row[1],(counts.get(row[1])||0)+1);
    for(const f of row[4]){
      assert.ok(f[0]===0||f[0]===1);
      for(const id of f[1]){
        assert.ok(Number.isSafeInteger(id)&&id>=0);
        if(f[0]===0)include++;else exclude++;
        if(id===0)zero.push([row[0],f[0]]);
      }
    }
    for(const s of row[5]){
      selectors++;families[s[0]]=(families[s[0]]||0)+1;
      assert.ok(s[2]===0||s[2]===1);if(s[2])ignored++;
    }
  }
  assert.deepEqual(CATEGORIES.map(([c,_,n])=>counts.get(c)),CATEGORIES.map(x=>x[2]));
  assert.deepEqual(families,FAMILIES);
  assert.equal(selectors,256);assert.equal(ignored,20);
  assert.equal(include,150);assert.equal(exclude,273);
  assert.deepEqual(zero,[[2120000259,1]]);
  const capabilities=await sealed();
  assert.equal(capabilities.verifiedSource.status,'SOURCE_VERIFIED_STATIC_ONLY');
  assert.equal(capabilities.verifiedGroup.status,'VERIFIED_NATIVE_GROUP_CONTROL_FLOW_ONLY');
  assert.equal(capabilities.verifiedSource.manifestSha256,SOURCE_SHA);
  assert.equal(capabilities.verifiedGroup.sha256,GROUP_SHA);
});

test('independent per-definition ordinal oracle checks all 293 raw SHA/arg/ignore/explicit lists',async()=>{
  const v=await sealed();
  for(const row of manifest.records){
    const p=planCollectionDefinitionGroupV125({...v,collectionDefinitionId:row[0]});
    assert.equal(p.status,'SOURCE_GROUP_OPERAND_PLAN_ONLY',String(row[0]));
    assert.equal(p.definitionRawSha256,row[2]);
    assert.equal(p.definitionManifestSha256,SOURCE_SHA);
    assert.equal(p.definitionName,row[3]);
    assert.equal(p.categoryId,manifest.categoryCounts.find(x=>x[0]===row[1])[1]);
    assert.equal(p.groupCount,1);assert.equal(p.groupIndex,0);
    assert.equal(p.typedSelectors.length,row[5].length);
    assert.equal(p.explicitItemFilters.length,row[4].length);
    for(const [i,s] of row[5].entries()){
      const actual=p.typedSelectors[i];
      assert.equal(actual.slot,i);assert.equal(actual.selectorKey,`${row[0]}:0:${i}`);
      assert.equal(actual.family,s[0]);assert.deepEqual(actual.argument,s[1]);
      assert.equal(actual.ignore,s[2]===1);assert.equal(actual.itemIds,'UNKNOWN');
    }
    for(const [i,f] of row[4].entries()){
      assert.equal(p.explicitItemFilters[i].slot,i);
      assert.equal(p.explicitItemFilters[i].ignore,f[0]===1);
      assert.deepEqual(p.explicitItemFilters[i].itemIds,f[1]);
      assert.equal(p.explicitItemFilters[i].containsZeroSentinel,f[1].includes(0));
    }
    previewSafe(p);
  }
});

test('independent union-then-except oracle for 292 safe manifest definitions in both preview modes',async()=>{
  const v=await sealed();
  let checked=0;
  for(const [index,row] of manifest.records.entries()){
    if(row[0]===2120000259)continue;
    // Each slot uses an artificial positive ID; deliberately overlap with first explicit filter.
    const candidateBase=85000000+index*100;
    const inputs=row[5].map((s,i)=>selector(i,s[0],
      [candidateBase+i, ...(i===0&&row[4].length&&row[4][0][1].length?
          [row[4][0][1][0]]:[])]));
    const inclusion=new Set(),exclusion=new Set();
    const classify=(ids,ignore)=>{for(const id of ids)(ignore?exclusion:inclusion).add(id)};
    for(const [i,s] of row[5].entries())classify(inputs[i].itemIds,s[2]===1);
    for(const f of row[4])classify(f[1],f[0]===1);
    const normal=previewCollectionDefinitionGroupV125({...v,collectionDefinitionId:row[0],typedSelectorInputs:inputs});
    assert.equal(normal.status,'SOURCE_DEFINITION_NATIVE_ORDER_PREVIEW_UNTRUSTED',String(row[0]));
    assert.deepEqual(normal.untrustedPreviewItemIds,sorted([...inclusion].filter(id=>!exclusion.has(id))));
    assert.equal(normal.selectorSlotsBound,row[5].length);
    assert.equal(normal.sourceExplicitFilters,row[4].length);
    assert.equal(normal.nativeGroupOrderingVerified,true);
    assert.equal(normal.runtimeItemDatabaseKnown,false);previewSafe(normal);
    const all=previewCollectionDefinitionGroupV125({...v,collectionDefinitionId:row[0],typedSelectorInputs:inputs,includeIgnored:true});
    assert.equal(all.status,'SOURCE_DEFINITION_NATIVE_ORDER_PREVIEW_UNTRUSTED',String(row[0]));
    assert.deepEqual(all.untrustedPreviewItemIds,sorted(new Set([...inclusion,...exclusion])));
    previewSafe(all);checked++;
  }
  assert.equal(checked,292);
});

test('Crafting 2120000121 preserves two original arguments, ignored explicit ID and slot identity',async()=>{
  const v=await sealed(),id=2120000121;
  const row=manifest.records.find(r=>r[0]===id);
  assert.deepEqual(row[5].map(s=>[s[0],s[1].RecipeType,s[2]]),
    [['Crafting',2001100002,0],['Crafting',2001100006,0]]);
  assert.deepEqual(row[4],[[1,[40700049]]]);
  const p=planCollectionDefinitionGroupV125({...v,collectionDefinitionId:id});
  assert.deepEqual(p.typedSelectors.map(s=>s.selectorKey),[`${id}:0:0`,`${id}:0:1`]);
  const inputs=[selector(0,'Crafting',[40700049,40700050]),
                selector(1,'Crafting',[40700051,40700050])];
  const normal=previewCollectionDefinitionGroupV125({...v,collectionDefinitionId:id,typedSelectorInputs:inputs});
  assert.deepEqual(normal.untrustedPreviewItemIds,[40700050,40700051]);previewSafe(normal);
  // Input-array reorder does NOT reorder the original operands: slots restore original ordinal.
  const reordered=previewCollectionDefinitionGroupV125({...v,collectionDefinitionId:id,typedSelectorInputs:[...inputs].reverse()});
  assert.deepEqual(reordered.untrustedPreviewItemIds,normal.untrustedPreviewItemIds);previewSafe(reordered);
  const all=previewCollectionDefinitionGroupV125({...v,collectionDefinitionId:id,typedSelectorInputs:inputs,includeIgnored:true});
  assert.deepEqual(all.untrustedPreviewItemIds,[40700049,40700050,40700051]);previewSafe(all);
});

test('zero-sentinel 2120000259 preserved by planner, BLOCKED by preview, no implicit removal',async()=>{
  const v=await sealed(),id=2120000259;
  const p=planCollectionDefinitionGroupV125({...v,collectionDefinitionId:id});
  assert.equal(p.status,'SOURCE_GROUP_OPERAND_PLAN_ONLY');
  assert.equal(p.hasUnresolvedZeroSentinel,true);
  assert.deepEqual(p.explicitItemFilters.map(f=>[f.ignore,f.itemIds]),[[true,[0]]]);
  const r=previewCollectionDefinitionGroupV125({...v,collectionDefinitionId:id,
    typedSelectorInputs:[selector(0,'Furniture',[40000100])]});
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.code,'COLLECTION_ZERO_SENTINEL_NATIVE_MEANING_UNRESOLVED');
  assert.equal(r.personalMetricAuthorized,false);
});

test('capabilities are genuine WeakMap handles and bytes/build/schema cannot be forged',async()=>{
  const v=await sealed(),id=2120000121;
  for(const wrong of [
    {...identity,platform:'steam'},
    {...identity,gameVersion:'1.25.3'},
    {...identity,profileSchema:626},
    {...identity,buildId:'9A239D3DB569756D'},{}
  ]){
    assert.equal(planCollectionDefinitionGroupV125({...v,identity:wrong,collectionDefinitionId:id}).status,'BLOCKED');
    assert.equal(previewCollectionDefinitionGroupV125({...v,identity:wrong,collectionDefinitionId:id,
      typedSelectorInputs:[selector(0,'Crafting',[]),selector(1,'Crafting',[])]}).status,'BLOCKED');
    assert.equal((await verifyNativeGroupCompositionEvidenceV125(groupOriginal,wrong)).status,'BLOCKED');
  }
  for(const fake of [{...v.verifiedSource},Object.create(v.verifiedSource),{status:'SOURCE_VERIFIED_STATIC_ONLY'}]){
    assert.equal(planCollectionDefinitionGroupV125({...v,verifiedSource:fake,collectionDefinitionId:id}).status,'BLOCKED');
  }
  for(const fake of [{...v.verifiedGroup},Object.create(v.verifiedGroup),{status:'VERIFIED_NATIVE_GROUP_CONTROL_FLOW_ONLY'}]){
    assert.equal(previewCollectionDefinitionGroupV125({...v,verifiedGroup:fake,collectionDefinitionId:id,
      typedSelectorInputs:[selector(0,'Crafting',[]),selector(1,'Crafting',[])]}).status,'BLOCKED');
  }
  const corrupted=Buffer.from(original);corrupted[29]^=1;
  assert.equal((await verifyCollectionDefinitionSourceV125(corrupted)).status,'BLOCKED');
  const corruptGroup=Buffer.from(groupOriginal);corruptGroup[27]^=1;
  assert.equal((await verifyNativeGroupCompositionEvidenceV125(corruptGroup,identity)).status,'BLOCKED');
  const changed=JSON.parse(original.toString('utf8'));
  [changed.records[0],changed.records[1]]=[changed.records[1],changed.records[0]];
  assert.equal((await verifyCollectionDefinitionSourceV125(JSON.stringify(changed))).status,'BLOCKED');
});

test('missing/duplicate/out-of-range/aliased slots, spoofed Ignore, wrong family and invalid candidate IDs BLOCK',async()=>{
  const v=await sealed(),id=2120000121;
  const base={...v,collectionDefinitionId:id};
  const a=selector(0,'Crafting',[40700050]),b=selector(1,'Crafting',[40700051]);
  const blocked=[
    [],[a],[a,a],[b,b],[selector(2,'Crafting',[]),b],
    [{...a,slot:-1},b],[{...a,slot:0.5},b],
    [a,{...b,family:'Furniture'}],
    [{...a,ignore:false},b],[{...a,predicateCoverage:'NATIVE_VERIFIED'},b],
    [{...a,itemIds:[0]},b],[{...a,itemIds:[-1]},b],
    [{...a,itemIds:[1.5]},b],[{...a,itemIds:['40700050']},b],
    [{...a,itemIds:[null]},b],[{...a,itemIds:[Number.MAX_SAFE_INTEGER+1]},b],
    [{...a,itemIds:null},b]
  ];
  for(const typedSelectorInputs of blocked){
    const out=previewCollectionDefinitionGroupV125({...base,typedSelectorInputs});
    assert.equal(out.status,'BLOCKED',JSON.stringify(typedSelectorInputs));
    assert.equal(out.personalMetricAuthorized,false);
  }
  assert.equal(previewCollectionDefinitionGroupV125({...base,typedSelectorInputs:[a,b],includeIgnored:'false'}).status,'BLOCKED');
  for(const collectionDefinitionId of [null,-1,0,2120000999,1.5,'2120000121',Number.MAX_SAFE_INTEGER+1]){
    assert.equal(planCollectionDefinitionGroupV125({...v,collectionDefinitionId}).status,'BLOCKED');
  }
});
