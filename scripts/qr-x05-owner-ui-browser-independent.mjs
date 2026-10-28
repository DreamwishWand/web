import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';

const base=(process.env.QR_X05_BASE_URL||'http://127.0.0.1:4176').replace(/\/$/,'');
if(!process.env.CHROME_BIN)throw Error('CHROME_BIN required');
const work='11111111-1111-4111-8111-111111111111';
const report={scope:'QR INDEPENDENT PRIVATE X05 REAL CHROME SYNTHETIC NO BACKEND',checks:[],externalRequests:[],pageErrors:[],consoleErrors:[],result:'PENDING'};
const must=(x,message)=>{if(!x)throw Error(message)};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const uri=new URL(base);
function guard(ctx){
 ctx.on('request',req=>{
  const u=req.url();
  if(u.startsWith('data:')||u.startsWith('blob:'))return;
  try{const p=new URL(u);if(p.origin!==uri.origin)report.externalRequests.push(u)}
  catch{report.externalRequests.push(u)}
 });
}
function errors(page){
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
}
const wait=async(page,status)=>page.locator('[data-owner-state="'+status+'"]').waitFor({state:'visible',timeout:15000});
await mkdir('.artifacts/qr-x05-owner-ui',{recursive:true});
try{
 const anonymous=await browser.newContext({viewport:{width:320,height:740}});guard(anonymous);
 const anon=await anonymous.newPage();errors(anon);
 await anon.goto(base+'/dreamsnaps/my/manage/',{waitUntil:'domcontentloaded'});
 await wait(anon,'authentication-required');
 must(await anon.locator('[data-owner-state="local-draft"]').count()===0,'anonymous local draft exposure');
 for(const bad of ['?work=nope','?entry='+work,'?work='+work+'&work='+work,
  '?work='+work+'&entry='+work,'?work='+work+'&media='+work,
  '?work='+work+'&revision='+work,'?work='+work+'&creator='+work]){
  await anon.goto(base+'/dreamsnaps/my/manage/'+bad,{waitUntil:'domcontentloaded'});
  await wait(anon,'invalid-url');
  must(await anon.locator('img').count()===0,'image on rejected route '+bad);
 }
 report.checks.push('QR_ANON_AND_QUERY_COLLISION_NEGATIVES');

 const live=await browser.newContext({viewport:{width:1280,height:850}});guard(live);
 await live.addInitScript(()=>{
  sessionStorage.setItem('dreamwishwand-community-session-v1',JSON.stringify({
   accessToken:'QR_FAKE_NOT_AUTHORITY',refreshToken:'QR_FAKE_NOT_AUTHORITY',
   userId:'22222222-2222-4222-8222-222222222222',
   email:null,expiresAt:Date.now()+600000
  }));
 });
 const page=await live.newPage();errors(page);
 await page.goto(base+'/dreamsnaps/my/manage/',{waitUntil:'domcontentloaded'});
 await wait(page,'local-draft');
 must(await page.locator('[data-owner-feature="off"]').count()===1,'missing feature disabled');
 must(await page.locator('[data-owner-action]:not(:disabled)').count()===0,'mutating action enabled');
 must(await page.locator('[data-owner-erasure="unknown"]').count()===1,'erase state falsely verified');
 must(await page.locator('[data-public-detail="disabled"]').count()===1,'public detail enabled');
 must(await page.locator('[data-media-operations="disabled"]').count()===1,'media operations enabled');
 await page.locator('#ds-kind').selectOption('PostEventCreation');
 await page.locator('#ds-challenge').fill('33333333-3333-4333-8333-333333333333');
 await page.locator('#ds-concept').fill('independent local-only test');
 await page.locator('[data-owner-state="local-draft"] button').click();
 must(await page.locator('[data-owner-preview="local-only"]').count()===1,'preview missing');
 await page.locator('#ds-kind').selectOption('OriginalCompetition');
 must(await page.locator('[data-owner-preview="local-only"]').count()===0,'stale typed preview');
 must(await page.locator('[data-owner-kind-rule="OriginalCompetition"]').count()===1,'wrong subtype');
 report.checks.push('QR_TYPED_LOCAL_PREVIEW_NO_WRITE');

 await page.goto(base+'/dreamsnaps/my/manage/?work='+work,{waitUntil:'domcontentloaded'});
 await wait(page,'backend-unavailable');
 must(await page.locator('#ds-concept').count()===0,'owner backend bypass');
 await page.goto(base+'/dreamsnaps/my/manage/?work='+work+'&work='+work,{waitUntil:'domcontentloaded'});
 await wait(page,'invalid-url');
 await page.goBack({waitUntil:'domcontentloaded'});
 await wait(page,'backend-unavailable');
 await page.goForward({waitUntil:'domcontentloaded'});
 await wait(page,'invalid-url');
 must(await page.locator('[data-owner-preview="local-only"]').count()===0,'stale async preview retained');
 report.checks.push('QR_BACK_FORWARD_AND_STALE_ROUTE_FENCED');

 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.goto(base+'/dreamsnaps/my/manage/',{waitUntil:'domcontentloaded'});
  await wait(page,'local-draft');
  await page.locator('#site-locale').selectOption(locale);
  await page.waitForFunction(x=>document.documentElement.lang===x,locale,{timeout:10000});
  await page.setViewportSize({width:320,height:740});
  const d=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  must(d.scroll<=d.client+2,'mobile overflow '+locale+' '+JSON.stringify(d));
  const grant=page.locator('[data-owner-action="image-grant"]'),del=page.locator('[data-owner-action="request-delete"]');
  must(await grant.isDisabled()&&await del.isDisabled(),'grant/delete enabled '+locale);
  must(await grant.getAttribute('aria-disabled')==='true'&&await del.getAttribute('aria-disabled')==='true','ARIA disabled false '+locale);
  await page.locator('#ds-kind').focus();
  must(await page.locator('#ds-kind').evaluate(el=>document.activeElement===el),'keyboard focus failed '+locale);
  await page.setViewportSize({width:1280,height:850});
 }
 report.checks.push('QR_8_LOCALE_320PX_KEYBOARD_ARIA');
 must(report.externalRequests.length===0,'EXTERNAL HTTP request(s): '+JSON.stringify(report.externalRequests));
 must(report.pageErrors.length===0,'page errors '+JSON.stringify(report.pageErrors));
 must(report.consoleErrors.length===0,'console errors '+JSON.stringify(report.consoleErrors));
 report.checks.push('QR_ZERO_EXTERNAL_BACKEND_SIGNER_STORAGE_CDN_REQUESTS');
 report.result='PASS';
}catch(e){report.result='FAIL';report.failure=String(e);}
finally{
 await writeFile('.artifacts/qr-x05-owner-ui/result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 await browser.close();
}
if(report.result!=='PASS')throw Error(report.failure);
