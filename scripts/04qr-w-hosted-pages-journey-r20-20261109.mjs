// Independent 04 QR-W HOSTED Pages R10/R13/R19/R20. HTTPS deployed-site only.
// No private Save, writer, provider, production mutations, feature or accepted QA reruns.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';
import {createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument} from '../src/lib/moodboards/store.js';
const SHA='340461f4a2960f8033fc13be9d5eaef8554d252d';
const SITE='https://dreamwishwand.github.io';
const BASE='/web';
const ROOT=SITE+BASE+'/';
const PATHS={root:'/',collection:'/collection/',atomic:'/moodboards/atomic/',editor:'/editor/world/',missing:'/__qrw-r20-not-a-real-route-20261109-340461/'};
const URL=(p)=>SITE+BASE+p;
assert.equal(process.env.QRW_HOSTED_EXPECTED_MAIN,SHA);
assert.equal(process.env.QRW_HOSTED_DEPLOYMENT_URL,ROOT);
assert.ok(process.env.CHROME_BIN,'ACTUAL_INSTALLED_CHROME_NOT_RUN');
for(const key of ['DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_P1G_PATH','P1G_PATH'])
 assert.ok(!process.env[key],'PRIVATE_SAVE_FORBIDDEN');
const os=process.env.CI_GITHUB_TOKEN;
if(os){
 for(const endpoint of ['/repos/DreamwishWand/web/pages','/repos/DreamwishWand/web/deployments?environment=github-pages&per_page=8']){
  const resp=await fetch('https://api.github.com'+endpoint,{
   headers:{Authorization:'Bearer '+os,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
   redirect:'manual'});
  const body=resp.status===200?await resp.json():null;
  if(endpoint.endsWith('/pages')&&body?.html_url){
   assert.equal(body.html_url.endsWith('/')?body.html_url:body.html_url+'/',ROOT,
    'GitHub Pages API URL must match authentic Deploy Pages run log');
   console.log('QRW_R20_GITHUB_PAGES_API_URL_MATCH',resp.status,body.html_url,body.status??'unknown');
  }else if(endpoint.includes('/deployments')&&Array.isArray(body)){
   const relevant=body.filter(d=>d.sha===SHA);
   console.log('QRW_R20_GITHUB_DEPLOYMENTS_READ',resp.status,'matches',relevant.length,'ids',relevant.map(d=>d.id).slice(0,4).join(','));
  }else{
   console.log('QRW_R20_GITHUB_ADDITIONAL_API_UNAVAILABLE',endpoint,resp.status);
  }
 }
}
// Record exact real HTTP responses. No invented redirects or canonical host.
const trace=[];
for(const [kind,path] of Object.entries(PATHS)){
 const response=await fetch(URL(path),{redirect:'manual',headers:{'User-Agent':'QR-W/hosted-pages-acceptance-20261109'}});
 const location=response.headers.get('location');
 const type=response.headers.get('content-type');
 trace.push({kind,status:response.status,location,type,url:URL(path)});
 if(kind!=='missing')assert.equal(response.status,200,'Hosted direct route HTTP200 '+kind+' '+JSON.stringify(trace.at(-1)));
 if(kind==='missing'){
  assert.equal(response.status,404,'Missing static route must NOT be called proper HTTP404 on fallback '+JSON.stringify(trace.at(-1)));
 }
}
console.log('QRW_R20_REAL_HTTPS_DIRECT_HTTP_STATUS_AND_NEGATIVE_404',JSON.stringify(trace));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block',acceptDownloads:true,ignoreHTTPSErrors:false});
const errors=[],otherRequests=[];
ctx.on('request',r=>{
 const method=r.method(),url=r.url();
 if(!['GET','HEAD'].includes(method)||new URL(url).origin!==SITE)otherRequests.push({method,url});
});
const tab=async(path)=>{
 const p=await ctx.newPage();
 p.on('pageerror',e=>errors.push(String(e)));
 const response=await p.goto(URL(path),{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response?.status(),200,'Browser actual HTTPS direct '+path);
 return p;
};
const legacyPrimary='dreamwishwand:moodboards:v1',legacyBackup='dreamwishwand:moodboards:v1:backup',wepKey='dreamwishwand:world-editor:handoff:v1';
const getLegacy=async p=>p.evaluate(([a,b])=>({
 primary:localStorage.getItem(a),backup:localStorage.getItem(b)}),[legacyPrimary,legacyBackup]);
const getHint=async p=>p.evaluate(k=>localStorage.getItem(k),wepKey);
// QA reads actual browser-local raw row only. Never a second PRODUCT Reader or Executor.
const readRow=async p=>p.evaluate(async()=>{
 const req=indexedDB.open('dreamwishwand:moodboards:atomic-first:v1',1);
 const db=await new Promise((resolve,reject)=>{
  req.onupgradeneeded=()=>{try{req.transaction.abort();}catch{}};
  req.onerror=()=>reject(req.error||Error('QA_DB_ABSENT'));
  req.onsuccess=()=>resolve(req.result);
 });
 try{
  const tx=db.transaction('snapshots','readonly'),read=tx.objectStore('snapshots').get('first');
  const row=await new Promise((resolve,reject)=>{
   tx.oncomplete=()=>resolve(read.result);
   tx.onerror=()=>reject(tx.error);
   tx.onabort=()=>reject(tx.error||Error('QA_READ_ABORT'));
  });
  if(!row)throw Error('QA_NO_ROW');
  return {boardId:row.boardId,revision:row.revision,primary:row.primary,backup:row.backup,deleted:row.deleted};
 }finally{db.close();}
});
const lang=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
async function assertNoHorizontal(p,name){
 const t=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 assert.ok(t.scroll<=t.client+2,name+' '+JSON.stringify(t));
}
const page=await tab(PATHS.collection);
try{
 const oldStart=createEmptyMoodboardDocument('2026-11-09T00:00:00.000Z');
 const oldNext=createMoodboard(oldStart,{title:'QR-W deployed host synthetic legacy old board'},
  {now:'2026-11-09T00:00:01.000Z',idFactory:()=> 'legacy-host-qa-r20'}).document;
 const legacy={
  primary:serializeMoodboardDocument(oldNext),
  backup:serializeMoodboardDocument(oldStart)
 };
 await page.evaluate(([a,b,d])=>{localStorage.setItem(a,d.primary);localStorage.setItem(b,d.backup);},
  [legacyPrimary,legacyBackup,legacy]);
 await page.reload({waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('[data-stage1-search]').fill('40000047',{timeout:35000});
 await page.locator('[data-stage1-item-id="40000047"]').first().click();
 const link=page.locator('[data-collection-atomic-item-handoff]');
 await link.waitFor({timeout:35000});
 assert.equal(await link.getAttribute('href'),BASE+PATHS.atomic+'?item=40000047');
 for(const loc of lang){
  await page.selectOption('#site-locale',loc);
  await page.waitForFunction(t=>document.querySelector('[data-collection-atomic-item-handoff]')?.textContent?.trim()===t,
    moodboardCopy(loc).atomicLink);
  assert.equal((await page.locator('[data-collection-atomic-separation]').innerText()).trim(),moodboardCopy(loc).atomicNote);
 }
 await page.setViewportSize({width:320,height:860});
 await assertNoHorizontal(page,'host Collection 320px');
 await page.setViewportSize({width:640,height:880});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await assertNoHorizontal(page,'host Collection 200pct');
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:860});
 assert.deepEqual(await getLegacy(page),legacy);
 console.log('QRW_R20_PAGES_COLLECTION_VERIFIED_ITEM_8LOCALE_320_ZOOM200_PASS');
 await link.focus();
 assert.equal(await link.evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Enter');
 await page.waitForURL(URL(PATHS.atomic+'?item=40000047'),{timeout:45000});
 await page.locator('[data-atomic-ready="true"]').waitFor({timeout:45000});
 await page.locator('[data-atomic-catalog="ready"]').waitFor({timeout:45000});
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-atomic-handoff-verified]').getAttribute('data-atomic-handoff-verified'),'true');
 assert.equal(await page.locator('[data-atomic-handoff-add]').count(),0);
 for(const loc of lang){
  await page.selectOption('#site-locale',loc);
  await page.waitForFunction(t=>document.querySelector('[data-atomic-wep-separation]')?.textContent?.trim()===t||
   document.querySelector('[data-atomic-handoff-separation]')?.textContent?.trim()===t,
   moodboardCopy(loc).atomicNote);
 }
 await page.setViewportSize({width:320,height:860});
 await assertNoHorizontal(page,'host Atomic 320px');
 await page.setViewportSize({width:640,height:880});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await assertNoHorizontal(page,'host Atomic 200pct');
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:860});
 assert.equal(await getHint(page),null);
 assert.deepEqual(await getLegacy(page),legacy);
 console.log('QRW_R20_PAGES_EXPLICIT_COLLECTION_TO_ATOMIC_NO_AUTOCREATE_8LOCALE_320_ZOOM200_PASS');
 await page.locator('[data-atomic-title]').fill('Deployed local Board QA R20');
 await page.locator('[data-atomic-create]').click();
 await page.locator('[data-atomic-outcome="CREATED"]').waitFor({timeout:25000});
 const created=await readRow(page);
 assert.equal(created.revision,1);
 assert.equal(JSON.parse(created.primary).boards[0].references.length,0);
 assert.equal(await page.locator('[data-atomic-wep-send]').count(),0);
 const staleCAS=await tab(PATHS.atomic+'?item=40000047');
 await staleCAS.locator('[data-atomic-handoff-add]').waitFor({timeout:45000});
 await page.locator('[data-atomic-handoff-add]').waitFor({timeout:35000});
 await page.locator('[data-atomic-handoff-add]').click();
 await page.locator('[data-atomic-outcome="HANDOFF_ADDED"]').waitFor({timeout:25000});
 const saved=await readRow(page);
 const doc=JSON.parse(saved.primary),prior=JSON.parse(saved.backup);
 assert.equal(saved.boardId,created.boardId);assert.equal(saved.revision,2);
 assert.equal(doc.boards.length,1);assert.equal(doc.boards[0].references.length,1);
 assert.equal(doc.boards[0].references[0].entityId,'40000047');
 assert.equal(prior.boards[0].references.length,0);
 await staleCAS.locator('[data-atomic-handoff-add]').click();
 await staleCAS.locator('[data-atomic-outcome="REJECTED"]').waitFor({timeout:20000});
 assert.equal((await readRow(staleCAS)).primary,saved.primary);
 assert.equal(await page.locator('[data-atomic-handoff-already]').count(),1);
 assert.equal(await getHint(page),null);
 console.log('QRW_R20_PAGES_ATOMIC_CAS_REV2_STALE_SECOND_TAB_DENIED_NO_DUPLICATE_PASS');
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:22000}),page.locator('[data-atomic-export]').click()]);
 assert.equal(download.suggestedFilename(),'dreamwish-wand-atomic-first-backup.json');
 const downloaded=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(downloaded.boards[0].references.length,0);
 assert.equal(downloaded.boards[0].id,created.boardId);
 const reopened=await tab(PATHS.atomic+'?item=40000047');
 await reopened.locator('[data-atomic-handoff-already]').waitFor({timeout:45000});
 await reopened.locator('[data-atomic-reopen]').click();
 await reopened.locator('[data-atomic-outcome="REOPENED"]').waitFor({timeout:20000});
 assert.deepEqual(await readRow(reopened),saved);
 assert.deepEqual(await getLegacy(reopened),legacy);
 console.log('QRW_R20_PAGES_REAL_BACKUP_DOWNLOAD_PRIOR_SNAPSHOT_NEW_TAB_REOPEN_PASS');
 const staleSender=await tab(PATHS.atomic);
 await staleSender.locator('[data-atomic-wep-send]:not(:disabled)').waitFor({timeout:45000});
 const send=page.locator('[data-atomic-wep-send]');
 await send.waitFor({timeout:25000});
 assert.equal(await send.getAttribute('data-reference-id'),doc.boards[0].references[0].id);
 await send.focus();assert.equal(await send.evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Enter');
 await page.waitForURL(URL(PATHS.editor),{timeout:45000});
 await page.locator('[data-wep-pre-source-stage1] #pending-item-title').waitFor({timeout:45000});
 assert.match(await page.locator('[data-wep-pre-source-stage1] #pending-item-title').innerText(),/40000047/);
 assert.equal(await page.locator('[data-wep-stage1-change]').count(),0);
 const hint=JSON.parse(await getHint(page));
 assert.equal(hint.sourceSurface,'atomic-moodboard');assert.equal(hint.intent,'ATOMIC_MOODBOARD');
 assert.equal(hint.boardId,saved.boardId);assert.equal(hint.revision,2);
 assert.equal(hint.referenceId,doc.boards[0].references[0].id);
 for(const flag of ['persistentWriteAuthorized','productApplyAuthorized','directSourceReplacementAuthorized'])
  assert.equal(hint[flag],false,flag);
 assert.deepEqual(await readRow(page),saved);
 assert.deepEqual(await getLegacy(page),legacy);
 const editorReopen=await tab(PATHS.editor);
 await editorReopen.locator('[data-wep-pre-source-stage1] #pending-item-title').waitFor({timeout:45000});
 assert.equal(await editorReopen.locator('[data-wep-stage1-change]').count(),0);
 const stage1=editorReopen.locator('[data-wep-pre-source-stage1] [data-wep-decorate-stage1]').first();
 await editorReopen.setViewportSize({width:320,height:860});
 const wep320=await stage1.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));
 assert.ok(wep320.scroll<=wep320.client+2,'World Editor pending panel 320 '+JSON.stringify(wep320));
 await editorReopen.setViewportSize({width:640,height:860});
 await editorReopen.evaluate(()=>{document.documentElement.style.zoom='2';});
 const wep200=await stage1.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));
 assert.ok(wep200.scroll<=wep200.client+2,'World Editor pending panel 200 '+JSON.stringify(wep200));
 await editorReopen.evaluate(()=>{document.documentElement.style.zoom='1';});
 assert.deepEqual(await getLegacy(editorReopen),legacy);
 assert.deepEqual(await readRow(editorReopen),saved);
 console.log('QRW_R20_PAGES_KEYBOARD_SENDER_WEP_READONLY_PENDING_THIRD_TAB_REOPEN_NO_WRITER_PASS');
 const updater=await tab(PATHS.atomic);
 await updater.locator('[data-atomic-item-id]').fill('40000047',{timeout:45000});
 await updater.locator('[data-atomic-save-item]').click();
 await updater.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:25000});
 const changed=await readRow(updater);
 assert.equal(changed.revision,3);
 assert.equal(JSON.parse(changed.primary).boards[0].references.length,0);
 const oldHint=await getHint(staleSender);
 await staleSender.locator('[data-atomic-wep-send]').click();
 await staleSender.locator('[data-atomic-wep-status]').waitFor({timeout:25000});
 assert.equal(new URL(staleSender.url()).pathname,BASE+PATHS.atomic);
 assert.equal(await getHint(staleSender),oldHint);
 assert.equal((await readRow(staleSender)).primary,changed.primary);
 assert.deepEqual(await getLegacy(staleSender),legacy);
 await updater.locator('[data-atomic-delete]').click();
 await updater.locator('[data-atomic-tombstone]').waitFor({timeout:25000});
 const deleted=await readRow(updater);assert.equal(deleted.deleted,true);
 const tombstone=await tab(PATHS.atomic);
 await tombstone.locator('[data-atomic-tombstone]').waitFor({timeout:45000});
 assert.equal(await tombstone.locator('[data-atomic-wep-send]').count(),0);
 assert.equal(await tombstone.locator('[data-atomic-create]').count(),0);
 assert.deepEqual(await getLegacy(tombstone),legacy);
 const bad=otherRequests.filter(x=>x.method!=='GET'&&x.method!=='HEAD');
 assert.deepEqual(bad,[],'unexpected Cloud/Post on public live host '+JSON.stringify(bad));
 assert.deepEqual(errors,[],'unexpected hosted browser pageerrors '+JSON.stringify(errors));
 const outside=otherRequests.filter(x=>!x.url.startsWith(SITE));
 console.log('QRW_R20_HOSTED_EXTERNAL_GET_OBSERVED',JSON.stringify(outside.slice(0,12)));
 console.log('QRW_R20_PAGES_STALE_SENDER_REV3_AND_TOMBSTONE_FAILCLOSED_LEGACY_BYTES_UNCHANGED_PASS');
 console.log('QRW_R20_HOSTED_REAL_CHROME_DISTRIBUTED_LOCAL_ONLY_JOURNEY_SCOPED_PASS',SHA,ROOT);
}finally{await ctx.close();await browser.close();}
