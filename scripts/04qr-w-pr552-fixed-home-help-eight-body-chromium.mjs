// Independent 04QR-W changed HEAD Source PR552 real Chromium:
// only previously TRUE RED Home Help CARD BODY for six non-Japanese languages.
// Other six Core/Guide/Collection/Gallery ancestor scoped QAs are REUSED, not repeated.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createHash} from 'node:crypto';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
if(!process.env.CHROME_BIN)throw Error('QR552_FIXED_REAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR552_FIXED_PRIVATE_P1G_DENIED');
const root='http://127.0.0.1:4307';
if(process.env.QR552_FIXED_URL && process.env.QR552_FIXED_URL!==root)throw Error('QR552_FIXED_LOCALHOST_ONLY');
const errors=[],denied=[],langs=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR552_FIXED_WEBSOCKET_DENY_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4307')route.connectToServer();
  else {denied.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===root&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else {denied.push(route.request().method()+' '+route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(root+'/',{waitUntil:'networkidle'});
 const help=page.locator('.home-qa-entry a[href="/help/"]');
 await help.waitFor({state:'visible',timeout:30000});
 const body=help.locator('.visual-card-copy >span');
 const head=help.locator('.visual-card-copy strong');
 const en=homeCopy('en').qaDetail;
 for(const lang of langs){
  await page.locator('#site-locale').selectOption(lang);
  const expected=homeCopy(lang);
  await page.waitForFunction(({lang,body})=>document.documentElement.dataset.locale===lang &&
    document.querySelector('.home-qa-entry a[href="/help/"] .visual-card-copy >span')?.textContent?.trim()===body,
    {lang,body:expected.qaDetail},{timeout:15000});
  assert.equal((await body.innerText()).trim(),expected.qaDetail,lang+' exact visible Help BODY translation');
  assert.equal((await head.innerText()).trim(),helpStage1Copy(lang).title,lang+' Help title');
  assert.equal(await page.locator('.home-product-grid a.visual-card').count(),6,'6 Core preserved');
  if(lang!=='en')assert.notEqual((await body.innerText()).trim(),en,'old English fallback must be gone in '+lang);
 }
 console.log('QR552_FIXED REAL CHROME ALL8 HELP TITLE_AND_BODY EXACT LOCALE PASS');
 await page.locator('#site-locale').selectOption('fr');
 await page.waitForFunction(x=>document.querySelector('.home-qa-entry a[href="/help/"] .visual-card-copy >span')?.textContent?.trim()===x,homeCopy('fr').qaDetail,{timeout:12000});
 const desktop=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(desktop.length>5500);
 console.log('QR552_FIXED FR HELP CARD SCREENSHOT RAM SHA '+createHash('sha256').update(desktop).digest('hex').slice(0,16));
 await page.setViewportSize({width:320,height:750});
 const small=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(small.scroll<=small.width+2,JSON.stringify(small));
 await help.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/help/');
 await page.keyboard.press('Enter');
 await page.locator('[data-help-root="four-children"]').waitFor({state:'visible',timeout:15000});
 await page.goBack({waitUntil:'domcontentloaded'});
 await help.waitFor();
 await page.setViewportSize({width:640,height:840});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.width+2,JSON.stringify(zoom));
 assert.deepEqual(denied,[]);
 assert.deepEqual(errors,[]);
 console.log('QR552_FIXED REAL 320/200 KEYBOARD HELP + NO OFFHOST HTTP/WS/POST/PRIVATE SAVE PASS');
 await ctx.close();
}finally{await browser.close();}
