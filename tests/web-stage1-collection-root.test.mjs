import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
 STAGE1_COLLECTION_ROOT_CONTRACT, STAGE1_COLLECTION_ORDER, STAGE1_COLLECTION_WRITER_ENABLED,
 STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED, stage1CollectionCopy, stage1CategoryLabel,
 stage1RootCategories, stage1ScopeRecords, groupStage1CategoryResults, groupStage1UniverseResults
} from '../src/lib/collection/stage1-root.mjs';
const page=readFileSync(new URL('../src/routes/collection/+page.svelte',import.meta.url),'utf8');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const entry=(itemId,family,worlds,universes,label='Item')=>({
 itemId,family,worlds,universes,label,searchText:label.toLocaleLowerCase(),stateClass:'TRACKED'
});
const sample=[
 entry(40000047,'Furniture',['Valley'],['Disney'],'Chair'),
 entry(40000048,'Furniture',['Isle'],['Mickey'],'Table'),
 entry(31700017,'Fish',['Isle'],['Disney'],'Salmon'),
 entry(31700018,'Fish',['Valley'],['Mickey'],'Trout')
];
test('owner-closed Collection root fixed 29 categories, starts decorating and has no invented supercategory',()=>{
 assert.equal(STAGE1_COLLECTION_ROOT_CONTRACT,'wand.collection.stage1-root@1');
 assert.equal(STAGE1_COLLECTION_ORDER.length,29);
 assert.equal(new Set(STAGE1_COLLECTION_ORDER).size,29);
 assert.deepEqual(STAGE1_COLLECTION_ORDER.slice(0,6),
  ['Furniture','Landscaping','Roads & Fences','Wallpaper & Flooring','Buildings','Environment Effects']);
 assert.deepEqual(STAGE1_COLLECTION_ORDER.slice(-6),
  ['Memories','Board Game','Snippets','Lorekeeper Tales','Quest Puzzles','Exhibition']);
 const mapped=stage1RootCategories({f:['Furniture','Fish']});
 assert.equal(mapped.length,29);
 assert.equal(mapped[0].sourceAvailable,true);
 assert.equal(mapped.find(x=>x.id==='Fish').sourceAvailable,true);
 assert.equal(mapped.find(x=>x.id==='Quest Puzzles').sourceAvailable,false);
 for(const x of mapped){
  assert.equal(x.progress,null);
  assert.equal(x.denominator,null);
  assert.equal(x.percentage,null);
  assert.equal(x.imageRightsAccepted,false);
 }
 assert.equal(STAGE1_COLLECTION_WRITER_ENABLED,false);
 assert.equal(STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,false);
});
test('eight locale category labels and unknown progress are present without fake percentages',()=>{
 for(const locale of locales){
  const ux=stage1CollectionCopy(locale);
  assert.ok(ux.unknown&&ux.filter&&ux.owned&&ux.missing&&ux.clear,locale);
  for(const category of STAGE1_COLLECTION_ORDER){
   assert.ok(stage1CategoryLabel(locale,category).length>0,locale+':'+category);
  }
 }
 assert.match(page,/data-stage1-category-grid/);
 assert.match(page,/stage1RootCategories\(runtimeIndex\)/);
 assert.match(page,/const inertProgress='— \/ —'/);
 assert.doesNotMatch(page,/DISPLAY_LIMIT|class="view-switch"|<h1>.*YOUR COLLECTION|source-badge|boundary-grid/);
 assert.doesNotMatch(page,/setDreamsnapOfficialResultPublication|createPublicWork|saveEditedCopy|POST/);
 assert.match(page,/data-personal-progress="unknown" data-writer="off"/);
 assert.match(page,/disabled title=\{ui\.unknown\}/);
 assert.match(page,/!item\.sourceAvailable/);
 assert.match(page,/data-media-rights="unverified"/);
});
test('multiple World choices use OR; Universe choices use OR; cross-facet scope AND',()=>{
 assert.deepEqual(stage1ScopeRecords(sample,{worlds:['Valley','Isle'],universes:['Disney']}).map(x=>x.itemId),[40000047,31700017]);
 assert.deepEqual(stage1ScopeRecords(sample,{worlds:['Valley'],universes:['Mickey']}).map(x=>x.itemId),[31700018]);
 assert.deepEqual(stage1ScopeRecords(sample,{category:'Furniture',query:'chair'}).map(x=>x.itemId),[40000047]);
 assert.deepEqual(stage1ScopeRecords(sample,{category:'Furniture',worlds:['MISSING']}).map(x=>x.itemId),[]);
 assert.deepEqual(stage1ScopeRecords(sample,{worlds:[],universes:[]}).map(x=>x.itemId),sample.map(x=>x.itemId));
});
test('search is category-grouped; normal category browse is universe-grouped, empty groups omitted',()=>{
 const gs=groupStage1CategoryResults([sample[2],sample[0],sample[3]]);
 assert.deepEqual(gs.map(x=>x.id),['Furniture','Fish']);
 assert.deepEqual(gs.map(x=>x.items.length),[1,2]);
 assert.deepEqual(groupStage1CategoryResults([entry(9,'UnprovenNew',[],[])]),[]);
 const ug=groupStage1UniverseResults(sample.filter(x=>x.family==='Furniture'),'en');
 assert.deepEqual(ug.map(x=>x.id),['Disney','Mickey']);
 assert.match(page,/data-stage1-search-groups/);
 assert.match(page,/data-stage1-category-browse/);
 assert.match(page,/data-stage1-item-info/);
 assert.match(page,/sharedEntityHref\(base,\$locale,info\.itemId\)/);
 assert.match(page,/aria-expanded=\{filterOpen\}/);
 assert.match(page,/aria-pressed=\{selectedWorlds\.includes\(id\)\}/);
 assert.match(page,/aria-pressed=\{selectedUniverses\.includes\(id\)\}/);
 assert.match(page,/@media\(max-width:540px\)/);
});

test('COL-UX-29 focus and scroll restoration has a live-card, context and source guard',()=>{
 assert.match(page,/await tick\(\)/);
 assert.match(page,/origin\.context!==infoContext\(\)/);
 assert.match(page,/!origin\.trigger\.isConnected/);
 assert.match(page,/!scoped\.some\(\(item:any\)=>item\.itemId===origin\.itemId\)/);
 assert.match(page,/infoId!==null\|\|infoReturn!==null/);
 assert.match(page,/focus\(\{preventScroll:true\}\)/);
 assert.match(page,/window\.scrollTo\(origin\.x,origin\.y\)/);
 assert.equal((page.match(/data-stage1-item-id=\{item\.itemId\}/g)||[]).length,2);
 assert.match(page,/data-stage1-info-close on:click=\{closeInfo\}/);
 assert.doesNotMatch(page,/localStorage\.setItem|saveEditedCopy|fetch\([^)]*POST/);
});

test('COL-UX-44 mobile drawer preserves desktop inline facets, UNKNOWN personal state and source scoping',()=>{
 assert.match(page,/window\.matchMedia\('\(max-width: 820px\)'\)/);
 assert.match(page,/aria-haspopup=\{mobileFilter \? 'dialog' : undefined\}/);
 assert.match(page,/role=\{mobileFilter \? 'dialog' : undefined\}/);
 assert.match(page,/aria-modal=\{mobileFilter \? 'true' : undefined\}/);
 assert.match(page,/data-stage1-filter-close/);
 assert.match(page,/data-stage1-filter-backdrop/);
 assert.match(page,/event\.key==='Escape'/);
 assert.match(page,/event\.key!=='Tab'/);
 assert.match(page,/filterToggleButton\?\.focus\(\{preventScroll:true\}\)/);
 assert.match(page,/previousBodyOverflow=document\.body\.style\.overflow/);
 assert.match(page,/document\.body\.style\.overflow=previousBodyOverflow/);
 assert.match(page,/media\.removeEventListener\('change',onMediaChange\)/);
 assert.match(page,/@media\(max-width:820px\)/);
 assert.match(page,/max-height:85dvh/);
 assert.match(page,/overscroll-behavior:contain/);
 assert.match(page,/aria-pressed=\{selectedWorlds\.includes\(id\)\}/);
 assert.match(page,/aria-pressed=\{selectedUniverses\.includes\(id\)\}/);
 assert.match(page,/disabled title=\{ui\.unknown\}/);
 assert.doesNotMatch(page,/saveEditedCopy|setDreamsnapOfficialResultPublication|createPublicWork/);
});
