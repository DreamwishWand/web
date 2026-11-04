import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {DREAMSNAPS_STAGE1_DESTINATIONS,DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,DREAMSNAPS_STAGE1_WRITER_ENABLED,dreamsnapsStage1Copy} from '../src/lib/community/dreamsnaps-stage1-root.mjs';
const main='bd966f9e94be48fafce25cfbdc298439ee47aca3',source='f814a479118d7b5813b950648b15faf37223d8bb';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
test('new six original Source paths only; QA files never mutate children or Community/Legacy media',()=>{
 assert.equal(git('merge-base',main,source),main);
 assert.deepEqual(git('diff','--name-only',main,source).split('\n').sort(),[
 '.github/workflows/web-stage1-dreamsnaps-ux.yml',
 'scripts/web-stage1-dreamsnaps-chrome.mjs',
 'src/lib/community/dreamsnaps-stage1-root.mjs',
 'src/routes/dreamsnaps/+page.svelte',
 'src/routes/dreamsnaps/community/+page.svelte',
 'tests/web-stage1-dreamsnaps-root.test.mjs'
 ]);
 assert.deepEqual(git('diff','--name-only',source,'HEAD').split('\n').sort(),[
 '.github/workflows/04qr-w-pr532-dreamsnaps-off-independent.yml',
 'scripts/04qr-w-pr532-dreamsnaps-off-chromium.mjs',
 'tests/04qr-w-pr532-dreamsnaps-off-independent.test.mjs'
 ]);
 for(const path of ['src/lib/community/DreamsnapsTabs.svelte','src/routes/dreamsnaps/submit/+page.svelte','src/routes/dreamsnaps/results/+page.svelte'])
  assert.equal(git('rev-parse','HEAD:'+path),git('rev-parse',main+':'+path),path);
});
test('exact 1-3-1 route order and no public Community/Media/Results capability',()=>{
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.id),['community','submit','judge','results','my']);
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.layout),['wide','peer','peer','peer','wide']);
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.href),['/dreamsnaps/community/','/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/']);
 assert.equal(DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,false);
 assert.equal(DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,false);
 assert.equal(DREAMSNAPS_STAGE1_WRITER_ENABLED,false);
 const root=readFileSync('src/routes/dreamsnaps/+page.svelte','utf8'),shell=readFileSync('src/routes/dreamsnaps/community/+page.svelte','utf8');
 assert.match(root,/data-private-results="off"/);
 assert.match(root,/data-public-provider="off"/);
 assert.doesNotMatch(root,/gallery\/dreamsnaps|publishWork\(|submitDdvWork/);
 assert.match(shell,/name="robots" content="noindex,nofollow"/);
 assert.match(shell,/data-community-dreamsnaps="gated"/);
 assert.doesNotMatch(shell,/GalleryBrowse|fetch\(|<img|searchPublicWorks|public\.get/);
});
test('eight locale actual copy data includes gated public and all five destinations',()=>{
 for(const l of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=dreamsnapsStage1Copy(l);
  for(const k of ['community','submit','judge','results','my','unavailable','allWorks','byChallenge','locked','back'])assert.ok(typeof c[k]==='string'&&c[k].length>0,l+':'+k);
 }
 assert.notEqual(dreamsnapsStage1Copy('fr').community,dreamsnapsStage1Copy('en').community);
 assert.notEqual(dreamsnapsStage1Copy('ja').community,dreamsnapsStage1Copy('en').community);
});
