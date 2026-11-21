// Independent 04 QR-W post-main0ec ACTUAL GitHub Pages Gallery root + private My Gallery SEO boundary.
// Never upload P1G or contact Provider; this is a public test-site presentational/robots assessment.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {stage1GalleryCopy,STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED} from '../src/lib/community/gallery-stage1-root.mjs';
const MAIN='0ec67476e6c358f810c310ed257bc4986128bc79';
const ORIGIN='https://dreamwishwand.github.io',BASE=ORIGIN+'/web';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(!process.env.CHROME_BIN)throw Error('QA_NOT_RUN_REAL_CHROME_REQUIRED');
for(const key of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 if(process.env[key])throw Error('QA_SHARED_CI_OWNER_PRIVATE_P1G_FORBIDDEN_'+key);
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').trim().split('\n').sort(),
 ['.github/workflows/04qr-w-main0ec-gallery-public-my-robots.yml',
 'scripts/04qr-w-main0ec-gallery-public-my-robots.mjs'].sort());
for(const [path,sha] of Object.entries({
 'src/routes/gallery/+page.svelte':'22a2ca880708487211f8bbaa88ccdb7924770371',
 'src/lib/community/gallery-stage1-root.mjs':'a53e579198678a1ff064facdb9a3f7bcf8eb8a0c',
 'src/routes/gallery/my/+page.svelte':'9037749b5e532b9a0cba6064e0aea62159a02c67',
 'src/routes/+page.svelte':'173d7b128b22db16fb2478961fcd60205754a293'
}))assert.equal(git('rev-parse',MAIN+':'+path),sha);
assert.equal(STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,false);
assert.equal(STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,false);
const hasStaticNoindex=(html,header)=>/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])(?=[^>]*\bcontent\s*=\s*["'][^"']*\bnoindex\b)[^>]*>/i.test(html)
 ||/\bnoindex\b/i.test(header??'');
async function directPage(path){
 const r=await fetch(BASE+path,{redirect:'manual'});
 const html=await r.text();
 assert.equal(r.status,200,'actual Pages path HTTP200 '+path);
 assert.match(r.headers.get('content-type')??'',/text\/html/);
 assert.ok(html.length>300);
 return {html,header:r.headers.get('x-robots-tag')??''};
}
const rawGallery=await directPage('/gallery/');
assert.match(rawGallery.html,/Gallery/i);
const rawMy=await directPage('/gallery/my/');
const myNoindex=hasStaticNoindex(rawMy.html,rawMy.header);
console.log('QR_MAIN0EC_GALLERY_REMOTE_HTTP200_ROOT_AND_MY_PASS');
console.log('QR_MAIN0EC_GALLERY_MY_STATIC_NOINDEX='+myNoindex+' X_ROBOTS='+rawMy.header);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage(),errors=[],blocked=[];
page.on('pageerror',error=>errors.push(String(error)));
if(typeof page.routeWebSocket!=='function')throw Error('QA_WEBSOCKET_BOUNDARY_REQUIRED');
await page.routeWebSocket('**/*',route=>{blocked.push('WS '+route.url());route.close();});
await page.route('**/*',route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin===ORIGIN&&['GET','HEAD'].includes(r.method()))route.continue();
 else{blocked.push(r.method()+' '+r.url());route.abort('blockedbyclient');}
});
async function fit(label){
 const r=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(r.scroll<=r.client+2,label+': '+JSON.stringify(r));
}
let chromeMyNoindex=false;
try{
 const home=await page.goto(BASE+'/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(home?.status(),200);
 const link=page.locator('.home-product-grid a.visual-card[href="/web/gallery/"]');
 await link.waitFor({state:'visible',timeout:30000});
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(()=>document.documentElement.dataset.locale==='ja',{timeout:18000});
 await link.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/web/gallery/');
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/web\/gallery\/$/,{timeout:20000});
 const root=page.locator('[data-stage1-gallery-root]');
 await root.waitFor({state:'visible',timeout:20000});
 assert.equal(await root.getAttribute('data-writer'),'off');
 assert.equal(await root.getAttribute('data-public-eligibility'),'provider-gated');
 assert.equal(await root.getAttribute('data-media-rights'),'unverified');
 assert.deepEqual(await root.locator('[data-gallery-child]').evaluateAll(a=>a.map(x=>x.getAttribute('data-gallery-child'))),
  ['decorations','touchOfMagic','myGallery']);
 assert.equal(await root.locator('.gallery-hub-card.prominent').count(),1);
 assert.equal(await root.locator('img,video,iframe').count(),0);
 assert.equal(await page.locator('a[href*="/gallery/dreamsnaps/"]').count(),0);
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(loc);
  await page.waitForFunction(locale=>document.documentElement.dataset.locale===locale,loc,{timeout:18000});
  const ux=stage1GalleryCopy(loc);
  assert.deepEqual((await root.locator('[data-gallery-child] strong').allTextContents()).map(s=>s.trim()),
   [ux.decorations,ux.tom,ux.mine],loc+' real hosted Gallery 3 card labels');
 }
 console.log('QR_MAIN0EC_HOSTED_GALLERY_HOME_LINK_THREE_CARD_EIGHT_LOCALE_OFF_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await root.locator('[data-gallery-child="decorations"]').click();
 await root.locator('[data-stage1-gallery-facets] button').first().waitFor({state:'visible'});
 assert.equal(await root.locator('[data-stage1-gallery-facets] button').count(),3);
 assert.equal(await root.locator('[data-gallery-subtype="decorations"]').count(),0,'no Provider configured: do not fabricate public Works');
 await root.locator('.gallery-back').click();
 await root.locator('[data-gallery-child="touchOfMagic"]').click();
 await root.locator('[data-stage1-gallery-facets] button').first().waitFor({state:'visible'});
 assert.equal(await root.locator('[data-stage1-gallery-facets] button').count(),3);
 await root.locator('.gallery-back').click();
 console.log('QR_MAIN0EC_HOSTED_GALLERY_DECORATIONS_TOM_NO_UNVERIFIED_PUBLIC_MEDIA_PASS');
 const myLink=root.locator('[data-gallery-child="myGallery"]');
 assert.equal(await myLink.getAttribute('href'),'/web/gallery/my/');
 await myLink.focus();
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/web\/gallery\/my\/$/,{timeout:20000});
 const c=await page.locator('meta[name="robots"]').evaluateAll(nodes=>nodes.map(x=>x.content));
 chromeMyNoindex=c.some(x=>/\bnoindex\b/i.test(x));
 const privateCards=await page.locator('.columns .entry,.columns .row,.image img').count();
 assert.equal(privateCards,0,'anonymous My Gallery must not reveal personal/saved Works');
 console.log('QR_MAIN0EC_GALLERY_MY_CHROME_ROBOTS='+JSON.stringify(c)+' PRIVATE_WORKS='+privateCards);
 await page.setViewportSize({width:320,height:780});
 await fit('My Gallery 320px');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('My Gallery 200 percent');
 const screenshot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(screenshot.length>5000);
 console.log('QR_MAIN0EC_GALLERY_PRIVATE_RAM_SCREENSHOT_SHA '+createHash('sha256').update(screenshot).digest('hex').slice(0,16));
 assert.deepEqual(blocked,[],'never offhost GET/POST/WS or Cloud/Provider');
 assert.deepEqual(errors,[],'actual CDN must not throw browser page errors');
 console.log('QR_MAIN0EC_GALLERY_HOSTED_ROOT_8LOCALE_AND_MY_ANONYMOUS_NO_EXTERNAL_IO_PASS');
}finally{await context.close();await browser.close();}
assert.ok(myNoindex||chromeMyNoindex,
 'P0 SEO Privacy: account-only My Gallery accessible through new Gallery root is HTTP200 but lacks raw/static or rendered robots noindex, and lacks X-Robots-Tag; no personal result disclosure observed');
console.log('QR_MAIN0EC_GALLERY_MY_NOINDEX_PASS');