// 04 QR-W NEW_ONLY actual installed Chrome for repaired PR683 bd5ba source.
// All profiles are generated synthetic fixtures; never use a genuine user P1G or account.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';

if(!process.env.CHROME_BIN)throw Error('QR683_CHROME_BIN_REQUIRED');
const origin=(process.env.QR683_BASE_URL??'http://127.0.0.1:4298').replace(/\/$/,'');
const profile=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{OpaquePlayer:{keep:true}},
 World:{
  Villages:[
   {Areas:{'1':{GridIDs:[10]}}},
   {Areas:{'2':{GridIDs:[20]}}}
  ],
  GridCollection:{Grids:{
   '10':{ID:10,Objects:{'100':{State:{unknown:true}}}},
   '20':{ID:20,Objects:{'200':{State:{unknown:true}}}}
  }}
 },
 FutureRoot:{sha:'synthetic-local'}
});
const make=p=>Buffer.from(makeSyntheticP1gProfile(p));
const initial=make(profile()),digest=createHash('sha256').update(initial).digest('hex');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(String(e)));
ctx.on('request',req=>{if(req.method()!=='GET'||new URL(req.url()).origin!==origin)network.push(req.method()+' '+req.url());});
const panel=page.locator('[data-wep-626-readonly]');
const steam=page.locator('[data-wep-steam626-limited]');
async function upload(buffer,name='qr-synthetic626.p1g'){
 await page.locator('.load-panel input[type="file"]').setInputFiles({name,mimeType:'application/octet-stream',buffer});
}
async function receipt(){
 const str=await page.locator('.save-source-browser[data-wep-source-epoch]').getAttribute('data-wep-source-epoch');
 const n=Number(str);
 assert.ok(str!==null&&Number.isSafeInteger(n)&&n>0,'committed receipt epoch is required');
 return n;
}
async function after(prev){
 await page.waitForFunction(previous=>{
  const current=document.querySelector('.save-source-browser[data-wep-source-epoch]');
  return current&&Number(current.getAttribute('data-wep-source-epoch'))>previous;
 },prev,{timeout:20000});
 await panel.waitFor({state:'visible',timeout:15000});
 const got=await receipt();
 assert.ok(got>prev);
 return got;
}
async function counts(area,objects){
 assert.equal((await panel.locator('dl dd').nth(1).innerText()).trim(),area,'Area count');
 assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),objects,'Objects count');
 assert.equal(await page.locator('[data-wep-steam626-limited]').count(),1);
 assert.equal(await page.locator('.editor-shell').count(),0);
 assert.equal(await page.locator('.area-route-list').count(),0);
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
 assert.match(await steam.innerText(),/productionReadAccepted=false/);
 assert.match(await steam.innerText(),/exactBuildKnown=false/);
}
const fit=async label=>{
 const width=await page.evaluate(()=>({view:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(width.scroll<=width.view+2,label+JSON.stringify(width));
};
try{
 await page.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:30000});
 await page.locator('.platform-select select').selectOption('steam-windows');
 await upload(initial);
 await panel.waitFor({state:'visible',timeout:20000});
 let epoch=await receipt();
 await counts('2','2');

 const missing=profile();
 delete missing.World.Villages[1].Areas;
 delete missing.World.GridCollection.Grids['20'].Objects;
 await upload(make(missing));
 epoch=await after(epoch);
 await counts('UNKNOWN','UNKNOWN');
 console.log('QR683_CHROME_LATER_VILLAGE_GRID_MISSING_GLOBAL_UNKNOWN_PASS');

 const malformed=profile();
 malformed.World.Villages[1].Areas=[];
 malformed.World.GridCollection.Grids['20'].Objects=null;
 await upload(make(malformed));
 epoch=await after(epoch);
 await counts('UNKNOWN','UNKNOWN');
 const empty=profile();
 empty.World.Villages[0].Areas={};
 empty.World.Villages[1].Areas={};
 empty.World.GridCollection.Grids['10'].Objects={};
 empty.World.GridCollection.Grids['20'].Objects={};
 await upload(make(empty));
 epoch=await after(epoch);
 await counts('0','0');
 console.log('QR683_CHROME_MALFORMED_UNKNOWN_EXPLICIT_EMPTY_ZERO_FRESH_EPOCH_PASS');

 // Changed risk: new import MUST revoke previous receipt while async file bytes are unavailable.
 await page.evaluate(()=>{
  const original=File.prototype.arrayBuffer;
  window.__qrHeld={status:'idle'};
  File.prototype.arrayBuffer=function(...args){
   if(this.name!=='qr-held-older.p1g')return original.apply(this,args);
   window.__qrHeld.status='held';
   return new Promise((resolve,reject)=>{
    window.__qrHeld.release=()=>{
     window.__qrHeld.status='released';
     original.apply(this,args).then(resolve,reject);
    };
   });
  };
 });
 const held=profile();
 held.World.Villages[0].Areas={};
 held.World.Villages[1].Areas={};
 held.World.GridCollection.Grids['10'].Objects={};
 held.World.GridCollection.Grids['20'].Objects={};
 const newer=profile();
 delete newer.World.Villages[1].Areas;
 delete newer.World.GridCollection.Grids['20'].Objects;

 await upload(make(held),'qr-held-older.p1g');
 await page.waitForFunction(()=>window.__qrHeld?.status==='held',{timeout:15000});
 await page.locator('.save-source-browser').waitFor({state:'hidden',timeout:15000});
 assert.equal(await panel.count(),0,'pending import revoked previous visible count immediately');
 await upload(make(newer),'qr-newer.p1g');
 epoch=await after(epoch);
 await counts('UNKNOWN','UNKNOWN');
 const epochWhenNewer=await receipt();
 await page.evaluate(()=>window.__qrHeld.release());
 await page.waitForTimeout(1000);
 assert.equal(await receipt(),epochWhenNewer,'older import cannot advance committed receipt');
 await counts('UNKNOWN','UNKNOWN');
 console.log('QR683_CHROME_OVERLAPPING_ASYNC_REIMPORT_OLD_COMPLETION_CANNOT_RESTORE_STALE_COUNT_PASS');

 // Locale/keyboard/zoom changed receipt should still be read-only after stale-source experiment.
 const settings=page.locator('[data-shared-app-shell][data-shell-presentation="immersive"] button.immersive-settings');
 await settings.focus();
 await page.keyboard.press('Enter');
 const locale=page.locator('#site-locale-mobile');
 await locale.waitFor({state:'visible'});
 for(const l of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await locale.selectOption(l);
  await page.waitForFunction(expected=>document.documentElement.lang===expected,l);
  await counts('UNKNOWN','UNKNOWN');
 }
 await locale.selectOption('en');
 await page.keyboard.press('Escape');
 await locale.waitFor({state:'hidden'});
 await page.setViewportSize({width:320,height:740});
 await fit('320px');
 await page.setViewportSize({width:640,height:740});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await fit('200%');
 console.log('QR683_CHROME_8LOCALE_320_ZOOM200_KEYBOARD_SOURCE_BOUNDARY_PASS');

 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.locator('.platform-select select').selectOption('unknown');
 await upload(initial,'qr-unknown-source.p1g');
 await page.getByText(/Source verification required/).waitFor({timeout:20000});
 assert.equal(await panel.count(),0,'unknown source cannot reuse Steam read');
 assert.equal(await page.locator('.save-source-browser').count(),0);
 assert.equal(createHash('sha256').update(initial).digest('hex'),digest,'original synthetic immutable');
 assert.deepEqual(network,[],'no POST / off-origin / cloud');
 assert.deepEqual(errors,[],'no browser errors');
 console.log('QR683_CHROME_FORGED_PLATFORM_REVOKES_SOURCE_NO_NETWORK_PASS');
}finally{await ctx.close();await browser.close();}
console.log('QR683_NEW_ONLY_INDEPENDENT_CHROME_PASS');