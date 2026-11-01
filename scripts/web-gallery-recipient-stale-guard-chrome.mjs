import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

if(!process.env.CHROME_BIN)throw Error('CHROME_BIN_REQUIRED');
const origin=(process.env.GALLERY_RECEIVER_BASE_URL??'http://127.0.0.1:4175').replace(/\/$/,'');
const ids={
  a:'11111111-1111-4111-8111-111111111111',
  b:'22222222-2222-4222-8222-222222222222',
  slow:'33333333-3333-4333-8333-333333333333',
  fast:'44444444-4444-4444-8444-444444444444',
  tip:'55555555-5555-4555-8555-555555555555',
  dream:'66666666-6666-4666-8666-666666666666'
};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const works=[
  {work_id:ids.a,work_type:'gallery',title:'Public Gallery A',text_content:'Gallery A'},
  {work_id:ids.b,work_type:'gallery',title:'Public Gallery B',text_content:'Gallery B'},
  {work_id:ids.dream,work_type:'dreamsnap',title:'SECRET_DREAMSNAP_EMBARGO',text_content:'SECRET_CONCEPT'},
  {work_id:ids.tip,work_type:'tip',title:'SECRET_TIP_ON_GALLERY'},
  {work_id:'invalid-work-id',work_type:'gallery',title:'SECRET_INVALID_ID'},
  {work_id:ids.slow,work_type:'gallery',visibility:'private',title:'SECRET_PRIVATE'}
];
const records=[],pageErrors=[],consoleErrors=[];
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
let count=0, slowBrowse=false, slowDetail=false, oldBrowseError=false, wrongDetail=false;
async function eventually(fn,timeout=14000){
  const end=Date.now()+timeout;
  while(Date.now()<end){if(await fn())return;await pause(85);}
  throw Error('TIMEOUT_WHILE_WAITING');
}
try {
  const ctx=await browser.newContext({viewport:{width:1280,height:840}});
  const page=await ctx.newPage();
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.route('https://qr222-synthetic.invalid/**',async route=>{
    const req=route.request(),u=new URL(req.url()),payload=req.method()==='POST'?req.postDataJSON()??{}:{};
    const rpc=payload.rpc??u.pathname, p=payload.payload??{};
    const headers={
      'content-type':'application/json','access-control-allow-origin':'*',
      'access-control-allow-methods':'GET,POST,OPTIONS',
      'access-control-allow-headers':'apikey,content-type,accept'
    };
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers,body:''});return;}
    records.push({rpc:String(rpc),payload:p});
    if(u.pathname.endsWith('/community_search_public')){
      if(slowBrowse && p.query==null)await pause(1450);
      if(oldBrowseError && p.query==='LATE_ERROR'){
        await pause(1100);
        await route.fulfill({status:503,headers,body:'{"message":"Synthetic old browse failure"}'});
        return;
      }
      await route.fulfill({status:200,headers,
        body:JSON.stringify(p.query==='FAST'?[
          {work_id:ids.b,work_type:'gallery',title:'Fast Query B',text_content:'Current'}
        ]:works)});
      return;
    }
    if(rpc==='community_get_gallery_public_v1'){
      const id=p.p_work_id;
      if(slowDetail && id===ids.a)await pause(1450);
      let detail={workId:id,workType:'gallery',title:id===ids.b?'Gallery Detail B':'Gallery Detail A',
        description:'synthetic accepted gallery',mediaIds:[],comments:[],usedItems:[]};
      if(wrongDetail && id===ids.a)detail={...detail,workType:'dreamsnap',
        title:'SECRET_WRONG_TYPE',mediaIds:[ids.dream]};
      if(wrongDetail && id===ids.b)detail={...detail,workId:ids.a,
        title:'SECRET_WRONG_ID',mediaIds:[ids.dream]};
      await route.fulfill({status:200,headers,body:JSON.stringify(detail)});
      return;
    }
    if(rpc==='community_search_questions_v1'||rpc==='community_get_tip_public_v1' ||
       rpc==='community_get_question_public_v1'){
      let body=[];
      if(rpc==='community_get_tip_public_v1')
        body={tipId:p.p_tip_id,title:'Synthetic Tip Detail',body:'Tip',contextTags:[]};
      if(rpc==='community_get_question_public_v1')
        body={questionId:p.p_question_id,title:'Synthetic Question Detail',body:'Question',contextTags:[],answers:[]};
      await route.fulfill({status:200,headers,body:JSON.stringify(body)});
      return;
    }
    await route.fulfill({status:403,headers,body:'{"message":"UNSUPPORTED_ENDPOINT"}'});
  });
  const open=async path=>page.goto(origin+path,{waitUntil:'domcontentloaded'});
  const spa=async path=>{
    const absolute=origin+path;
    await page.evaluate(href=>{
      const a=document.createElement('a');
      a.href=href;a.textContent='QA synthetic SPA navigation';
      a.setAttribute('data-web-recipient-spa','');
      document.body.appendChild(a);
    },absolute);
    await page.locator('[data-web-recipient-spa]').last().click();
    await page.waitForURL(absolute);
  };
  const title=async()=>page.locator('article.detail h2').allInnerTexts();
  const rpcCount=(rpc)=>records.filter(x=>x.rpc===rpc).length;

  await open('/gallery/?work='+ids.a);
  await eventually(async()=>JSON.stringify(await title())==='["Gallery Detail A"]');
  const cards=page.locator('.grid button.card');
  await eventually(async()=>await cards.count()===2);
  assert.equal(await page.locator('.grid').innerText().then(x=>x.includes('SECRET_')),false);
  count++; // Creator-type Gallery candidate only, typed valid and filtered unsafe candidates

  const clicked=page.locator('.grid button.card').filter({hasText:'Public Gallery B'});
  await clicked.focus();assert.equal(await clicked.evaluate(x=>x===document.activeElement),true);
  await page.keyboard.press('Enter');
  await eventually(async()=>JSON.stringify(await title())==='["Gallery Detail B"]');
  count++; // Keyboard click valid canonical onSelect Gallery

  const before=rpcCount('community_get_gallery_public_v1');
  for(const path of [
    '/gallery/?work=invalid',
    '/gallery/?tip='+ids.tip,
    '/gallery/?question='+ids.a,
    '/gallery/?work='+ids.a+'&work='+ids.a,
    '/gallery/?work='+ids.a+'&tip='+ids.tip,
    '/gallery/?work='+ids.a+'&unknown=one'
  ]){
    await spa(path);
    await page.locator('[data-gallery-state="invalid-work-url"]').waitFor({state:'visible'});
    assert.deepEqual(await title(),[]);
    assert.equal(rpcCount('community_get_gallery_public_v1'),before);
    assert.equal(await page.locator('button.card').count(),0);
  }
  count++; // mixed, foreign, duplicated, malformed, invalid detail URL never invokes work RPC

  await spa('/gallery/?work='+ids.a);
  await eventually(async()=>JSON.stringify(await title())==='["Gallery Detail A"]');
  await page.goBack({waitUntil:'domcontentloaded'});
  await page.locator('[data-gallery-state="invalid-work-url"]').waitFor({state:'visible'});
  await page.goForward({waitUntil:'domcontentloaded'});
  await eventually(async()=>JSON.stringify(await title())==='["Gallery Detail A"]');
  count++; // Back and forward clear and re-parse

  slowDetail=true;
  await spa('/gallery/?work='+ids.a);
  await eventually(async()=>records.filter(x=>x.rpc==='community_get_gallery_public_v1' && x.payload.p_work_id===ids.a).length>=3);
  await spa('/gallery/?work='+ids.b);
  await eventually(async()=>JSON.stringify(await title())==='["Gallery Detail B"]');
  await pause(1600);
  assert.deepEqual(await title(),['Gallery Detail B']);
  slowDetail=false;
  count++; // Slow old detail does not overwrite newer navigation

  slowBrowse=true;
  await spa('/gallery/?work='+ids.a);
  await spa('/gallery/?work='+ids.b);
  await eventually(async()=>JSON.stringify(await title())==='["Gallery Detail B"]');
  await pause(1600);
  assert.deepEqual(await title(),['Gallery Detail B']);
  assert.equal(await page.locator('.grid button.card').count(),2);
  slowBrowse=false;
  count++; // Old browse result/finally cannot clobber current route

  wrongDetail=true;
  await spa('/gallery/?work='+ids.a);
  await eventually(async()=>rpcCount('community_get_gallery_public_v1')>before+5);
  await pause(250);
  assert.deepEqual(await title(),[]);
  await spa('/gallery/?work='+ids.b);
  await pause(250);
  assert.deepEqual(await title(),[]);
  assert.ok(!await page.locator('body').innerText().then(x=>x.includes('SECRET_WRONG')));
  wrongDetail=false;
  count++; // Cross-type detail and mismatched Work ID fail closed

  await spa('/gallery/');
  await eventually(async()=>await page.locator('.grid button.card').count()===2);
  oldBrowseError=true;
  const search=page.locator('.search input');
  await search.fill('LATE_ERROR');
  await page.locator('.search button[type="submit"]').click();
  await spa('/gallery/?work='+ids.b);
  await eventually(async()=>JSON.stringify(await title())==='["Gallery Detail B"]');
  await pause(1350);
  assert.deepEqual(await title(),['Gallery Detail B']);
  assert.equal(await page.locator('.form-error').count(),0);
  oldBrowseError=false;
  count++; // stale failure cannot display over new selected detail

  for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    await page.locator('#site-locale').selectOption(locale);
    await eventually(async()=>await page.locator('html').getAttribute('lang')===locale);
    await page.setViewportSize({width:320,height:760});
    const m=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
    assert.ok(m.scroll<=m.width+2,locale+JSON.stringify(m));
    await spa('/gallery/?work='+ids.a+'&tip='+ids.tip);
    await page.locator('[data-gallery-state="invalid-work-url"][role=alert]').waitFor({state:'visible'});
    await spa('/gallery/?work='+ids.b);
    await eventually(async()=>JSON.stringify(await title())==='["Gallery Detail B"]');
    await page.setViewportSize({width:1280,height:840});
  }
  count++; // Eight locales, 320px & alert a11y regression

  await spa('/qa/?tip='+ids.tip);
  await eventually(async()=>JSON.stringify(await page.locator('article.detail h2').allInnerTexts())==='["Synthetic Tip Detail"]');
  await spa('/qa/?question='+ids.a);
  await eventually(async()=>JSON.stringify(await page.locator('article.detail h2').allInnerTexts())==='["Synthetic Question Detail"]');
  await page.goBack({waitUntil:'domcontentloaded'});
  await eventually(async()=>JSON.stringify(await page.locator('article.detail h2').allInnerTexts())==='["Synthetic Tip Detail"]');
  count++; // Existing Q&A typed parser across Gallery SPA aliases, not new parser

  assert.ok(!records.some(x=>/sign|media|storage|dreamsnap/i.test(x.rpc)));
  assert.deepEqual(pageErrors,[]);
  assert.deepEqual(consoleErrors,[]);
  count++; // No DreamSnaps signer/provider/media or JS page errors
  await ctx.close();
} finally {await browser.close();}
assert.equal(count,11);
console.log('WEB_GALLERY_RECIPIENT_NEW_ONLY_SYNTHETIC_CHROME_11_OF_11_PASS');
