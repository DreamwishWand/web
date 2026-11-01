// Independent 04 QR browser probe. No production credentials or real providers.
// Separate assertions/fixtures from Owner Chrome scripts; run against exact combined PR282.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = 'http://127.0.0.1:4198';
const apiHost = 'qr-independent-282.invalid';
const ids = {
  a:'12345678-1234-4234-8234-123456789abc',
  b:'87654321-4321-4432-8432-cba987654321',
  creator:'11112222-3333-4444-8555-666677778888',
  dream:'abcabcab-cabc-4abc-8abc-abcabcabcabc'
};
const visits=[], pageErrors=[], checks=[];
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(f,msg)=>{const end=Date.now()+10000;while(Date.now()<end){if(await f())return;await pause(100);}throw Error('TIMEOUT_'+msg);};
const headers={'content-type':'application/json','access-control-allow-origin':'*',
  'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'apikey,content-type,accept'};
const ctx=await browser.newContext({viewport:{width:1280,height:820}});
const page=await ctx.newPage();
page.on('pageerror',e=>pageErrors.push(e.message));
const reply=async(route,data)=>route.fulfill({status:200,headers,body:JSON.stringify(data)});
await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname!==apiHost)return route.continue();
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
  const input=route.request().postDataJSON()??{};
  const rpc=input.rpc??u.pathname, params=input.payload??input;
  visits.push({path:u.pathname,rpc,params});
  if(String(rpc)==='community_get_creator_public_v1')
    return reply(route,{handle:'qa-indy',displayName:'Independent QA Creator',bio:''});
  if(String(rpc)==='community_get_gallery_public_v1') {
    const id=params.p_work_id;
    return reply(route,{workId:id,workType:id===ids.b?'dreamsnap':'gallery',
      title:id===ids.b?'FORBIDDEN_WRONG_TYPE':'Accepted QA Gallery A',
      description:'controlled mock',mediaIds:id===ids.b?[ids.dream]:[],comments:[],usedItems:[]});
  }
  if(u.pathname.endsWith('/community_search_public')) {
    const list=u.pathname.includes('none')?[]:[
      {work_id:ids.a,work_type:'gallery',title:'Accepted QA Gallery A',text_content:'Public mock'},
      {work_id:ids.dream,work_type:'dreamsnap',title:'FORBIDDEN_DREAMSNAP_TITLE',text_content:'FORBIDDEN_DREAMSNAP_TEXT'},
      {work_id:ids.b,work_type:'tip',title:'FORBIDDEN_TIP_ON_GALLERY'}
    ];
    return reply(route,list);
  }
  if(String(rpc)==='community_get_question_public_v1')
    return reply(route,{questionId:params.p_question_id,title:'QA Question'});
  if(String(rpc)==='community_get_tip_public_v1')
    return reply(route,{tipId:params.p_tip_id,title:'QA Tip'});
  return route.fulfill({status:403,headers,body:'{"error":"UNSUPPORTED_FAKE_ENDPOINT"}'});
});
try {
  const goto=async(path)=>{const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});assert.equal(response?.status(),200,path);};
  const detail=()=>page.locator('article.detail h2');

  await goto('/gallery/?work='+ids.a+'&tip='+ids.b);
  await page.locator('[data-gallery-state="invalid-work-url"][role=alert]').waitFor();
  assert.equal(await detail().count(),0);
  assert.equal(visits.filter(v=>v.rpc==='community_get_gallery_public_v1').length,0);
  checks.push('mixed-gallery-parameters-denied-before-detail-rpc');

  await goto('/gallery/?work='+ids.a);
  await wait(async()=>await detail().count()===1,'valid-gallery-detail');
  assert.equal(await detail().innerText(),'Accepted QA Gallery A');
  const cards=page.locator('.grid button.card');
  await wait(async()=>await cards.count()===1,'filtered-gallery-candidate');
  assert.equal((await page.locator('body').innerText()).includes('FORBIDDEN_DREAMSNAP_TITLE'),false);
  checks.push('gallery-valid-detail-and-untrusted-cross-type-candidates-filtered');

  await goto('/gallery/?work='+ids.b);
  await wait(async()=>visits.some(v=>v.rpc==='community_get_gallery_public_v1'&&v.params.p_work_id===ids.b),'wrong-type-request');
  await pause(300);
  assert.equal(await detail().count(),0);
  assert.equal((await page.locator('body').innerText()).includes('FORBIDDEN_WRONG_TYPE'),false);
  assert.equal(visits.filter(v=>/public-media|sign/i.test(v.path)).length,0);
  checks.push('mismatched-detail-type-denied-before-media-signer');

  await goto('/creator/?id='+ids.creator);
  await wait(async()=>await page.locator('[data-typed-work-route]').count()>=3,'creator-types');
  const gated=page.locator('[data-typed-work-route="dreamsnap-gated"]');
  assert.equal(await gated.count(),1);
  assert.equal(await gated.getAttribute('href'),'/dreamsnaps/');
  const body=await page.locator('body').innerText();
  assert.equal(body.includes('FORBIDDEN_DREAMSNAP_TITLE'),false);
  assert.equal(body.includes('FORBIDDEN_DREAMSNAP_TEXT'),false);
  checks.push('creator-dreamsnap-embargo-no-work-id-or-text');

  await goto('/qa/?question='+ids.a+'&tip='+ids.b);
  await page.locator('[data-qa-state="invalid-work-url"][role=alert]').waitFor();
  assert.equal(await detail().count(),0);
  checks.push('qa-mixed-alias-denied');

  await page.locator('#site-locale').selectOption('ja');
  await page.setViewportSize({width:320,height:760});
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  assert.ok(dims.scroll<=dims.inner+2,JSON.stringify(dims));
  checks.push('japanese-320px-without-horizontal-overflow');
  assert.deepEqual(pageErrors,[]);
  checks.push('no-page-script-errors');
  console.log(JSON.stringify({verdict:'04QR_INDEPENDENT_PR282_REAL_CHROME_PASS',
    checks,chrome:await browser.version(),requests:visits.length,viewport:dims},null,2));
} finally {
  await browser.close();
}
