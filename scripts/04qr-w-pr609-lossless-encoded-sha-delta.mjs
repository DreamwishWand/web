// 04 QR-W fixed-HEAD new-only QA for 08 WEB PR609 lossless/encoded SHA.
 // Every icon byte in this test is a self-authored 8x8 synthetic VP8L fixture.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {
 ITEM_IMAGE_SCHEMA,ITEM_IMAGE_VARIANT,ITEM_IMAGE_CODEC,
 ITEM_IMAGE_TARGET,ITEM_IMAGE_SOURCE,ITEM_IMAGE_OWNER_DECISION_ID,
 R39_ORIGINAL_PNG_MANIFEST_SHA256,ITEM_IMAGE_MANIFEST_PATH,
 validateItemImageCatalog,itemImageAssetPath,scopedItemImageHref
} from '../src/lib/item-media/public-item-images.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const MAIN='6428d080786bf3b2035be86b945b1460dbf1452a';
const ACCEPTED='1eedc47658b2499fb278eb656ef874fb0a30b00a';
const SRC='44f4a92fe89c7cd3ac16464792b579ef674c4e12';
const old9=[
 '.github/workflows/web-shared-catalog-detail.yml',
 'src/lib/entity/SharedEntityDetail.svelte',
 'src/lib/entity/shared-catalog-detail.mjs',
 'src/lib/item-media/public-item-images.mjs',
 'src/lib/ui/ItemImagePreferences.svelte',
 'src/lib/ui/ItemThumb.svelte',
 'src/routes/collection/+page.svelte',
 'src/routes/explore/+page.svelte',
 'tests/web-stage1-public-item-thumb-contract.test.mjs'
].sort();
const change2=['src/lib/item-media/public-item-images.mjs','tests/web-stage1-public-item-thumb-contract.test.mjs'].sort();
const qa2=['scripts/04qr-w-pr609-lossless-encoded-sha-delta.mjs','.github/workflows/04qr-w-pr609-lossless-encoded-sha-delta.yml'].sort();
assert.equal(git('merge-base',MAIN,ACCEPTED),MAIN);
assert.equal(git('merge-base',ACCEPTED,SRC),ACCEPTED);
assert.equal(git('merge-base',SRC,'HEAD'),SRC);
assert.deepEqual(git('diff','--name-only',MAIN,SRC).split('\n').sort(),old9);
assert.deepEqual(git('diff','--name-only',ACCEPTED,SRC).split('\n').sort(),change2);
const diff=git('diff','--name-only',SRC,'HEAD').split('\n').sort();
// Dedicated QA checkout contains only QA2. Generic PR synthetic merge may
// also contain independently accepted protected-main ancestors. Accept exact
// immutable Git blobs ONLY; no arbitrary additional Source or auth changes.
const acceptedMain=Object.freeze({
 'scripts/wep-decorate-stage1-browser-acceptance.mjs':'405e5d236038efa0004e5be870c334db09fd896d',
 'docs/core/01d-r39-real-asset-source-20261105.md':'f2c58039dea630722ca6a17513f2103060fe0745',
 'src/lib/ddv/core/items/r39-image-source-contract.mjs':'6ba8e08899e90ec674ecd4f9902bb214a51076c5',
 'tests/01d-r39-item-media-source-contract.test.mjs':'afdd044909d2eb6da076850ff73335f1a66ee555'
});
for(const p of diff){
 if(Object.hasOwn(acceptedMain,p))
  assert.equal(git('rev-parse','HEAD:'+p),acceptedMain[p],
   'only independently accepted cumulative WEP/01D blobs are excluded');
}
assert.deepEqual(diff.filter(p=>!Object.hasOwn(acceptedMain,p)),qa2,
 'no unknown Source or CI paths beyond QA2 and pinned protected-main ancestors');
for(const [path,sha] of Object.entries({
 'src/lib/item-media/public-item-images.mjs':'05bb81a0608785aab739a29c78bd2d7f842322aa',
 'tests/web-stage1-public-item-thumb-contract.test.mjs':'f09978df9c75b182cec4f8f1c44a886ac25cd705'
}))assert.equal(git('rev-parse',SRC+':'+path),sha,path);
console.log('QR609_LOSSLESS_SOURCE9_DELTA2_QA2_EXACT_BLOBS_PASS');

// Rights-clean static source: generated from an 8×8 toy checkerboard,
// NOT extracted from or resembling Disney Dreamlight Valley images.
const originalPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAUUlEQVR4nHWOsQ2AMAwE7yU2cI3ovCQDeprMAE1CsCHF62zJPr2A68BYZWM3oAH+R/UDBwKwHgdCZEOixv4yjO9Tc/520DR5NYRKh2RQ6fDwBoNlGQtBEpTgAAAAAElFTkSuQmCC','base64');
const lossless=Buffer.from('UklGRlQAAABXRUJQVlA4TEgAAAAvB8ABELkyRPQ/dhHR/3AwbNs2jB7p/4/uiMWCgPkgyLbJGe4w3AGOZgLy532fQ4BMdACEUxhYlyjQVOzpEr2AJgwodEOB7AI=','base64');
const H=x=>createHash('sha256').update(x).digest('hex');
const pngSha=H(originalPng),encodedSha=H(lossless);
assert.equal(pngSha,'937826151779ca5fffc84dab0b7f44f1703db07dd8e6eab197dceb7aafc44f5e');
assert.equal(encodedSha,'88e46cb8e2ddc36205e38a5c9d3c9f06f8a9e916142c41105e6fef4d635a926d');
assert.equal(lossless.toString('ascii',12,16),'VP8L','must use genuinely lossless WebP bitstream not quality88 VP8');
const ITEM='40000048';
const make=()=>({
 schema:ITEM_IMAGE_SCHEMA,
 assetVariant:ITEM_IMAGE_VARIANT,codec:ITEM_IMAGE_CODEC,format:'webp',lossless:true,
 source:{...ITEM_IMAGE_SOURCE,originalPngManifestSha256:R39_ORIGINAL_PNG_MANIFEST_SHA256},
 target:{...ITEM_IMAGE_TARGET},
 publication:{gate:'OWNER_GO_FOR_DDV_GAME_IMAGES',decisionId:ITEM_IMAGE_OWNER_DECISION_ID,scope:'RELEASED_PLAYER_FACING_ITEM_THUMBNAILS'},
 items:{[ITEM]:{sourcePngSha256:pngSha,webpSha256:encodedSha,pixelStatus:'RGBA_EXACT_VERIFIED',
  identityStatus:'VERSION_VERIFIED',visibility:'RELEASED_PLAYER_FACING',assetStatus:'WEBP_LOSSLESS_VERIFIED_160'}}
});
assert.equal(ITEM_IMAGE_VARIANT,'webp-lossless-160-v1');
assert.equal(ITEM_IMAGE_MANIFEST_PATH,'ddv/item-images/webp-lossless-160-v1/manifest.json');
const valid=validateItemImageCatalog(make());
const path=itemImageAssetPath(ITEM,valid);
const expected='ddv/item-images/webp-lossless-160-v1/v1.24.13/12/'+pngSha+'-'+encodedSha+'.webp';
assert.equal(path,expected);
assert.equal(scopedItemImageHref('/web',ITEM,valid),'/web/'+expected);
assert.equal(scopedItemImageHref('https://foreign.invalid',ITEM,valid),null);
assert.equal(scopedItemImageHref('/web/../',ITEM,valid),null);
assert.equal(itemImageAssetPath('unknown',valid),null);
assert.equal(itemImageAssetPath(ITEM,valid,{...ITEM_IMAGE_TARGET,schema:626}),null);
const variant=make();
variant.items[ITEM]={...variant.items[ITEM],webpSha256:'c'.repeat(64)};
assert.notEqual(itemImageAssetPath(ITEM,validateItemImageCatalog(variant)),path,
 'different encoded bytes for IDENTICAL original PNG must change immutable URL/cache key');
for(const bad of [
 x=>{x.codec='WEBP_QUALITY88';},
 x=>{x.assetVariant='v1.24.13';},
 x=>{x.lossless=false;},
 x=>{x.format='png';},
 x=>{delete x.items[ITEM].webpSha256;},
 x=>{x.items[ITEM].webpSha256='NOT_SHA';},
 x=>{x.items[ITEM].pixelStatus='SOURCE_ONLY';},
 x=>{x.items[ITEM].identityStatus='UNKNOWN';},
 x=>{x.items[ITEM].visibility='UNRELEASED';},
 x=>{x.items[ITEM].assetStatus='WEBP_VERIFIED_160';},
 x=>{x.target.buildID='9A239D3DB569756D';},
 x=>{x.target.schema=626;},
 x=>{x.source.originalPngManifestSha256='f'.repeat(64);},
 x=>{x.publication.gate='OFF';}
]){
 const raw=make();bad(raw);
 assert.throws(()=>validateItemImageCatalog(raw),/ITEM_IMAGE_/,JSON.stringify(raw));
}
console.log('QR609_LOSSLESS_SHARD_ENCODED_SHA_DIFFERENT_URL_LEGACY_Q88_FAILCLOSED_PASS');

const origin='http://127.0.0.1:4198';
assert.ok(process.env.CHROME_BIN,'NOT_RUN: local actual system Chrome not available');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 assert.equal(process.env[k],undefined,'no Owner private P1G in CI');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const blocked=[],pageErrors=[],assetHits=[];
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage();
page.on('pageerror',e=>pageErrors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN: websocket interception required');
await page.routeWebSocket('**/*',route=>{
 const u=new URL(route.url());
 if(!(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4198'))blocked.push('WS '+route.url());
 route.close(); // no HMR side channel
});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===origin&&['GET','HEAD'].includes(req.method()))route.continue();
 else{blocked.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
await page.route('**/ddv/item-images/webp-lossless-160-v1/manifest.json',route=>
 route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(make()),headers:{'Cache-Control':'no-store'}}));
await page.route('**/ddv/item-images/webp-lossless-160-v1/v1.24.13/**/*.webp',route=>{
 assetHits.push(route.request().url());
 return route.fulfill({status:200,contentType:'image/webp',body:lossless,headers:{'Cache-Control':'no-store'}});
});
try{
 const response=await page.goto(origin+'/explore/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(response?.status(),200);
 const search=page.locator('.controls input[type="search"]');
 await search.waitFor({state:'visible',timeout:30000});
 await search.fill(ITEM);
 const thumb=page.locator('[data-item-thumb-id="'+ITEM+'"]').first();
 await thumb.waitFor({state:'visible',timeout:30000});
 await thumb.scrollIntoViewIfNeeded();
 await page.waitForFunction(id=>{
  const img=document.querySelector('[data-item-thumb-id="'+id+'"] img');
  return Boolean(img && img.complete && img.naturalWidth===8 && img.naturalHeight===8);
 },ITEM,{timeout:30000});
 assert.equal(await thumb.getAttribute('data-media-status'),'verified-public-image');
 assert.equal(await thumb.locator('img').getAttribute('src'),'/'+expected);
 assert.ok((await thumb.locator('img').getAttribute('alt'))?.length>0);
 assert.ok(assetHits.length>0&&assetHits.every(url=>url===origin+'/'+expected),'no legacy/other-encoded image URL requested');
 assert.deepEqual(pageErrors,[],'runtime JS errors');
 assert.deepEqual(blocked,[],'no network exfil/POST/remote WS');
 console.log('QR609_LOCAL_CHROME_SYNTHETIC_VP8L_TWO_SHA_LAZY_IMG_NO_OFFORIGIN_PASS');
} finally {
 await ctx.close();
 await browser.close();
}
