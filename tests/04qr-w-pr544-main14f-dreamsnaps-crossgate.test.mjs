// 04 QR-W / PR544 main14f NEW combined-risk only. Reuse accepted PR532/QA542 eight-locale UI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
  DREAMSNAPS_STAGE1_DESTINATIONS,DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,
  DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,DREAMSNAPS_STAGE1_WRITER_ENABLED
} from '../src/lib/community/dreamsnaps-stage1-root.mjs';
const MAIN='14f85625c06f277f580581f73897748367bcfe7a';
const SRC='a391f430773aaa48fc66c2ae9844b2f2dfcdc83c';
const sourcePaths=[
 '.github/workflows/web-stage1-dreamsnaps-ux.yml',
 'scripts/web-stage1-dreamsnaps-chrome.mjs',
 'src/lib/community/dreamsnaps-stage1-root.mjs',
 'src/routes/dreamsnaps/+page.svelte',
 'src/routes/dreamsnaps/community/+page.svelte',
 'tests/web-stage1-dreamsnaps-root.test.mjs'
].sort();
const qaPaths=[
 '.github/workflows/04qr-w-pr544-main14f-dreamsnaps-crossgate.yml',
 'scripts/04qr-w-pr544-main14f-dreamsnaps-crossgate-chrome.mjs',
 'tests/04qr-w-pr544-main14f-dreamsnaps-crossgate.test.mjs'
].sort();
const git=(...xs)=>execFileSync('git',xs,{encoding:'utf8'}).trim();
test('same Git tree: Source exact six paths on protected main14f; independent QA-only exact three',()=>{
 assert.equal(git('merge-base',MAIN,SRC),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SRC).split('\n').sort(),sourcePaths);
 assert.deepEqual(git('diff','--name-only',SRC,'HEAD').split('\n').sort(),qaPaths);
 for(const [path,sha] of Object.entries({
  'src/routes/dreamsnaps/+page.svelte':'0622998c3b0d0c45ad0597c998cf3ec2707b1022',
  'src/routes/dreamsnaps/community/+page.svelte':'9791d44a3443dece99b815724c955e855dafb6e2',
  'src/lib/community/dreamsnaps-stage1-root.mjs':'51d8fdb905e3b55814caed2819e579a47b41425c',
  'scripts/web-stage1-dreamsnaps-chrome.mjs':'fe2c3cd952d240ace0b36e9def913d1cf0af2852',
  'tests/web-stage1-dreamsnaps-root.test.mjs':'148d39dfe37b67a5feee766bc9266c64b112dd3b',
  '.github/workflows/web-stage1-dreamsnaps-ux.yml':'df4f4a2d6bd240e7906b3991092f5a5b9703ae26'
 }))assert.equal(git('rev-parse',SRC+':'+path),sha,path);
 // Independently accepted current-main Presets and Collection shared Item link must remain unchanged.
 for(const [path,sha] of Object.entries({
  'src/routes/presets/+page.svelte':'55f8522f0e0099b69e780ab04191c66cd3bc05ff',
  'src/lib/presets/stage1-root.mjs':'7f741542e0f7f5d7df0b8e51caf1e32c9d617c58'
 }))assert.equal(git('rev-parse',SRC+':'+path),sha);
});
test('main14f combined product: five DreamSnaps destinations cannot authorize public Works or Save writer',()=>{
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.id),['community','submit','judge','results','my']);
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.layout),['wide','peer','peer','peer','wide']);
 assert.equal(DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,false);
 assert.equal(DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,false);
 assert.equal(DREAMSNAPS_STAGE1_WRITER_ENABLED,false);
 const root=readFileSync('src/routes/dreamsnaps/+page.svelte','utf8');
 const gated=readFileSync('src/routes/dreamsnaps/community/+page.svelte','utf8');
 assert.match(root,/data-public-provider="off" data-writer="off" data-private-results="off" data-media-rights="unverified"/);
 assert.match(gated,/meta name="robots" content="noindex,nofollow"/);
 assert.match(gated,/data-public-provider="off" data-writer="off" data-media-rights="unverified"/);
 assert.match(gated,/data-private-results="off"/);
 assert.doesNotMatch(root+gated,/<img|<video|<iframe|publishWork|searchPublicWorks|writeSave|uploadAndFinalizeImage/);
 // Child signed Submit/Judge/Results/My and legacy Gallery paths are byte untouched.
 assert.equal(git('diff','--name-only',MAIN,SRC,'--','src/routes/gallery/','src/routes/dreamsnaps/submit/','src/routes/dreamsnaps/judge/','src/routes/dreamsnaps/results/','src/routes/dreamsnaps/my/'),'');
});
test('live current-parent CI policy: strict six allowed paths and no sibling Gallery/Provider/SQL/Native bypass',()=>{
 const y=readFileSync('.github/workflows/web-stage1-dreamsnaps-ux.yml','utf8');
 assert.match(y,/github\.event\.pull_request\.base\.sha/);
 assert.match(y,/test "\$\(wc -l <\/tmp\/stage1-dreamsnaps\)" -eq 6/);
 assert.match(y,/contents: read/);
 for(const path of sourcePaths)assert.ok(y.includes("'"+path+"'"),path);
 for(const path of ['src/routes/gallery/','src/lib/community/browser-client.ts','src/lib/community/browser-client.js',
   'src/lib/community/DreamsnapsTabs.svelte','src/routes/dreamsnaps/submit/',
   'src/routes/dreamsnaps/judge/','src/routes/dreamsnaps/results/','src/routes/dreamsnaps/my/',
   'src/lib/ddv/','src/lib/wep/','supabase/','static/','.github/workflows/pages.yml'
 ])assert.ok(y.includes(path),'protected path '+path);
 const set=new Set(sourcePaths);
 const admit=files=>files.length===6&&new Set(files).size===6&&files.every(p=>set.has(p));
 assert.ok(admit(sourcePaths));
 for(const extra of ['src/lib/presets/stage1-root.mjs','src/routes/gallery/+page.svelte','src/lib/community/browser-client.ts',
  'src/lib/wep/unsafe-writer.ts','supabase/migrations/000_bad.sql','static/ddv/public.png','src/routes/dreamsnaps/submit/+page.svelte',
  'tests/04qr-w-pr544-main14f-dreamsnaps-crossgate.test.mjs'])
  assert.equal(admit([...sourcePaths.slice(0,5),extra]),false);
 assert.equal(admit([...sourcePaths,sourcePaths[0]]),false);
 assert.equal(admit(sourcePaths.slice(0,5)),false);
 assert.doesNotMatch(y,/secrets\.|deploy-pages|continue-on-error|write-all/);
});
test('QA-only workflow cannot change public paths, publish rights or bring in private owner P1G',()=>{
 const y=readFileSync('.github/workflows/04qr-w-pr544-main14f-dreamsnaps-crossgate.yml','utf8');
 assert.match(y,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(y,/playwright-core@1\.55\.0/);
 assert.doesNotMatch(y,/secrets\.|deploy-pages|workflow_dispatch|write-all/);
 assert.equal(git('diff','--name-only',SRC,'HEAD','--','src/routes/','src/lib/community/','src/lib/ddv/','src/lib/wep/','static/','supabase/'),'');
});
