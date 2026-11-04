import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const g=read('src/routes/guide/+page.svelte');
test('Stage1 Guide first screen has four owner-closed children rather than 5th Issues/flat Quests',()=>{
 assert.match(g,/data-stage1-guide-hub/);
 assert.match(g,/\['quests','starPaths','events','systems'\]/);
 assert.match(g,/section:Section\|null=null/);
 assert.match(g,/\{#if !section\}/);
 assert.match(g,/data-guide-child=\{key\}/);
 assert.match(g,/guide-hub-card/);
 assert.doesNotMatch(g,/guideIssueView|runtime\.records\.issues\.map/);
 assert.doesNotMatch(g,/\['quests','starPaths','events','systems','issues'\]/);
});
test('Guide retains source-gated 4 inner read-only workspaces, searchable without new Writer or product flags',()=>{
 for(const token of ['loadGuideRuntime','guideQuestView','guideStarPathView','guideEventView','guideSystemView','filterGuideViews','guide-workspace'])assert.match(g,new RegExp(token));
 assert.match(g,/chooseSection\(key as Section\)/);
 assert.match(g,/section=null;selectedKey=null;query=''/);
 assert.doesNotMatch(g,/fetch\(|localStorage|publishWork\(|file\.arrayBuffer\(/);
});
test('Guide root has responsive large visual cards and visible keyboard focus at 320px',()=>{
 assert.match(g,/.guide-hub\{display:grid/);
 assert.match(g,/repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(g,/@media\(max-width:460px\)/);
 assert.match(g,/guide-hub-card:focus-visible/);
});
