// Independent 04 QR-W: ONLY repair delta vs accepted old QA889 and deferred negatives.
// Real installed Chrome at root CSS zoom 200%. No accepted SourcePin/basic Tour/Scene QA repeat.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {PRESETS_MY_WAND_TOUR} from '../src/lib/tour/typed-tour-contract.mjs';
import {PRESETS_MY_TOUR_LOCALES,presetsMyTourCopy}
 from '../src/lib/tour/presets-my-tour-copy.mjs';
const MAIN='668708c11b248c640415c063cc00296ff1303870';
const RED_SOURCE='6f6bbe8604ea0827a0f595f67bfd822ea94296eb';
const OLD_RED_QA='c9a97ec0424d3ecbfaac891b0db6c95753ade664';
const SOURCE='026952d1e7ef0c4d2772da65c2c62bce8f776759';
const ORIGINAL=[
 'docs/wep/world-editor-localization-inventory-20261002.json',
 'scripts/web-presets-my-tour-chrome.mjs',
 'src/lib/SiteHeader.svelte',
 'src/lib/tour/SpotlightTour.svelte',
 'src/lib/tour/presets-my-tour-copy.mjs',
 'src/lib/tour/typed-tour-contract.mjs',
 'tests/web-presets-my-tour-contract.test.mjs'
];
const REPAIR=['scripts/web-presets-my-tour-chrome.mjs','src/lib/tour/SpotlightTour.svelte'];
const QA=[
 '.github/workflows/04qr-w-pr888-zoom200-deferred-newhead-20261110.yml',
 'scripts/04qr-w-pr888-zoom200-deferred-newhead-20261110.mjs'
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN,'current Source parent main fixed');
assert.equal(git('merge-base',RED_SOURCE,SOURCE),RED_SOURCE,'do not overwrite old Source RED');
assert.deepEqual(changed(MAIN,SOURCE),ORIGINAL.slice().sort(),'original 7 paths unchanged');
assert.deepEqual(changed(RED_SOURCE,SOURCE),REPAIR.slice().sort(),'source change exactly geometry and Chrome');
assert.deepEqual(changed(SOURCE,'HEAD'),QA.slice().sort(),'QA only two independent audit ADD');
assert.deepEqual(git('diff','--name-status',SOURCE,'HEAD').split('\n').filter(Boolean).sort(),
 QA.map(p=>'A\t'+p).sort());
assert.equal(git('rev-parse',SOURCE+':src/lib/tour/SpotlightTour.svelte'),
 '0880ed8c400c0a9adde687af45cd4ad51229c598');
assert.equal(git('rev-parse',SOURCE+':scripts/web-presets-my-tour-chrome.mjs'),
 'e2999d5cdd9da2313c374f60b4a946c3d27fd6e9');
assert.equal(git('hash-object','src/lib/tour/SpotlightTour.svelte'),
 '0880ed8c400c0a9adde687af45cd4ad51229c598');
assert.equal(git('rev-parse',RED_SOURCE+':src/lib/tour/SpotlightTour.svelte'),
 '51d33aa314e11ceb46e261745040435e71b43dc4');
assert.equal(git('merge-base',RED_SOURCE,OLD_RED_QA),RED_SOURCE,'historical red QA anchored old source');
assert.equal(process.env.QRW_OLD_RED_EXPECTED,'TRUE_RED_50PX_OVERFLOW','old red verdict must remain RED');
console.log('QRW888_FIXED_GEOMETRY_2_MOD_ONLY_OLD_QA889_TRUE_RED_RETAINED_QA_ONLY_2_ADD_PASS');

const origin=process.env.QRW888_ORIGIN;
assert.match(origin??'',/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'actual installed Google Chrome required');
assert.ok(!process.env.P1G_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},
 serviceWorkers:'block',ignoreHTTPSErrors:false,acceptDownloads:false});
const events=[],outside=[],errors=[],layoutErrors=[];
ctx.on('request',req=>{
 const u=new URL(req.url());
 if(u.origin!==origin||!['GET','HEAD'].includes(req.method()))outside.push(req.method()+' '+req.url());
});
const p=await ctx.newPage();
p.on('pageerror',e=>errors.push(String(e)));
p.on('console',m=>{if(m.type()==='error')events.push(m.text());});
await p.addInitScript(()=>{
 window.__qrw888_opened=0;
 window.__qrw888_deleted=0;
 const open=IDBFactory.prototype.open;
 const drop=IDBFactory.prototype.deleteDatabase;
 IDBFactory.prototype.open=function(...args){window.__qrw888_opened++;return open.apply(this,args);};
 IDBFactory.prototype.deleteDatabase=function(...args){window.__qrw888_deleted++;return drop.apply(this,args);};
});
const sceneDB=()=>p.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name));
const readOld=()=>p.evaluate(()=>[
 localStorage.getItem('dreamwishwand:moodboards:v1'),
 localStorage.getItem('dreamwishwand:moodboards:v1:backup'),
 localStorage.getItem('dreamwishwand:wep:scene-presets:local:v1')
]);
const old=['QRW888_original_moodboard_primary','QRW888_original_moodboard_backup',
 'QRW888_original_scene_sentinel'];
const openCount=()=>p.evaluate(()=>[window.__qrw888_opened,window.__qrw888_deleted]);
const dialog=p.locator('[data-typed-tour-dialog]');
const highlight=p.locator('[data-typed-tour-highlight]');
const status=p.locator('[data-tour-status]');
const selectors=PRESETS_MY_WAND_TOUR.steps.map(s=>s.target);
const tourOn=()=>p.locator('[data-typed-tour-open]').count();
async function guard(){
 assert.deepEqual(await sceneDB(),[],'Tour opens or creates IDB without consent');
 assert.deepEqual(await openCount(),[0,0],'Tour uses IndexedDB open/delete');
 assert.deepEqual(await readOld(),old,'Tour modifies existing backup or local storage');
 assert.deepEqual(outside,[],'unexpected Cloud/Provider/Save/Apply HTTP POST/offorigin');
 assert.deepEqual(errors,[],'uncaught browser exception');
}
async function start(mode){
 const btn=p.locator('button[data-tour-launch="'+mode+'"]');
 await btn.waitFor({timeout:15000});
 assert.equal(await btn.isVisible(),true,'expected visible '+mode+' Header help');
 await btn.focus();
 await p.keyboard.press('Enter');
 return btn;
}
async function stepReady(step){
 const text=presetsMyTourCopy('en').steps[step].title;
 await p.waitForFunction(t=>document.querySelector('[data-typed-tour-dialog] h2')?.textContent?.trim()===t,
  text,{timeout:15000});
}
async function metrics(step,phase){
 await stepReady(step);
 await p.waitForTimeout(125);
 const o=await p.evaluate(selector=>{
  const dlg=document.querySelector('[data-typed-tour-dialog]');
  const mark=document.querySelector('[data-typed-tour-highlight]');
  const target=document.querySelector(selector);
  if(!dlg||!mark||!target)return null;
  const rect=e=>{const r=e.getBoundingClientRect();return {
    left:r.left,right:r.right,top:r.top,bottom:r.bottom,
    width:r.width,height:r.height};};
  return {vw:innerWidth,vh:innerHeight,zoom:getComputedStyle(document.documentElement).zoom,
   dialog:rect(dlg),mark:rect(mark),target:rect(target),
   scrollY:window.scrollY,scrollX:window.scrollX,
   dialogScrollHeight:dlg.scrollHeight,dialogClientHeight:dlg.clientHeight};
 },selectors[step]);
 assert.ok(o,'missing dialog or anchor '+phase);
 for(const name of ['dialog','mark']){
  const x=o[name];
  if(!(x.left>=-1&&x.right<=o.vw+1&&x.top>=-1&&x.bottom<=o.vh+1))
   layoutErrors.push('visible '+name+' clipped '+phase+' '+JSON.stringify(o));
 }
 // For on-screen original target, highlighted visual rect must intersect it.
 const t=o.target,s=o.mark;
 const overlapX=Math.min(t.right,s.right)-Math.max(t.left,s.left);
 const overlapY=Math.min(t.bottom,s.bottom)-Math.max(t.top,s.top);
 if(t.right>0&&t.left<o.vw&&t.bottom>0&&t.top<o.vh)
  if(!(overlapX>0&&overlapY>0))
   layoutErrors.push('spotlight missed real DOM anchor '+phase+' '+JSON.stringify(o));
 assert.equal(await dialog.getAttribute('role'),'dialog','semantic dialog absent');
 assert.equal(await dialog.getAttribute('aria-modal'),'true','aria-modal missing');
 assert.equal(await dialog.locator('[aria-live="polite"]').count(),1,'screenreader step status missing');
 assert.ok((await dialog.ariaSnapshot()).includes(presetsMyTourCopy('en').steps[step].title),
  'screenreader current step absent');
 return o;
}
try{
 const first=await p.goto(origin+'/presets/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(first.status(),200);
 await p.locator('[data-stage1-presets-four-cards]').waitFor({timeout:20000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:20000});
 await p.evaluate(vals=>{
  localStorage.setItem('dreamwishwand:moodboards:v1',vals[0]);
  localStorage.setItem('dreamwishwand:moodboards:v1:backup',vals[1]);
  localStorage.setItem('dreamwishwand:wep:scene-presets:local:v1',vals[2]);
 },old);
 await p.locator('[data-preset-child="my"]').click();
 await p.locator('[data-my-local-scenes]').waitFor({timeout:18000});
 await p.locator('button[data-my-domain="wand"]').waitFor({timeout:18000});
 // NEW corrected geometry in real Chrome; 640px viewport with CSS zoom 200%.
 await p.setViewportSize({width:640,height:800});
 await p.evaluate(()=>{document.documentElement.style.zoom='2';});
 await start('mobile');
 await stepReady(0);
 const all=[];
 for(let step=0;step<4;step++){
  all.push(await metrics(step,'zoom200-step-'+step));
  if(step<3)await p.locator('[data-tour-next]').click();
 }
 // Corrected Tour must continue maintaining bounds and marker during scroll.
 await p.evaluate(()=>window.scrollBy(0,80));
 await p.waitForTimeout(250);
 all.push(await metrics(3,'zoom200-scroll-80'));
 await p.setViewportSize({width:620,height:780});
 all.push(await metrics(3,'zoom200-resize-620'));
 await p.setViewportSize({width:700,height:840});
 all.push(await metrics(3,'zoom200-resize-700'));
 await p.setViewportSize({width:640,height:800});
 all.push(await metrics(3,'zoom200-resize-restore'));
 const maxRight=Math.max(...all.map(v=>v.dialog.right));
 console.log('QRW888_REAL_CHROME_ZOOM200_FOUR_STEPS_SCROLL_RESIZE_MODAL_AND_HIGHLIGHT_MEASURED',
  JSON.stringify({count:all.length,maxRight,viewport:640,stepRects:all.slice(0,4).map(x=>x.dialog)}));
 // Combined responsive/accessibility/theme/focus unaffected by new zoom geometry.
 const before=await dialog.evaluate(x=>getComputedStyle(x).backgroundColor);
 await p.evaluate(()=>document.documentElement.dataset.theme='day');
 const switched=await dialog.evaluate(x=>getComputedStyle(x).backgroundColor);
 assert.notEqual(before,switched,'day-theme must dynamically recolor zoomed modal');
 await p.evaluate(()=>document.documentElement.dataset.theme='night');
 assert.equal(await dialog.evaluate(x=>getComputedStyle(x).backgroundColor),before);
 await dialog.locator('[data-tour-finish]').focus();
 await p.keyboard.press('Tab');
 assert.equal(await dialog.locator('[data-tour-skip]').evaluate(x=>x===document.activeElement),true,
  'zoomed dialog keyboard Tab escape');
 await p.keyboard.press('Shift+Tab');
 assert.equal(await dialog.locator('[data-tour-finish]').evaluate(x=>x===document.activeElement),true);
 await p.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
 assert.equal(await dialog.evaluate(x=>getComputedStyle(x).animationName),'none');
 await p.keyboard.press('Escape');
 await dialog.waitFor({state:'detached',timeout:13000});
 await p.waitForFunction(()=>document.activeElement?.getAttribute('data-tour-launch')==='mobile');
 await guard();
 console.log('QRW888_ZOOM200_KEYBOARD_TAB_ESCAPE_MOBILE_FOCUS_THEME_REDUCED_MOTION_NO_IDB_POST_PASS');

 // 320 normal mobile. This checks new geometry only (not old copy/4-step contract).
 await p.evaluate(()=>{document.documentElement.style.zoom='1';});
 await p.setViewportSize({width:320,height:800});
 await start('mobile');
 await stepReady(0);
 const small=await metrics(0,'320px-new-geometry');
 assert.equal(small.vw,320);
 await p.keyboard.press('Escape');
 await dialog.waitFor({state:'detached',timeout:13000});
 await p.waitForFunction(()=>document.activeElement?.getAttribute('data-tour-launch')==='mobile');
 await p.setViewportSize({width:1280,height:900});
 await guard();
 console.log('QRW888_REAL_CHROME_320_MOBILE_DIALOG_BOUNDARIES_ESCAPE_FOCUS_PASS');

 // Deferred negative anchors. User cannot launch against an invalid DOM target.
 const reopen=p.locator('button[data-device-scenes-reopen]');
 await reopen.waitFor({timeout:12000});
 await reopen.evaluate(x=>{x.style.display='none';});
 await start('desktop');
 assert.equal(await tourOn(),0,'invisible required anchor launched Tour');
 await reopen.evaluate(x=>{x.style.display='';x.disabled=true;});
 await start('desktop');
 assert.equal(await tourOn(),0,'disabled required anchor launched Tour');
 await reopen.evaluate(x=>{x.disabled=false;const copy=x.cloneNode(true);copy.style.display='none';x.parentElement.appendChild(copy);});
 await start('desktop');
 assert.equal(await tourOn(),0,'duplicate/hidden real Anchor launched Tour');
 await p.evaluate(()=>{
  const els=document.querySelectorAll('button[data-device-scenes-reopen]');
  if(els.length>1)els[els.length-1].remove();
 });
 await start('desktop');
 await stepReady(0);
 // Anchor disappears while Tour open: observer must close and refuse future steps.
 await reopen.evaluate(x=>x.remove());
 await dialog.waitFor({state:'detached',timeout:13000});
 assert.equal(await tourOn(),0,'disconnected anchor left live Spotlight');
 await p.waitForFunction(()=>document.querySelector('[data-tour-status]')?.textContent?.trim()?.length>0);
 await guard();
 console.log('QRW888_REAL_CHROME_HIDDEN_DISABLED_DUPLICATE_DISCONNECTED_ANCHOR_FAIL_CLOSED_NO_STORAGE_PASS');

 // Deferred WEP immersive '?' must be informative, never Presets tour or Native Apply.
 await p.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:60000});
 const immersive=p.locator('button[data-tour-launch="immersive"]');
 await immersive.waitFor({timeout:22000});
 assert.equal(await immersive.isVisible(),true,'immersive Header help unavailable');
 for(const loc of PRESETS_MY_TOUR_LOCALES){
  await p.locator('#site-locale').selectOption(loc,{force:true});
  await p.waitForFunction(l=>document.documentElement.dataset.locale===l,loc);
  const copy=presetsMyTourCopy(loc);
  assert.equal(await immersive.getAttribute('aria-label'),copy.help,'Header help label '+loc);
  await start('immersive');
  await p.waitForFunction(x=>document.querySelector('[data-tour-status]')?.textContent?.trim()===x,
   copy.unavailable,{timeout:13000});
  assert.equal(await status.getAttribute('role'),'status');
  assert.equal(await status.getAttribute('aria-live'),'polite');
  assert.equal(await tourOn(),0,'WEP mistakenly launches Presets-only Tour '+loc);
 }
 await guard();
 console.log('QRW888_REAL_WEP_IMMERSIVE_HELP_ALL_8_UNAVAILABLE_STATUS_NOT_PRESETS_TOUR_PASS');
 console.log('QRW888_FINAL_GEOMETRY_VIOLATIONS',JSON.stringify(layoutErrors));
 assert.deepEqual(layoutErrors,[],'independent CSS zoom200 source actual Chrome layout TRUE_RED');
 console.log('QRW888_INDEPENDENT_FIXED_SOURCE_026952D1_GEOMETRY_AND_DEFERRED_SCOPE_SCOPED_PASS',
  JSON.stringify({oldRedHead:OLD_RED_QA,oldRedUnchanged:true,
    newSource:SOURCE,sourceChangePaths:REPAIR,qaOnly:true,
    fourZoomSteps:true,scrollResize:true,mobile320:true,
    invalidAnchors:'hidden-disabled-duplicate-disconnected',
    eightWepLocales:true,writer:false,nativeV3:false,cloud:false,provider:false}));
}finally{await ctx.close();await browser.close();}
