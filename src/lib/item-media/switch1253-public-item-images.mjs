// Current-version ItemThumb policy, built over accepted shared ItemThumb/Preferences.
// This is a *public release gate*, not a native game-reader or rights license.
// Owner-private Switch native metadata PR798: 3 native SHA sources, only DXT5
// item 40006096 has independently reconstructed pixel-exact PNG/WebP.
// No game pixels, personal Save, or private binaries in this source or CI.
import { writable } from 'svelte/store';

export const SWITCH1253_ITEM_IMAGE_SCHEMA='wand.item-images.switch1253-release@1';
export const SWITCH1253_ITEM_IMAGE_VARIANT='switch-1.25.3-schema626-lossless160-v1';
export const SWITCH1253_MANIFEST_PATH='ddv/item-images/'+SWITCH1253_ITEM_IMAGE_VARIANT+'/manifest.json';
export const SWITCH1253_TARGET=Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.3',
  buildID:'9A239D3DB569756D',schema:626
});
export const SWITCH1253_ORIGINAL_BUNDLE_SHA256='346d9da74c03d93e3db71fe703724a7a1cadf72aa693474da813765e9f54f5ff';
export const SWITCH1253_NATIVE_PINS=Object.freeze({
  '40006096':Object.freeze({
    originalNativeStreamSha256:'41622bafd70f97eef4d34eef63db0b4c3be6e85a29f400b7c8bceee370b77b13',
    sourcePngSha256:'41fd7dcaf0f4a6ae2b43cd29d111245b0be49873a04e4f7c42c6d572199f78c3',
    webpSha256:'4d2cbdf8cac7ad46ee5f7baa112ae5af34d2fc05de271db1a49d98d003a03858',
    rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'
  })
});
// No rights/host/release acceptance. This compiled default is the runtime
// authority; untrusted fetched JSON cannot switch it to ON.
export const SWITCH1253_REVIEWED_RELEASE=Object.freeze({
  mediaPublic:false,rightsHolderLicense:'UNKNOWN',rightsReview:'NOT_RUN',
  receivingContact:'NOT_RUN',takedown:'NOT_RUN',managedHttps:'NOT_RUN',
  items:Object.freeze({})
});
export const switch1253PublicItemImageSource=writable({
  status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'
});
const HEX=/^[0-9a-f]{64}$/;
const ITEM=/^[1-9][0-9]{0,15}$/;
const baseOk=base=>typeof base==='string'&&/^\/?(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(base);
const owns=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const fail=(name)=>{throw new TypeError('SWITCH1253_ITEM_IMAGE_'+name);};
function exactTarget(value){
 return value?.platform===SWITCH1253_TARGET.platform &&
   value?.gameVersion===SWITCH1253_TARGET.gameVersion &&
   value?.buildID===SWITCH1253_TARGET.buildID &&
   value?.schema===SWITCH1253_TARGET.schema;
}
function reviewedReleaseOn(release){
 return release?.mediaPublic===true &&
   release.rightsHolderLicense==='DOCUMENTED_SCOPE_LICENSE' &&
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
 if(raw.publication?.gate!=='MEDIA_PUBLIC_SCOPED_ON'||
    raw.publication?.rightsReview!=='OPERATOR_ACCEPTED'||
    raw.publication?.managedHttps!=='MANAGED_VERIFIED'||
    raw.publication?.takedown!=='MANAGED_TESTED'||
    raw.publication?.receivingContact!=='MANAGED_VERIFIED')
   fail('MANIFEST_PUBLICATION_UNVERIFIED');
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
      !pin||pin.rasterStatus!=='SWITCH_DXT5_RGBA_EXACT_PRIVATE'||
      e.originalNativeStreamSha256!==pin.originalNativeStreamSha256||
      e.sourcePngSha256!==pin.sourcePngSha256||
      e.webpSha256!==pin.webpSha256||
      !HEX.test(e.originalNativeStreamSha256||'')||
      !HEX.test(e.sourcePngSha256||'')||!HEX.test(e.webpSha256||'')||
      e.pixelStatus!=='SWITCH_RGBA_EXACT_VERIFIED'||
      e.visibility!=='RELEASED_PLAYER_FACING'||
      e.rightsStatus!=='DOCUMENTED_LICENSE_APPROVED'||
      e.assetStatus!=='WEBP_LOSSLESS_VERIFIED_160'||
      trusted.originalNativeStreamSha256!==e.originalNativeStreamSha256||
      trusted.sourcePngSha256!==e.sourcePngSha256||
      trusted.webpSha256!==e.webpSha256||
      trusted.rightsStatus!=='DOCUMENTED_LICENSE_APPROVED')
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
let activePromise=null;
export function loadSwitch1253PublicItemImageSource(base='',fetchImpl=globalThis.fetch){
 // Not even a manifest request unless code-reviewed rights+operator+HTTPS
 // are separately accepted in this compiled release. No prod activation.
 if(!reviewedReleaseOn(SWITCH1253_REVIEWED_RELEASE)){
   switch1253PublicItemImageSource.set({
     status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'
   });
   return Promise.resolve(null);
 }
 if(activePromise)return activePromise;
 activePromise=(async()=>{
   if(!baseOk(base)||typeof fetchImpl!=='function')fail('BASE_OR_FETCH_INVALID');
   const prefix=base?'/'+base.replace(/^\/+|\/+$/g,''):'';
   const response=await fetchImpl(prefix+'/'+SWITCH1253_MANIFEST_PATH,
     {credentials:'omit',redirect:'error',cache:'force-cache'});
   if(!response.ok)fail('PUBLISHED_MANIFEST_UNAVAILABLE');
   const catalog=validateSwitch1253ItemImageCatalog(
     await response.json(),SWITCH1253_REVIEWED_RELEASE);
   switch1253PublicItemImageSource.set({status:'VERIFIED',catalog,reason:''});
   return catalog;
 })().catch(err=>{
   switch1253PublicItemImageSource.set({
     status:'NOT_CONFIGURED',catalog:null,reason:String(err?.message||err)
   });
   return null;
 });
 return activePromise;
}
