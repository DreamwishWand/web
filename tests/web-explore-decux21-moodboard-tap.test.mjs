import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXPLORE_COPY} from '../src/lib/explore/copy.js';
const source=readFileSync(new URL('../src/routes/explore/+page.svelte',import.meta.url),'utf8');

test('DEC-UX-21 cards preserve separate Quick Review and Moodboard action paths',()=>{
 assert.match(source,/data-explore-card-review aria-label=\{copy\.quickReview/);
 assert.match(source,/on:click=\{\(event\)=>openQuickReview\(item,event\)\}/);
 assert.match(source,/data-explore-moodboard-toggle data-item-id=\{item\.itemId\}/);
 assert.match(source,/on:click=\{\(\)=>toggleMoodboard\(item\)\}/);
 assert.match(source,/aria-pressed=\{isInMoodboard\(item\)\}/);
 assert.match(source,/aria-label=\{\(isInMoodboard\(item\)\?copy\.remove:copy\.add\)\+': '\+item\.label\}/);
 assert.doesNotMatch(source,/class:added=/);
 assert.match(source,/\.card footer button\{[^}]*min-width:44px;min-height:44px/);
 assert.match(source,/\.card footer button\[aria-pressed='true'\]\{border-style:double;border-width:3px/);
 assert.match(source,/\.card footer\{[^}]*flex-wrap:wrap/);
});

test('DEC-UX-21 preserves original local Moodboard persistence, backup and no-Board disabled failclose',()=>{
 assert.match(source,/if\(!selectedBoardId\)\{status=copy\.noBoards;return;\}/);
 assert.match(source,/addMoodboardReference\(moodboards,selectedBoardId/);
 assert.match(source,/removeMoodboardReference\(moodboards,selectedBoardId/);
 assert.match(source,/localStorage\.setItem\(MOODBOARD_BACKUP_KEY,current\)/);
 assert.match(source,/localStorage\.setItem\(MOODBOARD_STORAGE_KEY,serializeMoodboardDocument\(next\)\)/);
 assert.match(source,/disabled=\{!boards\.length\}/);
 assert.match(source,/quickReviewCloseButton\?\.focus\(\)/);
 assert.match(source,/tick\(\)\.then\(\(\)=>opener\?\.focus\(\)\)/);
});

test('Eight locales provide non-color-only Add/Remove plus item-specific labels',()=>{
 assert.equal(Object.keys(EXPLORE_COPY).length,8);
 for(const [name,copy] of Object.entries(EXPLORE_COPY)){
  assert.ok(copy.add?.trim(),name+' add');
  assert.ok(copy.remove?.trim(),name+' remove');
  assert.notEqual(copy.add,copy.remove,name);
  assert.ok(copy.quickReview?.trim(),name+' review');
 }
});
