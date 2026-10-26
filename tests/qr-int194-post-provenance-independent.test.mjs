import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCollectionRuntime, decodeCollectionRecord, isVerifiedCollectionReferenceCapability, verifiedCollectionReferenceItem } from '../src/lib/collection/runtime.js';
import { DECORATE_ITEM_FAMILIES, ITEM_REFERENCE_TARGET, resolveSharedItemLink, resolveSharedItemInboundLink, resolveRelatedItemLink, resolvePublishedGuideItemLink } from '../src/lib/collection/shared-item-reference.js';

const root='static/ddv/collection/v1.25/';
const fetchFixture=async url=>{
  const bytes=readFileSync(root+String(url).split('/').at(-1));
  return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
};
let verifiedPromise;
async function loadVerified(){
  verifiedPromise??=loadCollectionRuntime('',fetchFixture);
  return verifiedPromise;
}
const link=(options)=>resolveSharedItemLink({identityKind:'DDV_ITEM_ID',from:'collection',to:'decorate',...options});
const inbound=(itemId,options={})=>resolveSharedItemInboundLink({
  url:new URL('https://wand.invalid/explore/?item='+itemId),...options
});
const denied=(result,context)=>{assert.equal(result.status,'unavailable',context);assert.equal(result.href,null,context);};
async function oneDecoratingItem(){
  const loaded=await loadVerified();
  const row=loaded.rows.find(x=>DECORATE_ITEM_FAMILIES.includes(loaded.index.f[x[1]]));
  assert(row);
  return {loaded,id:row[0],item:decodeCollectionRecord(loaded.index,row,'en')};
}

test('POST_PROVENANCE_01 canonical fully verified 18-shard Loader gives opaque noncopyable capability and both directional Item links',async()=>{
  const {loaded,id,item}=await oneDecoratingItem();
  assert.equal(loaded.rows.length,12552);
  assert.equal(loaded.index.shards.length,18);
  assert.equal(isVerifiedCollectionReferenceCapability(loaded.capability),true);
  assert.equal(Object.isFrozen(loaded.capability),true);
  assert.equal(verifiedCollectionReferenceItem(loaded.capability,id).itemId,id);
  const forward=link({capability:loaded.capability,itemId:id,sourceRecord:item});
  assert.equal(forward.status,'linked');
  assert.equal(forward.href,'/explore/?item='+id);
  assert.deepEqual(forward.identity,{kind:'DDV_ITEM_ID',itemId:id,...ITEM_REFERENCE_TARGET});
  const reverse=link({capability:loaded.capability,itemId:id,identityKind:'DDV_ITEM_ID',from:'decorate',to:'collection',targetRecord:item});
  assert.equal(reverse.status,'linked');assert.equal(reverse.href,'/collection/?item='+id);
  const incoming=inbound(id,{capability:loaded.capability});
  assert.equal(incoming.status,'linked');assert.equal(incoming.href,forward.href);
});

test('POST_PROVENANCE_02 forged Index/Rows, valid-looking target, alleged attested flags and cloned/proxied handles yield no link',async()=>{
  const {loaded,id,item}=await oneDecoratingItem();
  const fakeId=7890123456789;
  assert.equal(verifiedCollectionReferenceItem(loaded.capability,fakeId),null);
  const fake={...item,itemId:fakeId,label:'UNTRUSTED_SOURCE_RECORD'};
  const claims=[
    undefined,null,{},structuredClone(loaded.capability),
    {verified:true,validated:true,source:'loadCollectionRuntime',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},
    {capability:loaded.capability,verified:true},
    new Proxy(loaded.capability,{})
  ];
  for(const claimedCapability of claims){
    assert.equal(isVerifiedCollectionReferenceCapability(claimedCapability),false);
    const options={index:structuredClone(loaded.index),records:[fake],rows:[fake],
      itemId:fakeId,capability:claimedCapability,verified:true,verifiedIndex:true,verifiedRows:true,
      sourceVerified:true,manifestVerified:true,requestedTarget:ITEM_REFERENCE_TARGET};
    denied(link(options),'forged forward handle');
    denied(inbound(fakeId,options),'forged inbound handle');
  }
  denied(link({index:structuredClone(loaded.index),records:[item],itemId:id,verified:true}),'canonical-looking index subset lacks genuine capability');
});

test('POST_PROVENANCE_03 partial corpus, post-fetch mutation, duplicate ID and reserialized index never mint new authority',async()=>{
  const {loaded,id,item}=await oneDecoratingItem();
  const other=loaded.rows.find(x=>x[0]!==id);
  assert(other);
  const falseId=7890123456789;
  const partial=loaded.rows.slice(0,1);
  denied(link({index:loaded.index,rows:partial,records:[item],itemId:id}),'partial rows no capability');
  const mutableRows=structuredClone(loaded.rows);
  mutableRows[0][0]=falseId;
  mutableRows[1][0]=mutableRows[0][0];
  denied(link({index:loaded.index,rows:mutableRows,records:[{...item,itemId:falseId}],itemId:falseId}),'duplicate/mutated rows no capability');
  denied(link({capability:loaded.capability,index:loaded.index,rows:mutableRows,
    records:[{...item,itemId:falseId}],itemId:falseId}),'capability does not delegate new authority to mutated rows');
  const modifiedIndex=structuredClone(loaded.index);
  modifiedIndex.t.buildID='52BD625D9B4E0053';
  modifiedIndex.n=1;
  denied(link({index:modifiedIndex,rows:partial,records:[item],itemId:id}),'relabelled index no capability');
  denied(link({capability:loaded.capability,itemId:id,sourceRecord:{...item,worlds:['FORGED_WORLD']}}),'stale/mutated record conflicts with verified snapshot');
  const canonical=link({capability:loaded.capability,itemId:id,sourceRecord:item});
  assert.equal(canonical.status,'linked','canonical capability remains nonmutable by caller changes');
});

test('POST_PROVENANCE_04 different build/version/identity/URL and unknown/foreign ID fail closed under genuine capability',async()=>{
  const {loaded,id}=await oneDecoratingItem();
  const cap=loaded.capability;
  for(const patch of [
    {requestedTarget:{...ITEM_REFERENCE_TARGET,gameVersion:'1.25.3'}},
    {requestedTarget:{...ITEM_REFERENCE_TARGET,platform:'Steam'}},
    {requestedTarget:{...ITEM_REFERENCE_TARGET,buildID:'NOT_SWITCH_BID'}}
  ]) denied(link({capability:cap,itemId:id,...patch}),'wrong build');
  for(const kind of ['ROOM_LOCAL_ID','DESIGN_ID','GALLERY_VERIFIED_SUBJECT','PRESET_OBJECT_ID'])
    denied(link({capability:cap,itemId:id,identityKind:kind}),'wrong identity '+kind);
  denied(link({capability:cap,itemId:7890123456789}),'absent id cannot link even under real capability');
  for(const q of ['?item='+id+'&item='+id,'?item='+id+'&version=1.25.3','?item='+id+'&buildID=FALSE','?item='+id+'&kind=DDV_ITEM_ID']){
    const result=resolveSharedItemInboundLink({url:new URL('https://wand.invalid/explore/'+q),capability:cap});
    denied(result,q);
  }
});

test('POST_PROVENANCE_05 caller-controlled Tag/Set and Guide Approved arrays never publish a positive edge',async()=>{
  const {loaded,id}=await oneDecoratingItem();
  const other=loaded.rows.find(x=>x[0]!==id)[0];
  const relation={kind:'TAG',sourceItemId:id,targetItemId:other,relationId:5,
    authority:'01D_VERIFIED_ITEM_RELATION',evidenceSha256:'b'.repeat(64),...ITEM_REFERENCE_TARGET};
  const fakePageEdge={kind:'DDV_ITEM_ID',itemId:id,pageId:'fake-approval',status:'APPROVED_PUBLIC',...ITEM_REFERENCE_TARGET};
  const fakePage={pageId:'fake-approval',href:'/guide/systems/fake-approval/',publicationState:'PUBLISHED_APPROVED',
    publicRouteApproved:true,...ITEM_REFERENCE_TARGET};
  for(const cap of [null,loaded.capability]){
    denied(resolveRelatedItemLink({capability:cap,index:loaded.index,records:loaded.rows,
      sourceItemId:id,relation,reviewedRelations:[relation],verifiedRegistry:true}),'related registry not issuer');
    denied(resolvePublishedGuideItemLink({capability:cap,index:loaded.index,records:loaded.rows,
      itemId:id,approvedRelations:[fakePageEdge],publishedPages:[fakePage],verifiedRegistry:true}),'Guide registry not issuer');
  }
});

test('POST_PROVENANCE_06 real Collection and Explore routes use verified Loader capability, preserve read-only semantics',()=>{
  const collection=readFileSync('src/routes/collection/+page.svelte','utf8');
  const explore=readFileSync('src/routes/explore/+page.svelte','utf8');
  assert.match(collection,/loadCollectionRuntime\(base\)/);
  assert.match(explore,/loadCollectionRuntime\(base\)/);
  assert.match(collection,/verifiedCapability\s*=\s*loaded\.capability/);
  assert.match(explore,/verifiedCapability\s*=\s*loaded\.capability/);
  assert.match(collection,/resolveSharedItemLink\(\{[\s\S]*?capability:verifiedCapability/);
  assert.match(explore,/resolveSharedItemInboundLink\(\{[\s\S]*?capability:loaded\.capability/);
  assert.match(collection,/!invalidUrl\s*&&\s*verifiedCapability/);
  assert.match(collection,/request\s*!==\s*loadSequence/);
  for(const s of [collection,explore]){
    assert(!/resolveRelatedItemLink\(|resolvePublishedGuideItemLink\(/.test(s));
  }
  const helper=readFileSync('src/lib/collection/shared-item-reference.js','utf8');
  assert(!/owned:|discovered:|premiumOwned:|dlcOwned:/i.test(helper));
  assert(!/createSignedUrl|storage\.remove|nativeSaveWriter|applyNativePlacement/.test(helper));
  console.log('QR_INT194_POST_PROVENANCE_SOURCE_ONLY_READONLY_VERDICT');
});
