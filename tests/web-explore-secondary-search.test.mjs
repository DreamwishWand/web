import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXPLORE_COPY} from '../src/lib/explore/copy.js';

const source=readFileSync(new URL('../src/routes/explore/+page.svelte',import.meta.url),'utf8');

test('DEC-UX-07: Explore search is initially collapsed, opt-in, localized and keyboard accessible',()=>{
  assert.match(source,/let searchExpanded=false;/);
  assert.match(source,/data-explore-search-toggle/);
  assert.match(source,/aria-expanded=\{searchExpanded\} aria-controls="explore-search-panel"/);
  assert.match(source,/on:click=\{toggleExploreSearch\}/);
  assert.match(source,/class:collapsed=\{!searchExpanded\} id="explore-search-panel"/);
  assert.match(source,/\.search-field\.collapsed\{display:none\}/);
  assert.match(source,/bind:value=\{query\} disabled=\{!searchExpanded\}/);
  assert.match(source,/searchInput\?\.focus\(\)/);
  assert.match(source,/on:keydown=\{handleExploreSearchKeydown\}/);
  assert.match(source,/event\.key!=='Escape'/);
  assert.match(source,/searchToggle\?\.focus\(\)/);
  assert.deepEqual(Object.keys(EXPLORE_COPY).sort(),['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'].sort());
  for(const [loc,copy] of Object.entries(EXPLORE_COPY))assert.ok(copy.search?.trim(),loc);
});

test('Collapsing Search clears stale query and retains all preexisting decorating facets/flows',()=>{
  const close=source.match(/function closeExploreSearch\(\)\{([\s\S]*?)\n  \}/)?.[1]??'';
  assert.match(close,/query='';/);
  assert.match(close,/searchExpanded=false;/);
  assert.match(source,/if\(searchExpanded\)\{closeExploreSearch\(\);return;\}/);
  assert.match(source,/bind:value=\{family\}/);
  assert.match(source,/bind:value=\{universe\}/);
  assert.match(source,/bind:value=\{selectedBoardId\}/);
  assert.match(source,/filterCollectionRecords\(decorationRecords,\{query,family,universe\}\)/);
  assert.match(source,/on:click=\{\(event\)=>openQuickReview\(item,event\)\}/);
  assert.match(source,/on:click=\{\(\)=>toggleMoodboard\(item\)\}/);
  assert.match(source,/on:click=\{\(\)=>placeInWorldEditor\(selectedItem\)\}/);
  assert.doesNotMatch(source,/<label><span>\{copy\.search\}<\/span><input type="search" bind:value=\{query\} \/><\/label>/);
});
