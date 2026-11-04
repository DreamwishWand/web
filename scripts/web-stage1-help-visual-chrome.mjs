// Owner Chrome acceptance for Stage1 Community Help Center root visual 3+1.
// This intentionally does not emulate a public cross-type search or media.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
const bin=process.env.CHROME_BIN;if(!bin)throw Error('CHROME_BIN_REQUIRED');
const origin=(process.env.STAGE1_HELP_URL||'http://127.0.0.1:4290').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const errors=[],unsafe=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',request=>{
 const uri=new URL(request.url());
 if(uri.origin!==origin||!['GET','HEAD'].includes(request.method()))unsafe.push(request.method()+' '+request.url());
});
const paths=['questions','tips','issues','activity'];
const targetPaths=['/help/questions/','/help/tips/','/help/issues/','/help/my/'];
async function fit(label){
 const d=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(d.s<=d.w+2,label+' horizontal overflow '+JSON.stringify(d));
}
try{
 await page.goto(origin+'/help/',{waitUntil:'domcontentloaded'});
 const root=page.locator('[data-help-root="four-children"]');
 await root.waitFor({timeout:30000});
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(lang);
  const copy=helpStage1Copy(lang);
  await page.waitForFunction(({code,text})=>
   document.documentElement.dataset.locale===code &&
   document.querySelector('[data-help-child="questions"] strong')?.textContent?.trim()===text,
   {code:lang,text:copy.questions},{timeout:16000});
  assert.equal(await root.locator('[data-stage1-help-public-three] a').count(),3);
  assert.equal(await root.locator('.help-child-card.personal').count(),1);
  for(const [index,key]of paths.entries()){
   const a=root.locator('[data-help-child="'+key+'"]');
   assert.equal((await a.innerText()).trim().includes(copy[key==='activity'?'activity':key]),true,lang+'/'+key);
   const href=await a.getAttribute('href');
   assert.equal(new URL(href,origin).pathname,targetPaths[index],lang+'/'+key+' URL');
  }
  assert.equal(await root.locator('a.help-child-card').count(),4);
  assert.equal(await root.locator('[data-help-cross-type-search="gated"] input:disabled').count(),1);
  assert.equal(await root.locator('[data-public-writer="off"]').count(),1);
 }
 console.log('WEB_STAGE1_HELP_8LANG_3PLUS1_CARD_LINKS_SEARCH_GATED_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.setViewportSize({width:320,height:780});
 await fit('mobile320');
 const question=page.locator('[data-help-child="questions"]');
 await question.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-help-child')),'questions');
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('zoom200');
 assert.equal(await root.locator('[data-help-child]').count(),4);
 console.log('WEB_STAGE1_HELP_320_ZOOM200_KEYBOARD_PASS');
 assert.deepEqual(errors,[],'no visual root page errors');
 assert.deepEqual(unsafe,[],'no public provider/off-origin/POST on Help root');
 console.log('WEB_STAGE1_HELP_ROOT_NO_PROVIDER_POST_PASS');
}finally{await context.close();await browser.close();}
console.log('WEB_STAGE1_HELP_ACTUAL_CHROME_PASS');
