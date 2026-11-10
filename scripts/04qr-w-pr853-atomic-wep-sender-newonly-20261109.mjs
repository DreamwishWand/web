// 04 QR-W PR853 independent sender-only QA. Fixed Source5; accepted WEP receiver not re-QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';
import {worldEditorStage1Copy} from '../src/lib/wep/world-editor-stage1-copy.js';
import {COLLECTION_FIRST_MOODBOARD_GATE} from '../src/lib/collection/moodboard-inspire.mjs';
const SRC='6a6329acd2052afb8bfc63eda1cccf95706972f2';
const BASE='c7362864d2ea8dd3ed9c546505f43c0a8ce6a948';
const fixed=new Map([
 ['.github/workflows/web-atomic-wep-sender.yml','7550294969c094bd42c437664d858142d4c9692d'],
 ['scripts/web-atomic-wep-sender-chrome.mjs','12b4114b03b011a3ca063e270cca5b3b8624cbec'],
 ['src/routes/moodboards/atomic/+page.svelte','2e1de6b8a6c58db41a540fd522511ea912b013ca'],
 ['tests/web-atomic-wep-sender.test.mjs','d6db527d357eb06f72e6d145faaa52d860ca89c8'],
 ['tests/web-collection-atomic-item-handoff.test.mjs','0f91414f395debba60ddb0638c3eb1cf976d6152']
]);
const audits=[
 '.github/workflows/04qr-w-pr853-atomic-wep-sender-newonly-20261109.yml',
 'scripts/04qr-w-pr853-atomic-wep-sender-newonly-20261109.mjs'
];
const git=(...x)=>execFileSync('git',x,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',BASE,SRC),BASE,'Source parent must be protected main');
assert.deepEqual(diff(BASE,SRC),[...fixed.keys()].sort());
assert.equal(git('merge-base',SRC,'HEAD'),SRC);
assert.deepEqual(diff(SRC,'HEAD'),audits.sort());
for(const [p,sha] of fixed) {
 assert.equal(git('rev-parse',SRC+':'+p),sha,p);
 assert.equal(git('hash-object',p),sha,p+' immutable original Source');
}
const atom=readFileSync('src/routes/moodboards/atomic/+page.svelte','utf8');
assert.match(atom,/verifyAtomicBoardReference\(current/);
assert.match(atom,/current\.revision!==observed\.revision/);
assert.match(atom,/current\.boardId!==observed\.boardId/);
assert.match(atom,/writeWorldEditorHandoff\(localStorage,hint\)/);
assert.doesNotMatch(atom,/(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)/);
assert.doesNotMatch(atom,/autoPlace|guessFootprint|saveToCloud|productApplyAuthorized:true/);
assert.equal(COLLECTION_FIRST_MOODBOARD_GATE,'OFF_LEGACY_WRITER_NO_ATOMIC_CAS');
assert.equal(git('diff','--name-only',BASE,SRC,'--','src/lib/wep','src/lib/moodboards','src/lib/collection','src/routes/editor','src/routes/collection','supabase','crates','static','.github/workflows/pages.yml'),'');
console.log('QRW853_SOURCE5_FIXED_BLOBS_QA2_NO_ACCEPTED_WEP_OR_IDB_CORE_MUTATION_PASS');

const origin=process.env.QRW853_ORIGIN||'';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)||!process.env.CHROME_BIN)throw Error('QA_LOCAL_CHROME_ONLY');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const errors=[],requests=[];
ctx.on('request',r=>{if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))requests.push(r.method()+' '+r.url());});
const tab=async(path)=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));
 const res=await p.goto(origin+path,{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200,path);return p;};
const storageKey='dreamwishwand:world-editor:handoff:v1';
const primaryKey='dreamwishwand:moodboards:v1';
const backupKey='dreamwishwand:moodboards:v1:backup';
const atomic='/moodboards/atomic/',editor='/editor/world/';
const idb=async p=>p.evaluate(async()=>{
 const m=await import('/src/lib/moodboards/atomic-first-board.mjs');
 const d=await m.openAtomicFirstBoardDatabase();
 try{return await m.verifiedAtomicFirstBoardReopen(d);}finally{d.close();}
});
const keys=async p=>p.evaluate(([a,b,c])=>({
 primary:localStorage.getItem(a),backup:localStorage.getItem(b),
 hint:localStorage.getItem(c)}),[primaryKey,backupKey,storageKey]);
try{
 const p=await tab(atomic);
 await p.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 await p.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 assert.equal(await p.locator('[data-atomic-wep-send]').count(),0);
 assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 await p.evaluate(([a,b])=>{
  localStorage.setItem(a,JSON.stringify({legacy:'fake authority',boardId:'board_atomic_FAKE999999999',revision:999,
   references:[{type:'ITEM',entityId:'999999',id:'fake-ref'}]}));
  localStorage.setItem(b,'{"prior":"untouched"}');
 },[primaryKey,backupKey]);
 const legacy=await keys(p);
 assert.equal(legacy.hint,null);
 await p.locator('[data-atomic-title]').fill('QA source current read-only sender');
 await p.locator('[data-atomic-create]').click();
 await p.locator('[data-atomic-outcome="CREATED"]').waitFor({timeout:15000});
 assert.equal(await p.locator('[data-atomic-wep-send]').count(),0);
 assert.equal((await keys(p)).hint,null);
 await p.locator('[data-atomic-item-id]').fill('40000047');
 await p.locator('[data-atomic-save-item]').click();
 await p.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:15000});
 const saved=await idb(p);
 assert.equal(saved.revision,2);
 assert.equal(saved.document.boards.length,1);
 const ref=saved.document.boards[0].references.find(r=>r.entityId==='40000047');
 assert.ok(ref?.id&&ref.type==='ITEM'&&ref.groupIds.length===0);
 const send=p.locator('[data-atomic-wep-send]');
 await send.waitFor({timeout:20000});
 assert.equal(await send.getAttribute('data-reference-id'),ref.id);
 assert.equal(await send.isEnabled(),true);
 assert.equal((await keys(p)).hint,null,'no write without direct user click');
 assert.equal((await keys(p)).primary,legacy.primary);
 assert.equal((await keys(p)).backup,legacy.backup);
 const stale=await tab(atomic);
 await stale.locator('[data-atomic-wep-send]:not(:disabled)').waitFor({timeout:30000});
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await p.selectOption('#site-locale',loc);
  await p.waitForFunction(text=>
   document.querySelector('[data-atomic-wep-send]')?.textContent?.trim().startsWith(text),
   moodboardCopy(loc).openWorldEditor);
  assert.equal((await p.locator('[data-atomic-wep-separation]').innerText()).trim(),moodboardCopy(loc).atomicNote);
  assert.equal((await p.locator('[data-atomic-wep-readonly]').innerText()).trim(),worldEditorStage1Copy(loc).atomicReadonly);
 }
 await p.setViewportSize({width:320,height:850});
 const mobile=await p.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 assert.ok(mobile[0]<=mobile[1]+2,'320px overflow '+JSON.stringify(mobile));
 await p.setViewportSize({width:640,height:880});
 await p.evaluate(()=>{document.documentElement.style.zoom='2';});
 const zoom=await p.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 assert.ok(zoom[0]<=zoom[1]+2,'200% overflow '+JSON.stringify(zoom));
 await p.evaluate(()=>{document.documentElement.style.zoom='1';});
 await p.setViewportSize({width:1280,height:900});
 console.log('QRW853_8_LOCALES_320_200_CATALOG_VERIFIED_REFERENCE_NO_AUTO_HINT_PASS');

 // SHA corruption prevents catalog provenance being elevated by an existing IDB ref.
 const corrupt=await ctx.newPage();corrupt.on('pageerror',e=>errors.push(String(e)));
 let touched=0;
 await corrupt.route('**/ddv/collection/v1.25/records-00.json',async route=>{
  touched++;
  const res=await route.fetch();
  await route.fulfill({response:res,body:(await res.text())+' '});
 });
 const res=await corrupt.goto(origin+atomic,{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);
 await corrupt.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 await corrupt.locator('[data-atomic-catalog="unavailable"]').waitFor({timeout:30000});
 assert.ok(touched>0,'must corrupt a fetched manifest shard');
 const btn=corrupt.locator('[data-atomic-wep-send]');
 if(await btn.count())assert.equal(await btn.isDisabled(),true);
 assert.equal((await keys(corrupt)).hint,null);
 await corrupt.close();
 console.log('QRW853_CATALOG_SHA_CORRUPT_EXISTING_IDB_REF_NO_WEP_HINT_PASS');

 // Only explicit keyboard gesture writes typed hint. The receiver contract was
 // already independently QA'd in #850; observe consumer pending only.
 await send.focus();assert.equal(await send.evaluate(e=>e===document.activeElement),true);
 await p.keyboard.press('Enter');
 await p.waitForURL(origin+editor,{timeout:30000});
 await p.locator('[data-wep-pre-source-stage1] #pending-item-title').waitFor({timeout:30000});
 assert.match(await p.locator('[data-wep-pre-source-stage1] #pending-item-title').innerText(),/40000047/);
 assert.equal(await p.locator('[data-wep-stage1-change]').count(),0);
 const out=await keys(p),hint=JSON.parse(out.hint);
 assert.equal(hint.sourceSurface,'atomic-moodboard');
 assert.equal(hint.intent,'ATOMIC_MOODBOARD');
 assert.equal(hint.boardId,saved.boardId);
 assert.equal(hint.revision,saved.revision);
 assert.equal(hint.referenceId,ref.id);
 assert.equal(hint.persistentWriteAuthorized,false);
 assert.equal(hint.productApplyAuthorized,false);
 assert.equal(hint.directSourceReplacementAuthorized,false);
 assert.equal(out.primary,legacy.primary);assert.equal(out.backup,legacy.backup);
 const received=await idb(p);
 assert.equal(received.primary,saved.primary);
 assert.equal(received.backup,saved.backup);
 const reopened=await tab(editor);
 await reopened.locator('[data-wep-pre-source-stage1] #pending-item-title').waitFor({timeout:30000});
 assert.equal(await reopened.locator('[data-wep-stage1-change]').count(),0);
 assert.equal((await idb(reopened)).primary,saved.primary);
 console.log('QRW853_KEYBOARD_EXPLICIT_CLICK_WRITES_WEP_ONLY_ID_REV_REF_READONLY_PENDING_REOPEN_PASS');

 // Change IDB in competing tab; a pre-opened sender must decline old Revision
 // and must not overwrite valid prior WEP hint or either store.
 const updater=await tab(atomic);
 await updater.locator('[data-atomic-item-id]').fill('40000047');
 await updater.locator('[data-atomic-save-item]').click();
 await updater.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:15000});
 const changed=await idb(updater);
 assert.equal(changed.revision,saved.revision+1);
 assert.equal(changed.document.boards[0].references.length,0);
 const prior=await keys(stale);
 await stale.locator('[data-atomic-wep-send]').click();
 await stale.locator('[data-atomic-wep-status]').waitFor({timeout:20000});
 assert.equal(new URL(stale.url()).pathname,atomic);
 assert.equal((await keys(stale)).hint,prior.hint,'stale sender cannot rewrite hint');
 assert.equal((await keys(stale)).primary,legacy.primary);
 assert.equal((await keys(stale)).backup,legacy.backup);
 assert.equal((await idb(stale)).primary,changed.primary);
 await updater.locator('[data-atomic-delete]').click();
 await updater.locator('[data-atomic-tombstone]').waitFor();
 const deleted=await idb(updater);assert.equal(deleted.deleted,true);
 const fresh=await tab(atomic);
 await fresh.locator('[data-atomic-tombstone]').waitFor({timeout:30000});
 assert.equal(await fresh.locator('[data-atomic-wep-send]').count(),0);
 assert.equal((await keys(fresh)).hint,prior.hint);
 assert.equal((await keys(fresh)).primary,legacy.primary);
 assert.equal((await keys(fresh)).backup,legacy.backup);
 assert.deepEqual(requests,[],'no outside-domain or POST');
 assert.deepEqual(errors,[],'no uncaught real Chrome exceptions');
 console.log('QRW853_STALE_REF_REVISION_AND_DELETED_BOARD_DENY_HINT_WRITE_NO_POST_NO_LEGACY_MUTATION_PASS');
 console.log('QRW853_INDEPENDENT_CHANGED_SOURCE5_CHROME_SCOPED_PASS');
}finally{await ctx.close();await browser.close();}
