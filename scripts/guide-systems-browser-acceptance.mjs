import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { PAGE_INDEX } from '../src/lib/guide/systems-catalog.js';
import { SYSTEMS_LOCALES, SYSTEMS_PUBLIC_SCHEMA } from '../src/lib/guide/systems-public.js';

const base=(process.env.GUIDE_BASE_URL || 'http://127.0.0.1:4178').replace(/\/$/,'');
const bin=process.env.CHROME_BIN;
if(!bin)throw Error('CHROME_BIN required');
const dir='.artifacts/guide-systems-browser';
await mkdir(dir,{recursive:true});
const evidence={startedAt:new Date().toISOString(),url:base,checks:[],pageErrors:[],consoleErrors:[],synthetic:true};
const assert=(v,m)=>{if(!v)throw Error(m);};
const success=name=>evidence.checks.push({name,status:'PASS'});
async function until(fn,timeout=15000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await fn())return;await new Promise(r=>setTimeout(r,125));}throw Error('Timeout waiting: '+fn.toString());}
const target={platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',saveSchema:624};
const fixture=(id,related=[])=>{
 const p=PAGE_INDEX.get(id);
 return {id,categoryId:p.categoryId,groupId:p.groupId,primaryMechanicKey:p.mechanicKey,
 publicationStatus:'PUBLISHED',publicationApproved:true,rightsApproved:true,currentVersionReviewed:true,allEightLocalesReviewed:true,
 sourceEnglishGuidanceSha256:p.sourceHash,sourceLabel:'SYNTHETIC TEST ONLY',confidence:'CONFIRMED',reviewedAt:'2026-10-24',
 dlcContext:[],relatedArticleIds:related,localized:Object.fromEntries(SYSTEMS_LOCALES.map(lang=>[lang,{
 title: id==='DREAMSNAPS'?'DreamSnaps test article':'Photo Mode test article',
 summary:'Synthetic reviewed test copy; not released content.',
 prerequisites:['Synthetic prerequisite'],instructions:['Synthetic instruction'],warnings:['Synthetic warning']
 }]))};
};
const sample={schema:SYSTEMS_PUBLIC_SCHEMA,target,articles:[fixture('DREAMSNAPS',['PHOTO_MODE']),fixture('PHOTO_MODE',['DREAMSNAPS'])]};
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},locale:'en-US'});
const page=await ctx.newPage();
page.on('pageerror',err=>evidence.pageErrors.push(String(err)));
page.on('console',msg=>{if(msg.type()==='error')evidence.consoleErrors.push(msg.text());});
async function noOverflow(){const dims=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);assert(dims[0]<=dims[1]+2,'Horizontal overflow '+dims);}
try{
  await page.goto(base+'/guide/',{waitUntil:'domcontentloaded'});
  await until(async()=>await page.locator('.guide-tabs a[href$="/guide/systems/"]').count()===1);
  assert(await page.locator('.guide-tabs button').count()===3,'Guide must show three other root tabs');
  success('GUIDE_FOUR_CHILD_ROOT');

  await page.locator('.guide-tabs a[href$="/guide/systems/"]').click();
  await until(async()=>await page.locator('[data-systems-state="empty"]').count()===1);
  assert(await page.locator('.category-block').count()===7,'Seven approved categories missing');
  assert(await page.locator('[data-systems-state="results"]').count()===0,'Unapproved article exposed');
  assert(!(await page.locator('main').innerText()).includes('Quest and Mission Progression'),'Leaked unpublished article title');
  success('ZERO_PUBLIC_ARTICLES_SEVEN_CATEGORY_BROWSE');

  await page.locator('.category-block').nth(3).locator('button').first().click();
  assert(await page.locator('.group-list button').count()===5,'Gathering category must expose 4 groups plus All');
  await page.locator('.group-list button').nth(2).click();
  assert(await page.locator('[data-systems-state="empty"]').count()===1,'Empty category leaked content');
  success('CANONICAL_GROUPS_AND_EMPTY');

  await page.locator('#systems-search').fill('ドリームスナップス');
  assert(await page.locator('[data-systems-state="results"]').count()===0,'Unknown JA alias creates unapproved result');
  await page.locator('#systems-version').selectOption('1.25.3');
  assert(await page.locator('[data-systems-state="unknown-version"]').count()===1,'Unknown build not blocked');
  success('SEARCH_PUBLICATION_AND_UNKNOWN_VERSION_GATE');

  await page.goto(base+'/guide/systems/?article=DREAMSNAPS',{waitUntil:'domcontentloaded'});
  await until(async()=>await page.locator('[data-systems-state="unpublished"]').count()===1);
  success('UNPUBLISHED_STABLE_ENTITY_URL_NO_LEAK');

  for(const lang of SYSTEMS_LOCALES){
    await page.locator('#site-locale').selectOption(lang);
    await page.locator('.category-block').first().locator('button').first().click();
    const heading=(await page.locator('h1').textContent()||'').trim();
    assert(heading.length>0,'Missing '+lang+' interface heading');
    assert((await page.locator('.category-block').count())===7,'Changed categories '+lang);
    await page.setViewportSize({width:320,height:800});
    await noOverflow();
    await page.setViewportSize({width:1280,height:900});
  }
  success('EIGHT_LOCALES_320PX_AND_A11Y_CONTROLS');

  await page.route('**/ddv/guide/v1.25/systems-public.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(sample)}));
  await page.goto(base+'/guide/systems/',{waitUntil:'domcontentloaded'});
  await until(async()=>await page.locator('.systems-result').count()===2);
  assert(await page.locator('.systems-result').count()===2,'Synthetic published browse does not include exactly two');
  await page.locator('#systems-search').fill('写真と');
  await until(async()=>await page.locator('.systems-result').count()===2);
  await page.locator('#systems-search').fill('DreamSnaps');
  await until(async()=>await page.locator('.systems-result').count()===2);
  const ids=await page.locator('.systems-result').evaluateAll(nodes=>nodes.map(node=>new URL(node.getAttribute('href'),location.href).searchParams.get('article')));
  assert(new Set(ids).size===2&&ids.includes('DREAMSNAPS')&&ids.includes('PHOTO_MODE'),'Bilingual category alias or canonical dedup failed');
  await page.locator('.systems-result').first().click();
  await until(async()=>await page.locator('[data-systems-state="detail"]').count()===1);
  assert((await page.locator('.systems-detail h2').textContent()).includes('DreamSnaps'),'Stable detail mismatch');
  assert(await page.locator('.systems-detail ol li').count()===1,'Verified instruction missing');
  assert(await page.locator('.systems-detail a[href*="PHOTO_MODE"]').count()===1,'Approved related system link missing');
  assert(!(await page.locator('main').innerText()).includes('QUEST_MISSION_PROGRESSION'),'Non-public relation leaked');
  success('SYNTHETIC_APPROVED_SEARCH_DETAIL_CANONICAL_RELATED');

  const rejected={...sample,articles:[{...sample.articles[0],rightsApproved:false}]};
  await page.unroute('**/ddv/guide/v1.25/systems-public.json');
  await page.route('**/ddv/guide/v1.25/systems-public.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rejected)}));
  await page.goto(base+'/guide/systems/?article=DREAMSNAPS',{waitUntil:'domcontentloaded'});
  await until(async()=>await page.locator('[data-systems-state="error"]').count()===1);
  assert(await page.locator('.systems-detail').count()===0,'Failed manifest still displayed article');
  success('MALFORMED_OR_UNAPPROVED_CONTENT_FAIL_CLOSED');

  assert(evidence.pageErrors.length===0,'Page errors: '+evidence.pageErrors);
  assert(evidence.consoleErrors.length===0,'Console errors: '+evidence.consoleErrors);
  success('PAGE_AND_CONSOLE_ERRORS_ZERO');
}catch(e){
 evidence.failed=String(e);
 await page.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});
 throw e;
}finally{
 evidence.completedAt=new Date().toISOString();
 await writeFile(dir+'/evidence.json',JSON.stringify(evidence,null,2)+'\n');
 await browser.close();
 console.log(JSON.stringify({checks:evidence.checks.length,failed:evidence.failed||null,synthetic:true,pageErrors:evidence.pageErrors,consoleErrors:evidence.consoleErrors}));
}
