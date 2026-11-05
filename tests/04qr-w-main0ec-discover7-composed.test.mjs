// 04 QR-W new-only main0ec + accepted Discover PR577 composite. QA Source untouched, CI overlay only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const MAIN='0ec67476e6c358f810c310ed257bc4986128bc79';
const SOURCE='322702a0522c44aebea78f993ee1099f1b957bdf';
const SOURCE_BASE=MAIN;
const PREVIOUS_MAIN='058ac652b06fdc62ff85559186375c5b7a1e62a4';
const sourcePaths=[
 '.github/workflows/web-stage1-discover-orientation.yml',
 'scripts/web-stage1-discover-orientation-chrome.mjs',
 'src/lib/product-home/orientation-stage1-copy.mjs',
 'src/routes/discover/+page.svelte',
 'tests/web-stage1-discover-orientation.test.mjs'
].sort();
const qaPaths=[
 '.github/workflows/04qr-w-main0ec-discover7-composed.yml',
 'scripts/04qr-w-main0ec-discover7-composed-chrome.mjs',
 'tests/04qr-w-main0ec-discover7-composed.test.mjs'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const parents=git('rev-list','--parents','-n','1','HEAD').split(/\s+/).slice(1);
const qaDiffBase=parents.length>1?parents[0]:MAIN; // GitHub ordinary CI synthetic merge vs fixed QA Source checkout.

test('protected main0ec and Source PR577 frozen; QA branch exact three-only',()=>{
 assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
 assert.equal(git('merge-base',SOURCE_BASE,SOURCE),SOURCE_BASE);
 assert.deepEqual(git('diff','--name-only',SOURCE_BASE,SOURCE).trim().split('\n').sort(),sourcePaths);
 if(qaDiffBase!==MAIN)assert.deepEqual(
  git('diff','--name-only',MAIN,qaDiffBase).trim().split('\n').sort(),
  ['src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs',
   'tests/01e-w1-scene-area-reference-readonly.test.mjs'].sort(),
  'only independently merged main79e W1 read-only Source may appear in synthetic CI merge');
 assert.deepEqual(git('diff','--name-only',qaDiffBase,'HEAD').trim().split('\n').sort(),qaPaths);
 for(const [path,sha] of Object.entries({
  'src/routes/discover/+page.svelte':'c909b5d957bda1b5fba5727877417baf03362a6d',
  'src/lib/product-home/orientation-stage1-copy.mjs':'c2ec4e6ce2c80e97aa7e117bda5234155b72649f',
  'tests/web-stage1-discover-orientation.test.mjs':'cc5f0584f981cfc8a9b46124d756a54c18118091',
  'scripts/web-stage1-discover-orientation-chrome.mjs':'cde9a44be11f05257bad377080634a9d16cae408',
  '.github/workflows/web-stage1-discover-orientation.yml':'bfee04a028718d2c014d068ddb654f8cc21e1446'
 }))assert.equal(git('rev-parse',SOURCE+':'+path),sha,path);
});
test('latest main0ec added Home/DreamSnaps/Gallery only after 058; exact 3 merges and no Discover source',()=>{
 assert.equal(git('merge-base',PREVIOUS_MAIN,MAIN),PREVIOUS_MAIN);
 const delta=git('diff','--name-only',PREVIOUS_MAIN,MAIN).trim().split('\n').sort();
 assert.equal(delta.length,16,'5 Home + 6 DreamSnaps + 5 Gallery paths');
 for(const prefix of ['src/routes/+page.svelte','src/routes/gallery/+page.svelte','src/routes/dreamsnaps/+page.svelte']){
  assert.ok(delta.includes(prefix),prefix);
 }
 for(const path of sourcePaths)assert.equal(delta.includes(path),false,'no accepted Discover file in protected main yet');
 assert.equal(git('rev-parse',MAIN+':src/routes/+page.svelte'),'173d7b128b22db16fb2478961fcd60205754a293');
 assert.equal(git('rev-parse',MAIN+':src/routes/gallery/+page.svelte'),'22a2ca880708487211f8bbaa88ccdb7924770371');
 assert.equal(git('rev-parse',MAIN+':src/routes/dreamsnaps/+page.svelte'),'0622998c3b0d0c45ad0597c998cf3ec2707b1022');
});
test('compose only five accepted Source files in disposable workflow; no rights/Writer/Cloud or Page mutations',()=>{
 const w=readFileSync('.github/workflows/04qr-w-main0ec-discover7-composed.yml','utf8');
 assert.match(w,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(w,/git restore --source="\$SOURCE" --worktree --/);
 assert.match(w,/playwright-core@1\.55\.0/);
 assert.doesNotMatch(w,/secrets\.|workflow_dispatch|deploy-pages|write-all|git push|pull_request_target/);
 for(const file of sourcePaths)assert.ok(w.includes(file),'only source selection '+file);
 assert.equal(git('diff','--name-only',qaDiffBase,'HEAD','--','src/','static/','supabase/','.github/workflows/pages.yml'),'');
});
test('existing sibling protected Source remains OFF after composed Discover; no P1G or claim of formal Preview',()=>{
 const home=git('show',MAIN+':src/routes/+page.svelte');
 const gallery=git('show',MAIN+':src/routes/gallery/+page.svelte');
 const snaps=git('show',MAIN+':src/routes/dreamsnaps/+page.svelte');
 assert.match(home,/data-test-site-availability/);
 assert.match(gallery,/data-writer="off" data-public-eligibility="provider-gated" data-media-rights="unverified"/);
 assert.match(snaps,/data-public-provider="off" data-writer="off" data-private-results="off"/);
 const route=git('show',SOURCE+':src/routes/discover/+page.svelte');
 assert.match(route,/data-public-writer="off" data-save-auto-upload="off"/);
 assert.match(route,/data-discover-seven-products/);
 assert.doesNotMatch(route,/uploadAndFinalizeImage|writeSave|publishWork|setDreamsnapOfficialResultPublication/);
});
