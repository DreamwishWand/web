import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';
import {createNativePresetBackup,extractNativePresetSnapshots,NATIVE_PRESET_LIBRARY_KEY as key} from '../src/lib/presets/native-preset-runtime.js';
const old='http://127.0.0.1:4361',next='http://localhost:4361';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
const errors=[],unsafe=[];
context.on('request',r=>{if(![old,next].includes(new URL(r.url()).origin)||!['GET','HEAD'].includes(r.method()))unsafe.push(r.url());});
const fixture=id=>createNativePresetBackup(extractNativePresetSnapshots({World:{DecorationPresets:[{GridCollection:{Grids:{'0':{ID:0,NextGridObjectID:1,Objects:{}}},DiffGrids:{},NextGridID:1},PresetName:id,ThumbnailItems:[],ShareInfo:null,StateFlags:0}]}})[0],{idFactory:()=>id,now:'2026-11-14T00:00:00Z'});
const one=fixture('source'),two=fixture('target');
async function open(origin){
 const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(origin+'/presets/',{waitUntil:'networkidle'});
 await p.locator('[data-preset-child="inGame"]').click();
 await p.locator('[data-preset-ingame-child="decorations"]').click();
 await p.locator('[data-native-library-file]').waitFor({state:'attached'});
 return p;
}
const raw=p=>p.evaluate(k=>localStorage.getItem(k),key);
const load=(p,value)=>p.locator('[data-native-library-file]').setInputFiles({name:'local.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});
const wait=p=>p.locator('[data-native-library-import]:not([disabled])').waitFor();
try{
 const source=await open(old);await load(source,one);await source.locator('.backup-grid article').first().waitFor();await wait(source);
 const sourceRaw=await raw(source);
 const dl=source.waitForEvent('download');await source.locator('[data-native-library-export]').click();
 const file=await readFile(await (await dl).path(),'utf8');
 assert.deepEqual(JSON.parse(file).backups,[one]);assert.equal(await raw(source),sourceRaw);
 const target=await open(next);assert.equal(await raw(target),null);
 await load(target,two);await target.locator('.backup-grid article').first().waitFor();await wait(target);
 await load(target,file);await target.locator('.backup-grid article').nth(1).waitFor();await wait(target);
 const merged=await raw(target);assert.deepEqual(JSON.parse(merged).backups,[two,one]);
 await load(target,file);await wait(target);assert.equal(await raw(target),merged);
 const conflict={...one,payload:{...one.payload,PresetName:'conflict'}};
 await load(target,conflict);await wait(target);assert.equal(await raw(target),merged);
 const stale=await open(next);await stale.locator('.backup-grid article').nth(1).waitFor();
 const third=fixture('third');await load(target,third);await target.locator('.backup-grid article').nth(2).waitFor();await wait(target);
 const fourth=fixture('fourth');await load(stale,fourth);await stale.locator('.backup-grid article').nth(3).waitFor();await wait(stale);
 assert.deepEqual(JSON.parse(await raw(target)).backups,[two,one,third,fourth]);
 // Reproduce the independent stale-remove counterexample in real separate tabs.
 const staleRemove=await open(next);await staleRemove.locator('.backup-grid article').nth(3).waitFor();
 const card=(p,name)=>p.locator('.backup-grid article').filter({has:p.getByRole('heading',{name,exact:true})});
 await card(target,'source').locator('[data-native-library-remove]').click();await wait(target);
 assert.deepEqual(JSON.parse(await raw(target)).backups,[two,third,fourth]);
 const replacement={...one,summary:{...one.summary,presetName:'replacement source'},payload:{...one.payload,PresetName:'replacement source',OpaqueFuture:{new:true}}};
 await load(target,replacement);await card(target,'replacement source').waitFor();await wait(target);
 const replaced=await raw(target);
 await card(staleRemove,'source').locator('[data-native-library-remove]').click();await wait(staleRemove);
 assert.equal(await raw(target),replaced);assert.deepEqual(JSON.parse(replaced).backups,[two,third,fourth,replacement]);
 await card(staleRemove,'replacement source').waitFor();
 const fifth=fixture('fifth');await load(target,fifth);await card(target,'fifth').waitFor();await wait(target);
 await card(staleRemove,'replacement source').locator('[data-native-library-remove]').click();await wait(staleRemove);
 assert.deepEqual(JSON.parse(await raw(target)).backups,[two,third,fourth,fifth]);
 const reopened=await open(next);await reopened.locator('.backup-grid article').nth(3).waitFor();
 assert.equal(await raw(reopened),await raw(target));assert.equal(await raw(source),sourceRaw);
 assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);
 console.log('WEP_NATIVE_PRESET_TWO_ORIGIN_EXPLICIT_EXPORT_IMPORT_COLLISION_STALE_REOPEN_PASS');
}finally{await context.close();await browser.close();}
