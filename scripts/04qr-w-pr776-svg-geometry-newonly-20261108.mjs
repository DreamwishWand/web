// Independent 04 QR-W Source PR776 new-only SVG geometry/keyboard/zoom QA.
// No game media or rights acceptance and no private Save.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {HOME_STAGE1_CONSUMER,DECORATE_STAGE1_CONSUMER}
 from '../src/lib/ui/consumer-fixtures.js';
const SOURCE='5e21433d0f79bf5bd98ac8f3b6638a28bb34cc80';
const PARENT='b7d86d47125f1764919b67898c39badaf35976d8';
const original=new Map([
 ['.github/workflows/web-ui-product-icons.yml','2e9afd8568348060c32704f391e6bacb6a6ee1c0'],
 ['scripts/web-ui-product-icons-chrome.mjs','ba86cc9c129b9210fb2d89dd46a60345f6ea9d5d'],
 ['src/lib/ui/Icon.svelte','7e4cef220536d103a844b7d9ad0161843d461a20'],
 ['src/lib/ui/VisualCard.svelte','0927d2d71d06fec3e261951f0b7d056a41c18655'],
 ['src/lib/ui/consumer-fixtures.js','acc5c566758d9cb693e03c170128d2902e2b343a'],
 ['tests/web-ui-product-icons.test.mjs','6a54144d4533141faf0a84d20c991c8db14be13e']
]);
const qa=[
 '.github/workflows/04qr-w-pr776-svg-geometry-newonly-20261108.yml',
 'scripts/04qr-w-pr776-svg-geometry-newonly-20261108.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
assert.deepEqual(changed(PARENT,SOURCE),[...original.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(changed(SOURCE,'HEAD'),qa);
for(const [name,sha] of original){
 assert.equal(git('rev-parse',SOURCE+':'+name),sha);
 assert.equal(git('hash-object',name),sha);
}
assert.equal(git('diff','--name-only',PARENT,SOURCE,'--',
 'src/lib/item-media/','src/lib/collection/','src/routes/collection/',
 'src/lib/community/','src/lib/ddv/','src/lib/wep/','static/',
 '.github/workflows/pages.yml','supabase/'),'');
const originalIcon=readFileSync('src/lib/ui/Icon.svelte','utf8');
const originalCard=readFileSync('src/lib/ui/VisualCard.svelte','utf8');
assert.match(originalIcon,/iconPaths = paths\[name\] \?\? paths\.sparkle/);
assert.match(originalIcon,/moodboard: \[/);
assert.match(originalIcon,/worldEditor: \[/);
assert.doesNotMatch(originalIcon,/<img|srcset|https?:\/\//);
assert.doesNotMatch(originalCard,/<img|srcset|fetch\(|localStorage/);
console.log('QRW776_ORIGINAL6_IMMUTABLE_QA2_NO_GAME_MEDIA_SOURCE_DIFF_PASS');

const host='http://127.0.0.1:4299';
assert.ok(process.env.CHROME_BIN,'installed Chrome required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
const page=await ctx.newPage();
const outbound=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin!==host||!['GET','HEAD'].includes(r.method())){
  outbound.push(r.method()+' '+r.url());return route.abort('blockedbyclient');
 }
 return route.continue();
});
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const glyphs=async(selector,items)=>{
 const cards=page.locator(selector);
 assert.equal(await cards.count(),items.length);
 const results=[];
 for(let i=0;i<items.length;i++){
  const card=cards.nth(i),expected=items[i];
  const actual=await card.locator('[data-visual-card-icon]').getAttribute('data-visual-card-icon');
  assert.equal(actual,expected.icon,'semantic icon ID unchanged '+expected.id);
  const href=await card.getAttribute('href');
  assert.equal(href,expected.href,'source route identity retained '+expected.id);
  const svg=card.locator('.visual-card-icon svg');
  assert.equal(await svg.count(),1);
  assert.equal(await svg.getAttribute('viewBox'),'0 0 24 24');
  assert.equal(await svg.getAttribute('aria-hidden'),'true');
  assert.equal(await svg.getAttribute('role'),null,'decorative SVG cannot become duplicate interactive accessible name');
  const paths=await svg.locator('path').evaluateAll(nodes=>nodes.map(x=>x.getAttribute('d')));
  assert.ok(paths.length>=1);
  assert.ok(paths.every(s=>typeof s==='string'&&s.length>=3));
  const signature=paths.join('|');
  assert.ok((await card.locator('.visual-card-copy strong').innerText()).trim().length>0,'link accessible title');
  assert.equal(await card.locator('a').count(),0,'nested anchor forbidden');
  results.push(signature);
 }
 assert.equal(new Set(results).size,items.length,'distinct actual SVG PATH geometries, not merely different icon names');
 return results;
};
async function fitAndKeyboard(){
 for(const [width,zoom] of [[320,1],[640,2]]){
  await page.setViewportSize({width,height:850});
  await page.evaluate(v=>document.documentElement.style.zoom=String(v),zoom);
  const dims=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dims.scroll<=dims.viewport+2,'real icon/layout overflow '+width+' zoom'+zoom+' '+JSON.stringify(dims));
  const link=page.locator('.visual-card:visible').first();
  await link.focus();
  assert.equal(await link.evaluate(e=>e===document.activeElement),true);
 }
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:1280,height:850});
}
try{
 let res=await page.goto(host+'/',{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);
 let homeGeom=null;
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.waitForFunction(c=>document.documentElement.dataset.locale===c,locale);
  const geom=await glyphs('.home-product-grid .visual-card',HOME_STAGE1_CONSUMER.coreProducts);
  if(homeGeom)assert.deepEqual(geom,homeGeom,'locale must not silently change original SVG');
  homeGeom=geom;
  await fitAndKeyboard();
 }
 console.log('QRW776_HOME6_ACTUAL_SVG_GEOMETRIES_DISTINCT_EIGHT_LOCALE_320_CSS200_KEYBOARD_PASS');
 res=await page.goto(host+'/decorate/',{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);
 // Svelte hydration may restore the *previous page* locale asynchronously after navigation.
 // Wait for the existing shell select+document language to settle before mutating it.
 await page.waitForFunction(()=>{
  const selected=document.querySelector('#site-locale')?.value;
  return !!selected && document.documentElement.dataset.locale===selected;
 },null,{timeout:15000});
 let decorGeom=null;
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.waitForFunction(c=>document.documentElement.dataset.locale===c,locale);
  const geom=await glyphs('.visual-card',DECORATE_STAGE1_CONSUMER.entryCards);
  if(decorGeom)assert.deepEqual(geom,decorGeom);
  decorGeom=geom;
  assert.notEqual(geom[1],homeGeom[4],'Moodboards cannot be identical to Gallery actual path');
  assert.notEqual(geom[2],homeGeom[0],'WorldEditor cannot be generic decorate icon');
  await fitAndKeyboard();
 }
 console.log('QRW776_DECORATE3_MOODBOARD_AND_WORLD_EDITOR_DISTINCT_SVG_EIGHT_LOCALE_ZOOM_PASS');
 const board=page.locator('.visual-card[href="/moodboards/"]');
 await board.focus();
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/moodboards\/$/);
 assert.ok((await page.locator('h1').first().innerText()).trim());
 assert.deepEqual(outbound,[],'no third-party or POST game/media request');
 assert.deepEqual(errors,[],'zero browser page errors');
 console.log('QRW776_KEYBOARD_ENTER_REAL_MOODBOARDS_NAV_NO_GAME_MEDIA_NO_OFFHOST_PASS');
 console.log('QRW776_INDEPENDENT_INSTALLED_CHROME_FINAL_SOURCE_SCOPED_PASS_MEDIA_RIGHTS_NOT_ACCEPTED');
}finally{await ctx.close();await browser.close();}
