import { mkdir, writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
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
let ownerScenario='off';
let cloudScenario='valid';
const ownerId='55555555-5555-4555-8555-555555555555';
const ownerWorkId='66666666-6666-4666-8666-666666666666';
const ownerPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const ownerSha=createHash('sha256').update(ownerPng).digest('hex');
const ownerReadCalls=[];
function cloudFixture(){
 return {
  contract:'ddv.gallery-cloud-preservation-readiness@1',
  entitlement:{source:'not_configured',state:'unverified',verified:false,active:false,providerEvidencePresent:false},
  ownerAccountResolved:true,creatorOwnershipAndModerationValid:true,
  databaseManifest:{workRowFound:true,currentRevisionId:ownerId,currentRevisionPresent:true,
    currentRevisionSealed:true,revisionRowCount:2,historicalRevisionRowCount:1,sealedRevisionRowCount:2,
    coverReferenceCount:2,coverWithoutCompositionCount:0,mediaReferenceCount:4,
    distinctMediaCount:2,invalidOrNonOwnedMediaCount:0,structuralIntegrityObserved:true},
  storageObjectByteReadbackVerified:false,cloudPrivateStorageAclVerified:false,
  cloudBackupAndRestoreVerified:false,cloudEntitlementVerified:false,
  dependencyGraphCoverageVerified:false,signedUrlAndCacheRevocationProven:false,
  privateSaveAuthorized:false,privateDetailAuthorized:false,restoreAuthorized:false,
  republishAuthorized:false,blockedReasons:['GALLERY_CLOUD_ENTITLEMENT_SOURCE_NOT_CONFIGURED',
    'GALLERY_CLOUD_BACKUP_RESTORE_NOT_ACCEPTED','GALLERY_DEPENDENCY_GRAPH_INCOMPLETE']
 };
}

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
  if(url.pathname.endsWith('/functions/v1/community-query')&&ownerScenario!=='off'){
    const req=route.request(),body=req.postDataJSON();
    if(req.headers()['authorization']!=='Bearer synthetic-owner-token')
      return route.fulfill({status:401,contentType:'application/json',body:'{"ok":false,"error":"SESSION_REVOKED_OR_INVALID"}'});
    if(body.query==='myGallery')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{
        myWorks:[{workId:ownerWorkId,title:'Private owner test',galleryKind:'outdoor',
          lifecycleState:'published',visibility:'public'}],saved:[]}})});
    if(body.query==='gallery')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{
        workId:ownerWorkId,isOwner:true,title:'Private owner test',mediaIds:[ownerId],
        description:'Fixture owner Work',creator:{displayName:'Test creator'}}})});
    if(body.query==='galleryRetirementPreflight'){
      if(cloudScenario==='forbidden')return route.fulfill({status:403,contentType:'application/json',
        body:'{"ok":false,"error":"FORBIDDEN"}'});
      const nested=cloudFixture();
      if(cloudScenario==='malformed')nested.contract='ddv.gallery-cloud-preservation-readiness@999';
      if(cloudScenario==='inconsistent'){
        nested.databaseManifest.coverWithoutCompositionCount=1;
        nested.databaseManifest.invalidOrNonOwnedMediaCount=1;
        nested.databaseManifest.structuralIntegrityObserved=false;
      }
      const data={
        contract:'ddv.gallery-public-retirement-preflight@1',workId:ownerWorkId,
        rowVersion:1,revisionId:ownerId,ownerEligible:true,graphComplete:false,dependencyCoverage:{},
        blockedReasons:['GALLERY_DEPENDENCY_GRAPH_INCOMPLETE'],cloudEntitlementVerified:false,
        cloudPrivateStorageVerified:false,cloudOwnerRestoreVerified:false,
        previousSignedUrlsRevoked:false,cdnAndBrowserPurgeProven:false
      };
      if(cloudScenario!=='legacy'){
        data.cloudPreservation=nested;
        Object.assign(data,{
          dependencyCoverageContract:'ddv.gallery-cross-product-coverage@1',
          dependencyCoverageClassification:{scene:'SEMANTICS_UNKNOWN',biome:'SEMANTICS_UNKNOWN',
            floating_island:'SEMANTICS_UNKNOWN',tom_furniture:'SEMANTICS_UNKNOWN',
            tom_clothing:'SEMANTICS_UNKNOWN',native_listing:'REGISTRY_MISSING'},
          dependencyRelationCoverage:{gallery_work_revisions:'VERIFIED',
            gallery_revision_presets:'VERIFIED_EMPTY',
            preset_artifacts_associated_gallery_work_id:'REGISTRY_MISSING',
            media_and_cover:'03_COMM_CLOUD_PRESERVATION_PREFLIGHT',
            creator_owner:'VERIFIED'},
          dependencyMissingSources:['NATIVE_IN_GAME_LISTING_REGISTRY_NOT_DEPLOYED'],
          dependencyBlockedReasons:['GALLERY_DEPENDENCY_GRAPH_INCOMPLETE'],
          dependencyGraphFingerprintSha256:'a'.repeat(64),
          dependencySnapshotNotAtomicMutationFence:true,
          dependencySnapshotRowVersion:data.rowVersion,
          dependencySourceVersionState:'VERIFIED',
          dependencyOwnerMismatchEdgeCount:0,dependencyCreatorMismatchEdgeCount:0
        });
      }
      if(cloudScenario==='dependency-mismatch'){
        data.dependencyOwnerMismatchEdgeCount=2;
        data.dependencyCreatorMismatchEdgeCount=1;
      }
      if(cloudScenario==='dependency-stale')data.dependencySnapshotRowVersion=99;
      if(cloudScenario==='dependency-bad-version')data.dependencyCoverageContract='ddv.gallery-cross-product-coverage@999';
      if(cloudScenario==='dependency-missing')delete data.dependencyMissingSources;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})});
    }
    return route.fulfill({status:400,contentType:'application/json',body:'{"error":"Fixture query unsupported"}'});
  }
  if(url.pathname.endsWith('/functions/v1/community-media')&&ownerScenario!=='off'){
    const req=route.request(),body=req.postDataJSON();
    ownerReadCalls.push({action:body.action,mediaId:body.mediaId,bearer:req.headers()['authorization']==='Bearer synthetic-owner-token'});
    if(!req.headers()['authorization']||ownerScenario==='forbidden')
      return route.fulfill({status:403,contentType:'application/json',body:'{"ok":false,"error":"GALLERY_OWNER_MEDIA_FORBIDDEN"}'});
    if(body.action==='read')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,action:'read',
        media:{mediaId:ownerId,transport:'authenticated_edge_binary_post',readAction:'galleryReadBytes',
        requiresOwnerBearer:true,rawStorageSignedUrlIssued:false,mimeType:'image/png',
        byteSize:ownerPng.length,width:1,height:1,checksumSha256:ownerSha}})});
    if(body.action==='galleryReadBytes'){
      const payload=ownerScenario==='checksum'?Buffer.from(ownerPng).fill(1):ownerPng;
      return route.fulfill({status:200,body:payload,headers:{'Content-Type':'image/png',
        'Content-Length':String(payload.length),'Cache-Control':'private, no-store'}});
    }
    return route.fulfill({status:400,contentType:'application/json',body:'{"error":"Wrong binary action"}'});
  }
  if(url.pathname.endsWith('/functions/v1/community-public-media')){
    gatewayCalls.push({method:route.request().method(),path:url.pathname,query:url.search});
    if(mediaScenario==='revoked'||mediaScenario==='historical'||mediaScenario==='private'||mediaScenario==='missing')
      return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"MEDIA_NOT_PUBLIC"}'});
    if(mediaScenario==='forbidden')
      return route.fulfill({status:403,contentType:'application/json',body:'{"ok":false,"error":"FORBIDDEN"}'});
    if(mediaScenario==='unavailable')
      return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"GALLERY_MEDIA_AUTHORITY_UNAVAILABLE"}'});
    if(mediaScenario==='legacy-gallery')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        ok:true,media:{mediaId:gatewayId,signedUrl:'https://example.test/storage/v1/object/sign/forbidden',
        mimeType:'image/png',width:1,height:1}
      })});
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
  for(const scenario of ['revoked','historical','private','missing','forbidden','unavailable','legacy-gallery']){
    mediaScenario=scenario;
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.gallery-card .missing-image').first().waitFor({state:'visible',timeout:10000});
    assert(await page.locator('.gallery-card img').count()===0,scenario+' media still rendered');
  }
  pass('GALLERY_REVOKED_HISTORICAL_PRIVATE_MISSING_403_404_503_NO_LEGACY_FALLBACK');
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
  // Synthetic auth only: use the exact two POSTs with an ephemeral actor token.
  // Never treat this as signed Staging acceptance or seed real Auth credentials.
  ownerScenario='valid';
  await page.evaluate(()=>sessionStorage.setItem('dreamwishwand-community-session-v1',JSON.stringify({
    accessToken:'synthetic-owner-token',refreshToken:'synthetic-refresh-token',
    expiresAt:Date.now()+600000,userId:'77777777-7777-4777-8777-777777777777',email:null
  })));
  await page.goto(origin+'/gallery/my/',{waitUntil:'domcontentloaded'});
  await page.locator('.my-card .overflow-menu summary').first().waitFor({state:'visible',timeout:10000});
  await page.locator('.my-card .overflow-menu summary').first().click();
  await page.locator('.my-card .overflow-menu button').nth(1).click();
  await page.locator('.gallery-retirement-preflight').waitFor({state:'visible',timeout:10000});
  await page.locator('.cloud-preservation-readiness dl').waitFor({state:'visible',timeout:10000});
  const cloudPanel=page.locator('.cloud-preservation-readiness');
  assert(await cloudPanel.locator('dt').count()===11,'cloud diagnostic dimensions missing');
  assert(await cloudPanel.locator('dd').count()===11,'cloud diagnostic states missing');
  const cloudText=await cloudPanel.innerText();
  assert(!cloudText.includes(ownerId)&&!cloudText.includes(ownerWorkId),
    'Owner revision or work identifiers should not be exposed in Cloud status');
  assert(!cloudText.includes('GALLERY_CLOUD_')&&!cloudText.includes('storageKey'),
    'internal SQL/storage codes exposed');
  assert(await cloudPanel.locator('button:not([disabled])').count()===0,
    'Cloud diagnostic accidentally added an enabled mutation');
  assert(await page.locator('.owner-panel button[disabled]').count()>=2,
    'Cloud readiness accidentally enabled an owner mutation');
  await overflow(page,'cloud-readiness-320');
  pass('SYNTHETIC_CLOUD_NESTED_WORK_HISTORY_MEDIA_READONLY_320');
  // Integrated #123->#126->#129 owner-only dependency coverage is diagnostic.
  const coveragePanel=page.locator('.gallery-dependency-readiness');
  await coveragePanel.waitFor({state:'visible',timeout:10000});
  assert(await coveragePanel.locator('dt').count()===13,'expected source + 6 preset/native + relation/missing/blocked/mismatch/fingerprint rows');
  assert(await coveragePanel.getAttribute('data-read-only')==='true','coverage was marked actionable');
  assert(await coveragePanel.getAttribute('data-owner-mismatch')==='false','fixture owner mismatch wrongly marked');
  assert(!(await coveragePanel.innerText()).includes('a'.repeat(64)),'fingerprint leaked into DOM');
  assert(await page.locator('.owner-panel button[disabled]').count()>=2,'graph readiness enabled a mutation');
  pass('SYNTHETIC_INTEGRATED_DEPENDENCY_GRAPH_DIAGNOSTIC_ONLY');
    const retryCloud=page.locator('.gallery-retirement-preflight button').last();
  cloudScenario='malformed';
  await retryCloud.click();
  await page.locator('.gallery-retirement-preflight [role=alert]').waitFor({state:'visible',timeout:10000});
  assert(await page.locator('.cloud-preservation-readiness').count()===0,
    'unsupported Cloud contract was displayed');
  cloudScenario='legacy';
  await retryCloud.click();
  await page.locator('.gallery-retirement-preflight [role=status]').filter({hasText:/./}).last().waitFor({state:'visible',timeout:10000});
  assert(await page.locator('.cloud-preservation-readiness').count()===0,
    'legacy response invented nested Cloud verification');
  cloudScenario='inconsistent';
  await retryCloud.click();
  await page.locator('.cloud-preservation-readiness [role=alert]').waitFor({state:'visible',timeout:10000});
  cloudScenario='forbidden';
  await retryCloud.focus();
  await page.keyboard.press('Enter');
  await page.locator('.gallery-retirement-preflight [role=alert]').waitFor({state:'visible',timeout:10000});
  assert(await cloudPanel.count()===0,'nonowner Cloud manifest still displayed');
  pass('SYNTHETIC_CLOUD_WRONG_OWNER_KEYBOARD_RETRY_FAIL_CLOSED');
  cloudScenario='valid';
  await retryCloud.click();
  await cloudPanel.locator('dl').waitFor({state:'visible',timeout:10000});
  pass('SYNTHETIC_CLOUD_MALFORMED_LEGACY_INCONSISTENT_AND_RETRY');
  cloudScenario='dependency-mismatch';
  await retryCloud.click();
  await coveragePanel.waitFor({state:'visible',timeout:10000});
  assert(await coveragePanel.getAttribute('data-owner-mismatch')==='true','owner mismatch not signaled');
  assert(await coveragePanel.getAttribute('data-creator-mismatch')==='true','creator mismatch not signaled');
  assert(await page.locator('.owner-panel button[disabled]').count()>=2,'unsafe action enabled on owner mismatch');
  for(const bad of ['dependency-stale','dependency-bad-version','dependency-missing']){
    cloudScenario=bad;
    await retryCloud.click();
    await page.locator('.gallery-retirement-preflight [role=alert]').waitFor({state:'visible',timeout:10000});
    assert(await coveragePanel.count()===0,bad+' was shown despite invalid snapshot');
  }
  cloudScenario='valid';
  await retryCloud.focus();
  await page.keyboard.press('Enter');
  await coveragePanel.waitFor({state:'visible',timeout:10000});
  pass('SYNTHETIC_INTEGRATED_OWNER_CREATOR_MISMATCH_ROWVERSION_CONTRACT_FAIL_CLOSED');
    const ownerButton=page.locator('.owner-panel .blocked-actions button:not([disabled])').first();
  await page.evaluate(()=>{
    window.__ownerRevocations=[];
    const original=URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL=(url)=>{window.__ownerRevocations.push(url);original(url)};
  });
  await ownerButton.click();
  const ownerImage=page.locator('.owner-media-read img').first();
  await ownerImage.waitFor({state:'visible',timeout:10000});
  await ownerImage.evaluate(async img=>{
    if(!img.complete)await new Promise((resolve,reject)=>{
      img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true})});
    if(!img.naturalWidth)throw new Error('Owner Blob image failed');
  });
  assert((await ownerImage.getAttribute('src')).startsWith('blob:'),
    'Owner media must display only memory Blob URL');
  assert(ownerReadCalls.some(x=>x.action==='read'&&x.bearer)&&
    ownerReadCalls.some(x=>x.action==='galleryReadBytes'&&x.bearer),
    'Owner binary two authenticated POSTs not observed');
  await overflow(page,'owner-preview-320');
  assert(await page.locator('.owner-panel button[disabled]').count()>=2,
    'Owner preview accidentally enabled unsafe mutation');
  pass('SYNTHETIC_OWNER_JWT_METADATA_BINARY_BLOB_PREVIEW_AND_PREFLIGHT');
  const initialOwnerUrl=await ownerImage.getAttribute('src');
  ownerScenario='checksum';
  await ownerButton.click(); // unmount -> revoke prior object URL
  assert(await page.evaluate(url=>window.__ownerRevocations.includes(url),initialOwnerUrl),
    'Owner Blob URL was not revoked after preview close');
  await ownerButton.click(); // load wrong SHA bytes; MUST fail closed
  await page.locator('.owner-media-read [role=alert]').waitFor({state:'visible',timeout:10000});
  assert(await page.locator('.owner-media-read img').count()===0,'checksum mismatch still displayed');
  pass('SYNTHETIC_OWNER_SHA_MISMATCH_FAIL_CLOSED_AND_RETRY');
  // Capacity admission remains disabled. Verify the actual browser module maps
  // server HTTP429 codes; do NOT simulate any real upload/Storage mutation.
  const quota=await page.evaluate(async()=>{
    const {parseGalleryCapacityError}=await import('/src/lib/community/gallery-owner-media.js');
    const codes=['GALLERY_UPLOAD_OUTSTANDING_COUNT_EXCEEDED',
      'GALLERY_UPLOAD_RESERVED_BYTES_EXCEEDED',
      'GALLERY_GLOBAL_BACKLOG_COUNT_EXCEEDED',
      'GALLERY_GLOBAL_RESERVED_BYTES_EXCEEDED',
      'GALLERY_GLOBAL_CLEANUP_STALLED'];
    return codes.map(code=>({
      code, parsed:parseGalleryCapacityError({status:429,code,retryAfterSeconds:45}),
      noRetry:parseGalleryCapacityError({status:429,code}),
      denied:parseGalleryCapacityError({status:403,code})
    }));
  });
  assert(quota.length===5&&quota.every(x=>x.parsed?.code===x.code&&
    x.parsed.retryAfterSeconds===45&&x.noRetry?.retryAfterSeconds===null&&x.denied===null),
    'account/global capacity 429 browser contract failed');
  pass('SYNTHETIC_ACCOUNT_GLOBAL_CAPACITY_429_NO_INVENTED_RETRY');
    // Clear synthetic session before proceeding; no user token in DOM or URL.
  await page.evaluate(()=>sessionStorage.removeItem('dreamwishwand-community-session-v1'));
  ownerScenario='off';
    report.consoleErrors=report.consoleErrors.filter(x=>!x.includes('Failed to load resource'));
  assert(!report.pageErrors.length,'page JS errors '+report.pageErrors.join(';'));
  assert(!report.consoleErrors.length,'console errors '+report.consoleErrors.join(';'));
  report.status='PASS';report.catalogTransport='SYNTHETIC_HTTP_INTERCEPTION_ONLY';
}catch(e){report.status='FAIL';report.error=String(e?.stack??e);throw e}
finally{
  await writeFile('.artifacts/gallery-stage1/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));await browser.close();
}
