// 04 QR-W actual managed deployed HTTPS Chrome on immutable NEW main03b0.
// Differential scope ONLY the old main227 public Item Detail HTTP404 link exposure.
// Existing ItemThumb/privacy/facets QA631/QA644 positives reused, not re-QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {PUBLIC_DETAIL_ACCEPTED} from '../src/lib/entity/shared-catalog-detail.mjs';
const PREV='9120711f2066f9596ec76b6f4da90f71e92f32db';
const MAIN='03b0a1a977643d036b81a5a11b8293d0895c0d4c';
const ORIGIN='https://dreamwishwand.github.io', BASE=ORIGIN+'/web';
const fixed={
 '.github/workflows/web-shared-catalog-detail.yml':'97cde995137694932317c3ee07ad17bb96c89ad1',
 'src/lib/entity/SharedCatalogDiscovery.svelte':'96ac7fe99456eff3cd2e1881cf0c3d669c0cc622',
 'src/routes/collection/+page.svelte':'d03066dd7b291f28c1424e4e580ef774b99c6a44',
 'src/routes/explore/+page.svelte':'44ea499f6d4dc09112173cd5024a2d03666ae130',
 'tests/web-item-detail-static-link-gate.test.mjs':'0412257ecb344bf5b6c58c3e6c6de6a066a9e090',
 'docs/core/01d-steam-native-v125x-icon-guid-source-20261106.md':'690affbf611ba8858a6a2747ff9801bdd2b0ffb1',
 'scripts/asset-research/01d-steam-native-icon-delta.py':'d121bcd5d0dc6a35d03d0b3aab270f3efbe4efaa',
 'tests/01d-steam-native-icon-delta.test.mjs':'4333ce6404eb8341693addf1fa4e9d3b2d3e06a5',
 'tests/01d-steam-native-icon-delta.test.py':'aefb3502ec17fec1e4e79db5611e6407a6b5e602'
};
const qa=[
 '.github/workflows/04qr-w-main03b0-hosted-detail-link-negative.yml',
 'scripts/04qr-w-main03b0-hosted-detail-link-negative.mjs'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',PREV,MAIN),PREV,'must use known protected main912 ancestor');
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN,'QA HEAD must descend immutable main03b0');
assert.deepEqual(git('diff','--name-only',PREV,MAIN).split('\n').sort(),Object.keys(fixed).sort(),'protected main must contain exactly 08WEB5 + 01D4');
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').split('\n').sort(),qa,'QA-only exactly2 paths');
for(const [p,blob] of Object.entries(fixed))assert.equal(git('rev-parse',MAIN+':'+p),blob,p);
assert.equal(PUBLIC_DETAIL_ACCEPTED,false,'detail public index gate cannot be flipped');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 assert.ok(!process.env[k],k+' never enter public shared CI');
assert.ok(process.env.CHROME_BIN,'NOT_RUN: installed real Chrome required');
console.log('QR_MAIN03B0_WEB_SOURCE5_01D_SOURCE4_QA2_IMMUTABLE_BLOBS_PASS');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const forbidden=/^\/web\/(?:en|fr|it|de|es-ES|ja|zh-CN|pt-BR)\/[1-9][0-9]{0,15}\/$/;
async function assertNoItemLinks(page,label){
 const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')??''));
 const bad=links.filter(h=>forbidden.test(h));
 assert.deepEqual(bad,[],label+' public broken ItemDetail anchors must be suppressed');
}
async function checkDimensions(page,label){
 const x=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.client+2,label+': '+JSON.stringify(x));
}
for(const url of ['/collection/','/explore/','/editor/items/']){
 const res=await fetch(BASE+url,{redirect:'manual',headers:{'Cache-Control':'no-cache'}});
 assert.equal(res.status,200,'ACTUAL public TEST Pages route '+url);
 assert.match(res.headers.get('content-type')??'',/text\/html/i);
}
for(const locale of ['en','ja','fr']){
 for(const item of ['40001238','9999999999999']){
  const res=await fetch(BASE+'/'+locale+'/'+item+'/',{redirect:'manual',headers:{'Cache-Control':'no-cache'}});
  assert.equal(res.status,404,'true static unsupported Item URL 404, not fake SEO200');
 }
}
console.log('QR_MAIN03B0_ACTUAL_MANAGED_HTTPS_COLLECTION_EXPLORE_EDITOR_200_DETAIL_404_HONEST_PASS');

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const rejected=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN: WebSocket network guard unavailable');
await page.routeWebSocket('**/*',r=>{rejected.push('WS '+r.url());r.close();});
await page.route('**/*',r=>{
 const request=r.request(),u=new URL(request.url());
 if(u.origin===ORIGIN&&['GET','HEAD'].includes(request.method()))r.continue();
 else{rejected.push(request.method()+' '+request.url());r.abort('blockedbyclient');}
});
try{
 const resp=await page.goto(BASE+'/explore/',{waitUntil:'domcontentloaded',timeout:55000});
 assert.equal(resp?.status(),200);
 await page.locator('.grid .card').first().waitFor({state:'visible',timeout:45000});
 const search=page.locator('.controls input[type="search"]');
 await search.fill('40001238');
 await page.waitForFunction(()=>document.querySelectorAll('.grid .card').length===1,null,{timeout:25000});
 await page.locator('.grid .card footer [data-detail-unavailable="true"]').waitFor({state:'visible',timeout:25000});
 assert.equal(await page.locator('.grid .card footer a').count(),0,'historically visible broken anchor MUST disappear');
 assert.equal(await page.locator('.grid .card footer button').count(),1,'moodboard action must remain');
 await assertNoItemLinks(page,'Explore 40001238');
 console.log('QR_MAIN03B0_ACTUAL_HTTPS_EXPLORE_40001238_OLD_BROKEN_ANCHOR_HIDDEN_PASS');

 const loc=page.locator('#site-locale');
 for(const locale of locales){
  await loc.selectOption(locale);
  await page.waitForFunction(x=>document.documentElement.dataset.locale===x,locale,{timeout:12000});
  const message=page.locator('.grid .card footer [data-detail-unavailable="true"]');
  await message.waitFor({state:'visible',timeout:16000});
  assert.ok((await message.innerText()).trim().length>=3,'localized nonanchor message '+locale);
  await assertNoItemLinks(page,'Explore locale '+locale);
 }
 console.log('QR_MAIN03B0_ACTUAL_HTTPS_EIGHT_LOCALES_NO_DEAD_DETAIL_HREF_PASS');
 await page.setViewportSize({width:320,height:750});
 await checkDimensions(page,'Explore 320px');
 await page.setViewportSize({width:640,height:800});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await checkDimensions(page,'Explore 200pct');
 await page.evaluate(()=>{document.documentElement.style.zoom=''});
 console.log('QR_MAIN03B0_ACTUAL_HTTPS_EXPLORE_320_200_LAYOUT_NO_OVERFLOW_PASS');

 const collection=await page.goto(BASE+'/collection/',{waitUntil:'domcontentloaded',timeout:50000});
 assert.equal(collection?.status(),200);
 const root=page.locator('[data-stage1-collection-root]');
 await root.waitFor({state:'visible',timeout:30000});
 assert.equal(await root.getAttribute('data-personal-progress'),'unknown');
 assert.equal(await root.getAttribute('data-writer'),'off');
 await page.locator('[data-stage1-search]').fill('40000047');
 await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:25000});
 await page.locator('[data-stage1-search-groups] .item-card').first().focus();
 await page.keyboard.press('Enter');
 await page.locator('[data-stage1-item-info]').waitFor({state:'visible',timeout:16000});
 assert.equal(await page.locator('[data-stage1-item-info] .info-actions a').count(),0);
 assert.equal(await page.locator('[data-stage1-item-info] .info-actions [data-detail-unavailable="true"]').count(),1);
 assert.ok(await page.locator('[data-stage1-item-info] .info-actions button').count()>=1,'close button retained');
 await assertNoItemLinks(page,'Collection searched');
 await page.setViewportSize({width:320,height:750});
 await checkDimensions(page,'Collection320');
 console.log('QR_MAIN03B0_ACTUAL_HTTPS_COLLECTION_KEYBOARD_INFO_NOLINK_OWNED_UNKNOWN_WRITER_OFF_PASS');

 const editor=await page.goto(BASE+'/editor/items/',{waitUntil:'domcontentloaded',timeout:50000});
 assert.equal(editor?.status(),200);
 const e=page.locator('[data-editor-item-surface="verified-catalog-read-only"]');
 await e.waitFor({state:'visible',timeout:35000});
 assert.equal(await e.getAttribute('data-writer'),'off');
 assert.equal(await e.getAttribute('data-owned'),'unknown');
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:45000});
 await page.locator('[data-shared-query]').fill('40000047');
 const results=page.locator('[data-shared-results]');
 await results.locator('[data-detail-unavailable="true"]').first().waitFor({state:'visible',timeout:25000});
 assert.equal(await results.locator('a').count(),0,'Editor shared search must not emit broken detail anchor');
 assert.match(await results.innerText(),/40000047/);
 await assertNoItemLinks(page,'Editor');
 await page.setViewportSize({width:320,height:740});
 await checkDimensions(page,'Editor320');
 assert.equal(await page.locator('meta[name="robots"][content="noindex,follow"]').count(),1,'Editor read-only is nonindex');
 console.log('QR_MAIN03B0_ACTUAL_HTTPS_EDITOR_DIRECTORY_SEARCH_NO_LINK_NOINDEX_WRITER_OFF_PASS');
 assert.deepEqual(rejected,[],'no off-origin GET, POST or WebSocket');
 assert.deepEqual(errors,[],'no unexpected page JS errors');
 console.log('QR_MAIN03B0_ACTUAL_MANAGED_HTTPS_NO_OFFORIGIN_POST_WS_PAGEERROR_PASS');
}finally{
 await context.close();await browser.close();
}
