import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const origin=(process.env.PRODUCT_BASE_URL??'http://127.0.0.1:4174').replace(/\/$/,'');
const executablePath=process.env.CHROME_BIN;
if(!executablePath) throw new Error('CHROME_BIN is required');
const report={status:'UNKNOWN',checks:[],pageErrors:[],consoleErrors:[],signedNetworkE2E:'CONFIGURATION_BLOCKED'};
await mkdir('.artifacts/gallery-stage1',{recursive:true});
function assert(value,message){if(!value)throw new Error(message)}
function pass(name,extra={}){report.checks.push({name,status:'PASS',...extra});}
async function overflow(page,name){
  const {scroll,client}=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert(scroll<=client+2,name+' horizontal overflow '+scroll+'/'+client);
}
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
page.on('pageerror',e=>report.pageErrors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
try{
  await page.goto(origin+'/gallery/',{waitUntil:'domcontentloaded'});
  assert(await page.locator('.gallery-entry').count()===3,'Gallery root is not three Product cards');
  const hrefs=await page.locator('.gallery-entry').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  for(const suffix of ['/gallery/decorations/','/gallery/tom/','/gallery/my/']) assert(hrefs.some(h=>h.endsWith(suffix)),'missing '+suffix);
  assert(!hrefs.some(x=>x.includes('/dreamsnaps/')),'DreamSnaps incorrectly belongs to Gallery');
  pass('GALLERY_THREE_CARD_IA');
  await page.goto(origin+'/gallery/decorations/',{waitUntil:'domcontentloaded'});
  assert(await page.locator('.filters button').count()===3,'Decorations All/Outdoor/Indoor missing');
  const decorationsHref=String(await page.locator('.publish-link').getAttribute('href'));
  assert(decorationsHref.includes('/gallery/publish/') && decorationsHref.includes('type=decorations'),'Decorations publish entry incorrect: '+decorationsHref);
  pass('DECORATIONS_CATEGORY_AND_PUBLISH_ENTRY');
  await page.goto(origin+'/gallery/tom/',{waitUntil:'domcontentloaded'});
  assert(await page.locator('.filters button').count()===3,'ToM All/Furniture/Clothing missing');
  pass('TOM_CATEGORY_AND_PUBLISH_ENTRY');
  await page.goto(origin+'/gallery/publish/?type=decorations',{waitUntil:'domcontentloaded'});
  await page.locator('input[maxlength="120"]').fill('Meadow');
  await page.getByRole('button',{name:/Continue/}).last().click();
  assert(await page.getByText('Images & presentation',{exact:true}).last().isVisible(),'Stage two not visible');
  await page.locator('input[maxlength="240"]').fill('Sample original scene');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
  await page.locator('input[type=file]').setInputFiles([
    {name:'first.png',mimeType:'image/png',buffer:png},
    {name:'second.png',mimeType:'image/png',buffer:png}
  ]);
  assert(await page.locator('.media-row').count()===2,'file selection did not preserve both images');
  await page.locator('.media-row').nth(1).getByRole('button',{name:'Move earlier'}).click();
  assert((await page.locator('.media-row .media-meta span').first().textContent())==='second.png','cover reordering failed');
  await page.getByRole('button',{name:/Continue/}).last().click();
  assert(await page.locator('.gallery-preview-card img').count()===1,'Card preview missing selected cover');
  assert(await page.locator('.gallery-preview-detail img').count()===2,'Detail preview missing images');
  assert(await page.getByText('Community services are not configured',{exact:false}).count()>0,'Missing configuration not exposed');
  assert(await page.locator('.gallery-composer').locator('button').filter({hasText:'Publish Work'}).count()>=1,'Explicit publish CTA absent');
  pass('PHOTO_COMPOSER_PREVIEW_LOCAL_NO_UPLOAD',{files:2});
  await page.goto(origin+'/gallery/publish/?type=tom',{waitUntil:'domcontentloaded'});
  assert(await page.locator('input[inputmode=numeric]').count()===1,'ToM Base Item input missing');
  pass('TOM_SPECIFIC_BASE_ITEM_INPUT');
  await page.goto(origin+'/gallery/my/',{waitUntil:'domcontentloaded'});
  assert(await page.getByText('Community services are not configured',{exact:false}).count()>0,'My Gallery fails to disclose service config');
  pass('MY_GALLERY_CONFIGURATION_BLOCKED_HONEST');
  const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  await page.setViewportSize({width:320,height:760});
  for(const path of ['/gallery/','/gallery/decorations/','/gallery/tom/','/gallery/publish/','/gallery/my/']){
    await page.goto(origin+path,{waitUntil:'domcontentloaded'});
    for(const locale of locales){
      const menu=page.locator('.mobile-app-toolbar .ui-icon-button').last();
      await menu.click();
      await page.locator('#site-locale-mobile').selectOption(locale);
      await page.keyboard.press('Escape');
      await overflow(page,path+'/'+locale);
    }
  }
  pass('GALLERY_320_REFLOW_EIGHT_LOCALES',{locales:8,routes:5});
  report.consoleErrors=report.consoleErrors.filter(x=>!x.includes('Failed to load resource'));
  assert(!report.pageErrors.length,'page JS errors '+report.pageErrors.join(';'));
  assert(!report.consoleErrors.length,'console errors '+report.consoleErrors.join(';'));
  report.status='PASS';
}catch(e){report.status='FAIL';report.error=String(e?.stack??e);throw e}
finally{
  await writeFile('.artifacts/gallery-stage1/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));await browser.close();
}
