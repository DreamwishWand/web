// 04 QR-W PR590 new-only: local SSR static HTML + real Chromium 5 private/gated routes.
// Remote deployed Pages still has independently confirmed TRUE RED until 09 INT merge and re-QA.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const ORIGIN='http://127.0.0.1:4325';
if(!process.env.CHROME_BIN)throw Error('QR590_REAL_CHROME_REQUIRED');
for(const key of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 if(process.env[key])throw Error('QR590_PRIVATE_SAVE_NOT_AUTHORIZED_IN_CI: '+key);
const children=[
 '/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/','/gallery/my/'
];
const META=/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])(?=[^>]*\bcontent\s*=\s*["']noindex,nofollow["'])[^>]*>/gi;
const fingerprints=[];
for(const path of children){
 const response=await fetch(ORIGIN+path,{redirect:'manual'});
 const html=await response.text();
 assert.equal(response.status,200,'Source local SSR HTTP200 '+path);
 assert.match(response.headers.get('content-type')??'',/text\/html/i);
 const metas=[...html.matchAll(META)];
 assert.equal(metas.length,1,'Source raw SSR HTML must contain exactly one static robots noindex,nofollow '+path);
 assert.ok(html.indexOf('noindex,nofollow')<html.indexOf('</head>'),'meta must be in server-rendered head '+path);
 fingerprints.push(path);
 console.log('QR590_SOURCE_SSR_STATIC_META_NOINDEX_NOFOLLOW '+path+' PASS');
}
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),denied=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('QR590_WEBSOCKET_DENY_ROUTE_REQUIRED');
await page.routeWebSocket('**/*',route=>{
 const url=new URL(route.url());
 if(url.hostname==='127.0.0.1'&&url.port==='4325')route.connectToServer();
 else{denied.push('WS '+route.url());route.close();}
});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{denied.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
async function size(label){
 const r=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(r.scroll<=r.viewport+2,label+': '+JSON.stringify(r));
}
try{
 for(const path of children){
  const r=await page.goto(ORIGIN+path,{waitUntil:'networkidle',timeout:45000});
  assert.equal(r?.status(),200,'actual Chrome Source route '+path);
  const metas=await page.locator('meta[name="robots"]').evaluateAll(nodes=>nodes.map(x=>x.content));
  assert.deepEqual(metas,['noindex,nofollow'],'hydrated robots exact private-gate '+path);
  const privateCards=await page.locator('.entry,.official-card,.card img,.grid img,.columns .row,.image img').count();
  assert.equal(privateCards,0,'no anonymous private Works/results/media in gated page '+path);
  await page.setViewportSize({width:320,height:790});
  await size(path+' mobile 320');
  await page.setViewportSize({width:1280,height:850});
  console.log('QR590_SOURCE_CHROME_NOINDEX_ANONYMOUS_PRIVATE_NO_MEDIA '+path+' PASS');
 }
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await size('MyGallery zoom200');
 assert.deepEqual(denied,[],'no Cloud/Provider/POST/WS or offhost IO');
 assert.deepEqual(errors,[],'no Chrome exceptions');
 console.log('QR590_SOURCE_FIVE_GATED_ROUTES_CHROME_SSR_ROBOTS_AND_PRIVACY_PASS');
}finally{await ctx.close();await browser.close();}
