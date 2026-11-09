// 04 QR-W NEW_ONLY audit of repaired 08 WEB PR801 rasterStatus equality.
// Synthetic receipts and a bounded installed-Chrome OFF smoke only; no private game media.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {get} from 'svelte/store';
import {
 SWITCH1253_ITEM_IMAGE_SCHEMA,SWITCH1253_ITEM_IMAGE_VARIANT,SWITCH1253_TARGET,
 SWITCH1253_ORIGINAL_BUNDLE_SHA256,SWITCH1253_NATIVE_PINS,SWITCH1253_REVIEWED_RELEASE,
 validateSwitch1253ItemImageCatalog,scopedSwitch1253ItemImageHref,
 loadSwitch1253PublicItemImageSource,switch1253PublicItemImageSource
} from '../src/lib/item-media/switch1253-public-item-images.mjs';
const REPAIRED='93ec2bb288982b7521721d855b329da80700bdeb';
const OLD='e48bedecc0947df9f87a0fd91805a5de48bffcac';
const SOURCE_BASE='7167f153a24adb9e7f5e7e05658aed86ca90d7d5';
const SOURCE_TARGET_MAIN='3921e33de23ce042db48d2a50a9495d3b8a79881';
const CURRENT_ACCEPTED_MAIN='b7ffb283df62e234ce0871d9a8f0791faa290864';
const original6=new Map([
 ['.github/workflows/web-shared-catalog-detail.yml','fda9684b8e90f262d9ac47d56839c2c029126a61'],
 ['scripts/web-shared-catalog-e2e-chrome.mjs','9e7fe2bd58ead8cf2ca19d1eb864a963aa1b0942'],
 ['src/lib/item-media/switch1253-public-item-images.mjs','d89c5c6942b3cc9eb95fd51e01b2cbd15a80a074'],
 ['src/lib/ui/ItemImagePreferences.svelte','6a3de17e1af24841cfc2dc2edd26b0c754e8fb03'],
 ['src/lib/ui/ItemThumb.svelte','7709d84ce4e9324f66f0ab466916b60ad8143425'],
 ['tests/web-switch1253-item-thumb-contract.test.mjs','559226952709f400bacdcc654c9cc3c15d0ce39f']
]);
const repaired2=new Map([
 ['src/lib/item-media/switch1253-public-item-images.mjs','d89c5c6942b3cc9eb95fd51e01b2cbd15a80a074'],
 ['tests/web-switch1253-item-thumb-contract.test.mjs','559226952709f400bacdcc654c9cc3c15d0ce39f']
]);
const qa2=[
 '.github/workflows/04qr-w-pr801-repaired93ec-rasterstatus-newonly-20261108.yml',
 'scripts/04qr-w-pr801-repaired93ec-rasterstatus-newonly-20261108.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',SOURCE_BASE,REPAIRED),SOURCE_BASE);
assert.equal(git('merge-base',SOURCE_TARGET_MAIN,REPAIRED),SOURCE_BASE,'source branch diverged from accepted main without modifying it');
assert.equal(git('merge-base',CURRENT_ACCEPTED_MAIN,REPAIRED),SOURCE_BASE,
 'reused accepted unrelated Native2, no ancestor reQA');
assert.deepEqual(diff(SOURCE_BASE,REPAIRED),[...original6.keys()].sort());
assert.deepEqual(diff(OLD,REPAIRED),[...repaired2.keys()].sort(),'repaired changed2 only');
assert.equal(git('merge-base',REPAIRED,'HEAD'),REPAIRED);
assert.deepEqual(diff(REPAIRED,'HEAD'),qa2,'QA-only2 ADD no product edits');
for(const [path,sha] of original6){
 assert.equal(git('rev-parse',REPAIRED+':'+path),sha,path+' pinned original');
 assert.equal(git('hash-object',path),sha,path+' no audit code modification');
}
for(const name of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK'])
 assert.ok(!process.env[name],name+' forbidden in public QA');
console.log('QRW801_FIXED_SOURCE6_REPAIR2_QA_ONLY2_GIT_PINS_PASS');
const item='40006096',pin=SWITCH1253_NATIVE_PINS[item],copy=x=>JSON.parse(JSON.stringify(x));
function fakeReview(){
 return {mediaPublic:true,rightsHolderLicense:'DOCUMENTED_SCOPE_LICENSE',
  rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',
  takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
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
assert.equal(Object.keys(SWITCH1253_NATIVE_PINS).length,1);
assert.equal(pin.rasterStatus,'SWITCH_DXT5_RGBA_EXACT_PRIVATE');
assert.equal(SWITCH1253_NATIVE_PINS['40000047'],undefined);
assert.equal(SWITCH1253_NATIVE_PINS['40002422'],undefined);
assert.equal(SWITCH1253_REVIEWED_RELEASE.mediaPublic,false);
assert.deepEqual(SWITCH1253_REVIEWED_RELEASE.items,{});
let fetchCalls=0;
const fakeFetch=async()=>{fetchCalls++;throw Error('MEDIA_OFF_MUST_NEVER_FETCH');};
assert.equal(await loadSwitch1253PublicItemImageSource('/web',fakeFetch),null);
assert.equal(fetchCalls,0);
assert.deepEqual(get(switch1253PublicItemImageSource),{
 status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'
});
assert.throws(()=>validateSwitch1253ItemImageCatalog(fakeManifest()),
 /MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
const positive=validateSwitch1253ItemImageCatalog(fakeManifest(),fakeReview());
assert.equal(positive.count,1);
assert.match(scopedSwitch1253ItemImageHref('/web',item,positive),
 /^\/web\/ddv\/item-images\/switch-1\.25\.3-schema626-lossless160-v1\//);
console.log('QRW801_FIXED_SWITCH1253_NATIVE_PIN_SYNTHETIC_POSITIVE_REAL_RUNTIME_MEDIA_OFF_ZERO_FETCH_PASS');

let denied=0;
const reject=(label,change,expected)=> {
 const m=fakeManifest(),r=fakeReview();
 change(m,r);
 assert.throws(()=>validateSwitch1253ItemImageCatalog(m,r),
   expected??/SWITCH1253_ITEM_IMAGE_/,label);
 denied++;
};
const statuses=[
 'UNVERIFIED','UNKNOWN','NOT_RUN_FORMAT50_DECODE','SWITCH_DXT5_RGBA_EXACT_PUBLIC',
 pin.rasterStatus+' ',pin.rasterStatus.toLowerCase(),'',null,undefined,false,0,1,{},[]
];
for(const value of statuses)
 reject('rasterStatus '+String(value),(m)=>{m.items[item].rasterStatus=value;},
 /SWITCH1253_ITEM_IMAGE_ITEM_ID_NATIVE_SHA_RGBA_RELEASE_OR_RIGHTS_UNVERIFIED/);
reject('rasterStatus key missing',m=>{delete m.items[item].rasterStatus;},
 /ITEM_ID_NATIVE_SHA_RGBA_RELEASE_OR_RIGHTS_UNVERIFIED/);
for(const k of ['originalNativeStreamSha256','sourcePngSha256','webpSha256']){
 reject('false item SHA '+k,m=>{m.items[item][k]='f'.repeat(64);});
 reject('false independent release '+k,(m,r)=>{r.items[item][k]='f'.repeat(64);});
}
for(const key of ['buildID','schema','platform','gameVersion']){
 const wrong={buildID:'52BD625D9B4E0053',schema:624,
  platform:'Steam/Windows',gameVersion:'1.25.0'}[key];
 reject('source '+key,m=>{m.source[key]=wrong;});
 reject('target '+key,m=>{m.target[key]=wrong;});
}
reject('original UnityFS SHA',m=>{m.source.originalBundleSha256='0'.repeat(64);});
reject('unsupported item id',m=>{m.items={'40000047':m.items[item]};});
reject('fake ItemID leading zero',m=>{m.items={'00040006096':m.items[item]};});
reject('R39/schema624 variant',m=>{m.assetVariant='r39-schema624-quality88';});
reject('wrong manifest publication',m=>{m.publication.gate='NOT_RUN';});
reject('unknown root manifest asset URL',m=>{m.assetUrl='https://outside.invalid/native.webp';});
reject('unknown item public media URL',m=>{m.items[item].url='https://outside.invalid/native.webp';});
reject('false Rights',(_,r)=>{r.rightsHolderLicense='UNKNOWN';});
reject('unapproved operator',(_,r)=>{r.managedHttps='NOT_RUN';});
for(const id of ['40000047','40002422','00040006096','../../40006096','0'])
 assert.equal(scopedSwitch1253ItemImageHref('/web',id,positive),null);
for(const url of ['https://outside.invalid','//outside.invalid','/web/../','/web?x=1'])
 assert.equal(scopedSwitch1253ItemImageHref(url,item,positive),null);
console.log('QRW801_FIXED_RASTER_STATUS_MISMATCH_MISSING_FORGED_BID_RIGHTS_ITEM_URL_DENIED_'+denied+'_PASS');

const origin=(process.env.QRW801_FIXED_ORIGIN||'http://127.0.0.1:4315').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'NOT_RUN: installed system Chrome required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),invalid=[],media=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin!==origin||!['GET','HEAD'].includes(r.method())){
  invalid.push(r.method()+' '+u.href);return route.abort('blockedbyclient');
 }
 if(/\/ddv\/item-images\/|\.png(?:$|\?)|\.webp(?:$|\?)/i.test(u.pathname)){
  media.push(u.pathname);return route.abort('blockedbyclient');
 }
 return route.continue();
});
const smoke=async(locale)=>{
 await page.goto(origin+'/'+locale+'/'+item+'/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:40000});
 assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('lang'),locale);
 const thumb=page.locator('[data-item-thumb-id="'+item+'"]');
 assert.ok(await thumb.count()>0,'ItemThumb candidate visible '+locale);
 assert.equal(await thumb.locator('img').count(),0,'MediaPublic OFF cannot show IMG');
 assert.equal(await thumb.getAttribute('data-media-status'),'unavailable');
 const p=page.locator('[data-item-image-layout-controls]');
 assert.ok(await p.count()>0,'keyboard prefs present '+locale);
 await p.locator('summary').first().focus();
 await page.keyboard.press('Enter');
 assert.equal(await p.evaluate(el=>el.open),true);
};
try{
 // Ancestor QA806 already verified all 8 locales and broad Collection/Explore,
 // only changed-risk real-browser smoke for two locales and two viewport conditions.
 await smoke('en');
 await page.setViewportSize({width:320,height:844});
 const mobile=await page.evaluate(()=>({c:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(mobile.s<=mobile.c+2,'320px reflow '+JSON.stringify(mobile));
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const zoom=await page.evaluate(()=>({c:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(zoom.s<=zoom.c+2,'CSS200 viewport640 reflow '+JSON.stringify(zoom));
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:900});
 await smoke('ja');
 assert.deepEqual(invalid,[],'no offsite/non-read request');
 assert.deepEqual(media,[],'no image or manifest or png/webp requests');
 assert.deepEqual(errors,[],'no Chrome JS errors');
 console.log('QRW801_FIXED_REAL_CHROME_EN_JA_PLACEHOLDERS_320_CSS200_KEYBOARD_ZERO_MEDIA_REQUEST_PASS');
 console.log('QRW801_FIXED_INDEPENDENT_RASTERSTATUS_CHANGED_ONLY_SCOPED_PASS');
}finally{await ctx.close();await browser.close();}
