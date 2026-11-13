// Current-version ItemThumb policy, built over accepted shared ItemThumb/Preferences.
// This is a *public release gate*, not a native game-reader or rights license.
// ACT385/ACT397: exactly two independently reconstructed and visibility-accepted
// Switch1253 rasters (ASTC6x6 sRGB and DXT5). Hidden 40002422 is excluded.
// Reconstructed PNG is not a first-party stored PNG or device GPU parity.
// No game pixels, personal Save, or private binaries in this source or CI.
import { writable } from 'svelte/store';
import {ITEM_IMAGE_OWNER_DECISION_ID} from './public-item-images.mjs';
export const SWITCH1253_OWNER_SCOPE='RELEASED_PLAYER_FACING_ITEM_THUMBNAILS';

export const SWITCH1253_ITEM_IMAGE_SCHEMA='wand.item-images.switch1253-release@1';
export const SWITCH1253_ITEM_IMAGE_VARIANT='switch-1.25.3-schema626-lossless160-v1';
export const SWITCH1253_MANIFEST_PATH='ddv/item-images/'+SWITCH1253_ITEM_IMAGE_VARIANT+'/manifest.json';
export const SWITCH1253_TARGET=Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.3',
  buildID:'9A239D3DB569756D',schema:626
});
export const SWITCH1253_ORIGINAL_BUNDLE_SHA256='346d9da74c03d93e3db71fe703724a7a1cadf72aa693474da813765e9f54f5ff';
export const SWITCH1253_NATIVE_PINS=Object.freeze({
  '40000047':Object.freeze({
    originalNativeStreamSha256:'b0352f4fde178c423dbfa0f02c1f3f6fbfdb24bd4edf2603b67ce2f74485a68c',
    sourcePngSha256:'c156d4e1a32de6e61a851704349f17333098bab39f20ace06f56a7ecf591cc26',
    webpSha256:'b3d130ebf054038655970ed6b9a963b387b2c82be4a1658c2835775ac61d1f54',
    rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'
  }),
  '40006096':Object.freeze({
    originalNativeStreamSha256:'41622bafd70f97eef4d34eef63db0b4c3be6e85a29f400b7c8bceee370b77b13',
    sourcePngSha256:'41fd7dcaf0f4a6ae2b43cd29d111245b0be49873a04e4f7c42c6d572199f78c3',
    webpSha256:'4d2cbdf8cac7ad46ee5f7baa112ae5af34d2fc05de271db1a49d98d003a03858',
    rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'
  })
});
// Exact byte sizes for private staging verification; not a publication grant.
export const SWITCH1253_PREPARED_WEBP_SIZES=Object.freeze({'40000047':19064,'40006096':29314});
// No rights/host/release acceptance. This compiled default is the runtime
// authority; untrusted fetched JSON cannot switch it to ON.
export const SWITCH1253_REVIEWED_RELEASE=Object.freeze({
  mediaPublic:false,decisionId:ITEM_IMAGE_OWNER_DECISION_ID,scope:SWITCH1253_OWNER_SCOPE,
  rightsHolderLicense:'UNKNOWN',licenseEvidenceSha256:null,rightsReview:'NOT_RUN',
  receivingContact:'NOT_RUN',takedown:'NOT_RUN',managedHttps:'NOT_RUN',
  attribution:'NOT_RUN',oldUrlAndCache:'NOT_RUN',rollback:'NOT_RUN',
  operatorReceiptSha256:null,
  items:Object.freeze({})
});
// Metadata-only draft, deliberately invalid as a public release manifest.
// Keep outside static/Pages; the actual operator receipt and final release
// manifest must be produced and accepted separately. No caller-supplied grants.
export function prepareSwitch1253ItemImageManifest(){
 const {mediaPublic,items,...pending}=SWITCH1253_REVIEWED_RELEASE;
 return {
  schema:SWITCH1253_ITEM_IMAGE_SCHEMA,assetVariant:SWITCH1253_ITEM_IMAGE_VARIANT,
  codec:'WEBP_LOSSLESS_RGBA_EXACT',format:'webp',lossless:true,
  source:{...SWITCH1253_TARGET,originalBundleSha256:SWITCH1253_ORIGINAL_BUNDLE_SHA256},
  target:{...SWITCH1253_TARGET},
  publication:{gate:'MEDIA_PUBLIC_PREPARED_OFF',...pending},
  items:Object.fromEntries(Object.entries(SWITCH1253_NATIVE_PINS).map(([id,pin])=>[id,{
   ...pin,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',visibility:'RELEASED_PLAYER_FACING',
   rightsStatus:'UNKNOWN',publicationDecision:'NOT_RUN',assetStatus:'WEBP_LOSSLESS_VERIFIED_160'
  }]))
 };
}
export const switch1253PublicItemImageSource=writable({
  status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'
});
const HEX=/^[0-9a-f]{64}$/;
const ITEM=/^[1-9][0-9]{0,15}$/;
const baseOk=base=>typeof base==='string'&&/^\/?(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(base);
const owns=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
function exactKeys(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const actual=Object.keys(value);
 return actual.length===keys.length&&keys.every(key=>owns(value,key));
}
const fail=(name)=>{throw new TypeError('SWITCH1253_ITEM_IMAGE_'+name);};
function exactTarget(value){
 return value?.platform===SWITCH1253_TARGET.platform &&
   value?.gameVersion===SWITCH1253_TARGET.gameVersion &&
   value?.buildID===SWITCH1253_TARGET.buildID &&
   value?.schema===SWITCH1253_TARGET.schema;
}
function reviewedReleaseOn(release){
 return exactKeys(release,[
   'mediaPublic','decisionId','scope','rightsHolderLicense','licenseEvidenceSha256',
   'rightsReview','receivingContact','takedown','managedHttps',
   'attribution','oldUrlAndCache','rollback','operatorReceiptSha256','items'
 ]) && release?.mediaPublic===true &&
   release.decisionId===ITEM_IMAGE_OWNER_DECISION_ID &&
   release.scope===SWITCH1253_OWNER_SCOPE &&
   ((release.rightsHolderLicense==='UNKNOWN'&&release.licenseEvidenceSha256===null)||
    (release.rightsHolderLicense==='DOCUMENTED_SCOPE_LICENSE'&&
     typeof release.licenseEvidenceSha256==='string'&&HEX.test(release.licenseEvidenceSha256))) &&
   typeof release.operatorReceiptSha256==='string'&&HEX.test(release.operatorReceiptSha256) &&
   release.attribution==='EIGHT_LOCALES_REVIEWED' &&
   release.oldUrlAndCache==='MANAGED_TESTED' &&
   release.rollback==='MANAGED_TESTED' &&
   release.rightsReview==='OPERATOR_ACCEPTED' &&
   release.receivingContact==='MANAGED_VERIFIED' &&
   release.takedown==='MANAGED_TESTED' &&
   release.managedHttps==='MANAGED_VERIFIED' &&
   release.items && typeof release.items==='object' &&
   !Array.isArray(release.items);
}
// A test can inject a synthetic reviewed release without changing the
// immutable runtime OFF policy; the live UI never passes such an override.
export function validateSwitch1253ItemImageCatalog(raw,reviewedRelease=SWITCH1253_REVIEWED_RELEASE){
 if(!reviewedReleaseOn(reviewedRelease))fail('MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    raw.schema!==SWITCH1253_ITEM_IMAGE_SCHEMA ||
    !exactTarget(raw.target)||!exactTarget(raw.source)||
    raw.source.originalBundleSha256!==SWITCH1253_ORIGINAL_BUNDLE_SHA256)
   fail('PLATFORM_VERSION_BID_SCHEMA_OR_ORIGINAL_SHA_UNVERIFIED');
 if(raw.assetVariant!==SWITCH1253_ITEM_IMAGE_VARIANT||
    raw.codec!=='WEBP_LOSSLESS_RGBA_EXACT'||
    raw.format!=='webp'||raw.lossless!==true)
   fail('PIXEL_FORMAT_OR_VARIANT_UNVERIFIED');
 // Manifest claims never authorize publication. Every field must match
 // the immutable compiled review; Issue604 is not a copyright licence.
 const publicationKeys=['decisionId','scope','rightsHolderLicense','licenseEvidenceSha256',
   'rightsReview','managedHttps','takedown','receivingContact','attribution',
   'oldUrlAndCache','rollback','operatorReceiptSha256'];
 if(raw.publication?.gate!=='MEDIA_PUBLIC_SCOPED_ON'||
    publicationKeys.some(key=>raw.publication?.[key]!==reviewedRelease[key]))
   fail('MANIFEST_PUBLICATION_UNVERIFIED');
 const rightsStatus=reviewedRelease.rightsHolderLicense==='UNKNOWN'?
   'UNKNOWN':'DOCUMENTED_LICENSE_APPROVED';
 if(!exactKeys(raw,[
     'schema','assetVariant','codec','format','lossless','source','target',
     'publication','items'
   ]) || !exactKeys(raw.target,['platform','gameVersion','buildID','schema']) ||
   !exactKeys(raw.source,['platform','gameVersion','buildID','schema','originalBundleSha256']) ||
   !exactKeys(raw.publication,['gate',...publicationKeys]))fail('UNKNOWN_ROOT_SOURCE_TARGET_OR_PUBLICATION_FIELDS');
 if(!raw.items||typeof raw.items!=='object'||Array.isArray(raw.items))
   fail('MAPPING_INVALID');
 const keys=Object.keys(raw.items);
 if(keys.length===0||keys.length>40000)fail('MAPPING_EMPTY_OR_OVERSIZED');
 const safe=Object.create(null);
 for(const id of keys){
   const e=raw.items[id],trusted=reviewedRelease.items[id],pin=SWITCH1253_NATIVE_PINS[id];
   if(!ITEM.test(id)||!Number.isSafeInteger(Number(id))||
      !owns(reviewedRelease.items,id)||!owns(SWITCH1253_NATIVE_PINS,id)||
      !e||typeof e!=='object'||Array.isArray(e)||
      !trusted||typeof trusted!=='object'||Array.isArray(trusted)||
      !exactKeys(trusted,['originalNativeStreamSha256','sourcePngSha256',
        'webpSha256','rightsStatus','publicationDecision','visibility'])||
      !exactKeys(e,['originalNativeStreamSha256','sourcePngSha256',
        'webpSha256','rasterStatus','pixelStatus','visibility','rightsStatus',
        'assetStatus','publicationDecision'])||
      !pin||!['SWITCH_DXT5_RGBA_EXACT_PRIVATE','SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'].includes(pin.rasterStatus)||
      e.rasterStatus!==pin.rasterStatus||
      e.originalNativeStreamSha256!==pin.originalNativeStreamSha256||
      e.sourcePngSha256!==pin.sourcePngSha256||
      e.webpSha256!==pin.webpSha256||
      !HEX.test(e.originalNativeStreamSha256||'')||
      !HEX.test(e.sourcePngSha256||'')||!HEX.test(e.webpSha256||'')||
      e.pixelStatus!=='SWITCH_RGBA_EXACT_VERIFIED'||
      e.visibility!=='RELEASED_PLAYER_FACING'||
      e.rightsStatus!==rightsStatus||
      e.publicationDecision!=='OWNER_SCOPED_PUBLICATION_ACCEPTED'||
      trusted.publicationDecision!==e.publicationDecision||
      trusted.visibility!==e.visibility||
      e.assetStatus!=='WEBP_LOSSLESS_VERIFIED_160'||
      trusted.originalNativeStreamSha256!==e.originalNativeStreamSha256||
      trusted.sourcePngSha256!==e.sourcePngSha256||
      trusted.webpSha256!==e.webpSha256||
      trusted.rightsStatus!==rightsStatus)
     fail('ITEM_ID_NATIVE_SHA_RGBA_RELEASE_OR_RIGHTS_UNVERIFIED');
   safe[id]=Object.freeze({
     originalNativeStreamSha256:e.originalNativeStreamSha256,
     sourcePngSha256:e.sourcePngSha256,webpSha256:e.webpSha256
   });
 }
 return Object.freeze({
   target:Object.freeze({...SWITCH1253_TARGET}),
   assetVariant:SWITCH1253_ITEM_IMAGE_VARIANT,
   codec:'WEBP_LOSSLESS_RGBA_EXACT',
   items:Object.freeze(safe),count:keys.length
 });
}
export function switch1253ItemImagePath(itemId,catalog){
 if(!catalog||!exactTarget(catalog.target)||
    catalog.assetVariant!==SWITCH1253_ITEM_IMAGE_VARIANT||
    catalog.codec!=='WEBP_LOSSLESS_RGBA_EXACT')return null;
 const id=String(itemId);
 if(!ITEM.test(id)||!Number.isSafeInteger(Number(id)))return null;
 const item=catalog.items?.[id],pin=SWITCH1253_NATIVE_PINS[id];
 if(!item||!pin||item.originalNativeStreamSha256!==pin.originalNativeStreamSha256||
    item.sourcePngSha256!==pin.sourcePngSha256||
    item.webpSha256!==pin.webpSha256)return null;
 const shard=item.originalNativeStreamSha256.slice(0,2);
 return 'ddv/item-images/'+SWITCH1253_ITEM_IMAGE_VARIANT+'/'+shard+'/' +
   item.originalNativeStreamSha256+'-'+item.sourcePngSha256+'-'+item.webpSha256+'.webp';
}
export function scopedSwitch1253ItemImageHref(base,itemId,catalog){
 if(!baseOk(base))return null;
 const path=switch1253ItemImagePath(itemId,catalog);
 if(!path)return null;
 return (base?'/'+base.replace(/^\/+|\/+$/g,''):'')+'/'+path;
}
// A mutable manifest is a withdrawal control, never an immutable cached asset.
// Bound the visible-tab lifetime and clear before a refresh, including on
// focus/pageshow/visibility change. CDN/old immutable URL purge still requires
// independently measured operator controls; client refresh is not a purge.
export const SWITCH1253_MANIFEST_REFRESH_MS=60000;
export const SWITCH1253_MANIFEST_TIMEOUT_MS=10000;

// Test-only callers may construct an isolated controller with an explicit
// synthetic review. The production singleton below uses only compiled review.
export function createSwitch1253ManifestController(reviewedRelease,publish,clock=Date.now){
 let pending=null,last=null;
 const state=(reason)=>publish({status:'NOT_CONFIGURED',catalog:null,reason});
 function clear(reason='MANIFEST_REFRESH_REQUIRED'){
  const old=pending;pending=null;last=null;
  old?.stop();state(reason);
 }
 function load(base='',fetchImpl=globalThis.fetch,force=false){
  if(!reviewedReleaseOn(reviewedRelease)){clear('MEDIA_PUBLIC_OFF');return Promise.resolve(null);}
  if(!baseOk(base)||typeof fetchImpl!=='function'){clear('BASE_OR_FETCH_INVALID');return Promise.resolve(null);}
  if(pending&&pending.base===base)return pending.promise;
  const now=clock();
  if(!force&&last&&last.base===base&&now>=last.at&&now-last.at<SWITCH1253_MANIFEST_REFRESH_MS)
   return Promise.resolve(last.catalog);
  clear('MANIFEST_REFRESH_PENDING');
  const abort=new AbortController(),slot={base,promise:null,stop:null};
  pending=slot;
  let rejectStop;
  const stopped=new Promise((_,reject)=>{rejectStop=reject});
  slot.stop=()=>{abort.abort();rejectStop(new Error('MANIFEST_REFRESH_CANCELLED'))};
  const deadline=setTimeout(()=>{
   if(pending===slot){pending=null;last=null;state('MANIFEST_REFRESH_TIMEOUT');slot.stop();}
  },SWITCH1253_MANIFEST_TIMEOUT_MS);
  const prefix=base?'/'+base.replace(/^\/+|\/+$/g,''):'';
  const request=(async()=>{
   const response=await fetchImpl(prefix+'/'+SWITCH1253_MANIFEST_PATH,
    {credentials:'omit',redirect:'error',cache:'no-store',signal:abort.signal});
   if(!response.ok)fail('PUBLISHED_MANIFEST_UNAVAILABLE');
   const mime=response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
   if(mime!=='application/json')fail('PUBLISHED_MANIFEST_MIME_INVALID');
   return validateSwitch1253ItemImageCatalog(await response.json(),reviewedRelease);
  })();
  slot.promise=Promise.race([request,stopped]).then(catalog=>{
   if(pending!==slot)return null;
   last={base,at:clock(),catalog};
   publish({status:'VERIFIED',catalog,reason:''});
   return catalog;
  }).catch(err=>{
   if(pending===slot){last=null;state(String(err?.message||err));}
   return null;
  }).finally(()=>{clearTimeout(deadline);if(pending===slot)pending=null;});
  return slot.promise;
 }
 return Object.freeze({load,clear});
}
const productionController=createSwitch1253ManifestController(
 SWITCH1253_REVIEWED_RELEASE,value=>switch1253PublicItemImageSource.set(value)
);
export function loadSwitch1253PublicItemImageSource(base='',fetchImpl=globalThis.fetch){
 return productionController.load(base,fetchImpl);
}

// One lifecycle per visible document, shared by all mounted ItemThumbs.
// No timers or listeners when compiled media is OFF. On background/BFCache
// entry clear and cancel; when visible/focused revalidate, not a stale replay.
export function attachSwitch1253ManifestLifecycle(controller,base,win,doc,fetchImpl=globalThis.fetch){
 const refresh=()=>{if(doc.visibilityState==='visible')void controller.load(base,fetchImpl,true);
  else controller.clear('DOCUMENT_NOT_VISIBLE');};
 const hide=()=>controller.clear('DOCUMENT_NOT_VISIBLE');
 win.addEventListener('focus',refresh);
 win.addEventListener('pageshow',refresh);
 win.addEventListener('pagehide',hide);
 doc.addEventListener('visibilitychange',refresh);
 const timer=win.setInterval(refresh,SWITCH1253_MANIFEST_REFRESH_MS);
 refresh();
 return ()=>{
  win.clearInterval(timer);win.removeEventListener('focus',refresh);
  win.removeEventListener('pageshow',refresh);win.removeEventListener('pagehide',hide);
  doc.removeEventListener('visibilitychange',refresh);controller.clear('NO_VISIBLE_CONSUMER');
 };
}
let consumers=0,detach=null,consumerBase=null;
export function retainSwitch1253PublicItemImageSource(base=''){
 if(!reviewedReleaseOn(SWITCH1253_REVIEWED_RELEASE)||typeof window==='undefined'||typeof document==='undefined'){
  void loadSwitch1253PublicItemImageSource(base);return ()=>{};
 }
 if(!baseOk(base)||(consumers&&consumerBase!==base)){
  productionController.clear('BASE_OR_FETCH_INVALID');return ()=>{};
 }
 if(consumers===0){
  consumerBase=base;
  detach=attachSwitch1253ManifestLifecycle(productionController,base,window,document);
 }
 consumers++;
 let released=false;
 return ()=>{
  if(released)return;released=true;consumers--;
  if(consumers===0){detach?.();detach=null;consumerBase=null;}
 };
}
