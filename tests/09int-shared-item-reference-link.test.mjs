import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeCollectionRecord } from '../src/lib/collection/runtime.js';
import {collectionReferenceSelection} from '../src/lib/collection/reference-navigation.js';
import {
  ITEM_REFERENCE_LINK_SCHEMA,ITEM_REFERENCE_TARGET,DECORATE_ITEM_FAMILIES,
  resolveSharedItemLink,resolveRelatedItemLink,resolvePublishedGuideItemLink
} from '../src/lib/collection/shared-item-reference.js';

const index=JSON.parse(readFileSync(new URL('../static/ddv/collection/v1.25/index.json',import.meta.url),'utf8'));
const shard=JSON.parse(readFileSync(new URL('../static/ddv/collection/v1.25/records-08.json',import.meta.url),'utf8'));
const records=shard.r.map(row=>decodeCollectionRecord(index,row,'ja'));
const item=records.find(r=>DECORATE_ITEM_FAMILIES.includes(r.family));
const other=records.find(r=>r.itemId!==item.itemId);
assert.ok(item && other);
const options={index,records,itemId:item.itemId,from:'collection',to:'decorate'};
const negative=(reason,overrides={})=>{
 const result=resolveSharedItemLink({...options,...overrides});
 assert.equal(result.status,'unavailable');assert.equal(result.href,null);assert.equal(result.reason,reason);
};
test('01D-backed exact Switch1250 provenance and selected collection ItemID unify without creating a second item model',()=>{
 assert.equal(index.n,12552);assert.equal(index.shards.length,18);
 assert.equal(index.t.buildID,'52BD625D9B4E0053');
 assert.equal(collectionReferenceSelection(records,String(item.itemId)).status,'found');
 const link=resolveSharedItemLink({...options,sourceRecord:item,basePath:'/wand'});
 assert.equal(link.schema,ITEM_REFERENCE_LINK_SCHEMA);
 assert.equal(link.href,'/wand/explore/?item='+item.itemId);
 assert.deepEqual(link.identity,{kind:'DDV_ITEM_ID',itemId:item.itemId,...ITEM_REFERENCE_TARGET});
 assert.deepEqual(resolveSharedItemLink({...options,from:'decorate',to:'collection',targetRecord:item}).href,'/collection/?item='+item.itemId);
 assert.equal(link.identity.itemId,item.itemId);
});
test('decorating family membership is source-proven; character or unrelated Collection item cannot link to Explore',()=>{
 const character=decodeCollectionRecord(index,[10000002,3,0,4,[0],[7],[0],['Belle','Belle','Belle','Belle','Bella','ベル','贝儿','Bela']],'ja');
 negative('NOT_DECORATE_FAMILY',{records:[character],itemId:character.itemId});
});
test('unknown, malformed, duplicate and conflicting mapping are fail-closed',()=>{
 negative('UNKNOWN_ITEM_ID',{itemId:999999999});
 for(const v of ['1e4','01','-2','9007199254740992','prototype',null,0,{},123.45]){
  negative('INVALID_ITEM_ID',{itemId:v});
 }
 negative('AMBIGUOUS_ITEM_ID',{records:[item,...records]});
 negative('SOURCE_IDENTITY_CONFLICT',{sourceRecord:other});
 negative('TARGET_IDENTITY_CONFLICT',{targetRecord:{...item,worlds:['not-same']}});
 negative('TARGET_IDENTITY_CONFLICT',{targetRecord:{...item,universes:['not-same']}});
 negative('TARGET_IDENTITY_CONFLICT',{targetRecord:{...item,family:'Buildings'}});
 negative('INVALID_BASE_PATH',{basePath:'https://other.example/'});
});
test('different builds/manifest, unsupported versions and retired/unavailable references reject',()=>{
 negative('UNSUPPORTED_SOURCE_BUILD',{requestedTarget:{...ITEM_REFERENCE_TARGET,gameVersion:'1.25.3',buildID:'9A239D3DB569756D'}});
 negative('UNSUPPORTED_SOURCE_BUILD',{requestedTarget:{...ITEM_REFERENCE_TARGET,platform:'Steam'}});
 negative('UNSUPPORTED_SOURCE_BUILD',{index:{...index,a:'unknown-source'}});
 negative('UNSUPPORTED_SOURCE_BUILD',{index:{...index,t:{...index.t,buildID:'unknown'}}});
 negative('ITEM_UNAVAILABLE',{lifecycle:'RETIRED'});
 negative('ITEM_UNAVAILABLE',{lifecycle:'UNAVAILABLE'});
 negative('ITEM_LIFECYCLE_UNKNOWN',{lifecycle:'UNKNOWN'});
 assert.equal(resolveSharedItemLink({...options,lifecycle:'REFERENCE_ONLY'}).status,'linked');
});
test('room, touch-of-magic Design.Id, Gallery verified subject, Preset UUID never coerce to numeric ItemID',()=>{
 for(const itemId of ['house:1/floor:0/room:2','Design.Id=123','gallery-subject-123','preset-object-123','0123','18446744073709551615']){
  negative('INVALID_ITEM_ID',{itemId});
 }
 negative('UNKNOWN_ITEM_ID',{itemId:123});
});
test('World/Universe and name are facets, never implicit Tag or Set related edges',()=>{
 const unrelated=resolveRelatedItemLink({index,records,sourceItemId:item.itemId});
 assert.equal(unrelated.status,'unavailable');
 assert.equal(unrelated.reason,'UNVERIFIED_RELATED_IDENTITY');
 const fabricated=resolveRelatedItemLink({index,records,sourceItemId:item.itemId,
  relation:{kind:'TAG',sourceItemId:item.itemId,targetItemId:other.itemId,relationId:9,
  authority:'DEDUCED_FROM_WORLD',platform:ITEM_REFERENCE_TARGET.platform,
  gameVersion:ITEM_REFERENCE_TARGET.gameVersion,buildID:ITEM_REFERENCE_TARGET.buildID,
  evidenceSha256:'a'.repeat(64)}});
 assert.equal(fabricated.href,null);
 assert.equal(resolveRelatedItemLink({index,records,sourceItemId:item.itemId,relation:{
  kind:'TAG',sourceItemId:item.itemId,targetItemId:other.itemId,relationId:9,
  authority:'01D_VERIFIED_ITEM_RELATION',platform:ITEM_REFERENCE_TARGET.platform,
  gameVersion:ITEM_REFERENCE_TARGET.gameVersion,buildID:ITEM_REFERENCE_TARGET.buildID,
  evidenceSha256:'a'.repeat(64)
 }}).status,'linked');
});
test('Guide PRIVATE drafts, missing registry, unpublished, duplicate/mismatched relationship and unsafe external path deny',()=>{
 const common={index,records,itemId:item.itemId};
 const empty=resolvePublishedGuideItemLink(common);
 assert.equal(empty.href,null);
 const edge={kind:'DDV_ITEM_ID',itemId:item.itemId,pageId:'approved-page',
  status:'APPROVED_PUBLIC',...ITEM_REFERENCE_TARGET};
 const page={pageId:'approved-page',href:'/guide/systems/approved-item/',publicationState:'PUBLISHED_APPROVED',
  publicRouteApproved:true,...ITEM_REFERENCE_TARGET};
 for(const [approvedRelations,publishedPages] of [
  [[{...edge,status:'PRIVATE_DRAFT'}],[page]],
  [[edge],[{...page,publicationState:'PRIVATE_DRAFT'}]],
  [[edge],[{...page,href:'https://other.site/redirect'}]],
  [[edge],[{...page,buildID:'wrong'}]],
  [[edge,edge],[page]],
  [[edge],[page,page]]
 ]){
  assert.equal(resolvePublishedGuideItemLink({...common,approvedRelations,publishedPages}).href,null);
 }
 // This positive test is an explicitly injected hypothetical approved registry,
 // NOT a representation of currently published Guide data (public approved count=0).
 assert.equal(resolvePublishedGuideItemLink({...common,approvedRelations:[edge],publishedPages:[page]}).href,page.href);
});
