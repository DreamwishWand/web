// 04 QR-W independently verifies ONLY PR772 Web Locks/legacy collision changed scope.
// This QA is not a product Writer, not a Save reader, not native game data.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument,
  parseMoodboardDocument,MOODBOARD_STORAGE_KEY,MOODBOARD_BACKUP_KEY} from '../src/lib/moodboards/store.js';
import {MOODBOARD_EXCLUSIVE_LOCK,withExclusiveMoodboardCommit}
  from '../src/lib/moodboards/write-coordinator.mjs';
import {createFirstCollectionMoodboardWithItem}
  from '../src/lib/collection/moodboard-inspire.mjs';
const MAIN_BASE='b7d86d47125f1764919b67898c39badaf35976d8';
const SOURCE='75154232149de67bdbd692121674dba21bf6ed7b';
const originals=new Map([
 ['.github/workflows/web-shared-catalog-detail.yml','7a4262ac2b1583ed350bda6d9fa083b2d06980e7'],
 ['.github/workflows/web-stage1-collection-ux.yml','0fb647b0160e5ced790739aaf13f8bd6d8144b18'],
 ['scripts/web-shared-catalog-e2e-chrome.mjs','c599d7828a018bdf56fcb126ea6301f38acdc642'],
 ['scripts/web-stage1-collection-chrome.mjs','fb18bedf5590a04e2e5b322c46436315c0f86542'],
 ['src/lib/collection/moodboard-inspire.mjs','5b68d6d6487bb32d89630fa85b3b26cb92789372'],
 ['src/lib/entity/SharedEntityDetail.svelte','04f5e3741f13d184f5a84504d92ffe1a0fcb8322'],
 ['src/lib/moodboards/write-coordinator.mjs','b5045f0ded1cf281fe2853fd8478d21d9a3f62cc'],
 ['src/routes/collection/+page.svelte','78bb6e01cf1b0603a8b5e5a202203993f7029466'],
 ['src/routes/explore/+page.svelte','a7f009a5b6bd35a7f1e8a8b4bee39f27f603d2e4'],
 ['src/routes/moodboards/+page.svelte','d90dba0237d4e75b8a08b8c6b3c028ac7b413f7d'],
 ['tests/web-collection-moodboard-inspire.test.mjs','8c12e6ff63daf2b78c07b4d4a51acb59d4ddb987']
]);
const qa=['.github/workflows/04qr-w-pr772-weblocks-legacy-newonly-20261108.yml',
 'scripts/04qr-w-pr772-weblocks-legacy-newonly-20261108.mjs'].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(l,h)=>git('diff','--name-only',l,h).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN_BASE,SOURCE),MAIN_BASE);
assert.deepEqual(diff(MAIN_BASE,SOURCE),[...originals.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(SOURCE,'HEAD'),qa);
for(const [p,sha] of originals){
 assert.equal(git('rev-parse',SOURCE+':'+p),sha,p+' fixed Source');
 assert.equal(git('hash-object',p),sha,p+' no QA Source edit');
}
for(const k of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK'])
 assert.ok(!process.env[k],'No private Save in public QA');
console.log('QRW772_WEBLOCKS_FIXED_SOURCE11_QA_ONLY2_SHA_PASS');
const ts='2026-11-08T00:00:00.000Z';
const empty=serializeMoodboardDocument(createEmptyMoodboardDocument(ts));
const other=serializeMoodboardDocument(createMoodboard(createEmptyMoodboardDocument(ts),
 {title:'Legacy Noncooperating Tab'},{idFactory:()=> 'other-tab',now:ts}).document);
const catalog=[{itemId:40000047,label:'Verified Chair'}];
const locks=(()=>{let tail=Promise.resolve();return {request(name,opts,fn){
 assert.equal(name,MOODBOARD_EXCLUSIVE_LOCK);assert.equal(opts.mode,'exclusive');
 const result=tail.then(()=>fn({name,mode:'exclusive'}));
 tail=result.then(()=>{},()=>{});
 return result;
}}})();
const first=(storage,opt={})=>createFirstCollectionMoodboardWithItem(
 storage,'My First Board',40000047,catalog,'Furniture',{locks,...opt});
function mk(raw=empty,hook){
 const m=new Map(raw===null?[]:[[MOODBOARD_STORAGE_KEY,raw]]),actions=[];
 return {
  getItem(k){const v=m.get(k)??null;hook?.({kind:'get',key:k,val:v,m,actions});return v;},
  setItem(k,v){hook?.({kind:'setBefore',key:k,val:v,m,actions});actions.push(['set',k]);m.set(k,String(v));hook?.({kind:'setAfter',key:k,val:v,m,actions});},
  raw:k=>m.get(k)??null,actions,m
 };
}
const good=mk();
const success=await first(good);
assert.equal(success.document.boards.length,1);
assert.equal(good.raw(MOODBOARD_BACKUP_KEY),empty);
assert.equal(good.actions.filter(a=>a[1]===MOODBOARD_STORAGE_KEY).length,1);
assert.equal(parseMoodboardDocument(good.raw(MOODBOARD_STORAGE_KEY)).boards[0].references[0].entityId,'40000047');
console.log('QRW772_WEBLOCKS_FIRST_BOARD_EXACT_BACKUP_SINGLE_PRIMARY_REOPEN_PASS');
const unavailable=mk();
await assert.rejects(first(unavailable,{locks:null}),/MOODBOARD_EXCLUSIVE_LOCK_UNAVAILABLE/);
assert.equal(unavailable.raw(MOODBOARD_STORAGE_KEY),empty);
assert.equal(unavailable.raw(MOODBOARD_BACKUP_KEY),null);
console.log('QRW772_WEBLOCKS_UNAVAILABLE_FAILCLOSED_PASS');
let injectedAtBackup=false;
const prev=mk(empty,({kind,key,m})=>{
 if(kind==='setBefore'&&key===MOODBOARD_BACKUP_KEY&&!injectedAtBackup){
  injectedAtBackup=true;m.set(MOODBOARD_STORAGE_KEY,other);
 }
});
await assert.rejects(first(prev),/MOODBOARD_CONCURRENT_NONCOOPERATING_WRITE_DENIED/);
assert.equal(injectedAtBackup,true);
assert.equal(prev.raw(MOODBOARD_STORAGE_KEY),other);
assert.equal(prev.actions.filter(a=>a[1]===MOODBOARD_STORAGE_KEY).length,0);
console.log('QRW772_QA777_BACKUP_TO_PRIMARY_INTERLEAVE_REPAIRED_DENIAL_PASS');
const oldTab=mk(empty);
const parallel=await Promise.allSettled([first(oldTab),first(oldTab)]);
assert.equal(parallel.filter(x=>x.status==='fulfilled').length,1);
assert.equal(parallel.filter(x=>x.status==='rejected').length,1);
assert.equal(parseMoodboardDocument(oldTab.raw(MOODBOARD_STORAGE_KEY)).boards.length,1);
console.log('QRW772_SAME_LOCK_TWO_COOPERATING_FIRST_BOARD_CALLS_SERIALIZED_PASS');

const host=(process.env.QRW772_ORIGIN||'http://127.0.0.1:4302').replace(/\/$/,'');
assert.match(host,/^http:\/\/127\.0\.0\.1:/);
assert.ok(process.env.CHROME_BIN,'Installed Chrome required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
const one=await context.newPage(),two=await context.newPage();
const errors=[],unsafe=[];
for(const page of [one,two]){
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const request=route.request(),u=new URL(request.url());
  if(u.origin===host&&['GET','HEAD'].includes(request.method()))route.continue();
  else{unsafe.push(request.method()+' '+request.url());route.abort('blockedbyclient');}
 });
}
const open=async page=>{
 const resp=await page.goto(host+'/collection/',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(resp?.status(),200);
 await page.locator('[data-category="Furniture"]').waitFor({timeout:45000});
 await page.locator('[data-category="Furniture"]').click();
 await page.locator('[data-stage1-category-browse] .item-card').first().click();
 await page.locator('[data-stage1-item-info]').waitFor();
 await page.locator('[data-collection-first-moodboard-title]').waitFor();
};
try{
 await one.goto(host+'/collection/',{waitUntil:'domcontentloaded'});
 await one.evaluate(([k,v])=>localStorage.setItem(k,v),[MOODBOARD_STORAGE_KEY,empty]);
 await Promise.all([open(one),open(two)]);
 await one.locator('[data-collection-first-moodboard-title]').fill('Tab A');
 await two.locator('[data-collection-first-moodboard-title]').fill('Tab B');
 assert.ok(await one.evaluate(()=>typeof navigator.locks?.request==='function'));
 assert.ok(await two.evaluate(()=>typeof navigator.locks?.request==='function'));
 const buttons=[one,two].map(page=>page.locator('[data-collection-first-moodboard-create]'));
 await Promise.all(buttons.map(b=>b.click()));
 await one.waitForTimeout(800);
 const stored=await one.evaluate(k=>localStorage.getItem(k),MOODBOARD_STORAGE_KEY);
 const parsed=parseMoodboardDocument(stored);
 assert.equal(parsed.boards.length,1,'two cooperating browser tabs must never create two independent overwritten boards');
 const backups=await one.evaluate(k=>localStorage.getItem(k),MOODBOARD_BACKUP_KEY);
 assert.equal(backups,empty,'one exact original Backup');
 const state=await Promise.all([one,two].map(async page=>({
  hasForm:await page.locator('[data-collection-first-moodboard]').count(),
  status:await page.locator('[data-collection-moodboard-status]').allInnerTexts()
 })));
 console.log('QRW772_REAL_CHROME_TWO_TAB_SHARED_ORIGIN_EXCLUSIVE_LOCK_POSITIVE '+JSON.stringify({
  boardTitle:parsed.boards[0].title,state,referenceCount:parsed.boards[0].references.length
 }));
 assert.deepEqual(unsafe,[],'no off-origin request/POST');
 assert.deepEqual(errors,[],'no JS exceptions');
}finally{await browser.close();}

// One unresolved legacy/non-cooperating window: another tab writes to the
// same key immediately AFTER this writer's last precommit read, during setItem.
// Web Locks cannot exclude legacy writers. New code acknowledges this limitation.
// The independent safety acceptance requires no lost unrelated Board and no
// false SUCCESS; this deterministic interleave isolates that exact case.
const legacyAfterCheck=mk(empty,({kind,key,m})=>{
 if(kind==='setBefore'&&key===MOODBOARD_STORAGE_KEY)
  m.set(MOODBOARD_STORAGE_KEY,other);
});
const result=await first(legacyAfterCheck);
const retained=legacyAfterCheck.raw(MOODBOARD_STORAGE_KEY);
if(retained!==other){
 console.error('QRW772_TRUE_RED_NONCOOPERATING_LEGACY_COMMIT_BYPASSED_WEBLOCK '+JSON.stringify({
  expectedLegacyBoard:'board_other-tab',
  actualBoard:parseMoodboardDocument(retained).boards[0]?.id,
  resultAcknowledged:!!result?.document,
  originalBackup:legacyAfterCheck.raw(MOODBOARD_BACKUP_KEY)===empty
 }));
 throw new Error('TRUE_RED_SCOPED: legacy non-cooperating tab commit interleaved after precommit check was overwritten and new first-board action acknowledged SUCCESS; cooperative Web Locks cannot guarantee rollout coexistence.');
}
console.log('QRW772_LEGACY_NONCOOPERATING_AFTER_CHECK_PRESERVE_PASS');
