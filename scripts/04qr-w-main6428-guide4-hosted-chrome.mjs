// 04 QR-W independent post-merge PUBLIC TEST Pages Guide4 smoke, fixed protected main6428.
// Source PR605 / independent local QA606 inherited; this checks only NEW managed HTTPS/deployed risk.
// No private Save, game art publishing, Writer, Provider or Community release.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {
  GUIDE_ROOT_SECTIONS, GUIDE_SYSTEM_CATEGORIES, GUIDE_SYSTEM_EVIDENCE_KEYS,
  GUIDE_SYSTEM_TARGET, guideTaxonomyLabel
} from '../src/lib/guide/stage1-systems-taxonomy.mjs';

const PREV='35d98696c7e989737621654c7b8031914dadfa6d';
const MAIN='6428d080786bf3b2035be86b945b1460dbf1452a';
const ORIGIN='https://dreamwishwand.github.io';
const BASE=ORIGIN+'/web';
const source=[
 'src/lib/guide/stage1-guide-ui.mjs',
 'src/lib/guide/stage1-systems-taxonomy.mjs',
 'src/routes/guide/+page.svelte',
 'tests/web-stage1-guide-four-root-systems.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-main6428-guide4-hosted-chrome.yml',
 'scripts/04qr-w-main6428-guide4-hosted-chrome.mjs'
].sort();
const blobs={
 'src/lib/guide/stage1-guide-ui.mjs':'bcc135cbbd416df10995181826f27b1df08b843d',
 'src/lib/guide/stage1-systems-taxonomy.mjs':'c6b73d41d519482fbc9150d6f9ae6340c24683a6',
 'src/routes/guide/+page.svelte':'cf50043c2b5de34f604c74fdc05fddcf2ea4257d',
 'tests/web-stage1-guide-four-root-systems.test.mjs':'898c577f26cb5703fbd3d7594e84c5924567b1b4'
};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.ok(process.env.CHROME_BIN,'NOT_RUN real installed Chrome required');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 assert.ok(!process.env[k],'Owner private Save forbidden: '+k);
assert.equal(git('merge-base',PREV,MAIN),PREV);
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-only',PREV,MAIN).split('\n').sort(),source);
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').split('\n').sort(),qa);
for(const [p,sha] of Object.entries(blobs))assert.equal(git('rev-parse',MAIN+':'+p),sha,p);
assert.deepEqual(GUIDE_ROOT_SECTIONS,['systems','quests','starPaths','events']);
assert.equal(GUIDE_SYSTEM_CATEGORIES.length,7);
assert.equal(GUIDE_SYSTEM_CATEGORIES.reduce((n,c)=>n+c.groups.length,0),21);
assert.equal(GUIDE_SYSTEM_EVIDENCE_KEYS.length,106);
assert.equal(GUIDE_SYSTEM_TARGET.publicArticlesApproved,0);
console.log('QR_MAIN6428_GUIDE_EXACT4_SOURCE_QA2_HASHES_PASS');

const response=await fetch(BASE+'/guide/',{redirect:'manual',headers:{'Cache-Control':'no-cache'}});
assert.equal(response.status,200,'deployed direct /web/guide/ HTTP200, not SPA fallback');
assert.match(response.headers.get('content-type')??'',/text\/html/i);
const html=await response.text();
assert.ok(html.length>500);
assert.match(html,/data-stage1-guide-four-root/,'actual Guide 4 root SSR, not old five-tab fallback');
assert.match(html,/<meta[^>]+name="robots"[^>]+content="noindex,nofollow"/i,'public Guide article rights gate');
assert.doesNotMatch(html,/data-guide-root="issues"/,'Issues cannot return to Guide');
console.log('QR_MAIN6428_GUIDE_DEPLOYED_HTTP200_REAL_PRERENDER_NOINDEX_PASS');

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:820},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage();
const denied=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN websocket denial interception unavailable');
await page.routeWebSocket('**/*',r=>{denied.push('WS '+r.url());r.close();});
await page.route('**/*',r=>{
 const req=r.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))r.continue();
 else {denied.push(req.method()+' '+req.url());r.abort('blockedbyclient');}
});
const focusEnter=async selector=>{
 const target=page.locator(selector).first();
 await target.focus();
 await page.keyboard.press('Enter');
};
const returnRoot=async()=>{
 await focusEnter('button.guide-return');
 await page.locator('[data-guide-browse]').waitFor({state:'hidden',timeout:12000});
};
const noOverflow=async tag=>{
 const p=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(p.scroll<=p.client+2,tag+' '+JSON.stringify(p));
};
try{
 const start=await page.goto(BASE+'/guide/',{waitUntil:'networkidle',timeout:55000});
 assert.equal(start?.status(),200);
 await page.locator('[data-stage1-guide-four-root]').waitFor({state:'visible'});
 assert.deepEqual(await page.locator('[data-guide-four-root] [data-guide-root]').evaluateAll(xs=>xs.map(x=>x.dataset.guideRoot)),GUIDE_ROOT_SECTIONS);
 assert.equal(await page.locator('[data-guide-root="issues"],[data-guide-browse="issues"]').count(),0);
 assert.equal(await page.locator('meta[name="robots"][content="noindex,nofollow"]').count(),1);
 assert.ok(await page.locator('a[href="/web/help/"]').count()>=1,'Issues routed to Help');
 assert.equal(await page.locator('[data-guide-reference-list],[data-guide-systems-seven]').count(),0,'4 cards initially, not old tab result');
 console.log('QR_MAIN6428_GUIDE_REMOTE_FOUR_ROOT_HELP_ROBOTS_PASS');
 await focusEnter('[data-guide-root="systems"]');
 await page.locator('[data-guide-systems-seven]').waitFor({state:'visible'});
 assert.deepEqual(await page.locator('[data-guide-systems-seven] [data-guide-system-category]').evaluateAll(xs=>xs.map(x=>x.dataset.guideSystemCategory)),GUIDE_SYSTEM_CATEGORIES.map(x=>x.id));
 for(const c of GUIDE_SYSTEM_CATEGORIES){
  await focusEnter('[data-guide-system-category="'+c.id+'"]');
  assert.deepEqual(await page.locator('[data-guide-systems-topic-groups] [data-guide-subgroup]').evaluateAll(xs=>xs.map(x=>x.dataset.guideSubgroup)),c.groups.map(x=>x.id));
  assert.equal(await page.locator('[data-guide-systems-topic-groups] a').count(),0,'no fake published Guide article');
 }
 const input=page.locator('[data-guide-browse="systems"] input[type="search"]');
 await input.fill('timebending');
 assert.deepEqual(await page.locator('[data-guide-systems-seven] [data-guide-system-category]').evaluateAll(xs=>xs.map(x=>x.dataset.guideSystemCategory)),['gathering']);
 await input.fill('not-a-real-expansion-or-article-987');
 assert.equal(await page.locator('[data-guide-systems-seven] [data-guide-system-category]').count(),0);
 await input.fill('');
 assert.equal(await page.locator('[data-guide-systems-seven] [data-guide-system-category]').count(),7);
 console.log('QR_MAIN6428_GUIDE_REMOTE_SYSTEMS7_21_SEARCH_UNKNOWN_PASS');
 await returnRoot();
 for(const loc of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(loc);
  await page.waitForFunction(l=>document.documentElement.dataset.locale===l,loc,{timeout:20000});
  assert.equal(await page.locator('[data-guide-root] strong').count(),4,loc+' four translated root labels');
  await focusEnter('[data-guide-root="systems"]');
  assert.equal((await page.locator('[data-guide-system-category="basics"] strong').innerText()).trim(),guideTaxonomyLabel(GUIDE_SYSTEM_CATEGORIES[0],loc),loc+' taxonomy/fallback');
  assert.equal(await page.locator('meta[name="robots"][content="noindex,nofollow"]').count(),1,loc+' noindex');
  await returnRoot();
 }
 console.log('QR_MAIN6428_GUIDE_REMOTE_8_LOCALES_SOURCE_LABELS_PASS');
 await page.locator('#site-locale').selectOption('ja');
 for(const section of ['quests','starPaths','events']){
  await focusEnter('[data-guide-root="'+section+'"]');
  await page.locator('[data-guide-browse="'+section+'"] [data-guide-reference-list],[data-guide-browse="'+section+'"] [role="alert"]').first().waitFor({state:'visible',timeout:30000});
  await returnRoot();
 }
 console.log('QR_MAIN6428_GUIDE_REMOTE_LAZY_REFERENCES_NOT_REAL_AVAILABILITY_PASS');
 await page.setViewportSize({width:320,height:780});
 await noOverflow('320px Guide root');
 await focusEnter('[data-guide-root="systems"]');
 await noOverflow('320px Guide Systems');
 await returnRoot();
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await noOverflow('200 percent zoom Guide root');
 await page.evaluate(()=>{document.documentElement.style.zoom='';});
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>4000);
 console.log('QR_MAIN6428_GUIDE_RAM_SCREENSHOT_SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 assert.deepEqual(denied,[],'no offsite POST/GET/WS, Provider/Cloud or Save upload');
 assert.deepEqual(errors,[],'no JS page errors');
 assert.equal(await page.locator('[data-shell-control="save"]:disabled').count(),1);
 assert.equal(await page.locator('[data-shell-control="account"]:disabled').count(),1);
 console.log('QR_MAIN6428_GUIDE_DEPLOYED_HTTPS_CHROME_KEYBOARD_320_200_NO_OFFSITE_PASS');
} finally {
 await ctx.close();
 await browser.close();
}
