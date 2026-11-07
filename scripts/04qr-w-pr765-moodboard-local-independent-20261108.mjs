// 04 QR-W NEW_CHANGED_ONLY independent QA of 08 WEB PR765.
 // Source: original5 only, preserve accepted Collection/Explore ancestors.
 // Evidence: local synthetic typed Catalog and real installed Chrome, NOT real P1G.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {
 MOODBOARD_SCHEMA,MOODBOARD_VERSION,MOODBOARD_STORAGE_KEY,MOODBOARD_BACKUP_KEY,
 createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument,parseMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {toggleCollectionMoodboardInspiration,readCollectionMoodboards}
 from '../src/lib/collection/moodboard-inspire.mjs';
import {exploreCopy} from '../src/lib/explore/copy.js';

const BASE='963ddeffd9aaef94bb62c67d8842304093641576';
const SOURCE='6b4d86715b64d744cb09d16c883c71da340d8fd1';
const source=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','44d73f171b7b4db12b9f8b5c1042a68a30632bcd'],
 ['scripts/web-stage1-collection-chrome.mjs','cd35a9b868a3e0b44b89c8dc4fc04d1e483a86b6'],
 ['src/lib/collection/moodboard-inspire.mjs','722aeff12559b464e34cbade1b52276ca5e4a15d'],
 ['src/routes/collection/+page.svelte','8813f42c33a8f705e379ff130b609287a152304f'],
 ['tests/web-collection-moodboard-inspire.test.mjs','28ac2b42342877ec04a68a5fd96ba0025834786a']
]);
const qa=[
 '.github/workflows/04qr-w-pr765-moodboard-local-independent-20261108.yml',
 'scripts/04qr-w-pr765-moodboard-local-independent-20261108.mjs'
].sort();
const git=(...x)=>execFileSync('git',x,{encoding:'utf8'}).trim();
const paths=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',BASE,SOURCE),BASE);
assert.equal(git('rev-list','--count',BASE+'..'+SOURCE),'2');
assert.deepEqual(paths(BASE,SOURCE),[...source.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(paths(SOURCE,'HEAD'),qa);
for(const [path,sha] of source) {
 assert.equal(git('rev-parse',SOURCE+':'+path),sha,path);
 assert.equal(git('hash-object',path),sha,'QA may not edit source '+path);
}
for(const key of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK']){
 assert.ok(!process.env[key],'no owner private Save in public QA');
}
console.log('QRW_PR765_IMMUTABLE_SOURCE5_QA2_PASS');

const now='2026-11-08T00:00:00.000Z';
const {document,board}=createMoodboard(createEmptyMoodboardDocument(now),{title:'Independent Board'},
 {idFactory:()=> 'independent',now});
const original=serializeMoodboardDocument(document);
const verified=[{itemId:40000047,label:'Known Chair',family:'Furniture'}, {itemId:40000048,label:'Known Table',family:'Furniture'}];
function fakeStorage(raw=original,fail=null) {
 const cells=new Map([[MOODBOARD_STORAGE_KEY,raw]]);
 const changes=[];
 return {
  changes,
  getItem:k=>cells.get(k)??null,
  setItem(k,v) {
   if(k===fail)throw new DOMException('QuotaExceededError','QuotaExceededError');
   changes.push(k);
   cells.set(k,String(v));
  },
  inspect:k=>cells.get(k)??null,
  external:(k,v)=>cells.set(k,String(v))
 };
}
const toggle=(s,id=40000047,b=board.id,r=verified)=>
 toggleCollectionMoodboardInspiration(s,b,id,r,'Furniture');
assert.equal(board.id,'board_independent');
const positive=fakeStorage();
const added=toggle(positive);
assert.deepEqual([added.action,added.entityId,added.document.boards[0].references[0].type],['added','40000047','ITEM']);
assert.equal(positive.inspect(MOODBOARD_BACKUP_KEY),original);
const addedRaw=positive.inspect(MOODBOARD_STORAGE_KEY);
assert.equal(parseMoodboardDocument(addedRaw).boards[0].references[0].label,'Known Chair');
const removed=toggle(positive);
assert.equal(removed.action,'removed');
assert.equal(parseMoodboardDocument(positive.inspect(MOODBOARD_STORAGE_KEY)).boards[0].references.length,0);
assert.equal(positive.inspect(MOODBOARD_BACKUP_KEY),addedRaw);
console.log('QRW_PR765_TYPED_ITEM_ADD_REMOVE_BACKUP_REOPEN_PASS');

let denial=0;
function negative(label,run) {
 const s=fakeStorage();
 assert.throws(()=>run(s),undefined,label);
 assert.equal(s.inspect(MOODBOARD_STORAGE_KEY),original,label+' primary unchanged');
 assert.equal(s.inspect(MOODBOARD_BACKUP_KEY),null,label+' no backup created');
 denial++;
}
negative('unverified ItemID',s=>toggle(s,40000099));
negative('forged string ItemID',s=>toggle(s,'40000047'));
negative('fraction ItemID',s=>toggle(s,40000047.5));
negative('unsafe integer ItemID',s=>toggle(s,Number.MAX_SAFE_INTEGER+1));
negative('verified catalog no label',s=>toggle(s,40000047,board.id,[{itemId:40000047,label:'  '}]));
negative('non-array untrusted verified scope',s=>toggle(s,40000047,board.id,{}));
negative('missing/deleted board',s=>toggle(s,40000047,'board_deleted'));
negative('blank board selection',s=>toggle(s,40000047,''));
const malformed=fakeStorage();
malformed.external(MOODBOARD_STORAGE_KEY,'{truncated');
assert.throws(()=>toggle(malformed));
assert.equal(malformed.inspect(MOODBOARD_STORAGE_KEY),'{truncated');
assert.equal(malformed.inspect(MOODBOARD_BACKUP_KEY),null);
denial++;
const unsupported=fakeStorage();
unsupported.external(MOODBOARD_STORAGE_KEY,'{"schema":"unknown","boards":[]}');
assert.throws(()=>toggle(unsupported));
assert.equal(unsupported.inspect(MOODBOARD_BACKUP_KEY),null);
denial++;
for(const key of [MOODBOARD_BACKUP_KEY,MOODBOARD_STORAGE_KEY]) {
 const s=fakeStorage(original,key);
 assert.throws(()=>toggle(s));
 assert.equal(s.inspect(MOODBOARD_STORAGE_KEY),original,'failed primary/backup leaves old source');
 denial++;
}
const stale=fakeStorage();
const separate=createMoodboard(parseMoodboardDocument(original),
 {title:'Concurrent second board'},{now,idFactory:()=> 'another'});
stale.external(MOODBOARD_STORAGE_KEY,serializeMoodboardDocument(separate.document));
const newResult=toggle(stale);
assert.equal(newResult.document.boards.length,2,'latest disk storage preserved');
assert.equal(newResult.document.boards[1].title,'Concurrent second board');
assert.equal(stale.inspect(MOODBOARD_BACKUP_KEY),serializeMoodboardDocument(separate.document));
console.log('QRW_PR765_DENIAL_CASES_'+denial+'_AND_FRESHEST_CROSS_TAB_PASS');

for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']) {
 const t=exploreCopy(lang);
 for(const key of ['moodboard','chooseBoard','noBoards','add','remove','added','removed','openMoodboards'])
  assert.ok(typeof t[key]==='string'&&t[key].trim().length>0,lang+' '+key);
}
console.log('QRW_PR765_8LOCALES_EXISTING_COPY_PASS');

const origin=(process.env.QRW_PR765_URL||'http://127.0.0.1:4296').replace(/\/$/,'');
assert.ok(origin.startsWith('http://127.0.0.1:'),'actual local Chrome only');
assert.ok(process.env.CHROME_BIN,'real installed Chrome required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],unsafe=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',r=>{
 const u=new URL(r.url());
 if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+r.url());
});
const ready=async()=>page.locator('[data-stage1-category-grid] [data-category="Furniture"]').waitFor({timeout:35000});
const open=async()=>{
 await page.locator('[data-category="Furniture"]').click();
 await page.locator('[data-stage1-category-browse] .item-card').first().click();
 await page.locator('[data-stage1-item-info]').waitFor();
};
const fit=async where=>{
 const geom=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geom.scroll<=geom.viewport+2,where+': '+JSON.stringify(geom));
};
try {
 await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded',timeout:45000});
 await ready();
 assert.equal(await page.locator('.category-card').count(),29,'known public category baseline; no private Save');
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"]').count(),1);
 await page.evaluate(([k,v])=>localStorage.setItem(k,v),[MOODBOARD_STORAGE_KEY,original]);
 await page.reload({waitUntil:'domcontentloaded'});await ready();await open();
 const selector=page.locator('[data-collection-moodboard-select]');
 const button=page.locator('[data-collection-moodboard-toggle]');
 assert.equal(await selector.inputValue(),board.id);
 assert.equal(await button.getAttribute('aria-pressed'),'false');
 await button.focus();await page.keyboard.press('Enter');
 assert.equal(await button.getAttribute('aria-pressed'),'true');
 const itemId=await page.locator('[data-stage1-item-info]').getAttribute('data-item-id')
  ||await page.locator('[data-stage1-category-browse] .item-card').first().getAttribute('data-stage1-item-id');
 const persisted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),MOODBOARD_STORAGE_KEY);
 assert.equal(persisted.boards[0].references.length,1);
 assert.equal(persisted.boards[0].references[0].entityId,itemId);
 assert.equal(persisted.boards[0].references[0].type,'ITEM');
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),MOODBOARD_BACKUP_KEY),original);
 console.log('QRW_PR765_REAL_CHROME_KEYBOARD_TYPED_SAVE_PASS');
 await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
 await page.locator('.board-list button').first().waitFor({timeout:20000});
 assert.match(await page.locator('.board-list button').first().innerText(),/Independent Board/);
 await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded'});await ready();await open();
 assert.equal(await button.getAttribute('aria-pressed'),'true','cross-route local reopen retains selected ITEM');
 await button.focus();await page.keyboard.press('Enter');
 assert.equal(await button.getAttribute('aria-pressed'),'false');
 assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).boards[0].references.length,MOODBOARD_STORAGE_KEY),0);
 console.log('QRW_PR765_REAL_CHROME_CROSS_ROUTE_REOPEN_REMOVE_PASS');
 await page.setViewportSize({width:320,height:800});await fit('320');
 assert.equal(await button.isVisible(),true);
 assert.equal(await selector.isVisible(),true);
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('zoom200');
 assert.equal(await button.isVisible(),true);
 assert.equal(await selector.isVisible(),true);
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 console.log('QRW_PR765_REAL_CHROME_320_ZOOM200_PASS');
 // New UI must refuse a stale selection that another tab deleted, never restore it.
 await page.evaluate(([k,s,v,stamp])=>localStorage.setItem(k,JSON.stringify({
  schema:s,version:v,updatedAt:stamp,boards:[] })),[MOODBOARD_STORAGE_KEY,MOODBOARD_SCHEMA,MOODBOARD_VERSION,now]);
 await button.evaluate(el=>el.click());
 const afterDeleted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),MOODBOARD_STORAGE_KEY);
 assert.equal(afterDeleted.boards.length,0,'deleted Board cannot reappear due to stale Info component');
 assert.equal(await page.locator('[data-collection-moodboard-status]').count(),1,'show failure for deleted selected board');
 console.log('QRW_PR765_REAL_CHROME_DELETED_BOARD_NO_STALE_RECREATE_PASS');
 assert.deepEqual(errors,[],'no actual page errors');
 assert.deepEqual(unsafe,[],'no external/offorigin or POST upload');
 console.log('QRW_PR765_CHANGED_ONLY_SOURCE5_REAL_CHROME_SCOPED_PASS');
}finally{await browser.close();}
