// ACT628: actual Collection list/info, shared Detail and Explore routes.
// CI uses original synthetic test swatch; private local runner may supply the
// exact already-verified WebP via WAND_PRIVATE_DOOR_WEBP (never CI/artifacts).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {STEAM1253_DOOR_ID as ID,STEAM1253_DOOR_PIN as pin,STEAM1253_ITEM_IMAGE_VARIANT as variant} from '../src/lib/item-media/switch1253-public-item-images.mjs';
const root=(process.env.SHARED_DETAIL_E2E_URL||'http://127.0.0.1:4194').replace(/\/$/,'');
assert.match(root,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
const privatePath=process.env.WAND_PRIVATE_DOOR_WEBP;
if(privatePath&&process.env.CI)throw Error('PRIVATE_BYTES_FORBIDDEN_IN_CI');
const bytes=privatePath?await readFile(privatePath):Buffer.from('UklGRiQAAABXRUJQVlA4TBcAAAAvn8AnAAfQsVo0uf8BAEX6/58i+p/6AQA=','base64');
const digest=createHash('sha256').update(bytes).digest('hex');
if(privatePath){assert.equal(bytes.length,pin.bytes);assert.equal(digest,pin.webpSha256);}
else assert.notEqual(digest,pin.webpSha256);
const imgPath='/ddv/item-images/'+variant+'/'+pin.webpSha256.slice(0,2)+'/'+pin.webpSha256+'.webp';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 const page=await ctx.newPage(),hits=[],errors=[],bad=[];
 page.on('pageerror',e=>errors.push(String(e)));
 ctx.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||u.origin!==root)bad.push(r.url());});
 await page.route('**/ddv/item-images/**',async route=>{
  const p=new URL(route.request().url()).pathname;hits.push(p);
  if(p!==imgPath)return route.fulfill({status:404,body:'denied'});
  return route.fulfill({status:200,contentType:'image/webp',body:bytes});
 });
 async function setCatalog(withdraw=false){
  await page.evaluate(async({id,withdraw})=>{
   const mod=await import('/src/lib/item-media/switch1253-public-item-images.mjs');
   const m=mod.prepareSteam1253ItemImageManifest();
   const release={...mod.STEAM1253_REVIEWED_RELEASE,mediaPublic:true,rightsReview:'OPERATOR_ACCEPTED',
    receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
    attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',
    operatorReceiptSha256:'b'.repeat(64),items:{}};
   m.items[id].publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
   release.items[id]=Object.fromEntries(['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].map(k=>[k,m.items[id][k]]));
   const {mediaPublic,items,...publication}=release;m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...publication};
   if(withdraw)m.items={};
   const catalog=mod.validateSteam1253ItemImageCatalog(m,release);
   mod.switch1253PublicItemImageSource.set({status:'VERIFIED',catalog,reason:''});
  },{id:ID,withdraw});
 }
 const thumb='[data-item-thumb-id="'+ID+'"]';
 async function rendered(label,scope=''){
  const selector=scope+thumb;
  const target=page.locator(selector).first();
  await target.waitFor({timeout:35000});
  await setCatalog();
  const img=target.locator('img');
  await img.waitFor({timeout:15000});
  await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(sel=>{const x=document.querySelector(sel);return x?.complete&&x.naturalWidth===160&&x.naturalHeight===160;},selector+' img',{timeout:15000});
  assert.equal(await img.getAttribute('src'),imgPath);console.log('ACT628_'+label+'_PASS');
 }
 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:35000});
 await page.locator('[data-stage1-search]').fill(ID);
 await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:20000});
 assert.equal(await page.locator(thumb+' img').count(),0);assert.equal(hits.length,0);
 await rendered('COLLECTION_LIST','[data-stage1-search-groups] ');
 await page.locator('[data-stage1-search-groups] .item-card').first().click();
 await page.locator('[data-stage1-item-info]').waitFor({timeout:20000});
 await rendered('COLLECTION_INFO','[data-stage1-item-info] ');
 await setCatalog(true);await page.waitForFunction(sel=>!document.querySelector(sel),thumb+' img');
 await page.locator('[data-stage1-item-info] .info-actions > a').click();
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:35000});
 await rendered('SHARED_DETAIL','[data-shared-entity-detail] ');
 await page.goto(root+'/explore/',{waitUntil:'domcontentloaded'});
 await page.locator('.grid .card').first().waitFor({timeout:35000});
 await page.locator('.controls input[type="search"]').fill(ID);
 await rendered('EXPLORE');
 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:35000});
 await page.locator('[data-stage1-search]').fill('40300001');
 await setCatalog();
 assert.equal(await page.locator('[data-item-thumb-id="40300001"] img').count(),0);
 assert.ok(hits.length>0&&hits.every(p=>p===imgPath));
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
 console.log(privatePath?'ACT628_ACTUAL_PRIVATE_WEBP_COLLECTION_PASS':'ACT628_SYNTHETIC_WEBP_COLLECTION_PASS');
 await ctx.close();
}finally{await browser.close();}
