// 04 QR-W independent new-only PR577 Source-a2fa on protected mainc778.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {ORIENTATION_DESTINATIONS,orientationCopy} from '../src/lib/product-home/orientation-stage1-copy.mjs';

const MAIN='c77840eb0353ace2689a00a49b23c32fda866264';
const SOURCE='a2fa5b917177951b1f77bd30e4d5fa92d2afb617';
const files=[
 '.github/workflows/web-stage1-discover-orientation.yml',
 'scripts/web-stage1-discover-orientation-chrome.mjs',
 'src/lib/product-home/orientation-stage1-copy.mjs',
 'src/routes/discover/+page.svelte',
 'tests/web-stage1-discover-orientation.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-pr577-mainc778-privacy-composite.yml',
 'scripts/04qr-w-pr577-mainc778-privacy-composite-chrome.mjs',
 'tests/04qr-w-pr577-mainc778-privacy-composite.test.mjs'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const parents=git('rev-list','--parents','-n','1','HEAD').split(/\s+/).slice(1);
const qaHead=parents.length>1?parents[1]:'HEAD';
test('Source on newest mainc778 exactly five reviewed Discover paths; QA only three',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.equal(git('merge-base',SOURCE,qaHead),SOURCE);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).trim().split('\n').sort(),files);
 assert.deepEqual(git('diff','--name-only',SOURCE,qaHead).trim().split('\n').sort(),qa);
 for(const [path,sha] of Object.entries({
  '.github/workflows/web-stage1-discover-orientation.yml':'bfee04a028718d2c014d068ddb654f8cc21e1446',
  'scripts/web-stage1-discover-orientation-chrome.mjs':'cde9a44be11f05257bad377080634a9d16cae408',
  'src/lib/product-home/orientation-stage1-copy.mjs':'c2ec4e6ce2c80e97aa7e117bda5234155b72649f',
  'src/routes/discover/+page.svelte':'c909b5d957bda1b5fba5727877417baf03362a6d',
  'tests/web-stage1-discover-orientation.test.mjs':'cc5f0584f981cfc8a9b46124d756a54c18118091'
 }))assert.equal(git('rev-parse',SOURCE+':'+path),sha,path);
});
test('accepted mainc778 private5 noindex, Guide/Preset/Help Roots and no Rights or Writer Source changes',()=>{
 const privateChildren=['dreamsnaps/submit','dreamsnaps/judge','dreamsnaps/results','dreamsnaps/my','gallery/my'];
 for(const slug of privateChildren){
  const path='src/routes/'+slug+'/+page.svelte';
  const html=git('show',SOURCE+':'+path);
  assert.equal(git('rev-parse',MAIN+':'+path),git('rev-parse',SOURCE+':'+path),path);
  assert.equal((html.match(/<meta name="robots" content="noindex,nofollow" \/>/g)||[]).length,1,path);
 }
 for(const path of ['src/routes/+page.svelte','src/routes/gallery/+page.svelte','src/routes/dreamsnaps/+page.svelte',
                      'src/routes/dreamsnaps/community/+page.svelte','src/routes/help/+page.svelte']){
  assert.equal(git('rev-parse',MAIN+':'+path),git('rev-parse',SOURCE+':'+path),path);
 }
 assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/lib/ddv/','src/lib/community/','src/lib/wep/',
  'src/routes/gallery/','src/routes/dreamsnaps/','supabase/','.github/workflows/pages.yml','static/'),'');
 const route=readFileSync('src/routes/discover/+page.svelte','utf8');
 assert.match(route,/data-public-writer="off" data-save-auto-upload="off"/);
 assert.doesNotMatch(route,/uploadAndFinalizeImage|writeSave|publishWork|setDreamsnapOfficialResultPublication/);
});
test('only canonical 7 separate products; no new Publisher/Save Cloud or false indexed entity',()=>{
 assert.deepEqual(ORIENTATION_DESTINATIONS,
  ['/decorate/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/','/help/']);
 const productIds=['decorate','collection','guide','presets','gallery','dreamsnaps','help'];
 for(const l of ['en','ja']){
  const c=orientationCopy(l);
  assert.deepEqual(c.products.map(p=>p.id),productIds,l);
  assert.deepEqual(c.products.map(p=>p.path),ORIENTATION_DESTINATIONS,l);
  for(const p of c.products){
   assert.ok(p.purpose.trim().length>10&&p.step.trim().length>10);
  }
  assert.match(c.save,/save|セーブ|存档|セーブデータ|保存/i);
 }
 const workflow=readFileSync('.github/workflows/04qr-w-pr577-mainc778-privacy-composite.yml','utf8');
 assert.match(workflow,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(workflow,/playwright-core@1\.55\.0/);
 assert.doesNotMatch(workflow,/secrets\.|deploy-pages|workflow_dispatch|pull_request_target|write-all|git push/);
});
