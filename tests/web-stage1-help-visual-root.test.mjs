import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
const page=readFileSync(new URL('../src/routes/help/+page.svelte',import.meta.url),'utf8');

test('owner exact Help Root three peer public cards and separate wide personal My Activity',()=>{
 assert.match(page,/data-help-root="four-children"/);
 assert.match(page,/data-stage1-help-navigation/);
 assert.match(page,/data-stage1-help-public-three/);
 assert.match(page,/data-help-child="questions"/);
 assert.match(page,/data-help-child="tips"/);
 assert.match(page,/data-help-child="issues"/);
 assert.match(page,/data-help-child="activity"/);
 assert.match(page,/class="personal help-child-card"/);
 assert.match(page,/\.public-children\{display:grid;grid-template-columns:repeat\(3/);
 assert.match(page,/\.help-child-card\.personal\{min-height/);
 assert.doesNotMatch(page,/href=\{[^}]*unanswered|data-help-child="unanswered"/);
});
test('cross-type search remains VISUAL but disabled pending rights and Product resolution',()=>{
 assert.match(page,/data-help-cross-type-search="gated"/);
 assert.match(page,/data-root-search="unavailable" data-public-writer="off"/);
 assert.match(page,/<input id="help-cross-type-search" type="search" disabled/);
 assert.match(page,/aria-describedby="help-search-pending"/);
 assert.match(page,/\{copy.searchPending\}/);
 assert.doesNotMatch(page,/fetch\(|onMount|callPublicCommunityRpc|communitySearch|searchUnified/);
});
test('eight-locale labels map existing single Help copy without unsupported public counts or published issues',()=>{
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const copy=helpStage1Copy(lang);
  for(const key of ['title','questions','tips','issues','activity','search','searchPending']){
   assert.ok(copy[key],lang+':'+key);
  }
 }
 assert.match(page,/<strong>\{copy.questions\}<\/strong>/);
 assert.match(page,/<strong>\{copy.tips\}<\/strong>/);
 assert.match(page,/<strong>\{copy.issues\}<\/strong>/);
 assert.match(page,/<strong>\{copy.activity\}<\/strong>/);
 assert.doesNotMatch(page,/\{copy.unresolved\}|\{copy.solved\}|answeredCount|issueCount|resolutionCount/);
});
test('keyboard 320px 200% visual cards and unlicensed media absence',()=>{
 assert.match(page,/.help-child-card:focus-visible/);
 assert.match(page,/@media\(max-width:620px\)/);
 assert.match(page,/@media\(max-width:360px\)/);
 assert.doesNotMatch(page,/<img\b|<video\b|<canvas\b/);
});
