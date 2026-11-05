/** Independent 04QR-W Stage1 Help visible 3+1 root, disabled cross-type Search.
 * No source accepted public Issue/Answer projection or Community Writer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
const MAIN='87f656833491b87712eee031f51ca135bda26b30';
const SOURCE='291551a0af16ab2ee375c4670728e3ca44fdfa18';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const original=[
 '.github/workflows/web-stage1-help-visual.yml',
 'scripts/web-stage1-help-visual-chrome.mjs',
 'src/routes/help/+page.svelte',
 'tests/web-stage1-help-visual-root.test.mjs'
];
const qa=[
 '.github/workflows/04qr-w-pr537-help-3plus1-visual-independent.yml',
 'scripts/04qr-w-pr537-help-3plus1-visual-chromium.mjs',
 'tests/04qr-w-pr537-help-3plus1-visual-independent.test.mjs'
];
const page=readFileSync('src/routes/help/+page.svelte','utf8');
test('exact four selected Source paths on protected main87f, QA-only three new paths',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),original);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 assert.equal(git('rev-parse',SOURCE+':src/routes/help/+page.svelte'),'ba83d42065f429cf37cd991dbc1865a7434b3714');
 assert.equal(git('rev-parse',SOURCE+':src/lib/community/help-stage1-copy.js'),git('rev-parse',MAIN+':src/lib/community/help-stage1-copy.js'),'prior 8 locale source retained');
});
test('three public Questions Tips Issues + separate personal My, without fifth Unanswered or Gallery crossover',()=>{
 assert.match(page,/data-help-root="four-children"/);
 assert.match(page,/data-stage1-help-public-three/);
 assert.match(page,/data-stage1-help-navigation/);
 for(const key of ['questions','tips','issues','activity'])assert.match(page,new RegExp('data-help-child="'+key+'"'));
 assert.match(page,/class="personal help-child-card"/);
 assert.match(page,/\.public-children\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(page,/\.help-child-card\.personal/);
 assert.doesNotMatch(page,/data-help-child="unanswered"|\/gallery\/dreamsnaps\/|<img\b/i);
});
test('search is visibly gated, never issue resolution/answered counts claimed or automatic Provider requests',()=>{
 assert.match(page,/data-help-cross-type-search="gated"/);
 assert.match(page,/data-root-search="unavailable" data-public-writer="off"/);
 assert.match(page,/id="help-cross-type-search" type="search" disabled/);
 assert.match(page,/aria-describedby="help-search-pending"/);
 assert.match(page,/role="status"\>\{copy\.searchPending\}/);
 assert.doesNotMatch(page,/fetch\(|createCommunityBrowserClient\(|localStorage|totalAnswers\s*=|countUnresolved\s*=|service_role|publishWork\(/);
 for(const field of ['searchPending','issuesPending']){
  assert.ok(helpStage1Copy('en')[field],field);
 }
});
test('8 locale labels and root/native privacy authority are separate from actual child RLS',()=>{
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=helpStage1Copy(lang);
  for(const key of ['questions','tips','issues','activity','search','searchPending','title']){
   assert.ok(typeof c[key]==='string'&&c[key].trim(),lang+'/'+key);
  }
 }
 assert.notEqual(helpStage1Copy('ja').activity,helpStage1Copy('en').activity);
 assert.notEqual(helpStage1Copy('fr').tips,helpStage1Copy('en').tips);
 assert.equal(git('rev-parse',MAIN+':src/routes/help/my/+page.svelte'),
  git('rev-parse',SOURCE+':src/routes/help/my/+page.svelte'),'private My child unchanged');
});
