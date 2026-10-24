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
let mediaScenario='no-fixture';
const gatewayId='33333333-3333-4333-8333-333333333333';
const gatewayUrl='https://gallery-lookup-browser.invalid/functions/v1/community-public-media?mediaId='+gatewayId;
const gatewayCalls=[];
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const catalogRequests=[];
const uuid=index=>'11111111-1111-4111-8111-'+String(index).padStart(12,'0');
function mockSubject(index,kind,type,canonical,baseItemId=null){
  return {
    subjectId:uuid(index),galleryKind:kind,subjectType:type,
    canonicalTargetId:String(canonical),baseItemId,platform:'switch',
    gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624,
    displayIdentity:type==='floating_island'?'SceneItemId '+canonical:String(canonical),
    displayName:null,verificationState:'verified',evidenceRef:'synthetic-browser-only/'+index
  };
}
// Synthetic counts parallel the 09 INT STAGING registry, never serve real IDs
// from this fixture and never use this as evidence of actual Staging HTTP.
const mockCatalog=[
  ...Array.from({length:13},(_,i)=>mockSubject(i+1,'outdoor','floating_island','fixture-island-'+(i+1))),
  ...[1,4,5,7].map((area,i)=>mockSubject(i+14,'outdoor','biome','1540000000:'+area)),
  ...Array.from({length:40},(_,i)=>mockSubject(i+18,'tom_furniture','tom_furniture',40010001+i,40010001+i)),
  ...Array.from({length:35},(_,i)=>mockSubject(i+58,'tom_clothing','tom_clothing',50010001+i,50010001+i))
];
assert(mockCatalog.length===92,'synthetic catalog count');
await page.route('https://gallery-lookup-browser.invalid/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/functions/v1/community-public-media')){
    gatewayCalls.push({method:route.request().method(),path:url.pathname,query:url.search});
    if(mediaScenario==='revoked'||mediaScenario==='historical'||mediaScenario==='private'||mediaScenario==='missing')
      return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"MEDIA_NOT_PUBLIC"}'});
    if(mediaScenario==='unavailable')
      return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"GALLERY_MEDIA_AUTHORITY_UNAVAILABLE"}'});
    if(route.request().method()==='GET')
      return route.fulfill({status:200,contentType:'image/png',body:tinyPng,
        headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Content-Type':'image/png'}});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,media:{mediaId:gatewayId,transport:'edge_proxy',streamUrl:gatewayUrl,
      rawStorageSignedUrlIssued:false,mimeType:'image/png',byteSize:tinyPng.length,width:1,height:1}
    })});
  }
  if(url.pathname.endsWith('/functions/v1/community-public-query')){
    const body=route.request().postDataJSON();
    catalogRequests.push({rpc:body?.rpc,kind:body?.payload?.p_gallery_kind});
    if(body?.rpc==='community_get_gallery_photo_public_v1'){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mediaIds:[gatewayId]})});
    }
    if(body?.rpc!=='community_list_verified_gallery_subjects_v1')
      return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Unsupported public query'})});
    if(subjectScenario==='network-error')
      return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Temporary catalog failure'})});
    const records=subjectScenario==='empty'?[]:mockCatalog
      .filter(record=>record.galleryKind===body.payload?.p_gallery_kind)
      .slice(0,body.payload?.p_limit??50)
      .map(record=>subjectScenario==='wrong-build'?{...record,buildId:'UNSUPPORTED'}:
        subjectScenario==='wrong-schema'?{...record,profileSchema:626}:record);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      contract:'ddv.gallery-verified-subject-public-lookup@1',subjects:records,
      catalogStatus:'partial_verified_only',displayNamesVerified:false
    })});
  }
  if(url.pathname.endsWith('/rest/v1/rpc/community_search_public'))
    return route.fulfill({status:200,contentType:'application/json',body:mediaScenario==='no-fixture'?'[]':JSON.stringify([
      {work_id:'44444444-4444-4444-8444-444444444444',title:'Proxy fixture',
       facets:{galleryKind:'outdoor'},text_content:'Synthetic cover only'}])});
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
  const picker=page.locator('.subject-picker');
  // The old test incorrectly used SSR's zero-results message as an onMount
  // completion signal, then clicked before hydration/event handlers existed.
  const observedState=await picker.getAttribute('data-catalog-state');
  assert(['initializing','loading','ready'].includes(observedState),
    'Unexpected first public catalog state: '+observedState);
  await page.locator('.subject-picker[data-catalog-state="ready"]').waitFor({state:'visible'});
  assert(await page.locator('.subject-options button').count()===4,'Biome: expected four verified tuples');
  assert(await page.locator('.subject-options button').first().textContent().then(s=>s?.includes('1540000000:1')),
    'composite biome identity not displayed');
  await page.locator('.subject-options button').first().click();
  assert((await page.locator('.subject-options button').first().getAttribute('aria-pressed'))==='true',
    'Biome selected identity not retained');
  pass('BIOME_FOUR_COMPOSITE_VERIFIED');
  await page.getByRole('button',{name:'Floating Island',exact:true}).click();
  assert((await page.getByRole('button',{name:'Floating Island',exact:true}).getAttribute('aria-pressed'))==='true',
    'Floating Island type click did not update reactive state');
  assert(await page.locator('.subject-options button').count()===13,'Islands: 13 verified options');
  await page.locator('.subject-options button').first().focus();
  await page.keyboard.press('Enter');
  assert((await page.locator('.subject-options button').first().getAttribute('aria-pressed'))==='true',
    'Keyboard Subject selection failed');
  assert(await page.getByText('SceneItemId fixture-island-1').count()>0,'missing null-name ID fallback');
  pass('FLOATING_ISLAND_THIRTEEN_AND_KEYBOARD');
  subjectScenario='empty';
  await page.getByRole('button',{name:'Refresh verified subjects'}).click();
  await page.locator('.subject-picker[data-catalog-state="ready"]').waitFor({state:'visible'});
  assert(await page.locator('.subject-options button').count()===0,'empty catalog exposes stale options');
  assert(await page.getByText('No verified subject is registered',{exact:false}).isVisible(),'empty feedback missing');
  await page.getByRole('button',{name:/Continue/}).last().click();
  assert(await page.getByRole('heading',{name:'Images & presentation'}).count()===0,
    'stale previously-selected Subject passed step guard');
  pass('STALE_SELECTION_REVOKED_AFTER_REFRESH');
  subjectScenario='verified';
  await page.getByRole('button',{name:'Refresh verified subjects'}).click();
  await page.locator('.subject-options button').first().waitFor({state:'visible'});
  await page.locator('.subject-options button').first().click();
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
  pass('PHOTO_LOCAL_PREVIEW_COVER_AND_DISABLED_PUBLISH',{files:2});
  await page.goto(origin+'/gallery/publish/?type=tom',{waitUntil:'domcontentloaded'});
  await page.locator('.subject-picker[data-catalog-state="ready"]').waitFor({state:'visible'});
  assert(await page.locator('.subject-options button').count()===40,'ToM furniture expected 40 records');
  assert(await page.locator('input[inputmode=numeric]').count()===0,'unverified numeric input exposed');
  await page.locator('.subject-options button').first().click();
  assert(await page.locator('.subject-picker').getByText('40010001',{exact:false}).count()>0,
    'ToM Base Item identity absent');
  pass('TOM_FURNITURE_40_SERVER_BASE_ITEM');
  await page.locator('.form-panel select').first().selectOption('tom_clothing');
  await page.locator('.subject-picker[data-catalog-state="ready"]').waitFor({state:'visible'});
  assert(await page.locator('.subject-options button').count()===35,'ToM clothing expected 35 records');
  assert(await page.locator('.subject-options button').first().textContent().then(s=>s?.includes('50010001')),
    'ToM clothing Base Item missing');
  pass('TOM_CLOTHING_35_SERVER_BASE_ITEM');
  await page.locator('.form-panel select').first().selectOption('indoor');
  await page.locator('.subject-picker[data-catalog-state="ready"]').waitFor({state:'visible'});
  assert(await page.locator('.subject-options button').count()===0,'Room global catalog must be empty');
  pass('ROOM_NOT_REGISTERED_AND_DISABLED');
  subjectScenario='wrong-build';
  await page.goto(origin+'/gallery/publish/?type=decorations',{waitUntil:'domcontentloaded'});
  await page.locator('.subject-picker[data-catalog-state="ready"]').waitFor({state:'visible'});
  assert(await page.locator('.subject-options button').count()===4,'expected unsupported rows to be displayed');
  assert(await page.locator('.subject-options button').first().isDisabled(),'wrong-build subject selectable');
  pass('WRONG_BUILD_NEGATIVE');
  subjectScenario='wrong-schema';
  await page.getByRole('button',{name:'Refresh verified subjects'}).click();
  await page.locator('.subject-picker[data-catalog-state="ready"]').waitFor({state:'visible'});
  assert(await page.locator('.subject-options button').first().isDisabled(),'wrong-schema selectable');
  pass('WRONG_SCHEMA_NEGATIVE');
  subjectScenario='network-error';
  await page.getByRole('button',{name:'Refresh verified subjects'}).click();
  await page.locator('.subject-picker[data-catalog-state="error"]').waitFor({state:'visible'});
  assert(await page.getByText('Verified subject lookup failed.',{exact:false}).isVisible(),'network error missing');
  subjectScenario='verified';
  await page.getByRole('button',{name:'Refresh verified subjects'}).click();
  await page.locator('.subject-picker[data-catalog-state="ready"]').waitFor({state:'visible'});
  assert(await page.locator('.subject-options button').count()===4,'retry did not restore verified catalog');
  pass('NETWORK_ERROR_AND_RETRY');
  await page.goto(origin+'/gallery/my/',{waitUntil:'domcontentloaded'});
  assert(await page.getByRole('button',{name:'Sign in',exact:false}).count()>0,'My Gallery unsigned auth state missing');
  pass('MY_GALLERY_AUTH_REQUIRED');
  mediaScenario='ok';
  await page.goto(origin+'/gallery/decorations/',{waitUntil:'domcontentloaded'});
  await page.locator('.gallery-card .gallery-proxy-image').first().waitFor({state:'visible',timeout:10000});
  await page.locator('.gallery-card .gallery-proxy-image').first().evaluate(async img=>{
    if(!img.complete)await new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true})});
    if(img.naturalWidth===0)throw new Error('Proxy image failed browser binary load');
  });
  assert(gatewayCalls.some(x=>x.method==='POST')&&gatewayCalls.some(x=>x.method==='GET'),
    'Gallery must resolve streamUrl then load GET through same Edge');
  assert(!gatewayCalls.some(x=>x.path.includes('/storage/')),'raw Storage route used');
  pass('EDGE_PROXY_BROWSER_POST_AND_BINARY_GET',{transport:'synthetic_authorized_gateway'});
  mediaScenario='revoked';
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.gallery-card .missing-image').first().waitFor({state:'visible',timeout:10000});
  assert(await page.locator('.gallery-card img').count()===0,'revoked media still rendered');
  pass('GALLERY_REVOKED_BINARY_FAIL_CLOSED');
  mediaScenario='no-fixture';
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
