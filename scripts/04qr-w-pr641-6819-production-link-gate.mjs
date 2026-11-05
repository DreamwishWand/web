// 04 QR-W new-only independent QA: PR641 protected-main based public Detail-link suppression.
// Serves EXACT SvelteKit adapter-static build/ output; does not use dev/HMR or fake images.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join,resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {PUBLIC_DETAIL_ACCEPTED, SUPPORTED_DETAIL_LOCALES} from '../src/lib/entity/shared-catalog-detail.mjs';
const MAIN='9120711f2066f9596ec76b6f4da90f71e92f32db';
const SOURCE='6819c06590a1e371f6a9fec403ee4b408d4c5b76';
const fixed={
 '.github/workflows/web-shared-catalog-detail.yml':'97cde995137694932317c3ee07ad17bb96c89ad1',
 'src/lib/entity/SharedCatalogDiscovery.svelte':'96ac7fe99456eff3cd2e1881cf0c3d669c0cc622',
 'src/routes/collection/+page.svelte':'d03066dd7b291f28c1424e4e580ef774b99c6a44',
 'src/routes/explore/+page.svelte':'44ea499f6d4dc09112173cd5024a2d03666ae130',
 'tests/web-item-detail-static-link-gate.test.mjs':'0412257ecb344bf5b6c58c3e6c6de6a066a9e090'
};
const qa=['.github/workflows/04qr-w-pr641-6819-production-link-gate.yml','scripts/04qr-w-pr641-6819-production-link-gate.mjs'].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN,'must use original protected main912');
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE,'QA must be on immutable Source6819');
assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),Object.keys(fixed).sort());
assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
for(const [p,sha] of Object.entries(fixed))assert.equal(git('rev-parse',SOURCE+':'+p),sha,p);
assert.equal(PUBLIC_DETAIL_ACCEPTED,false,'public Detail gate must never flip ON');
assert.deepEqual([...SUPPORTED_DETAIL_LOCALES].sort(),['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'].sort());
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 assert.ok(!process.env[k],k+' private source MUST NOT be in CI');
console.log('QR641_SOURCE5_QA2_IMMUTABLE_MAIN912_PUBLIC_GATE_OFF_PASS');

const build=resolve('build');
assert.ok(existsSync(join(build,'404.html')),'static fallback required for honest HTTP404');
for(const file of ['collection/index.html','explore/index.html','editor/items/index.html'])
 assert.ok(existsSync(join(build,file)),'real static build required: '+file);
for(const loc of SUPPORTED_DETAIL_LOCALES)
 assert.ok(!existsSync(join(build,loc,'40001238','index.html')),'unknown static direct Item pages must not be minted');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain'};
const srv=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(!pathname.startsWith('/web/')||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
 let rel;
 try{rel=decodeURIComponent(pathname.slice(5));}catch{res.writeHead(404);res.end();return;}
 if(rel.includes('\0')||rel.split('/').includes('..')){res.writeHead(404);res.end();return;}
 let file=resolve(build,rel);
 if(!file.startsWith(build+sep)&&file!==build){res.writeHead(404);res.end();return;}
 if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
 if(!existsSync(file)||!statSync(file).isFile()){
  res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(readFileSync(join(build,'404.html')));return;
 }
 res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});
 if(req.method==='HEAD'){res.end();return;}res.end(readFileSync(file));
});
await new Promise((yes,no)=>srv.once('error',no).listen(0,'127.0.0.1',yes));
const root='http://127.0.0.1:'+srv.address().port;
const BASE=root+'/web';
const chrome=process.env.CHROME_BIN;
assert.ok(chrome,'NOT_RUN: installed system Chrome missing');
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage(),network=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN: browser must intercept WebSocket');
await page.routeWebSocket('**/*',r=>{network.push('WS '+r.url());r.close();});
await page.route('**/*',r=>{
 const u=new URL(r.request().url());
 if(u.origin===root&&['GET','HEAD'].includes(r.request().method()))r.continue();
 else{network.push(r.request().method()+' '+r.request().url());r.abort('blockedbyclient');}
});
const fit=async label=>{
 const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.client+2,label+': '+JSON.stringify(size));
};
const noLinks=async label=>{
 const illegal=page.locator('a[href^="/web/en/40001238/"],a[href^="/web/fr/40001238/"],a[href^="/web/ja/40001238/"],a[href*="/40001238/"]');
 assert.equal(await illegal.count(),0,label+' must suppress known previously broken ItemID40001238 link');
 const anchors=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
 assert.ok(!anchors.some(h=>/^\/web\/(?:en|fr|it|de|es-ES|ja|zh-CN|pt-BR)\/[1-9][0-9]{0,15}\/$/.test(h??'')),label+' no other dynamic public ItemID href emitted');
};
try{
 for(const route of ['/collection/','/explore/','/editor/items/']){
  const res=await fetch(BASE+route,{redirect:'manual'});
  assert.equal(res.status,200,route+' actual static generated file must be HTTP200');
 }
 for(const id of ['40001238','9999999999999']){
  for(const loc of ['en','ja','fr']){
   const resp=await fetch(BASE+'/'+loc+'/'+id+'/',{redirect:'manual'});
   assert.equal(resp.status,404,'non-prerendered Item Detail must remain honest HTTP404');
  }
 }
 console.log('QR641_STATIC_BUILD_HTTP200_3SURFACES_DIRECT_ITEM404_NOT_FAKED_PASS');
 await page.goto(BASE+'/explore/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('.grid .card').first().waitFor({timeout:40000});
 await page.locator('.controls input[type="search"]').fill('40001238');
 await page.waitForFunction(()=>document.querySelectorAll('.grid .card').length===1,null,{timeout:18000});
 await page.locator('.grid .card footer [data-detail-unavailable="true"]').waitFor({timeout:18000});
 assert.equal(await page.locator('.grid .card footer a').count(),0);
 assert.ok((await page.locator('.grid .card footer [data-detail-unavailable="true"]').innerText()).length>3);
 assert.equal(await page.locator('.grid .card footer button').count(),1,'Moodboard action preserved');
 await noLinks('Explore exact filtered Item');
 console.log('QR641_PROD_CHROME_EXPLORE_OLD_404_LINK_REMOVED_MOODBOARD_ACTION_RETAINED_PASS');
 const locctrl=page.locator('#site-locale');
 for(const loc of SUPPORTED_DETAIL_LOCALES){
  await locctrl.selectOption(loc);
  await page.waitForFunction(l=>document.documentElement.dataset.locale===l,loc,{timeout:10000});
  await page.locator('.grid .card footer [data-detail-unavailable="true"]').waitFor();
  await noLinks('Explore locale '+loc);
 }
 console.log('QR641_PROD_CHROME_EIGHT_LOCALES_LOCALIZED_NONANCHOR_PASS');
 await page.setViewportSize({width:320,height:750});
 await fit('Explore320');
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await fit('Explore200pct');await page.evaluate(()=>{document.documentElement.style.zoom=''});
 console.log('QR641_PROD_CHROME_EXPLORE_320_200_NO_OVERFLOW_PASS');
 await page.goto(BASE+'/collection/',{waitUntil:'domcontentloaded',timeout:45000});
 const coll=page.locator('[data-stage1-collection-root]');
 await coll.waitFor({timeout:25000});
 assert.equal(await coll.getAttribute('data-personal-progress'),'unknown');
 assert.equal(await coll.getAttribute('data-writer'),'off');
 await page.locator('[data-stage1-search]').fill('40000047');
 await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:25000});
 await page.locator('[data-stage1-search-groups] .item-card').first().click();
 await page.locator('[data-stage1-item-info]').waitFor({timeout:18000});
 assert.equal(await page.locator('[data-stage1-item-info] .info-actions a').count(),0);
 assert.equal(await page.locator('[data-stage1-item-info] [data-detail-unavailable="true"]').count(),1);
 assert.ok(await page.locator('[data-stage1-item-info] .info-actions button').count()>0,'close button preserved');
 await noLinks('Collection searched item');
 await page.setViewportSize({width:320,height:730});await fit('Collection320');
 console.log('QR641_PROD_CHROME_COLLECTION_INFO_LINK_SUPPRESSED_UNKNOWN_WRITER_OFF_PASS');
 await page.goto(BASE+'/editor/items/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:35000});
 assert.equal(await page.locator('[data-editor-item-surface]').getAttribute('data-writer'),'off');
 assert.equal(await page.locator('[data-editor-item-surface]').getAttribute('data-owned'),'unknown');
 await page.locator('[data-shared-query]').fill('40000047');
 await page.locator('[data-shared-results] [data-detail-unavailable="true"]').first().waitFor({timeout:20000});
 assert.equal(await page.locator('[data-shared-results] a').count(),0);
 assert.match(await page.locator('[data-shared-results]').innerText(),/40000047/);
 await noLinks('Editor shared directory');
 await page.setViewportSize({width:320,height:750});await fit('Editor320');
 console.log('QR641_PROD_CHROME_EDITOR_DIRECTORY_SEARCH_NOLINK_NO_WRITER_PASS');
 assert.deepEqual(network,[]);
 assert.deepEqual(errors,[]);
 console.log('QR641_PROD_CHROME_NO_OFFORIGIN_POST_WS_PAGEERROR_PASS');
}finally{
 await context.close();await browser.close();
 await new Promise((ok,bad)=>srv.close(e=>e?bad(e):ok()));
}
