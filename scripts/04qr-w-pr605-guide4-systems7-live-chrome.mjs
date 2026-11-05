// 04 QR-W independent fixed PR605 Guide 4-root / Systems 7→21 actual Chrome.
// Synthetic-only public Guide navigation; no private P1G, Writer, Provider or screenshots exported.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {GUIDE_ROOT_SECTIONS,GUIDE_SYSTEM_CATEGORIES,GUIDE_SYSTEM_EVIDENCE_KEYS,guideTaxonomyLabel} from '../src/lib/guide/stage1-systems-taxonomy.mjs';
import {guideStage1Ui} from '../src/lib/guide/stage1-guide-ui.mjs';
const ROOT='http://127.0.0.1:4319';
const LOCALES=['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'];
assert.ok(process.env.CHROME_BIN,'NOT_RUN actual installed system Chrome required');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])assert.equal(process.env[k],undefined,'PRIVATE_ORIGINAL_CI_DENY '+k);
const denied=[],jsErrors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:820},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage();
page.on('pageerror',e=>jsErrors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN playwright cannot enforce websocket guard');
await page.routeWebSocket('**/*',r=>{
 const url=new URL(r.url());
 if(url.hostname==='127.0.0.1'&&url.port==='4319'&&url.protocol==='ws:')r.connectToServer();
 else{denied.push('WS '+r.url());r.close();}
});
await page.route('**/*',r=>{
 const req=r.request(),url=new URL(req.url());
 if(url.origin===ROOT&&['GET','HEAD'].includes(req.method()))r.continue();
 else{denied.push(req.method()+' '+req.url());r.abort('blockedbyclient');}
});
const isPath=path=>page.url().startsWith(ROOT+path);
async function noOverflow(tag){
 const size=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.viewport+2,tag+': '+JSON.stringify(size));
}
async function pressGuideRoot(section){
 const el=page.locator('[data-guide-four-root] [data-guide-root="'+section+'"]');
 await el.focus();await page.keyboard.press('Enter');
 await page.locator('[data-guide-browse="'+section+'"]').waitFor({state:'visible',timeout:20000});
 assert.equal(await el.getAttribute('aria-pressed'),'true');
}
const clickReturn=async()=>{
 const btn=page.locator('button.guide-return');
 await btn.focus();await page.keyboard.press('Enter');
 await page.locator('[data-guide-browse]').waitFor({state:'hidden',timeout:10000});
 assert.equal(await page.locator('[data-guide-four-root] [aria-pressed="true"]').count(),0);
};
try {
 const response=await page.goto(ROOT+'/guide/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(response?.status(),200,'Guide direct HTTP200 local source preview');
 await page.locator('[data-stage1-guide-four-root]').waitFor({state:'visible'});
 assert.deepEqual(await page.locator('[data-guide-four-root] [data-guide-root]').evaluateAll(xs=>xs.map(x=>x.dataset.guideRoot)),GUIDE_ROOT_SECTIONS);
 assert.equal(await page.locator('[data-guide-root="issues"],[data-guide-browse="issues"]').count(),0,'obsolete Guide Issues section forbidden');
 assert.equal(await page.locator('a[href="/help/"]').count()>=1,true,'Help Center owns Issues');
 assert.equal(await page.locator('meta[name="robots"][content="noindex,nofollow"]').count(),1,'no unreviewed Guide public indexing');
 assert.equal(await page.locator('[data-guide-reference-list], [data-guide-systems-seven]').count(),0,'Guide root must start as 4-card dashboard, not hidden old panel');
 assert.ok(isPath('/guide/'));
 console.log('QR605_GUIDE_FOUR_ROOT_ISSUES_HELP_NOINDEX_HTTP200_PASS');
 await pressGuideRoot('systems');
 let cats=page.locator('[data-guide-systems-seven] [data-guide-system-category]');
 assert.equal(await cats.count(),7);
 assert.equal(await page.locator('[data-guide-systems-topic-groups]').count(),0);
 for(const cat of GUIDE_SYSTEM_CATEGORIES){
   const btn=page.locator('[data-guide-system-category="'+cat.id+'"]');
   await btn.focus();await page.keyboard.press('Enter');
   const labels=await page.locator('[data-guide-systems-topic-groups] [data-guide-subgroup]').evaluateAll(xs=>xs.map(x=>x.dataset.guideSubgroup));
   assert.deepEqual(labels,cat.groups.map(x=>x.id),'21 owned subgroup IDs '+cat.id);
   assert.equal(await page.locator('[data-guide-systems-topic-groups] a').count(),0,'internal evidence keys cannot link to public fake Guide articles');
   assert.ok((await page.locator('[data-guide-systems-topic-groups]').innerText()).includes(guideStage1Ui('en').noPublished));
 }
 assert.equal(GUIDE_SYSTEM_EVIDENCE_KEYS.length,106);
 const input=page.locator('[data-guide-browse="systems"] input[type="search"]');
 await input.fill('timebending');
 assert.deepEqual(await cats.evaluateAll(xs=>xs.map(x=>x.dataset.guideSystemCategory)),['gathering']);
 await input.fill('nonexisting_dlc___');
 assert.equal(await cats.count(),0);
 assert.equal(await page.locator('[data-guide-browse="systems"] [role="status"]').count(),1);
 await input.fill('');
 assert.equal(await cats.count(),7);
 console.log('QR605_SYSTEMS_SEVEN_TWENTYONE_ONEHUNDREDSIX_SEARCH_NO_ARTICLE_PASS');
 await clickReturn();
 for(const lang of LOCALES){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(l=>document.documentElement.dataset.locale===l,lang,{timeout:20000});
  const texts=await page.locator('[data-guide-four-root] [data-guide-root] strong').allTextContents();
  assert.equal(texts.length,4);
  assert.ok(texts.every(s=>s.trim().length>0),'all four navigational labels '+lang);
  await pressGuideRoot('systems');
  const first=page.locator('[data-guide-system-category="basics"] strong');
  assert.equal((await first.innerText()).trim(),guideTaxonomyLabel(GUIDE_SYSTEM_CATEGORIES[0],lang));
  const note=page.locator('[data-guide-browse="systems"] .guide-fallback');
  assert.equal(await note.count(),lang==='ja'||lang==='en'?0:1,'approved EN taxonomy fallback '+lang);
  assert.equal(await page.locator('meta[name="robots"][content="noindex,nofollow"]').count(),1,lang+' noindex');
  await clickReturn();
 }
 console.log('QR605_EIGHT_LOCALE_FOUR_ROOT_APPROVED_TAXONOMY_FALLBACK_NOINDEX_PASS');
 await page.locator('#site-locale').selectOption('en');
 await pressGuideRoot('quests');
 await page.locator('[data-guide-browse="quests"] [data-guide-reference-list], [data-guide-browse="quests"] [role="alert"]').first().waitFor({state:'visible',timeout:30000});
 const loaded=await page.locator('[data-guide-browse="quests"] [data-guide-reference-list]').count();
 if(loaded){
  assert.ok((await page.locator('[data-guide-browse="quests"]').innerText()).includes(guideStage1Ui('en').referenceOnly),'No user current availability/ownership claim');
  const first40=await page.locator('[data-guide-reference-list] button:not(.guide-more)').count();
  assert.ok(first40<=40);
  if(await page.locator('.guide-more').count()){
   await page.locator('.guide-more').first().click();
   assert.ok((await page.locator('[data-guide-reference-list] button:not(.guide-more)').count())>first40,'progressive next page retains all records');
  }
 }
 await clickReturn();
 await pressGuideRoot('starPaths');
 await page.locator('[data-guide-browse="starPaths"] [data-guide-reference-list], [data-guide-browse="starPaths"] [role="alert"]').first().waitFor({state:'visible',timeout:30000});
 await clickReturn();
 await pressGuideRoot('events');
 await page.locator('[data-guide-browse="events"] [data-guide-reference-list], [data-guide-browse="events"] [role="alert"]').first().waitFor({state:'visible',timeout:30000});
 await clickReturn();
 console.log('QR605_REFERENCE_LAZY_LOADED_PROGRESSIVE_NO_LIVE_AVAILABILITY_PASS');
 await page.setViewportSize({width:320,height:780});
 await noOverflow('320 root');
 await pressGuideRoot('systems');
 await noOverflow('320 systems seven');
 await page.locator('[data-guide-system-category="decorating"]').focus();
 await page.keyboard.press('Enter');
 await noOverflow('320 subgroup');
 await clickReturn();
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await noOverflow('200 percent root');
 await pressGuideRoot('systems');
 await noOverflow('200 percent systems');
 await page.evaluate(()=>{document.documentElement.style.zoom=''});
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>4000);
 console.log('QR605_SCREENSHOT_RAM_SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 assert.deepEqual(denied,[],'no offsite GET/POST/WS, Writer/Provider/Cloud upload');
 assert.deepEqual(jsErrors,[],'no JS errors');
 assert.equal(await page.locator('[data-shell-control="save"]:disabled').count(),1);
 assert.equal(await page.locator('[data-shell-control="account"]:disabled').count(),1);
 console.log('QR605_MOBILE320_ZOOM200_KEYBOARD_NO_OFFSITE_NO_WRITER_PASS');
}finally{await ctx.close();await browser.close();}