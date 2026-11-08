// 04 QR-W / PR780: NEW_ONLY actual prerendered static HTTP and canonical host gate.
// No DNS/TLS changes, no public media, no account secrets. QA-only audit paths.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {
 OWNER_CUSTOM_DOMAIN, EXISTING_PAGES_BASE_PATH,
 PUBLIC_STATIC_CANONICAL_PATHS, PUBLIC_ENTITY_HTTP200_ACCEPTED,
 PUBLIC_USER_PROFILE_HTTP200_ACCEPTED,PUBLIC_ALIAS_REDIRECTS_ACCEPTED,
 canonicalForApprovedStaticPath,inspectCustomDomainPath
} from '../src/lib/foundation/canonical-domain-preview.mjs';
const SOURCE='ccd5a96bd7187a777f5853c970dc0547bbbe7d06';
const ORIGINAL_PARENT='b7d86d47125f1764919b67898c39badaf35976d8';
const sourceBlobs=new Map([
 ['.github/workflows/web-canonical-domain-preflight.yml','4c602af22e482a47c9c6706df043e6f88ded5f29'],
 ['scripts/web-canonical-domain-preflight-chrome.mjs','492c33186477f218a19f0d1ef0202c53484ef6f8'],
 ['src/lib/foundation/canonical-domain-preview.mjs','bb6b7354a19f896bde3c92bcc6d8cb905b983cf7'],
 ['src/routes/+layout.server.js','445554fd27f3ab7425301fb7d457c366d3810377'],
 ['src/routes/+layout.svelte','c851f4aee9beb40e823d101550e316612f456b4'],
 ['tests/web-canonical-domain-preflight.test.mjs','31fa1cd29b6e7ddc2a6960c5b3c9df0a4d83cce5']
]);
const qaOnly=[
 '.github/workflows/04qr-w-pr780-canonical-http-newonly-20261108.yml',
 'scripts/04qr-w-pr780-canonical-http-newonly-20261108.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const paths=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',ORIGINAL_PARENT,SOURCE),ORIGINAL_PARENT);
assert.deepEqual(paths(ORIGINAL_PARENT,SOURCE),[...sourceBlobs.keys()].sort(),'Source exact six only');
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(paths(SOURCE,'HEAD'),qaOnly,'only QA new files');
for(const [name,sha] of sourceBlobs){
 assert.equal(git('rev-parse',SOURCE+':'+name),sha,'Source frozen git blob '+name);
 assert.equal(git('hash-object',name),sha,'product Source edited: '+name);
}
assert.equal(git('diff','--name-only',ORIGINAL_PARENT,SOURCE,'--','svelte.config.js','.github/workflows/pages.yml','static/CNAME','src/routes/users/','src/routes/library/'), '');
for(const key of ['DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK'])
 assert.ok(!process.env[key],key+' must be absent in public CI');
console.log('QRW780_FIXED_ORIGINAL_SOURCE6_QA_ONLY2_NO_PAGES_DNS_PRIVACY_SOURCE_DIFF_PASS');

assert.equal(OWNER_CUSTOM_DOMAIN,'https://dreamwishwand.com');
assert.equal(EXISTING_PAGES_BASE_PATH,'/web');
assert.equal(PUBLIC_ENTITY_HTTP200_ACCEPTED,false);
assert.equal(PUBLIC_USER_PROFILE_HTTP200_ACCEPTED,false);
assert.equal(PUBLIC_ALIAS_REDIRECTS_ACCEPTED,false);
assert.equal(PUBLIC_STATIC_CANONICAL_PATHS.length,10);
for(const path of PUBLIC_STATIC_CANONICAL_PATHS){
 assert.equal(canonicalForApprovedStaticPath(path,{basePath:'',origin:OWNER_CUSTOM_DOMAIN}),OWNER_CUSTOM_DOMAIN+path);
 assert.equal(inspectCustomDomainPath(path).authoritativeStatus,null);
 assert.equal(inspectCustomDomainPath(path).eligibleForPublicIndex,false);
 for(const [basePath,origin] of [
  ['/web',OWNER_CUSTOM_DOMAIN],['', ''],['','http://dreamwishwand.com'],
  ['','https://www.dreamwishwand.com'],['','https://dreamwishwand.com.evil.invalid'],
  ['','https://dreamwishwand.com/'],['/WEB',OWNER_CUSTOM_DOMAIN]
 ])assert.equal(canonicalForApprovedStaticPath(path,{basePath,origin}),null,'foreign/unapproved '+path+' '+origin);
}
const closed=[
 '/web/','/collection','/collection//','/collection/../','/collection/?a=b',
 '/collection/%2f','/users/admin/','/users/verified_01/','/library/',
 '/library/presets/','/40000047/','/40000047/40000048/','/ja/40000047/',
 '/en/users/verified_01/','/gallery/me/','/community-lab/',
 '/editor/world/','/hidden-creator/','//collection/','/discover#something',
 '/presets/%252e%252e/'
];
for(const path of closed)
 assert.equal(canonicalForApprovedStaticPath(path,{basePath:'',origin:OWNER_CUSTOM_DOMAIN}),null,'unapproved canonical '+path);
for(const path of ['/40000047/','/40000047/40000048/','/users/admin/','/library/']){
 const receipt=inspectCustomDomainPath(path);
 assert.equal(receipt.authoritativeStatus,null);
 assert.equal(receipt.eligibleForPublicIndex,false);
}
console.log('QRW780_ROOT_ALLOWLIST_FOREIGN_HOST_UNACCEPTED_ENTITY_PRIVACY_NO_AUTH_STATUS_PASS');

const base=process.env.QRW780_BASE_PATH??'';
const root=resolve('build');
assert.ok(['','/web'].includes(base),'only two explicit static build bases');
const prefix=base?base+'/':'/';
const expectedCanon=base===''?OWNER_CUSTOM_DOMAIN:null;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json',
 '.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png',
 '.webp':'image/webp','.ico':'image/x-icon'};
const http=createServer(async(req,res)=>{
 if(req.method!=='GET'){
  res.writeHead(405,{'Allow':'GET'});res.end();return;
 }
 let path;
 try{path=decodeURIComponent(new URL(req.url||'/', 'http://127.0.0.1').pathname);}
 catch{res.writeHead(400);res.end();return;}
 if(!path.startsWith(prefix)||path.includes('\\')||path.includes('\0')||path.includes('//')){
  res.writeHead(404);res.end();return;
 }
 let tail=path.slice(prefix.length);
 if(tail.split('/').some(x=>x==='..'||x==='.')){res.writeHead(404);res.end();return;}
 const filename=resolve(root,tail+(tail===''||tail.endsWith('/')?'index.html':''));
 if(!filename.startsWith(root+sep)){res.writeHead(404);res.end();return;}
 try{
  const b=await readFile(filename);
  res.writeHead(200,{'Content-Type':mime[extname(filename)]||'application/octet-stream',
    'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
  res.end(b);
 }catch{
  res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});
  try{res.end(await readFile(resolve(root,'404.html')));}catch{res.end('Not Found');}
 }
});
await new Promise(ok=>http.listen(0,'127.0.0.1',ok));
const host='http://127.0.0.1:'+http.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},
 serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const badNetwork=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',route=>{
 const request=route.request(),u=new URL(request.url());
 if(u.origin!==host||!['GET','HEAD'].includes(request.method())){
  badNetwork.push(request.method()+' '+u.href);return route.abort('blockedbyclient');
 }
 route.continue();
});
const canonicalTags=html=>[...html.matchAll(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi)].map(x=>x[0]);
const loc=path=>host+prefix+path;
try{
 for(const path of PUBLIC_STATIC_CANONICAL_PATHS){
  const suffix=path.slice(1);
  const u=loc(suffix);
  const res=await fetch(u,{redirect:'manual'});
  assert.equal(res.status,200,'prerender route must be actual local HTTP200 '+path+' base='+base);
  assert.equal(res.headers.get('location'),null,'never fabricate redirect');
  assert.match(res.headers.get('content-type')??'',/text\/html/i);
  const html=await res.text();
  const tags=canonicalTags(html);
  if(expectedCanon){
   assert.equal(tags.length,1,'canonical must be in original RESPONSE HTML '+path);
   assert.ok(tags[0].includes('href="'+expectedCanon+path+'"'),'exact absolute canonical '+path);
  }else assert.equal(tags.length,0,'legacy /web published Pages cannot silently canonicalize '+path);
 }
 console.log('QRW780_ALL_TEN_ACTUAL_PRERENDER_STATIC_HTTP200_CANONICAL_OPTIN_OWNED_OR_PAGES_DENY_PASS base='+JSON.stringify(base));
 const negative=[
  'collection','users/admin/','users/example_123/','ja/users/example_123/',
  '40000047/','40000047/40000048/','ja/40000047/',
  'en/40000047/','library/','library/presets/',
  'gallery/my/','community-lab/fake/','__not_static__/','robots-private-file/',
 ];
 for(const path of negative){
  const response=await fetch(loc(path),{redirect:'manual'});
  assert.equal(response.status,404,'static 404 body must NOT be SEO 200 '+path+' base='+base);
  assert.equal(response.headers.get('location'),null,'client or alias may not fabricate 301 '+path);
  const html=await response.text();
  assert.match(html,/<html/i,'must retain fallback body while preserving real HTTP404');
 }
 const noRedirect=await fetch(loc('collection'),{redirect:'manual'});
 assert.equal(noRedirect.status,404,'missing slash no implicit 301 or invented 200');
 assert.equal(noRedirect.headers.get('location'),null);
 const attempt=await fetch(loc('collection/'),{method:'POST',redirect:'manual'});
 assert.equal(attempt.status,405);
 assert.equal(attempt.headers.get('allow'),'GET');
 console.log('QRW780_DYNAMIC_PRIVATE_ALIAS_AND_SPA_FALLBACK_REAL_HTTP404_NO_FABRICATED_301_200_PASS base='+JSON.stringify(base));
 const localeCodes=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const suffix of ['','collection/']){
  const result=await page.goto(loc(suffix),{waitUntil:'domcontentloaded'});
  assert.equal(result.status(),200);
  let tags=page.locator('link[rel="canonical"]');
  assert.equal(await tags.count(),expectedCanon?1:0);
  for(const language of localeCodes){
   await page.selectOption('#site-locale',language);
   await page.waitForFunction(code=>document.documentElement.dataset.locale===code,language);
   assert.equal(await tags.count(),expectedCanon?1:0,'locale may not change root canonical count');
   if(expectedCanon)assert.equal(await tags.first().getAttribute('href'),expectedCanon+'/'+suffix);
  }
 }
 console.log('QRW780_ACTUAL_BROWSER_EIGHT_LOCALES_CANONICAL_NO_HOST_SIDE_STALE_REWRITE_PASS base='+JSON.stringify(base));
 for(const [width,zoom] of [[320,1],[640,2]]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(v=>{document.documentElement.style.zoom=String(v);},zoom);
  const bounds=await page.evaluate(()=>({c:document.documentElement.clientWidth,
   s:document.documentElement.scrollWidth}));
  assert.ok(bounds.s<=bounds.c+2,'reflow document '+width+' zoom '+zoom+' '+JSON.stringify(bounds));
  const first=page.locator('a:visible').first();
  await first.focus();
  assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A');
  const canonical=page.locator('link[rel="canonical"]');
  assert.equal(await canonical.count(),expectedCanon?1:0);
 }
 console.log('QRW780_ACTUAL_CHROME_320_640CSS200_KEYBOARD_LINK_AND_CANONICAL_PRESERVED_PASS base='+JSON.stringify(base));
 assert.deepEqual(badNetwork,[],'no offhost or POST via real Chrome');
 assert.deepEqual(errors,[],'no browser JavaScript errors');
 assert.equal(expectedCanon===null,base==='/web');
 console.log('QRW780_INDEPENDENT_STATIC_PREVIEW_NO_OFFHOST_POST_PAGES_PUBLIC_CONFIG_UNCHANGED_SCOPED_PASS base='+JSON.stringify(base));
}finally{
 await context.close();await browser.close();
 await new Promise((ok,reject)=>http.close(e=>e?reject(e):ok()));
}
