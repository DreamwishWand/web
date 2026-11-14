import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument,MOODBOARD_STORAGE_KEY as P,MOODBOARD_BACKUP_KEY as B} from '../src/lib/moodboards/store.js';
const S='d839ea143de868a06e9fb25aa31718660ac911d6',BASE='ddfb8c107c3aab0293bb953e53811e1d93e9382f';
const pins={'.github/workflows/web-moodboard-atomic-entry.yml':'c7d2e175d9e6cdc849d3da1a7e0d85065417549e','.github/workflows/web-moodboard-origin-portability.yml':'c7d559e233130929a9b41814432df1293376758f','scripts/web-moodboard-origin-portability-chrome.mjs':'a118befa1064f05088445c24443e88992abcc15c','src/lib/moodboards/copy.js':'97b6f8f6ebc9e38503e5741347e16f3c2f442d31','src/lib/moodboards/origin-portability.mjs':'bae76f0e5fba08104a274b47702ccc999f9131c4','src/routes/moodboards/+page.svelte':'71bad3e68f1b329fb635a1247480149cc3341efb','tests/web-moodboard-origin-portability.test.mjs':'10a8758dfe6c99cac4958412d09670b295abcbaa'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.deepEqual(git('diff','--name-only',BASE,S).split('\n').sort(),Object.keys(pins).sort());
for(const [p,h] of Object.entries(pins))assert.equal(git('rev-parse','HEAD:'+p),h);
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\tscripts/04qr-w-pr1082-file-byte-independent.mjs','A\t.github/workflows/04qr-w-pr1082-file-byte-independent.yml'].sort());
const t='2026-11-14T00:00:00.000Z';
const raw=title=>serializeMoodboardDocument(createMoodboard(createEmptyMoodboardDocument(t),{title},{now:t,idFactory:()=> 'qa_byte_boundary'}).document);
const good=Buffer.from(raw('QA é 日本語 �'));
const malformed=Buffer.from(raw('QA X'));malformed[malformed.indexOf(Buffer.from('QA X'))+3]=0xff;
assert.throws(()=>new TextDecoder('utf-8',{fatal:true}).decode(malformed));
const bom=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),good]);
const duplicate=Buffer.from(raw('QA duplicate').replace('"version": 2','"version": 2, "version": 2'));
const url='http://127.0.0.1:4482/moodboards/';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const outcomes=[];
try{
 for(const [label,bytes,allow] of [['valid_utf8',good,true],['malformed_utf8',malformed,false],['bom_prefixed',bom,false],['duplicate_json',duplicate,false]]){
  const ctx=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
  const p=await ctx.newPage(),errors=[],unsafe=[];
  p.on('pageerror',e=>errors.push(String(e)));ctx.on('request',r=>{if(new URL(r.url()).origin!=='http://127.0.0.1:4482'||!['GET','HEAD'].includes(r.method()))unsafe.push(r.url())});
  await p.goto(url,{waitUntil:'networkidle'});await p.locator('[data-moodboard-import-file]').waitFor({state:'attached'});
  const read=()=>p.evaluate(([a,b])=>[localStorage.getItem(a),localStorage.getItem(b)],[P,B]);
  assert.deepEqual(await read(),[null,null]);
  await p.locator('[data-moodboard-import-file]').setInputFiles({name:label+'.json',mimeType:'application/json',buffer:bytes});
  await p.waitForFunction(()=>document.querySelector('.moodboards-page .status[role=status]')?.textContent?.trim());
  const after=await read(),status=await p.locator('.moodboards-page .status[role=status]').textContent();
  const accepted=after[0]!==null;
  if(accepted){const dl=p.waitForEvent('download');await p.locator('[data-moodboard-export]').click();const d=await dl;const stream=await d.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);const exported=Buffer.concat(chunks);assert.equal(exported.toString(),after[0]);console.log('QRW1082_ACCEPTED_BYTES',label,'input',bytes.length,'exported',exported.length,'equal',bytes.equals(exported),'title',JSON.parse(after[0]).boards[0].title);}
  console.log('QRW1082_ACTUAL_FILE_CASE',JSON.stringify({label,allow,accepted,status,backup:after[1],errorCount:errors.length,unsafeCount:unsafe.length}));
  assert.equal(after[1],null);assert.deepEqual(errors,[]);assert.deepEqual(unsafe,[]);
  if(allow)assert.equal(after[0],good.toString());
  outcomes.push({label,allow,accepted});
  await ctx.close();
 }
 assert.deepEqual(outcomes.filter(x=>x.allow!==x.accepted),[],'Actual file-byte boundary accepted lossy/noncanonical bytes');
 console.log('QRW1082_FILE_BYTE_BOUNDARY_PASS');
}finally{await browser.close()}
