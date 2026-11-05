/** Independent actual system Chromium Stage1 Help 3+1 UI and gated search.
 * Never exercises private My Activity, authored answers, media or Provider actions.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
if(!process.env.CHROME_BIN)throw Error('QR537_ACTUAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)throw Error('QR537_PRIVATE_SAVE_CI_DENIED');
const url=new URL(process.env.QR537_URL??'http://127.0.0.1:4295/help/');
if(url.href!=='http://127.0.0.1:4295/help/')throw Error('QR537_EXACT_LOOPBACK_REQUIRED');
const keys=['questions','tips','issues','activity'],langs=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'],denied=[],errors=[];
const paths=['/help/questions/','/help/tips/','/help/issues/','/help/my/'];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR537_WS_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4295')route.connectToServer();
  else{denied.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{denied.push(route.request().method()+' '+route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 const root=page.locator('[data-help-root="four-children"]');
 await root.waitFor({state:'visible',timeout:30000});
 const cards=root.locator('a[data-help-child]');
 const input=root.locator('input#help-cross-type-search');
 for(const lang of langs){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(({lang,label})=>
   document.documentElement.dataset.locale===lang &&
   document.querySelector('[data-help-child="questions"] strong')?.textContent?.trim()===label,
   {lang,label:helpStage1Copy(lang).questions},{timeout:12000});
  assert.equal(await cards.count(),4);
  assert.deepEqual(await cards.evaluateAll(a=>a.map(x=>x.dataset.helpChild)),keys);
  assert.deepEqual(await cards.evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),paths);
  const copy=helpStage1Copy(lang);
  for(const key of keys)assert.equal((await root.locator('[data-help-child="'+key+'"] strong').innerText()).trim(),copy[key],lang+' '+key);
  assert.equal(await root.locator('[data-stage1-help-public-three] a').count(),3);
  assert.equal(await root.locator('a.personal[data-help-child="activity"]').count(),1);
  assert.equal(await input.isDisabled(),true,'cross source search must not be actionable');
  assert.equal(await root.getAttribute('data-root-search'),'unavailable');
  assert.equal(await root.getAttribute('data-public-writer'),'off');
  assert.equal(await root.locator('[data-help-cross-type-search="gated"] [role="status"]').count(),1);
  assert.equal(await root.locator('img,video').count(),0,'no unaccepted media');
 }
 console.log('QR537 ACTUAL EIGHT LOCALES 3 PUBLIC+1 PERSONAL ROOT + DISABLED UNIFIED SEARCH PASS');
 const rects=await cards.evaluateAll(a=>a.map(x=>{const q=x.getBoundingClientRect();return{x:q.x,y:q.y,w:q.width};}));
 assert.ok(Math.abs(rects[0].y-rects[1].y)<3&&Math.abs(rects[1].y-rects[2].y)<3,'three public peer row');
 assert.ok(rects[0].x<rects[1].x&&rects[1].x<rects[2].x,'three columns');
 assert.ok(rects[3].y>rects[0].y&&rects[3].w>rects[0].w*2,'personal wide separate after public row');
 const desktop=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(desktop.length>7000);
 console.log('QR537 3PLUS1 ACTUAL DESKTOP GEOMETRY PNG RAM '+createHash('sha256').update(desktop).digest('hex').slice(0,16));
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(x=>document.querySelector('[data-help-child="issues"] strong')?.textContent?.trim()===x,helpStage1Copy('ja').issues);
 await page.setViewportSize({width:320,height:750});
 const small=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(small.scroll<=small.w+2,JSON.stringify(small));
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>6000);
 await root.locator('[data-help-child="questions"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.helpChild),'questions');
 // Test navigation to unchanged public child only; no Auth, My Activity or publishing.
 await page.keyboard.press('Enter');
 await page.waitForURL('**/help/questions/',{timeout:15000});
 await page.goBack({waitUntil:'networkidle'});
 await root.waitFor({state:'visible'});
 assert.equal(await root.locator('a[data-help-child]').count(),4);
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.w+2,JSON.stringify(zoom));
 const zoomShot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoomShot.length>6000);
 assert.equal(await input.isDisabled(),true);
 assert.deepEqual(denied,[]);
 assert.deepEqual(errors,[]);
 console.log('QR537 MOBILE320/ZOOM200 KEYBOARD QUESTIONS LINK + NO PROVIDER/POST/WS/PAGEERR PASS');
 await ctx.close();
}finally{await browser.close();}
