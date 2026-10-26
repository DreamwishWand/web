import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCollectionRuntime,decodeCollectionRecord} from '../src/lib/collection/runtime.js';
import {
 ITEM_REFERENCE_TARGET,DECORATE_ITEM_FAMILIES,
 resolveSharedItemLink,resolveSharedItemInboundLink,resolveRelatedItemLink,resolvePublishedGuideItemLink
} from '../src/lib/collection/shared-item-reference.js';

const root='static/ddv/collection/v1.25/';
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const fetchSource=async url=>{const name=String(url).split('/').at(-1);const data=readFileSync(root+name);return{ok:true,arrayBuffer:async()=>ab(data)};};
let dataPromise=null;
async function verified(){
 dataPromise??=loadCollectionRuntime('',fetchSource);
 const {index,rows}=await dataPromise;
 return {index,records:rows.map(row=>decodeCollectionRecord(index,row,'en'))};
}
const inbound=(url,index,records)=>resolveSharedItemInboundLink({url:new URL(url,'https://wand.invalid'),index,records});
test('INT194 consumer graph accepts only actual Loader-returned complete projection, not partial facade in Collection/Explore UI',async()=>{
 const {index,records}=await verified();
 assert.equal(records.length,12552);
 const item=records.find(x=>DECORATE_ITEM_FAMILIES.includes(x.family));
 assert(item);
 const source=readFileSync('src/routes/collection/+page.svelte','utf8');
 const explore=readFileSync('src/routes/explore/+page.svelte','utf8');
 for(const ui of [source,explore]){
  assert.match(ui,/loadCollectionRuntime\(base\)/);
  assert.match(ui,/runtimeIndex\s*=\s*loaded\.index/);
  assert.match(ui,/rawRows\s*=\s*loaded\.rows/);
  assert(!/JSON\.parse\([^)]*index\.json/.test(ui));
 }
 assert.match(explore,/resolveSharedItemInboundLink\(\{\s*url:incoming,index:loaded\.index,records:decoded/);
 assert.match(source,/\$: decorateLink = !invalidUrl && runtimeIndex && itemSelection\.status === 'found' \? resolveSharedItemLink/);
 const link=resolveSharedItemLink({index,records,itemId:item.itemId,identityKind:'DDV_ITEM_ID',from:'collection',to:'decorate'});
 assert.equal(link.status,'linked');
 assert.equal(link.href,'/explore/?item='+item.itemId);
 assert.deepEqual(link.identity,{kind:'DDV_ITEM_ID',itemId:item.itemId,...ITEM_REFERENCE_TARGET});
 const back=resolveSharedItemLink({index,records,itemId:item.itemId,identityKind:'DDV_ITEM_ID',from:'decorate',to:'collection'});
 assert.equal(back.href,'/collection/?item='+item.itemId);
});
test('INT194 inbound cross-version/build pollution, encoding noncanonical, multiple item/version/build keys are refused with exact reason class',async()=>{
 const {index,records}=await verified();
 const id=records.find(x=>DECORATE_ITEM_FAMILIES.includes(x.family)).itemId;
 const origin='https://wand.invalid/explore/';
 for(const qs of [
  '?item='+id+'&item='+id,'?item='+id+'&version=1.25.0&version=1.25.0',
  '?item='+id+'&buildID=52BD625D9B4E0053&buildID=52BD625D9B4E0053',
  '?item='+id+'&identityKind=DDV_ITEM_ID','?item='+id+'&kind=ROOM_LOCAL_ID',
  '?item='+id+'&Version=1.25.0','?item='+id+'&buildID=',
  '?item='+id+'&version=', '?item='+id+'&item%00=evil',
  '?item=+0'+id,'?item=1e6','?item='+id+'.0','?item=-'+id,
  '?item='+id+'&buildID=9A239D3DB569756D',
  '?item='+id+'&version=1.25.3',
  '?item='+id+'&version=Steam'
 ]){
  const result=inbound(origin+qs,index,records);
  assert.equal(result.status,'unavailable',qs);
  assert.equal(result.href,null);
 }
 const valid=inbound(origin+'?buildID=52BD625D9B4E0053&item='+id+'&version=1.25.0',index,records);
 assert.equal(valid.status,'linked');
 for(const kind of ['ROOM_LOCAL_ID','GALLERY_VERIFIED_SUBJECT','PRESET_OBJECT_ID','DESIGN_ID'])
  assert.equal(resolveSharedItemLink({index,records,itemId:id,identityKind:kind,from:'collection',to:'decorate'}).status,'unavailable');
});
test('INT194 caller-provided unverified Index+Rows trust counterexample: direct exported resolver accepts a fabricated ItemID absent from verified corpus',async()=>{
 const {index,records}=await verified();
 const unseen=7890123456789;
 assert(!records.some(x=>x.itemId===unseen));
 const synthetic={itemId:unseen,label:'FALSE_VERIFIED_FURNITURE',family:'Furniture',
  worlds:['IsDreamlightValley'],universes:[],expansions:['BaseGame']};
 const passedIndex=structuredClone(index);
 const call={index:passedIndex,records:[synthetic],itemId:unseen,identityKind:'DDV_ITEM_ID',
  from:'collection',to:'decorate'};
 const forged=resolveSharedItemLink(call);
 assert.equal(forged.status,'linked');
 assert.equal(forged.href,'/explore/?item='+unseen);
 const inboundForged=inbound('https://wand.invalid/explore/?item='+unseen,passedIndex,[synthetic]);
 assert.equal(inboundForged.status,'linked');
 console.log('QR_INT194_RED_DIRECT_UNVERIFIED_MANUAL_INDEX_RECORDS_LINKED',JSON.stringify({
  verifiedLoaderContainsId:false,manualIndexShapeReused:true,manualRecordsOnly:true,
  exportedResolverLinked:true,exportedInboundLinked:true,
  currentCollectionExploreConsumerVerifiedLoader:true,publicBrowserExploitDemonstrated:false
 }));
});
test('INT194 Related/Guide default zero registries deny; injecting alleged registry is not an attested SHA-reviewed registry',async()=>{
 const {index,records}=await verified();
 const source=records.find(x=>DECORATE_ITEM_FAMILIES.includes(x.family));
 const other=records.find(x=>x.itemId!==source.itemId);
 const emptyTag=resolveRelatedItemLink({index,records,sourceItemId:source.itemId});
 const emptyGuide=resolvePublishedGuideItemLink({index,records,itemId:source.itemId});
 assert.equal(emptyTag.href,null);assert.equal(emptyGuide.href,null);
 const fake={kind:'TAG',sourceItemId:source.itemId,targetItemId:other.itemId,relationId:5,
  authority:'01D_VERIFIED_ITEM_RELATION',...ITEM_REFERENCE_TARGET,evidenceSha256:'b'.repeat(64)};
 const injected=resolveRelatedItemLink({index,records,sourceItemId:source.itemId,relation:fake,reviewedRelations:[fake]});
 assert.equal(injected.status,'linked');
 const rel={kind:'DDV_ITEM_ID',itemId:source.itemId,pageId:'fabricated-reviewed-page',
  status:'APPROVED_PUBLIC',...ITEM_REFERENCE_TARGET};
 const page={pageId:rel.pageId,href:'/guide/systems/fabricated-reviewed-page/',
  publicationState:'PUBLISHED_APPROVED',publicRouteApproved:true,...ITEM_REFERENCE_TARGET};
 const injectedGuide=resolvePublishedGuideItemLink({index,records,itemId:source.itemId,approvedRelations:[rel],publishedPages:[page]});
 assert.equal(injectedGuide.status,'linked');
 const collection=readFileSync('src/routes/collection/+page.svelte','utf8');
 const explore=readFileSync('src/routes/explore/+page.svelte','utf8');
 assert(!/resolveRelatedItemLink|resolvePublishedGuideItemLink/.test(collection+explore));
 assert(!/Owned|Discovered/.test(JSON.stringify(injected)));
 console.log('QR_INT194_REVIEW_REGISTRY_NOT_VERIFIED_BY_RAW_HELPER_INPUT',JSON.stringify({
  liveDefaultRelatedHref:null,liveDefaultGuideHref:null,
  injectedUnattestedRelationLinked:true,injectedUnattestedGuideLinked:true,
  noRegisteredUIConsumer:true,publishedGuideActualApproval:false
 }));
});
test('INT194 Explore source only shows inbound Quick Review after canonical Loader + exact identity, never entitlement or publisher',()=>{
 const source=readFileSync('src/routes/explore/+page.svelte','utf8');
 assert.match(source,/const \[loaded,binding\]=await Promise\.all/);
 assert.match(source,/if\(reference\.status==='linked'\)/);
 assert.match(source,/selectedItem=decoded\.find/);
 assert.match(source,/const reference=resolveSharedItemInboundLink/);
 const shared=readFileSync('src/lib/collection/shared-item-reference.js','utf8');
 assert(!/owned:|discovered:|premiumOwned:|dlcOwned:/i.test(shared));
 assert(!/createSignedUrl|storage\.remove|galleryPublish/.test(shared));
});
