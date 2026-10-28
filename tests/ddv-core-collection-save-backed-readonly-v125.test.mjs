import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSaveBackedCollection} from '../src/lib/ddv/core/collection/save-backed-readonly-v125.js';

const sha='a'.repeat(64);
const evidence={
  source:{rawSaveSha256:sha,codecReadValidated:true,profileOwnerConfirmed:true,localOnly:true,currentDefinitionUniverseComplete:true,categoryManifestReviewed:true,categoryManifestSha256:sha},
  saveIdentity:{profileGameInfoVersion:624,sourcePlatform:'switch'},
  targetBuild:{platform:'switch',kind:'switch-bid',value:'52BD625D9B4E0053'},
  knownItemIds:[40003256,40003257],
  definitionBindings:[
    {collectionDefinitionId:21200001,categoryId:'Crafting',groupCount:1,evidenceVersion:'1.25.0',evidenceSha256:sha},
    {collectionDefinitionId:21200002,categoryId:'Furniture',groupCount:1,evidenceVersion:'1.25.0',evidenceSha256:sha}
  ]
};
const profile={GameInfo:{Version:624},Player:{CollectionSets:[
  {CollectionDefinitionID:21200001,GroupData:[{GroupsCollectionItems:{40003256:true,40003257:false}}]},
  {CollectionDefinitionID:21200002,GroupData:[{GroupsCollectionItems:{40003256:false,40003257:false}}]}
]}};
const read=(props={})=>projectSaveBackedCollection({...evidence,profile,...props});

test('R45 category entries and mixed-category unique PARTIAL remain distinct',()=>{
  const r=read();assert.equal(r.status,'COMPLETE');
  assert.equal(r.coverage.validEntries,4);assert.equal(r.coverage.collectedEntries,1);
  assert.equal(r.coverage.coverage,.25);
  assert.deepEqual(r.unique.map(x=>x.state),['PARTIAL','MISSING']);
  assert.equal(r.uniqueCoverage.partial,1);assert.equal(r.uniqueCoverage.coverage,0);
  assert.equal(r.owned.status,'PARTIAL');
});
test('Duplicate category occurrences deduplicate but independent categories remain',()=>{
  const p=structuredClone(profile);
  p.Player.CollectionSets[0].GroupData.push({GroupsCollectionItems:{40003256:true}});
  const defs=evidence.definitionBindings.map((x,i)=>i?x:{...x,groupCount:2});
  const r=read({profile:p,definitionBindings:defs});
  assert.equal(r.status,'COMPLETE');assert.equal(r.coverage.validEntries,4);
  assert.equal(r.entries.find(x=>x.categoryId==='Crafting'&&x.itemId===40003256).rawOccurrences,2);
});
test('Conflicting same-category occurrence rejects rather than synthesizing a boolean',()=>{
  const p=structuredClone(profile);p.Player.CollectionSets[0].GroupData.push({GroupsCollectionItems:{40003256:false}});
  const defs=evidence.definitionBindings.map((x,i)=>i?x:{...x,groupCount:2});
  assert.equal(read({profile:p,definitionBindings:defs}).code,'COLLECTION_SAME_CATEGORY_CONFLICT');
});
test('Unknown definition makes coverage unknown, not a fabricated percentage',()=>{
  const r=read({knownItemIds:[40003256]});
  assert.equal(r.status,'PARTIAL');assert.equal(r.coverage.denominator,null);assert.equal(r.coverage.unresolvedCount,2);
});
test('Missing pinned category binding makes scope incomplete',()=>{
  const r=read({definitionBindings:evidence.definitionBindings.slice(0,1)});
  assert.equal(r.status,'PARTIAL');assert.equal(r.coverage.coverage,null);
});
test('Switch626 P1G read promotion does not authorize Collection semantics',()=>{
  const r=read({profile:{GameInfo:{Version:626},Player:{CollectionSets:profile.Player.CollectionSets,ListInventories:{}}},
    saveIdentity:{profileGameInfoVersion:626,sourcePlatform:'switch'},
    targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'}});
  assert.equal(r.status,'STRUCTURAL_ONLY');assert.equal(r.entries,null);assert.equal(r.coverage,null);
});
test('Steam626 and unknown origin fail closed',()=>{
  const r=read({profile:{GameInfo:{Version:626},Player:profile.Player},
    saveIdentity:{profileGameInfoVersion:626,sourcePlatform:'steam-windows'},
    targetBuild:{platform:'steam-windows',kind:'steam-full-version',value:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'}});
  assert.equal(r.status,'BLOCKED');
  assert.equal(read({source:{...evidence.source,profileOwnerConfirmed:false}}).code,'COLLECTION_TRUSTED_PRIVATE_SAVE_BOUNDARY_MISSING');
});
test('Invalid bool, missing group, duplicate definition and schema drift fail closed',()=>{
  const p=structuredClone(profile);p.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems['40003256']=1;
  assert.equal(read({profile:p}).code,'COLLECTION_ENTRY_NONBOOLEAN_OR_BAD_ID');
  const noGroup=structuredClone(profile);noGroup.Player.CollectionSets[0].GroupData=[];
  assert.equal(read({profile:noGroup}).code,'COLLECTION_GROUP_STRUCTURE_MISMATCH');
  const dup=structuredClone(profile);dup.Player.CollectionSets.push(structuredClone(dup.Player.CollectionSets[0]));
  assert.equal(read({profile:dup}).code,'COLLECTION_DEFINITION_ID_DUPLICATE_OR_INVALID');
  assert.equal(read({profile:{...profile,GameInfo:{Version:626}}}).code,'COLLECTION_GAMEINFO_IDENTITY_MISMATCH');
});
test('R45 scoped unique state uses selected category, not global category state',()=>{
  const r=read({scope:{categoryId:'Crafting'}});
  assert.equal(r.coverage.validEntries,2);
  assert.equal(r.unique.find(x=>x.itemId===40003256).state,'COLLECTED');
  assert.equal(r.uniqueCoverage.coverage,.5);
});
test('Canonical stock route stays separate from Collection and keeps absent/zero distinction',()=>{
  const p=structuredClone(profile);
  p.Player.ListInventories={'0':{CompatibleItemType:4,Inventory:{'40003256':{Amount:0,Marker:'New'}}}};
  const canonicalOwnership={
    '40003256':{canonicalItemId:40003256,listInventoryId:0,evidenceSha256:sha,platform:'switch',gameVersion:'1.25.0',compatibleItemType:4},
    '40003257':{canonicalItemId:40003257,listInventoryId:0,evidenceSha256:sha,platform:'switch',gameVersion:'1.25.0',compatibleItemType:4}
  };
  const r=read({profile:p,canonicalOwnership});
  assert.equal(r.status,'COMPLETE');assert.equal(r.owned.status,'COMPLETE');
  assert.equal(r.owned.states[0].owned,false);assert.equal(r.owned.states[0].mapEntryPresent,true);
  assert.equal(r.owned.states[1].owned,false);assert.equal(r.owned.states[1].mapEntryPresent,false);
  assert.equal(r.unique[0].state,'PARTIAL');
});
test('No reviewed category manifest means no denominator',()=>{
  const r=read({source:{...evidence.source,categoryManifestReviewed:false}});
  assert.equal(r.status,'PARTIAL');assert.equal(r.coverage.denominator,null);
});
