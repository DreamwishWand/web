// 04 QR-W independent NEW deployed GitHub Pages CDN/SEO acceptance after main c778.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';

const MAIN='c77840eb0353ace2689a00a49b23c32fda866264';
const OLD_MAIN='79e1393db5179cbc0fc8e1f6c5261d87ef47e95c';
const ORIGIN='https://dreamwishwand.github.io';
const BASE=ORIGIN+'/web';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const paths=[
  ['dreamsnaps/submit','707a89fcdafa9d54e1639372cd698006d56cf55a'],
  ['dreamsnaps/judge','33739b1747758653227e006cd6001681a802efe6'],
  ['dreamsnaps/results','168c09e05f912d1b0196b885ba95bf1db8304be7'],
  ['dreamsnaps/my','4bc551930a145c61406eea5197d4dfd4030dcb48'],
  ['gallery/my','2d78bb9e8259bf9985170f2d30977e397dfc8670']
];
if(!process.env.CHROME_BIN)throw new Error('QA_NOT_RUN_SYSTEM_CHROME_REQUIRED');
for(const key of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
  if(process.env[key])throw Error('QA_NEVER_READ_USER_PRIVATE_P1G_'+key);
assert.equal(git('merge-base',OLD_MAIN,MAIN),OLD_MAIN);
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-only',OLD_MAIN,MAIN).trim().split('\n').sort(),
  paths.map(([p])=>'src/routes/'+p+'/+page.svelte').sort(),'exact five merged privacy paths');
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').trim().split('\n').sort(),[
 '.github/workflows/04qr-w-mainc778-pages-private-robots5.yml',
 'scripts/04qr-w-mainc778-pages-private-robots5.mjs'
].sort(),'QA only');
for(const [p,hash] of paths){
 assert.equal(git('rev-parse',MAIN+':src/routes/'+p+'/+page.svelte'),hash);
}

const staticRobots=/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])(?=[^>]*\bcontent\s*=\s*["']noindex,nofollow["'])[^>]*>/gi;
for(const [p] of paths){
 const url=BASE+'/'+p+'/';
 const res=await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'}});
 const html=await res.text();
 assert.equal(res.status,200,'actual public CDN direct HTTP200 '+url);
 assert.match(res.headers.get('content-type')??'',/text\/html/i,'real SSR page, not fallback asset');
 assert.ok(html.length>250);
 const metas=[...html.matchAll(staticRobots)];
 assert.equal(metas.length,1,'real CDN HTML must have exactly one static meta robots noindex,nofollow '+p);
 assert.ok(metas[0].index<html.indexOf('</head>'),'noindex in prehydration HTML head '+p);
 console.log('QR_MAINC778_REAL_CDN_STATIC_NOINDEX '+p+' HTTP200 PASS');
}

const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:320,height:780},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),networkDenied=[],errors=[];
page.on('pageerror',error=>errors.push(String(error)));
if(typeof page.routeWebSocket!=='function')throw Error('QA_CHROME_WEBSOCKET_BLOCK_REQUIRED');
await page.routeWebSocket('**/*',route=>{networkDenied.push('WS '+route.url());route.close();});
await page.route('**/*',route=>{
 const req=route.request(),u=new URL(req.url());
 if(u.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{networkDenied.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
async function overflow(label){
 const r=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(r.scroll<=r.client+2,label+' overflow '+JSON.stringify(r));
}
try{
 for(const [p] of paths){
  const res=await page.goto(BASE+'/'+p+'/',{waitUntil:'networkidle',timeout:45000});
  assert.equal(res?.status(),200,'real Chrome canonical CDN route '+p);
  const metas=await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content));
  assert.deepEqual(metas,['noindex,nofollow'],'real hydrated Chrome robots '+p);
  const privateCards=await page.locator('.entry,.official-card,.card img,.grid img,.columns .row,.image img').count();
  assert.equal(privateCards,0,'anonymous result/Work/media exposure unexpected on '+p);
  await overflow('320px '+p);
  console.log('QR_MAINC778_REAL_CDN_CHROME_STATIC_AND_HYDRATED_ROBOTS '+p+' ANON_MEDIA0 PASS');
 }
 await page.setViewportSize({width:640,height:780});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await overflow('200% private Gallery My');
 const screenshot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(screenshot.length>5000);
 console.log('QR_MAINC778_PRIVATE_GALLERY_SCREENSHOT_RAM_SHA '+createHash('sha256').update(screenshot).digest('hex').slice(0,16));
 assert.deepEqual(networkDenied,[],'zero off-origin GET/POST, upload or WS; no auth/provider mutation');
 assert.deepEqual(errors,[],'zero Chrome page errors');
 console.log('QR_MAINC778_MANAGED_PAGES_PRIVATE5_NOINDEX_PRIVACY_SCOPED_PASS');
}finally{
 await ctx.close();await browser.close();
}
