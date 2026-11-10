// Dreamwish Wand 04 QR-W / PR888 B14: independent source-affected geometry QA.
// Old QA #889/#890 TRUE_RED remains historical. NO accepted ancestor reQA.
// Actual installed Chrome, intentionally isolated synthetic blank browser.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {PRESETS_MY_WAND_TOUR} from '../src/lib/tour/typed-tour-contract.mjs';
import {presetsMyTourCopy} from '../src/lib/tour/presets-my-tour-copy.mjs';

const MAIN='668708c11b248c640415c063cc00296ff1303870';
const PREV='d50209590e6acb4256afdb7d94f81e4b0bf3c61b';
const SRC='b14a1b7e2c7aefe85fe543ae7df70eaeecc921be';
const OLD_RED_889='c9a97ec0424d3ecbfaac891b0db6c95753ade664';
const OLD_RED_890='7c552c6824a5119917964aebb7e8e4fdbf0be31b';
const OLD_RED_891='53f8338d1340e05399a86d04e075cae4c7d761a5';
const SCOPE=['src/lib/tour/SpotlightTour.svelte','scripts/web-presets-my-tour-chrome.mjs'];
const SOURCE7=[
 'docs/wep/world-editor-localization-inventory-20261002.json',
 'scripts/web-presets-my-tour-chrome.mjs','src/lib/SiteHeader.svelte',
 'src/lib/tour/SpotlightTour.svelte','src/lib/tour/presets-my-tour-copy.mjs',
 'src/lib/tour/typed-tour-contract.mjs','tests/web-presets-my-tour-contract.test.mjs'];
const QA2=['.github/workflows/04qr-w-pr888-b14-root-zoom-independent-20261110.yml',
 'scripts/04qr-w-pr888-b14-root-zoom-independent-20261110.mjs'];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SRC),MAIN,'source must have exact protected main ancestor');
assert.equal(git('merge-base',PREV,SRC),PREV,'new Source must descend previous independent TRUE_RED');
assert.deepEqual(files(MAIN,SRC),SOURCE7.slice().sort(),'only original seven Source files');
assert.deepEqual(files(PREV,SRC),SCOPE.slice().sort(),'only two affected Source changes since #891');
assert.deepEqual(files(SRC,'HEAD'),QA2.slice().sort(),'only new two QA audit files');
assert.deepEqual(git('diff','--name-status',SRC,'HEAD').split('\n').filter(Boolean).sort(),
 QA2.map(f=>'A\t'+f).sort(),'no product Source edit in QA');
for(const [file,blob] of [
 ['src/lib/tour/SpotlightTour.svelte','3196f578339c17ebe6035f5efc8427afdbffaae6'],
 ['scripts/web-presets-my-tour-chrome.mjs','cb4327d279ee701a2ce5eba932c1d0588fbb81f0']
]){
 assert.equal(git('rev-parse',SRC+':'+file),blob,'Source immutable SHA '+file);
 assert.equal(git('hash-object',file),blob,'QA edit of Source '+file);
}
assert.equal(git('merge-base','026952d1e7ef0c4d2772da65c2c62bce8f776759',OLD_RED_890),
 '026952d1e7ef0c4d2772da65c2c62bce8f776759','old QA890 historical source still anchored');
assert.equal(git('merge-base',PREV,OLD_RED_891),PREV,'QA891 TRUE_RED historical Source anchored');
assert.equal(git('merge-base','6f6bbe8604ea0827a0f595f67bfd822ea94296eb',OLD_RED_889),
 '6f6bbe8604ea0827a0f595f67bfd822ea94296eb');
console.log('QRW888_B14_SOURCE_REPAIR_ONLY_2_PATHS_OLD_QA889_QA890_QA891_REDS_IMMUTABLE_QA2_PASS');

const origin=process.env.QRW888_ORIGIN;
assert.match(origin??'',/^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(process.env.CHROME_BIN,'real installed Chrome executable required');
assert.ok(!process.env.P1G_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH,
 'no private Save is authorized for a visual tour QA');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},
 acceptDownloads:false,serviceWorkers:'block',ignoreHTTPSErrors:false});
const p=await ctx.newPage(),errors=[],network=[];
ctx.on('request',req=>{
 if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))
  network.push(req.method()+' '+req.url());
});
p.on('pageerror',e=>errors.push(String(e)));
await p.addInitScript(()=>{
 const audit={raf:0,scroll:0,resize:0,focusChanges:0,styleChanges:0,dbOpen:0,
  dbDelete:0};
 window.__qrwAudit=audit;
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=(cb)=>{audit.raf++;return raf(cb);};
 window.addEventListener('scroll',()=>audit.scroll++,true);
 window.addEventListener('resize',()=>audit.resize++,true);
 document.addEventListener('focusin',()=>audit.focusChanges++,true);
 const opening=IDBFactory.prototype.open;
 IDBFactory.prototype.open=function(...a){audit.dbOpen++;return opening.apply(this,a);};
 const dropping=IDBFactory.prototype.deleteDatabase;
 IDBFactory.prototype.deleteDatabase=function(...a){audit.dbDelete++;return dropping.apply(this,a);};
 const obs=new MutationObserver(muts=>{
  for(const m of muts)if(m.type==='attributes'&&m.attributeName==='style'&&
   m.target?.matches?.('[data-typed-tour-dialog],[data-typed-tour-highlight]'))
    audit.styleChanges++;
 });
 document.addEventListener('DOMContentLoaded',()=>obs.observe(document.documentElement,
  {subtree:true,attributes:true,attributeFilter:['style']}),{once:true});
});
const labels=PRESETS_MY_WAND_TOUR.steps.map(x=>x.target);
const modal=p.locator('[data-typed-tour-dialog]');
const waitFrames=()=>p.waitForTimeout(330); // >2 render frames and zero synthetic resize/scroll
async function getAudit(){return p.evaluate(()=>({...window.__qrwAudit,scrollY:window.scrollY,
  focus:document.activeElement?.getAttribute('data-tour-next')!==null?'next':
   document.activeElement?.getAttribute('data-tour-back')!==null?'back':
   document.activeElement?.getAttribute('data-typed-tour-dialog')!==null?'dialog':'other'}));}
const anomalies=[],readings=[];
async function sample(step,label,{mustRemain=true}={}){
 await waitFrames();
 const data=await p.evaluate(selector=>{
  const d=document.querySelector('[data-typed-tour-dialog]');
  const s=document.querySelector('[data-typed-tour-highlight]');
  const t=document.querySelector(selector);
  const rect=(el)=>{
   if(!el)return null;
   const r=el.getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,
    width:r.width,height:r.height};
  };
  return {zoom:getComputedStyle(document.documentElement).zoom,
   vw:innerWidth,vh:innerHeight,scrollY,
   dialog:rect(d),spot:rect(s),target:rect(t),
   role:d?.getAttribute('role'),ariaModal:d?.getAttribute('aria-modal'),
   liveCount:d?.querySelectorAll('[aria-live="polite"]').length??0,
   headline:d?.querySelector('h2')?.textContent?.trim()??null};
 },labels[step]);
 readings.push({label,step,...data});
 if(!data.dialog||!data.spot){
  if(mustRemain)anomalies.push(label+': Tour missing/blocked despite valid target '+JSON.stringify(data));
  return;
 }
 const within=(r)=>r.left>=-1&&r.right<=data.vw+1&&r.top>=-1&&r.bottom<=data.vh+1;
 for(const name of ['dialog','spot']){
  if(!within(data[name]))anomalies.push(label+': '+name+' out of physical viewport '+JSON.stringify(data));
 }
 const t=data.target,s=data.spot;
 if(!t||!(t.left<data.vw&&t.right>0&&t.top<data.vh&&t.bottom>0))
  anomalies.push(label+': current real DOM anchor not on screen '+JSON.stringify(data));
 else if(Math.min(t.right,s.right)-Math.max(t.left,s.left)<=0||
         Math.min(t.bottom,s.bottom)-Math.max(t.top,s.top)<=0)
  anomalies.push(label+': spotlight misses current real DOM anchor '+JSON.stringify(data));
 if(data.role!=='dialog'||data.ariaModal!=='true'||data.liveCount!==1)
  anomalies.push(label+': zoom step dialog lost basic Screen Reader semantics');
 if(data.headline!==presetsMyTourCopy('en').steps[step].title)
  anomalies.push(label+': wrong step title / rAF step mismatch '+JSON.stringify(data));
 return data;
}
async function waitStep(step){
 await p.waitForFunction(title=>document.querySelector('[data-typed-tour-dialog] h2')?.textContent?.trim()===title,
  presetsMyTourCopy('en').steps[step].title,{timeout:16000});
}
async function start(){
 const b=p.locator('button[data-tour-launch="mobile"]');
 await b.waitFor({timeout:20000});
 await b.focus();await p.keyboard.press('Enter');
 await modal.waitFor({timeout:20000});
 await waitStep(0);
}
function track(before,after,phase,ms){
 const dr=after.raf-before.raf,ds=after.styleChanges-before.styleChanges,
  dScroll=after.scroll-before.scroll,dFocus=after.focusChanges-before.focusChanges;
 console.log('QRW888_RAF_STABILITY '+phase+' '+JSON.stringify({
  windowMs:ms,raf:dr,styleMutations:ds,scrollEvents:dScroll,focusChanges:dFocus,
  scrollYBefore:before.scrollY,scrollYAfter:after.scrollY}));
 if(dr>100)anomalies.push(phase+': unbounded rAF activity '+dr+'/'+ms+'ms');
 if(ds>90)anomalies.push(phase+': excessive rect/style mutations '+ds+'/'+ms+'ms');
 if(Math.abs(after.scrollY-before.scrollY)>1)anomalies.push(phase+': autonomous scroll drift');
 if(dFocus>0)anomalies.push(phase+': correction stole focus');
}
try{
 const response=await p.goto(origin+'/presets/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(response?.status(),200);
 await p.locator('[data-stage1-presets-four-cards]').waitFor({timeout:25000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:25000});
 await p.locator('[data-preset-child="my"]').click();
 await p.locator('[data-my-local-scenes]').waitFor({timeout:25000});
 // New geometry: all four steps under real Chrome CSS zoom 200% at 640x800.
 await p.setViewportSize({width:640,height:800});
 await p.evaluate(()=>{document.documentElement.style.zoom='2';});
 await start();
 for(let i=0;i<4;i++){
  await waitStep(i);
  await sample(i,'zoom200-step'+i);
  if(i<3)await p.locator('[data-tour-next]').click();
 }
 console.log('QRW888_B14_REAL_CHROME_ZOOM200_4_STEPS_MEASURED '+
  JSON.stringify(readings.slice(0,4).map(x=>({step:x.step,d:x.dialog,s:x.spot,t:x.target}))));
 await p.evaluate(()=>window.scrollBy(0,80));
 await sample(3,'zoom200-scroll80');
 for(const [width,height] of [[620,780],[700,840],[640,800]]){
  await p.setViewportSize({width,height});
  await sample(3,'zoom200-resize'+width);
 }
 // Previous PR890 regression: change directly to 320px after scroll history.
 await p.evaluate(()=>{document.documentElement.style.zoom='1';});
 await p.setViewportSize({width:320,height:800});
 await sample(3,'zoom100-320-after-scroll-preserved');
 console.log('QRW888_B14_RESIZE_SCROLL_AND_320_AFTER_SCROLL_MEASURED');

 // Important Owner requirement: mutate ONLY documentElement.style.zoom while
 // Tour is open; no explicit resize or scroll are injected. Internal one-time reveal may scroll; observe physical DOMRects.
 // Use existing 320 viewport, and put root zoom through 1 -> 2 -> 1.
 const eventsBefore=await getAudit();
 await p.evaluate(()=>document.documentElement.style.zoom='2');
 await sample(3,'root-zoom-only-1to2');
 const eventsAfter=await getAudit();
 assert.equal(eventsAfter.resize,eventsBefore.resize,
  'Audit accidentally delivered resize during root-only CSS zoom change');
 assert.ok(eventsAfter.raf>eventsBefore.raf,
  'root style zoom did not schedule a browser animation-frame recalculation');
assert.ok(eventsAfter.scroll-eventsBefore.scroll<16,
  'root-only zoom caused an unbounded automatic scroll cascade');
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await sample(3,'root-zoom-only-2to1');
 const eventsBack=await getAudit();
 assert.equal(eventsBack.resize,eventsAfter.resize);
 assert.ok(eventsBack.raf>eventsAfter.raf,
  'zoom restore did not trigger a new layout recalculation');
assert.ok(eventsBack.scroll-eventsAfter.scroll<16,
  'zoom restore caused an unbounded automatic scroll cascade');
 console.log('QRW888_B14_ROOT_STYLE_ZOOM_ONLY_NO_RESIZE_SCROLL_EVENTS_MEASURED');

 // No rAF cascade, scroll storm or focus stealing when geometry has settled.
 const button=p.locator('[data-tour-back]');
 await button.focus();
 assert.equal(await button.evaluate(el=>el===document.activeElement),true);
 await waitFrames();
 const quietStart=await getAudit();
 await p.waitForTimeout(850);
 const quietEnd=await getAudit();
 track(quietStart,quietEnd,'stable-open-tour',850);
 assert.equal(await button.evaluate(el=>el===document.activeElement),true,
  'Tour correction stole keyboard focus from Back');
 assert.equal(await modal.getAttribute('aria-modal'),'true');
 assert.equal(await modal.getAttribute('role'),'dialog');
 assert.equal(await modal.locator('[aria-live="polite"]').count(),1);
 const sr=await modal.ariaSnapshot();
 assert.ok(sr.includes(presetsMyTourCopy('en').steps[3].title),'Screen Reader step title absent');
 const preTheme=await modal.evaluate(el=>getComputedStyle(el).backgroundColor);
 await p.evaluate(()=>document.documentElement.dataset.theme='day');
 await waitFrames();
 const postTheme=await modal.evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.notEqual(preTheme,postTheme,'Theme toggle did not recolor live modal');
 await p.evaluate(()=>document.documentElement.dataset.theme='night');
 await p.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await modal.evaluate(el=>getComputedStyle(el).animationName),'none');
 await sample(3,'after-theme-and-reduced-motion');
 await p.keyboard.press('Escape');
 await modal.waitFor({state:'detached',timeout:14000});
 await p.waitForFunction(()=>document.activeElement?.getAttribute('data-tour-launch')==='mobile',
  null,{timeout:12000});
 console.log('QRW888_B14_REAL_CHROME_RAF_FOCUS_SCREENREADER_THEME_REDUCED_MOTION_ESCAPE_CHECKED');

 const audit=await getAudit();
 assert.deepEqual([audit.dbOpen,audit.dbDelete],[0,0],
  'geometry correction unexpectedly accesses IndexedDB');
 assert.deepEqual(network,[],'unexpected off-host/POST in geometry scope');
 assert.deepEqual(errors,[],'uncaught JS error');
 console.log('QRW888_B14_INDEPENDENT_PHYSICAL_RECT_READINGS '+JSON.stringify(readings));
 console.log('QRW888_B14_INDEPENDENT_GEOMETRY_VIOLATIONS '+JSON.stringify(anomalies));
 assert.deepEqual(anomalies,[],'independent new Source CSS geometry TRUE_RED');
 console.log('QRW888_B14_INDEPENDENT_CHANGED_SCOPE_SCOPED_PASS',
  JSON.stringify({source:SRC,qaOnly:true,zoom4:true,scrollResize:true,
   rootZoomWithoutEvents:true,finiteRaf:true,writer:false,cloud:false}));
}finally{await ctx.close();await browser.close();}
