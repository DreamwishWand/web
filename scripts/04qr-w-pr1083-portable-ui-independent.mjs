import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {captureScenePreset} from '../src/lib/wep/scene-capture-runtime.ts';
import {validatePublishablePreset} from '../src/lib/wep/scene-preset-runtime.ts';
const S='bc48e1abdfb827fdaf70ba404691208ddc8ba192',B='ddfb8c107c3aab0293bb953e53811e1d93e9382f';
const pins={'src/lib/wep/local-scene-preset-store.mjs':'c78ec768a04338cab89bf3f2098fb045105d5919','src/lib/wep/local-scene-preset-copy.js':'0d1fd1c2a95caac032e55b0166b5b00ecb8d78ab','src/routes/presets/+page.svelte':'3a180b6a1ada704159f302a7eeec20a408d0810c','tests/wep-local-scene-preset-cas.test.mjs':'4f1009a5a2f1fa3a4e983a34ef3f08abbfba9e99','scripts/wep-local-scene-preset-chrome.mjs':'f39b5ce1a81e75a59faedf5992e7e0a0a64472af'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(pins).map(p=>'M\t'+p).sort());
for(const [p,h] of Object.entries(pins))assert.equal(git('rev-parse','HEAD:'+p),h);
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\tscripts/04qr-w-pr1083-portable-ui-independent.mjs','A\t.github/workflows/04qr-w-pr1083-portable-ui-independent.yml'].sort());
const title='QA é 日本語 �';
const doc={target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'test-only'},objects:[{editorId:'qa-object',itemId:40000048,layer:'furniture',x:3,y:4,orientation:0,footprint:[{x:0,y:0}],portableState:null,dependencyIds:[],editability:'editable'}]};
const cap=captureScenePreset(doc,{selectionIds:['qa-object'],includeRoads:false,includeFences:false,title},validatePublishablePreset);
assert.equal(cap.publicationReady,true);
const envelope={schema:'wand.wep.scene-library-portable@1',version:1,entries:[{id:'scene_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title,createdAt:'2026-11-14T00:00:00Z',artifact:cap.artifact}]};
const raw=JSON.stringify(envelope),good=Buffer.from(raw);
const bad=Buffer.from(raw.replace(title,'QA X'));bad[bad.indexOf(Buffer.from('QA X'))+3]=0xff;
assert.throws(()=>new TextDecoder('utf-8',{fatal:true}).decode(bad));
const negatives=[['invalid_utf8',bad],['bom',Buffer.concat([Buffer.from([239,187,191]),good])],['duplicate',Buffer.from(raw.replace('"version":1','"version":1,"version":1'))],['trailing_space',Buffer.from(raw+' ')],['truncated_utf8',Buffer.concat([good.subarray(0,-1),Buffer.from([0xe3,0x81])])]];
const old='http://127.0.0.1:4347',next='http://localhost:4347',DB='dreamwishwand:wep:scene-presets:local:v1';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
const errors=[],unsafe=[];
ctx.on('request',r=>{if(![old,next].includes(new URL(r.url()).origin)||!['GET','HEAD'].includes(r.method()))unsafe.push(r.url())});
const open=async origin=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(origin+'/presets/',{waitUntil:'networkidle'});await p.locator('[data-preset-child="my"]').click();await p.locator('[data-device-scenes-reopen]').click();await p.locator('[data-device-scenes-import-file]:not([disabled])').waitFor();return p};
const dbExists=p=>p.evaluate(async n=>(await indexedDB.databases()).some(d=>d.name===n),DB);
const read=p=>p.evaluate(n=>new Promise((yes,no)=>{const r=indexedDB.open(n,1);r.onerror=()=>no(r.error);r.onsuccess=()=>{const d=r.result,t=d.transaction('snapshots','readonly'),g=t.objectStore('snapshots').get('library');t.oncomplete=()=>{d.close();yes(g.result)};t.onerror=()=>{d.close();no(t.error)}}}),DB);
const choose=(p,bytes,name='scene.json')=>p.locator('[data-device-scenes-import-file]').setInputFiles({name,mimeType:'application/json',buffer:bytes});
const preview=async p=>{await p.locator('[data-device-scenes-import-count]').waitFor();assert.equal(await p.locator('[data-device-scenes-import]').isEnabled(),true)};
const blocked=async p=>{await p.locator('[data-device-scenes-portable-status]').filter({hasText:'Reopen the library'}).waitFor();assert.equal(await p.locator('[data-device-scenes-import-count]').count(),0);assert.equal(await p.locator('[data-device-scenes-import]').isDisabled(),true)};
const download=async p=>{const d=p.waitForEvent('download');await p.locator('[data-device-scenes-export]').focus();await p.keyboard.press('Enter');return readFile(await (await d).path())};
try{
 const a=await open(old),b=await open(next);
 assert.equal(await dbExists(a),false);assert.equal(await dbExists(b),false);
 await choose(a,good);await preview(a);assert.equal(await dbExists(a),false);
 await a.locator('[data-device-scenes-import]').click();await a.locator('[data-device-scenes-portable-status]').filter({hasText:'Imported and independently reopened'}).waitFor();
 const original=await read(a),exported=await download(a);assert.ok(exported.equals(good));assert.deepEqual(await read(a),original);
 for(const [label,bytes] of negatives){
  await choose(b,exported);await preview(b);
  await choose(b,bytes,label+'.json');await blocked(b);
  assert.equal(await dbExists(b),false,label);assert.deepEqual(await read(a),original);
  console.log('QRW1083_ACTUAL_PREVIEW_INVALIDATION_DENY',label);
 }
 // Explicit reopen revokes pending preview; identical file can be reselected.
 await choose(b,exported);await preview(b);await b.locator('[data-device-scenes-reopen]').click();
 await b.locator('[data-device-scenes-import-file]:not([disabled])').waitFor();
 assert.equal(await b.locator('[data-device-scenes-import-count]').count(),0);assert.equal(await b.locator('[data-device-scenes-import]').isDisabled(),true);assert.equal(await dbExists(b),false);
 await choose(b,exported);await preview(b);
 // Dispatch empty selection through actual file input; no native OS cancel claim.
 await b.locator('[data-device-scenes-import-file]').setInputFiles([]);
 await b.locator('[data-device-scenes-import-file]').dispatchEvent('change');
 await b.waitForFunction(()=>!document.querySelector('[data-device-scenes-import-count]'));
 assert.equal(await b.locator('[data-device-scenes-import]').isDisabled(),true);assert.equal(await dbExists(b),false);
 await choose(b,exported);await preview(b);await b.locator('[data-device-scenes-import]').focus();await b.keyboard.press('Enter');
 await b.locator('[data-device-scenes-portable-status]').filter({hasText:'Imported and independently reopened'}).waitFor();
 const dest=await read(b);assert.equal(dest.revision,1);assert.deepEqual(JSON.parse(dest.primary).entries,envelope.entries);assert.deepEqual(await read(a),original);
 await b.reload({waitUntil:'networkidle'});await b.locator('[data-preset-child="my"]').click();await b.locator('[data-device-scenes-reopen]').click();await b.locator('[data-device-scenes-export]:not([disabled])').waitFor();
 assert.ok((await download(b)).equals(exported));assert.deepEqual(await read(b),dest);
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await b.locator('#site-locale').selectOption(loc,{force:true});
  assert.ok((await b.locator('[data-device-scenes-export]').innerText()).trim().length>4);
 }
 for(const [width,zoom] of [[320,'1'],[640,'2']]){await b.setViewportSize({width,height:900});await b.evaluate(z=>document.documentElement.style.zoom=z,zoom);const m=await b.locator('[data-device-scene-portability]').evaluate(e=>[e.scrollWidth,e.clientWidth]);assert.ok(m[0]<=m[1]+2);}
 assert.deepEqual(errors,[]);assert.deepEqual(unsafe,[]);
 console.log('QRW1083_ACTUAL_5_BYTE_DENIALS_REOPEN_EMPTY_SELECTION_RESELECT_TWO_ORIGIN_EXACT_UTF8_DOWNLOAD_8LOCALE_PASS');
}finally{await browser.close()}
