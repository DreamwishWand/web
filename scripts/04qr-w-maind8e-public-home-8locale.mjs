// 04 QR-W POST-MERGE ACTUAL PUBLIC Pages main d8e Home + Help eight-locale visible BODY.
// Do NOT reuse the prior localhost owner Home QA560 as proof of CDN/Pages deployment.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
const MAIN='d8e67925c2417d3fc3505611ac22919bdf354e75';
const ORIGIN='https://dreamwishwand.github.io';
const BASE=ORIGIN+'/web';
if(!process.env.CHROME_BIN)throw Error('QA_NOT_RUN_REAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QA_NOT_RUN_PRIVATE_P1G_FORBIDDEN');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN,'QA-only files must be based on actual protected main d8e');
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').trim().split('\n').sort(),
 ['.github/workflows/04qr-w-maind8e-public-home-8locale.yml','scripts/04qr-w-maind8e-public-home-8locale.mjs'].sort(),
 'exact two QA-only paths, no Source or Pages deployment mutation');
for(const [path,sha] of Object.entries({
 'src/routes/+page.svelte':'173d7b128b22db16fb2478961fcd60205754a293',
 'src/lib/product-home/copy.js':'daca1ccbe505d9e49aaf11a03472a7d1fde43cd9',
 'scripts/web-stage1-home-copy-locale-chrome.mjs':'69ee43f76a9753a4c372ef5626b25b97b0f899b8'
}))assert.equal(git('rev-parse',MAIN+':'+path),sha,'actual deployed main Source immutable identity');
async function http200(path,marker){
 const response=await fetch(BASE+path,{redirect:'manual'});
 assert.equal(response.status,200,'deployed CDN direct HTTP must be 200 for '+path);
 assert.match(response.headers.get('content-type')??'',/text\/html/,'actual HTML route '+path);
 const text=await response.text();
 assert.match(text,marker,'no non-HTML stub/404 body '+path);
 return text;
}
await http200('/',/Dreamwish Wand/i);
console.log('QR_MAIND8E_PUBLIC_PAGES_HOME_HTML_DIRECT_HTTP200_PASS');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage();
const pageErrors=[],denied=[];
page.on('pageerror',err=>pageErrors.push(String(err)));
if(typeof page.routeWebSocket!=='function')throw Error('QA_WEBSOCKET_BLOCK_REQUIRED');
await page.routeWebSocket('**/*',route=>{denied.push('WS '+route.url());route.close();});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{denied.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
const lang=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const ids=['decorate','collection','guide','presets','gallery','dreamsnaps'];
const fields=['decorateDetail','collectionDetail','guideDetail','presetsDetail','galleryDetail','dreamsnapsDetail'];
const cards=page.locator('.home-product-grid a.visual-card');
async function fit(label){
 const x=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.client+2,label+' '+JSON.stringify(x));
}
try{
 const opened=await page.goto(BASE+'/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(opened?.status(),200);
 await cards.first().waitFor({state:'visible',timeout:30000});
 assert.equal(await cards.count(),6,'public Home six Core equal-card URLs');
 assert.equal(await page.locator('.home-qa-entry a.visual-card').count(),1,'distinct horizontal Help');
 for(const locale of lang){
  await page.locator('#site-locale').selectOption(locale);
  const expected=homeCopy(locale);
  await page.waitForFunction(({locale,expected})=>document.documentElement.dataset.locale===locale &&
   document.querySelector('.home-qa-entry a.visual-card .visual-card-copy >span')?.textContent?.trim()===expected,
   {locale,expected:expected.qaDetail},{timeout:16000});
  assert.equal(await cards.count(),6,locale+' six');
  for(let i=0;i<ids.length;i++){
   const el=page.locator('.home-product-grid a.visual-card[href="'+('/web/'+ids[i]+'/')+'"]');
   assert.equal(await el.count(),1,locale+' '+ids[i]+' core navigation href');
   assert.equal((await el.locator('.visual-card-copy strong').innerText()).trim(),expected[ids[i]],locale+' '+ids[i]+' title');
   assert.equal((await el.locator('.visual-card-copy >span').innerText()).trim(),expected[fields[i]],locale+' '+ids[i]+' body');
  }
  const help=page.locator('.home-qa-entry a.visual-card[href="/web/help/"]');
  assert.equal(await help.count(),1,'Help must use actual GitHub Pages base path');
  assert.equal((await help.locator('strong').innerText()).trim(),helpStage1Copy(locale).title,locale+' Help title');
  assert.equal((await help.locator('.visual-card-copy >span').innerText()).trim(),expected.qaDetail,locale+' Help BODY');
  assert.equal(await page.locator('[data-test-site-availability]').count(),1,'availability notice must be visible');
 }
 console.log('QR_MAIND8E_PUBLIC_PAGES_SIX_CORE_ONE_HELP_FULL_BODY_ALL_EIGHT_LOCALES_PASS');
 await page.locator('#site-locale').selectOption('ja');
 const help=page.locator('.home-qa-entry a.visual-card[href="/web/help/"]');
 await help.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/web/help/');
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/web\/help\/$/, {timeout:20000});
 const helpResponse=await http200('/help/',/Dreamwish Wand/i);
 assert.ok(helpResponse.length>100,'deployed Help direct HTML response');
 await page.goBack({waitUntil:'networkidle'});
 await cards.first().waitFor({state:'visible'});
 console.log('QR_MAIND8E_PUBLIC_PAGES_CANONICAL_HELP_KEYBOARD_NAV_AND_DIRECT_200_PASS');
 await page.setViewportSize({width:320,height:800});
 await fit('public Home 320px');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('public Home at 200% zoom');
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>5000);
 console.log('QR_MAIND8E_PUBLIC_HOME_RAM_SCREENSHOT_SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 assert.deepEqual(denied,[],'no offsite provider, POST, WebSocket or Writer');
 assert.deepEqual(pageErrors,[],'no actual CDN runtime page errors');
 console.log('QR_MAIND8E_PUBLIC_PAGES_320_ZOOM200_NO_PROVIDER_OR_WRITER_IO_PASS');
}finally{await ctx.close();await browser.close();}
