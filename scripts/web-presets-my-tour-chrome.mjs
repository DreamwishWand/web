// Real installed Chrome smoke for 08 WEB first Pilot; dependency-free DevTools.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {presetsMyTourCopy,PRESETS_MY_TOUR_LOCALES} from '../src/lib/tour/presets-my-tour-copy.mjs';
import {PRESETS_MY_WAND_TOUR} from '../src/lib/tour/typed-tour-contract.mjs';
const HOST='http://127.0.0.1:4398';
const chrome=process.env.CHROME_BIN ||
 ['google-chrome-stable','google-chrome','chromium','chromium-browser'].map(x=>
  spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);
assert.ok(chrome&&existsSync(chrome),'real installed Chrome required; no synthetic PASS');
assert.equal(typeof WebSocket,'function','Node >=22 native CDP WebSocket required');
const workspace=mkdtempSync(join(tmpdir(),'wand-tour-chrome-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
 '--port','4398','--strictPort'],{
 cwd:process.cwd(),env:{...process.env,BASE_PATH:''},stdio:['ignore','pipe','pipe']
});
let viteOutput='';
for(const io of [vite.stdout,vite.stderr])io.on('data',b=>viteOutput+=String(b).slice(0,1500));
const browser=spawn(chrome,['--headless=new','--disable-gpu','--no-sandbox',
 '--disable-dev-shm-usage','--remote-debugging-port=0','--no-first-run',
 '--no-default-browser-check','--user-data-dir='+workspace,'about:blank'],
 {stdio:['ignore','pipe','pipe']});
let browserOutput='',webSocketURL='';
browser.stderr.on('data',data=>{
 browserOutput+=String(data).slice(0,1000);
 const found=browserOutput.match(/DevTools listening on (ws:\/\/[^\s]+)/);
 if(found)webSocketURL=found[1];
});
const ready=async(expr,timeout=18000)=>{
 const start=Date.now();
 while(Date.now()-start<timeout){
  try{if(await expr())return;}catch{}
  await sleep(110);
 }
 throw Error('CHROME_TIMEOUT '+String(expr).slice(0,100));
};
let socket=null;
let serial=0;
const pending=new Map();
let sessionId=null;
const requests=[];
const exceptions=[];
async function connect(){
 await ready(()=>Boolean(webSocketURL),15000);
 socket=new WebSocket(webSocketURL);
 await new Promise((resolve,reject)=>{
  socket.addEventListener('open',resolve,{once:true});
  socket.addEventListener('error',reject,{once:true});
 });
 socket.addEventListener('message',e=>{
  const event=JSON.parse(String(e.data));
  if(event.id&&pending.has(event.id)){
   const p=pending.get(event.id);pending.delete(event.id);
   event.error?p.reject(Error(JSON.stringify(event.error))):p.resolve(event.result||{});
  }
  if(event.method==='Network.requestWillBeSent'){
   const x=event.params?.request||{};
   if(x.method!=='GET'&&x.method!=='HEAD')requests.push(x.method+' '+x.url);
   if(x.url?.startsWith('http')&&!x.url.startsWith(HOST))requests.push('OFFORIGIN '+x.url);
  }
  if(event.method==='Runtime.exceptionThrown'){
   exceptions.push(event.params?.exceptionDetails?.text||'unknown chrome exception');
  }
 });
}
function send(method,params={},session=sessionId){
 const id=++serial;
 return new Promise((resolve,reject)=>{
  pending.set(id,{resolve,reject});
  socket.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}));
 });
}
async function evalJs(expression){
 const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,
  userGesture:true});
 if(r.exceptionDetails)throw Error('CHROME_JS '+JSON.stringify(r.exceptionDetails).slice(0,800));
 return r.result?.value;
}
const q=(js)=>evalJs('(()=>{'+js+'})()');
const until=async(js,ms=13000)=>ready(async()=>Boolean(await q(js)),ms);
const tap=async(selector)=>{
 const ok=await q("const e=document.querySelector("+JSON.stringify(selector)+");if(!e)return false;e.click();return true;");
 assert.equal(ok,true,'not found '+selector);
};
try{
 await ready(async()=>{
  if(vite.exitCode!==null)throw Error('VITE_EARLY_EXIT '+viteOutput);
  return (await fetch(HOST+'/presets/')).ok;
 },20000);
 await connect();
 const target=await send('Target.createTarget',{url:HOST+'/presets/'},null);
 const attach=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null);
 sessionId=attach.sessionId;
 await send('Runtime.enable');
 await send('Page.enable');
 await send('Network.enable');
 // Headless Chrome defaults to an ~800px mobile breakpoint viewport. Explicitly
 // exercise a REAL desktop-sized viewport before expecting desktop focus.
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,
  deviceScaleFactor:1,mobile:false});
 await until("return document.querySelector('[data-stage1-presets-four-cards]')&&document.querySelector('[data-tour-launch=desktop]')",25000);
 const launchLayout=await q("const a=document.querySelector('[data-tour-launch=desktop]'),b=document.querySelector('[data-tour-launch=mobile]');return {desktop:a.getClientRects().length>0,mobile:b.getClientRects().length>0,vw:innerWidth}");
 assert.equal(launchLayout.desktop,true,'desktop help must be visible for desktop phase');
 assert.equal(launchLayout.mobile,false,'mobile button must not be the desktop focus target');
 await sleep(1400);
 assert.equal(await q("return Boolean(document.querySelector('[data-typed-tour-open]'))"),false,'no first visit auto');
 assert.equal(await evalJs("indexedDB.databases().then(a=>a.length)"),0,'render does not open IDB');
 for(let attempt=0;attempt<8;attempt++){
  await tap('[data-tour-launch="desktop"]');
  await sleep(250);
  if(await q("return (document.querySelector('[data-tour-status]')?.textContent?.trim()?.length||0)>5"))break;
 }
 console.log('WEB_TOUR_ROOT_DIAGNOSTIC '+JSON.stringify(await q("return {path:location.pathname,locale:document.documentElement.dataset.locale,header:!!document.querySelector('[data-tour-launch=desktop]'),notice:document.querySelector('[data-tour-status]')?.textContent?.trim(),root:!!document.querySelector('[data-preset-child=my]')}")));
 await until("return (document.querySelector('[data-tour-status]')?.textContent?.trim()?.length||0)>5");
 const unavailable=await q("return document.querySelector('[data-tour-status]')?.textContent?.trim()");
 assert.ok(unavailable.length>5);
 assert.equal(await q("return Boolean(document.querySelector('[data-typed-tour-open]'))"),false,'wrong view fails closed');
 await tap('[data-preset-child="my"]');
 await until("return document.querySelector('[data-my-local-scenes]')&&document.querySelector('[data-my-wand-views]')");
 await tap('[data-tour-launch="desktop"]');
 await until("return Boolean(document.querySelector('[data-tour-next]'))");
 const initial=await q("const e=document.querySelector('[data-typed-tour-dialog]');return {role:e.getAttribute('role'),modal:e.getAttribute('aria-modal'),focused:e===document.activeElement,step:e.querySelector('h2')?.textContent,rect:e.getBoundingClientRect().toJSON()}");
 assert.equal(initial.role,'dialog');
 assert.equal(initial.modal,'true');
 assert.equal(initial.focused,true);
 assert.equal(initial.step,presetsMyTourCopy('en').steps[0].title);
 console.log('WEB_TOUR_REAL_CHROME_MANUAL_ONLY_4_ANCHORS_FOCUS_PASS');
 console.log('WEB_TOUR_DIAG_BEFORE_THEME '+JSON.stringify(await q("const d=document.querySelector('[data-typed-tour-dialog]');return {title:d?.querySelector('h2')?.textContent,visible:!!d}")));
 const night=await q("return getComputedStyle(document.querySelector('[data-typed-tour-dialog]')).backgroundColor");
 await q("document.documentElement.dataset.theme='day';return true");
 const day=await q("return getComputedStyle(document.querySelector('[data-typed-tour-dialog]')).backgroundColor");
 assert.notEqual(night,day,'live semantic day/night contrast');
 await q("document.documentElement.dataset.theme='night';return true");
 for(let i=1;i<4;i++){
  console.log('WEB_TOUR_DIAG_STEP_BEFORE '+i+' '+JSON.stringify(await q("const d=document.querySelector('[data-typed-tour-dialog]');return {title:d?.querySelector('h2')?.textContent,hasNext:!!document.querySelector('[data-tour-next]'),notice:document.querySelector('[data-tour-status]')?.textContent?.trim()}")));
  await tap('[data-tour-next]');
  await sleep(140);
  console.log('WEB_TOUR_DIAG_STEP_AFTER '+i+' '+JSON.stringify(await q("const d=document.querySelector('[data-typed-tour-dialog]');return {title:d?.querySelector('h2')?.textContent,hasNext:!!document.querySelector('[data-tour-next]'),notice:document.querySelector('[data-tour-status]')?.textContent?.trim()}")));
  await until("return document.querySelector('[data-typed-tour-dialog]')?.querySelector('h2')?.textContent==="+JSON.stringify(presetsMyTourCopy('en').steps[i].title));
  const n=await q("return document.querySelector('[data-typed-tour-dialog]')?.querySelector('h2')?.textContent");
  assert.equal(n,presetsMyTourCopy('en').steps[i].title);
 }
 console.log('WEB_TOUR_DIAG_AFTER_ALL_FOUR '+JSON.stringify(await q("return {title:document.querySelector('[data-typed-tour-dialog] h2')?.textContent,hasBack:!!document.querySelector('[data-tour-back]')}")));
 await tap('[data-tour-back]');
 console.log('WEB_TOUR_DIAG_AFTER_BACK '+JSON.stringify(await q("return {title:document.querySelector('[data-typed-tour-dialog] h2')?.textContent,hasNext:!!document.querySelector('[data-tour-next]')}")));
 await until("return document.querySelector('[data-tour-next]')?.textContent?.trim()==="+JSON.stringify(presetsMyTourCopy('en').next));
 assert.equal(await q("return Boolean(document.querySelector('[data-typed-tour-open]'))"),true);
 await tap('[data-tour-next]');
 console.log('WEB_TOUR_DIAG_BEFORE_FINISH '+JSON.stringify(await q("return {title:document.querySelector('[data-typed-tour-dialog] h2')?.textContent,hasFinish:!!document.querySelector('[data-tour-finish]')}")));
 await tap('[data-tour-finish]');
 console.log('WEB_TOUR_DIAG_AFTER_FINISH '+JSON.stringify(await q("return {open:!!document.querySelector('[data-typed-tour-open]'),focused:document.activeElement?.getAttribute('data-tour-launch')}")));
 await until("return !document.querySelector('[data-typed-tour-open]')");
 await until("return document.activeElement?.getAttribute('data-tour-launch')==='desktop'");
 assert.equal(await q("return document.activeElement?.getAttribute('data-tour-launch')"),'desktop');
 assert.equal(await evalJs("indexedDB.databases().then(a=>a.length)"),0,'tour cannot open Scene IDB');
 assert.equal(await q("return sessionStorage.length"),0,'no session persistence');
 console.log('WEB_TOUR_REAL_CHROME_NEXT_BACK_FINISH_THEME_READONLY_NO_IDB_PASS');
 console.log('WEB_TOUR_DIAG_BEFORE_LOCALES');
 for(const locale of PRESETS_MY_TOUR_LOCALES){
  console.log('WEB_TOUR_DIAG_LOCALE_BEGIN '+locale);
  const sel=await q("const e=document.querySelector('#site-locale');if(!e)return false;e.value="+JSON.stringify(locale)+";e.dispatchEvent(new Event('change',{bubbles:true}));return true;");
  assert.equal(sel,true);
  await until("return document.documentElement.dataset.locale==="+JSON.stringify(locale));
  await tap('[data-tour-launch="desktop"]');
  await until("return document.querySelector('[data-typed-tour-dialog]')?.querySelector('h2')?.textContent==="+JSON.stringify(presetsMyTourCopy(locale).steps[0].title));
  await tap('[data-tour-skip]');
  await until("return !document.querySelector('[data-typed-tour-open]')");
 }
 console.log('WEB_TOUR_REAL_CHROME_EIGHT_LOCALE_SKIP_REPLAY_PASS');
 console.log('WEB_TOUR_DIAG_AFTER_LOCALES');
 // Responsive narrow CSS viewport then CSS equivalent 200% zoom.
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:780,
  deviceScaleFactor:1,mobile:true});
 await until("return Boolean(document.querySelector('[data-tour-launch=mobile]'))");
 await tap('[data-tour-launch="mobile"]');
 await until("return Boolean(document.querySelector('[data-typed-tour-dialog]'))");
 const width=await q("const e=document.querySelector('[data-typed-tour-dialog]').getBoundingClientRect();return {right:e.right,left:e.left,vw:innerWidth}");
 assert.ok(width.right<=width.vw+1&&width.left>=0,'320px dialog fully visible');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.equal(await q("return matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until("return !document.querySelector('[data-typed-tour-open]')");
 await send('Emulation.setDeviceMetricsOverride',{width:640,height:800,deviceScaleFactor:1,mobile:false});
 await q("document.documentElement.style.zoom='2';return true");
 await tap('[data-tour-launch="mobile"]');
 await until("return Boolean(document.querySelector('[data-typed-tour-dialog]'))");
 // The independent QR-W run caught a real 660px rendered dialog in a
 // 640px root-zoom2 viewport. Measure actual rendered DOMRects, not CSS width.
 const assertZoomBounds=async(step,phase)=>{
  const selector=PRESETS_MY_WAND_TOUR.steps[step].target;
  const m=await q("const d=document.querySelector('[data-typed-tour-dialog]'),s=document.querySelector('[data-typed-tour-highlight]'),t=document.querySelector("+JSON.stringify(selector)+");if(!d||!s||!t)return null;const a=d.getBoundingClientRect(),b=s.getBoundingClientRect(),c=t.getBoundingClientRect();return {vw:innerWidth,vh:innerHeight,dialog:{left:a.left,right:a.right,top:a.top,bottom:a.bottom},spot:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},target:{left:c.left,right:c.right,top:c.top,bottom:c.bottom},zoom:getComputedStyle(document.documentElement).zoom};");
  assert.ok(m,'CSS200 '+phase+' missing dialog, spotlight or anchor');
  for(const name of ['dialog','spot']){
   const r=m[name];
   assert.ok(r.left>=-1&&r.right<=m.vw+1&&r.top>=-1&&r.bottom<=m.vh+1,
    'CSS200 '+phase+' '+name+' out of viewport '+JSON.stringify(m));
  }
  const intersectionWidth=Math.min(m.spot.right,m.target.right)-Math.max(m.spot.left,m.target.left);
  const intersectionHeight=Math.min(m.spot.bottom,m.target.bottom)-Math.max(m.spot.top,m.target.top);
  assert.ok(m.target.right>0&&m.target.left<m.vw&&
   m.target.bottom>0&&m.target.top<m.vh,
   'CSS200 '+phase+' real anchor offscreen '+JSON.stringify(m));
  assert.ok(intersectionWidth>0&&intersectionHeight>0,
   'CSS200 '+phase+' spotlight missed target '+JSON.stringify(m));
 };
 await assertZoomBounds(0,'first');
 for(let step=1;step<PRESETS_MY_WAND_TOUR.steps.length;step++){
  await tap('[data-tour-next]');
  await until("return document.querySelector('[data-typed-tour-dialog] h2')?.textContent==="+JSON.stringify(presetsMyTourCopy(PRESETS_MY_TOUR_LOCALES.at(-1)).steps[step].title));
  await sleep(130);
  await assertZoomBounds(step,'step-'+step);
 }
 await q("window.scrollBy(0,80);return true");
 await sleep(130);
 await assertZoomBounds(3,'scroll');
 await send('Emulation.setDeviceMetricsOverride',{width:620,height:780,
  deviceScaleFactor:1,mobile:false});
 await sleep(240);
 await assertZoomBounds(3,'resize-620');
 await send('Emulation.setDeviceMetricsOverride',{width:700,height:840,
  deviceScaleFactor:1,mobile:false});
 await sleep(240);
 await assertZoomBounds(3,'resize-700');
 await send('Emulation.setDeviceMetricsOverride',{width:640,height:800,
  deviceScaleFactor:1,mobile:false});
 await sleep(240);
 await assertZoomBounds(3,'resize-restore');
 // Regression from independent QA #890: preserve scroll history and change
 // from zoom200/640px to zoom100/320px without ending the current Tour.
 await q("document.documentElement.style.zoom='1';return true");
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,
  deviceScaleFactor:1,mobile:true});
 await sleep(270);
 await assertZoomBounds(3,'320-after-css200-scroll-resize');
 await tap('[data-tour-skip]');
 await until("return !document.querySelector('[data-typed-tour-open]')");
 console.log('WEB_TOUR_REAL_CHROME_320_ZOOM200_REDUCED_MOTION_ESCAPE_PASS');
 // Invalid/expired anchors fail closed without auto-navigation or data IO.
 await q("document.querySelector('[data-device-scenes-reopen]')?.remove();return true");
 await tap('[data-tour-launch="mobile"]');
 assert.equal(await q("return Boolean(document.querySelector('[data-typed-tour-open]'))"),false);
 assert.ok((await q("return document.querySelector('[data-tour-status]')?.textContent?.length"))>4);
 assert.deepEqual(requests,[],'no external/mutation requests');
 assert.deepEqual(exceptions,[],'no uncaught page JS errors');
 console.log('WEB_TOUR_REAL_CHROME_INVALID_ANCHOR_FAILCLOSED_NO_POST_PASS');
 console.log('WEB_TOUR_INSTALLED_CHROME_FINAL_PASS');
}finally{
 for(const p of pending.values())p.reject?.(Error('cleanup'));
 try{socket?.close();}catch{}
 browser.kill('SIGKILL');
 vite.kill('SIGKILL');
 await sleep(450);
 try{rmSync(workspace,{recursive:true,force:true,maxRetries:12,retryDelay:125});}
 catch(error){console.error('WEB_TOUR_CHROME_CLEANUP_RETAINED_TEMP_NO_USER_DATA',String(error));}
}
