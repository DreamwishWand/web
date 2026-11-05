import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ITEM_IMAGE_SCHEMA, ITEM_IMAGE_TARGET, ITEM_IMAGE_SOURCE, R39_DERIVATIVE_MANIFEST_SHA256,
  validateItemImageCatalog, itemImageAssetPath, scopedItemImageHref,
  validateItemImagePreferences, saveItemImagePreferences,
  restoreItemImagePreferences, ITEM_IMAGE_DEFAULT_PREFERENCES, ITEM_IMAGE_PREFS_KEY,
  loadPublicItemImageSource
} from '../src/lib/item-media/public-item-images.mjs';

const sha='a'.repeat(64);
const manifest=()=>({
  schema:ITEM_IMAGE_SCHEMA,
  source:{...ITEM_IMAGE_SOURCE,derivativeManifestSha256:R39_DERIVATIVE_MANIFEST_SHA256},
  target:{...ITEM_IMAGE_TARGET},
  publication:{gate:'OWNER_SCOPED_ALLOWLIST',decisionId:'OWNER_20261105_R39_SUBSET',scope:'RELEASED_PLAYER_FACING_ITEM_THUMBNAILS'},
  items:{'31700014':{sourcePngSha256:sha,identityStatus:'VERSION_VERIFIED',visibility:'RELEASED_PLAYER_FACING',assetStatus:'WEBP_VERIFIED_160'}}
});

test('versioned R39 image catalog accepts only explicitly approved player-facing exact ItemID SHA',()=>{
  const valid=validateItemImageCatalog(manifest());
  assert.equal(valid.count,1);
  assert.equal(valid.items['31700014'],sha);
  assert.equal(itemImageAssetPath(31700014,valid),'ddv/item-images/v1.24.13/15/'+sha+'.webp');
  assert.equal(scopedItemImageHref('/web',31700014,valid),'/web/ddv/item-images/v1.24.13/15/'+sha+'.webp');
  assert.equal(scopedItemImageHref('',31700014,valid),'/ddv/item-images/v1.24.13/15/'+sha+'.webp');
  assert.equal(scopedItemImageHref('/web',0,valid),null);
  assert.equal(scopedItemImageHref('/web',1234,valid),null);
  assert.equal(scopedItemImageHref('https://other.example',31700014,valid),null);
  assert.equal(scopedItemImageHref('/web/../',31700014,valid),null);
});

test('unknown version/BID/schema and unreviewed/unsupported current DDV target never reuse R39 image silently',()=>{
  const m=manifest();
  for (const variant of [
    {...m,source:{...m.source,gameVersion:'1.25.3'}},
    {...m,source:{...m.source,derivativeManifestSha256:'f'.repeat(64)}},
    {...m,target:{...m.target,gameVersion:'1.25.3'}},
    {...m,target:{...m.target,buildID:'9A239D3DB569756D'}},
    {...m,target:{...m.target,schema:626}}
  ])assert.throws(()=>validateItemImageCatalog(variant),/ITEM_IMAGE_SOURCE_OR_VERSION_UNVERIFIED/);
  const valid=validateItemImageCatalog(m);
  assert.equal(itemImageAssetPath(31700014,valid,{...ITEM_IMAGE_TARGET,gameVersion:'1.25.3'}),null);
  assert.equal(itemImageAssetPath(31700014,valid,{...ITEM_IMAGE_TARGET,schema:626}),null);
});

test('publication decision and per-ItemID exact source identity are separate hard gates',()=>{
  const m=manifest();
  const badCases=[
    {...m,publication:{...m.publication,gate:'OFF'}},
    {...m,publication:{...m.publication,decisionId:''}},
    {...m,publication:{...m.publication,scope:'ALL_INTERNAL_UNRELEASED'}},
    {...m,items:{}},
    {...m,items:{'00031700014':m.items['31700014']}},
    {...m,items:{'not-an-id':m.items['31700014']}},
    {...m,items:{'31700014':{...m.items['31700014'],sourcePngSha256:'wrong'}}},
    {...m,items:{'31700014':{...m.items['31700014'],identityStatus:'UNKNOWN'}}},
    {...m,items:{'31700014':{...m.items['31700014'],visibility:'UNRELEASED'}}},
    {...m,items:{'31700014':{...m.items['31700014'],assetStatus:'RAW_PNG'}}}
  ];
  for(const variant of badCases)assert.throws(()=>validateItemImageCatalog(variant),/ITEM_IMAGE_/);
});

test('visual fit/size/density preferences only store layout strings, no game bytes',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  assert.deepEqual(restoreItemImagePreferences(storage),ITEM_IMAGE_DEFAULT_PREFERENCES);
  const prefs={size:80,fit:'cover',density:'compact'};
  assert.deepEqual(saveItemImagePreferences(storage,prefs),prefs);
  assert.deepEqual(JSON.parse(values.get(ITEM_IMAGE_PREFS_KEY)),prefs);
  assert.deepEqual(restoreItemImagePreferences(storage),prefs);
  for(const bad of [
    {size:0,fit:'contain',density:'compact'},
    {size:800,fit:'contain',density:'compact'},
    {size:56,fit:'stretch',density:'compact'},
    {size:56,fit:'contain',density:'remote'}
  ])assert.throws(()=>validateItemImagePreferences(bad),/ITEM_IMAGE_PREFERENCES_INVALID/);
});

test('manifest loading uses only same-origin fixed relative path; no public image if no manifest',async()=>{
  const calls=[];
  const fake=async (url,options)=>{calls.push({url,options});return {ok:false,status:404};};
  assert.equal(await loadPublicItemImageSource('/web',fake),null);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/web/ddv/item-images/v1/manifest.json');
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(calls[0].options.redirect,'error');
});

test('Collection, Explore and shared Item Detail all consume same production ItemThumb, with no local ZIP/IDB detour',()=>{
  const paths=[
    '../src/routes/collection/+page.svelte',
    '../src/routes/explore/+page.svelte',
    '../src/lib/entity/SharedEntityDetail.svelte'
  ];
  const sources=paths.map(p=>readFileSync(new URL(p,import.meta.url),'utf8'));
  const component=readFileSync(new URL('../src/lib/ui/ItemThumb.svelte',import.meta.url),'utf8');
  const preferences=readFileSync(new URL('../src/lib/ui/ItemImagePreferences.svelte',import.meta.url),'utf8');
  const loader=readFileSync(new URL('../src/lib/item-media/public-item-images.mjs',import.meta.url),'utf8');
  for(const code of sources) {
    assert.match(code,/\bItemThumb\b/);
    assert.match(code,/\bItemImagePreferences\b/);
  }
  assert.match(component,/loading="lazy"/);
  assert.match(component,/src=\{renderHref\}/);
  assert.match(component,/data-media-status/);
  assert.match(loader,/ITEM_IMAGE_MANIFEST_PATH/);
  assert.match(loader,/VERSION_VERIFIED/);
  assert.match(loader,/OWNER_SCOPED_ALLOWLIST/);
  assert.match(preferences,/contain/);
  assert.match(preferences,/cover/);
  assert.match(preferences,/density/);
  assert.doesNotMatch(sources.join('\n')+component+preferences+loader, /indexedDB|readAsDataURL|R39 ZIP|importR39Shards|FileReader|fetch\(https?:\/\/|autoUpload/i);
});
