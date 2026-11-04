// 04 QR PR422 actual Chromium composed current main Local Native Preset branch.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const base='http://127.0.0.1:4207',exe=process.env.CHROME_BIN;
assert.ok(exe,'Actual system Chrome required');
const browser=await chromium.launch({headless:true,executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
const page=await ctx.newPage(),errors=[],unsafe=[];
page.on('pageerror',e=>errors.push(String(e)));
ctx.on('request',r=>{
 const u=new URL(r.url());
 if(r.method()!=='GET'||u.origin!==base)unsafe.push(r.method()+' '+u.origin);
});
const mark=s=>console.log('QR_422_'+s+'_PASS');
try{
 await page.goto(base+'/presets/',{waitUntil:'networkidle'});
 await page.locator('.preset-tabs button').last().click();
 const manager=page.locator('.native-manager');
 await manager.waitFor({timeout:25000});
 assert.equal(await manager.locator('.local-library .backup-grid article').count(),0);
 const input=manager.locator('.library-actions input[type=file]');
 await input.setInputFiles({name:'invalid-native-backup.json',mimeType:'application/json',
  buffer:Buffer.from('{"schema":"wand.tom-native-backup@1","version":1}')});
 await manager.locator('[role=status]').waitFor({timeout:15000});
 assert.equal(await manager.locator('.local-library .backup-grid article').count(),0,
  'Rejected ToM JSON must not populate local collection library');
 mark('REAL_CHROME_UNKNOWN_TOM_BACKUP_REJECTS_WITH_NO_MUTATION');
 await input.setInputFiles({name:'prototype.json',mimeType:'application/json',
  buffer:Buffer.from('{"__proto__":{"polluted":true},"schema":"wand.in-game-preset-backup@1"}')});
 await manager.locator('[role=status]').waitFor({timeout:15000});
 assert.equal(await manager.locator('.local-library .backup-grid article').count(),0);
 assert.equal(await page.evaluate(()=>({}).polluted),undefined);
 mark('REAL_CHROME_PROTO_POLLUTION_LOCAL_IMPORT_DENIED');
 await page.setViewportSize({width:320,height:740});
 const size=await page.evaluate(()=>({body:document.documentElement.scrollWidth,view:document.documentElement.clientWidth}));
 assert.ok(size.body<=size.view+2,JSON.stringify(size));
 assert.deepEqual(unsafe,[]);
 assert.deepEqual(errors,[]);
 mark('REAL_CHROME_MOBILE_320_NO_UPLOAD_EXCEPTION');
 console.log('QR_422_INDEPENDENT_SYNTHETIC_LOCAL_CHROME_MAIN_PRESET_SMOKE_PASS');
} finally {await ctx.close();await browser.close();}
