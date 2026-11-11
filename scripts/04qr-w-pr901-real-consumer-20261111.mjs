// 04 QR-W / PR901 independent public Rust WASM + optional UI changed-scope QA.
// The real encrypted Steam source in this job is SYNTHETIC, never a user Save.
// Protected product flag remains OFF; test-only opt-in exists solely in CI tmp tree.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join,extname,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {savedDiffGridsCopy,STEAM_DIFFGRIDS_LOCALES} from '../src/lib/wep/steam-saved-diffgrids-copy.mjs';

const SOURCE='7d251f67c6d9ea9824dad65838c7d52079a12930';
const BASE='ef0372a58b9619a442c65b31cecbb88c3cca0029';
const QA=['.github/workflows/04qr-w-pr901-real-consumer-20261111.yml',
 'scripts/04qr-w-pr901-real-consumer-20261111.mjs'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const git=(...x)=>execFileSync('git',x,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE,'QA HEAD must be frozen Source descendant');
assert.equal(git('merge-base',BASE,SOURCE),BASE);
assert.deepEqual(git('diff','--name-status',SOURCE,'HEAD').split('\n').filter(Boolean).sort(),
 QA.map(x=>'A\t'+x).sort(),'audit-only 2 ADD');
assert.ok(git('show','HEAD:src/lib/wep/steam-saved-diffgrids.consumer.worker.ts')
 .includes('const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false;'),'committed product flag OFF');
assert.ok(git('show','HEAD:src/lib/wep/steam-saved-diffgrids.consumer.worker.ts')
 .includes('verifiedSignature:false'),'signature unknown never promoted');
for(const [f,hash] of Object.entries({
 'src/lib/wep/SteamSavedDiffGridsReadonly.svelte':'b725214d55fa5bbc839ef5f8a28fe31f894426a4',
 'src/lib/wep/steam-saved-diffgrids-copy.mjs':'0212037cf7f77c98380c71931af9a6c32dd87740',
 'src/lib/wep/steam-saved-diffgrids-ui-client.mjs':'e25be774f939f30a58dc2b2086cec4d22d48260a',
 'src/lib/wep/steam-saved-diffgrids.consumer.worker.ts':'180eb636cf4f1d5188d627435eeeeccf2b633097'
}))assert.equal(git('rev-parse',SOURCE+':'+f),hash,'Source pin '+f);
assert.ok(process.env.CHROME_BIN,'must have real installed Chrome');
assert.ok(!process.env.P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH&&
 !process.env.WEP_PRIVATE_P1G_PATH,'private Save in CI prohibited');

const root=resolve('.'),publicDir=resolve(root,'build');
const file=await readFile(join(root,'tests/stage-f/fixtures/synthetic626-diffgrids.p1g'));
const expectData=JSON.parse(await readFile(join(root,'tests/stage-f/fixtures/expected-diffgrids.json'),'utf8'));
assert.equal(expectData.syntheticOnly,true);
assert.equal(file.length,expectData.sourceBytes);
const originalHash=sha(file);
let denyBlob=false,publicAssetReads=0;
const server=createServer(async(req,res)=>{
 let path;
 try{path=new URL(req.url,'http://127.0.0.1').pathname}catch{res.writeHead(400);res.end();return}
 if(req.method!=='GET'||!path.startsWith('/web/')){res.writeHead(403);res.end();return}
 if(path==='/web/worker-wasm/ddv_save_core.js')publicAssetReads++;
 const suffix=path.slice('/web/'.length),target=resolve(publicDir,suffix.endsWith('/')?suffix+'index.html':suffix);
 if(!target.startsWith(publicDir+sep)){res.writeHead(403);res.end();return}
 const types={'.js':'text/javascript','.wasm':'application/wasm','.json':'application/json',
  '.html':'text/html','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};
 const policy="default-src 'self'; script-src 'self' "+
  (denyBlob?"'wasm-unsafe-eval' 'unsafe-inline'":"blob: 'wasm-unsafe-eval' 'unsafe-inline'")+
  "; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'";
 try{
  const b=await readFile(target);
  res.writeHead(200,{'content-type':types[extname(target)]||'application/octet-stream',
   'cache-control':'no-store','x-content-type-options':'nosniff',
   'content-security-policy':policy});
  res.end(b);
 }catch{res.writeHead(404);res.end()}
});
let browser;
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:320,height:800},
  serviceWorkers:'block',acceptDownloads:false,ignoreHTTPSErrors:false});
 const page=await context.newPage(),network=[],errors=[],downloads=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('download',d=>downloads.push(d.suggestedFilename()));
 page.on('request',r=>{
  if(!['GET','HEAD'].includes(r.method())||!r.url().startsWith(origin+'/'))
   network.push(r.method()+' '+r.url())
 });
 await page.addInitScript(()=>{
  window.__qrw={dbOpen:0,dbDelete:0,storage:[]};
  const o=IDBFactory.prototype.open,d=IDBFactory.prototype.deleteDatabase;
  IDBFactory.prototype.open=function(...args){window.__qrw.dbOpen++;return o.apply(this,args)};
  IDBFactory.prototype.deleteDatabase=function(...args){window.__qrw.dbDelete++;return d.apply(this,args)};
  const s=Storage.prototype.setItem,r=Storage.prototype.removeItem,c=Storage.prototype.clear;
  Storage.prototype.setItem=function(k,v){window.__qrw.storage.push('set:'+k);return s.call(this,k,v)};
  Storage.prototype.removeItem=function(k){window.__qrw.storage.push('remove:'+k);return r.call(this,k)};
  Storage.prototype.clear=function(){window.__qrw.storage.push('clear');return c.call(this)};
 });
 const response=await page.goto(origin+'/web/editor/timing/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(response?.status(),200,'real compiled Svelte route');
 const panel=page.locator('[data-steam-diffgrids-readonly]');
 await panel.waitFor({timeout:30000});
 assert.equal(await panel.getAttribute('data-writer'),'off');
 assert.equal(await panel.getAttribute('data-product-read'),'off');
 assert.equal(await page.locator('[data-diffgrids-count]').count(),0,'must not autoload');
 const summary=page.locator('[data-diffgrids-summary]');
 await summary.focus();await summary.press('Enter');
 assert.equal(await panel.evaluate(el=>el.open),true,'keyboard disclosure');
 await page.waitForFunction(()=>!!document.querySelector('#steam-diffgrids-file:not([disabled])'),
  null,{timeout:45000});
 assert.equal(await page.locator('#steam-diffgrids-file').inputValue(),'','manual File only');
 console.log('QRW901_REAL_RUST_PUBLIC_BYTES_WORKER_READY_MANUAL_ONLY');
 for(const lang of STEAM_DIFFGRIDS_LOCALES){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(x=>document.documentElement.dataset.locale===x,lang);
  const copy=savedDiffGridsCopy(lang);
  assert.ok((await summary.textContent()).includes(copy.title),'locale title '+lang);
  assert.equal((await page.locator('[data-diffgrids-status]').textContent()).trim(),
   copy.ready,'locale status '+lang);
  assert.equal((await page.locator('label[for="steam-diffgrids-file"]').textContent()).trim(),
   copy.file,'locale label '+lang);
 }
 console.log('QRW901_8LOCALE_BROWSER_PASS '+STEAM_DIFFGRIDS_LOCALES.join(','));
 await page.locator('#site-locale').selectOption('en');
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await page.waitForTimeout(300);
 const g=await panel.evaluate(el=>{
  const b=el.getBoundingClientRect();
  return {left:b.left,right:b.right,vw:innerWidth,top:b.top,bottom:b.bottom};
 });
 assert.ok(g.left>=-1&&g.right<=g.vw+1&&g.right>g.left,
  'physical viewport 320 zoom200 overflow '+JSON.stringify(g));
 await page.locator('#steam-diffgrids-file').setInputFiles({
  name:'SYNTHETIC_CI_ONLY.p1g',mimeType:'application/octet-stream',buffer:file
 });
 await page.locator('#steam-diffgrids-sha').fill(expectData.originalSha256);
 await page.locator('.diffgrids-readonly input[type="checkbox"]').check();
 assert.equal(await page.locator('[data-diffgrids-count]').count(),0,'no read without click');
 await page.locator('[data-diffgrids-open]').click();
 const sizes=[];
 for(let i=1;i<=3;i++){
  const results=page.locator('[data-diffgrids-page="'+i+'"]');
  await results.waitFor({timeout:45000});
  assert.equal(await results.getAttribute('data-diffgrids-count'),'17');
  const rows=results.locator('tbody tr'),n=await rows.count();sizes.push(n);
  assert.equal(n,i===3?1:8,'Rust page max8');
  for(let row=0;row<n;row++){
   const cells=rows.nth(row).locator('th,td');
   assert.equal(await cells.count(),5,'allowed UI columns only');
   assert.equal((await cells.nth(4).textContent()).trim(),
    savedDiffGridsCopy('en').unresolved,'native layout UNKNOWN');
  }
  if(i===1){
   const a=(await rows.nth(0).locator('th,td').allTextContents()).map(s=>s.trim());
   assert.deepEqual(a.slice(0,4),['0','2','2','1'],'real Rust typed GridId/Modified/Removed/Overlap');
  }
  if(i<3)await page.locator('[data-diffgrids-next]').click();
 }
 assert.deepEqual(sizes,[8,8,1]);
 const textContent=await panel.textContent();
 for(const word of ['sessionId','nextCursor','decodedSha256',
  'OPAQUE_SYNTHETIC_NEVER_TO_UI','PRIVATE_SYNTHETIC_PATH_NEVER_TO_UI',
  'PRIVATE_SYNTHETIC_OBJECT_NEVER_TO_UI'])
  assert.ok(!textContent.includes(word),'raw Rust or private data leaked '+word);
 await page.locator('[data-diffgrids-close]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-diffgrids-count]'));
 assert.equal(await summary.evaluate(el=>document.activeElement===el),true,'Close focus restore');
 assert.equal(await page.locator('[data-diffgrids-next]').count(),0,'no stale cursor display');
 await page.locator('#steam-diffgrids-file').setInputFiles({
  name:'SYNTHETIC_CI_ONLY.p1g',mimeType:'application/octet-stream',buffer:file
 });
 await page.locator('#steam-diffgrids-sha').fill('0'.repeat(64));
 await page.locator('.diffgrids-readonly input[type="checkbox"]').check();
 await page.locator('[data-diffgrids-open]').click();
 await page.locator('[data-diffgrids-error]').waitFor({timeout:40000});
 assert.equal(await page.locator('[data-diffgrids-count]').count(),0,'invalid SHA refuses');
 await page.locator('#steam-diffgrids-sha').fill(expectData.originalSha256);
 await page.locator('[data-diffgrids-open]').click();
 await page.locator('[data-diffgrids-count="17"]').waitFor({timeout:40000});
 await page.locator('[data-diffgrids-close]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-diffgrids-count]'));
 assert.equal(sha(file),originalHash,'source encrypted fixture unchanged');
 const audit=await page.evaluate(()=>window.__qrw);
 assert.deepEqual([audit.dbOpen,audit.dbDelete],[0,0],'no IDB/Backup');
 assert.deepEqual(network,[],'no POST/offorigin');
 assert.deepEqual(downloads,[],'no Save export');
 assert.deepEqual(errors,[],'no JS exception');
 assert.deepEqual(audit.storage.filter(x=>!x.endsWith('dreamwishwand-locale-manual-v1')),[],
  'no Scene/Moodboard/Backup write');
 assert.equal(publicAssetReads,1,'verified JS fetched once, no second import TOCTOU');
 console.log('QRW901_REAL_RUST_8_8_1_CLOSE_REOPEN_BAD_SHA_DENIED '+JSON.stringify({
  sizes,uiWriterOff:true,zoom:g,forbiddenWrites:0,network:0,idb:0
 }));
 await context.close();
 async function negative(mode){
  denyBlob=mode==='CSP_BLOB';
  const ctx=await browser.newContext({viewport:{width:320,height:800},
   serviceWorkers:'block',acceptDownloads:false});
  let tamperHits=0;
  if(mode==='TAMPER_JS')await ctx.route('**/worker-wasm/ddv_save_core.js',async route=>{
   tamperHits++;
   const response=await route.fetch();
   const body=Buffer.from(await response.body());
   body[body.length-1]^=1;
   await route.fulfill({response,body});
  });
  const p=await ctx.newPage();
  const result=await p.goto(origin+'/web/editor/timing/',{waitUntil:'networkidle',timeout:60000});
  assert.equal(result?.status(),200);
  const details=p.locator('[data-steam-diffgrids-readonly]');
  await details.waitFor({timeout:20000});
  await details.evaluate(el=>el.open=true);
  await p.waitForTimeout(2600);
  assert.equal(await p.locator('#steam-diffgrids-file').count(),0,mode+' no File access');
  assert.equal((await p.locator('[data-diffgrids-status]').textContent()).trim(),
   savedDiffGridsCopy('en').unavailable,mode+' localized fail closed');
  if(mode==='TAMPER_JS')assert.ok(tamperHits>0,'tamper interceptor executed');
  await ctx.close();denyBlob=false;
  console.log('QRW901_'+mode+'_WORKER_FAILCLOSED '+tamperHits);
 }
 await negative('TAMPER_JS');
 await negative('CSP_BLOB');
 console.log('QRW901_INDEPENDENT_SIGNED_PUBLIC_RUST_CONSUMER_SCOPED_PASS');
}finally{
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
