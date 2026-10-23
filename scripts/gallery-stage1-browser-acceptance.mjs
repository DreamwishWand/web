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
// Unsigned synthetic transport acceptance only. No real staging key or user media.
let subjectScenario='verified';
const mockSubject={
  subjectId:'11111111-1111-4111-8111-111111111111',galleryKind:'outdoor',subjectType:'floating_island',
  canonicalTargetId:'fixture-scene-item',baseItemId:null,platform:'switch',
  gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624,
  displayIdentity:'SceneItemId fixture-scene-item',displayName:null,
  verificationState:'verified',evidenceRef:'browser-fixture-only'
};
await page.route('https://gallery-lookup-browser.invalid/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/functions/v1/community-public-query')){
    const body=route.request().postDataJSON();
    if(body?.rpc!=='community_list_verified_gallery_subjects_v1')
      return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Unsupported public query'})});
    if(subjectScenario==='network-error')
      return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Temporary catalog failure'})});
    const records=body.payload?.p_gallery_kind==='outdoor' && subjectScenario!=='empty'
      ? [subjectScenario==='wrong-build'?{...mockSubject,buildId:'UNSUPPORTED'}:mockSubject] : [];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      contract:'ddv.gallery-verified-subject-public-lookup@1',subjects:records,
      catalogStatus:'partial_verified_only',displayNamesVerified:false
    })});
  }
  if(url.pathname.endsWith('/rest/v1/rpc/community_search_public'))
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  return route.fulfill({status:400,contentType:'application/json',body:'{"error":"Synthetic browser environment"}'});
});
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
  await page.locator('.subject-options button').first().waitFor({state:'visible',timeout:10000});
  await page.locator('select').filter({has:page.locator('option[value="floating_island"]')}).selectOption('floating_island');
  await page.locator('.subject-options button').first().click();
  assert(await page.getByText('SceneItemId fixture-scene-item').count()>0,'missing canonical display fallback');
  const stageTwo=page.getByRole('heading',{name:'Images & presentation'});
  await page.getByRole('button',{name:/Continue/}).last().click();
  await stageTwo.waitFor({state:'visible',timeout:10000});
  await page.locator('input[maxlength="240"]').fill('Original floating-island scene');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
  await page.locator('input[type=file]').setInputFiles([
    {name:'first.png',mimeType:'image/png',buffer:png},
    {name:'second.png',mimeType:'image/png',buffer:png}
  ]);
  assert(await page.locator('.media-row').count()===2,'image selection failed');
  await page.locator('.media-row').nth(1).getByRole('button',{name:'Move earlier'}).click();
  assert((await page.locator('.media-row .media-meta span').first().textContent())==='second.png','cover ordering failed');
  await page.getByRole('button',{name:/Continue/}).last().click();
  await page.locator('.gallery-preview-card img').waitFor({state:'visible',timeout:10000});
  assert(await page.locator('.gallery-preview-detail img').count()===2,'detail preview missing images');
  assert(await page.getByRole('button',{name:'Publish Work',exact:true}).isDisabled(),'unsafe publish enabled');
  pass('VERIFIED_SUBJECT_SELECTION_PREVIEW_AND_DISABLED_PUBLISH',{transport:'synthetic',files:2});
  await page.goto(origin+'/gallery/publish/?type=tom',{waitUntil:'domcontentloaded'});
  await page.getByText('No verified subject is registered',{exact:false}).waitFor({state:'visible',timeout:10000});
  assert(await page.locator('input[inputmode=numeric]').count()===0,'unverified Base Item input exposed');
  pass('TOM_EMPTY_REGISTRY_NO_GUESSED_BASE_ITEM');
  await page.goto(origin+'/gallery/publish/?type=decorations',{waitUntil:'domcontentloaded'});
  await page.locator('.subject-options button').first().waitFor({state:'visible',timeout:10000});
  subjectScenario='wrong-build';
  await page.getByRole('button',{name:'Refresh verified subjects'}).click();
  await page.locator('.subject-options button').first().waitFor({state:'visible',timeout:10000});
  assert(await page.locator('.subject-options button').first().isDisabled(),'wrong-build subject selectable');
  pass('UNSUPPORTED_BUILD_FAIL_CLOSED');
  subjectScenario='network-error';
  await page.getByRole('button',{name:'Refresh verified subjects'}).click();
  await page.getByText('Verified subject lookup failed.',{exact:false}).waitFor({state:'visible',timeout:10000});
  pass('SUBJECT_LOOKUP_NETWORK_ERROR');
  subjectScenario='empty';
  await page.getByRole('button',{name:'Refresh verified subjects'}).click();
  await page.getByText('No verified subject is registered',{exact:false}).waitFor({state:'visible',timeout:10000});
  pass('SUBJECT_LOOKUP_EMPTY');
  subjectScenario='verified';
  await page.goto(origin+'/gallery/my/',{waitUntil:'domcontentloaded'});
  assert(await page.getByRole('button',{name:'Sign in',exact:false}).count()>0,'My Gallery unsigned auth state missing');
  pass('MY_GALLERY_AUTH_REQUIRED');
  const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  await page.setViewportSize({width:320,height:760});
  for(const path of ['/gallery/','/gallery/decorations/','/gallery/tom/','/gallery/publish/','/gallery/my/']){
    await page.goto(origin+path,{waitUntil:'domcontentloaded'});
    for(const locale of locales){
      const menu=page.locator('.mobile-app-toolbar .ui-icon-button').last();
      const settingsSheet=page.locator('dialog.ui-sheet').first();
      let opened=false;
      for(let attempt=0;attempt<8;attempt++){
        await menu.click();
        opened=await settingsSheet.evaluate(node=>node.open===true);
        if(opened)break;
        await page.waitForTimeout(150);
      }
      assert(opened,path+' mobile settings did not open after hydrated click');
      await settingsSheet.locator('#site-locale-mobile').selectOption(locale);
      await page.keyboard.press('Escape');
      await settingsSheet.waitFor({state:'hidden',timeout:10000});
      await overflow(page,path+'/'+locale);
    }
  }
  pass('GALLERY_320_REFLOW_EIGHT_LOCALES',{locales:8,routes:5});
  report.consoleErrors=report.consoleErrors.filter(x=>!x.includes('Failed to load resource'));
  assert(!report.pageErrors.length,'page JS errors '+report.pageErrors.join(';'));
  assert(!report.consoleErrors.length,'console errors '+report.consoleErrors.join(';'));
  report.status='PASS';report.catalogTransport='SYNTHETIC_HTTP_INTERCEPTION_ONLY';
}catch(e){report.status='FAIL';report.error=String(e?.stack??e);throw e}
finally{
  await writeFile('.artifacts/gallery-stage1/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));await browser.close();
}
