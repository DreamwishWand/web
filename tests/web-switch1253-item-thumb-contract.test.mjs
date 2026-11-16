import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SWITCH1253_ITEM_IMAGE_SCHEMA,SWITCH1253_TARGET,
 SWITCH1253_ITEM_IMAGE_VARIANT,SWITCH1253_ORIGINAL_BUNDLE_SHA256,
 SWITCH1253_REVIEWED_RELEASE,SWITCH1253_NATIVE_PINS,SWITCH1253_OWNER_SCOPE,
 validateSwitch1253ItemImageCatalog,switch1253ItemImagePath,
 scopedSwitch1253ItemImageHref,loadSwitch1253PublicItemImageSource,
 prepareSwitch1253ItemImageManifest,SWITCH1253_PREPARED_WEBP_SIZES,
 createSwitch1253ManifestController,attachSwitch1253ManifestLifecycle,SWITCH1253_MANIFEST_REFRESH_MS
} from '../src/lib/item-media/switch1253-public-item-images.mjs';

import {ITEM_IMAGE_OWNER_DECISION_ID} from '../src/lib/item-media/public-item-images.mjs';
const item='40000047';
const quarantined='40006096';
const pin=SWITCH1253_NATIVE_PINS[item];
function approvedRelease(){
 // Synthetic authorization fixture, NOT a real accepted licence or prod flag.
 return {
  mediaPublic:true,decisionId:ITEM_IMAGE_OWNER_DECISION_ID,scope:SWITCH1253_OWNER_SCOPE,
  rightsHolderLicense:'DOCUMENTED_SCOPE_LICENSE',licenseEvidenceSha256:'a'.repeat(64),
  rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',
  takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
  attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',
  operatorReceiptSha256:'b'.repeat(64),
  items:{[item]:{
    originalNativeStreamSha256:pin.originalNativeStreamSha256,
    sourcePngSha256:pin.sourcePngSha256,webpSha256:pin.webpSha256,
    rightsStatus:'DOCUMENTED_LICENSE_APPROVED',publicationDecision:'OWNER_SCOPED_PUBLICATION_ACCEPTED',
    visibility:'RELEASED_PLAYER_FACING'
  }}
 };
}
function manifest(){
 return {
  schema:SWITCH1253_ITEM_IMAGE_SCHEMA,
  assetVariant:SWITCH1253_ITEM_IMAGE_VARIANT,
  codec:'WEBP_LOSSLESS_RGBA_EXACT',format:'webp',lossless:true,
  source:{...SWITCH1253_TARGET,originalBundleSha256:SWITCH1253_ORIGINAL_BUNDLE_SHA256},
  target:{...SWITCH1253_TARGET},
  publication:{gate:'MEDIA_PUBLIC_SCOPED_ON',decisionId:ITEM_IMAGE_OWNER_DECISION_ID,
    scope:SWITCH1253_OWNER_SCOPE,rightsHolderLicense:'DOCUMENTED_SCOPE_LICENSE',
    licenseEvidenceSha256:'a'.repeat(64),rightsReview:'OPERATOR_ACCEPTED',
    receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
    attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',
    operatorReceiptSha256:'b'.repeat(64)},
  items:{[item]:{
    ...pin,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',
    visibility:'RELEASED_PLAYER_FACING',
    rightsStatus:'DOCUMENTED_LICENSE_APPROVED',publicationDecision:'OWNER_SCOPED_PUBLICATION_ACCEPTED',
    assetStatus:'WEBP_LOSSLESS_VERIFIED_160'
  }}
 };
}
test('current Switch 1.25.3 BID/schema626 source explicitly unapproved in real runtime',async()=>{
 assert.equal(SWITCH1253_TARGET.buildID,'9A239D3DB569756D');
 assert.equal(SWITCH1253_TARGET.schema,626);
 assert.equal(SWITCH1253_REVIEWED_RELEASE.mediaPublic,false);
 assert.deepEqual(Object.keys(SWITCH1253_REVIEWED_RELEASE.items),[]);
 assert.deepEqual(Object.keys(SWITCH1253_NATIVE_PINS),['40000047','40006096']);
 assert.equal(SWITCH1253_NATIVE_PINS['40000047'].rasterStatus,'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE');
 assert.equal(SWITCH1253_NATIVE_PINS['40002422'],undefined,'hidden, independently excluded');
 assert.throws(()=>validateSwitch1253ItemImageCatalog(manifest()),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
 let requested=0;
 const fake=async()=>{requested++;throw new Error('OFF must not request');};
 assert.equal(await loadSwitch1253PublicItemImageSource('/web',fake),null);
 assert.equal(requested,0);
});
test('synthetic reviewed manifest renders only same-BID registered one-item immutable path',()=>{
 const m=manifest();
 const valid=validateSwitch1253ItemImageCatalog(m,approvedRelease());
 const part='ddv/item-images/'+SWITCH1253_ITEM_IMAGE_VARIANT+'/' +
  pin.originalNativeStreamSha256.slice(0,2)+'/'+pin.originalNativeStreamSha256+'-'+
  pin.sourcePngSha256+'-'+pin.webpSha256+'.webp';
 assert.equal(valid.count,1);
 assert.equal(switch1253ItemImagePath(item,valid),part);
 assert.equal(scopedSwitch1253ItemImageHref('/web',item,valid),'/web/'+part);
 assert.equal(scopedSwitch1253ItemImageHref('',item,valid),'/'+part);
 for(const bad of ['40006096','40002422','1','00040000047','../../../img.png',0])
   assert.equal(scopedSwitch1253ItemImageHref('/web',bad,valid),null);
 for(const path of ['https://bad.example','/web/../','//bad/path','/web?q=x'])
   assert.equal(scopedSwitch1253ItemImageHref(path,item,valid),null);
 assert.doesNotMatch(part,/v1\.24\.13|r39|schema624|quality88/);
});
test('old R39/schema624/Steam/other BID/unknown game build never promote a current ItemThumb',()=>{
 for(const key of ['platform','gameVersion','buildID','schema']){
  const wrong={...manifest(),target:{...SWITCH1253_TARGET,[key]:{
   platform:'Steam',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',schema:624
  }[key]}};
  assert.throws(()=>validateSwitch1253ItemImageCatalog(wrong,approvedRelease()),/PLATFORM_VERSION_BID_SCHEMA/);
 }
 for(const source of [
  {...SWITCH1253_TARGET,originalBundleSha256:'a'.repeat(64),generation:'R39'},
  {platform:'Steam',gameVersion:'1.25.3',buildID:'9A239D3DB569756D',schema:626,
   originalBundleSha256:SWITCH1253_ORIGINAL_BUNDLE_SHA256},
  {platform:'Nintendo Switch',gameVersion:'1.24.13',buildID:'52BD625D9B4E0053',
   schema:624,originalBundleSha256:SWITCH1253_ORIGINAL_BUNDLE_SHA256}
 ])assert.throws(()=>validateSwitch1253ItemImageCatalog({...manifest(),source},approvedRelease()),/PLATFORM_VERSION_BID_SCHEMA/);
});
test('unreviewed eligible sprite, hidden sprite, unknown item, SHA or pixel mismatch and Rights OFF all deny',()=>{
 for(const id of ['40002422','999000123']){
  const m=manifest();m.items={[id]:{...m.items[item]}};
  assert.throws(()=>validateSwitch1253ItemImageCatalog(m,approvedRelease()),/ITEM_ID_NATIVE_SHA/);
 }
 for(const property of ['originalNativeStreamSha256','sourcePngSha256','webpSha256',
  'pixelStatus','rasterStatus','visibility','rightsStatus','assetStatus']){
  const m=manifest();
  m.items[item]={...m.items[item],[property]:property.endsWith('Sha256')?'a'.repeat(64):'UNKNOWN'};
  assert.throws(()=>validateSwitch1253ItemImageCatalog(m,approvedRelease()),/ITEM_ID_NATIVE_SHA/);
 }
 for(const releaseKey of ['mediaPublic','rightsHolderLicense','rightsReview',
  'receivingContact','takedown','managedHttps']){
  const r=approvedRelease();r[releaseKey]=releaseKey==='mediaPublic'?false:'NOT_RUN';
  assert.throws(()=>validateSwitch1253ItemImageCatalog(manifest(),r),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
 }
 for(const key of ['gate','rightsReview','managedHttps','takedown','receivingContact']){
  const m=manifest();m.publication[key]='UNKNOWN';
  assert.throws(()=>validateSwitch1253ItemImageCatalog(m,approvedRelease()),/MANIFEST_PUBLICATION_UNVERIFIED/);
 }
 for(const variant of ['r39-lossy-q88','webp-lossless-160-v1','switch-1.25.0']){
  const m=manifest();m.assetVariant=variant;
  assert.throws(()=>validateSwitch1253ItemImageCatalog(m,approvedRelease()),/PIXEL_FORMAT_OR_VARIANT/);
 }
 const empty=manifest();empty.items={};
 assert.throws(()=>validateSwitch1253ItemImageCatalog(empty,approvedRelease()),/MAPPING_EMPTY/);
});
test('QA806 fixed: every manifested rasterStatus must exactly match the pinned Native raster proof',()=>{
 const positive=manifest();
 assert.equal(positive.items[item].rasterStatus,pin.rasterStatus);
 assert.equal(validateSwitch1253ItemImageCatalog(positive,approvedRelease()).count,1);
 for(const status of [
   'UNVERIFIED','UNKNOWN','NOT_RUN_FORMAT50_DECODE','SWITCH_DXT5_RGBA_EXACT_PUBLIC',
   pin.rasterStatus+' ',null,undefined,false,0
 ]){
   const candidate=manifest();
   candidate.items[item]={...candidate.items[item],rasterStatus:status};
   assert.throws(
     ()=>validateSwitch1253ItemImageCatalog(candidate,approvedRelease()),
     /SWITCH1253_ITEM_IMAGE_ITEM_ID_NATIVE_SHA_RGBA_RELEASE_OR_RIGHTS_UNVERIFIED/,
     'rasterStatus must not be inferred from pinned SHA, value='+String(status)
   );
 }
 const missing=manifest();
 delete missing.items[item].rasterStatus;
 assert.throws(()=>validateSwitch1253ItemImageCatalog(missing,approvedRelease()),
   /SWITCH1253_ITEM_IMAGE_ITEM_ID_NATIVE_SHA_RGBA_RELEASE_OR_RIGHTS_UNVERIFIED/);
});

test('existing shared ItemThumb is the only Collection/Explore/Detail renderer; 8locale/preferences stay',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 for(const route of ['../src/routes/collection/+page.svelte',
  '../src/routes/explore/+page.svelte','../src/lib/entity/SharedEntityDetail.svelte']){
  assert.match(read(route),/ItemThumb/);
 }
 const thumb=read('../src/lib/ui/ItemThumb.svelte');
 const prefs=read('../src/lib/ui/ItemImagePreferences.svelte');
 const old=read('../src/lib/item-media/public-item-images.mjs');
 const script=read('../scripts/web-shared-catalog-e2e-chrome.mjs');
 assert.match(thumb,/switch1253PublicItemImageSource/);
 assert.match(thumb,/scopedSwitch1253ItemImageHref/);
 assert.match(thumb,/loading="lazy"/);
 assert.match(thumb,/data-media-status/);
 assert.match(thumb,/style:object-fit/);
 assert.doesNotMatch(thumb,/loadPublicItemImageSource\(/);
 assert.match(prefs,/switch1253PublicItemImageSource/);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'])
   assert.match(prefs,new RegExp(locale.replace(/[-]/g,'\\-')));
 assert.match(old,/itemImagePreferences/);
 assert.match(prefs,/contain/);assert.match(prefs,/cover/);assert.match(prefs,/density/);
 assert.match(script,/SWITCH1253_ITEMTHUMB_PUBLIC_MEDIA_OFF_PLACEHOLDER/);
 assert.doesNotMatch(thumb+prefs,/FileReader|indexedDB|autoUpload|readAsDataURL/);
});


test('QA802 regression: undeclared root/publication/source/item/release media fields fail closed',()=>{
 const injected=[
  {section:'root',key:'assetUrl',value:'https://assets.invalid/40006096.webp'},
  {section:'root',key:'mediaPublic',value:true},
  {section:'root',key:'publicImagesEnabled',value:true},
  {section:'root',key:'publicItemEligibility',value:'PUBLIC'},
  {section:'root',key:'images',value:{'40006096':{url:'https://assets.invalid/img.png'}}},
  {section:'source',key:'generation',value:'R39'},
  {section:'target',key:'unknownBidAlias',value:'9A239D3DB569756D'},
  {section:'publication',key:'imageUrl',value:'https://assets.invalid/img.webp'},
  {section:'item',key:'mediaPublic',value:true},
  {section:'item',key:'url',value:'https://assets.invalid/img.webp'},
  {section:'release',key:'assetUrl',value:'https://assets.invalid/img.webp'}
 ];
 for(const {section,key,value} of injected){
   const m=manifest(),review=approvedRelease();
   if(section==='root')m[key]=value;
   if(section==='source')m.source[key]=value;
   if(section==='target')m.target[key]=value;
   if(section==='publication')m.publication[key]=value;
   if(section==='item')m.items[item][key]=value;
   if(section==='release')review[key]=value;
   assert.throws(
     ()=>validateSwitch1253ItemImageCatalog(m,review),
     /SWITCH1253_ITEM_IMAGE_(UNKNOWN_ROOT|ITEM_ID|MEDIA_RIGHTS)/,
     section+' '+key+' must never be accepted'
   );
 }
});

test('Issue604 scoped Owner decision and UNKNOWN license remain separate facts',()=>{
 const make=()=>{
  const r=approvedRelease(),m=manifest();
  for(const p of [r,m.publication]){p.rightsHolderLicense='UNKNOWN';p.licenseEvidenceSha256=null}
  r.items[item].rightsStatus='UNKNOWN';m.items[item].rightsStatus='UNKNOWN';
  return {r,m};
 };
 let {r,m}=make();
 assert.equal(validateSwitch1253ItemImageCatalog(m,r).count,1);
 assert.equal(r.rightsHolderLicense,'UNKNOWN');
 assert.throws(()=>validateSwitch1253ItemImageCatalog(m),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
 for(const key of ['decisionId','scope','rightsReview','receivingContact','takedown','managedHttps',
  'attribution','oldUrlAndCache','rollback','operatorReceiptSha256']){
  for(const invalid of [undefined,'NOT_RUN','FORGED']){
   ({r,m}=make());r[key]=invalid;
   assert.throws(()=>validateSwitch1253ItemImageCatalog(m,r),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/,key);
  }
  ({r,m}=make());m.publication[key]='FORGED';
  assert.throws(()=>validateSwitch1253ItemImageCatalog(m,r),/MANIFEST_PUBLICATION_UNVERIFIED/,key);
 }
 for(const visibility of ['UNRELEASED','HIDDEN','PRIVATE','UGC','UNKNOWN']){
  ({r,m}=make());m.items[item].visibility=visibility;r.items[item].visibility=visibility;
  assert.throws(()=>validateSwitch1253ItemImageCatalog(m,r),/ITEM_ID_NATIVE_SHA/);
 }
 for(const key of ['publicationDecision','rightsStatus','visibility']){
  ({r,m}=make());delete r.items[item][key];
  assert.throws(()=>validateSwitch1253ItemImageCatalog(m,r),/ITEM_ID_NATIVE_SHA/);
 }
 ({r,m}=make());m.items[item].rightsStatus='DOCUMENTED_LICENSE_APPROVED';
 assert.throws(()=>validateSwitch1253ItemImageCatalog(m,r),/ITEM_ID_NATIVE_SHA/);
 ({r,m}=make());r.licenseEvidenceSha256='a'.repeat(64);
 assert.throws(()=>validateSwitch1253ItemImageCatalog(m,r),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
 ({r,m}=make());r.rightsHolderLicense='DOCUMENTED_SCOPE_LICENSE';
 assert.throws(()=>validateSwitch1253ItemImageCatalog(m,r),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
});

test('E1640 draft excludes visually quarantined Tree but preserves historical ACT397 pin',()=>{
 const m=prepareSwitch1253ItemImageManifest();
 assert.deepEqual(Object.keys(m.items),['40000047']);
 assert.equal(m.publication.gate,'MEDIA_PUBLIC_PREPARED_OFF');
 assert.equal(m.publication.rightsHolderLicense,'UNKNOWN');
 assert.equal(m.publication.operatorReceiptSha256,null);
 assert.equal(m.publication.receivingContact,'NOT_RUN');
 assert.deepEqual(SWITCH1253_PREPARED_WEBP_SIZES,{'40000047':19064,'40006096':29314});
 assert.equal(m.items['40000047'].originalNativeStreamSha256,'b0352f4fde178c423dbfa0f02c1f3f6fbfdb24bd4edf2603b67ce2f74485a68c');
 assert.equal(m.items['40000047'].sourcePngSha256,'c156d4e1a32de6e61a851704349f17333098bab39f20ace06f56a7ecf591cc26');
 assert.equal(m.items['40000047'].webpSha256,'b3d130ebf054038655970ed6b9a963b387b2c82be4a1658c2835775ac61d1f54');
 assert.equal(m.items['40006096'],undefined);
 assert.equal(SWITCH1253_NATIVE_PINS['40006096'].webpSha256,'4d2cbdf8cac7ad46ee5f7baa112ae5af34d2fc05de271db1a49d98d003a03858');
 for(const id of Object.keys(m.items)){
  assert.equal(m.items[id].publicationDecision,'NOT_RUN');
  assert.equal(m.items[id].rightsStatus,'UNKNOWN');
 }
 assert.throws(()=>validateSwitch1253ItemImageCatalog(m),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
 assert.throws(()=>validateSwitch1253ItemImageCatalog(m,approvedRelease()),/MANIFEST_PUBLICATION_UNVERIFIED/);
 m.items['40000047'].webpSha256='f'.repeat(64);
 assert.equal(prepareSwitch1253ItemImageManifest().items['40000047'].webpSha256,SWITCH1253_NATIVE_PINS['40000047'].webpSha256);
});
test('E1640 stale exact approved Tree row is quarantined without suppressing valid Wardrobe',()=>{
 const r=approvedRelease(),m=manifest(),p=SWITCH1253_NATIVE_PINS[quarantined];
 r.items[quarantined]={...r.items[item],originalNativeStreamSha256:p.originalNativeStreamSha256,sourcePngSha256:p.sourcePngSha256,webpSha256:p.webpSha256};
 m.items[quarantined]={...m.items[item],...p};
 const good=validateSwitch1253ItemImageCatalog(m,r);
 assert.equal(good.count,1);assert.equal(good.items[quarantined],undefined);
 assert.ok(scopedSwitch1253ItemImageHref('/web',item,good));
 assert.equal(scopedSwitch1253ItemImageHref('/web',quarantined,good),null);
 // Old pre-quarantine cached or forged catalog must also fail at URL boundary.
 const stale={target:SWITCH1253_TARGET,assetVariant:SWITCH1253_ITEM_IMAGE_VARIANT,codec:'WEBP_LOSSLESS_RGBA_EXACT',items:{[quarantined]:p}};
 assert.equal(switch1253ItemImagePath(quarantined,stale),null);
 assert.equal(scopedSwitch1253ItemImageHref('/web',quarantined,stale),null);
 const only=structuredClone(m);delete only.items[item];
 assert.equal(validateSwitch1253ItemImageCatalog(only,r).count,0);
 for(const change of [
  x=>{x.items[item].rasterStatus=p.rasterStatus;},
  x=>{x.items[item].webpSha256=p.webpSha256;},
  x=>{x.items[item].sourcePngSha256=p.sourcePngSha256;},
  x=>{x.items[item].originalNativeStreamSha256=p.originalNativeStreamSha256;},
  x=>{x.items[item].visibility='HIDDEN';},
  x=>{x.items[item].publicationDecision='NOT_RUN';},
  x=>{x.items[item].url='https://example.invalid/a.webp';},
  x=>{x.items['40002422']={...x.items[item]};}
 ]){
  const x=structuredClone(m);change(x);assert.throws(()=>validateSwitch1253ItemImageCatalog(x,r),/ITEM_ID_NATIVE_SHA/);
 }
 const hidden=structuredClone(m),hiddenReview=structuredClone(r);
 hidden.items['40002422']={...m.items[item]};hiddenReview.items['40002422']={...r.items[item]};
 assert.throws(()=>validateSwitch1253ItemImageCatalog(hidden,hiddenReview),/ITEM_ID_NATIVE_SHA/);
 assert.throws(()=>validateSwitch1253ItemImageCatalog(m),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
});

test('mutable manifest revalidates with no-store; stale open catalog clears and one withdrawn item cannot render',async()=>{
 let now=1000,states=[],calls=[],reply=manifest();
 const review=approvedRelease(),controller=createSwitch1253ManifestController(review,s=>states.push(s),()=>now);
 const fetcher=async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify(reply),{headers:{'content-type':'application/json'}})};
 const a=await controller.load('/web',fetcher);
 assert.equal(a.count,1);assert.equal(calls.length,1);
 assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.redirect,'error');
 assert.equal(await controller.load('/web',fetcher),a);
 now+=SWITCH1253_MANIFEST_REFRESH_MS;
 reply={...manifest(),items:{}};
 const b=controller.load('/web',fetcher);
 assert.equal(states.at(-1).catalog,null,'old catalog clears before async refresh');
 assert.equal(await b,null);assert.equal(states.at(-1).catalog,null);assert.equal(calls.length,2);
 reply=manifest();assert.equal((await controller.load('/web',fetcher)).count,1);
 const bad=async()=>new Response(JSON.stringify(reply),{headers:{'content-type':'text/html'}});
 assert.equal(await controller.load('/web',bad,true),null);assert.equal(states.at(-1).catalog,null);
 controller.clear();
});
test('refresh cancels on hidden/dispose, no stale delayed response resurrection or old catalog retention',async()=>{
 const review=approvedRelease(),states=[],controller=createSwitch1253ManifestController(review,s=>states.push(s));
 let resolveOld;
 const old=controller.load('/web',()=>new Promise(resolve=>{resolveOld=resolve}));
 controller.clear('DOCUMENT_NOT_VISIBLE');
 assert.equal(await old,null);
 const good=await controller.load('/web',async()=>new Response(JSON.stringify(manifest()),{headers:{'content-type':'application/json'}}));
 assert.equal(good.count,1);const before=states.length;
 resolveOld(new Response(JSON.stringify(manifest()),{headers:{'content-type':'application/json'}}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(states.length,before,'cancelled old manifest cannot republish');
 const win=new EventTarget(),doc=new EventTarget();let tick=null;
 doc.visibilityState='visible';win.setInterval=(f,ms)=>{assert.equal(ms,SWITCH1253_MANIFEST_REFRESH_MS);tick=f;return 1};win.clearInterval=id=>{assert.equal(id,1);tick=null};
 const calls=[];const fake={load:(...args)=>{calls.push(['load',args[0],args[2]]);return Promise.resolve(null)},clear:reason=>calls.push(['clear',reason])};
 const detach=attachSwitch1253ManifestLifecycle(fake,'/web',win,doc,()=>{});
 win.dispatchEvent(new Event('focus'));tick();doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));
 win.dispatchEvent(new Event('pagehide'));doc.visibilityState='visible';win.dispatchEvent(new Event('pageshow'));
 detach();const n=calls.length;win.dispatchEvent(new Event('focus'));doc.dispatchEvent(new Event('visibilitychange'));
 assert.deepEqual(calls,[['load','/web',true],['load','/web',true],['load','/web',true],['clear','DOCUMENT_NOT_VISIBLE'],['clear','DOCUMENT_NOT_VISIBLE'],['load','/web',true],['clear','NO_VISIBLE_CONSUMER']]);
 assert.equal(calls.length,n);assert.equal(tick,null);
 assert.match(readFileSync(new URL('../src/lib/ui/ItemThumb.svelte',import.meta.url),'utf8'),/onMount\(\(\) => retainSwitch1253PublicItemImageSource\(base\)\)/);
});
test('quarantined Tree stays absent through refresh and valid Wardrobe withdrawal',async()=>{
 const r=approvedRelease(),m=manifest(),p=SWITCH1253_NATIVE_PINS[quarantined];
 r.items[quarantined]={...r.items[item],originalNativeStreamSha256:p.originalNativeStreamSha256,sourcePngSha256:p.sourcePngSha256,webpSha256:p.webpSha256};
 m.items[quarantined]={...m.items[item],...p};
 let raw=m;const states=[],c=createSwitch1253ManifestController(r,v=>states.push(v));
 const fetcher=async()=>new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});
 assert.equal((await c.load('/web',fetcher)).count,1);
 assert.equal(scopedSwitch1253ItemImageHref('/web',quarantined,states.at(-1).catalog),null);
 assert.ok(scopedSwitch1253ItemImageHref('/web',item,states.at(-1).catalog));
 raw=structuredClone(m);delete raw.items[item];
 assert.equal((await c.load('/web',fetcher,true)).count,0);
 assert.equal(scopedSwitch1253ItemImageHref('/web',item,states.at(-1).catalog),null);
 assert.equal(scopedSwitch1253ItemImageHref('/web',quarantined,states.at(-1).catalog),null);
 c.clear();
});
