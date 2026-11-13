// QA-only independent rights attribution boundary; no private media or operator claims.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {IMAGE_RIGHTS_ATTRIBUTION,imageRightsAttribution} from '../src/lib/i18n/image-rights-attribution.js';
import {SUPPORTED_LOCALES} from '../src/lib/i18n/registry.js';
const S='e765ee11d1a1d7e884b6fab7c8dc4c3cc9d45213',B='92a9c506716625ef33e8a9d3b7253b4ced8c70a1';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const pins={
 'src/lib/SiteFooter.svelte':'0f1b6e2e9dfc6226fe17ed6af5de68c5b3ac5042',
 'docs/wep/world-editor-localization-inventory-20261002.json':'b52784710e2a0535879bf0f99d4725d63dde2ed1',
 'src/lib/i18n/image-rights-attribution.js':'d34d810c43dcd9e2d685f8e20985089f2f7b1b11',
 'tests/web-image-rights-attribution.test.mjs':'4b7aee919b9ce342571b85113011cfbacc007828',
 'scripts/web-image-rights-attribution-chrome.mjs':'38367185a92af16427113570bcc88794dc56bb66',
 '.github/workflows/08web-image-rights-attribution.yml':'d60812807bf9dd4c58b2608d52b321da7f7bfc0c'};
assert.equal(git('merge-base',S,'HEAD'),S);
assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(pins).map(p=>(p.includes('SiteFooter')||p.includes('inventory')?'M':'A')+'\t'+p).sort());
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-pr1027-image-rights-attribution-20261113.yml','A\tscripts/04qr-w-pr1027-image-rights-attribution-independent-20261113.mjs'].sort());
for(const [p,h] of Object.entries(pins)){assert.equal(git('rev-parse',S+':'+p),h);assert.equal(git('hash-object',p),h)}
const draftPath='ops/ddv-item-image-operator-readiness-template.json';
assert.equal(git('rev-parse','HEAD:'+draftPath),'d9e0020017b4c979fc41c4578f9504fd0d0f7121');
const draft=JSON.parse(readFileSync(draftPath,'utf8'));
assert.equal(draft.publicationState,'OFF');assert.equal(draft.rightsContact,null);assert.equal(draft.copyrightLicenceStatus,'UNKNOWN');
assert.equal(draft.classification,'DRAFT_OPERATOR_PACKET_NOT_PUBLICATION_PERMISSION');
const codes=SUPPORTED_LOCALES.map(x=>x.code);
assert.deepEqual(Object.keys(IMAGE_RIGHTS_ATTRIBUTION).sort(),codes.slice().sort());
for(const c of codes){assert.equal(IMAGE_RIGHTS_ATTRIBUTION[c],draft.locales[c].text);assert.equal(draft.locales[c].humanReviewed,false);assert.equal(draft.locales[c].reviewEvidenceRef,null)}
for(const c of [null,undefined,{},[],123,'__proto__','constructor','zh-Hant','unsupported','es','pt'])assert.equal(imageRightsAttribution(c),draft.locales.en.text);
for(const [a,b] of [[' JA ','ja'],['en-US','en'],['FR-ca','fr'],['DE','de'],['ES-es','es-ES'],['PT-br','pt-BR'],['ZH-cn','zh-CN']])assert.equal(imageRightsAttribution(a),draft.locales[b].text);
for(const p of ['src/lib/item-media/switch1253-public-item-images.mjs','src/lib/item-media/public-item-images.mjs','src/lib/ui/ItemThumb.svelte','src/lib/i18n/runtime.js','src/lib/i18n/preference.js','src/routes/+layout.svelte','.github/workflows/pages.yml'])assert.equal(git('rev-parse',B+':'+p),git('rev-parse','HEAD:'+p));
console.log('QRW1027_EXACT6_DRAFT8_UNCHANGED_AUTHORITY_FALLBACK_PASS');
const origin='http://127.0.0.1:4298',base='/web';
const bin=['google-chrome-stable','google-chrome','chromium'].map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);assert.ok(bin);
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const violations=[],errors=[];
function monitor(ctx,p){ctx.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||!['GET','HEAD'].includes(r.method())||u.pathname.includes('/ddv/item-images/'))violations.push(r.method()+' '+u.pathname)});p.on('pageerror',e=>errors.push(e.message));}
async function verify(p,c){
 const n=p.locator('footer [data-image-rights-attribution]');await p.waitForFunction(({c,t})=>document.documentElement.dataset.locale===c&&document.querySelector('footer [data-image-rights-attribution]')?.textContent.trim()===t,{c,t:draft.locales[c].text},{timeout:20000});
 assert.equal(await n.count(),1);assert.equal(await n.innerText(),draft.locales[c].text);assert.equal(await n.isVisible(),true);
 assert.equal(await n.locator('a,img,script,iframe,video').count(),0);
 const links=p.locator('footer a');assert.equal(await links.count(),1);assert.equal(await links.getAttribute('href'),base+'/help/');
 await n.scrollIntoViewIfNeeded();const dims=await n.evaluate(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,w:r.width,h:r.height,v:innerWidth,sw:e.scrollWidth,cw:e.clientWidth}});
 assert.ok(dims.w>0&&dims.h>0&&dims.l>=-1&&dims.r<=dims.v+1&&dims.sw<=dims.cw+2,JSON.stringify(dims));
}
try{
 // Independent first-visit automatic browser locale, not Owner's manual selection loop.
 for(const c of codes){
  const ctx=await browser.newContext({locale:c,viewport:{width:320,height:844},serviceWorkers:'block',acceptDownloads:false});
  const p=await ctx.newPage();monitor(ctx,p);
  const response=await p.goto(origin+base+'/help/',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
  await verify(p,c);await p.reload({waitUntil:'domcontentloaded'});await verify(p,c);
  await ctx.close();
 }
 console.log('QRW1027_ACTUAL_CHROME_FRESH_BROWSER_LOCALE8_RELOAD8_PASS');
 // Static HTML without JS: English default is visible and Help works, never fake localized SSR.
 const ctx=await browser.newContext({javaScriptEnabled:false,locale:'en',viewport:{width:320,height:844},serviceWorkers:'block'});const p=await ctx.newPage();monitor(ctx,p);
 for(const path of ['/','/help/','/collection/']){
  const r=await p.goto(origin+base+path,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);
  const n=p.locator('footer [data-image-rights-attribution]');assert.equal(await n.count(),1);assert.equal(await n.innerText(),draft.locales.en.text);assert.ok(await n.isVisible());assert.equal(await p.locator('footer a').getAttribute('href'),base+'/help/');
 }
 await p.locator('footer a').focus();await p.keyboard.press('Enter');await p.waitForURL('**/web/help/');
 await ctx.close();
 assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
 console.log('QRW1027_STATIC_NO_JS_FOOTER3_HELP_KEYBOARD_OFF_NO_NETWORK_PASS');
}finally{await browser.close()}
