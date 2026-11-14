import {STEAM1253_FURNITURE146_PINS} from './steam1253-furniture146-pins.mjs';
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
// E1640: historical exact bytes do not establish visual correctness.
// Keep the original pin/evidence, but quarantine this exact Switch item at
// every publication boundary until independently corrected; Steam is separate.
export const SWITCH1253_VISUAL_QUARANTINE=Object.freeze({'40006096':'E1640_SWITCH_DICE_TREE_STRIPED'});
const switchVisualQuarantined=id=>Object.prototype.hasOwnProperty.call(SWITCH1253_VISUAL_QUARANTINE,id);
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
  items:Object.fromEntries(Object.entries(SWITCH1253_NATIVE_PINS).filter(([id])=>!switchVisualQuarantined(id)).map(([id,pin])=>[id,{
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
   // Drop the quarantined row even in a stale previously reviewed manifest;
   // do not suppress unrelated valid rows and never return its old URL.
   if(switchVisualQuarantined(id))continue;
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
   items:Object.freeze(safe),count:Object.keys(safe).length
 });
}

/* ACT628: one platform-neutral manifest, one existing ItemThumb/store/lifecycle.
 * Steam Windows is the primary source; exact Switch fallback provenance is
 * retained but never authorizes a second URL or an unreviewed item. */
export const STEAM1253_ITEM_IMAGE_SCHEMA='wand.item-images.steam-primary-release@1';
export const STEAM1253_ITEM_IMAGE_VARIANT='steam-1.25.3-schema626-lossless160-v1';
export const STEAM1253_MANIFEST_PATH='ddv/item-images/'+STEAM1253_ITEM_IMAGE_VARIANT+'/manifest.json';
export const STEAM1253_DOOR_ID='40300045';
export const STEAM1253_DOOR_PIN=Object.freeze({
 platform:'Steam Windows',gameVersion:'1.25.3',schema:626,
 fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 originalBundleSha256:'c00a6b3a8e4b8f766636d181736df5d695ac1bedd644e6950c09dfc327a4d85d',
 originalNativeStreamSha256:'f65d21970cd838e8c52328fd5589f3108d148ff027eec77e5ea5ab9def9abe06',
 sourcePngSha256:'689eed6968e86a71d80f97e3abcde0625838559c71791fa725c537cdbdd81dfa',
 webpSha256:'be04cf5698b094a1597bac8ceafa9c43d696c4bf75c8be8db2504ce764b58489',
 rgba160Sha256:'e5eda84719c1b4010de8773692042ff7f9af6676f2dfaf34bfc0e694c6766f6c',
 iconGuid:'cbca5424e61157f4fb9121cfe7d2e035',width:160,height:160,bytes:15310,
 fallbackPlatform:'Nintendo Switch',fallbackBuildID:'9A239D3DB569756D',
 fallbackBundleSha256:'2cd38041061059eea26ca98a4bc783022e8e9d2066705c65094f100f0258187f',
 fallbackNativeStreamSha256:'a31dff851b7c11194cc363187178ad543e86e40b1604ef425c024aa8683d4cd5',
 fallbackPolicy:'EXPLICIT_FALLBACK_ONLY',codec:'WEBP_LOSSLESS_RGBA_EXACT',
 visibility:'RELEASED_PLAYER_FACING'
});
// ACT648: exact two new Steam primary provenance pins from E1641/E1642.
export const STEAM1253_NATIVE_PINS=Object.freeze({
 ...STEAM1253_FURNITURE146_PINS,
 [STEAM1253_DOOR_ID]:STEAM1253_DOOR_PIN,
 '40006110':Object.freeze({
  platform:'Steam Windows',gameVersion:'1.25.3',schema:626,
 fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  originalBundleSha256:'acb7b4da1b360e37a9dc7b1b0781199d64c5269a37524335c68f4050e89161b7',
  originalNativeStreamSha256:'751dde857a70040b8704b4228c0282f10f54967738d64c7ed482ac69efe409ee',
  sourcePngSha256:'d9a59309f9192e56a79f87dcddae324585b534cd680c38b7b58a2dfa9cc5c511',
  webpSha256:'4f1ed414b3f554a69dbc7b4e682507274c58ad327ace7e22808469aa1e56eff4',
  rgba160Sha256:'306c52a3fd70c5e12f8349bfc68b5140a890859350342c10659e385d08edd870',
  iconGuid:'0280873a7ea805d4199a49df193f1c0d',width:160,height:160,bytes:28176,
  fallbackPlatform:'Nintendo Switch',fallbackBuildID:'9A239D3DB569756D',
  fallbackBundleSha256:'de9d4b0daf14dce505aceb182e66b9c38fd774a4bcbfb91fb257f05797e75532',
  fallbackNativeStreamSha256:'945359c7bee25a461c34d14d97f4d28aa2ae198594e4a147f9b3a3972406d149',
  fallbackPolicy:'EXPLICIT_FALLBACK_ONLY',codec:'WEBP_LOSSLESS_RGBA_EXACT',visibility:'RELEASED_PLAYER_FACING'
 }),
 '40005160':Object.freeze({
  platform:'Steam Windows',gameVersion:'1.25.3',schema:626,
 fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  originalBundleSha256:'9ddf2abc3bb61d0b1420dd615af2507a7b8f08831c96c8f81670c9937f1bb13a',
  originalNativeStreamSha256:'8d28c26aed54bf50021641a898bcbb396b4075fcf21e3bf7c985518369ce5803',
  sourcePngSha256:'011b569722d0e4e19e20262994e51ced2f57ef8ef7e1c69ff036b1496a881b12',
  webpSha256:'461f6484256c69e5a528adc3af7054301841fc324c237d8bc0d4534830345bec',
  rgba160Sha256:'278d57ff8d42b3e64a9f7abe597e6db7d2938c39b19f39d95526834669d46796',
  iconGuid:'ee85e95b0e61be642af03833a4942ae7',width:160,height:160,bytes:5796,
  fallbackPlatform:'Nintendo Switch',fallbackBuildID:'9A239D3DB569756D',
  fallbackBundleSha256:'b126813d38899c52c440d9c5d0e4b2fc47fd7719d44b058ec277f6cce2e53c3f',
  fallbackNativeStreamSha256:'de98322ba8fa85da9fd19cdc3e5d5db361bbdfbedb1cfa503aa652a86827e74a',
  fallbackPolicy:'EXPLICIT_FALLBACK_ONLY',codec:'WEBP_LOSSLESS_RGBA_EXACT',visibility:'RELEASED_PLAYER_FACING'
 }),
 // ACT676: independently accepted Steam512 derivatives, E1675.
 '40000047':Object.freeze({
  platform:'Steam Windows',gameVersion:'1.25.3',schema:626,
  fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  originalBundleSha256:'9fbf4b75e50bd08b7479e4dc372ca0568254051c64872b66ba9332ecf139cdb0',
  originalNativeStreamSha256:'3667a7212306096b69896e7304be9982fd1f95e718b27f742b3ffe0cabb32972',
  sourcePngSha256:'1e195cb2c3a28acd7cd6a6d68ede35928c77245fadd1f465b506162ffd3bd474',
  webpSha256:'30ab4e9c59d87e2796a56a2bdda2b87bfc03bb39364b3d2267d31db2804865e0',
  rgba160Sha256:'a1476605f1f553aae4c5c71c52bb32ea36f57c2c5b14529188e56f2f4f0974b3',
  iconGuid:'26d1b07fac5a07a4ebea467b962fb6a4',width:160,height:160,bytes:19944,
  fallbackPlatform:'Nintendo Switch',fallbackBuildID:'9A239D3DB569756D',
  fallbackBundleSha256:'346d9da74c03d93e3db71fe703724a7a1cadf72aa693474da813765e9f54f5ff',
  fallbackNativeStreamSha256:'b0352f4fde178c423dbfa0f02c1f3f6fbfdb24bd4edf2603b67ce2f74485a68c',
  fallbackPolicy:'EXPLICIT_FALLBACK_ONLY',codec:'WEBP_LOSSLESS_RGBA_EXACT',visibility:'RELEASED_PLAYER_FACING'
 }),
 '40006096':Object.freeze({
  platform:'Steam Windows',gameVersion:'1.25.3',schema:626,
  fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  originalBundleSha256:'9fbf4b75e50bd08b7479e4dc372ca0568254051c64872b66ba9332ecf139cdb0',
  originalNativeStreamSha256:'7daefc7646df6b25fc07859b28536027323ad12edcbdef4eb19e388ea972e1d4',
  sourcePngSha256:'e1a6a39a50a38acf6f69b70cf4d53c6092396930c41dc3327510ba307e3969f1',
  webpSha256:'75292936edd3ed82fd97e69f7e8e09771ce4c9ec36d867c7703b066a95b1854c',
  rgba160Sha256:'066cb52a9f265a3001833e3a99826e9e56f31058929845b6f64e09180909e2f6',
  iconGuid:'b569dad82cd3de74397780d1fa7be96a',width:160,height:160,bytes:17638,
  fallbackPlatform:null,fallbackBuildID:null,fallbackBundleSha256:null,fallbackNativeStreamSha256:null,
  fallbackPolicy:'NO_FALLBACK_SWITCH_VISUAL_QUARANTINED',codec:'WEBP_LOSSLESS_RGBA_EXACT',visibility:'RELEASED_PLAYER_FACING'
 })
});
// Compiled OFF; fetched JSON cannot grant release authority.
export const STEAM1253_REVIEWED_RELEASE=Object.freeze({
 mediaPublic:false,decisionId:ITEM_IMAGE_OWNER_DECISION_ID,scope:SWITCH1253_OWNER_SCOPE,
 rightsHolderLicense:'UNKNOWN',licenseEvidenceSha256:null,rightsReview:'NOT_RUN',
 receivingContact:'NOT_RUN',takedown:'NOT_RUN',managedHttps:'NOT_RUN',attribution:'NOT_RUN',
 oldUrlAndCache:'NOT_RUN',rollback:'NOT_RUN',operatorReceiptSha256:null,items:Object.freeze({})
});
const STEAM_PUBLICATION_KEYS=['decisionId','scope','rightsHolderLicense','licenseEvidenceSha256',
 'rightsReview','managedHttps','takedown','receivingContact','attribution','oldUrlAndCache','rollback','operatorReceiptSha256'];
const steamCatalogs=new WeakSet();
export function prepareSteam1253ItemImageManifest(ids=[STEAM1253_DOOR_ID]){
 if(!Array.isArray(ids)||ids.length<1||ids.length>Object.keys(STEAM1253_NATIVE_PINS).length||
  ids.some(id=>typeof id!=='string'||!owns(STEAM1253_NATIVE_PINS,id))||new Set(ids).size!==ids.length)fail('STEAM_PREPARE_SCOPE_DENIED');
 const publication=Object.fromEntries(STEAM_PUBLICATION_KEYS.map(k=>[k,STEAM1253_REVIEWED_RELEASE[k]]));
 return {schema:STEAM1253_ITEM_IMAGE_SCHEMA,assetVariant:STEAM1253_ITEM_IMAGE_VARIANT,
  publication:{gate:'MEDIA_PUBLIC_PREPARED_OFF',...publication},
  items:Object.fromEntries(ids.map(id=>[id,{...STEAM1253_NATIVE_PINS[id],rightsStatus:'UNKNOWN',publicationDecision:'NOT_RUN'}])),
  switch:null};
}
export function validateSteam1253ItemImageCatalog(raw,release=STEAM1253_REVIEWED_RELEASE,switchRelease=SWITCH1253_REVIEWED_RELEASE){
 if(!reviewedReleaseOn(release))fail('STEAM_MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF');
 if(!exactKeys(raw,['schema','assetVariant','publication','items','switch'])||
    raw.schema!==STEAM1253_ITEM_IMAGE_SCHEMA||raw.assetVariant!==STEAM1253_ITEM_IMAGE_VARIANT||
    !exactKeys(raw.publication,['gate',...STEAM_PUBLICATION_KEYS])||
    raw.publication.gate!=='MEDIA_PUBLIC_SCOPED_ON'||
    STEAM_PUBLICATION_KEYS.some(k=>raw.publication[k]!==release[k]))fail('STEAM_MANIFEST_UNVERIFIED');
 if(!raw.items||typeof raw.items!=='object'||Array.isArray(raw.items))fail('STEAM_ITEMS_INVALID');
 const keys=Object.keys(raw.items);
 if(keys.some(id=>!owns(STEAM1253_NATIVE_PINS,id)))fail('STEAM_ITEM_NOT_PINNED');
 const rights=release.rightsHolderLicense==='UNKNOWN'?'UNKNOWN':'DOCUMENTED_LICENSE_APPROVED';
 const items=Object.create(null);
 for(const id of keys){
  const e=raw.items[id],r=release.items[id],pin=STEAM1253_NATIVE_PINS[id];
  if(!owns(release.items,id)||!exactKeys(e,[...Object.keys(pin),'rightsStatus','publicationDecision'])||
    Object.entries(pin).some(([k,v])=>e[k]!==v)||
    e.rightsStatus!==rights||e.publicationDecision!=='OWNER_SCOPED_PUBLICATION_ACCEPTED'||
    !exactKeys(r,['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'])||
    ['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].some(k=>r[k]!==e[k]))
   fail('STEAM_ITEM_PIN_RIGHTS_OR_VISIBILITY_UNVERIFIED');
  items[id]=Object.freeze({...pin});
 }
 // Existing reviewed Switch items remain available during transition. The
 // single fetched manifest carries their legacy validated subcatalog; never
 // fetch a second manifest or silently treat Steam pins as Switch pins.
 let fallback=null;
 if(reviewedReleaseOn(switchRelease)){
  if(raw.switch!==null)fallback=validateSwitch1253ItemImageCatalog(raw.switch,switchRelease);
 }else if(raw.switch!==null)fail('SWITCH_FALLBACK_GATE_OFF');
 const catalog=Object.freeze({assetVariant:STEAM1253_ITEM_IMAGE_VARIANT,items:Object.freeze(items),
  switch:fallback,count:keys.length+Object.keys(fallback?.items??{}).filter(id=>!owns(STEAM1253_NATIVE_PINS,id)).length});
 steamCatalogs.add(catalog);return catalog;
}
export function scopedSteam1253ItemImageHref(base,itemId,catalog){
 if(!baseOk(base)||!steamCatalogs.has(catalog))return null;
 const id=String(itemId),p=catalog.items[id];
 // A known Steam-primary ID can be withdrawn independently. Its absence
 // is authoritative; a legacy Switch slice must never resurrect it.
 if(owns(STEAM1253_NATIVE_PINS,id)){
  if(!p)return null;
  const prefix=base?'/'+base.replace(/^\/+|\/+$/g,''):'';
  return prefix+'/ddv/item-images/'+STEAM1253_ITEM_IMAGE_VARIANT+'/'+p.webpSha256.slice(0,2)+'/'+p.webpSha256+'.webp';
 }
 return scopedSwitch1253ItemImageHref(base,itemId,catalog.switch);
}

export function switch1253ItemImagePath(itemId,catalog){
 if(!catalog||!exactTarget(catalog.target)||
    catalog.assetVariant!==SWITCH1253_ITEM_IMAGE_VARIANT||
    catalog.codec!=='WEBP_LOSSLESS_RGBA_EXACT')return null;
 const id=String(itemId);
 if(!ITEM.test(id)||!Number.isSafeInteger(Number(id))||switchVisualQuarantined(id))return null;
 const item=catalog.items?.[id],pin=SWITCH1253_NATIVE_PINS[id];
 if(!item||!pin||item.originalNativeStreamSha256!==pin.originalNativeStreamSha256||
    item.sourcePngSha256!==pin.sourcePngSha256||
    item.webpSha256!==pin.webpSha256)return null;
 const shard=item.originalNativeStreamSha256.slice(0,2);
 return 'ddv/item-images/'+SWITCH1253_ITEM_IMAGE_VARIANT+'/'+shard+'/' +
   item.originalNativeStreamSha256+'-'+item.sourcePngSha256+'-'+item.webpSha256+'.webp';
}
export function scopedSwitch1253ItemImageHref(base,itemId,catalog){
 if(catalog&&steamCatalogs.has(catalog))return scopedSteam1253ItemImageHref(base,itemId,catalog);
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
export function createSwitch1253ManifestController(reviewedRelease,publish,clock=Date.now,profile=null){
 const gate=profile?.gate??(()=>reviewedReleaseOn(reviewedRelease));
 const manifestPath=profile?.path??SWITCH1253_MANIFEST_PATH;
 const validate=profile?.validate??(raw=>validateSwitch1253ItemImageCatalog(raw,reviewedRelease));
 let pending=null,last=null;
 const state=(reason)=>publish({status:'NOT_CONFIGURED',catalog:null,reason});
 function clear(reason='MANIFEST_REFRESH_REQUIRED'){
  const old=pending;pending=null;last=null;
  old?.stop();state(reason);
 }
 function load(base='',fetchImpl=globalThis.fetch,force=false){
  if(!gate()){clear('MEDIA_PUBLIC_OFF');return Promise.resolve(null);}
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
   const response=await fetchImpl(prefix+'/'+manifestPath,
    {credentials:'omit',redirect:'error',cache:'no-store',signal:abort.signal});
   if(!response.ok)fail('PUBLISHED_MANIFEST_UNAVAILABLE');
   const mime=response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
   if(mime!=='application/json')fail('PUBLISHED_MANIFEST_MIME_INVALID');
   return validate(await response.json());
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
export function createSteam1253ManifestController(release,switchRelease,publish,clock=Date.now){
 return createSwitch1253ManifestController(release,publish,clock,{
  gate:()=>reviewedReleaseOn(release),path:STEAM1253_MANIFEST_PATH,
  validate:raw=>validateSteam1253ItemImageCatalog(raw,release,switchRelease)
 });
}
const steamPrimaryOn=reviewedReleaseOn(STEAM1253_REVIEWED_RELEASE);
const productionController=steamPrimaryOn
 ?createSteam1253ManifestController(STEAM1253_REVIEWED_RELEASE,SWITCH1253_REVIEWED_RELEASE,value=>switch1253PublicItemImageSource.set(value))
 :createSwitch1253ManifestController(SWITCH1253_REVIEWED_RELEASE,value=>switch1253PublicItemImageSource.set(value));
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
 if((!steamPrimaryOn&&!reviewedReleaseOn(SWITCH1253_REVIEWED_RELEASE))||typeof window==='undefined'||typeof document==='undefined'){
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
