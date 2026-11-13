// 04 QR-W public-hosted manual Tour @1, fixed deployed Pages main, QA-only never merge.
// Operates only on an isolated empty headless real Chrome context. NO P1G or user data.
// Earlier local Source PR888 / QA892 / Integration896 accepted; do not repeat local source QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {PRESETS_MY_WAND_TOUR} from '../src/lib/tour/typed-tour-contract.mjs';
import {presetsMyTourCopy,PRESETS_MY_TOUR_LOCALES} from '../src/lib/tour/presets-my-tour-copy.mjs';
const MAIN='4d2940002cab632bdba3cd7379c0f8ee69de43e5';
const QA2=[".github/workflows/04qr-w-hosted-presets-tour-https-e2e-20261111.yml","scripts/04qr-w-hosted-presets-tour-https-e2e-20261111.mjs"];
const PINNED={"src/lib/SiteHeader.svelte":"7898fe66999d01fff70c2b19ca104dbf438f3013","src/lib/tour/SpotlightTour.svelte":"3196f578339c17ebe6035f5efc8427afdbffaae6","src/lib/tour/presets-my-tour-copy.mjs":"2d7370ff990e840fe9a211726070f44713c48c1c","src/lib/tour/typed-tour-contract.mjs":"b974626720ec4feea4e9b967319e4508c5b04cf2"};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD~2'),MAIN,'QA branch must start from fixed deployed main');
assert.deepEqual(git('diff','--name-status',MAIN,'HEAD').split('\n').filter(Boolean).sort(),
 QA2.map(f=>'A\t'+f).sort(),'QA-only exactly two ADD files, no product edit');
for(const [path,blob] of Object.entries(PINNED))
 assert.equal(git('rev-parse',MAIN+':'+path),blob,'accepted Source GitBlob unchanged: '+path);
console.log('QRW_HOSTED_MAIN_QA_ONLY_PINNED',JSON.stringify({MAIN,QA2,accepted:Object.keys(PINNED)}));
const origin=process.env.QRW_PUBLIC_ORIGIN;
assert.equal(origin,'https://dreamwishwand.github.io','the exact deployed GitHub Pages HTTPS origin is required');
assert.ok(process.env.CHROME_BIN,'real installed Chrome executable required');
assert.ok(!process.env.P1G_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH,
 'no private Save is authorized for a visual tour QA');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},
 acceptDownloads:false,serviceWorkers:'block',ignoreHTTPSErrors:false});
const p=await ctx.newPage(),errors=[],network=[],downloads=[];
p.on('download',d=>downloads.push(d.suggestedFilename()));
ctx.on('request',req=>{
 if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))
  network.push(req.method()+' '+req.url());
});
p.on('pageerror',e=>errors.push(String(e)));
await p.addInitScript(()=>{
 const audit={raf:0,scroll:0,resize:0,focusChanges:0,styleChanges:0,dbOpen:0,
  dbDelete:0,storageWrites:[]};
 window.__qrwAudit=audit;
 const setItem=Storage.prototype.setItem,removeItem=Storage.prototype.removeItem,
  clear=Storage.prototype.clear;
 Storage.prototype.setItem=function(k,v){audit.storageWrites.push(['set',String(k)]);return setItem.call(this,k,v);};
 Storage.prototype.removeItem=function(k){audit.storageWrites.push(['remove',String(k)]);return removeItem.call(this,k);};
 Storage.prototype.clear=function(){audit.storageWrites.push(['clear','*']);return clear.call(this);};
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
 let response;
 try{response=await p.goto(origin+'/web/presets/',{waitUntil:'networkidle',timeout:60000});}
 catch(error){throw Error('WAIT_ENV_HOSTED_HTTPS_UNREACHABLE '+String(error));}
 if(response?.status()!==200)throw Error('TRUE_RED_HOSTED_DIRECT_PRESETS_HTTP_'+String(response?.status()));
 assert.equal(new URL(p.url()).origin,origin,'HTTPS origin changed unexpectedly');
 assert.equal(new URL(p.url()).pathname,'/web/presets/','direct public URL unexpectedly redirected');
 assert.ok(response?.request().url().startsWith('https://'),'not HTTPS');
 console.log('QRW_HOSTED_REAL_HTTPS_DIRECT_URL_200 '+JSON.stringify({actual:p.url(),status:response.status()}));
 await p.locator('[data-stage1-presets-four-cards]').waitFor({timeout:25000});
 await p.waitForTimeout(900);
 assert.equal(await p.locator('[data-typed-tour-open]').count(),0,'hosted first visit must never auto-launch Tour');
 assert.equal(await p.locator('[data-tour-launch="desktop"] svg').count(),1,'help launch must render first party SVG');
 const networkBaseline=network.length,errorsBaseline=errors.length;
 const beforeWand=await getAudit();
 await p.locator('[data-tour-launch="desktop"]').click();
 await p.waitForTimeout(250);
 assert.equal(await p.locator('[data-typed-tour-open]').count(),0,'wrong host view must fail closed');
 assert.ok((await p.locator('[data-tour-status]').textContent())?.trim().length>4,'missing localized tour unavailable status');
 console.log('QRW_HOSTED_MANUAL_ONLY_FAIL_CLOSED_WRONG_VIEW_PASS');
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
 console.log('QRW_HOSTED_REAL_CHROME_ZOOM200_4_STEPS_MEASURED '+
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
 console.log('QRW_HOSTED_RESIZE_SCROLL_AND_320_AFTER_SCROLL_MEASURED');

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
 console.log('QRW_HOSTED_ROOT_STYLE_ZOOM_ONLY_NO_RESIZE_SCROLL_EVENTS_MEASURED');

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
 console.log('QRW_HOSTED_REAL_CHROME_RAF_FOCUS_SCREENREADER_THEME_REDUCED_MOTION_ESCAPE_CHECKED');
 // Hosted-only locale + HTTPS navigation contract. Original Source QA remains accepted.
 await p.setViewportSize({width:1280,height:900});
 for(const lang of PRESETS_MY_TOUR_LOCALES){
  await p.locator('#site-locale').selectOption(lang);
  await p.waitForFunction(code=>document.documentElement.dataset.locale===code,lang,{timeout:12000});
  const help=p.locator('[data-tour-launch="desktop"]');
  assert.equal(await help.getAttribute('aria-label'),presetsMyTourCopy(lang).help,
   'hosted ? accessible label not localized '+lang);
  await help.focus();
  await p.keyboard.press('Enter');
  await modal.waitFor({state:'visible',timeout:12000});
  for(let step=0;step<4;step++){
   const expected=presetsMyTourCopy(lang).steps[step].title;
   await p.waitForFunction(t=>document.querySelector('[data-typed-tour-dialog] h2')?.textContent?.trim()===t,
    expected,{timeout:12000});
   assert.equal(await modal.locator('h2').textContent(),expected,'hosted step locale '+lang+'/'+step);
   assert.equal(await modal.getAttribute('aria-modal'),'true');
   assert.equal(await modal.getAttribute('role'),'dialog');
   if(step<3)await p.locator('[data-tour-next]').click();
  }
  await p.locator('[data-tour-back]').click();
  await p.waitForFunction(t=>document.querySelector('[data-typed-tour-dialog] h2')?.textContent?.trim()===t,
   presetsMyTourCopy(lang).steps[2].title,{timeout:12000});
  await p.locator('[data-tour-next]').click();
  await p.locator('[data-tour-finish]').click();
  await modal.waitFor({state:'detached',timeout:12000});
  assert.equal(await help.evaluate(el=>el===document.activeElement),true,
   'hosted Finish did not restore initiating ? focus '+lang);
  if(lang==='ja'){
   await help.click();
   await modal.waitFor({state:'visible',timeout:12000});
   await p.locator('[data-tour-skip]').click();
   await modal.waitFor({state:'detached',timeout:12000});
   assert.equal(await help.evaluate(el=>el===document.activeElement),true,
    'hosted Skip did not restore initiating ? focus '+lang);
  }
  console.log('QRW_HOSTED_LOCALE_4STEP_BACK_FINISH_FOCUS_PASS '+lang);
 }
 // Real first-party theme button is operated while Tour is closed to avoid overlay
 // intercept; a new Tour is opened under that selection to confirm colors.
 await p.locator('#site-locale').selectOption('en');
 const themeButton=p.locator('.toolbar-globals button.theme-button');
 const previousTheme=await p.evaluate(()=>document.documentElement.dataset.theme);
 await themeButton.click();
 await p.waitForFunction(prior=>document.documentElement.dataset.theme!==prior,previousTheme);
 const selectedTheme=await p.evaluate(()=>document.documentElement.dataset.theme);
 await p.locator('[data-tour-launch="desktop"]').click();
 await modal.waitFor({state:'visible',timeout:12000});
 assert.equal(await modal.evaluate(el=>getComputedStyle(el).color!=='rgba(0, 0, 0, 0)'),true,
  'modal color not computed in selected hosted theme');
 assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),selectedTheme);
 await p.locator('[data-tour-skip]').click();
 await modal.waitFor({state:'detached',timeout:12000});
 console.log('QRW_HOSTED_8LOCALE_4STEP_THEME_KEYBOARD_FOCUS_FINISH_SKIP_PASS');


 const audit=await getAudit();
 assert.deepEqual([audit.dbOpen,audit.dbDelete],[0,0],
  'geometry correction unexpectedly accesses IndexedDB');
 assert.deepEqual(network.slice(networkBaseline),[],'unexpected nonGET/off-HTTPS-origin request after entering manual Tour');
 assert.deepEqual(errors.slice(errorsBaseline),[],'new uncaught JS error during hosted Tour');
 assert.deepEqual(downloads,[],'Tour triggered a browser download');
 const forbiddenWrites=audit.storageWrites.filter(([action,key])=>
  action==='clear'||!['dreamwishwand-locale-manual-v1','dreamwishwand-theme'].includes(key));
 assert.deepEqual(forbiddenWrites,[],'hosted Tour changed Scene/Moodboard/Save/Backup or unrelated Storage');
 console.log('QRW_HOSTED_READ_ONLY_NO_IDB_NO_STORAGE_BACKUP_NO_UPLOAD_PASS '+JSON.stringify({
   idb:[audit.dbOpen,audit.dbDelete],unexpectedRequests:network.length-networkBaseline,
   forbiddenWrites:forbiddenWrites.length,downloads:downloads.length
 }));
 console.log('QRW_HOSTED_INDEPENDENT_PHYSICAL_RECT_READINGS '+JSON.stringify(readings));
 console.log('QRW_HOSTED_INDEPENDENT_GEOMETRY_VIOLATIONS '+JSON.stringify(anomalies));
 assert.deepEqual(anomalies,[],'independent new Source CSS geometry TRUE_RED');
 console.log('QRW_HOSTED_INDEPENDENT_CHANGED_SCOPE_SCOPED_PASS',
  JSON.stringify({deployedMain:MAIN,hostedOrigin:origin,qaOnly:true,zoom4:true,scrollResize:true,
   rootZoomWithoutEvents:true,finiteRaf:true,writer:false,cloud:false}));
}finally{await ctx.close();await browser.close();}
