// 08 WEB controlled build HTTP STATUS observation, not a managed HTTPS/DNS claim.
// Serves only actual adapter-static files and returns genuine HTTP 404 for fallback.
// Never pretends client hydration, a handle parser or /web alias is HTTP 200/301.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright-core';
import {
 OWNER_CUSTOM_DOMAIN, PUBLIC_STATIC_CANONICAL_PATHS,
 PUBLIC_ENTITY_HTTP200_ACCEPTED, PUBLIC_USER_PROFILE_HTTP200_ACCEPTED,
 PUBLIC_ALIAS_REDIRECTS_ACCEPTED
} from '../src/lib/foundation/canonical-domain-preview.mjs';
const executablePath=process.env.CHROME_BIN;
if(!executablePath)throw Error('CHROME_BIN_REQUIRED');
const base=process.env.WAND_HOST_TEST_BASE_PATH ?? '';
if(base!=='' && base!=='/web')throw Error('UNAPPROVED_TEST_BASE');
const expectedCanonical=base==='' ? OWNER_CUSTOM_DOMAIN : null;
const prefix=base ? base+'/' : '/';
const root=resolve('build');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml',
 '.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2',
 '.jpg':'image/jpeg','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'});res.end();return;}
 let path;
 try{path=decodeURIComponent(new URL(req.url||'/','http://127.0.0.1').pathname);}
 catch{res.writeHead(400);res.end();return;}
 if(!path.startsWith(prefix)||path.includes('\0')||path.includes('\\')||path.includes('//')){
  res.writeHead(404);res.end();return;
 }
 const suffix=path.slice(prefix.length);
 if(suffix.split('/').includes('..')||suffix.split('/').includes('.')){
  res.writeHead(404);res.end();return;
 }
 const file=resolve(root,suffix+(suffix===''||suffix.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+sep)){
  res.writeHead(404);res.end();return;
 }
 try{
  const bytes=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(bytes);
 }catch{
  // Pages-style 404 *body* retains 404 status: NEVER make it SEO HTTP 200.
  res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  try{res.end(await readFile(resolve(root,'404.html')));}catch{res.end('Not Found');}
 }
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',request=>{
 if(request.method()!=='GET'||new URL(request.url()).origin!==origin)
  writes.push(request.method()+' '+request.url());
});
const paths=[
 ['/',200],['collection/',200],['decorate/',200],['help/',200],
 ['40000047/',404],['40000047/40000048/',404],
 ['ja/40000047/',404],['ja/40000047/40000048/',404],
 ['users/example_123/',404],['users/admin/',404],
 ['library/',404],['library/presets/',404],['community-lab/fake/',404],
 ['collection',404] // No fabricated 301: redirect needs separate actual host gate.
];
try{
 for(const [path,status] of paths){
  const u=origin+prefix+(path==='/'?'':path);
  const response=await fetch(u,{redirect:'manual'});
  assert.equal(response.status,status,base+' '+path);
  assert.equal(response.headers.get('location'),null,base+' no unapproved redirect '+path);
  if(status===404)assert.match(await response.text(),/<html/i,'real 404 body, no 200 fallback');
 }
 assert.equal(PUBLIC_ENTITY_HTTP200_ACCEPTED,false);
 assert.equal(PUBLIC_USER_PROFILE_HTTP200_ACCEPTED,false);
 assert.equal(PUBLIC_ALIAS_REDIRECTS_ACCEPTED,false);
 console.log('WEB_CANONICAL_HOST_ACTUAL_LOCAL_HTTP_200_404_NO_301_PASS base='+JSON.stringify(base));

 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const route of ['', 'collection/']){
  const result=await page.goto(origin+prefix+route,{waitUntil:'domcontentloaded'});
  assert.equal(result.status(),200);
  const canonical=page.locator('link[rel="canonical"]');
  if(expectedCanonical){
   assert.equal(await canonical.count(),1,'one absolute canonical in owned-root preview');
   assert.equal(await canonical.getAttribute('href'),expectedCanonical+'/'+route);
  }else{
   assert.equal(await canonical.count(),0,'existing /web Pages never silently canonicalizes to unverified live host');
  }
  for(const locale of locales){
   await page.selectOption('#site-locale',locale);
   await page.waitForFunction(code=>document.documentElement.dataset.locale===code,locale);
   assert.equal(await canonical.count(),expectedCanonical?1:0);
   if(expectedCanonical)assert.equal(await canonical.getAttribute('href'),expectedCanonical+'/'+route);
  }
 }
 console.log('WEB_CANONICAL_HOST_ROOT_AND_PAGES_EIGHT_LOCALE_CANONICAL_SCOPE_PASS base='+JSON.stringify(base));

 await page.setViewportSize({width:320,height:850});
 for(const path of ['', 'collection/']){
  await page.goto(origin+prefix+path,{waitUntil:'domcontentloaded'});
  const width=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(width.scroll<=width.client+2,base+' '+path+' mobile '+JSON.stringify(width));
 }
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 const width=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(width.scroll<=width.client+2,base+' 200% '+JSON.stringify(width));
 await page.locator('#site-locale').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'site-locale');
 console.log('WEB_CANONICAL_HOST_320_ZOOM200_KEYBOARD_PASS base='+JSON.stringify(base));
 assert.deepEqual(writes,[],'no POST/external origin/Cloud/provider');
 assert.deepEqual(errors,[],'no JavaScript errors');
 console.log('WEB_CANONICAL_HOST_NO_UPLOAD_OR_UNVERIFIED_PUBLIC_ROUTE_PASS base='+JSON.stringify(base));
 console.log('WEB_CANONICAL_HOST_MANAGED_HTTPS_DNS_301_STATUS_NOT_RUN');
}finally{
 await context.close();await browser.close();
 await new Promise((resolveClose,reject)=>server.close(err=>err?reject(err):resolveClose()));
}
