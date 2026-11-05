/** Independent Stage1 Home 8-locale ownership/capability copy QA.
 * New-only against PR552: six Core and separate Help card.
 * Important: Help title locale can be correct while its visible DESCRIPTION remains EN.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
import {HOME_STAGE1_CONSUMER} from '../src/lib/ui/consumer-fixtures.js';
const MAIN='87f656833491b87712eee031f51ca135bda26b30';
const SOURCE='cf1e69b3518dd20beb92247e802dbe9b4910b914';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const source=[
 '.github/workflows/web-stage1-home-copy-locale.yml',
 'scripts/web-stage1-home-copy-locale-chrome.mjs',
 'src/lib/product-home/copy.js',
 'src/routes/+page.svelte',
 'tests/web-stage1-home-canonical-copy-locale.test.mjs'
],qa=[
 '.github/workflows/04qr-w-pr552-home-help-copy-locale-independent.yml',
 'scripts/04qr-w-pr552-home-help-copy-locale-chromium.mjs',
 'tests/04qr-w-pr552-home-help-copy-locale-independent.test.mjs'
];
const page=readFileSync('src/routes/+page.svelte','utf8');
test('fixed exact 5 Home-only Source paths, QA-only three paths, unchanged original Help provider/native source',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),source);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 assert.equal(git('rev-parse',SOURCE+':src/routes/+page.svelte'),'e3c2a827d226ff1ad9f90bc0d910ca9268be4927');
 assert.equal(git('rev-parse',SOURCE+':src/lib/product-home/copy.js'),'daca1ccbe505d9e49aaf11a03472a7d1fde43cd9');
 for(const path of ['src/lib/community/help-stage1-copy.js','src/routes/help/+page.svelte','src/lib/ui/consumer-fixtures.js'])
  assert.equal(git('rev-parse',SOURCE+':'+path),git('rev-parse',MAIN+':'+path));
});
test('six Core and separate Help preserve contract, reactive rendering for six Core card titles/descriptions',()=>{
 assert.deepEqual(HOME_STAGE1_CONSUMER.coreProducts.map(c=>c.id),['decorate','collection','guide','presets','gallery','dreamsnaps']);
 assert.match(page,/titleFor\(id: string, labels: typeof copy\)/);
 assert.match(page,/detailFor\(id: string, labels: typeof copy\)/);
 assert.match(page,/title=\{titleFor\(card.id,copy\)\}/);
 assert.match(page,/description=\{detailFor\(card.id,copy\)\}/);
 assert.match(page,/variant="horizontal"/);
 assert.match(page,/href=\{base \+ '\/help\/'\}/);
 assert.match(page,/base \+ '\/rc-status\/'/);
 assert.doesNotMatch(page,/publishWork\(|uploadPrivateSave\(|cloudUpload\(|onMount\(/);
});
test('all 8 Home Help canonical names and detail translations exist; Guide excludes Issues and publish claims',()=>{
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=homeCopy(lang);
  assert.equal(c.qa,helpStage1Copy(lang).title,lang);
  for(const field of ['guideDetail','presetsDetail','galleryDetail','dreamsnapsDetail','qaDetail'])
   assert.ok(typeof c[field]==='string'&&c[field].trim(),lang+':'+field);
 }
 for(const lang of ['fr','it','de','es-ES','ja','zh-CN','pt-BR'])
  assert.notEqual(homeCopy(lang).qaDetail,homeCopy('en').qaDetail,'localized Help description available '+lang);
 assert.match(homeCopy('en').guideDetail,/Community Issues are in Help Center/);
 assert.match(homeCopy('en').galleryDetail,/rights and visibility allow/);
 assert.match(homeCopy('en').dreamsnapsDetail,/when authorized/);
 assert.match(homeCopy('en').qaDetail,/publication requires authorization/);
});
test('Home Help visible description must consume 8-locale state, not hard-code EN for all non-JA',()=>{
 // Product explicitly supports 8 languages, and homeCopy.qaDetail is already translated
 // in all eight. A two-locale ternary leaves fr/it/de/es/zh/pt Home Help text in English.
 assert.doesNotMatch(page,/description=\{\$locale === 'ja' \?/,
  'Home Help card must not hardcode only JA/EN; non-Japanese locale must show its localized help description');
 assert.match(page,/description=\{copy\.qaDetail\}/,
  'use existing eight-language Home Help description rather than the JA/EN-only fallback');
});
