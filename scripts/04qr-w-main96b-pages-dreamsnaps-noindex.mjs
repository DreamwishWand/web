// 04 QR-W independent post-merge ACTUAL GitHub Pages /DreamSnaps/ and /Community/ SEO/privacy gate.
// Fixed protected main96b deployed, NOT original local Source QA573; no Owner private Save or Writer.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {dreamsnapsStage1Copy,DREAMSNAPS_STAGE1_DESTINATIONS,
 DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,DREAMSNAPS_STAGE1_WRITER_ENABLED}
 from '../src/lib/community/dreamsnaps-stage1-root.mjs';
const MAIN='96b95972be5bcbaecf9e5656d885ce64d64aa13a';
const ORIGIN='https://dreamwishwand.github.io',BASE=ORIGIN+'/web';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
if(!process.env.CHROME_BIN)throw Error('QA_NOT_RUN_ACTUAL_SYSTEM_CHROME_MISSING');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QA_PRIVATE_P1G_MUST_NOT_BE_IN_SHARED_PUBLIC_CI');
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').trim().split('\n').sort(),
 ['.github/workflows/04qr-w-main96b-pages-dreamsnaps-noindex.yml',
  'scripts/04qr-w-main96b-pages-dreamsnaps-noindex.mjs'].sort(),'QA only, no product/public Pages mutation');
for(const [path,blob] of Object.entries({
 'src/routes/dreamsnaps/+page.svelte':'0622998c3b0d0c45ad0597c998cf3ec2707b1022',
 'src/routes/dreamsnaps/community/+page.svelte':'9791d44a3443dece99b815724c955e855dafb6e2',
 'src/lib/community/dreamsnaps-stage1-root.mjs':'51d8fdb905e3b55814caed2819e579a47b41425c',
 'src/routes/+page.svelte':'173d7b128b22db16fb2478961fcd60205754a293'
}))assert.equal(git('rev-parse',MAIN+':'+path),blob);
assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.id),
 ['community','submit','judge','results','my']);
assert.equal(DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,false);
assert.equal(DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,false);
assert.equal(DREAMSNAPS_STAGE1_WRITER_ENABLED,false);
async function requirePublicHtml(path,find){
 const response=await fetch(BASE+path,{redirect:'manual'});
 assert.equal(response.status,200,'HTTP200 must be direct prerender for '+path+', no fallback404');
 assert.match(response.headers.get('content-type')??'',/text\/html/i);
 const html=await response.text();
 assert.match(html,find,'not a generic fallback/404 '+path);
 assert.ok(html.length>300);
 return html;
}
await requirePublicHtml('/',/Dreamwish Wand/i);
await requirePublicHtml('/dreamsnaps/',/DreamSnaps/i);
const communityRaw=await requirePublicHtml('/dreamsnaps/community/',/noindex,nofollow/);
assert.match(communityRaw,/<meta\s+name=["']robots["']\s+content=["']noindex,nofollow["']/i,
 'real direct CDN HTML for gated Community must itself contain robots noindex, not JS-only claim');
console.log('QR_MAIN96B_PAGES_HOME_DREAMSNAPS_COMMUNITY_DIRECT_HTTP200_STATIC_NOINDEX_PASS');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),blocked=[],errors=[];
page.on('pageerror',err=>errors.push(String(err)));
if(typeof page.routeWebSocket!=='function')throw Error('QA_WEBSOCKET_BOUNDARY_REQUIRED');
await page.routeWebSocket('**/*',route=>{blocked.push('WS '+route.url());route.close();});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{blocked.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
async function fit(label){
 const r=await page.evaluate(()=>({view:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(r.scroll<=r.view+2,label+': '+JSON.stringify(r));
}
try{
 const resp=await page.goto(BASE+'/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(resp?.status(),200);
 const home=page.locator('.home-product-grid a.visual-card[href="/web/dreamsnaps/"]');
 await home.waitFor({state:'visible',timeout:30000});
 assert.equal(await page.locator('.home-product-grid a.visual-card').count(),6);
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(()=>document.documentElement.dataset.locale==='ja',{timeout:18000});
 await home.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/web/dreamsnaps/');
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/web\/dreamsnaps\/$/,{timeout:20000});
 const root=page.locator('[data-stage1-dreamsnaps-root="1-3-1"]');
 await root.waitFor({state:'visible',timeout:25000});
 for(const att of ['data-public-provider','data-writer','data-private-results'])assert.equal(await root.getAttribute(att),'off',att);
 assert.equal(await root.getAttribute('data-media-rights'),'unverified');
 assert.deepEqual(await root.locator('[data-dreamsnaps-child]').evaluateAll(a=>a.map(x=>x.getAttribute('data-dreamsnaps-child'))),
  ['community','submit','judge','results','my']);
 assert.deepEqual(await root.locator('[data-dreamsnaps-child]').evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),
  ['/web/dreamsnaps/community/','/web/dreamsnaps/submit/','/web/dreamsnaps/judge/',
   '/web/dreamsnaps/results/','/web/dreamsnaps/my/']);
 assert.equal(await root.locator('img,video,iframe,form').count(),0);
 console.log('QR_MAIN96B_PAGES_HOME_KEYBOARD_TO_DREAMSNAPS_FIVE_CANONICAL_131_PRIVACY_OFF_PASS');
 const communityLink=root.locator('[data-dreamsnaps-child="community"]');
 await communityLink.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-dreamsnaps-child')),'community');
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/web\/dreamsnaps\/community\/$/,{timeout:20000});
 const community=page.locator('[data-community-dreamsnaps="gated"]');
 await community.waitFor({state:'visible',timeout:22000});
 const robots=page.locator('meta[name="robots"]');
 assert.equal(await robots.getAttribute('content'),'noindex,nofollow');
 for(const att of ['data-public-provider','data-writer','data-private-results'])assert.equal(await community.getAttribute(att),'off');
 assert.equal(await community.getAttribute('data-media-rights'),'unverified');
 assert.deepEqual((await community.locator('.public-modes > span').allTextContents()).map(x=>x.trim()),
  [dreamsnapsStage1Copy('ja').allWorks,dreamsnapsStage1Copy('ja').byChallenge]);
 assert.equal(await community.locator('.public-modes button,.public-modes a').count(),0);
 await community.locator('.unavailable[role="status"]').waitFor({state:'visible'});
 assert.equal(await community.locator('img,video,iframe,form,input,button').count(),0);
 assert.equal(await community.locator('a.back').getAttribute('href'),'/web/dreamsnaps/');
 console.log('QR_MAIN96B_PAGES_GATED_COMMUNITY_ACTUAL_NOINDEX_STATIC_AND_HYDRATED_NO_WORKS_PASS');
 await page.setViewportSize({width:320,height:780});
 await fit('Community 320px');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('Community 200%');
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>5000);
 console.log('QR_MAIN96B_PAGES_DREAMSNAPS_COMMUNITY_RAM_SCREENSHOT_SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 assert.deepEqual(blocked,[],'public Pages must not open Provider/POST/WS or offsite requests');
 assert.deepEqual(errors,[],'CDN-hosted app must have zero page errors');
 console.log('QR_MAIN96B_PAGES_DREAMSNAPS_PUBLIC_CDN_320_200_NO_EXTERNAL_OR_WRITER_PASS');
}finally{await ctx.close();await browser.close();}
