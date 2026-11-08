// Independent 04 QR-W PR801 Switch v1.25.3 ItemThumb: frozen Source6 + real Chrome.
// Synthetic reviewed manifest tests ONLY; never publish pixels, files, or an actual image.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {get} from 'svelte/store';
import {
 SWITCH1253_ITEM_IMAGE_SCHEMA,SWITCH1253_TARGET,SWITCH1253_ITEM_IMAGE_VARIANT,
 SWITCH1253_ORIGINAL_BUNDLE_SHA256,SWITCH1253_NATIVE_PINS,
 SWITCH1253_REVIEWED_RELEASE,switch1253PublicItemImageSource,
 validateSwitch1253ItemImageCatalog,scopedSwitch1253ItemImageHref,
 loadSwitch1253PublicItemImageSource
} from '../src/lib/item-media/switch1253-public-item-images.mjs';
const SOURCE='e48bedecc0947df9f87a0fd91805a5de48bffcac';
const sourceFiles=new Map([
 ['.github/workflows/web-shared-catalog-detail.yml','fda9684b8e90f262d9ac47d56839c2c029126a61'],
 ['scripts/web-shared-catalog-e2e-chrome.mjs','9e7fe2bd58ead8cf2ca19d1eb864a963aa1b0942'],
 ['src/lib/item-media/switch1253-public-item-images.mjs','b45cffba8a04de71ae02a226105225282cef37f8'],
 ['src/lib/ui/ItemImagePreferences.svelte','6a3de17e1af24841cfc2dc2edd26b0c754e8fb03'],
 ['src/lib/ui/ItemThumb.svelte','7709d84ce4e9324f66f0ab466916b60ad8143425'],
 ['tests/web-switch1253-item-thumb-contract.test.mjs','9289ffa9d061cfba7ef04819f3d0fcb1155ade19']
]);
const qaFiles=[
 '.github/workflows/04qr-w-pr801-switch1253-itemthumb-newonly-20261108.yml',
 'scripts/04qr-w-pr801-switch1253-itemthumb-newonly-20261108.mjs'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const base=git('merge-base','3921e33de23ce042db48d2a50a9495d3b8a79881',SOURCE);
assert.ok(base,'source ancestry available');
assert.deepEqual(diff(base,SOURCE),[...sourceFiles.keys()].sort(),'Source original6 ONLY');
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE,'audit is a direct Source child');
assert.deepEqual(diff(SOURCE,'HEAD'),qaFiles,'QA-only2 ADD and no Source edit');
for(const [p,blob] of sourceFiles){
 assert.equal(git('rev-parse',SOURCE+':'+p),blob,'frozen source blob '+p);
 assert.equal(git('hash-object',p),blob,'QA must not edit Source '+p);
}
for(const env of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK'])
 assert.ok(!process.env[env],env+' private inputs forbidden in public QA');
console.log('QRW801_SOURCE6_QA2_ORIGINAL_BLOBS_FROZEN_PASS');

const pin=SWITCH1253_NATIVE_PINS['40006096'],item='40006096';
const copy=x=>JSON.parse(JSON.stringify(x));
function fakeRelease(){
 return {mediaPublic:true,rightsHolderLicense:'DOCUMENTED_SCOPE_LICENSE',rightsReview:'OPERATOR_ACCEPTED',
  receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
  items:{[item]:{originalNativeStreamSha256:pin.originalNativeStreamSha256,
   sourcePngSha256:pin.sourcePngSha256,webpSha256:pin.webpSha256,
   rightsStatus:'DOCUMENTED_LICENSE_APPROVED'}}};
}
function fakeManifest(){
 return {
  schema:SWITCH1253_ITEM_IMAGE_SCHEMA,assetVariant:SWITCH1253_ITEM_IMAGE_VARIANT,
  codec:'WEBP_LOSSLESS_RGBA_EXACT',format:'webp',lossless:true,
  source:{...SWITCH1253_TARGET,originalBundleSha256:SWITCH1253_ORIGINAL_BUNDLE_SHA256},
  target:{...SWITCH1253_TARGET},
  publication:{gate:'MEDIA_PUBLIC_SCOPED_ON',rightsReview:'OPERATOR_ACCEPTED',
   managedHttps:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',
   receivingContact:'MANAGED_VERIFIED'},
  items:{[item]:{...pin,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',
   visibility:'RELEASED_PLAYER_FACING',rightsStatus:'DOCUMENTED_LICENSE_APPROVED',
   assetStatus:'WEBP_LOSSLESS_VERIFIED_160'}}
 };
}
assert.equal(SWITCH1253_TARGET.platform,'Nintendo Switch');
assert.equal(SWITCH1253_TARGET.gameVersion,'1.25.3');
assert.equal(SWITCH1253_TARGET.buildID,'9A239D3DB569756D');
assert.equal(SWITCH1253_TARGET.schema,626);
assert.equal(SWITCH1253_REVIEWED_RELEASE.mediaPublic,false);
assert.deepEqual(SWITCH1253_REVIEWED_RELEASE.items,{});
assert.deepEqual(Object.keys(SWITCH1253_NATIVE_PINS),[item],'1/3 Switch original DXT5 raster candidate only');
for(const id of ['40000047','40002422'])assert.equal(SWITCH1253_NATIVE_PINS[id],undefined);
let fetchCount=0;
const forbiddenFetch=async()=>{fetchCount++;return {ok:true,json:async()=>fakeManifest()};};
assert.equal(await loadSwitch1253PublicItemImageSource('/web',forbiddenFetch),null);
assert.equal(fetchCount,0,'Media OFF must not fetch even an available fake manifest');
assert.deepEqual(get(switch1253PublicItemImageSource),{
 status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'
});
assert.throws(()=>validateSwitch1253ItemImageCatalog(fakeManifest()),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
const positive=validateSwitch1253ItemImageCatalog(fakeManifest(),fakeRelease());
assert.equal(positive.count,1,'synthetic gated validator positive not a public release');
assert.match(scopedSwitch1253ItemImageHref('/web',item,positive),/^\/web\/ddv\/item-images\/switch-1\.25\.3-schema626-lossless160-v1\//);
for(const id of ['40000047','40002422','0','00040006096','NaN','../../40006096','99999999'])
 assert.equal(scopedSwitch1253ItemImageHref('/web',id,positive),null,'invalid/unsupported ItemID '+id);
for(const p of ['https://outside.invalid','//outside.invalid','/web/../','/web?x=1','/web#fragment'])
 assert.equal(scopedSwitch1253ItemImageHref(p,item,positive),null,'unsafe base '+p);
console.log('QRW801_RUNTIME_MEDIA_PUBLIC_OFF_ZERO_MANIFEST_REQUEST_POSITIVE_PLACEHOLDER_CONTRACT_PASS');
const unexpectedAccepted=[];
const reject=(label,mFn,rFn,match)=>{
 const m=fakeManifest(),r=fakeRelease();
 mFn?.(m);rFn?.(r);
 let got,err=null;
 try{got=validateSwitch1253ItemImageCatalog(m,r);}
 catch(e){err=e;}
 if(!err){
  unexpectedAccepted.push(label);
  console.error('QRW801_TRUE_RED_MANIFEST_FORGED_FIELD_ACCEPTED '+label+' resultCount='+String(got?.count));
 }else{
  assert.match(String(err),match??/^TypeError: SWITCH1253_ITEM_IMAGE_/,label);
 }
};
for(const [name,k,val] of [
 ['wrong BID','buildID','52BD625D9B4E0053'],
 ['wrong schema624','schema',624],
 ['wrong gameVersion','gameVersion','1.25.0'],
 ['wrong platform','platform','Steam/Windows']
]){
 reject('target '+name,m=>m.target[k]=val);
 reject('source '+name,m=>m.source[k]=val);
}
for(const k of ['originalNativeStreamSha256','sourcePngSha256','webpSha256']){
 reject('invalid '+k,m=>m.items[item][k]='f'.repeat(64));
 reject('mismatched reviewed '+k,null,r=>r.items[item][k]='f'.repeat(64));
}
for(const [section,key,value] of [
 ['root','assetUrl','https://outside.invalid/pixel.webp'],
 ['root','mediaPublic',true],['root','publicImagesEnabled',true],
 ['root','publicItemEligibility','PUBLIC'],['root','images',{'40006096':{url:'https://outside.invalid/a.png'}}],
 ['source','assetUrl','https://outside.invalid/a.webp'],['source','schema624',true],
 ['target','assetHost','https://outside.invalid'],['target','buildIDAlias','9A239D3DB569756D'],
 ['publication','assetUrl','https://outside.invalid/a.webp'],['publication','mediaPublic',true],
 ['item','url','https://outside.invalid/a.webp'],['item','mediaPublic',true],
 ['release','assetUrl','https://outside.invalid/a.webp'],['release','publicImagesEnabled',true],
 ['reviewedItem','assetUrl','https://outside.invalid/a.webp']
]){
 reject('unknown '+section+' '+key,
  m=>{if(section==='root')m[key]=value;
    else if(section==='source'||section==='target'||section==='publication')m[section][key]=value;
    else if(section==='item')m.items[item][key]=value;},
  r=>{if(section==='release')r[key]=value;
     if(section==='reviewedItem')r.items[item][key]=value;});
}
for(const k of ['mediaPublic','rightsHolderLicense','rightsReview','receivingContact','takedown','managedHttps'])
 reject('release not approved '+k,null,r=>r[k]=k==='mediaPublic'?false:'UNKNOWN');
for(const k of ['gate','rightsReview','receivingContact','takedown','managedHttps'])
 reject('unapproved publication '+k,m=>m.publication[k]='NOT_RUN');
for(const field of ['visibility','pixelStatus','rightsStatus','assetStatus','rasterStatus'])
 reject('fake item approval '+field,m=>m.items[item][field]='UNVERIFIED');
reject('wrong UnityFS bundle SHA',m=>m.source.originalBundleSha256='0'.repeat(64));
reject('legacy R39 variant',m=>m.assetVariant='R39-schema624-quality-88');
reject('external manifest URL key',m=>m.manifestUrl='https://outside.invalid/m.json');
reject('unknown unsupported id',m=>{m.items={'40000047':m.items[item]};});
reject('zero items',m=>{m.items={};});
console.log('QRW801_SYNTHETIC_ALL_SOURCE_TARGET_PUBLICATION_ITEM_RELEASE_UNKNOWN_AND_CROSS_BUILD_DENIED_PASS');

const origin=(process.env.QRW801_ORIGIN||'http://127.0.0.1:4305').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
if(!process.env.CHROME_BIN)throw new Error('NOT_RUN installed Chrome missing');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900},
 serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage(),offsite=[],media=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',route=>{
 const request=route.request(),u=new URL(request.url());
 if(request.method()!=='GET'&&request.method()!=='HEAD'){
  offsite.push(request.method()+' '+u.href);return route.abort('blockedbyclient');
 }
 if(u.origin!==origin){offsite.push(request.method()+' '+u.href);return route.abort('blockedbyclient');}
 if(/\/ddv\/item-images\/|\.webp(?:$|\?)|\.png(?:$|\?)/i.test(u.pathname)){
  media.push(request.method()+' '+u.pathname);return route.abort('blockedbyclient');
 }
 return route.continue();
});
const fit=async(label)=>{
 const layout=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth
 }));
 assert.ok(layout.scroll<=layout.viewport+2,label+' '+JSON.stringify(layout));
};
const placeholder=async(label,requiredId)=>{
 const thumbs=page.locator('[data-item-thumb-id]'),n=await thumbs.count();
 assert.ok(n>0,label+' should display ItemThumb placeholders');
 const withImage=await page.locator('[data-item-thumb-id] img').count();
 assert.equal(withImage,0,label+' no IMG while MediaPublic OFF');
 const available=await page.locator('[data-item-thumb-id][data-media-status="verified-public-image"]').count();
 assert.equal(available,0,label+' no verified image while MediaPublic OFF');
 const all=await thumbs.evaluateAll(nodes=>nodes.every(n=>n.getAttribute('data-media-status')==='unavailable'));
 assert.equal(all,true,label+' all ItemThumb must be unavailable');
 if(requiredId)assert.ok(await page.locator('[data-item-thumb-id="'+requiredId+'"]').count()>0,label+' must have typed Item');
};
try{
 await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:35000});
 await page.locator('[data-category="Furniture"]').evaluate(el=>el.click());
 await page.locator('[data-stage1-category-browse] .item-card').first().waitFor({timeout:25000});
 await placeholder('Collection browse');
 await page.locator('[data-stage1-category-browse] .item-card').first().evaluate(el=>el.click());
 await page.locator('[data-stage1-item-info]').waitFor({timeout:12000});
 await placeholder('Collection selected ITEM');
 console.log('QRW801_REAL_CHROME_COLLECTION_PLACEHOLDER_MEDIA_OFF_PASS');

 await page.goto(origin+'/explore/',{waitUntil:'domcontentloaded'});
 await page.locator('.grid .card').first().waitFor({timeout:35000});
 await placeholder('Explore');
 console.log('QRW801_REAL_CHROME_EXPLORE_PLACEHOLDER_MEDIA_OFF_PASS');

 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of locales){
  await page.goto(origin+'/'+locale+'/40000047/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:35000});
  assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('lang'),locale);
  await placeholder('Detail '+locale,'40000047');
  const pref=page.locator('[data-item-image-layout-controls]');
  assert.equal(await pref.count()>0,true,locale+' preference controls remain');
  const summary=pref.locator('summary').first();
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await pref.evaluate(el=>el.open),true,locale+' keyboard opens Preferences');
  const fields=await pref.locator('select').count();
  assert.ok(fields>=2,locale+' interactive fit/size/density preferences');
 }
 console.log('QRW801_REAL_CHROME_EIGHT_LOCALES_KEYBOARD_IMAGE_PLACEHOLDER_PASS');
 await page.setViewportSize({width:320,height:850});
 await fit('Switch1253-detail-320px');
 await placeholder('Switch1253-detail-320px','40000047');
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('Switch1253-detail-CSSzoom200');
 await placeholder('Switch1253-detail-CSSzoom200','40000047');
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:900});
 console.log('QRW801_REAL_CHROME_320_CSS_ZOOM200_NO_OVERFLOW_PASS');

 // Wrong-BID catalog must not be misinterpreted by current ItemThumb. The
 // existing verified catalog's own version gate may show unavailable detail.
 // No accepted media should request any manifest regardless of source response.
 await page.goto(origin+'/en/40006096/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:35000});
 await placeholder('Switch1253-native-candidate-40006096','40006096');
 assert.deepEqual(offsite,[],'no POST/external host');
 assert.deepEqual(media,[],'no media URL or manifest/image request');
 assert.deepEqual(errors,[],'no browser JS error');
 console.log('QRW801_REAL_CHROME_NO_PUBLIC_IMAGE_MANIFEST_OR_EXTERNAL_NETWORK_REQUEST_PASS');
 if(unexpectedAccepted.length){
 console.error('QRW801_TRUE_RED_SCOPED_UNVERIFIED_MANIFEST_FIELDS '+JSON.stringify(unexpectedAccepted));
 throw new Error('TRUE_RED_SCOPED: accepted malformed fields in current Switch1253 synthetic pre-publication manifest, while runtime MediaPublic remains OFF');
}
console.log('QRW801_INDEPENDENT_SCOPED_CONSUMER_MEDIA_OFF_PASS');
}finally{await context.close();await browser.close();}
