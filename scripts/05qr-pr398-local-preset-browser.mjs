// 05 QR PR398 independent actual Chrome local PC JSON only, NO game Save.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createNativePresetBackup,extractNativePresetSnapshots}
 from '../src/lib/presets/native-preset-runtime.js';
if(!process.env.CHROME_BIN)throw Error('QA_CHROME_BIN_REQUIRED');
const root=(process.env.QR398_URL||'http://127.0.0.1:4251').replace(/\/$/,'');
const mode=process.env.QR398_MODE||'dev';
const payload={GridCollection:{Grids:{'0':{ID:0,NextGridObjectID:1,
 Objects:{'0':{ID:0,ItemID:40000001,X:0,Y:0,State:null,Unknown:{retain:[1,2,3]}}}}},
 DiffGrids:{},NextGridID:1},
 PresetName:'QA LOCAL ONLY',ThumbnailItems:[40000001],ShareInfo:null,StateFlags:0,
 UnknownRoot:{'dontUpload':'TRUE'}};
const backup=createNativePresetBackup(extractNativePresetSnapshots({
 World:{DecorationPresets:[payload]}})[0],{
 sourceName:'SYNTHETIC_PC_JSON_ONLY',now:'2026-11-04T08:00:00Z',
 idFactory:()=>'05qr398'
});
const buffer=Buffer.from(JSON.stringify(backup));
const report={schema:'05qr.398.local-PC-file-browser@1',mode,syntheticOnly:true,
 checks:[],network:[],errors:[],result:'PENDING',nativeV3:'NOT_RUN'};
const pass=x=>report.checks.push(x);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({acceptDownloads:true});
 const page=await ctx.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(root+'/presets/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('nav.preset-tabs button').nth(2).click();
 await page.locator('.native-manager .local-library').waitFor({timeout:20000});
 // Record only network while performing user-initiated local import/export.
 ctx.on('request',r=>{
  if(r.method()!=='GET' || new URL(r.url()).origin!==new URL(root).origin)
   report.network.push({method:r.method(),type:r.resourceType(),hostname:new URL(r.url()).hostname});
 });
 await page.locator('.native-manager .local-library input[type=file]').setInputFiles({
  name:'qa398-native-preset.json',mimeType:'application/json',buffer
 });
 await page.locator('.native-manager .backup-grid article').first().waitFor({timeout:25000});
 assert.equal(await page.locator('.native-manager .backup-grid article').count(),1);
 assert.match(await page.locator('.native-manager .backup-grid').innerText(),/QA LOCAL ONLY/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(
   'dreamwishwand:in-game-preset-library:v1')||'{}')?.backups?.length),1);
 pass('BROWSER_LOCAL_SCHEMA624_PC_PRESET_FILE_IMPORT_ONLY');

 const bad=Buffer.from('{"schema":"unknown.tom.source","version":1,"backups":[]}');
 await page.locator('.native-manager .local-library input[type=file]').setInputFiles({
  name:'tom-unsupported.json',mimeType:'application/json',buffer:bad
 });
 assert.equal(await page.locator('.native-manager .backup-grid article').count(),1);
 pass('TOM_UNSUPPORTED_FILE_DOES_NOT_REPLACE_VALID_LOCAL_LIBRARY');

 const event=page.waitForEvent('download',{timeout:20000});
 await page.locator('.native-manager .local-library .library-actions button').first().click();
 const download=await event;
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(exported.backups.length,1);
 assert.equal(exported.backups[0].payload.PresetName,'QA LOCAL ONLY');
 assert.deepEqual(exported.backups[0].payload.UnknownRoot,{dontUpload:'TRUE'});
 assert.equal(exported.backups[0].persistentWriteAuthorized,false);
 pass('MANUAL_PC_LIBRARY_BACKUP_EXPORT_RETURNS_SAME_UNKNOWN_FIELDS');

 assert.equal(await page.locator('.native-manager .blocked-actions button').count(),0);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('nav.preset-tabs button').nth(2).click();
 assert.equal(await page.locator('.native-manager .backup-grid article').count(),1);
 pass('LOCAL_STORAGE_STAYS_IN_BROWSER_ONLY');

 assert.deepEqual(report.network,[],'no uploaded local file POST/offsite network on import');
 assert.deepEqual(report.errors,[],'no JS error');
 pass('NO_EXTERNAL_UPLOAD_DURING_IMPORT_OR_EXPORT');
 report.result='PASS';
 await ctx.close();
}catch(e){report.result='FAIL';report.error=String(e?.stack||e);}
finally{
 await mkdir('.artifacts/05qr-pr398',{recursive:true});
 await writeFile('.artifacts/05qr-pr398/'+mode+'.json',JSON.stringify(report,null,2));
 await browser.close();
}
console.log(JSON.stringify({mode,result:report.result,checks:report.checks,error:report.error??null}));
if(report.result!=='PASS')process.exitCode=1;
