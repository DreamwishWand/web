// 04QR main a6c postmerge actual Chromium cross-product smoke, no Save input.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const base='http://127.0.0.1:4209',exe=process.env.CHROME_BIN;assert.ok(exe);
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
const page=await context.newPage(),bad=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',r=>{
 const url=new URL(r.url());
 if(url.origin!==base||r.method()!=='GET')bad.push(r.method()+' '+url.origin);
});
const mark=s=>console.log('QR_MAIN_A6C_'+s+'_PASS');
try{
 await page.goto(base+'/editor/items/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-shared-discovery]').waitFor({timeout:28000});
 assert.equal(await page.locator('.local-capability').count(),0,'PR416 not merged into current main, no personal client capability implied');
 mark('ITEM_CATALOG_NO_UNMERGED_PERSONAL_UI');
 await page.goto(base+'/editor/timing/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-timing-readonly="true"]').waitFor({timeout:28000});
 assert.equal(await page.locator('[data-w1-original-backup]').count(),0,'no loaded original');
 mark('SINGLE_W1_READER_HAS_NO_AUTOMATIC_ORIGINAL_BACKUP');
 await page.goto(base+'/presets/',{waitUntil:'networkidle'});
 await page.locator('.preset-tabs button').last().waitFor();
 // Wait for Svelte event hydration; the first click before hydration is inert.
 await page.waitForTimeout(450);
 await page.locator('.preset-tabs button').last().click();
 const panel=page.locator('.native-manager');await panel.waitFor({timeout:28000});
 assert.equal(await panel.locator('.local-library .backup-grid article').count(),0);
 await panel.locator('.library-actions input[type=file]').setInputFiles({name:'unsupported.tom.json',
  mimeType:'application/json',buffer:Buffer.from('{"schema":"wand.tom-native-backup@1","version":1}')});
 await panel.locator('[role=status]').waitFor({timeout:20000});
 assert.equal(await panel.locator('.local-library .backup-grid article').count(),0);
 mark('LOCAL_PRESET_TOM_REJECTS_WITHOUT_P1G_WRITE');
 await page.goto(base+'/editor/world/',{waitUntil:'domcontentloaded'});
 await page.locator('.load-panel input[type=file]').waitFor({timeout:28000});
 assert.equal(await page.locator('.load-panel input[type=file]').count()>0,true);
 await page.setViewportSize({width:320,height:760});
 assert.deepEqual(errors,[]);
 assert.deepEqual(bad,[]);
 mark('WORLD_EDITOR_UNLOADED_NO_UPLOAD_NO_BROWSER_ERRORS');
 console.log('QR_MAIN_A6C_POST_MERGE_ACTUAL_CHROMIUM_COMPOSITE_TARGETED_PASS');
}finally{await context.close();await browser.close();}
