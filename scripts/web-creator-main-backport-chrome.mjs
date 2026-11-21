import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { DREAMSNAPS_PRIVACY_COPY } from '../src/lib/dreamsnaps/privacy-copy.js';

const browserExecutable=process.env.CHROME_BIN;
if(!browserExecutable)throw Error('CHROME_BIN_REQUIRED');
const origin=(process.env.WEB_CREATOR_BASE_URL??'http://127.0.0.1:4175').replace(/\/$/,'');
const creatorId='11111111-1111-4111-8111-111111111111';
const works=[
  {work_id:'22222222-2222-4222-8222-222222222222',work_type:'gallery',title:'Gallery eligible',text_content:'synthetic gallery'},
  {work_id:'33333333-3333-4333-8333-333333333333',work_type:'question',title:'Question eligible',text_content:'synthetic question'},
  {work_id:'44444444-4444-4444-8444-444444444444',work_type:'tip',title:'Tip eligible',text_content:'synthetic tip'},
  {work_id:'55555555-5555-4555-8555-555555555555',work_type:'dreamsnap',title:'SYNTHETIC_EMBARGOED_DREAMSNAP_TITLE',text_content:'SYNTHETIC_EMBARGOED_CONCEPT'},
  {work_id:'66666666-6666-4666-8666-666666666666',work_type:'unknown',title:'SYNTHETIC_INVALID_WORK'},
  {work_id:'77777777-7777-4777-8777-777777777777',work_type:'gallery',visibility:'PRIVATE',title:'SYNTHETIC_PRIVATE_WORK'},
  {work_id:'88888888-8888-4888-8888-888888888888',work_type:'dreamsnap',retired:true,title:'SYNTHETIC_RETIRED_DREAMSNAP'},
  {work_id:null,work_type:'tip',title:'SYNTHETIC_MISSING_ID'}
];
const browser=await chromium.launch({executablePath:browserExecutable,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
let count=0;
const pageErrors=[],consoleErrors=[],requests=[];
const wait=async(fn,timeout=15000)=>{
  const end=Date.now()+timeout;
  while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,125));}
  throw Error('CONDITION_NOT_MET');
};
try {
  const context=await browser.newContext({viewport:{width:1280,height:840}});
  const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
  await page.route('https://qr222-synthetic.invalid/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    requests.push({path:url.pathname,method:req.method(),body:req.postData()??''});
    const headers={
      'content-type':'application/json',
      'access-control-allow-origin':'*',
      'access-control-allow-methods':'POST,GET,OPTIONS',
      'access-control-allow-headers':'apikey,content-type,accept'
    };
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers,body:''});return;}
    if(url.pathname.endsWith('/community-public-query')){
      await route.fulfill({status:200,headers,body:JSON.stringify({handle:'synthetic',displayName:'Synthetic Creator',bio:''})});return;
    }
    if(url.pathname.endsWith('/community_search_public')){
      await route.fulfill({status:200,headers,body:JSON.stringify(works)});return;
    }
    await route.fulfill({status:403,headers,body:'{"error":"UNKNOWN_MOCK_ENDPOINT"}'});
  });
  const initial=await page.goto(origin+'/creator/?id='+creatorId,{waitUntil:'domcontentloaded'});
  assert.equal(initial?.status(),200);
  await wait(async()=>await page.locator('[data-typed-work-route]').count()===works.length);
  const mapped=[
    ['gallery','/gallery/?work=22222222-2222-4222-8222-222222222222'],
    ['question','/qa/?question=33333333-3333-4333-8333-333333333333'],
    ['tip','/qa/?tip=44444444-4444-4444-8444-444444444444'],
    ['dreamsnap-gated','/dreamsnaps/']
  ];
  for(const [type,tail] of mapped){
    const el=page.locator('[data-typed-work-route="'+type+'"]');
    assert.equal(await el.count(),1,type);
    const href=await el.getAttribute('href');
    assert.ok(href.endsWith(tail),type+':'+href);
    if(type==='dreamsnap-gated')assert.ok(!href.includes('55555555'));
  }
  count++; // Typed four-way route, only root for dreamsnap

  assert.equal(await page.locator('[data-typed-work-route="unavailable"]').count(),4);
  const visible=await page.locator('.grid').innerText();
  for(const value of ['SYNTHETIC_EMBARGOED','SYNTHETIC_PRIVATE_WORK',
    'SYNTHETIC_RETIRED_DREAMSNAP','SYNTHETIC_INVALID_WORK','SYNTHETIC_MISSING_ID'])
    assert.ok(!visible.includes(value),'unexpected exposure '+value);
  assert.equal(await page.locator('.grid a[href*="/qa/?tip=55555"]').count(),0);
  count++; // Gated/invalid/private/retired do not leak work or become links

  const link=page.locator('[data-typed-work-route="dreamsnap-gated"]');
  await link.focus();
  assert.equal(await link.evaluate(n=>n===document.activeElement),true);
  await page.keyboard.press('Enter');
  await wait(async()=>new URL(page.url()).pathname.endsWith('/dreamsnaps/'));
  assert.equal(new URL(page.url()).search,'');
  assert.equal(await page.locator('main h1').count()>0,true);
  count++; // Keyboard focus navigation to no-ID landing

  for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    await page.goto(origin+'/creator/?id='+creatorId,{waitUntil:'domcontentloaded'});
    await wait(async()=>await page.locator('[data-typed-work-route="dreamsnap-gated"]').count()===1);
    await page.locator('#site-locale').selectOption(locale);
    await wait(async()=>await page.locator('html').getAttribute('lang')===locale);
    assert.equal((await page.locator('[data-typed-work-route="dreamsnap-gated"] span').innerText()).trim(),
      DREAMSNAPS_PRIVACY_COPY[locale].communityUnavailable,locale);
    assert.equal((await page.locator('[data-typed-work-route="unavailable"]').first().innerText()).trim(),
      DREAMSNAPS_PRIVACY_COPY[locale].legacyUnavailable,locale);
    await page.setViewportSize({width:320,height:740});
    const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
    assert.ok(dims.scroll<=dims.width+2,locale+':'+JSON.stringify(dims));
    await page.setViewportSize({width:1280,height:840});
  }
  count++; // Eight locales & 320px responsive

  await page.goto(origin+'/creator/?id='+creatorId+'&id='+creatorId,{waitUntil:'domcontentloaded'});
  await page.locator('[data-creator-state="invalid-url"]').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-typed-work-route]').count(),0);
  await page.goto(origin+'/creator/?id=invalid',{waitUntil:'domcontentloaded'});
  await page.locator('[data-creator-state="invalid-url"]').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-typed-work-route]').count(),0);
  count++; // Invalid Creator query fail closed

  assert.ok(!requests.some(x=>/media|signer|storage|dreamsnap/i.test(x.path)));
  assert.deepEqual(pageErrors,[]);
  assert.deepEqual(consoleErrors,[]);
  count++; // No media signer and Chrome errors

  await context.close();
} finally {
  await browser.close();
}
assert.equal(count,6);
console.log('WEB_CREATOR_MAIN_BACKPORT_SYNTHETIC_CHROME_6_OF_6_PASS');
