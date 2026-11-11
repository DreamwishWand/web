// 04 QR-W independent changed-only QA of 08 WEB Source PR901 CSS200 fix.
// Real Chromium checks geometry of the ACTUAL Svelte component, never a hidden
// DOM mock. Previous QR-W #911 accepted Rust/locale/page/cryptographic scope
// is reused. A synthetic encrypted P1G is used only to reveal the real table.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {STEAM_DIFFGRIDS_LOCALES,savedDiffGridsCopy} from '../src/lib/wep/steam-saved-diffgrids-copy.mjs';

const SOURCE='2abae01d5ff1561fe41865a64ebb291a04c56180';
const OLD_RED='7d251f67c6d9ea9824dad65838c7d52079a12930';
const MAIN='ef0372a58b9619a442c65b31cecbb88c3cca0029';
const AUDIT_PATHS=[
 '.github/workflows/04qr-w-pr901-css200-independent-20261111.yml',
 'scripts/04qr-w-pr901-css200-independent-20261111.mjs'
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE,'must descend exact new Source');
assert.equal(git('merge-base',MAIN,SOURCE),MAIN,'protected source main');
assert.deepEqual(git('diff','--name-status',SOURCE,'HEAD').trim().split('\n').sort(),
 AUDIT_PATHS.map(x=>'A\t'+x).sort(),'exact QA-only two ADD');
assert.notEqual(SOURCE,OLD_RED,'do not reQA old TRUE_RED Source');
assert.equal(git('rev-parse',SOURCE+':src/lib/wep/SteamSavedDiffGridsReadonly.svelte'),
 '383acc44aed9541ef1d0714531937ebebb893d3a');
assert.equal(git('rev-parse',SOURCE+':tests/web-steam-saved-diffgrids-real-chrome.mjs'),
 '68655d9431eb76e33cd5559d19b0485e5c4a52c3');
assert.ok(git('show','SOURCE:src/lib/wep/steam-saved-diffgrids.consumer.worker.ts'.replace('SOURCE',SOURCE))
 .includes('const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false;'),'product OFF');
assert.ok(process.env.CHROME_BIN,'real installed Chrome required');
assert.ok(!process.env.P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH,'private Save must not enter QA');
const root=resolve('.'),site=resolve(root,'build');
const fixture=await readFile(join(root,'tests/stage-f/fixtures/synthetic626-diffgrids.p1g'));
const metadata=JSON.parse(await readFile(join(root,'tests/stage-f/fixtures/expected-diffgrids.json'),'utf8'));
assert.equal(metadata.syntheticOnly,true,'synthetic-only encrypted P1G');
assert.equal(fixture.length,metadata.sourceBytes);
const mimes={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
 '.css':'text/css','.wasm':'application/wasm','.json':'application/json',
 '.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const csp="default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'unsafe-inline'; "+
 "worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'";
const server=createServer(async(req,res)=>{
 let path;try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}
 catch{res.writeHead(400);res.end();return}
 if(req.method!=='GET'||!path.startsWith('/web/')){res.writeHead(403);res.end();return}
 const sub=path.slice(5);
 const file=resolve(site,sub.endsWith('/')?sub+'index.html':sub);
 if(!file.startsWith(site+sep)){res.writeHead(403);res.end();return}
 try{
  const bytes=await readFile(file);
  res.writeHead(200,{'content-type':mimes[extname(file)]||'application/octet-stream',
   'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':csp});
  res.end(bytes);
 }catch{res.writeHead(404);res.end()}
});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:320,height:800},
  deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
 const page=await context.newPage();const errors=[],offOrigin=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{
  const good=r.url().startsWith(origin+'/')||
   (r.method()==='GET'&&r.url().startsWith('blob:'+origin+'/'));
  if(!good||!['GET','HEAD'].includes(r.method()))offOrigin.push(r.method()+' '+r.url());
 });
 const response=await page.goto(origin+'/web/editor/timing/',{waitUntil:'networkidle',timeout:55000});
 assert.equal(response?.status(),200,'real compiled Svelte Timing route HTTP200');
 assert.equal(new URL(page.url()).pathname,'/web/editor/timing/');
 const panel=page.locator('[data-steam-diffgrids-readonly]');
 await panel.waitFor({timeout:30000});
 assert.equal(await panel.getAttribute('data-product-read'),'off','no public Reader enable');
 assert.equal(await panel.getAttribute('data-writer'),'off','Writer OFF');
 const summary=page.locator('[data-diffgrids-summary]');
 assert.equal(await panel.evaluate(el=>el.open),false,'opt-in disclosure initially collapsed');
 await summary.focus();await summary.press('Enter');
 assert.equal(await panel.evaluate(el=>el.open),true,'real keyboard Enter opens disclosure');
 await page.waitForFunction(()=>document.querySelector('#steam-diffgrids-file:not([disabled])'),
  null,{timeout:45000});
 assert.equal(await page.locator('#steam-diffgrids-file').inputValue(),'','never automatic Save');
 const form=['[data-diffgrids-summary]','[data-diffgrids-manual-only]',
  'label[for="steam-diffgrids-file"]','#steam-diffgrids-file',
  'label[for="steam-diffgrids-sha"]','#steam-diffgrids-sha',
  '.diffgrids-readonly .confirmation',
  '.diffgrids-readonly input[type=checkbox]',
  '[data-diffgrids-open]','[data-diffgrids-close]'];
 const inspect=async(stage,checkText=false)=>{
  return await page.evaluate(({stage,form,checkText})=>{
   const W=innerWidth;
   const root=document.documentElement,body=document.body;
   const physical={stage,width:W,height:innerHeight,scrollX,scrollY,
    htmlMin:getComputedStyle(root).minWidth,bodyMin:getComputedStyle(body).minWidth,
    htmlOverflow:getComputedStyle(root).overflowX,bodyOverflow:getComputedStyle(body).overflowX,
    htmlScrollWidth:root.scrollWidth,htmlClientWidth:root.clientWidth,
    bodyScrollWidth:body.scrollWidth,
    visualViewportWidth:visualViewport?.width??null,rects:[],violations:[]};
   const clamp=(rect,selector)=>{
    const x={selector,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
     width:rect.width};
    physical.rects.push(x);
    if(!Number.isFinite(rect.left)||!Number.isFinite(rect.right)||rect.width<=0||
      rect.left< -1||rect.right>W+1)
     physical.violations.push('PHYSICAL_CLIPPING_'+JSON.stringify(x));
   };
   for(const sel of form){
    const el=document.querySelector(sel);
    if(!el){physical.violations.push('MISSING_'+sel);continue}
    const r=el.getBoundingClientRect();
    clamp(r,sel);
    if(['[data-diffgrids-summary]','[data-diffgrids-manual-only]'].includes(sel)&&
       el.scrollWidth>el.clientWidth+1)
     physical.violations.push('HIDDEN_CHILD_OVERFLOW_'+sel+'_'+el.scrollWidth+'_'+el.clientWidth);
    if(checkText&&(/label|summary|confirmation/.test(sel))){
     // Range client rects validate real text ink after wrapping, not a
     // masked parent whose overflow:hidden makes a false geometry PASS.
     const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
     let t;while((t=w.nextNode())){
      if(!t.textContent?.trim())continue;
      const range=document.createRange();range.selectNodeContents(t);
      for(const b of range.getClientRects()){
       if(b.width>0&&(b.left< -1||b.right>W+1))
        physical.violations.push('TEXT_INK_CLIPPED_'+sel+'_'+b.left+'_'+b.right);
      }
     }
    }
   }
   const s=document.querySelector('[data-diffgrids-summary]');
   if(s){const r=s.getBoundingClientRect();physical.summary={left:r.left,right:r.right,
     top:r.top,bottom:r.bottom}}
   if(Math.abs(scrollX)>1)physical.violations.push('DOCUMENT_SCROLL_X_'+scrollX);
   if(root.scrollWidth>root.clientWidth+1)
    physical.violations.push('DOCUMENT_SCROLL_WIDTH_'+root.scrollWidth+'_'+root.clientWidth);
   if(['hidden','clip'].includes(physical.htmlOverflow)||
      ['hidden','clip'].includes(physical.bodyOverflow))
    physical.violations.push('FAKE_FIX_ROOT_OVERFLOW_HIDDEN');
   return physical;
  },{stage,form,checkText});
 };
 const outputs=[];
 const check=async(stage,checkText=false)=>{
  await summary.scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollTo({left:10000,top:window.scrollY,behavior:'instant'}));
  await page.waitForTimeout(50);
  const p=await inspect(stage,checkText);
  outputs.push(p);console.log('QRW901_CSS200_PHYSICAL_RECTS '+JSON.stringify(p));
  assert.deepEqual(p.violations,[],stage+' physical REFLOW failed');
  return p;
 };
 await check('320_ROOT100_MANUAL',true);
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const z=await check('320_ROOT200_MANUAL_AFTER_VERTICAL_SCROLL',true);
 assert.equal(z.width,320);
 assert.ok(z.summary.top<800&&z.summary.bottom>0,'Summary visible after vertical scrolling');
 assert.ok(z.summary.right<=321,'old right576 regression must be fixed');
 // Real visible 8-locale line wrapping only: do not reQA semantics/readset.
 for(const loc of STEAM_DIFFGRIDS_LOCALES){
  await page.locator('#site-locale').evaluate((e,code)=>{
   e.value=code;e.dispatchEvent(new Event('change',{bubbles:true}));
  },loc);
  await page.waitForFunction(lang=>document.documentElement.dataset.locale===lang,loc);
  const a=await check('320_ROOT200_LOCALE_WRAP_'+loc,true);
  assert.ok((await summary.textContent()).includes(savedDiffGridsCopy(loc).title),
   'real Svelte locale header '+loc);
  assert.ok(a.rects.every(r=>r.width>0),'no zero-width control');
 }
 await page.locator('#site-locale').evaluate(el=>{
  el.value='en';el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 // Layout change while the *real* 5-column table is visible.
 // This first synthetic page is required only to render Svelte table CSS;
 // it is NOT a repeated Rust codec or pagination QA.
 await page.locator('#steam-diffgrids-file').setInputFiles({
  name:'qa-public-synthetic-only.p1g',mimeType:'application/octet-stream',buffer:fixture});
 await page.locator('#steam-diffgrids-sha').fill(metadata.originalSha256);
 await page.locator('.diffgrids-readonly input[type=checkbox]').check();
 await page.locator('[data-diffgrids-open]').click();
 await page.locator('[data-diffgrids-page="1"]').waitFor({timeout:40000});
 const table=page.locator('.diffgrids-readonly .table-scroller');
 const t=await table.evaluate(el=>{
  const r=el.getBoundingClientRect();
  const pageX=window.scrollX;
  el.scrollLeft=80;
  return {left:r.left,right:r.right,width:r.width,
   tableClientWidth:el.clientWidth,tableScrollWidth:el.scrollWidth,
   tableScrollLeft:el.scrollLeft,pageBefore:pageX,pageAfter:window.scrollX,
   rootScrollWidth:document.documentElement.scrollWidth,
   rootClientWidth:document.documentElement.clientWidth};
 });
 assert.ok(t.left>=-1&&t.right<=321,'table scroller must stay inside viewport');
 assert.ok(t.tableScrollWidth>t.tableClientWidth+1&&t.tableScrollLeft>0,
  '5 columns must scroll ONLY INSIDE table scroller');
 assert.equal(t.pageAfter,t.pageBefore,'internal table scroll cannot move document');
 assert.ok(t.rootScrollWidth<=t.rootClientWidth+1,'no root overflow from 5-column table');
 console.log('QRW901_CSS200_REAL_FIVE_COLUMN_INTERNAL_TABLE '+JSON.stringify(t));
 await page.locator('[data-diffgrids-close]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-diffgrids-count]'));
 await page.waitForFunction(()=>
  document.activeElement?.matches?.('[data-diffgrids-summary]')===true,null,{timeout:3000});
 await check('320_ROOT200_CLOSE_FOCUS_RESTORED');
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await check('320_ROOT100_AFTER_CLOSE',true);
 await page.setViewportSize({width:1280,height:800});
 await check('DESKTOP1280_ROOT100',true);
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await check('DESKTOP1280_ROOT200',true);
 // Explicit negative: a global overflow-x:hidden workaround must trip QA
 // rather than falsely passing while hiding all offscreen controls.
 await page.evaluate(()=>document.body.style.overflowX='hidden');
 const guard=await inspect('NEGATIVE_FAKE_ROOT_CLIP',false);
 assert.ok(guard.violations.includes('FAKE_FIX_ROOT_OVERFLOW_HIDDEN'),
  'QA must detect root overflow:hidden false PASS');
 await page.evaluate(()=>document.body.style.overflowX='');
 assert.deepEqual(offOrigin,[],'no unrelated POST/off-origin communication');
 assert.deepEqual(errors,[],'no new Chrome page exception');
 await context.close();
 console.log('QRW901_CSS200_INDEPENDENT_CHANGED_ONLY_SCOPED_PASS '+JSON.stringify({
  source:SOURCE,oldRedReused:OLD_RED,checks:outputs.length,
  physical320Root200:z.summary,table:t,
  fakeHiddenOverflowDenied:true,originalPrivateP1G:false,
  productFlagOn:false,qaOnly:true
 }));
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
