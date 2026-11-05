/** 04 QR-W new HEAD only. Prior PR552 Source cf1e69 six-locale Home Help body RED immutable.
 * Current Source 367cff changed only Home help body + Owner tests/actual Chrome.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
const PARENT='cf1e69b3518dd20beb92247e802dbe9b4910b914';
const SOURCE='367cff6a17c0cc5788bfca219d9a28759bb90598';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const page=readFileSync('src/routes/+page.svelte','utf8');
const QA=[
 '.github/workflows/04qr-w-pr552-fixed-home-help-eight-body-independent.yml',
 'scripts/04qr-w-pr552-fixed-home-help-eight-body-chromium.mjs',
 'tests/04qr-w-pr552-fixed-home-help-eight-body-independent.test.mjs'
].sort();
test('fixed repaired Source HEAD three scoped files and QA3 ONLY, never regress parent Home Core',()=>{
 assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
 assert.deepEqual(git('diff','--name-only',PARENT,SOURCE).split('\n').sort(),[
  'scripts/web-stage1-home-copy-locale-chrome.mjs',
  'src/routes/+page.svelte',
  'tests/web-stage1-home-canonical-copy-locale.test.mjs'
 ]);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),QA);
 assert.equal(git('rev-parse',PARENT+':src/routes/+page.svelte'),'e3c2a827d226ff1ad9f90bc0d910ca9268be4927');
 assert.equal(git('rev-parse',SOURCE+':src/routes/+page.svelte'),'173d7b128b22db16fb2478961fcd60205754a293');
 assert.equal(git('rev-parse',PARENT+':src/lib/product-home/copy.js'),'daca1ccbe505d9e49aaf11a03472a7d1fde43cd9');
 assert.equal(git('rev-parse',SOURCE+':src/lib/product-home/copy.js'),'daca1ccbe505d9e49aaf11a03472a7d1fde43cd9');
});
test('the only product Svelte delta is Help description now reactive 8-locale copy, no other Core UI changes',()=>{
 const old=git('show',PARENT+':src/routes/+page.svelte');
 const newer=git('show',SOURCE+':src/routes/+page.svelte');
 const oldLine=old.split('\n').find(s=>s.includes('description={$locale ==='));
 assert.ok(oldLine && oldLine.includes('Questions, Tips, Issues'));
 assert.equal(old.split('\n').filter(s=>s.includes('description={$locale ===')).length,1);
 assert.equal(old.replace(oldLine,'      description={copy.qaDetail}'),newer,'only render Help locale description changed');
 assert.match(page,/title=\{helpCopy.title\}/);
 assert.match(page,/description=\{copy\.qaDetail\}/);
 assert.doesNotMatch(page,/description=\{\$locale === 'ja'/);
 assert.match(page,/title=\{titleFor\(card.id,copy\)\}/);
 assert.match(page,/description=\{detailFor\(card.id,copy\)\}/);
 assert.match(page,/variant="horizontal"/);
 assert.match(page,/href=\{base \+ '\/help\/'\}/);
 assert.doesNotMatch(page,/publishWork\(|uploadPrivateSave\(|cloudUpload\(|onMount\(/);
});
test('all eight Home Help translations exist, distinct from EN, correct owner Help title, gated language',()=>{
 const en=homeCopy('en');
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const copy=homeCopy(lang);
  assert.equal(copy.qa,helpStage1Copy(lang).title);
  assert.ok(typeof copy.qaDetail==='string'&&copy.qaDetail.length>=15);
  if(lang!=='en')assert.notEqual(copy.qaDetail,en.qaDetail,lang+' must not use English body');
  assert.ok(copy.guideDetail.length>10);
 }
 assert.match(en.guideDetail,/Community Issues are in Help Center/);
 assert.match(en.qaDetail,/publication requires authorization/);
 assert.match(en.galleryDetail,/rights and visibility allow/);
});
test('Owner fixed tests/actual Chrome now require Help BODY as well as title without hiding other UX',()=>{
 const ownerNode=readFileSync('tests/web-stage1-home-canonical-copy-locale.test.mjs','utf8');
 const ownerChrome=readFileSync('scripts/web-stage1-home-copy-locale-chrome.mjs','utf8');
 const oldOwnerChrome=git('show',PARENT+':scripts/web-stage1-home-copy-locale-chrome.mjs');
 assert.ok(ownerNode.includes('description=\\{copy\\.qaDetail\\}'), 'Owner negative source check for reactive body');
 assert.ok(ownerChrome.includes("copy.qaDetail,locale+' Help visible BODY locale, QR553 true red'"),'Owner genuine DOM must compare body all8');
 assert.equal(git('rev-parse',SOURCE+':scripts/web-stage1-home-copy-locale-chrome.mjs'),'69ee43f76a9753a4c372ef5626b25b97b0f899b8');
 assert.ok(!oldOwnerChrome.includes("copy.qaDetail,locale+' Help visible BODY locale, QR553 true red'"),'new positive evidence is changed scope, ancestor unchanged');
 for(const marker of ['WEB_STAGE1_HOME_SIX_EQUAL_HELP_8LOCALE_ACTUAL_COPY_PASS',
  'WEB_STAGE1_HOME_HELP_CANONICAL_KEYBOARD_PASS',
  'WEB_STAGE1_HOME_NO_PUBLIC_WRITER_OR_PROVIDER_PASS'])
  assert.ok(ownerChrome.includes(marker),'preserve prior actual Chrome full route+safe network '+marker);
});
