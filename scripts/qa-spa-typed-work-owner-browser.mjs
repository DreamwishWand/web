import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const origin=(process.env.CREATOR_TEST_BASE_URL??'http://127.0.0.1:4175').replace(/[/]$/,'');
const ids={tip:'33333333-3333-4333-8333-333333333333',
  question:'44444444-4444-4444-8444-444444444444',
  slow:'66666666-6666-4666-8666-666666666666',
  fast:'77777777-7777-4777-8777-777777777777'};
const report={checks:[],rpc:[],pageErrors:[],consoleErrors:[],source:'SYNTHETIC_HTTPS_ONLY_NO_REMOTE_ACTOR',result:'IN_PROGRESS'};
const ok=n=>report.checks.push(n);
const assert=(v,msg)=>{if(!v)throw Error(msg)};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:840}});
const page=await context.newPage();
page.on('pageerror',e=>report.pageErrors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
const json=body=>JSON.stringify(body);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await page.route('https://qr222-synthetic.invalid/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 const payload=req.method()==='POST'?req.postDataJSON()??{}:{};
 const rpc=payload.rpc??url.pathname;
 if(req.method()!=='OPTIONS')report.rpc.push(String(rpc));
 const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS',
   'access-control-allow-headers':'apikey,content-type,accept','content-type':'application/json'};
 if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers,body:''});return;}
 let result=[];
 if(rpc==='community_get_tip_public_v1'){
   const id=payload.payload?.p_tip_id;
   if(id===ids.slow)await wait(1250);
   result={tipId:id,title:id===ids.slow?'QR SLOW TIP':id===ids.fast?'QR FAST TIP':'QR TIP ONE',body:'Tip',contextTags:[]};
 }
 if(rpc==='community_get_question_public_v1'){
   const id=payload.payload?.p_question_id;
   if(id===ids.slow)await wait(1250);
   result={questionId:id,title:'QR QUESTION TWO',body:'Question',contextTags:[],answers:[]};
 }
 if(rpc==='community_search_questions_v1') {
   if(payload.payload?.p_query==='DELAYED')await wait(900);
   result=[];
 }
 if(url.pathname.endsWith('community_search_public'))result=[];
 await route.fulfill({status:200,headers,body:json(result)});
});
async function eventually(fn,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await wait(85)}throw Error('Timed out '+String(fn).slice(0,140))}
const detailTitle=async()=>await page.locator('article.detail h2').allInnerTexts();
const visit=async uri=>{const r=await page.goto(origin+uri,{waitUntil:'domcontentloaded'});assert(r?.status()===200,uri+' HTTP '+r?.status())};
async function spa(uri){
 const url=origin+uri;
 await page.evaluate(href=>{const a=document.createElement('a');a.href=href;a.textContent='Test Q&A SPA change';a.setAttribute('data-qa-spa-probe','');document.body.append(a)},url);
 await page.locator('[data-qa-spa-probe]').last().click();
 await page.waitForURL(url);
}
const count=rpc=>report.rpc.filter(x=>x===rpc).length;
const noDetail=()=>count('community_get_tip_public_v1')+count('community_get_question_public_v1');
try {
 await visit('/qa/?tip='+ids.tip);
 await eventually(async()=>JSON.stringify(await detailTitle())==='["QR TIP ONE"]');
 ok('COLD_TIP_PUBLIC_WORK_ID_DETAIL');

 const qBefore=count('community_get_question_public_v1');
 await spa('/qa/?question='+ids.question);
 await eventually(async()=>JSON.stringify(await detailTitle())==='["QR QUESTION TWO"]');
 assert(count('community_get_question_public_v1')===qBefore+1,'Question detail RPC not exactly once');
 assert(!(await page.locator('main').innerText()).includes('QR TIP ONE'),'Old Tip remains');
 ok('SPA_TIP_TO_QUESTION_REPLACES_WORK_AND_RPC');

 const tBefore=count('community_get_tip_public_v1');
 await spa('/qa/?tip='+ids.tip);
 await eventually(async()=>JSON.stringify(await detailTitle())==='["QR TIP ONE"]');
 assert(count('community_get_tip_public_v1')===tBefore+1,'Tip detail RPC not exactly once');
 ok('SPA_QUESTION_TO_TIP_REPLACES_WORK_AND_RPC');

 const before=noDetail();
 await spa('/qa/?tip=invalid');
 await eventually(async()=>await page.locator('[data-qa-state="invalid-work-url"]').count()===1);
 assert((await detailTitle()).length===0,'Invalid URL retained Detail');
 assert(noDetail()===before,'Invalid URL attempted detail RPC');
 ok('SPA_INVALID_IMMEDIATE_CLEAR_NO_DETAIL_RPC');

 for(const path of ['/qa/?question='+ids.question+'&tip='+ids.tip,
   '/qa/?tip='+ids.tip+'&tip='+ids.tip,
   '/qa/?tip='+ids.tip+'&unexpected=x',
   '/qa/?type=tips&type=questions']){
   await spa(path);
   await eventually(async()=>await page.locator('[data-qa-state="invalid-work-url"]').count()===1);
   assert((await detailTitle()).length===0,'Ambiguous URL retained Detail');
   assert(noDetail()===before,'Ambiguous URL attempted Detail RPC '+path);
 }
 ok('SPA_MIXED_DUPLICATE_UNKNOWN_QUERY_NO_RPC');

 await spa('/qa/?question='+ids.question);
 await eventually(async()=>JSON.stringify(await detailTitle())==='["QR QUESTION TWO"]');
 await page.goBack({waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-qa-state="invalid-work-url"]').count()===1);
 await page.goForward({waitUntil:'domcontentloaded'});
 await eventually(async()=>JSON.stringify(await detailTitle())==='["QR QUESTION TWO"]');
 ok('BROWSER_BACK_FORWARD_REPARSE');

 await spa('/qa/?tip='+ids.slow);
 await eventually(async()=>count('community_get_tip_public_v1')>=tBefore+2);
 await spa('/qa/?tip='+ids.fast);
 await eventually(async()=>JSON.stringify(await detailTitle())==='["QR FAST TIP"]');
 await wait(1600);
 assert(JSON.stringify(await detailTitle())==='["QR FAST TIP"]','Stale slow Tip response overwrote fast Tip');
 ok('RACE_SLOW_OLD_DETAIL_CANNOT_OVERWRITE_NEW_WORK');

 await spa('/qa/?type=tips');
 await eventually(async()=>await page.locator('.tabs button.active').count()===1);
 assert((await page.locator('.tabs button.active').innerText()).toLowerCase().includes('tip'),'Browse Tip mode not selected');
 assert((await detailTitle()).length===0,'Browse mode retains Detail');
 await spa('/qa/?type=questions');
 await eventually(async()=>await page.locator('.tabs button.active').count()===1);
 assert((await page.locator('.tabs button.active').innerText()).toLowerCase().includes('question'),'Browse Question mode not selected');
 ok('TYPE_QUESTIONS_TIPS_BROWSE_PRESERVED');

 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
   await page.setViewportSize({width:1280,height:840});
   await page.locator('#site-locale').selectOption(locale);
   await eventually(async()=>await page.locator('html').getAttribute('lang')===locale);
   await page.setViewportSize({width:320,height:780});
   const dims=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert(dims.scroll<=dims.width+2,'320px overflow '+locale+json(dims));
   await spa('/qa/?tip='+ids.tip);
   await eventually(async()=>JSON.stringify(await detailTitle())==='["QR TIP ONE"]');
   await spa('/qa/?tip=invalid');
   await eventually(async()=>await page.locator('[data-qa-state="invalid-work-url"]').count()===1);
 }
 ok('EIGHT_LOCALES_320PX_VALID_INVALID_AND_KEYBOARD');
 await page.setViewportSize({width:1280,height:840});
 await spa('/qa/?question='+ids.question);
 await eventually(async()=>JSON.stringify(await detailTitle())==='["QR QUESTION TWO"]');
 const link=page.locator('[data-qa-spa-probe]').last();
 await link.focus();
 assert(await link.evaluate(el=>document.activeElement===el),'Link not keyboard focusable');
 await page.keyboard.press('Enter');
 ok('KEYBOARD_FOCUSABLE_SAME_PAGE_ROUTING');
 assert(report.pageErrors.length===0,'Page errors '+json(report.pageErrors));
 assert(report.consoleErrors.length===0,'Console errors '+json(report.consoleErrors));
 report.result='PASS';
}catch(e){report.result='FAIL';report.error=String(e);}finally{
 await mkdir('.artifacts/qa-spa-owner',{recursive:true});
 await writeFile('.artifacts/qa-spa-owner/result.json',json(report)+'\n');
 console.log(json(report));
 await browser.close();
}
if(report.result!=='PASS')throw Error(report.error);
