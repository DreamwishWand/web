import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  COLLECTION_DEFINITION_SOURCE_SHA256_V125,
  verifyCollectionDefinitionSourceV125,bindCollectionProfileDefinitionsV125
} from '../src/lib/ddv/core/collection/category-definition-provenance-v125.js';

const raw=readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json');
const proof={platform:'switch',buildId:'52BD625D9B4E0053',schema:624,codecAccepted:true,ownerConsentVerified:true,privateLocalExecution:true};
const profile=(ids=[2120000015,2120000418])=>({
  GameInfo:{Version:624},
  Player:{CollectionSets:ids.map((CollectionDefinitionID,i)=>({
    CollectionDefinitionID,GroupData:[{GroupsCollectionItems:{[String(30200018+i)]:i===0}}]
  }))}
});

test('Exact original 293 native definitions and 17 categories pass pinned source SHA',async()=>{
  const p=await verifyCollectionDefinitionSourceV125(raw);
  assert.equal(p.status,'SOURCE_VERIFIED_STATIC_ONLY');
  assert.equal(p.definitionCount,293);assert.equal(p.categoryCount,17);
  assert.equal(p.manifestSha256,COLLECTION_DEFINITION_SOURCE_SHA256_V125);
  assert.deepEqual([p.explicitIncludedOccurrences,p.explicitExcludedOccurrences,p.typedSelectorOccurrences],[150,273,256]);
  assert.equal(p.personalMetricAuthorized,false);
});
test('One-byte manifest tampering fails without relying on self-reported SHA',async()=>{
  const mod=Buffer.from(raw);mod[240]^=1;
  const v=await verifyCollectionDefinitionSourceV125(mod);
  assert.equal(v.status,'BLOCKED');assert.equal(v.code,'COLLECTION_DEFINITION_SOURCE_SHA256_MISMATCH');
});
test('Synthetic same-version owner schema624 binds exact source definitions but never emits a metric',async()=>{
  const v=await verifyCollectionDefinitionSourceV125(raw);
  const b=bindCollectionProfileDefinitionsV125({verifiedSource:v,profile:profile(),sourceIdentity:proof});
  assert.equal(b.status,'BOUND_STATIC_DEFINITIONS');
  assert.deepEqual(b.definitionBindings.map(x=>x.categoryId),['CollectionSubMenu_Crop','CollectionSubMenu_ClothingSets']);
  assert.equal(b.definitionBindings[0].collectionDefinitionId,2120000015);
  assert.equal(b.personalMetricAuthorized,false);
  assert.equal(b.entryDenominator,null);assert.equal(b.owned,null);
});
test('Unknown static CollectionDefinitionID is unresolved, not silently assigned',async()=>{
  const v=await verifyCollectionDefinitionSourceV125(raw);
  const b=bindCollectionProfileDefinitionsV125({verifiedSource:v,profile:profile([2120000015,2120000999]),sourceIdentity:proof});
  assert.equal(b.status,'PARTIAL_STATIC_BINDING');assert.equal(b.issues[0].definitionId,2120000999);
  assert.equal(b.entryDenominator,null);
});
test('No forged verified capability can bypass hash checks',()=>{
  const b=bindCollectionProfileDefinitionsV125({verifiedSource:{status:'SOURCE_VERIFIED_STATIC_ONLY'},profile:profile(),sourceIdentity:proof});
  assert.equal(b.code,'COLLECTION_SOURCE_CAPABILITY_NOT_VERIFIED');
});
test('No owner consent and no source platform proof fail closed',async()=>{
  const v=await verifyCollectionDefinitionSourceV125(raw);
  for(const part of [{ownerConsentVerified:false},{platform:'steam-windows'},{buildId:'9A239D3DB569756D'},{privateLocalExecution:false}]){
    const p={...proof,...part};
    const b=bindCollectionProfileDefinitionsV125({verifiedSource:v,profile:profile(),sourceIdentity:p});
    assert.equal(b.code,'COLLECTION_PROFILE_PROVENANCE_NOT_AUTHENTICATED');
  }
});
test('Profile schema626 remains unsupported for Collection even when P1G can decode it',async()=>{
  const v=await verifyCollectionDefinitionSourceV125(raw);
  const p=profile();p.GameInfo.Version=626;
  assert.equal(bindCollectionProfileDefinitionsV125({verifiedSource:v,profile:p,sourceIdentity:proof}).code,'COLLECTION_PROFILE_624_STRUCTURE_UNSUPPORTED');
});
test('Duplicate or invalid CollectionDefinitionID and wrong group count reject',async()=>{
  const v=await verifyCollectionDefinitionSourceV125(raw);
  const dup=profile([2120000015,2120000015]);
  assert.equal(bindCollectionProfileDefinitionsV125({verifiedSource:v,profile:dup,sourceIdentity:proof}).code,'COLLECTION_PROFILE_DEFINITION_ID_INVALID_OR_DUPLICATE');
  const wrong=profile();wrong.Player.CollectionSets[0].GroupData=[];
  assert.equal(bindCollectionProfileDefinitionsV125({verifiedSource:v,profile:wrong,sourceIdentity:proof}).code,'COLLECTION_PROFILE_GROUP_COUNT_MISMATCH');
});
test('Nonboolean saved collection membership rejected; static selectors do not generate booleans',async()=>{
  const v=await verifyCollectionDefinitionSourceV125(raw);
  const p=profile();p.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems['30200018']=1;
  assert.equal(bindCollectionProfileDefinitionsV125({verifiedSource:v,profile:p,sourceIdentity:proof}).code,'COLLECTION_PROFILE_ITEM_BOOL_INVALID');
});
