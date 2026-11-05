// 04 QR-W independent deployed GitHub Pages POST-MERGE negative: DreamSnaps legacy children SEO/Privacy.
// New boundary relative accepted QA583 root+Community; no private P1G, credentials, media, Provider or Writer.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const MAIN='96b95972be5bcbaecf9e5656d885ce64d64aa13a';
const ORIGIN='https://dreamwishwand.github.io', BASE=ORIGIN+'/web';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
if(!process.env.CHROME_BIN)throw Error('QA_NOT_RUN_REAL_SYSTEM_CHROME_REQUIRED');
for(const name of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 if(process.env[name])throw Error('QA_PRIVATE_OWNER_SAVE_NOT_AUTHORIZED_IN_SHARED_CI: '+name);
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').trim().split('\n').sort(),
 ['.github/workflows/04qr-w-main96b-dreamsnaps-child-robots.yml',
  'scripts/04qr-w-main96b-dreamsnaps-child-robots.mjs'].sort(),
 'only independent QA files; no Stage1 Source or publishing toggles');
const children=[
 {path:'/dreamsnaps/submit/',blob:'29e34bde7d9d195c066fec050603af0ba919568e',role:'submission/creator account'},
 {path:'/dreamsnaps/judge/',blob:'78901cda868cb774813dc5c09237cfaac98d3617',role:'judging/voting'},
 {path:'/dreamsnaps/results/',blob:'47ef8d8688346b4fec6f8ee3a258c9e1cd17291e',role:'unaccepted official results'},
 {path:'/dreamsnaps/my/',blob:'2ae9826509c0dd9cfbb95b7242bd87bb94f1ad29',role:'private account results'}
];
for(const x of children)
 assert.equal(git('rev-parse',MAIN+':src/routes'+x.path+'+page.svelte'),x.blob,
 'frozen Child Source SHA '+x.path);
assert.equal(git('rev-parse',MAIN+':src/routes/dreamsnaps/community/+page.svelte'),
 '9791d44a3443dece99b815724c955e855dafb6e2');
// Allow either strict X-Robots-Tag response header or early-rendered static meta in real HTML.
// HTML content must be withheld from indexing by default while creator rights/results publication remain gated.
const robotsTag=/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])(?=[^>]*\bcontent\s*=\s*["'][^"']*\bnoindex\b)[^>]*>/i;
const missing=[],httpErrors=[],screens=[];
for(const child of children){
 const response=await fetch(BASE+child.path,{redirect:'manual'});
 const html=await response.text();
 const code=response.status;
 const header=response.headers.get('x-robots-tag')??'';
 const rawMeta=robotsTag.test(html);
 const blockedByRobots=rawMeta||/\bnoindex\b/i.test(header);
 if(code!==200||!/text\/html/i.test(response.headers.get('content-type')??'')||html.length<200)
  httpErrors.push(child.path+': HTTP='+code+' content-type='+response.headers.get('content-type'));
 if(!blockedByRobots)missing.push(child.path+' ('+child.role+')');
 console.log('QR_MAIN96B_PRIVATE_CHILD_REMOTE '+child.path+
  ' HTTP'+code+' STATIC_META_NOINDEX='+rawMeta+' X_ROBOTS_NOINDEX='+(/\bnoindex\b/i.test(header)));
 screens.push({path:child.path,raw:rawMeta,header,code});
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:320,height:780},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),networkBlocked=[],pageErrors=[];
page.on('pageerror',x=>pageErrors.push(String(x)));
if(typeof page.routeWebSocket!=='function')throw Error('QA_NOT_RUN_WS_BLOCKING_UNSUPPORTED');
await page.routeWebSocket('**/*',route=>{networkBlocked.push('WS '+route.url());route.close();});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{networkBlocked.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
try{
 for(const child of children){
  const response=await page.goto(BASE+child.path,{waitUntil:'networkidle',timeout:45000});
  assert.equal(response?.status(),200,'actual child route direct Page HTTP200');
  const renderedRobots=await page.locator('meta[name="robots"]').evaluateAll(nodes=>nodes.map(n=>n.content));
  const clientWidth=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  if(clientWidth.scroll>clientWidth.client+2)httpErrors.push(child.path+': 320px horizontal overflow '+JSON.stringify(clientWidth));
  const personal=await page.locator('.entry,.official-card,.card img,.grid img').count();
  // No anonymous personal media or results should appear from private data in gated public test Pages.
  if(personal)httpErrors.push(child.path+': anonymous personal media/result card count='+personal);
  console.log('QR_MAIN96B_PRIVATE_CHILD_CHROME '+child.path+' RENDERED_ROBOTS='+JSON.stringify(renderedRobots)+
   ' MEDIA_RESULT_CARDS='+personal);
 }
}finally{await ctx.close();await browser.close();}
console.log('QR_MAIN96B_PRIVATE_CHILD_SEO_SUMMARY '+JSON.stringify({missingRobots:missing,httpErrors,blockedRequests:networkBlocked,pageErrors}));
assert.deepEqual(httpErrors,[],'current public test Pages direct child route and anonymous safety conditions');
assert.deepEqual(networkBlocked,[],'no offsite Provider, POST, WebSocket or Writer/Publish RPC');
assert.deepEqual(pageErrors,[],'no browser page errors');
assert.deepEqual(missing,[],'P0 SEO/Privacy FAIL: non-public DreamSnaps child routes require noindex in actual HTTP response HTML or X-Robots-Tag, not just gated client widgets');
console.log('QR_MAIN96B_CHILD_ROBOTS_ALL_FOUR_DEPLOYED_PAGES_PASS');