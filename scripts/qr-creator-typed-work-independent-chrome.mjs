import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

// Independent QR fixture: not the Owner's 7-case browser harness.
// Operates on a disposable Vite host and intercepted synthetic HTTPS only.
const origin=(process.env.QR222_BASE_URL||'http://127.0.0.1:4179').replace(/\/$/,'');
const id={creator:'11111111-1111-4111-8111-111111111111',
 tip:'33333333-3333-4333-8333-333333333333',
 question:'44444444-4444-4444-8444-444444444444',
 dreamsnap:'55555555-5555-4555-8555-555555555555'};
const report={owner:'d54b982a28046c441c7f2030c90f2a387c77f82b',
 mode:'INDEPENDENT_REAL_CHROME_SYNTHETIC_HTTP_ONLY',observations:[],errors:[],consoleErrors:[],
 rpc:[],outcome:'IN_PROGRESS'};
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:320,height:780}});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('console',e=>{if(e.type()==='error')report.consoleErrors.push(e.text())});
page.route('https://qr223-synthetic.invalid/**',async route=>{
 const req=route.request(),url=new URL(req.url()),body=req.postDataJSON?.()||{};
 const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS',
   'access-control-allow-headers':'apikey,content-type,accept','content-type':'application/json'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
 const rpc=body?.rpc??url.pathname;
 report.rpc.push(String(rpc));
 let data=[];
 if(rpc==='community_get_creator_public_v1')data={handle:'qr',displayName:'QR Creator'};
 if(rpc==='community_get_tip_public_v1')data={tipId:id.tip,title:'QR TIP ONE',body:'QR Tip detail',contextTags:[]};
 if(rpc==='community_get_question_public_v1')data={questionId:id.question,title:'QR QUESTION TWO',body:'QR Question detail',contextTags:[],answers:[]};
 if(url.pathname.endsWith('community_search_public'))
   data=[{work_id:id.dreamsnap,work_type:'dreamsnap',title:'CONFIDENTIAL_DREAMSNAP_TITLE',text_content:'CONFIDENTIAL_DREAMSNAP_TEXT'},
         {work_id:id.tip,work_type:'tip',title:'Safe Tip',text_content:'Safe details'},
         {work_id:id.question,work_type:'question',title:'Safe Question',text_content:'Safe details'}];
 await route.fulfill({status:200,headers,body:JSON.stringify(data)});
});
const visit=async url=>{const r=await page.goto(origin+url,{waitUntil:'domcontentloaded'});assert(r?.status()===200,url+':HTTP '+r?.status())};
async function until(fn,ms=10000){const deadline=Date.now()+ms;while(Date.now()<deadline){if(await fn())return;await page.waitForTimeout(100);}throw Error('condition timed out')};
async function samePageClick(url){
 await page.evaluate(href=>{const link=document.createElement('a');link.setAttribute('data-qr-probe','');link.href=href;link.textContent='QA change detail';document.body.append(link)},url);
 await page.locator('[data-qr-probe]').last().click();
 await page.waitForURL(url,{timeout:10000});
 await page.waitForTimeout(350);
}
try{
 await visit('/creator/?id='+id.creator);
 await until(async()=>await page.locator('[data-typed-work-route]').count()===3);
 assert(await page.locator('[data-typed-work-route="dreamsnap-gated"]').count()===1,'DreamSnap not gated');
 const creatorText=await page.locator('.grid').innerText();
 assert(!creatorText.includes('CONFIDENTIAL_'),'Unapproved DreamSnap source text visible');
 const gatedHref=await page.locator('[data-typed-work-route="dreamsnap-gated"]').getAttribute('href');
 assert(gatedHref==='/dreamsnaps/','DreamSnap must lead only to no-ID root: '+gatedHref);
 report.observations.push('Creator Work-to-DreamSnap no-ID gated route PASS');
 await page.locator('[data-typed-work-route="dreamsnap-gated"]').focus();
 await page.keyboard.press('Enter');
 await until(async()=>page.url().endsWith('/dreamsnaps/'));
 assert(!page.url().includes(id.dreamsnap),'DreamSnap WorkID leaked in href');
 report.observations.push('Keyboard navigation to safe root PASS');

 await visit('/qa/?tip='+id.tip);
 await until(async()=>await page.locator('article.detail h2').innerText()==='QR TIP ONE');
 report.observations.push('Direct Tip Work ID -> Q&A Tip Detail PASS');
 const before=report.rpc.filter(x=>x==='community_get_question_public_v1').length;
 await samePageClick(origin+'/qa/?question='+id.question);
 const after=report.rpc.filter(x=>x==='community_get_question_public_v1').length;
 const title=await page.locator('article.detail h2').allInnerTexts();
 if(after>before && title.includes('QR QUESTION TWO'))
   report.observations.push('Same-route Tip -> Question correct ID + detail PASS');
 else (report.findings??=[]).push('SOURCE/CHROME RED: same /qa/ navigation kept stale Tip; question RPC delta='+ (after-before)+' title='+JSON.stringify(title));
 await samePageClick(origin+'/qa/?tip=invalid');
 if(await page.locator('[data-qa-state="invalid-work-url"]').count()===1)
   report.observations.push('Same-route invalid query cleared detail PASS');
 else (report.findings??=[]).push('SOURCE/CHROME RED: invalid same-route Work ID failed to clear prior selected detail');

 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
   await visit('/dreamsnaps/community/?work='+id.dreamsnap);
   await until(async()=>page.locator('[data-dreamsnap-work-state="authority-pending"]').count()===1);
   await page.locator('#site-locale').selectOption(locale);
   await until(async()=>await page.locator('html').getAttribute('lang')===locale);
   const dims=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert(dims.scroll<=dims.client+2,'320px horizontal overflow '+locale+' '+JSON.stringify(dims));
 }
 report.observations.push('8 locales at 320px, gated detail no-media PASS');
 assert(report.errors.length===0,'page errors '+report.errors.join(';'));
 assert(report.consoleErrors.length===0,'console errors '+report.consoleErrors.join(';'));
 assert(!(report.findings?.length),'independent Work route failures: '+JSON.stringify(report.findings));
 report.outcome='PASS';
}catch(error){report.outcome='RED';report.failure=String(error)}finally{
 await mkdir('.artifacts/qr-creator-typed-work',{recursive:true});
 await writeFile('.artifacts/qr-creator-typed-work/result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 await browser.close();
}
if(report.outcome!=='PASS')process.exitCode=1;
