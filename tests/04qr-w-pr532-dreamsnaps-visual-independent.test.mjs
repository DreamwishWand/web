/** 04QR-W independent Stage1 DreamSnaps 1–3–1 Owner UX without public Provider.
 * Fixed Source PR532; no real private P1G, media, Auth or Community writer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 DREAMSNAPS_STAGE1_DESTINATIONS,
 DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,DREAMSNAPS_STAGE1_WRITER_ENABLED,
 dreamsnapsStage1Copy
} from '../src/lib/community/dreamsnaps-stage1-root.mjs';
const PARENT='bd966f9e94be48fafce25cfbdc298439ee47aca3';
const SOURCE='f814a479118d7b5813b950648b15faf37223d8bb';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sources=[
 '.github/workflows/web-stage1-dreamsnaps-ux.yml',
 'scripts/web-stage1-dreamsnaps-chrome.mjs',
 'src/lib/community/dreamsnaps-stage1-root.mjs',
 'src/routes/dreamsnaps/+page.svelte',
 'src/routes/dreamsnaps/community/+page.svelte',
 'tests/web-stage1-dreamsnaps-root.test.mjs'
],qas=[
 '.github/workflows/04qr-w-pr532-dreamsnaps-visual-independent.yml',
 'scripts/04qr-w-pr532-dreamsnaps-visual-chromium.mjs',
 'tests/04qr-w-pr532-dreamsnaps-visual-independent.test.mjs'
];
const read=p=>readFileSync(p,'utf8');
test('exact mainbd966 6 Owner UI paths, QA only 3 paths, existing 4 signed child pages unaffected',()=>{
 assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
 assert.deepEqual(git('diff','--name-only',PARENT,SOURCE).split('\n').sort(),sources);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qas);
 assert.equal(git('rev-parse',SOURCE+':src/routes/dreamsnaps/+page.svelte'),'0622998c3b0d0c45ad0597c998cf3ec2707b1022');
 assert.equal(git('rev-parse',SOURCE+':src/routes/dreamsnaps/community/+page.svelte'),'9791d44a3443dece99b815724c955e855dafb6e2');
 assert.equal(git('rev-parse',SOURCE+':src/lib/community/dreamsnaps-stage1-root.mjs'),'51d8fdb905e3b55814caed2819e579a47b41425c');
 for(const area of ['submit','judge','results','my']){
  const path='src/routes/dreamsnaps/'+area+'/+page.svelte';
  assert.equal(git('rev-parse',SOURCE+':'+path),git('rev-parse',PARENT+':'+path),area+' signed child must be unchanged');
 }
});
test('precise owner navigation 1–3–1 and no outdated Gallery DreamSnaps or public Writer',()=>{
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.id),['community','submit','judge','results','my']);
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.layout),['wide','peer','peer','peer','wide']);
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.href),[
  '/dreamsnaps/community/','/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/'
 ]);
 assert.deepEqual([
  DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,DREAMSNAPS_STAGE1_WRITER_ENABLED
 ],[false,false,false]);
 const root=read('src/routes/dreamsnaps/+page.svelte');
 assert.match(root,/data-stage1-dreamsnaps-root="1-3-1"/);
 assert.match(root,/data-public-provider="off" data-writer="off" data-private-results="off" data-media-rights="unverified"/);
 assert.match(root,/data-stage1-dreamsnaps-peers/);
 assert.doesNotMatch(root,/DreamsnapsTabs|\/gallery\/dreamsnaps\/|uploadMedia\(|publishWork\(|fetch\(/);
});
test('Community entry displays unavailable state with no public photo/Work projection, noindex',()=>{
 const page=read('src/routes/dreamsnaps/community/+page.svelte');
 assert.match(page,/name="robots" content="noindex,nofollow"/);
 assert.match(page,/data-community-dreamsnaps="gated"/);
 assert.match(page,/data-public-provider="off" data-writer="off" data-media-rights="unverified"/);
 assert.match(page,/data-private-results="off"/);
 assert.match(page,/!DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED/);
 assert.match(page,/\{ux\.unavailable\}/);
 assert.doesNotMatch(page,/<img\b|<video\b|fetch\(|searchPublicWorks\(|localStorage|uploadMedia\(|service_role|publiclyVisible\s*=\s*true/);
});
test('8 locale navigation labels and gated callouts provided, root never reveals voting result',()=>{
 for(const code of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const strings=dreamsnapsStage1Copy(code);
  for(const key of ['community','submit','judge','results','my','unavailable','locked','allWorks','byChallenge','back'])
   assert.ok(typeof strings[key]==='string'&&strings[key].trim().length>0,code+':'+key);
 }
 assert.equal(dreamsnapsStage1Copy('ja').submit,'応募する');
 assert.equal(dreamsnapsStage1Copy('fr').judge,'Juger');
 assert.notEqual(dreamsnapsStage1Copy('ja').results,dreamsnapsStage1Copy('en').results);
});
