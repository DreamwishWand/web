// Stage1 final-release Item image consumer contract (not a licence or an enabled media gate).
// Public image payload and verified cross-version mapping are deployed only by 01D/09 INT
// after a separate, explicit Owner-scoped media publication decision.
// Default GitHub Pages has no image manifest or game-art bytes.
import { writable } from 'svelte/store';

export const ITEM_IMAGE_MANIFEST_PATH = 'ddv/item-images/v1/manifest.json';
export const ITEM_IMAGE_SCHEMA = 'wand.item-images.public-catalog@1';
export const R39_DERIVATIVE_MANIFEST_SHA256 = 'c619541497732e76441c52f6505b2ca2dbe1fd2baffdfda4fa4584b9819a7733';
export const ITEM_IMAGE_SOURCE = Object.freeze({platform:'Nintendo Switch',gameVersion:'1.24.13',generation:'R39'});
export const ITEM_IMAGE_TARGET = Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',schema:624
});
export const ITEM_IMAGE_DEFAULT_PREFERENCES = Object.freeze({size:56,fit:'contain',density:'comfortable'});
export const ITEM_IMAGE_PREFS_KEY = 'wand.item-image.visual-preferences@1';
export const itemImagePreferences = writable({...ITEM_IMAGE_DEFAULT_PREFERENCES});
export const publicItemImageSource = writable({status:'NOT_CONFIGURED',catalog:null,reason:'NO_VERIFIED_PUBLIC_ASSET_MANIFEST'});

const hex64 = /^[a-f0-9]{64}$/;
const integerId = /^[1-9][0-9]{0,15}$/;
const approvedSizes = new Set([40,48,56,64,80,96]);
let activePromise = null;

export function validateItemImagePreferences(value) {
  if (!value || typeof value !== 'object' || !approvedSizes.has(value.size) ||
      !['contain','cover'].includes(value.fit) ||
      !['compact','comfortable'].includes(value.density))
    throw new TypeError('ITEM_IMAGE_PREFERENCES_INVALID');
  return {size:value.size,fit:value.fit,density:value.density};
}
export function restoreItemImagePreferences(storage) {
  if(!storage)return {...ITEM_IMAGE_DEFAULT_PREFERENCES};
  try {
    const raw=storage.getItem(ITEM_IMAGE_PREFS_KEY);
    const prefs=raw?validateItemImagePreferences(JSON.parse(raw)):{...ITEM_IMAGE_DEFAULT_PREFERENCES};
    itemImagePreferences.set(prefs);
    return prefs;
  } catch {
    const prefs={...ITEM_IMAGE_DEFAULT_PREFERENCES};
    itemImagePreferences.set(prefs);
    return prefs;
  }
}
export function saveItemImagePreferences(storage,value) {
  const prefs=validateItemImagePreferences(value);
  if(storage)storage.setItem(ITEM_IMAGE_PREFS_KEY,JSON.stringify(prefs));
  itemImagePreferences.set(prefs);
  return prefs;
}

export function validateItemImageCatalog(raw, expectedTarget=ITEM_IMAGE_TARGET) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw) ||
    raw.schema!==ITEM_IMAGE_SCHEMA ||
    raw.source?.platform!==ITEM_IMAGE_SOURCE.platform ||
    raw.source?.gameVersion!==ITEM_IMAGE_SOURCE.gameVersion ||
    raw.source?.generation!==ITEM_IMAGE_SOURCE.generation ||
    raw.source?.derivativeManifestSha256!==R39_DERIVATIVE_MANIFEST_SHA256 ||
    !expectedTarget || raw.target?.platform!==expectedTarget.platform ||
    raw.target?.gameVersion!==expectedTarget.gameVersion ||
    raw.target?.buildID!==expectedTarget.buildID ||
    raw.target?.schema!==expectedTarget.schema)
    throw new TypeError('ITEM_IMAGE_SOURCE_OR_VERSION_UNVERIFIED');
  // This is a release-operation authorization marker, not evidence of a copyright licence.
  if (raw.publication?.gate!=='OWNER_SCOPED_ALLOWLIST' ||
      typeof raw.publication?.decisionId!=='string' ||
      !/^[A-Za-z0-9_-]{8,100}$/.test(raw.publication.decisionId) ||
      raw.publication?.scope!=='RELEASED_PLAYER_FACING_ITEM_THUMBNAILS')
    throw new TypeError('ITEM_IMAGE_PUBLICATION_GATE_OFF');
  if (!raw.items || typeof raw.items!=='object' || Array.isArray(raw.items))
    throw new TypeError('ITEM_IMAGE_MAPPING_INVALID');
  const keys=Object.keys(raw.items);
  if(!keys.length || keys.length>40000) throw new TypeError('ITEM_IMAGE_MAPPING_EMPTY_OR_OVERSIZED');
  const validItems=Object.create(null);
  for (const key of keys) {
    const entry=raw.items[key];
    if (!integerId.test(key) || !Number.isSafeInteger(Number(key)) ||
        !entry || typeof entry!=='object' || Array.isArray(entry) ||
        !hex64.test(entry.sourcePngSha256 || '') ||
        entry.identityStatus!=='VERSION_VERIFIED' ||
        entry.visibility!=='RELEASED_PLAYER_FACING' ||
        entry.assetStatus!=='WEBP_VERIFIED_160')
      throw new TypeError('ITEM_IMAGE_IDENTITY_OR_ASSET_UNVERIFIED');
    validItems[key]=entry.sourcePngSha256;
  }
  return Object.freeze({source:Object.freeze({...raw.source}),
    target:Object.freeze({...raw.target}),publication:Object.freeze({...raw.publication}),
    items:Object.freeze(validItems),count:keys.length});
}
export function itemImageAssetPath(itemId,catalog,expectedTarget=ITEM_IMAGE_TARGET) {
  if (!catalog || !catalog.target || catalog.target.platform!==expectedTarget.platform ||
      catalog.target.gameVersion!==expectedTarget.gameVersion ||
      catalog.target.buildID!==expectedTarget.buildID || catalog.target.schema!==expectedTarget.schema)
    return null;
  const key=String(itemId);
  if(!integerId.test(key)||!Number.isSafeInteger(Number(key)))return null;
  const sha=catalog.items?.[key];
  if(typeof sha!=='string'||!hex64.test(sha))return null;
  const shard=(Number.parseInt(sha.slice(0,2),16)>>3).toString(16).padStart(2,'0');
  return 'ddv/item-images/v1.24.13/'+shard+'/'+sha+'.webp';
}
export function scopedItemImageHref(base,itemId,catalog,expectedTarget=ITEM_IMAGE_TARGET) {
  if(typeof base!=='string'||!/^\/?(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(base))
    return null;
  const path=itemImageAssetPath(itemId,catalog,expectedTarget);
  if(!path)return null;
  return (base?'/'+base.replace(/^\/+|\/+$/g,''):'')+'/'+path;
}
function fetchPath(base) {
  if(typeof base!=='string'||!/^\/?(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(base))
    throw new TypeError('ITEM_IMAGE_BASE_INVALID');
  return (base?'/'+base.replace(/^\/+|\/+$/g,''):'')+'/'+ITEM_IMAGE_MANIFEST_PATH;
}
// This downloads public metadata only. Real image bytes use normal <img> lazy loading
// with an immutable same-origin SHA path; no off-origin image URLs or CDN injection.
export function loadPublicItemImageSource(base='',fetchImpl=globalThis.fetch) {
  if(activePromise)return activePromise;
  activePromise=(async()=>{
    if(typeof fetchImpl!=='function')throw new Error('ITEM_IMAGE_FETCH_UNAVAILABLE');
    const response=await fetchImpl(fetchPath(base),{credentials:'omit',redirect:'error',cache:'force-cache'});
    if(!response.ok)throw new Error(response.status===404?'NO_PUBLISHED_IMAGES':'IMAGE_MANIFEST_REQUEST_FAILED');
    const catalog=validateItemImageCatalog(await response.json());
    publicItemImageSource.set({status:'VERIFIED',catalog,reason:''});
    return catalog;
  })().catch((error)=>{
    publicItemImageSource.set({status:'NOT_CONFIGURED',catalog:null,reason:String(error?.message || error)});
    return null;
  });
  return activePromise;
}
