/** 04 QR-W new-only Stage1 Discover the Wand orientation independent QA.
 * Verify seven distinct purposes/first steps and optional Account/Save gates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {orientationCopy,ORIENTATION_DESTINATIONS} from '../src/lib/product-home/orientation-stage1-copy.mjs';
const MAIN='87f656833491b87712eee031f51ca135bda26b30';
const SOURCE='65a14b91061f8d413b4e549a55b64cb15be0456a';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const source=[
 '.github/workflows/web-stage1-discover-orientation.yml',
 'scripts/web-stage1-discover-orientation-chrome.mjs',
 'src/lib/product-home/orientation-stage1-copy.mjs',
 'src/routes/discover/+page.svelte',
 'tests/web-stage1-discover-orientation.test.mjs'
],qa=[
 '.github/workflows/04qr-w-pr550-discover-purpose-independent.yml',
 'scripts/04qr-w-pr550-discover-purpose-chromium.mjs',
 'tests/04qr-w-pr550-discover-purpose-independent.test.mjs'
];
const page=readFileSync('src/routes/discover/+page.svelte','utf8');
test('fixed five scoped Source paths from main87, 3 QA-only, preserve existing Home/Account/Save/Guide',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),source);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 assert.equal(git('rev-parse',SOURCE+':src/routes/discover/+page.svelte'),'c909b5d957bda1b5fba5727877417baf03362a6d');
 assert.equal(git('rev-parse',SOURCE+':src/lib/product-home/orientation-stage1-copy.mjs'),'c2ec4e6ce2c80e97aa7e117bda5234155b72649f');
 for(const p of ['src/routes/+page.svelte','src/lib/product-home/copy.js','src/lib/community/help-stage1-copy.js','src/routes/guide/+page.svelte','src/routes/help/+page.svelte'])
  assert.equal(git('rev-parse',SOURCE+':'+p),git('rev-parse',MAIN+':'+p),p);
});
test('precise seven owner products and first-step paths, not duplicate Home or obsolete Q&A',()=>{
 const names=['decorate','collection','guide','presets','gallery','dreamsnaps','help'];
 assert.deepEqual(orientationCopy('en').products.map(p=>p.id),names);
 assert.deepEqual(ORIENTATION_DESTINATIONS,['/decorate/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/','/help/']);
 assert.equal(new Set(ORIENTATION_DESTINATIONS).size,7);
 assert.match(page,/data-discover-stage1="orientation-not-dashboard"/);
 assert.match(page,/data-discover-seven-products/);
 assert.match(page,/data-discover-destination=\{product.id\}/);
 assert.match(page,/data-discover-account-save-optional/);
 assert.doesNotMatch(page,/GroupedCardGrid|HOME_STAGE1_CONSUMER|home-product-grid|\/qa\/|href=\{base\+'\/qa\/'/);
 assert.match(page,/base\+'\/rc-status\/'/);
});
test('eight-language substantive purposes, first steps, optional account/save/cloud and permissions not auto-enabled',()=>{
 const en=orientationCopy('en');
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=orientationCopy(locale);
  assert.equal(c.products.length,7);
  for(const [i,p] of c.products.entries()){
   assert.equal(p.path,ORIENTATION_DESTINATIONS[i]);
   assert.ok(p.purpose.length>=10,locale+':'+p.id+' purpose');
   assert.ok(p.step.length>=8,locale+':'+p.id+' first step');
   assert.notEqual(p.purpose,p.step,locale+':'+p.id+' two distinct useful descriptions');
  }
  for(const key of ['intro','account','save','support','purpose','start','seeStatus'])
   assert.ok(typeof c[key]==='string'&&c[key].trim().length>=3,locale+':'+key);
  if(locale!=='en'){
   assert.notEqual(c.save,en.save,locale+' must have genuine localized Save caveat');
   assert.notEqual(c.account,en.account,locale+' must have local account caveat');
   assert.notEqual(c.products[6].purpose,en.products[6].purpose,locale+' Help purpose');
  }
 }
 assert.equal(orientationCopy('xx-unsupported').products[0].path,'/decorate/','unknown locale does not invent destination');
 assert.match(en.save,/remain on your device/);
 assert.match(en.save,/never uploaded automatically/);
 assert.match(en.save,/disabled until the exact version and operation are verified/);
 assert.match(en.account,/without signing in/);
 assert.match(en.support,/not a publication or writer permission/);
 assert.match(en.products[2].purpose,/Community Issues belong in Help Center/);
 assert.match(en.products[4].purpose,/rights and visibility permit/);
});
test('UI has clearly separate gated quickstarts but NO executable provider writer or public media',()=>{
 for(const attr of [
  'data-public-writer="off"',
  'data-save-auto-upload="off"',
  'data-discover-account-optional',
  'data-discover-save-optional',
  'data-discover-capability-gated',
  'data-discover-seven-products'
 ])assert.ok(page.includes(attr),attr);
 assert.match(page,/productTitle\(product.id,titles,helpTitle\)/);
 assert.match(page,/info\.products/);
 assert.match(page,/info\.seeStatus/);
 for(const unsafe of ['<img','<video','<canvas','onMount(','fetch(','uploadPrivateSave(','publishWork(','createCommunityBrowserClient(','originalOverwriteAuthorized=true'])
  assert.equal(page.includes(unsafe),false,unsafe);
});
