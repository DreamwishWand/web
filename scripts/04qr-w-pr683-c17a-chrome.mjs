// Independent 04 QR-W NEW_ONLY Chrome Q03, PR683 fixed Source c17a.
// Synthetic packaged bytes only; no private P1G, Native operation, or Cloud.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';

if(!process.env.CHROME_BIN)throw Error('QR683_C17A_CHROME_REQUIRED');
const origin=(process.env.QR683_C17A_URL??'http://127.0.0.1:4299').replace(/\/$/,'');
const makeProfile=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Other:{opaque:true}},
 World:{
  Villages:[{Areas:{'1':{GridIDs:[10]}}},{Areas:{'2':{GridIDs:[20]}}}],
  GridCollection:{Grids:{'10':{ID:10,Objects:{'100':{State:{}}}},'20':{ID:20,Objects:{'200':{State:{}}}}}}
 },FutureRoot:{opaque:[1,2,3]}
});
const bytes=p=>Buffer.from(makeSyntheticP1gProfile(p));
const valid=bytes(makeProfile()),validHash=createHash('sha256').update(valid).digest('hex');
const missing=makeProfile();
delete missing.World.Villages[1].Areas;
delete missing.World.GridCollection.Grids['20'].Objects;
const empty=makeProfile();
for(const v of empty.World.Villages)v.Areas={};
for(const g of Object.values(empty.World.GridCollection.Grids))g.Objects={};

const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:false,serviceWorkers:'block'});
const page=await ctx.newPage(),errors=[],offsiteOrWrite=[],websockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>websockets.push(w.url()));
ctx.on('request',r=>{if(r.method()!=='GET'||new URL(r.url()).origin!==origin)offsiteOrWrite.push(r.method()+' '+r.url());});
const panel=page.locator('[data-wep-626-readonly]');
const shell=page.locator('.save-source-browser[data-wep-source-epoch]');
const fileInput=page.locator('.load-panel input[type=file]');
async function upload(name,p){await fileInput.setInputFiles({name,mimeType:'application/octet-stream',buffer:bytes(p)});}
async function epoch(){
 const str=await shell.getAttribute('data-wep-source-epoch');
 const n=Number(str);
 assert.ok(str!==null&&Number.isSafeInteger(n)&&n>0,'committed source epoch');
 return n;
}
async function fresh(previous){
 await page.waitForFunction(prev=>{
  const e=document.querySelector('.save-source-browser[data-wep-source-epoch]');
  const n=Number(e?.getAttribute('data-wep-source-epoch'));
  return !!e&&Number.isSafeInteger(n)&&n>prev;
 },previous,{timeout:20000});
 await panel.waitFor({state:'visible',timeout:15000});
 return epoch();
}
async function counts(area,objects){
 assert.equal((await panel.locator('dl dd').nth(1).innerText()).trim(),area,'area');
 assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),objects,'objects');
 assert.equal(await page.locator('.editor-shell').count(),0,'no Canvas/Editor');
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0,'no edited export');
 assert.equal(await page.locator('.area-route-list').count(),0,'no invented native routes');
 const text=await page.locator('[data-wep-steam626-limited]').innerText();
 assert.match(text,/productionReadAccepted=false/);
 assert.match(text,/exactBuildKnown=false/);
}
async function noReceipt(){
 await shell.waitFor({state:'hidden',timeout:15000});
 assert.equal(await panel.count(),0);
}
const settle=async()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const fit=async(name)=>{const r=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));assert.ok(r.s<=r.w+2,name+JSON.stringify(r));};
try{
 await page.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:30000});
 await page.locator('.platform-select select').selectOption('steam-windows');
 await upload('initial-synthetic.p1g',makeProfile());
 await panel.waitFor({state:'visible',timeout:20000});
 let current=await epoch();
 await counts('2','2');
 const malformed=makeProfile();
 malformed.World.Villages[1].Areas=[];
 malformed.World.GridCollection.Grids['20'].Objects=null;
 await upload('later-missing.p1g',missing);
 current=await fresh(current);
 await counts('UNKNOWN','UNKNOWN');
 await upload('later-malformed.p1g',malformed);
 current=await fresh(current);
 await counts('UNKNOWN','UNKNOWN');
 await upload('explicit-empty.p1g',empty);
 current=await fresh(current);
 await counts('0','0');
 console.log('QR683_C17A_CHROME_MISSING_MALFORMED_UNKNOWN_EMPTY_ZERO_COMMITTED_PASS');

 // Hold selected local File.arrayBuffer for explicit names. Never change original bytes.
 await page.evaluate(()=>{
  const original=File.prototype.arrayBuffer;
  window.__qrC17A=Object.create(null);
  File.prototype.arrayBuffer=function(...args){
   if(!this.name.startsWith('qr-hold-'))return original.apply(this,args);
   const name=this.name,selected=this;
   const hook={state:'held'};
   window.__qrC17A[name]=hook;
   return new Promise((resolve,reject)=>{
    hook.release=(fail=false)=>{
     if(fail){
      hook.state='rejected';
      reject(Error('QR obsolete synthetic rejection'));
      return;
     }
     original.apply(selected,args).then(result=>{
      hook.state='delivered';
      resolve(result);
     },reject);
    };
   });
  };
 });
 const held=async name=>page.waitForFunction(n=>window.__qrC17A?.[n]?.state==='held',name,{timeout:15000});
 const release=async (name,fail=false)=>{
  await page.evaluate(({n,f})=>window.__qrC17A[n].release(f),{n:name,f:fail});
  await page.waitForFunction(({n,failed})=>window.__qrC17A?.[n]?.state===(failed?'rejected':'delivered'),{n:name,failed:fail},{timeout:15000});
  await settle();
 };

 // Q03-A: A old held, B commits newer missing; release A empty -> B UNKNOWN forever.
 let before=current;
 await upload('qr-hold-old-a.p1g',empty);
 await held('qr-hold-old-a.p1g');
 await noReceipt();
 await upload('qr-new-b.p1g',missing);
 current=await fresh(before);
 await counts('UNKNOWN','UNKNOWN');
 const committed=current;
 await release('qr-hold-old-a.p1g');
 assert.equal(await epoch(),committed,'older success may not advance newer receipt');
 await counts('UNKNOWN','UNKNOWN');
 assert.equal((await page.locator('.save-source-heading dd').first().innerText()).trim(),'qr-new-b.p1g','newer file identity retained');
 console.log('QR683_C17A_CHROME_OLD_SUCCESS_AFTER_NEW_COMMIT_IGNORED_PASS');

 // Q03-B: A old held, B newer also held; release A, no previous value or clearing B pending input.
 before=current;
 await upload('qr-hold-old-a2.p1g',empty);
 await held('qr-hold-old-a2.p1g');
 await upload('qr-hold-new-b2.p1g',missing);
 await held('qr-hold-new-b2.p1g');
 await noReceipt();
 await release('qr-hold-old-a2.p1g');
 await noReceipt();
 assert.equal(await fileInput.evaluate(e=>e.files?.[0]?.name),'qr-hold-new-b2.p1g','older finally must not clear selected pending input');
 await release('qr-hold-new-b2.p1g');
 current=await fresh(before);
 await counts('UNKNOWN','UNKNOWN');
 console.log('QR683_C17A_CHROME_OLDER_SETTLES_WHILE_NEWER_WAITING_NO_STALE_UI_OR_INPUT_CLEAR_PASS');

 // Q03-C: A old rejects after B new committed. catch/finally must not clear B or show obsolete error.
 before=current;
 await upload('qr-hold-old-error.p1g',empty);
 await held('qr-hold-old-error.p1g');
 await noReceipt();
 await upload('qr-new-after-error.p1g',missing);
 current=await fresh(before);
 await counts('UNKNOWN','UNKNOWN');
 await release('qr-hold-old-error.p1g',true);
 await counts('UNKNOWN','UNKNOWN');
 assert.equal(await epoch(),current,'stale error cannot revoke latest source');
 assert.equal(await page.getByText('QR obsolete synthetic rejection').count(),0,'stale error not shown');
 console.log('QR683_C17A_CHROME_STALE_REJECTION_CATCH_FINALLY_NO_NEWER_STATE_DAMAGE_PASS');

 // Q03-D: local language/zoom/keyboard; no positive Steam build attestation.
 const settings=page.locator('[data-shared-app-shell][data-shell-presentation="immersive"] button.immersive-settings');
 await settings.focus();
 await page.keyboard.press('Enter');
 const locale=page.locator('#site-locale-mobile');
 await locale.waitFor({state:'visible'});
 for(const id of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await locale.selectOption(id);
  await page.waitForFunction(x=>document.documentElement.lang===x,id);
  await counts('UNKNOWN','UNKNOWN');
 }
 await locale.selectOption('en');
 await page.keyboard.press('Escape');
 await locale.waitFor({state:'hidden'});
 await page.setViewportSize({width:320,height:760});
 await fit('320px');
 await page.setViewportSize({width:640,height:760});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('200%');
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 console.log('QR683_C17A_CHROME_8LOCALE_320_ZOOM200_KEYBOARD_PASS');

 await page.locator('.platform-select select').selectOption('unknown');
 await fileInput.setInputFiles({name:'qr-unknown.p1g',mimeType:'application/octet-stream',buffer:valid});
 await page.getByText(/Source verification required/).waitFor({timeout:20000});
 assert.equal(await panel.count(),0,'unknown platform must not reuse Steam');
 assert.equal(await shell.count(),0);
 assert.equal(createHash('sha256').update(valid).digest('hex'),validHash,'source bytes unchanged');
 assert.deepEqual(offsiteOrWrite,[],'no POST, network API or cross-origin fetch');
 assert.deepEqual(websockets.filter(u=>!/^ws:\/\/127\.0\.0\.1:4299\/\?token=[A-Za-z0-9_-]+$/.test(u)),[],'no external Provider/Cloud WebSocket; only known local Vite HMR allowed');
 assert.deepEqual(errors,[],'no browser JS errors');
 console.log('QR683_C17A_CHROME_FORGED_PLATFORM_NO_POST_WS_OR_ERRORS_PASS');
}finally{await ctx.close();await browser.close();}
console.log('QR683_C17A_INDEPENDENT_LOCAL_CHROME_PASS');