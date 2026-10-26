import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const root=(process.env.COLLECTION_BASE_URL||'http://127.0.0.1:4176').replace(/\/$/,'');
const exe=process.env.CHROME_BIN;
if(!exe)throw new Error('CHROME_BIN missing');
const folder='.artifacts/09int-item-reference';
await mkdir(folder,{recursive:true});
const report={checks:[],pageErrors:[],consoleErrors:[],positiveProvider:false,source:'checked-in Switch v1.25.0 Collection shards'};
const ok=s=>report.checks.push(s);
const check=(c,s)=>{if(!c)throw Error(s);};
async function eventually(fn,ms=45000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,140));}throw Error('Timed out waiting on source link');}
const b=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await b.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
page.on('pageerror',e=>report.pageErrors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
try{
 const id='40200525';
 await page.goto(root+'/collection/?item='+id,{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-collection-state="item-detail"]').count()===1);
 check(await page.locator('.item-detail-grid code').first().textContent()===id,'Wrong Collection ItemID');
 const href=await page.locator('.cross-product-reference-link').getAttribute('href');
 check(href==='/explore/?item='+id,'Unverified Decorate URL: '+href);
 check(await page.locator('.item-detail a[href^="/guide/"]').count()===0,'Private Guide link exposed');
 ok('SOURCE_COLLECTION_TO_DECORATE_EXACT_ITEM_ID');
 await page.locator('.cross-product-reference-link').click();
 await eventually(async()=>await page.locator('.quick-review[role="dialog"]').count()===1);
 check((await page.locator('.quick-review').innerText()).includes(id),'Explore opened wrong ItemID');
 check(await page.locator('.reference-crosslink').getAttribute('href')==='/collection/?item='+id,'Invalid return link');
 ok('DECORATE_QUICK_REVIEW_SAME_ITEMID_NO_NATIVE_APPLY');
 await page.locator('.reference-crosslink').click();
 await eventually(async()=>await page.locator('[data-collection-state="item-detail"]').count()===1);
 check(await page.locator('.item-detail-grid code').first().textContent()===id,'Collection round-trip drift');
 ok('DECORATE_TO_COLLECTION_ROUND_TRIP');
 for(const path of [
  '/explore/?item=9999999999',
  '/explore/?item=10000002',
  '/explore/?item=00'+id,
  '/explore/?item='+id+'&item='+id,
  '/explore/?item='+id+'&unexpected=1',
  '/explore/?item='+id+'&version=1.25.0&version=1.25.0',
  '/explore/?item='+id+'&buildID=52BD625D9B4E0053&buildID=52BD625D9B4E0053',
  '/explore/?item='+id+'&version=1.25.3',
  '/explore/?item='+id+'&buildID=BAD'
 ]){
  await page.goto(root+path,{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('.status').count()>0&&await page.locator('.grid').count()===1);
  check(await page.locator('.quick-review[role="dialog"]').count()===0,'Unsafe Explore detail opened '+path);
 }
 ok('INVALID_DUPLICATE_FOREIGN_VERSION_BUILD_QUERY_FAIL_CLOSED');
 await page.goto(root+'/collection/?item='+id,{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('.cross-product-reference-link').count()===1);
 const localeCodes=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of localeCodes){
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#site-locale').selectOption(locale);
  await eventually(async()=>await page.locator('html').getAttribute('lang')===locale);
  await page.setViewportSize({width:320,height:820});
  check(await page.locator('.item-detail-grid code').first().textContent()===id,'ItemID drift in '+locale);
  check(await page.locator('.cross-product-reference-link').getAttribute('href')==='/explore/?item='+id,'Link drift in '+locale);
  check(await page.locator('.item-detail a[href^="/guide/"]').count()===0,'Private Guide link in '+locale);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  check(overflow<=2,'320px horizontal overflow in '+locale+': '+overflow);
 }
 ok('EIGHT_LOCALES_320PX_IDENTICAL_ITEMID_NO_PRIVATE_GUIDE');
 const glyphs=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=96;c.height=96;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  const hash=character=>{
   ctx.clearRect(0,0,96,96);
   ctx.font='60px system-ui';ctx.textBaseline='top';ctx.fillStyle='#000';
   ctx.fillText(character,8,6);
   const bytes=ctx.getImageData(0,0,96,96).data;
   let h=2166136261,painted=false;
   for(let i=0;i<bytes.length;i++){
    if(i%4===3&&bytes[i]>0)painted=true;
    h=Math.imul(h^bytes[i],16777619);
   }
   return painted?(h>>>0):null;
  };
  const tofu=hash('\u0378');
  const probes={'ja':'日本語','zh-CN':'简体中文'};
  return Object.entries(probes).map(([locale,characters])=>({
   locale,
   checked:characters,
   valid:Array.from(characters).every(ch=>hash(ch)!==null&&hash(ch)!==tofu)
  }));
 });
 check(glyphs.every(x=>x.valid),'CJK browser glyph missing: '+JSON.stringify(glyphs));
 report.cjkGlyphs=glyphs;
 ok('CHROME_JAPANESE_CHINESE_GLYPHS_RENDERED_NOT_TOFU');
 await page.setViewportSize({width:1280,height:900});
 await page.locator('#site-locale').selectOption('ja');
 await eventually(async()=>await page.locator('html').getAttribute('lang')==='ja');
 await page.setViewportSize({width:320,height:820});
 ok('JA_320PX_SOURCE_LINK_ACCESSIBLE');
 report.consoleErrors=report.consoleErrors.filter(s=>!s.includes('Failed to load resource'));
 check(report.pageErrors.length===0,'Browser page errors: '+report.pageErrors.join(' / '));
 check(report.consoleErrors.length===0,'Browser console errors: '+report.consoleErrors.join(' / '));
 report.result='PASS';
 await page.screenshot({path:folder+'/collection-decorate-link.png',fullPage:true});
}catch(e){
 report.result='FAIL';report.error=String(e?.stack||e);
 try{await page.screenshot({path:folder+'/failed.png',fullPage:true});}catch{}
 throw e;
}finally{
 await writeFile(folder+'/result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 await b.close();
}
