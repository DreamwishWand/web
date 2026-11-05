// 04 QR-W PR570 independent CI-policy-only QA; reuse product Gallery QA528, no duplicate browser run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const MAIN='14f85625c06f277f580581f73897748367bcfe7a';
const SOURCE='1e1bae1db21a3910c38e97fbf7e90d7328538132';
const OLD='f7b1b2e7b823ff6e39c1de5ee5afe028c892eedd';
const FILE='.github/workflows/web-stage1-gallery-ux.yml';
const sourcePaths=[FILE,'scripts/web-stage1-gallery-chrome.mjs','src/lib/community/gallery-stage1-root.mjs','src/routes/gallery/+page.svelte','tests/web-stage1-gallery-root.test.mjs'].sort();
const qaPaths=['.github/workflows/04qr-w-pr570-gallery-trigger-independent.yml','tests/04qr-w-pr570-gallery-trigger-independent.test.mjs'].sort();
const git=(...xs)=>execFileSync('git',xs,{encoding:'utf8'}).trim();
const original=git('show',OLD+':'+FILE);
const modified=readFileSync(FILE,'utf8').trim();
const trusted='$'+"{{ github.event.pull_request.base.sha || '"+MAIN+"' }}";
const oldBase='$'+"{{ github.event.pull_request.base.sha || 'fabfd17c8dd192707d55a6cc12cccf65797d564e' }}";
const eventPaths=['src/routes/gallery/+page.svelte','src/lib/community/gallery-stage1-root.mjs','tests/web-stage1-gallery-root.test.mjs','scripts/web-stage1-gallery-chrome.mjs',FILE];
const addition=eventPaths.map(x=>'      - '+JSON.stringify(x).replaceAll('"',"'")).join('\n')+'\n';

test('PR570 current protected main exactly five and old Gallery product/source blob identity reused, QA-only exactly two',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),sourcePaths);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaPaths);
 const identical={
  'src/routes/gallery/+page.svelte':'22a2ca880708487211f8bbaa88ccdb7924770371',
  'src/lib/community/gallery-stage1-root.mjs':'a53e579198678a1ff064facdb9a3f7bcf8eb8a0c',
  'scripts/web-stage1-gallery-chrome.mjs':'c7d5ee5b4f3d8e82148b097dabc1e764878eb3bf',
  'tests/web-stage1-gallery-root.test.mjs':'4bc6d3602727c1a53f94eefd28cd0019d468df78'
 };
 for(const [path,sha] of Object.entries(identical)){
  assert.equal(git('rev-parse',SOURCE+':'+path),sha);
  assert.equal(git('rev-parse',OLD+':'+path),sha,'original PR534/QA528 accepted product unchanged');
 }
 assert.equal(git('rev-parse',SOURCE+':'+FILE),'ab7664596105aeb45869243d1276fe142636fcb4');
 assert.equal(git('rev-parse',OLD+':'+FILE),'f9124162697bddc9cf93a7fb93d9a138657a420f');
});

test('Gallery CI only two exact scope fixes: 5-path pull_request trigger and trusted current-main fallback',()=>{
 const oldHeader='  pull_request:\n';
 const replacement=oldHeader+'    paths:\n'+addition;
 assert.ok(original.includes(oldHeader),'original unscoped PR trigger must be observed');
 assert.ok(modified.includes(replacement),'new pull_request filter must be exact five Gallery Source paths');
 assert.ok(original.includes('BASE="'+oldBase+'"'));
 assert.ok(modified.includes('BASE="'+trusted+'"'));
 assert.equal(modified.replace(replacement,oldHeader).replace('BASE="'+trusted+'"','BASE="'+oldBase+'"'),original,
   'every other workflow byte identical: no new rights/provider/writer/public positive changes');
 assert.equal(modified.split('  pull_request:').length,2);
 assert.ok(modified.includes('test "$(wc -l </tmp/08web-gallery-stage1)" -eq 5'));
 assert.ok(modified.includes('test "$(git merge-base "$BASE" HEAD)" = "$BASE"'));
 assert.ok(modified.includes('contents: read'));
 assert.doesNotMatch(modified,/secrets\.|continue-on-error|deploy-pages|workflow_dispatch|permissions:\s*write-all/);
});

test('strong negative scope: exact five only, unrelated Presets, Guide, QR, Native, SQL, Gallery publish all rejected',()=>{
 const allowed=new Set(sourcePaths);
 const admit=paths=>paths.length===5&&new Set(paths).size===5&&paths.every(x=>allowed.has(x));
 const triggers=paths=>paths.some(x=>allowed.has(x));
 assert.equal(admit(sourcePaths),true);
 for(const item of [
  'src/lib/presets/stage1-root.mjs',
  'src/lib/guide/systems-primary-mechanic-bridge.mjs',
  'tests/04qr-w-pr570-gallery-trigger-independent.test.mjs',
  'src/lib/wep/preset-community-bridge.ts',
  'src/lib/ddv/unsafe-native.mjs',
  'src/lib/community/browser-client.ts',
  'supabase/migrations/unsafe_public.sql',
  'static/ddv/guide/unverified.json',
  '.github/workflows/pages.yml'
 ]){
  assert.equal(triggers([item]),false,'unrelated '+item+' must SKIP event before workflow job');
  assert.equal(admit([...sourcePaths,item]),false,'mixed sixth '+item+' must fail exact5');
  assert.equal(admit([sourcePaths[0],sourcePaths[1],sourcePaths[2],sourcePaths[3],item]),false,'forged replacement '+item);
 }
 for(const invalid of [[],[sourcePaths[0]],sourcePaths.slice(0,4),
  [sourcePaths[0],sourcePaths[0],sourcePaths[2],sourcePaths[3],sourcePaths[4]]])
  assert.equal(admit(invalid),false,'must reject incomplete/duplicate diff');
 for(const path of ['src/lib/community/browser-client.ts','src/lib/community/browser-client.js','src/lib/ddv/','src/lib/wep/','src/lib/timing/','supabase/','static/','.github/workflows/pages.yml'])
  assert.ok(modified.includes(path),'strict protected Source deny retained '+path);
});

test('no Gallery positive Writer, invented Media Rights, or unrelated deployed UI; QA workflow only reviews policy',()=>{
 const root=readFileSync('src/lib/community/gallery-stage1-root.mjs','utf8');
 assert.match(root,/STAGE1_GALLERY_PUBLIC_WRITER_ENABLED=false/);
 assert.match(root,/STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED=false/);
 const s=readFileSync('src/routes/gallery/+page.svelte','utf8');
 assert.match(s,/data-writer="off" data-public-eligibility="provider-gated" data-media-rights="unverified"/);
 assert.doesNotMatch(s,/\/gallery\/dreamsnaps\//);
 const q=readFileSync('.github/workflows/04qr-w-pr570-gallery-trigger-independent.yml','utf8');
 assert.match(q,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.doesNotMatch(q,/secrets\.|deploy-pages|workflow_dispatch|write-all/);
});
