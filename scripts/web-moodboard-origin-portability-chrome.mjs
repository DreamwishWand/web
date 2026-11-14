import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument} from '../src/lib/moodboards/store.js';
const old='http://127.0.0.1:4481',next='http://127.0.0.1:4482';
const P='dreamwishwand:moodboards:v1',B=P+':backup';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
const bad=[],errors=[];
ctx.on('request',r=>{if(![old,next].includes(new URL(r.url()).origin)||!['GET','HEAD'].includes(r.method()))bad.push(r.method());});
const read=p=>p.evaluate(([a,b])=>[localStorage.getItem(a),localStorage.getItem(b)],[P,B]);
const create=async(p,title)=>{await p.locator('.new-board input').fill(title);await p.locator('.new-board button').click();await p.locator('.board-list button').filter({hasText:title}).waitFor();};
const exportFile=async(p,selector)=>{const dl=p.waitForEvent('download');await p.locator(selector).click();const file=await dl;return readFile(await file.path());};
const importFile=async(p,buffer)=>{await p.locator('[data-moodboard-import-file]').setInputFiles({name:'moodboards.json',mimeType:'application/json',buffer});await p.locator('.moodboards-page .status[role=status]').waitFor();};
try{
 const a=await ctx.newPage(),b=await ctx.newPage();for(const p of [a,b])p.on('pageerror',e=>errors.push(String(e)));
 await a.goto(old+'/web/moodboards/',{waitUntil:'networkidle'});await a.locator('.new-board input').waitFor();
 await create(a,'Synthetic old A');await create(a,'Synthetic old B');
 const oldBefore=await read(a);assert.ok(oldBefore[0]&&oldBefore[1]);
 const payload=await exportFile(a,'[data-moodboard-export]'),previous=await exportFile(a,'[data-moodboard-export-previous]');
 assert.equal(payload.toString(),oldBefore[0]);assert.equal(previous.toString(),oldBefore[1]);
 await b.goto(next+'/moodboards/',{waitUntil:'networkidle'});assert.deepEqual(await read(b),[null,null]);
 await importFile(b,payload);await b.locator('.board-list button').filter({hasText:'Synthetic old B'}).waitFor();
 assert.deepEqual(await read(b),[oldBefore[0],null]);assert.deepEqual(await read(a),oldBefore);
 await b.reload({waitUntil:'networkidle'});await b.locator('.board-list button').filter({hasText:'Synthetic old A'}).waitFor();assert.deepEqual(await read(b),[oldBefore[0],null]);
 console.log('ACT519_ACTUAL_TWO_ORIGIN_EXPORT_IMPORT_REOPEN_PASS');
 await create(b,'Synthetic destination C');const before=await read(b);assert.ok(before[1]);
 await importFile(b,payload);await b.waitForFunction(()=>document.querySelector('.moodboards-page .status[role=status]')?.textContent?.includes('Import blocked'));
 assert.deepEqual(await read(b),before);
 await importFile(b,Buffer.from('{"schema":"wand.moodboards.local@1","version":99,"boards":[]}'));
 await b.waitForFunction(()=>document.querySelector('.moodboards-page .status[role=status]')?.textContent?.includes('current-format'));
 assert.deepEqual(await read(b),before);assert.deepEqual(await read(a),oldBefore);
 console.log('ACT519_ACTUAL_DESTINATION_COLLISION_INVALID_BACKUP_UNCHANGED_PASS');
 await b.locator('.backup-actions button').last().click();await b.locator('.board-list button').filter({hasText:'Synthetic old B'}).waitFor();assert.equal((await read(b))[0],before[1]);
 console.log('ACT519_ACTUAL_PREVIOUS_SNAPSHOT_RESTORE_PASS');
 // Replay all four independent QA1085 cases with the same fixture; expand malformed byte variants.
 const t='2026-11-14T00:00:00.000Z';
 const raw=title=>serializeMoodboardDocument(createMoodboard(createEmptyMoodboardDocument(t),{title},{now:t,idFactory:()=> 'qa_byte_boundary'}).document);
 const good=Buffer.from(raw('QA é 日本語 �'));
 const orig=Buffer.from(raw('QA X')),at=orig.indexOf(Buffer.from('QA X'))+3;
 assert.ok(at>=3);
 const mutate=bytes=>Buffer.concat([orig.subarray(0,at),Buffer.from(bytes),orig.subarray(at+1)]);
 const cases=[
  ['valid_utf8',good,true],
  ['malformed_utf8',mutate([0xff]),false],
  ['bom_prefixed',Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),good]),false],
  ['duplicate_json',Buffer.from(raw('QA duplicate').replace('"version": 2','"version": 2, "version": 2')),false],
  ['invalid_continuation',mutate([0xe3,0x28,0xa1]),false],
  ['truncated_multibyte',mutate([0xe3,0x81]),false],
  ['overlong',mutate([0xc0,0xaf]),false],
  ['isolated_continuation',mutate([0x80]),false],
  ['surrogate',mutate([0xed,0xa0,0x80]),false],
  ['out_of_range',mutate([0xf4,0x90,0x80,0x80]),false],
  ['valid_supplementary',Buffer.from(raw('QA 🎹 星 café �')),true]
 ];
 for(const [label,bytes,allow] of cases){
  const isolated=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
  try{
   const p=await isolated.newPage(),errs=[],unsafe=[];
   p.on('pageerror',e=>errs.push(String(e)));
   isolated.on('request',r=>{if(new URL(r.url()).origin!==next||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method());});
   await p.goto(next+'/moodboards/',{waitUntil:'networkidle'});
   assert.deepEqual(await read(p),[null,null]);
   await importFile(p,bytes);
   const status=await p.locator('.moodboards-page .status[role=status]').textContent();
   if(allow){
    assert.match(status,/Backup imported/);
    assert.deepEqual(await read(p),[bytes.toString('utf8'),null]);
    assert.deepEqual(await exportFile(p,'[data-moodboard-export]'),bytes);
    await p.reload({waitUntil:'networkidle'});assert.deepEqual(await read(p),[bytes.toString('utf8'),null]);
   }else{
    assert.match(status,/current-format/);assert.deepEqual(await read(p),[null,null]);
   }
   assert.deepEqual(errs,[]);assert.deepEqual(unsafe,[]);
   console.log('ACT528_FILE_BYTES',label,allow?'ACCEPT_EXACT':'DENY_NO_WRITE',bytes.length);
  }finally{await isolated.close();}
 }
 console.log('ACT528_QA1085_CAUSAL_REPLAY_AND_EXTENDED_UTF8_PASS');
 assert.deepEqual(bad,[]);assert.deepEqual(errors,[]);
 console.log('ACT519_NO_NON_GET_NO_OFF_ORIGIN_NO_PAGE_ERRORS_PASS');
}finally{await browser.close();}
