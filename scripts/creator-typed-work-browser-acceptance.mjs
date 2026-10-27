import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin=(process.env.CREATOR_TEST_BASE_URL??'http://127.0.0.1:4175').replace(/[/]$/,'');
if(!process.env.CHROME_BIN)throw Error('CHROME_BIN missing');
const creatorId='11111111-1111-4111-8111-111111111111';
const types=[
  {work_id:'22222222-2222-4222-8222-222222222222',work_type:'gallery',title:'Gallery positive candidate',text_content:'source only'},
  {work_id:'33333333-3333-4333-8333-333333333333',work_type:'tip',title:'Tip positive candidate',text_content:'source only'},
  {work_id:'44444444-4444-4444-8444-444444444444',work_type:'question',title:'Question positive candidate',text_content:'source only'},
  {work_id:'55555555-5555-4555-8555-555555555555',work_type:'dreamsnap',title:'SECRET_NEVER_RENDER_DREAMSNAP',text_content:'SECRET_NEVER_RENDER_DETAIL'},
  {work_id:'66666666-6666-4666-8666-666666666666',work_type:'unknown',title:'SECRET_UNKNOWN'},
  {work_id:'77777777-7777-4777-8777-777777777777',work_type:'gallery',visibility:'private',title:'SECRET_PRIVATE'},
  {work_id:'88888888-8888-4888-8888-888888888888',work_type:'dreamsnap',retired:true,title:'SECRET_RETIRED'}
];
const report={checks:[],requests:[],pageErrors:[],consoleErrors:[],source:'STATIC_MOCK_HTTP_SYNTHETIC_ONLY',result:'IN_PROGRESS'};
const ok=x=>report.checks.push(x);
const assert=(v,msg)=>{if(!v)throw Error(msg)};
async function eventually(fn,timeout=15000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await fn())return;await new Promise(r=>setTimeout(r,120));}throw Error('Timed out: '+fn.toString().slice(0,130))}
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850}});
const page=await context.newPage();
page.on('pageerror',e=>report.pageErrors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
await page.route('http://127.0.0.1:4799/**',async route=>{
 const u=new URL(route.request().url());
 report.requests.push(u.pathname);
 const headers={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS',
   'access-control-allow-headers':'apikey,content-type,accept','content-type':'application/json'};
 if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers,body:''});return;}
 if(u.pathname.endsWith('/community-public-query')){await route.fulfill({status:200,headers,body:JSON.stringify({handle:'synthetic',displayName:'Synthetic Creator',bio:''})});return;}
 if(u.pathname.endsWith('/community_search_public')){await route.fulfill({status:200,headers,body:JSON.stringify(types)});return;}
 await route.fulfill({status:403,headers,body:JSON.stringify({error:'UNSUPPORTED_SYNTHETIC_REQUEST'})});
});
const outDir='.artifacts/creator-typed-work-browser';
await mkdir(outDir,{recursive:true});
try{
 const initial=await page.goto(origin+'/creator/?id='+creatorId,{waitUntil:'domcontentloaded'});
 assert(initial?.status()===200,'Creator HTTP '+initial?.status()+': '+(await page.locator('body').innerText()).slice(0,400));
 await eventually(async()=>await page.locator('[data-typed-work-route]').count()===types.length);
 assert(await page.locator('[data-typed-work-route="gallery"]').count()===1,'gallery typed route missing');
 assert(await page.locator('[data-typed-work-route="tip"]').count()===1,'tip typed route missing');
 assert(await page.locator('[data-typed-work-route="question"]').count()===1,'question typed route missing');
 assert(await page.locator('[data-typed-work-route="dreamsnap-gated"]').count()===1,'dreamsnap gated route missing');
 for(const [type,expected] of [['gallery','/gallery/?work=2222'],['tip','/qa/?tip=3333'],['question','/qa/?question=4444'],['dreamsnap-gated','/dreamsnaps/community/?work=5555']]) {
   const href=await page.locator('[data-typed-work-route="'+type+'"]').getAttribute('href');
   assert(href.includes(expected),type+' incorrect '+href);
 }
 assert(await page.locator('[data-typed-work-route="unavailable"]').count()===3,'unknown/private/retired must be inert');
 const text=await page.locator('.grid').innerText();
 for(const secret of ['SECRET_NEVER_RENDER_DREAMSNAP','SECRET_NEVER_RENDER_DETAIL','SECRET_PRIVATE','SECRET_RETIRED','SECRET_UNKNOWN'])
   assert(!text.includes(secret),'redacted Creator source disclosure: '+secret);
 ok('CREATOR_TYPE_MATRIX_GALLERY_QUESTION_TIP_DREAMSNAP_NO_TIP_FALLBACK');
 ok('CREATOR_UNKNOWN_PRIVATE_RETIRED_NO_LINK_OR_TEXT');

 const first=page.locator('[data-typed-work-route="dreamsnap-gated"]');
 await first.focus();
 assert(await first.evaluate(el=>el===document.activeElement),'gated Work unreachable by keyboard');
 await page.keyboard.press('Enter');
 await eventually(async()=>await page.locator('[data-dreamsnap-work-state="authority-pending"]').count()===1);
 assert(!(await page.content()).includes('SECRET_NEVER_RENDER'),'Community Work pending page leaks model data');
 assert(!report.requests.some(x=>/media|signer|storage|dreamsnap/i.test(x)),'Gated detail performed unauthorized media request');
 ok('CREATOR_DREAMSNAP_KEYBOARD_TYPED_DETAIL_PUBLIC_AUTHORITY_PENDING_NO_MEDIA');

 const before=report.requests.length;
 for(const q of ['?work=55555555-5555-4555-8555-555555555555&work=55555555-5555-4555-8555-555555555555',
                  '?work=invalid','?work=55555555-5555-4555-8555-555555555555&tip=33333333-3333-4333-8333-333333333333']){
  await page.goto(origin+'/dreamsnaps/community/'+q,{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('[data-dreamsnap-work-state="invalid-url"]').count()===1);
 }
 assert(report.requests.length===before,'Invalid Work detail invoked public RPC');
 ok('DREAMSNAP_DUPLICATE_UNKNOWN_MALFORMED_ENTRY_FAILCLOSED');

 for(const route of ['/creator/?id='+creatorId+'&id='+creatorId,'/creator/?id=not-a-uuid',
    '/gallery/?work=22222222-2222-4222-8222-222222222222&work=22222222-2222-4222-8222-222222222222',
    '/qa/?tip=33333333-3333-4333-8333-333333333333&tip=33333333-3333-4333-8333-333333333333']){
  await page.goto(origin+route,{waitUntil:'domcontentloaded'});
  const selector=route.startsWith('/creator/')?'[data-creator-state="invalid-url"]':route.startsWith('/gallery/')?'[data-gallery-state="invalid-work-url"]':'[data-qa-state="invalid-work-url"]';
  await eventually(async()=>await page.locator(selector).count()===1);
 }
 assert(report.requests.length===before,'Malformed Creator/Gallery/QA deep link triggered unauthorized RPC');
 ok('CREATOR_GALLERY_QA_DUPLICATE_BAD_QUERY_NO_RPC');

 await page.goto(origin+'/gallery/dreamsnaps/?work=55555555-5555-4555-8555-555555555555',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-legacy-dreamsnaps="fail-closed"]').count()===1);
 assert(await page.locator('img').count()===0,'Historical Gallery DreamSnaps image exposed');
 ok('OLD_GALLERY_DREAMSNAPS_WORK_ID_NO_MEDIA_OR_REDIRECT');

 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.goto(origin+'/dreamsnaps/community/?work=55555555-5555-4555-8555-555555555555',{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('[data-dreamsnap-work-state="authority-pending"]').count()===1);
  await page.waitForTimeout(300);
  await page.locator('#site-locale').selectOption(locale);
  await eventually(async()=>await page.locator('html').getAttribute('lang')===locale);
  await page.setViewportSize({width:320,height:760});
  const dims=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert(dims.scroll<=dims.width+2,'320px overflow '+locale+JSON.stringify(dims));
 }
 ok('EIGHT_LANGUAGES_320PX_GATED_WORK_DETAIL');
 assert(report.pageErrors.length===0,'pageErrors='+report.pageErrors);
 assert(report.consoleErrors.length===0,'consoleErrors='+report.consoleErrors);
 report.result='PASS';
}catch(e){report.result='FAIL';report.failed=String(e)}finally{
 await writeFile(outDir+'/result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 await browser.close();
}
if(report.result!=='PASS')throw Error(report.failed);
