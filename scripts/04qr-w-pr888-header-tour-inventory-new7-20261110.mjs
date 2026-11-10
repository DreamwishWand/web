// Independent 04 QR-W: Source PR888 seven changed paths only.
// Real Chrome against fixed Source; no reQA of accepted Scene/Native ancestors.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {PRESETS_MY_WAND_TOUR,isPresetPilotPath}
 from '../src/lib/tour/typed-tour-contract.mjs';
import {PRESETS_MY_TOUR_LOCALES,presetsMyTourCopy}
 from '../src/lib/tour/presets-my-tour-copy.mjs';
const MAIN='668708c11b248c640415c063cc00296ff1303870';
const SOURCE='6f6bbe8604ea0827a0f595f67bfd822ea94296eb';
const blobs=new Map([
 ['src/lib/SiteHeader.svelte','7898fe66999d01fff70c2b19ca104dbf438f3013'],
 ['docs/wep/world-editor-localization-inventory-20261002.json','b6712ea0df4341483a4da9a59758f534e63258a6'],
 ['src/lib/tour/typed-tour-contract.mjs','b974626720ec4feea4e9b967319e4508c5b04cf2'],
 ['src/lib/tour/SpotlightTour.svelte','51d33aa314e11ceb46e261745040435e71b43dc4'],
 ['src/lib/tour/presets-my-tour-copy.mjs','2d7370ff990e840fe9a211726070f44713c48c1c'],
 ['tests/web-presets-my-tour-contract.test.mjs','445fd6342bdd71053999158baa3bf3e2f8ad2e18'],
 ['scripts/web-presets-my-tour-chrome.mjs','bfa0cac58219a5f96a8dc0ecfae6057c977156d7']
]);
const audit=['.github/workflows/04qr-w-pr888-header-tour-inventory-new7-20261110.yml',
 'scripts/04qr-w-pr888-header-tour-inventory-new7-20261110.mjs'];
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const delta=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(delta(MAIN,SOURCE),[...blobs.keys()].sort());
assert.deepEqual(delta(SOURCE,'HEAD'),audit.slice().sort());
assert.deepEqual(git('diff','--name-status',SOURCE,'HEAD').split('\n').filter(Boolean).sort(),
 audit.map(x=>'A\t'+x).sort());
assert.deepEqual(git('diff','--name-status',MAIN,SOURCE).split('\n').filter(Boolean)
 .filter(x=>x.startsWith('M\t')).map(x=>x.slice(2)).sort(),
 ['docs/wep/world-editor-localization-inventory-20261002.json','src/lib/SiteHeader.svelte']);
for(const [p,b] of blobs){
 assert.equal(git('rev-parse',SOURCE+':'+p),b);
 assert.equal(git('hash-object',p),b,'no Source modification '+p);
}
assert.equal(git('rev-parse',MAIN+':src/lib/SiteHeader.svelte'),
 '6cede86476ca6dbd3427115671367c9a1f4a433f');
assert.equal(git('rev-parse',MAIN+':docs/wep/world-editor-localization-inventory-20261002.json'),
 'd7d40459af6d4564f61baee68c3a0a59784eb21c');
assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/routes','src/lib/wep',
 'src/lib/ui','src/lib/collection','src/lib/community','src/lib/product',
 'src/lib/ui/product-shell-navigation.mjs','static','supabase','crates'),'');
assert.equal(PRESETS_MY_WAND_TOUR.firstVisitAuto,false);
assert.deepEqual([...PRESETS_MY_WAND_TOUR.autoLaunchAllowlist],[]);
assert.equal(PRESETS_MY_WAND_TOUR.completionPersistence,'none');
assert.deepEqual(PRESETS_MY_WAND_TOUR.steps.map(x=>x.target),[
 'button[data-my-domain="wand"]','nav[data-my-wand-views]',
 'section[data-my-local-scenes]','button[data-device-scenes-reopen]'
]);
assert.equal(isPresetPilotPath('/presets/'),true);
assert.equal(isPresetPilotPath('/editor/world/'),false);
console.log('QRW888_SOURCE_NEW7_FROZEN_BLOBS_QA2_NO_IA_OR_ANCESTOR_MUTATION_PASS');

// Independent WEP inventory preservation + eight-locale provenance.
const invPath='docs/wep/world-editor-localization-inventory-20261002.json';
const n=JSON.parse(readFileSync(invPath,'utf8'));
const o=JSON.parse(git('show',MAIN+':'+invPath));
assert.equal(Object.keys(n.categories).length,13);
assert.deepEqual(Object.keys(n.categories),Object.keys(o.categories));
for(const [cat,entries] of Object.entries(o.categories)){
 assert.ok(n.categories[cat].length>=entries.length);
 for(let i=0;i<entries.length;i++){
  const before=entries[i],after=n.categories[cat][i];
  assert.equal(after.surface,before.surface,'existing category scope changed '+cat);
  for(const s of before.strings||[])
   assert.ok(after.strings?.includes(s),'old WEP presentation string removed '+cat);
 }
}
for(const [path,oldBlob] of Object.entries(o.sourcePins)){
 if(path==='src/lib/SiteHeader.svelte')continue;
 assert.equal(n.sourcePins[path],oldBlob,'unauthorized WEP pin update '+path);
}
assert.equal(n.sourcePins['src/lib/SiteHeader.svelte'],blobs.get('src/lib/SiteHeader.svelte'));
assert.equal(n.sourcePins['src/lib/tour/presets-my-tour-copy.mjs'],
 blobs.get('src/lib/tour/presets-my-tour-copy.mjs'));
assert.deepEqual(n.safetyBoundary,o.safetyBoundary,'WEP Writer OFF altered');
const shell=n.categories.navigation.find(x=>x.surface==='Shared site shell rendered on World Editor');
const status=n.categories.errorsStatusLiveRegions.find(x=>
 String(x.surface).includes('Shared Header Presets-only Tour unavailable'));
assert.ok(shell&&status,'new WEP Header label and live status both required');
assert.equal(status.role,'status');
assert.equal(status.ariaLive,'polite');
assert.equal(status.selector,'p[data-tour-status]');
assert.deepEqual([...PRESETS_MY_TOUR_LOCALES],[...n.launchLocales]);
for(const loc of PRESETS_MY_TOUR_LOCALES){
 const c=presetsMyTourCopy(loc);
 assert.equal(shell.helpLabelsByLocale[loc],c.help);
 assert.equal(status.unavailableByLocale[loc],c.unavailable);
 assert.equal(c.steps.length,4);
 for(const step of c.steps)assert.ok(step.body.length>17&&step.title.length>1);
}
console.log('QRW888_APPROVED_WEP_ONEFILE_13CATEGORIES_OLD_STRINGS_SOURCEPIN_8LOCALE_STATUS_PASS');

const host=process.env.QRW888_ORIGIN;
assert.match(host??'',/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'real Chrome required');
assert.ok(!process.env.P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH&&!process.env.WEP_PRIVATE_P1G_PATH);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const requests=[],errors=[];
ctx.on('request',req=>{
 const origin=new URL(req.url()).origin;
 if(origin!==host||!['GET','HEAD'].includes(req.method()))
  requests.push(req.method()+' '+req.url());
});
const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));
await p.addInitScript(()=>{
 window.__q888_open=0;
 const native=IDBFactory.prototype.open;
 IDBFactory.prototype.open=function(...args){
  window.__q888_open++;return native.apply(this,args);
 };
});
const MOOD='dreamwishwand:moodboards:v1',BACKUP='dreamwishwand:moodboards:v1:backup';
const original=['qrw888_original_primary','qrw888_original_backup'];
const readOld=()=>p.evaluate(([a,b])=>[localStorage.getItem(a),localStorage.getItem(b)],[MOOD,BACKUP]);
const dbs=()=>p.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name));
const tourCount=()=>p.locator('[data-typed-tour-open]').count();
const qaGuard=async()=>{
 assert.deepEqual(await readOld(),original,'legacy Scene/Moodboard storage changed');
 assert.deepEqual(await dbs(),[],'tour silently created Scene IndexedDB');
 assert.equal(await p.evaluate(()=>window.__q888_open),0,'tour silently opened IndexedDB');
 assert.deepEqual(requests,[],'unexpected external GET/POST/Provider/Cloud');
};
async function activate(mode){
 const b=p.locator('[data-tour-launch="'+mode+'"]');
 await b.waitFor({timeout:18000});
 assert.equal(await b.isVisible(),true,'required help control not visible '+mode);
 await b.focus();await p.keyboard.press('Enter');
}
async function stage(step){
 await p.locator('[data-typed-tour-dialog] h2')
  .filter({hasText:presetsMyTourCopy('en').steps[step].title}).waitFor({timeout:14000});
 const overlay=p.locator('[data-typed-tour-highlight]');
 const target=p.locator(PRESETS_MY_WAND_TOUR.steps[step].target);
 const rect=await target.boundingBox(),spot=await overlay.boundingBox();
 assert.ok(rect&&spot,'genuine target+spotlight required');
 assert.ok(Math.abs(spot.x-(rect.x-4))<9,'spotlight must highlight real target x '+step);
 assert.ok(Math.abs(spot.y-(rect.y-4))<9,'spotlight must highlight real target y '+step);
 const modal=p.locator('[data-typed-tour-dialog]');
 assert.equal(await modal.getAttribute('role'),'dialog');
 assert.equal(await modal.getAttribute('aria-modal'),'true');
 assert.equal(await modal.getAttribute('aria-label'),presetsMyTourCopy('en').title);
 assert.equal(await modal.locator('[aria-live="polite"]').count(),1);
 const snap=await modal.ariaSnapshot();
 assert.ok(snap.includes(presetsMyTourCopy('en').steps[step].title),
  'active step must be exposed in accessible tree');
 assert.equal(await modal.evaluate(x=>x===document.activeElement),true,
  'modal must own keyboard focus on step '+step);
}
try{
 const res=await p.goto(host+'/presets/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(res.status(),200);
 await p.locator('[data-stage1-presets-four-cards]').waitFor({timeout:22000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale));
 await p.evaluate(([a,b,v,w])=>{localStorage.setItem(a,v);localStorage.setItem(b,w);},
  [MOOD,BACKUP,...original]);
 await p.waitForTimeout(500);
 assert.equal(await tourCount(),0,'first visit cannot auto-launch');
 await activate('desktop');
 await p.waitForFunction(text=>document.querySelector('[data-tour-status]')?.textContent?.trim()===text,
  presetsMyTourCopy('en').unavailable);
 assert.equal(await p.locator('[data-tour-status]').getAttribute('role'),'status');
 assert.equal(await p.locator('[data-tour-status]').getAttribute('aria-live'),'polite');
 assert.equal(await tourCount(),0,'wrong Presets root view cannot launch four-step Tour');
 await qaGuard();
 console.log('QRW888_REAL_CHROME_MANUAL_FIRST_VISIT_WRONG_VIEW_UNAVAILABLE_STATUS_NO_DB_PASS');

 await p.locator('[data-preset-child="my"]').click();
 await p.locator('[data-my-domain-view="wand"]').waitFor({timeout:22000});
 for(const s of PRESETS_MY_WAND_TOUR.steps){
  assert.equal(await p.locator(s.target).count(),1,'duplicate/missing original anchor '+s.id);
  assert.equal(await p.locator(s.target).isVisible(),true,'hidden original anchor '+s.id);
 }
 await activate('desktop');
 for(let i=0;i<4;i++){
  await stage(i);
  if(i<3)await p.locator('[data-tour-next]').click();
 }
 await p.locator('[data-tour-back]').click();
 await stage(2);
 await p.locator('[data-tour-next]').click();
 await stage(3);
 console.log('QRW888_REAL_CHROME_GENUINE_4_ANCHORS_NEXT_BACK_SR_DIALOG_FOCUS_PASS');

 const dlg=p.locator('[data-typed-tour-dialog]');
 const night=await dlg.evaluate(el=>getComputedStyle(el).backgroundColor);
 await p.evaluate(()=>{document.documentElement.dataset.theme='day';});
 const day=await dlg.evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.notEqual(night,day,'theme changed but live tour CSS did not');
 await p.evaluate(()=>{document.documentElement.dataset.theme='night';});
 assert.equal(await dlg.evaluate(el=>getComputedStyle(el).backgroundColor),night);
 await p.locator('[data-tour-finish]').focus();
 await p.keyboard.press('Tab');
 assert.equal(await p.locator('[data-tour-skip]').evaluate(el=>el===document.activeElement),true,
  'Tab must stay trapped in modal actions');
 await p.keyboard.press('Shift+Tab');
 assert.equal(await p.locator('[data-tour-finish]').evaluate(el=>el===document.activeElement),true);
 await p.locator('[data-tour-finish]').click();
 await dlg.waitFor({state:'detached',timeout:18000});
 await p.waitForFunction(()=>document.activeElement?.getAttribute('data-tour-launch')==='desktop');
 await qaGuard();
 assert.equal(await p.evaluate(()=>Object.keys(localStorage).some(x=>/spotlight|typed.tour/i.test(x))),false);
 console.log('QRW888_REAL_CHROME_THEME_LIVE_TAB_TRAP_FINISH_FOCUS_RESTORE_NO_PERSIST_PASS');

 for(const loc of PRESETS_MY_TOUR_LOCALES){
  await p.locator('#site-locale').selectOption(loc);
  await p.waitForFunction(x=>document.documentElement.dataset.locale===x,loc);
  assert.equal(await p.locator('[data-tour-launch="desktop"]').getAttribute('aria-label'),
   presetsMyTourCopy(loc).help);
  await activate('desktop');
  await dlg.waitFor({timeout:15000});
  assert.equal(await dlg.getAttribute('aria-label'),presetsMyTourCopy(loc).title);
  assert.equal(await dlg.locator('h2').innerText(),presetsMyTourCopy(loc).steps[0].title);
  await p.locator('[data-tour-skip]').click();
  await dlg.waitFor({state:'detached',timeout:15000});
  await p.waitForFunction(()=>document.activeElement?.getAttribute('data-tour-launch')==='desktop');
 }
 await p.locator('#site-locale').selectOption('en');
 await p.waitForFunction(()=>document.documentElement.dataset.locale==='en');
 await qaGuard();
 console.log('QRW888_REAL_CHROME_8_LOCALES_MANUAL_SKIP_RELAUNCH_FOCUS_SR_PASS');

 await p.setViewportSize({width:320,height:820});
 await activate('mobile');
 await stage(0);
 let box=await dlg.boundingBox();
 assert.ok(box&&box.x>=-1&&box.x+box.width<=321,'mobile 320 tour clipped');
 await p.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
 assert.equal(await dlg.evaluate(e=>getComputedStyle(e).animationName),'none');
 await p.keyboard.press('Escape');
 await dlg.waitFor({state:'detached',timeout:12000});
 await p.waitForFunction(()=>document.activeElement?.getAttribute('data-tour-launch')==='mobile');
 await p.setViewportSize({width:640,height:900});
 await p.evaluate(()=>{document.documentElement.style.zoom='2';});
 await activate('mobile');
 await stage(0);
 box=await dlg.boundingBox();
 const vw=await p.evaluate(()=>innerWidth);
 assert.ok(box&&box.x>=-1&&box.x+box.width<=vw+1,'CSS200 tour clipped');
 await p.keyboard.press('Escape');
 await dlg.waitFor({state:'detached',timeout:12000});
 await p.evaluate(()=>{document.documentElement.style.zoom='1';});
 await p.setViewportSize({width:1280,height:900});
 await qaGuard();
 console.log('QRW888_REAL_CHROME_MOBILE_320_CSS200_ESCAPE_REDUCED_MOTION_FOCUS_PASS');

 const reopen=p.locator('button[data-device-scenes-reopen]');
 await reopen.evaluate(e=>{e.style.display='none';});
 await activate('desktop');assert.equal(await tourCount(),0,'hidden real anchor highlighted');
 await reopen.evaluate(e=>{e.style.display='';e.disabled=true;});
 await activate('desktop');assert.equal(await tourCount(),0,'disabled real anchor highlighted');
 await reopen.evaluate(e=>{e.disabled=false;const c=e.cloneNode(true);c.style.display='none';e.parentElement.appendChild(c);});
 await activate('desktop');assert.equal(await tourCount(),0,'duplicate hidden anchor highlighted');
 await p.evaluate(()=>{
  const xs=document.querySelectorAll('button[data-device-scenes-reopen]');
  if(xs.length>1)xs[xs.length-1].remove();
 });
 await qaGuard();
 console.log('QRW888_REAL_CHROME_HIDDEN_DISABLED_DUPLICATE_ANCHORS_FAILCLOSED_PASS');

 await p.goto(host+'/editor/world/',{waitUntil:'networkidle',timeout:60000});
 const help=p.locator('[data-tour-launch="immersive"]');
 await help.waitFor({timeout:24000});
 assert.equal(await help.isVisible(),true);
 await activate('immersive');
 const message=p.locator('[data-tour-status]');
 await p.waitForFunction(x=>document.querySelector('[data-tour-status]')?.textContent?.trim()===x,
  presetsMyTourCopy('en').unavailable);
 assert.equal(await message.getAttribute('role'),'status');
 assert.equal(await message.getAttribute('aria-live'),'polite');
 assert.equal(await tourCount(),0,'WEP wrongly launched Presets Tour');
 for(const loc of PRESETS_MY_TOUR_LOCALES){
  await p.locator('#site-locale').selectOption(loc,{force:true});
  await p.waitForFunction(x=>document.documentElement.dataset.locale===x,loc);
  assert.equal(await help.getAttribute('aria-label'),presetsMyTourCopy(loc).help);
  await activate('immersive');
  await p.waitForFunction(x=>document.querySelector('[data-tour-status]')?.textContent?.trim()===x,
   presetsMyTourCopy(loc).unavailable);
  assert.equal(await tourCount(),0,'wrong WEP tour in locale '+loc);
 }
 await qaGuard();
 assert.deepEqual(errors,[],'uncaught browser JS errors');
 assert.deepEqual(requests,[],'unexpected Provider/Cloud/POST');
 console.log('QRW888_REAL_WEP_IMMERSIVE_HELP_8_LOCALE_LIVE_UNAVAILABLE_NO_TOUR_PASS');
 console.log('QRW888_INDEPENDENT_NEW7_REAL_NODE_CHROME_SCOPED_PASS',
  JSON.stringify({main:MAIN,source:SOURCE,qaOnly:true,newPaths:7,
   fourAnchors:true,locales:8,themeLive:true,IDB:false,cloud:false,nativeWriter:false}));
}finally{await ctx.close();await browser.close();}
