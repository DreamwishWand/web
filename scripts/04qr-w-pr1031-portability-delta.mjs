// QA-only consumer test. Synthetic store receipt and canvas image are NOT real media authorization.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import * as M from '../src/lib/item-media/switch1253-public-item-images.mjs';
const S='b1b589bf373ae45a65247eb0eecb4cb6e3d195ef',B='93f56504240d68909e0a266a87bd284e34c5aeda';
const pins={".github/workflows/web-atomic-wep-sender.yml":"fb37bcebd4f522bddd98865300d792bd0ac1cec4",".github/workflows/web-collection-atomic-item-handoff.yml":"636168883d9b21345941bb0051cbd0c3872954c9",".github/workflows/web-moodboard-atomic-first.yml":"3d8c02c847ae4af6760d0054cddba74cb9cb7bd7","scripts/web-collection-atomic-item-handoff-chrome.mjs":"445caf1c04cfc697a542686e5dd55e096cc421c6","src/routes/moodboards/atomic/+page.svelte":"7346c9aa9911c96770d279f61a21472af98c7cf4","tests/web-collection-atomic-item-handoff.test.mjs":"60a92cba0c181a3dd4c1444e21f166defed515f4"};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',S,'HEAD'),S);
assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(pins).map(p=>'M\t'+p).sort());
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-pr1031-portability-delta.yml','A\tscripts/04qr-w-pr1031-portability-delta.mjs'].sort());
for(const [p,h] of Object.entries(pins))assert.equal(git('hash-object',p),h);
for(const p of ['src/lib/ui/ItemThumb.svelte','src/lib/item-media/switch1253-public-item-images.mjs','src/lib/collection/runtime.js','src/lib/moodboards/atomic-first-board.mjs','src/routes/collection/+page.svelte'])assert.equal(git('rev-parse',B+':'+p),git('rev-parse','HEAD:'+p));
assert.equal(M.SWITCH1253_REVIEWED_RELEASE.mediaPublic,false);
const id='40006096',other='40000047',pin=M.SWITCH1253_NATIVE_PINS[id];
const {rasterStatus,...hashes}=pin;
const pub={decisionId:'OWNER_GO_FOR_DDV_GAME_IMAGES_20261105',scope:'RELEASED_PLAYER_FACING_ITEM_THUMBNAILS',rightsHolderLicense:'UNKNOWN',licenseEvidenceSha256:null,rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',operatorReceiptSha256:'b'.repeat(64)};
const item={...hashes,rightsStatus:'UNKNOWN',publicationDecision:'OWNER_SCOPED_PUBLICATION_ACCEPTED',visibility:'RELEASED_PLAYER_FACING'};
const review={mediaPublic:true,...pub,items:{[id]:item}};
const raw={schema:M.SWITCH1253_ITEM_IMAGE_SCHEMA,assetVariant:M.SWITCH1253_ITEM_IMAGE_VARIANT,codec:'WEBP_LOSSLESS_RGBA_EXACT',format:'webp',lossless:true,source:{...M.SWITCH1253_TARGET,originalBundleSha256:M.SWITCH1253_ORIGINAL_BUNDLE_SHA256},target:{...M.SWITCH1253_TARGET},publication:{gate:'MEDIA_PUBLIC_SCOPED_ON',...pub},items:{[id]:{...item,rasterStatus,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',assetStatus:'WEBP_LOSSLESS_VERIFIED_160'}}};
const catalog=M.validateSwitch1253ItemImageCatalog(raw,review),imagePath='/'+M.switch1253ItemImagePath(id,catalog);
const origin='http://127.0.0.1:4317',path='/moodboards/atomic/';
const bin=['google-chrome-stable','google-chrome','chromium'].map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);assert.ok(bin);
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:320,height:850},serviceWorkers:'block',acceptDownloads:true});
const media=[],violations=[],errors=[];
let syntheticImage=null;
ctx.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))violations.push(r.method()+' '+u.origin);if(u.pathname.includes('/ddv/item-images/'))media.push(u.pathname)});
await ctx.route('**/ddv/item-images/**',async route=>{
 if(new URL(route.request().url()).pathname===imagePath&&syntheticImage)return route.fulfill({status:200,contentType:'image/webp',body:syntheticImage});
 return route.fulfill({status:404,body:'QA deny'});
});
const newPage=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));return p};
const ready=async(p,q='')=>{const response=await p.goto(origin+path+q,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);await p.locator('[data-atomic-ready="true"]').waitFor();await p.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});};
const thumb=p=>p.locator('[data-atomic-handoff-preview] [data-item-thumb-id]');
const row=p=>p.evaluate(async()=>{const m=await import('/src/lib/moodboards/atomic-first-board.mjs');const db=await m.openAtomicFirstBoardDatabase();try{const v=await m.verifiedAtomicFirstBoardReopen(db);return {primary:v?.primary,backup:v?.backup,revision:v?.revision}}finally{db.close()}});
const p=await newPage();
try{
 await ready(p);assert.equal(await p.locator('[data-item-thumb-id]').count(),0);
 await p.locator('[data-atomic-title]').fill('QA synthetic saved-only Board');await p.locator('[data-atomic-create]').click();await p.locator('[data-atomic-outcome="CREATED"]').waitFor();
 await p.locator('[data-atomic-item-id]').fill(id);await p.locator('[data-atomic-save-item]').click();await p.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor();
 const saved=await row(p);assert.equal(saved.revision,2);assert.equal(await p.locator('[data-atomic-items] [data-item-thumb-id]').count(),0);assert.equal(await p.locator('[data-atomic-item="'+id+'"]').count(),1);
 await ready(p,'?item='+other);await thumb(p).waitFor();assert.equal(await thumb(p).getAttribute('data-item-thumb-id'),other);assert.equal(await thumb(p).getAttribute('data-media-status'),'unavailable');assert.equal(await p.locator('[data-atomic-items] [data-item-thumb-id]').count(),0);
 await ready(p,'?item='+id);await thumb(p).waitFor();assert.equal(await thumb(p).getAttribute('data-item-thumb-id'),id);assert.equal(await thumb(p).getAttribute('data-media-status'),'unavailable');assert.equal(await p.locator('[data-atomic-handoff-add]').count(),0);assert.equal(await p.locator('[data-atomic-handoff-already]').count(),1);assert.deepEqual(media,[]);
 // Test-only consumer injection after real OFF mount; no loader/compiled flag mutation.
 const data=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=160;const x=c.getContext('2d');x.fillStyle='#345678';x.fillRect(0,0,160,160);return c.toDataURL('image/webp').split(',')[1]});
 syntheticImage=Buffer.from(data,'base64');assert.equal(syntheticImage.subarray(8,12).toString(),'WEBP');
 const inject=async page=>page.evaluate(async c=>{const m=await import('/src/lib/item-media/switch1253-public-item-images.mjs');m.switch1253PublicItemImageSource.set({status:'VERIFIED',catalog:c,reason:'QA_SYNTHETIC_CONSUMER_ONLY'});},catalog);
 await inject(p);const img=thumb(p).locator('img');await img.waitFor();await p.waitForFunction(()=>{const e=document.querySelector('[data-atomic-handoff-preview] img');return e?.complete&&e.naturalWidth===160;});
 assert.equal(await img.getAttribute('src'),imagePath);assert.ok((await img.getAttribute('alt')).length>0);assert.deepEqual(media,[imagePath]);
 assert.equal(await p.locator('[data-atomic-items] img').count(),0);assert.deepEqual(await row(p),saved);
 console.log('QRW1031_EXPLICIT_MATCHING_PUBLIC_ITEM_SYNTHETIC_CONSUMER_IMAGE_PASS');
 // Changed-risk: portable imported private references must not drive lookup, even with verified consumer catalog.
 const dlWait=p.waitForEvent('download');await p.locator('[data-atomic-portable-export]').click();
 const bytes=await (await import('node:fs/promises')).readFile(await (await dlWait).path());
 const dest=await browser.newContext({viewport:{width:320,height:850},serviceWorkers:'block',acceptDownloads:true});
 try{
  const q=await dest.newPage();const dmedia=[],derr=[],dunsafe=[];
  dest.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))dunsafe.push(r.method());if(u.pathname.includes('/ddv/item-images/'))dmedia.push(u.pathname)});
  q.on('pageerror',e=>derr.push(e.message));
  await dest.route('**/ddv/item-images/**',route=>route.fulfill({status:200,contentType:'image/webp',body:syntheticImage}));
  await ready(q,'?item='+other);await thumb(q).waitFor();await inject(q);
  await q.locator('[data-atomic-portable-file]').setInputFiles({name:'qa599.json',mimeType:'application/json',buffer:bytes});
  await q.locator('[data-atomic-outcome="PORTABLE_IMPORTED"]').waitFor();
  assert.deepEqual(await row(q),saved);assert.equal(await q.locator('[data-atomic-items] [data-item-thumb-id]').count(),0);
  assert.equal(await thumb(q).getAttribute('data-item-thumb-id'),other);assert.equal(await thumb(q).locator('img').count(),0);assert.deepEqual(dmedia,[]);
  const re=q.waitForEvent('download');await q.locator('[data-atomic-portable-export]').click();assert.deepEqual(await (await import('node:fs/promises')).readFile(await (await re).path()),bytes);
  await ready(q);await inject(q);assert.equal(await q.locator('[data-item-thumb-id]').count(),0);assert.deepEqual(dmedia,[]);
  await ready(q,'?item='+id);await thumb(q).waitFor();await inject(q);await thumb(q).locator('img').waitFor();
  await q.waitForFunction(()=>document.querySelector('[data-atomic-handoff-preview] img')?.naturalWidth===160);
  assert.deepEqual(dmedia,[imagePath]);assert.equal(await q.locator('[data-atomic-items] img').count(),0);
  for(const query of ['?item='+id+'&item='+id,'?item='+id+'&revision=2','?item=0'+id]){
    await ready(q,query);await q.locator('[data-atomic-handoff-denied]').waitFor();await inject(q);assert.equal(await q.locator('[data-item-thumb-id]').count(),0);
  }
  assert.deepEqual(await row(q),saved);assert.deepEqual(dmedia,[imagePath]);assert.deepEqual(derr,[]);assert.deepEqual(dunsafe,[]);
  assert.deepEqual(await row(p),saved);console.log('QA599_PORTABLE_IMPORTED_PRIVATE_REF_NO_LOOKUP_EXPLICIT_VERIFIED_ONLY_EXACT_REEXPORT_PASS');
 }finally{await dest.close()}
 assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
}finally{await ctx.close();await browser.close()}
