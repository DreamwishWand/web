// Independent 04 QR add-on: NEW browser subcases only. Exact PR282 production tree is immutable.
// No real Auth, Provider, CDN or media. Delayed public APIs are isolated disposable fixtures.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin='http://127.0.0.1:4202', apiHost='qr-independent-282.invalid';
const id={
  ga:'12345678-1234-4234-8234-123456789abc',
  gb:'87654321-4321-4432-8432-cba987654321',
  gc:'13572468-1234-4234-8234-123456789abc',
  question:'24681357-1234-4234-8234-123456789abc',
  tip:'35792468-1234-4234-8234-123456789abc',
  creator:'11112222-3333-4444-8555-666677778888',
  dream:'abcabcab-cabc-4abc-8abc-abcabcabcabc'
};
const checks=[], calls=[], pageErrors=[], holds=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(predicate,label)=>{
  const end=Date.now()+12000;
  while(Date.now()<end){if(await predicate())return;await pause(75);}
  throw Error('TIMEOUT_'+label);
};
const headers={'content-type':'application/json','access-control-allow-origin':'*',
  'access-control-allow-methods':'POST,OPTIONS',
  'access-control-allow-headers':'apikey,content-type,accept'};
function defer(rpc,match){
  let release;
  const awaited=new Promise(resolve=>{release=resolve;});
  const gate={rpc,match,awaited,release,seen:0,responded:0,errors:[]};
  holds.push(gate);
  return gate;
}
async function fulfill(route,data,status=200){
  await route.fulfill({status,headers,body:JSON.stringify(data)});
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:820}});
const page=await ctx.newPage();
page.on('pageerror',e=>pageErrors.push(e.message));
await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!==apiHost)return route.continue();
  if(route.request().method()==='OPTIONS')
    return route.fulfill({status:204,headers,body:''});
  const input=route.request().postDataJSON()??{};
  const rpc=String(input.rpc??url.pathname.split('/').pop()),params=input.payload??input;
  calls.push({rpc,params,path:url.pathname});
  const gate=holds.find(g=>g.rpc===rpc&&g.match(params));
  if(gate){
    gate.seen++;
    const outcome=await gate.awaited;
    try{await fulfill(route,outcome.data,outcome.status??200);gate.responded++;}
    catch(e){gate.errors.push(String(e));}
    return;
  }
  if(rpc==='community_get_creator_public_v1')
    return fulfill(route,{handle:'qa-new',displayName:'QR Independent Creator',bio:''});
  if(rpc==='community_get_gallery_public_v1'){
    const workId=params.p_work_id;
    const title=workId===id.gb?'Gallery B':workId===id.gc?'Gallery C':'Gallery A';
    return fulfill(route,{workId,workType:'gallery',title,description:'synthetic',
      mediaIds:[],comments:[],usedItems:[]});
  }
  if(rpc==='community_get_question_public_v1')
    return fulfill(route,{questionId:params.p_question_id,title:'Question A',
      body:'Synthetic question',answers:[],contextTags:[],freshness:'current'});
  if(rpc==='community_get_tip_public_v1')
    return fulfill(route,{tipId:params.p_tip_id,title:'Tip A',
      body:'Synthetic tip',contextTags:[],freshness:'current'});
  if(rpc==='community_search_questions_v1')
    return fulfill(route,[{question_id:id.question,title:'Question A',text_content:'Synthetic question'}]);
  if(rpc==='community_search_public'){
    if(params.p_creator_profile_id)return fulfill(route,[
      {work_id:id.ga,work_type:'gallery',title:'Gallery A',text_content:'Gallery'},
      {work_id:id.question,work_type:'question',title:'Question A',text_content:'Question'},
      {work_id:id.tip,work_type:'tip',title:'Tip A',text_content:'Tip'},
      {work_id:id.dream,work_type:'dreamsnap',title:'DO_NOT_LEAK_DS_TITLE',text_content:'DO_NOT_LEAK_DS_BODY'}
    ]);
    if(params.p_work_type==='tip')
      return fulfill(route,[{work_id:id.tip,work_type:'tip',title:'Tip A',text_content:'Tip'}]);
    return fulfill(route,[{work_id:id.ga,work_type:'gallery',title:'Gallery A',text_content:'Gallery'}]);
  }
  return fulfill(route,{message:'UNSUPPORTED_SYNTHETIC_RPC'},403);
});

async function goto(path){
  const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200,'HTTP 200 '+path);
}
async function spa(path){
  await page.evaluate(path=>{
    const link=document.createElement('a');
    link.id='qr-spa-link';link.href=path;link.textContent='QA navigate';
    link.style.cssText='position:fixed;left:12px;bottom:8px;z-index:9999;background:white;color:black;padding:8px';
    document.body.append(link);
  },path);
  await page.locator('#qr-spa-link').click();
  await page.waitForURL(origin+path);
  await page.locator('#qr-spa-link').evaluate(el=>el.remove()).catch(()=>{});
}
const galleryDetail=()=>page.locator('article.detail h2');
const qaDetail=()=>page.locator('article.detail h2');
async function assertInvalid(path,selector,forbiddenRpc){
  const before=calls.filter(c=>forbiddenRpc(c.rpc)).length;
  await goto(path);
  await page.locator(selector).waitFor();
  assert.equal(await page.locator('article.detail').count(),0,path);
  await pause(100);
  assert.equal(calls.filter(c=>forbiddenRpc(c.rpc)).length,before,path+' triggered detail RPC');
}
const galleryRpc=rpc=>rpc==='community_get_gallery_public_v1';
const qaRpc=rpc=>rpc==='community_get_question_public_v1'||rpc==='community_get_tip_public_v1';

try{
  for(const path of [
    '/gallery/?work='+id.ga+'&work='+id.gb,
    '/gallery/?work='+id.ga+'&unknown=1',
    '/gallery/?question='+id.question,
    '/gallery/?work=00000000-0000-0000-0000-000000000000'
  ])await assertInvalid(path,'[data-gallery-state="invalid-work-url"]',galleryRpc);
  checks.push('gallery-duplicate-unknown-mistyped-nil-queries-no-detail-rpc');

  for(const path of [
    '/qa/?question='+id.question+'&question='+id.question,
    '/qa/?tip='+id.tip+'&tip='+id.tip,
    '/qa/?question='+id.question+'&unknown=1',
    '/qa/?unknown='+id.question,
    '/qa/?question='+id.question+'&tip='+id.tip,
    '/qa/?type=questions&type=tips'
  ])await assertInvalid(path,'[data-qa-state="invalid-work-url"]',qaRpc);
  checks.push('qa-duplicate-unknown-mixed-type-queries-no-detail-rpc');

  await goto('/gallery/');
  await wait(async()=>await page.locator('.grid button.card').count()>0,'initial-gallery-list');
  const staleList=defer('community_search_public',p=>p.p_query==='STALE_OLD'&&p.p_work_type==='gallery');
  await page.locator('.search input').fill('STALE_OLD');
  await page.locator('.search button').click();
  await wait(()=>staleList.seen===1,'pending-gallery-list');
  await spa('/gallery/?work='+id.gb);
  await wait(async()=>await galleryDetail().count()===1,'new-gallery-detail');
  assert.equal(await galleryDetail().innerText(),'Gallery B');
  staleList.release({data:[{work_id:id.gc,work_type:'gallery',title:'STALE_OLD_LIST',text_content:'wrong'}]});
  await wait(()=>staleList.responded===1||staleList.errors.length>0,'stale-gallery-list-reply');
  assert.equal(staleList.responded,1,'old list was not delivered to SPA');
  await pause(200);
  assert.equal((await page.locator('body').innerText()).includes('STALE_OLD_LIST'),false);
  assert.equal(await galleryDetail().innerText(),'Gallery B');
  assert.equal(await page.locator('.search button').isDisabled(),false);
  checks.push('gallery-delayed-search-response-and-finally-discarded');

  const staleDetail=defer('community_get_gallery_public_v1',p=>p.p_work_id===id.ga);
  await spa('/gallery/?work='+id.ga);
  await wait(()=>staleDetail.seen===1,'pending-gallery-detail');
  await spa('/gallery/?work='+id.gb);
  await wait(async()=>await galleryDetail().count()===1,'new-gallery-B');
  staleDetail.release({data:{workId:id.ga,workType:'gallery',title:'STALE_DETAIL',mediaIds:[]}});
  await wait(()=>staleDetail.responded===1||staleDetail.errors.length>0,'stale-detail-reply');
  assert.equal(staleDetail.responded,1,'old detail was not delivered to SPA');
  await pause(200);
  assert.equal(await galleryDetail().innerText(),'Gallery B');
  assert.equal((await page.locator('body').innerText()).includes('STALE_DETAIL'),false);
  checks.push('gallery-delayed-detail-response-discarded');

  const staleError=defer('community_get_gallery_public_v1',p=>p.p_work_id===id.gc);
  await spa('/gallery/?work='+id.gc);
  await wait(()=>staleError.seen===1,'pending-gallery-error');
  await spa('/gallery/?work='+id.gb);
  await wait(async()=>await galleryDetail().count()===1,'valid-gallery-after-error-navigation');
  staleError.release({status:503,data:{message:'STALE_ERROR_NEVER_SHOW'}});
  await wait(()=>staleError.responded===1||staleError.errors.length>0,'stale-gallery-error-reply');
  assert.equal(staleError.responded,1,'old error was not delivered');
  await pause(200);
  assert.equal(await page.getByRole('alert').count(),0);
  assert.equal(await galleryDetail().innerText(),'Gallery B');
  assert.equal(await page.locator('.search button').isDisabled(),false);
  checks.push('gallery-delayed-error-and-busy-state-discarded');

  await spa('/gallery/?work='+id.ga);
  await wait(async()=>await galleryDetail().count()===1,'gallery-A');
  await page.goBack({waitUntil:'domcontentloaded'});
  await page.waitForURL(origin+'/gallery/?work='+id.gb);
  await wait(async()=>await galleryDetail().count()===1,'history-back-gallery-B');
  assert.equal(await galleryDetail().innerText(),'Gallery B');
  await page.goForward({waitUntil:'domcontentloaded'});
  await page.waitForURL(origin+'/gallery/?work='+id.ga);
  await wait(async()=>await galleryDetail().count()===1,'history-forward-gallery-A');
  assert.equal(await galleryDetail().innerText(),'Gallery A');
  checks.push('gallery-history-back-forward-replaces-detail');

  const staleQuestion=defer('community_get_question_public_v1',p=>p.p_question_id===id.question);
  await spa('/qa/?question='+id.question);
  await wait(()=>staleQuestion.seen===1,'pending-question');
  await spa('/qa/?tip='+id.tip);
  await wait(async()=>await qaDetail().count()===1,'qa-tip-ready');
  staleQuestion.release({status:503,data:{message:'STALE_QUESTION_ERROR'}});
  await wait(()=>staleQuestion.responded===1||staleQuestion.errors.length>0,'stale-question-reply');
  assert.equal(staleQuestion.responded,1,'question error not delivered');
  await pause(200);
  assert.equal(await qaDetail().innerText(),'Tip A');
  assert.equal(await page.getByRole('alert').count(),0);
  assert.equal(await page.locator('.search button').isDisabled(),false);
  checks.push('qa-delayed-question-error-after-tip-navigation-discarded');

  await goto('/creator/?id='+id.creator);
  await wait(async()=>await page.locator('[data-typed-work-route="tip"]').count()===1,'creator-ready');
  const ds=page.locator('[data-typed-work-route="dreamsnap-gated"]');
  assert.equal(await ds.count(),1);
  assert.equal(await ds.getAttribute('href'),'/dreamsnaps/');
  const allText=await page.locator('body').innerText();
  assert.equal(allText.includes('DO_NOT_LEAK_DS_TITLE'),false);
  assert.equal(allText.includes('DO_NOT_LEAK_DS_BODY'),false);
  assert.equal((await page.locator('a[href*="'+id.dream+'"]').count()),0);

  for(const [type,path,title] of [
    ['gallery','/gallery/?work='+id.ga,'Gallery A'],
    ['question','/qa/?question='+id.question,'Question A'],
    ['tip','/qa/?tip='+id.tip,'Tip A']
  ]){
    await page.locator('[data-typed-work-route="'+type+'"]').click();
    await page.waitForURL(origin+path);
    await wait(async()=>await page.locator('article.detail h2').count()===1,'creator-'+type);
    assert.equal(await page.locator('article.detail h2').innerText(),title);
    await page.goBack({waitUntil:'domcontentloaded'});
    await page.waitForURL(origin+'/creator/?id='+id.creator);
    await wait(async()=>await page.locator('[data-typed-work-route="'+type+'"]').count()===1,'creator-back-'+type);
  }
  checks.push('creator-three-positive-typed-routes-and-dreamsnap-no-id-boundary');

  const first=page.locator('[data-typed-work-route="gallery"]');
  await first.focus();
  assert.equal(await first.evaluate(el=>document.activeElement===el),true);
  await page.keyboard.press('Escape');
  assert.equal(page.url(),origin+'/creator/?id='+id.creator);
  await page.keyboard.press('Enter');
  await page.waitForURL(origin+'/gallery/?work='+id.ga);
  await wait(async()=>await galleryDetail().count()===1,'keyboard-enter-detail');
  const close=page.locator('article.detail button');
  await close.focus();
  await page.keyboard.press('Enter');
  await wait(async()=>await galleryDetail().count()===0,'keyboard-close-button');
  checks.push('keyboard-focus-escape-no-unintended-nav-enter-route-and-close');

  const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  const paths=['/gallery/','/qa/','/creator/?id='+id.creator];
  const sizes=[];
  for(const code of locales){
    await page.setViewportSize({width:1280,height:820});
    await goto('/gallery/');
    await page.locator('#site-locale').selectOption(code);
    await wait(async()=>await page.locator('html').getAttribute('data-locale')===code,'locale-'+code);
    await page.setViewportSize({width:320,height:760});
    for(const path of paths){
      await goto(path);
      if(path.startsWith('/creator/'))await page.locator('[data-typed-work-route="tip"]').waitFor();
      const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
      sizes.push({code,path,...dims});
      assert.ok(dims.scroll<=dims.inner+2,JSON.stringify({code,path,...dims}));
    }
  }
  checks.push('eight-locales-three-representative-routes-320px-no-horizontal-overflow');
  assert.deepEqual(pageErrors,[],'uncaught browser page errors');
  checks.push('new-scenarios-no-pageerror');
  console.log(JSON.stringify({verdict:'04QR_PR282_REMAINING_CHROME_PASS',checks,
    owner:'36f08eba1ef5c0cd865e74bdd3e183ff028f6858',
    chrome:await browser.version(),requests:calls.length,representative320:sizes},null,2));
}catch(error){
  console.error(JSON.stringify({verdict:'04QR_PR282_REMAINING_CHROME_FAIL',
    passed:checks,failed:String(error),url:page.url(),requests:calls.length,
    holds:holds.map(h=>({rpc:h.rpc,seen:h.seen,responded:h.responded,errors:h.errors})),
    pageErrors},null,2));
  throw error;
}finally{await browser.close();}
