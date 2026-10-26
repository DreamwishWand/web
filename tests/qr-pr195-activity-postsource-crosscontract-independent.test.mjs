import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root='static/ddv/core/collection/v1.25/';
const now=JSON.parse(readFileSync(root+'native-activity-raw-wire-hastag-fallback-v125.json','utf8'));
const prior=JSON.parse(readFileSync(root+'native-activity-by-gameplay-tag-v125.json','utf8'));
const compact=JSON.parse(readFileSync(root+'collection-definition-source-compact-v125.json','utf8'));
const byId=new Map(compact.records.map(x=>[x[0],x]));

test('QR201 delta: original row source and compact projections agree on four selectors WITHOUT collapsing separate Ignore owners',()=>{
 const rows=now.definitionWire.records;
 assert.equal(rows.length,4);
 for(const r of rows){
   const c=byId.get(r.definitionId);
   assert.ok(c);
   assert.equal(c[2],r.rawSha256,'same payload identity as previous compact manifest');
   assert.deepEqual(c[5],[['ActivityItem',{ByGameplayTag:r.tag},0]]);
   assert.equal(r.collectionsByTypeIgnore.fieldPresent,false);
   assert.equal(r.collectionsByTypeIgnore.effectiveDefault,false);
   const ignored=r.collectionsByItemIgnore.effective??false;
   if([2120000015,2120000016].includes(r.definitionId))assert.equal(ignored,true);
   else assert.equal(ignored,false);
 }
 // No group-level positive is inferred by silently discarding or overwriting separate CollectionsByItem.Ignore.
 assert.equal(now.source.originalCollectionSetJson.rawOriginalWholeFilePresentInSupportTables,false);
 assert.equal(now.source.originalCollectionSetJson.preservedIndividualRawProtobufPayloads,293);
});

test('QR201 delta: concrete-type-specific negative is not a polymorphic/general IHasTags negative',()=>{
 const byItem=new Map(now.representativeItemWire.records.map(r=>[r.itemId,r]));
 const byType=now.concreteTypeInterface;
 function staticTyped(itemId,tag) {
   const row=byItem.get(itemId);assert.ok(row);
   const ty=byType[row.concrete];
   assert.equal(ty.hasIHasTags,true);
   if(row.rawTags.includes(tag))return 'TRUE';
   if(!ty.hasIHasSet)return 'FALSE';
   return 'UNKNOWN_FALLBACK_REQUIRES_SET_DB';
 }
 assert.equal(staticTyped(30200001,2001200013),'TRUE');
 assert.equal(staticTyped(30200001,2001200011),'FALSE');
 assert.equal(staticTyped(30200086,2001200011),'TRUE');
 assert.equal(staticTyped(30200086,2001200013),'FALSE');
 assert.equal(staticTyped(31100072,2001200014),'TRUE');
 assert.equal(staticTyped(31100072,2001200013),'FALSE');
 assert.equal(staticTyped(30200003,2001200012),'TRUE');
 assert.equal(staticTyped(30200003,2001200013),'FALSE');
 const general=now.predicateResultMatrix.generalIHasTags;
 assert.equal(general.directTagFalseAndIHasSetAndValidSetWithTag,'TRUE');
 assert.equal(general.runtimeIHasSetReturnedSetOrItemDbUnknown,'UNKNOWN');
 assert.equal(prior.safety.rawTagAbsenceIsFinalNegative,false);
 assert.equal(now.predicateResultMatrix.exactSourceCropIngredientConcrete.runtimeItemDbInstanceAndCollectionSets,'UNKNOWN');
});

test('QR201 delta: raw-gzip provenance is bounded to row evidence; zero added selector closure and fail-closed consumer',()=>{
 assert.equal(now.source.losslessItemDb.driveId,'1_iMow5gXJTmgbogw1y7S8vTQp-Bj2vI8');
 assert.equal(now.source.supportTables.driveId,'1Ee5tySw_XinkIXvLTSkDfFUMlTjJPtJJ');
 assert.equal(now.source.originalCollectionSetJson.rawOriginalWholeFilePresentInSupportTables,false);
 const r=now.coverage;
 assert.equal(r.priorNativeSelectorPredicateClosed,96);
 assert.equal(r.additionalSelectorClosures,0);
 assert.equal(r.confirmedStaticSelectorCount+r.remainingUnknown,r.total);
 assert.deepEqual(r.unknownByFamily,{ActivityItem:8,Crafting:28,Furniture:63,Clothing:61});
 const s=now.safety;
 assert.equal(s.independentQR200NewRawAndFallbackAcceptance,false);
 assert.equal(s.unknownFinalNativeMembership,true);
 assert.equal(s.denominator,null);
 assert.equal(s.owned,'UNKNOWN');
 assert.equal(s.collected,'UNKNOWN');
 assert.equal(s.missing,'UNKNOWN');
 for(const k of ['personalCollectionMetricsAuthorized','nativeWriterAuthorized','presetApplyAuthorized','communityPublishingAuthorized','entitlementInferenceAuthorized','crossPlatformSemanticTransferAuthorized'])
  assert.equal(s[k],false,k);
});