// 04 QR-W: NEW actual PUBLIC HTTPS hosted first Save-free NONEMPTY Scene operation.
// After Integration #883 protected main ed40e; distinct from accepted source QA880
// and prior hosted MyPresets (already existing-Scene) QA878. NEVER reQA those.
// Real SHA-validated deployed Switch1250 Catalog -> first Scene explicit user UI
// -> IndexedDB CAS/Backup/Reopen -> MyPresets -> World Editor detached read-only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {saveFreeSceneCopy,SAVEFREE_SCENE_LOCALES} from
 '../src/lib/wep/savefree-first-scene.ts';

const MAIN='ed40e346d381f485ee6dd419f72c5ca09b71d9c0';
const HOST='https://dreamwishwand.github.io';
const ROOT=HOST+'/web/';
const route=path=>HOST+'/web'+path;
const DB='dreamwishwand:wep:scene-presets:local:v1';
const HINT='dreamwishwand:wep:scene-preset:selected-route:v1';
const MOOD='dreamwishwand:moodboards:v1';
const MOOD_B='dreamwishwand:moodboards:v1:backup';
const MOOD_RAW='{"qrw884":"old-moodboard-local"}';
const MOOD_B_RAW='{"qrw884":"old-moodboard-backup-local"}';
assert.equal(process.env.QRW884_MAIN,MAIN);
assert.equal(process.env.QRW884_URL,ROOT);
assert.ok(process.env.CHROME_BIN,'actual installed Chrome mandatory');
assert.ok(process.env.GITHUB_TOKEN,'deployment verification token mandatory');
assert.ok(!process.env.P1G_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN,'QA parent must be exact main');
assert.deepEqual(git('diff','--name-status',MAIN,'HEAD').split('\n').filter(Boolean).sort(),[
 'A\t.github/workflows/04qr-w-mained40-hosted-savefree-firstscene-e2e-20261110.yml',
 'A\tscripts/04qr-w-mained40-hosted-savefree-firstscene-e2e-20261110.mjs'
 ]);
assert.equal(git('rev-parse',MAIN+':src/lib/wep/SaveFreeFirstScene.svelte'),
 'b5a3610a1e9950bd5dd5be30960ef8820ff0f66b');
assert.equal(git('rev-parse',MAIN+':src/lib/wep/savefree-first-scene.ts'),
 'd81f39dd9cfc50bf4360b058f8f605d9056c3845');
console.log('QRW883_ACTUAL_HOSTED_FIXED_MAIN_ED40_ONLY2_QA_ADD_ACCEPTED_SOURCE_REQA_NONE_PASS');

async function gh(path){
 const r=await fetch('https://api.github.com'+path,{
  headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,
   Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
  signal:AbortSignal.timeout(20000),redirect:'manual'});
 assert.equal(r.status,200,'GitHub Pages deployment check '+path);
 return r.json();
}
const pages=await gh('/repos/DreamwishWand/web/pages');
assert.equal(pages.html_url.replace(/\/?$/,'/'),ROOT);
const deps=await gh('/repos/DreamwishWand/web/deployments?environment=github-pages&per_page=25');
assert.ok(deps.length>0,'No Pages GitHub deployment');
assert.equal(deps[0].sha,MAIN,'current/latest published deployment must match exact protected main');
const statuses=await gh('/repos/DreamwishWand/web/deployments/'+deps[0].id+'/statuses?per_page=20');
assert.ok(statuses.some(s=>s.state==='success'),'latest actual GitHub Pages deployment never marked successful');
for(const r of ['/','/editor/world/','/presets/']){
 const res=await fetch(route(r),{redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(res.status,200,'real public HTTPS direct route '+r);
 assert.equal(res.headers.get('location'),null,'no fabricated redirect '+r);
 assert.match(res.headers.get('content-type')??'',/text\/html/);
 await res.body?.cancel();
}
console.log('QRW883_ACTUAL_PAGES_LATEST_DEPLOYED_ED40_SHA_SUCCESS_DIRECT_HTTPS_200_PASS',
 JSON.stringify({url:ROOT,deploymentId:deps[0].id,sha:MAIN}));

const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:900},
 serviceWorkers:'block',acceptDownloads:false,ignoreHTTPSErrors:false});
const unsafe=[],errors=[];
ctx.on('request',req=>{
 const u=new URL(req.url());
 if(u.origin!==HOST||!['GET','HEAD'].includes(req.method()))
  unsafe.push(req.method()+' '+req.url());
});
async function navigate(p,path,waitUntil='networkidle'){
 const r=await p.goto(route(path),{waitUntil,timeout:60000});
 assert.equal(r.status(),200,'actual deployed URL '+path);
}
const dbNames=p=>p.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name).sort());
const originalMood=p=>p.evaluate(([k,b])=>[localStorage.getItem(k),localStorage.getItem(b)],[MOOD,MOOD_B]);
const oneShot=p=>p.evaluate(k=>sessionStorage.getItem(k),HINT);
async function rawScene(p){
 return p.evaluate(async name=>{
  const rq=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   rq.onupgradeneeded=()=>{rq.transaction?.abort();reject(Error('DO_NOT_CREATE_DB_DURING_AUDIT_READ'));};
   rq.onerror=()=>reject(rq.error);rq.onsuccess=()=>resolve(rq.result);
  });
  try{
   const tx=db.transaction('snapshots','readonly');
   const req=tx.objectStore('snapshots').get('library');
   return await new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve(req.result);
    tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },DB);
}
async function enter(p,selector){
 const el=p.locator(selector);
 await el.waitFor({timeout:30000});
 await el.focus();
 assert.equal(await el.evaluate(x=>document.activeElement===x),true,'focus on '+selector);
 await p.keyboard.press('Enter');
}
try{
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));
 await navigate(p,'/editor/world/');
 const panel=p.locator('[data-wep-savefree-first-scene]');
 await panel.waitFor({timeout:30000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:20000});
 assert.equal((await dbNames(p)).includes(DB),false,'passive deployed World Editor created Scene DB');
 assert.equal(await p.locator('[data-editor-object-id]').count(),0,'game Save/EditorSession cannot be created');
 for(const [a,b] of [['data-save-writer','off'],['data-native-apply','off'],
 ['data-cloud','off'],['data-editor-session','untouched']])
  assert.equal(await panel.getAttribute(a),b);
 await p.evaluate(([k,b,v,w])=>{localStorage.setItem(k,v);localStorage.setItem(b,w);},
  [MOOD,MOOD_B,MOOD_RAW,MOOD_B_RAW]);
 assert.equal(await oneShot(p),null);
 await enter(p,'[data-wep-savefree-load]');
 await p.locator('[data-wep-savefree-search]').waitFor({timeout:60000});
 assert.equal((await dbNames(p)).includes(DB),false,'Catalog fetch alone opened/created IDB');
 // Verify true deployed 1.25.0 Catalog row and source-checked World footprint,
 // without re-running earlier source-bound Node tests or QA878 old flow.
 await p.locator('[data-wep-savefree-search]').fill('40000047');
 await enter(p,'[data-wep-savefree-choose="40000047"]');
 const selection=p.locator('[data-wep-savefree-selection]');
 await selection.waitFor({timeout:20000});
 const selectedText=await selection.innerText();
 assert.match(selectedText,/#40000047/);
 assert.match(selectedText,/3 × 2/);
 assert.match(selectedText,/VERIFIED_SWITCH1250_CATALOG_GEOMETRY_SCOPE/);
 assert.equal(await p.locator('[data-wep-savefree-save]:not([disabled])').count(),0);
 assert.equal((await dbNames(p)).includes(DB),false,'selection created IDB');
 console.log('QRW883_HOSTED_REAL_SWITCH1250_VERIFIED_CATALOG_ITEM40000047_3X2_NO_SAVE_DB_PASS');

 // New public creation UI: explicit user title + preview are local memory-only;
 // CSS and locale are tested on deployed page before saving.
 const title='First verified Scene created on real public Pages without DDV Save';
 await p.locator('[data-wep-savefree-title]').fill(title);
 await enter(p,'[data-wep-savefree-preview]');
 const preview=p.locator('[data-wep-savefree-artifact]');
 await preview.waitFor({timeout:18000});
 assert.match(await preview.innerText(),/1 objects/);
 assert.match(await preview.innerText(),/3 × 2/);
 assert.match(await preview.innerText(),/writeReady=false \/ applyReady=false/);
 assert.equal((await dbNames(p)).includes(DB),false,'preview generated unauthorized Scene IDB');
 assert.equal(await oneShot(p),null);
 assert.deepEqual(await originalMood(p),[MOOD_RAW,MOOD_B_RAW]);

 assert.equal(SAVEFREE_SCENE_LOCALES.length,8);
 for(const lang of SAVEFREE_SCENE_LOCALES){
  await p.locator('#site-locale').selectOption(lang,{force:true});
  await p.waitForFunction(expected=>
   document.querySelector('[data-wep-savefree-first-scene] h2')?.textContent?.trim()===expected,
   saveFreeSceneCopy(lang).title,{timeout:22000});
  assert.ok((await panel.innerText()).includes(saveFreeSceneCopy(lang).off));
 }
 await p.locator('#site-locale').selectOption('en',{force:true});
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:880});
  await p.evaluate(v=>document.documentElement.style.zoom=v,zoom);
  const b=await panel.evaluate(x=>({client:x.clientWidth,scroll:x.scrollWidth}));
  assert.ok(b.scroll<=b.client+2,'Savefree published UI overflow '+JSON.stringify({width,zoom,b}));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 assert.equal((await dbNames(p)).includes(DB),false);
 console.log('QRW883_HOSTED_8_LOCALES_320_CSS200_KEYBOARD_PREVIEW_IN_MEMORY_OFF_PASS');

 await enter(p,'[data-wep-savefree-save]');
 const saved=p.locator('[data-wep-savefree-saved]');
 await saved.waitFor({timeout:30000});
 assert.equal(await saved.getAttribute('data-apply'),'off');
 assert.equal(await saved.getAttribute('data-native-writer'),'off');
 const receipt=await rawScene(p);
 assert.equal(receipt.revision,1);
 assert.equal(receipt.backupRevision,0);
 assert.equal(JSON.parse(receipt.backup).entries.length,0);
 const entries=JSON.parse(receipt.primary).entries;
 assert.equal(entries.length,1,'first saved nonempty Scene exactly one');
 assert.equal(entries[0].title,title);
 const artifact=entries[0].artifact;
 assert.equal(artifact.objects.length,1);
 assert.equal(artifact.objects[0].itemId,40000047);
 assert.equal(artifact.objects[0].footprint.length,6);
 assert.deepEqual(artifact.bounds,{w:3,h:2});
 assert.equal(artifact.source.platform,'synthetic');
 assert.equal(artifact.networks.roads,null);
 assert.equal(artifact.networks.fences,null);
 assert.equal(artifact.objects[0].portableState,null);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 assert.equal(await oneShot(p),null);
 assert.deepEqual(await originalMood(p),[MOOD_RAW,MOOD_B_RAW]);
 const sceneNames=await dbNames(p);
 console.log('QRW883_HOSTED_USER_EXPLICIT_FIRST_NONEMPTY_SCENE_CAS1_BACKUP0_REOPEN_PASS',
 JSON.stringify({sceneId:entries[0].id,itemId:40000047,revision:1,backupRevision:0}));

 // Follow actual NEW UI's 'View in My Presets' link to old accepted consumer.
 await saved.locator('a').click();
 await p.waitForURL(/\/web\/presets\/?$/,{timeout:30000});
 await p.locator('[data-stage1-presets-four-cards]').waitFor({timeout:24000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:20000});
 await p.locator('[data-preset-child="my"]').click();
 const local=p.locator('[data-my-local-scenes]');
 await local.waitFor({timeout:24000});
 assert.equal(await local.getAttribute('data-account-created'),'unverified');
 assert.equal(await local.getAttribute('data-account-saved'),'unverified');
 assert.equal(await local.getAttribute('data-auto-cloud'),'off');
 assert.equal(await local.getAttribute('data-local-scene-writer'),'off');
 await enter(p,'[data-device-scenes-reopen]');
 await p.locator('[data-device-scene-select]').first().waitFor({timeout:24000});
 await enter(p,'[data-device-scene-select]');
 await p.locator('[data-device-scene-world-editor-selected]').waitFor({timeout:24000});
 assert.equal(await oneShot(p),null,'selection alone cannot transmit Scene');
 assert.deepEqual(await rawScene(p),receipt);
 await enter(p,'[data-device-scene-world-editor-selected]');
 await p.waitForURL(route('/editor/world/'),{timeout:35000});
 const hintStr=await oneShot(p);
 assert.ok(hintStr&&hintStr.length<256,'bounded one-shot hint');
 const hint=JSON.parse(hintStr);
 assert.deepEqual(Object.keys(hint),['schema','sceneId','expectedRevision','issuedAt']);
 assert.equal(hint.schema,'wand.wep.local-scene-route-intent@1');
 assert.equal(hint.sceneId,entries[0].id);
 assert.equal(hint.expectedRevision,1);
 assert.ok(Number.isSafeInteger(hint.issuedAt)&&Date.now()>=hint.issuedAt&&
  Date.now()-hint.issuedAt<=180000,'hint TTL must be 3min');
 assert.equal(new URL(p.url()).search,'','no artifact in URL query');
 assert.equal(new URL(p.url()).hash,'','no artifact in URL hash');
 const receiver=p.locator('[data-wep-selected-scene-route-confirm]');
 await receiver.waitFor({timeout:25000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0,
  'receiver passive navigation cannot create Detached Draft');
 assert.deepEqual(await rawScene(p),receipt,'navigation/hint must not mutate stored Scene');
 await enter(p,'[data-wep-selected-scene-route-confirm]');
 const draft=p.locator('[data-wep-selected-scene-route-draft]');
 await draft.waitFor({timeout:22000});
 assert.equal(await draft.getAttribute('data-apply'),'off');
 assert.equal(await draft.getAttribute('data-editor-mutation'),'off');
 const text=await draft.innerText();
 assert.match(text,/40000047/);
 assert.match(text,/3 × 2/);
 assert.match(text,/writeReady=false \/ applyReady=false/);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 assert.equal(await oneShot(p),null,'one shot consumed');
 assert.deepEqual(await rawScene(p),receipt,'reopen/readonly Draft cannot change Scene Primary/Backup');
 assert.deepEqual(await dbNames(p),sceneNames,'no second DB');
 assert.deepEqual(await originalMood(p),[MOOD_RAW,MOOD_B_RAW]);
 await p.reload({waitUntil:'domcontentloaded'});
 assert.equal(await p.locator('[data-wep-selected-scene-route]').count(),0,'hint cannot replay on reload');
 assert.deepEqual(await rawScene(p),receipt);
 assert.deepEqual(unsafe,[],'no external/cloud/provider POST or unauthorized GET');
 assert.deepEqual(errors,[],'no unhandled real public Chrome error');
 console.log('QRW883_HOSTED_FIRST_SAVEFREE_SCENE_MYPRESETS_SEND_SECOND_CONFIRM_READONLY_DRAFT_PASS');
 console.log('QRW883_INDEPENDENT_REAL_PUBLIC_HOSTED_SAVEFREE_FIRST_NONEMPTY_SCENE_SCOPED_PASS',
  JSON.stringify({main:MAIN, deploymentId:deps[0].id,url:ROOT,
   ItemID:40000047,footprint:'3x2',revision:1,backupRevision:0,
   staticCatalogSwitch:'1.25.0',syntheticOnly:true,writer:false,apply:false,
   nativeV3:false,cloud:false,communityPublic:false,qaOnly:true}));
}finally{await ctx.close();await browser.close();}
