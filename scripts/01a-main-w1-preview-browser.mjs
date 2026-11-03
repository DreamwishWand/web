// 01A main-based Browser E2E: SYNTHETIC P1G only; original backup only.
// No game Save, secret/key or edited-profile output is ever uploaded to CI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
if(!process.env.CHROME_BIN)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.WAND_W1_PREVIEW_URL||'http://127.0.0.1:4179').replace(/\/$/,'');
const bid='9A239D3DB569756D';
const profile={
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{Opaque:{important:'keep'}},
 World:{
  Villages:[],GridCollection:{Grids:{}},
  RecurringEvents:{'155':{ItemSpawning:{
    RecurringEventItemID:2010000021,
    NextOccurrence:'2126-08-20T00:00:00Z',
    LastOccurrence:'2026-10-01T00:00:00Z',
    UnknownNative:{preserve:true}
  }}},
  UnknownFuture:{nothingShouldChange:[1,2,3]}
 }
};
const p1g=Buffer.from(makeSyntheticP1gProfile(profile));
const sha=v=>createHash('sha256').update(v).digest('hex');
const before=sha(p1g);
const report={contract:'01a-core-main-w1-ui-preview-browser-synthetic@1',fixture:'SYNTHETIC_ONLY',
 version:'1.25.3',schema:626,bid,checks:[],errors:[],result:'PENDING'};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});
 const page=await ctx.newPage();
 const nonGet=[];
 ctx.on('request',r=>{if(r.method()!=='GET')nonGet.push(r.method());});
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 await page.goto(root+'/editor/timing/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('[data-writer="off"]').count(),1);
 await page.locator('#timing-bid').fill(bid);
 await page.locator('.attest input').check();
 await page.locator('#timing-file').setInputFiles({
  name:'synthetic.p1g',mimeType:'application/octet-stream',buffer:p1g});
 try {
  await Promise.race([
   page.locator('[data-timing-loaded="true"] .event').waitFor({timeout:20000}),
   page.locator('.timing-page [role="alert"]').waitFor({timeout:20000}).then(async()=>{
    throw Error('READ_BROWSER_ALERT:'+await page.locator('.timing-page [role="alert"]').innerText());
   })
  ]);
 } catch(err) {
  throw Error('W1_BROWSER_DIAG:'+JSON.stringify({
   cause:String(err),ui:(await page.locator('.timing-page').innerText()).slice(0,1700),
   pageErrors:report.errors,sourceP1gBytes:p1g.length
  }));
 }
 report.checks.push('BROWSER_LOCAL_PACKAGED_P1G_READER');
 await page.locator('[data-w1-preview-select]').click();
 await page.locator('#w1-new-utc').fill('2026-11-03T00:00:00Z');
 await page.locator('[data-w1-preview-build]').click();
 const diff=await page.locator('[data-w1-diff]').innerText();
 assert.match(diff,/\/World\/RecurringEvents\/155\/ItemSpawning\/NextOccurrence/);
 assert.match(diff,/2126-08-20T00:00:00Z/);
 assert.match(diff,/2026-11-03T00:00:00Z/);
 assert.equal(await page.locator('[data-w1-export-off]').isDisabled(),true);
 report.checks.push('PREVIEW_EXACT_OLD_NEW_AND_WRITER_OFF');
 const downloadEvent=page.waitForEvent('download',{timeout:15000});
 await page.locator('[data-w1-original-backup]').click();
 const download=await downloadEvent;
 assert.match(download.suggestedFilename(),/original-backup\.p1g$/);
 const localFile=await download.path();
 assert.equal(sha(await readFile(localFile)),before);
 assert.equal(sha(p1g),before);
 report.checks.push('ORIGINAL_FIRST_DOWNLOAD_BYTES_UNCHANGED');
 await page.locator('#w1-new-utc').fill('2026-02-29T00:00:00Z');
 await page.locator('[data-w1-preview-build]').click();
 await page.getByText('W1_PREVIEW_UTC_INVALID').waitFor({timeout:5000});
 assert.equal(await page.locator('[data-w1-diff]').count(),0);
 report.checks.push('INVALID_DATE_FAIL_CLOSED');
 assert.deepEqual(nonGet,[]);
 assert.deepEqual(report.errors,[]);
 report.checks.push('NO_UPLOAD_NO_BROWSER_ERRORS');
 report.result='PASS';
 await ctx.close();
}catch(error){
 report.result='FAIL';
 report.error=String(error?.stack||error);
}finally{
 await mkdir('.artifacts/01a-w1-preview',{recursive:true});
 await writeFile('.artifacts/01a-w1-preview/report.json',JSON.stringify(report,null,2));
 await browser.close();
}
if(report.result!=='PASS')throw Error(report.error||'W1_UI_PREVIEW_BROWSER_FAILED');
