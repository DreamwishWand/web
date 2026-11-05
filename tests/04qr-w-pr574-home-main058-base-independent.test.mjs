// 04 QR-W PR574 changed-only trusted CI base; existing fixed 8-locale Home QA560 REUSED.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const MAIN='058ac652b06fdc62ff85559186375c5b7a1e62a4';
const SOURCE='08c3a56520cb4c7db595d7d82b06b2b8cf049700';
const OLD='367cff6a17c0cc5788bfca219d9a28759bb90598';
const wf='.github/workflows/web-stage1-home-copy-locale.yml';
const srcPaths=[wf,'scripts/web-stage1-home-copy-locale-chrome.mjs','src/lib/product-home/copy.js',
 'src/routes/+page.svelte','tests/web-stage1-home-canonical-copy-locale.test.mjs'].sort();
const qaPaths=['.github/workflows/04qr-w-pr574-home-main058-base-independent.yml',
 'tests/04qr-w-pr574-home-main058-base-independent.test.mjs'].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const original=git('show',OLD+':'+wf),newWF=readFileSync(wf,'utf8').trim();
const oldLine='BASE=87f656833491b87712eee031f51ca135bda26b30';
const newLine='BASE="'+'$'+"{{ github.event.pull_request.base.sha || '"+MAIN+"' }}"+'"';

test('Source PR574 exactly five on newest main058, four byte-identical accepted Home repair blobs; QA two only',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),srcPaths);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaPaths);
 for(const [path,sha] of Object.entries({
  'src/routes/+page.svelte':'173d7b128b22db16fb2478961fcd60205754a293',
  'src/lib/product-home/copy.js':'daca1ccbe505d9e49aaf11a03472a7d1fde43cd9',
  'tests/web-stage1-home-canonical-copy-locale.test.mjs':'bb0d81d8914677ddf5298209d446d0209e7deabf',
  'scripts/web-stage1-home-copy-locale-chrome.mjs':'69ee43f76a9753a4c372ef5626b25b97b0f899b8'
 })){
  assert.equal(git('rev-parse',SOURCE+':'+path),sha);
  assert.equal(git('rev-parse',OLD+':'+path),sha,'accepted repaired Source must not change');
 }
 assert.equal(git('rev-parse',SOURCE+':'+wf),'f9f8cd94c076b97f046689578f6a9129ef1a0dfe');
 assert.equal(git('rev-parse',OLD+':'+wf),'13b169313ac84f018025362b509d249a61e0b2b8');
});
test('one and only one trusted PR-base line differs from independently accepted Home UX CI workflow',()=>{
 assert.ok(original.includes(oldLine));
 assert.ok(newWF.includes(newLine));
 assert.equal(newWF.replace(newLine,oldLine),original,'strict byte-equivalence except trusted base line');
 assert.equal(newWF.split(newLine).length,2);
 assert.match(newWF,/pull_request\.base\.sha/);
 assert.match(newWF,/test "\$\(git merge-base "\$BASE" HEAD\)" = "\$BASE"/);
 assert.match(newWF,/test "\$\(wc -l <\/tmp\/stage1-home-copy\)" -eq 5/);
 assert.match(newWF,/contents: read/);
 assert.doesNotMatch(newWF,/secrets\.|continue-on-error|workflow_dispatch|deploy-pages|write-all/);
});
test('allowed Home 5 path trigger skips unrelated Guide/Help/Collection/WEP/SQL and forbids extra six-path mutation',()=>{
 for(const p of srcPaths)assert.ok(newWF.includes("'"+p+"'"),p);
 const set=new Set(srcPaths),admit=files=>files.length===5&&new Set(files).size===5&&files.every(p=>set.has(p));
 assert.ok(admit(srcPaths));
 for(const x of ['src/routes/help/+page.svelte','src/routes/guide/+page.svelte','src/routes/discover/+page.svelte',
  'src/routes/collection/+page.svelte','src/lib/community/browser-client.ts','src/lib/wep/world-save-source.ts',
  'supabase/migrations/unsafe.sql','static/ddv/rights-unapproved.json',
  'tests/04qr-w-pr574-home-main058-base-independent.test.mjs']){
  assert.equal(admit([x]),false,'unrelated-only PR must skip and fail owner strict5');
  assert.equal(admit([...srcPaths,x]),false,'extra unapproved sixth path '+x);
  assert.equal(admit([...srcPaths.slice(0,4),x]),false,'replaced unauthorized source '+x);
 }
 assert.equal(admit(srcPaths.slice(0,4)),false);
 assert.equal(admit([srcPaths[0],srcPaths[0],srcPaths[1],srcPaths[2],srcPaths[3]]),false);
 for(const path of ['src/routes/guide/','src/routes/help/','src/routes/discover/','src/lib/community/',
  'src/lib/ddv/','src/lib/wep/','src/lib/ui/','supabase/','static/','.github/workflows/pages.yml'])
  assert.ok(newWF.includes(path),'forbidden Source path '+path);
});
test('Home Help BODY and six Core user-visible ownership remain preserved; no new article/Public Writer authorization',()=>{
 const home=readFileSync('src/routes/+page.svelte','utf8');
 assert.match(home,/description=\{copy\.qaDetail\}/);
 assert.match(home,/titleFor\(card\.id,copy\)/);
 assert.match(home,/detailFor\(card\.id,copy\)/);
 assert.match(home,/home-product-grid/);
 assert.match(home,/home-qa-entry/);
 assert.doesNotMatch(home,/\bpublishWork\(|\bwriteSave\(|\buploadAndFinalizeImage\(/);
 const qa=readFileSync('.github/workflows/04qr-w-pr574-home-main058-base-independent.yml','utf8');
 assert.match(qa,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.doesNotMatch(qa,/secrets\.|deploy-pages|write-all|workflow_dispatch/);
 assert.equal(git('diff','--name-only',SOURCE,'HEAD','--','src/','static/','supabase/'),'');
});
