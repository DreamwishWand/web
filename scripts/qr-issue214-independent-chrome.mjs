import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const base=(process.env.QR214_BASE_URL||'http://127.0.0.1:4177').replace(/\/$/,'');
const exe=process.env.CHROME_BIN;
if(!exe)throw Error('Missing CHROME_BIN');
const done=[],errors=[],log=[];
const say=(k)=>done.push(k);
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',e=>{if(e.type()==='error')log.push(e.text())});
const wait=async(sel)=>page.locator(sel).first().waitFor({state:'visible',timeout:45000});
const reflow=async()=>{const {a,b}=await page.evaluate(()=>({a:document.documentElement.scrollWidth,b:document.documentElement.clientWidth}));assert(a<=b+2,'HORIZONTAL_OVERFLOW '+a+'/'+b)};
try{
 await page.goto(base+'/collection/',{waitUntil:'domcontentloaded'});
 await wait('.collection-card');
 assert(await page.locator('.collection-card').count()===120,'COLLECTION_FIRST_PAGE_NOT_120');
 assert(await page.locator('.collection-controls select').count()===3,'CONTEXTUAL_FACETS_NOT_THREE');
 assert(await page.locator('.view-switch button').count()===0,'LEGACY_VIEWMODE_VISIBLE');
 await page.locator('.collection-card').first().focus();
 assert(await page.locator('.collection-card').first().evaluate(x=>x===document.activeElement),'ITEM_NOT_KEYBOARD_FOCUSABLE');
 await page.keyboard.press('Enter');
 await wait('[data-collection-state="item-detail"]');
 assert((await page.locator('.item-detail').innerText()).includes('No DDV save'),'OWNER_SAVE_BOUNDARY_NOT_SHOWN');
 say('INDEPENDENT_12552_INDEX_ORIGINAL_CORPUS_CATEGORY_FACET_DETAIL_KEYBOARD');
 await page.goto(base+'/collection/?view=world&world=Valley',{waitUntil:'domcontentloaded'});
 await wait('[data-collection-state="invalid-url"]');
 assert(await page.locator('.collection-card').count()===0,'INVALID_URL_RENDERED_CORPUS');
 say('INDEPENDENT_LEGACY_WORLD_MODE_URL_FAIL_CLOSED');
 await page.goto(base+'/collection/?version=1.25.3&item=507',{waitUntil:'domcontentloaded'});
 await wait('[data-collection-state="unsupported-version"]');
 say('INDEPENDENT_UNSUPPORTED_SCHEMA626_DENIED');
 await page.goto(base+'/gallery/dreamsnaps/?work=00000000-0000-0000-0000-000000000001',{waitUntil:'domcontentloaded'});
 await wait('[data-legacy-dreamsnaps="fail-closed"]');
 assert(await page.locator('[data-legacy-dreamsnaps] img').count()===0,'OLD_URL_IMAGE_LEAK');
 assert(await page.locator('[data-legacy-dreamsnaps] .official').count()===0,'OLD_URL_RESULT_LEAK');
 say('INDEPENDENT_OLD_GALLERY_DREAMSNAPS_NO_IMAGE_OR_SCORE');
 await page.goto(base+'/dreamsnaps/community/',{waitUntil:'domcontentloaded'});
 await wait('[data-community-dreamsnaps="fail-closed"]');
 assert(await page.locator('[data-community-dreamsnaps] img').count()===0,'NEW_INERT_BROWSE_IMAGE');
 say('INDEPENDENT_COMMUNITY_DREAMSNAPS_FAIL_CLOSED');
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  for(const x of [{url:'/dreamsnaps/',nav:'.dreamsnaps-map a',expected:5},{url:'/help/',nav:'.help-children a',expected:4}]){
   await page.setViewportSize({width:1280,height:900});
   await page.goto(base+x.url,{waitUntil:'domcontentloaded'});
   await page.locator(x.nav).first().waitFor({state:'visible',timeout:15000});
   // Hydration restores the saved locale after SSR. Wait before writing a new value.
   await page.waitForTimeout(650);
   await wait('#site-locale');
   await page.locator('#site-locale').selectOption(locale);
   await page.waitForFunction(l=>document.documentElement.lang===l,locale,{timeout:18000});
   await page.setViewportSize({width:320,height:820});
   assert(await page.locator(x.nav).count()===x.expected,locale+x.url+' CHILD_COUNT');
   await reflow();
  }
 }
 say('INDEPENDENT_EIGHT_LOCALE_320PX_DREAMSNAPS_CHC_ROOTS');
 assert(errors.length===0,'PAGE_ERRORS '+errors.join('|'));
 assert(log.length===0,'CONSOLE_ERRORS '+log.join('|'));
 await mkdir('.artifacts/qr214-independent',{recursive:true});
 await writeFile('.artifacts/qr214-independent/result.json',JSON.stringify({status:'PASS_SOURCE_CHROME_ONLY',ownerWebHead:'ca46279f5da996f335ab011b627a4f5b5ba99235',checks:done,errors,log,signed:false,realProvider:false,realCompetition:false},null,2));
 console.log('QR214_INDEPENDENT_CHROME_SOURCE_PASS '+JSON.stringify(done));
}finally{await browser.close()}
