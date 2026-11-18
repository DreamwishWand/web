import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXPLORE_COPY} from '../src/lib/explore/copy.js';
const page=readFileSync(new URL('../src/routes/explore/+page.svelte',import.meta.url),'utf8');
const icons=readFileSync(new URL('../src/lib/ui/Icon.svelte',import.meta.url),'utf8');

test('DEC-UX-28 Moodboard control uses controlled icon assets (board+plus/check), never Game Favorite heart',()=>{
 assert.match(page,/import Icon from '\$lib\/ui\/Icon\.svelte'/);
 assert.match(page,/data-explore-moodboard-toggle/);
 assert.match(page,/data-moodboard-state-icon=\{addedToBoard\?'check':'plus'\}/);
 assert.match(page,/<Icon name="moodboard" size=\{17\} decorative=\{true\}\/>/);
 assert.match(page,/<Icon name=\{addedToBoard\?'check':'plus'\} size=\{13\} decorative=\{true\}\/>/);
 assert.match(page,/class="moodboard-action-icons" aria-hidden="true"/);
 assert.match(page,/class="moodboard-action-label">\{addedToBoard\?copy\.remove:copy\.add\}/);
 for(const name of ['moodboard','plus','check','heart'])assert.match(icons,new RegExp('(?:^|\\n)\\s*'+name+': \\[','m'));
 assert.doesNotMatch(page,/<Icon name="heart"/);
 assert.doesNotMatch(page,/<span class="moodboard-action-icons"[^>]*>[+✓✔♥]/);
});

test('Icon state shares exactly the existing reactive per-item Moodboard membership and separate Quick Review action',()=>{
 assert.match(page,/\{@const addedToBoard=Boolean\(moodboards && selectedBoardId && isInMoodboard\(item\)\)\}/);
 assert.match(page,/aria-pressed=\{addedToBoard\}/);
 assert.match(page,/aria-label=\(addedToBoard\?copy\.remove:copy\.add\)/);
 assert.match(page,/on:click=\{\(\)=>toggleMoodboard\(item\)\}/);
 assert.match(page,/data-explore-card-review/);
 assert.match(page,/on:click=\{\(event\)=>openQuickReview\(item,event\)\}/);
 assert.match(page,/\.card footer button\{[^}]*min-width:44px;min-height:44px/);
 assert.match(page,/localStorage\.setItem\(MOODBOARD_BACKUP_KEY,current\)/);
 assert.match(page,/disabled=\{!boards\.length\}/);
});

test('All eight locales have independent Add/Remove text paired to the icon, not glyph-only affordances',()=>{
 assert.equal(Object.keys(EXPLORE_COPY).length,8);
 for(const [loc,c] of Object.entries(EXPLORE_COPY)){
  assert.ok(c.add?.trim()&&c.remove?.trim()&&c.quickReview?.trim(),loc);
  assert.notEqual(c.add,c.remove,loc);
 }
});
