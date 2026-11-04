import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guideCopy} from '../src/lib/guide/copy.js';
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
 assert.match(g,/sectionLabel\(key as Section,copy\)/);
 assert.match(g,/sectionLabel\(section,copy\)/);
 assert.match(g,/section=null;selectedKey=null;query=''/);
 assert.doesNotMatch(g,/fetch\(|localStorage|publishWork\(|file\.arrayBuffer\(/);
});
test('Guide root has responsive large visual cards and visible keyboard focus at 320px',()=>{
 assert.match(g,/.guide-hub\{display:grid/);
 assert.match(g,/repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(g,/@media\(max-width:460px\)/);
 assert.match(g,/guide-hub-card:focus-visible/);
});

test('all eight Guide root labels consume canonical locale copy; Japanese is localized',()=>{
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=guideCopy(locale);
  for(const key of ['quests','starPaths','events','systems'])assert.ok(c[key],locale+'/'+key);
 }
 assert.deepEqual(['quests','starPaths','events','systems'].map(k=>guideCopy('ja')[k]),
  ['クエスト','スターパス','イベント','ゲームシステム']);
 assert.notEqual(guideCopy('ja').quests,guideCopy('en').quests);
});
