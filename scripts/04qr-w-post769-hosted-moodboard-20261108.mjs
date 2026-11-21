// 04 QR-W: independent actual hosted TEST Pages after selective 09 INT PR769.
// Accepted 08 WEB Source PR765 local Chrome QA767 and old hosted PR759 are inherited.
// No private Save, media, auth, cloud, Writer, remote mutation, or screenshot upload.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {
 MOODBOARD_STORAGE_KEY, MOODBOARD_BACKUP_KEY, MOODBOARD_SCHEMA, MOODBOARD_VERSION,
 createEmptyMoodboardDocument, createMoodboard, serializeMoodboardDocument
} from '../src/lib/moodboards/store.js';

const PARENT='963ddeffd9aaef94bb62c67d8842304093641576';
const MAIN='23f859613fad0c75f8938fc2fca98003bf05aa58';
const ORIGIN='https://dreamwishwand.github.io';
const ROOT=ORIGIN+'/web';
const changed=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','44d73f171b7b4db12b9f8b5c1042a68a30632bcd'],
 ['scripts/web-stage1-collection-chrome.mjs','cd35a9b868a3e0b44b89c8dc4fc04d1e483a86b6'],
 ['src/lib/collection/moodboard-inspire.mjs','722aeff12559b464e34cbade1b52276ca5e4a15d'],
 ['src/routes/collection/+page.svelte','8813f42c33a8f705e379ff130b609287a152304f'],
 ['tests/web-collection-moodboard-inspire.test.mjs','28ac2b42342877ec04a68a5fd96ba0025834786a']
]);
const qa=[
 '.github/workflows/04qr-w-post769-hosted-moodboard-20261108.yml',
 'scripts/04qr-w-post769-hosted-moodboard-20261108.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',PARENT,MAIN),PARENT);
assert.equal(git('rev-list','--count',PARENT+'..'+MAIN),'1');
assert.deepEqual(diff(PARENT,MAIN),[...changed.keys()].sort(),'PR769 only 5 original Source paths');
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(diff(MAIN,'HEAD'),qa,'QA only 2 files; no product Source changed');
for(const [p,sha] of changed){
 assert.equal(git('rev-parse',MAIN+':'+p),sha,p);
 assert.equal(git('hash-object',p),sha,'source blob modified by QA: '+p);
}
assert.ok(process.env.CHROME_BIN,'NOT_RUN: installed Chrome required');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED']){
 assert.ok(!process.env[k],'owner-private P1G forbidden in public QA: '+k);
}
console.log('QRW769_HOSTED_PROTECTED_MAIN_EXACT5_SOURCE_QA2_HASH_PASS');

async function direct(path){
 const r=await fetch(ROOT+path,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(35000)});
 const b=await r.text();
 const result={path,status:r.status,contentType:r.headers.get('content-type'),location:r.headers.get('location'),bytes:Buffer.byteLength(b),sha256:createHash('sha256').update(b).digest('hex')};
 console.log('QRW769_HOSTED_DIRECT_HTTP '+JSON.stringify(result));
 assert.equal(result.status,200,path+' real direct route HTTP200 required, not 404 fallback');
 assert.match(result.contentType??'',/text\/html/i);
 assert.equal(result.location,null);
 assert.ok(result.bytes>500);
}
await direct('/collection/');
await direct('/moodboards/');
console.log('QRW769_HOSTED_REAL_COLLECTION_MOODBOARDS_DIRECT_HTTP200_PASS');

const now='2026-11-08T00:00:00.000Z';
const {document,board}=createMoodboard(createEmptyMoodboardDocument(now),{title:'QR W Hosted Scene'},
 {now,idFactory:()=> 'hosted'});
const original=serializeMoodboardDocument(document);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const unsafe=[],errors=[],sockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>sockets.push(w.url()));
await page.route('**/*',route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin===ORIGIN&&['GET','HEAD'].includes(r.method()))route.continue();
 else{unsafe.push(r.method()+' '+r.url());route.abort('blockedbyclient');}
});
const collection=ROOT+'/collection/';
const moodboards=ROOT+'/moodboards/';
const enterCollection=async()=>{
 const response=await page.goto(collection,{waitUntil:'domcontentloaded',timeout:60000});
 assert.equal(response?.status(),200);
 await page.locator('[data-stage1-category-grid] [data-category="Furniture"]').waitFor({timeout:40000});
};
const openInfo=async()=>{
 await page.locator('[data-category="Furniture"]').click();
 const card=page.locator('[data-stage1-category-browse] .item-card').first();
 const itemId=await card.getAttribute('data-stage1-item-id');
 assert.match(itemId??'',/^[1-9][0-9]*$/);
 await card.focus();await page.keyboard.press('Enter');
 await page.locator('[data-stage1-item-info]').waitFor({timeout:15000});
 await page.locator('[data-collection-moodboard-inspire]').waitFor({timeout:12000});
 return itemId;
};
const fit=async tag=>{
 const width=await page.evaluate(()=>({view:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(width.scroll<=width.view+2,tag+' overflow '+JSON.stringify(width));
};
try{
 await enterCollection();
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
 assert.equal(await page.locator('.personal-state button[disabled]').count(),2,'personal Owned/Missing unavailable');
 await page.evaluate(([k,v])=>localStorage.setItem(k,v),[MOODBOARD_STORAGE_KEY,original]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-category="Furniture"]').waitFor();
 const itemId=await openInfo();
 const select=page.locator('[data-collection-moodboard-select]');
 const toggle=page.locator('[data-collection-moodboard-toggle]');
 assert.equal(await select.inputValue(),board.id,'same existing Moodboard selected from localStore');
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 assert.equal(await toggle.isEnabled(),true);
 await fit('hosted320-before-add');
 await toggle.focus();await page.keyboard.press('Enter');
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),MOODBOARD_STORAGE_KEY);
 assert.equal(stored.boards[0].references.length,1);
 assert.equal(stored.boards[0].references[0].entityId,itemId,'real rendered Catalog ItemID only');
 assert.equal(stored.boards[0].references[0].type,'ITEM');
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),MOODBOARD_BACKUP_KEY),original,'original raw backup unmodified');
 console.log('QRW769_HOSTED_320_KEYBOARD_ITEM_TYPED_ADD_AND_ORIGINAL_BACKUP_PASS');
 const moodRes=await page.goto(moodboards,{waitUntil:'domcontentloaded',timeout:55000});
 assert.equal(moodRes?.status(),200);
 await page.locator('.board-list button').first().waitFor({timeout:25000});
 assert.match(await page.locator('.board-list button').first().innerText(),/QR W Hosted Scene/);
 console.log('QRW769_HOSTED_NAVIGATION_EXISTING_MOODBOARD_CONSUMER_PASS');
 await enterCollection();
 const sameId=await openInfo();
 assert.equal(sameId,itemId);
 assert.equal(await toggle.getAttribute('aria-pressed'),'true','saved ITEM state survives Pages route reopen');
 await toggle.focus();await page.keyboard.press('Enter');
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 const rawAfter=await page.evaluate(k=>localStorage.getItem(k),MOODBOARD_STORAGE_KEY);
 assert.equal(JSON.parse(rawAfter).boards[0].references.length,0);
 console.log('QRW769_HOSTED_REOPEN_REMOVE_REFERENCE_PASS');
 // Changed runtime: selected board deleted in another same-origin context must not be resurrected.
 await page.evaluate(([key,schema,version,stamp])=>localStorage.setItem(key,JSON.stringify({
  schema,version,updatedAt:stamp,boards:[]
 })),[MOODBOARD_STORAGE_KEY,MOODBOARD_SCHEMA,MOODBOARD_VERSION,now]);
 await toggle.evaluate(el=>el.click());
 assert.equal(await page.locator('[data-collection-moodboard-status]').count(),1);
 assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).boards.length,MOODBOARD_STORAGE_KEY),0);
 console.log('QRW769_HOSTED_DELETED_BOARD_FAILCLOSED_NO_RESURRECTION_PASS');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-category="Furniture"]').waitFor();
 await openInfo();
 assert.equal(await toggle.isDisabled(),true,'no local Board must not silently create');
 assert.match(await page.locator('[data-collection-moodboard-inspire] a').getAttribute('href'),/\/moodboards\/$/);
 console.log('QRW769_HOSTED_EMPTY_BOARD_DISABLED_AND_LINK_TO_EXISTING_MOODBOARDS_PASS');
 // Malformed current local doc must be preserved, not overwritten as an empty writable board.
 await page.evaluate(k=>localStorage.setItem(k,'{bad-json'),MOODBOARD_STORAGE_KEY);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-category="Furniture"]').waitFor();
 await openInfo();
 assert.equal(await toggle.isDisabled(),true);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),MOODBOARD_STORAGE_KEY),'{bad-json');
 console.log('QRW769_HOSTED_CORRUPT_LOCAL_STORE_FAILCLOSED_PASS');
 await fit('hosted320');
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('hosted-css200');
 assert.equal(await select.isVisible(),true);
 assert.equal(await toggle.isVisible(),true);
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 console.log('QRW769_HOSTED_320_AND_200_PERCENT_UI_ACCESS_PASS');
 assert.deepEqual(unsafe,[],'GET-only same origin: no upload/off-host/private Provider');
 assert.deepEqual(errors,[],'no JS errors');
 assert.deepEqual(sockets,[],'no new Websocket');
 console.log('QRW769_HOSTED_NEW_MOODBOARD_TEST_PAGES_SCOPED_PASS');
}finally{await browser.close();}
