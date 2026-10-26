import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCollectionRuntime,decodeCollectionRecord,
  isVerifiedCollectionReferenceCapability,verifiedCollectionReferenceItem} from '../src/lib/collection/runtime.js';
import {collectionReferenceSelection} from '../src/lib/collection/reference-navigation.js';
import {
  ITEM_REFERENCE_LINK_SCHEMA,ITEM_REFERENCE_TARGET,DECORATE_ITEM_FAMILIES,
  resolveSharedItemLink,resolveSharedItemInboundLink,resolveRelatedItemLink,resolvePublishedGuideItemLink
} from '../src/lib/collection/shared-item-reference.js';

const base='static/ddv/collection/v1.25/';
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const files=async url=>{
 const data=readFileSync(base+String(url).split('/').at(-1));
 return {ok:true,arrayBuffer:async()=>ab(data)};
};
const loaded=await loadCollectionRuntime('',files);
const {index,rows,capability}=loaded;
const records=rows.map(row=>decodeCollectionRecord(index,row,'ja'));
const item=records.find(r=>DECORATE_ITEM_FAMILIES.includes(r.family));
const character=records.find(r=>!DECORATE_ITEM_FAMILIES.includes(r.family));
const other=records.find(r=>r.itemId!==item.itemId);
assert.ok(item&&character&&other);
const options={capability,itemId:item.itemId,identityKind:'DDV_ITEM_ID',from:'collection',to:'decorate'};
const negative=(reason,overrides={})=>{
 const result=resolveSharedItemLink({...options,...overrides});
 assert.equal(result.status,'unavailable');assert.equal(result.href,null);assert.equal(result.reason,reason);
};
const inbound=(q,overrides={})=>resolveSharedItemInboundLink({
 url:new URL('https://wand.invalid/explore/'+q),capability,...overrides
});
test('loader-issued opaque brand is backed by all 18 verified shards and 12,552 unique IDs',()=>{
 assert.equal(index.n,12552);assert.equal(index.shards.length,18);
 assert.equal(rows.length,12552);assert.equal(new Set(rows.map(row=>row[0])).size,12552);
 assert.equal(index.t.buildID,'52BD625D9B4E0053');
 assert.equal(isVerifiedCollectionReferenceCapability(capability),true);
 assert.equal(isVerifiedCollectionReferenceCapability({verified:true}),false);
 assert.equal(isVerifiedCollectionReferenceCapability(Object.assign(Object.create(null),capability)),false);
 assert.equal(Object.isFrozen(capability),true);
 const canonical=verifiedCollectionReferenceItem(capability,item.itemId);
 assert.equal(canonical.itemId,item.itemId);
 assert.equal(canonical.family,item.family);
 assert(Object.isFrozen(canonical));
 assert(Object.isFrozen(canonical.worlds));
 assert.equal(verifiedCollectionReferenceItem({},item.itemId),null);
});
test('authentic Switch1.25.0 canonical link Collection → Explore → Collection',()=>{
 assert.equal(collectionReferenceSelection(records,String(item.itemId)).status,'found');
 const link=resolveSharedItemLink({...options,sourceRecord:item,basePath:'/wand'});
 assert.equal(link.schema,ITEM_REFERENCE_LINK_SCHEMA);
 assert.equal(link.href,'/wand/explore/?item='+item.itemId);
 assert.deepEqual(link.identity,{kind:'DDV_ITEM_ID',itemId:item.itemId,...ITEM_REFERENCE_TARGET});
 assert.equal(resolveSharedItemLink({...options,from:'decorate',to:'collection',targetRecord:item}).href,
  '/collection/?item='+item.itemId);
 assert.equal(inbound('?item='+item.itemId).status,'linked');
 assert.equal(inbound('?item='+item.itemId+'&version=1.25.0&buildID=52BD625D9B4E0053').status,'linked');
});
test('QR196 RED reversed: no arbitrary index, forged rows, partial corpus, fake verified flag or counterfeit capability',()=>{
 const unseen=7890123456789;
 assert.equal(verifiedCollectionReferenceItem(capability,unseen),null);
 const forged={itemId:unseen,family:'Furniture',worlds:['IsDreamlightValley'],universes:[],expansions:['BaseGame']};
 const indexCopy=structuredClone(index);
 for(const opts of [
  {index:indexCopy,records:[forged]},
  {index:indexCopy,records:[forged],verified:true},
  {capability:{verified:true}},
  {capability:structuredClone(capability)},
  {capability:null},
  {capability:true},
  {capability,records:[forged]},
  {capability,index:indexCopy},
  {capability,verified:true}
 ]){
  const result=resolveSharedItemLink({...options,...opts,itemId:unseen});
  assert.equal(result.reason,'UNVERIFIED_SOURCE_DATASET',JSON.stringify(Object.keys(opts)));
  const incoming=inbound('?item='+unseen,opts);
  assert.equal(incoming.reason,'UNVERIFIED_SOURCE_DATASET',JSON.stringify(Object.keys(opts)));
 }
 negative('UNKNOWN_ITEM_ID',{itemId:unseen});
 negative('UNKNOWN_ITEM_ID',{itemId:123});
 negative('UNKNOWN_ITEM_ID',{itemId:unseen,sourceRecord:forged});
 negative('UNKNOWN_ITEM_ID',{itemId:unseen,targetRecord:forged});
 const cloned=Object.assign(Object.create(null),capability);
 negative('UNVERIFIED_SOURCE_DATASET',{capability:cloned});
});
test('validated items cannot be given mismatched identity, facets, build or lifecycle',()=>{
 negative('NOT_DECORATE_FAMILY',{itemId:character.itemId});
 negative('SOURCE_IDENTITY_CONFLICT',{sourceRecord:other});
 negative('TARGET_IDENTITY_CONFLICT',{targetRecord:{...item,worlds:['not-same']}});
 negative('TARGET_IDENTITY_CONFLICT',{targetRecord:{...item,universes:['not-same']}});
 negative('TARGET_IDENTITY_CONFLICT',{targetRecord:{...item,family:'Buildings'}});
 negative('UNSUPPORTED_SOURCE_BUILD',{requestedTarget:{...ITEM_REFERENCE_TARGET,gameVersion:'1.25.3',buildID:'9A239D3DB569756D'}});
 negative('UNSUPPORTED_SOURCE_BUILD',{requestedTarget:{...ITEM_REFERENCE_TARGET,platform:'Steam'}});
 negative('UNSUPPORTED_SOURCE_BUILD',{requestedTarget:{...ITEM_REFERENCE_TARGET,buildID:'unknown'}});
 negative('UNSUPPORTED_IDENTITY_KIND',{identityKind:'ROOM_LOCAL_ID'});
 negative('UNSUPPORTED_IDENTITY_KIND',{identityKind:'DESIGN_ID'});
 negative('UNSUPPORTED_IDENTITY_KIND',{identityKind:'GALLERY_VERIFIED_SUBJECT'});
 negative('UNSUPPORTED_IDENTITY_KIND',{identityKind:'PRESET_OBJECT_ID'});
 negative('UNSUPPORTED_IDENTITY_KIND',{identityKind:undefined});
 negative('ITEM_UNAVAILABLE',{lifecycle:'RETIRED'});
 negative('ITEM_UNAVAILABLE',{lifecycle:'UNAVAILABLE'});
 negative('ITEM_UNAVAILABLE',{lifecycle:'WITHDRAWN'});
 negative('ITEM_LIFECYCLE_UNKNOWN',{lifecycle:'UNKNOWN'});
 negative('INVALID_BASE_PATH',{basePath:'https://untrusted.invalid/'});
 assert.equal(resolveSharedItemLink({...options,lifecycle:'REFERENCE_ONLY'}).status,'linked');
});
test('canonical numeric ID and unsupported inbound queries rejected',()=>{
 for(const id of ['1e4','01','-2','9007199254740992','prototype',null,0,{},123.45,'house:1/floor:0','Design.Id=123']){
  negative('INVALID_ITEM_ID',{itemId:id});
 }
 for(const q of [
  '?item='+item.itemId+'&item='+item.itemId,
  '?item='+item.itemId+'&version=1.25.0&version=1.25.0',
  '?item='+item.itemId+'&buildID=52BD625D9B4E0053&buildID=52BD625D9B4E0053',
  '?item='+item.itemId+'&view=world','?item=0'+item.itemId,'?item=',
  '?item='+item.itemId+'&item%00=wrong'
 ]) assert.equal(inbound(q).href,null,q);
 assert.equal(inbound('?item='+item.itemId+'&version=1.25.3').reason,'UNSUPPORTED_SOURCE_BUILD');
 assert.equal(inbound('?item='+item.itemId+'&buildID=wrong').reason,'UNSUPPORTED_SOURCE_BUILD');
});
test('QR196 alleged TAG/SET and Guide public registries always fail closed without independent issuer',()=>{
 const fake={kind:'TAG',sourceItemId:item.itemId,targetItemId:other.itemId,relationId:5,
  authority:'01D_VERIFIED_ITEM_RELATION',...ITEM_REFERENCE_TARGET,evidenceSha256:'b'.repeat(64)};
 const edge={kind:'DDV_ITEM_ID',itemId:item.itemId,pageId:'fabricated-reviewed-page',
  status:'APPROVED_PUBLIC',...ITEM_REFERENCE_TARGET};
 const page={pageId:edge.pageId,href:'/guide/systems/fabricated-reviewed-page/',
  publicationState:'PUBLISHED_APPROVED',publicRouteApproved:true,...ITEM_REFERENCE_TARGET};
 for(const params of [
   {capability,sourceItemId:item.itemId,relation:fake,reviewedRelations:[fake]},
   {index,records,sourceItemId:item.itemId,relation:fake,reviewedRelations:[fake]},
   {capability,sourceItemId:item.itemId}
 ]) {
  assert.equal(resolveRelatedItemLink(params).reason,'UNVERIFIED_RELATED_IDENTITY');
  assert.equal(resolveRelatedItemLink(params).href,null);
 }
 for(const params of [
   {capability,itemId:item.itemId,approvedRelations:[edge],publishedPages:[page]},
   {index,records,itemId:item.itemId,approvedRelations:[edge],publishedPages:[page]},
   {capability,itemId:item.itemId}
 ]) {
  assert.equal(resolvePublishedGuideItemLink(params).reason,'GUIDE_RELATION_UNAPPROVED');
  assert.equal(resolvePublishedGuideItemLink(params).href,null);
 }
});
