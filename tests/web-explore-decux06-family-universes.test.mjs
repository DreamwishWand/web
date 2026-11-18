import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decorationFamilyUniverses,reconcileDecorationUniverse} from '../src/lib/explore/family-universe-facets.mjs';
import {EXPLORE_COPY} from '../src/lib/explore/copy.js';
const ui=readFileSync(new URL('../src/routes/explore/+page.svelte',import.meta.url),'utf8');

const records=[
 {itemId:1,family:'Furniture',universes:['Tangled','Mickey & Friends']},
 {itemId:2,family:'Furniture',universes:['Tangled']},
 {itemId:3,family:'Buildings',universes:['Frozen']},
 {itemId:4,family:'Clothing',universes:['Neverland']},
 {itemId:5,family:'Roads & Fences',universes:[]},
 {itemId:6,family:'Furniture',universes:[null,0,'']},
 {itemId:7,family:'Furniture',universes:'unverified text'},
 null
];

test('DEC-UX-06: verified decorating family drives Universe options without introducing catalog-wide and non-decoration noise',()=>{
 const decorations=records.filter(x=>x&&['Furniture','Buildings','Roads & Fences'].includes(x.family));
 assert.deepEqual(decorationFamilyUniverses(decorations,'Furniture'),['Tangled','Mickey & Friends']);
 assert.deepEqual(decorationFamilyUniverses(decorations,'Buildings'),['Frozen']);
 assert.deepEqual(decorationFamilyUniverses(decorations,'Roads & Fences'),[]);
 assert.deepEqual(decorationFamilyUniverses(decorations,''),['Tangled','Mickey & Friends','Frozen']);
 assert.deepEqual(decorationFamilyUniverses(null,'Furniture'),[]);
 assert.ok(!decorationFamilyUniverses(decorations,'Furniture').includes('Neverland'),'Collection-only family never appears');
 assert.ok(!decorationFamilyUniverses(decorations,'Furniture').includes('unverified text'),'never synthesize from malformed data');
});

test('DEC-UX-06: family switching clears stale incompatible Universe; compatible selection persists',()=>{
 const furniture=decorationFamilyUniverses(records,'Furniture');
 const buildings=decorationFamilyUniverses(records,'Buildings');
 assert.equal(reconcileDecorationUniverse('Tangled',furniture),'Tangled');
 assert.equal(reconcileDecorationUniverse('Tangled',buildings),'');
 assert.equal(reconcileDecorationUniverse('Frozen',buildings),'Frozen');
 assert.equal(reconcileDecorationUniverse('Neverland',furniture),'');
 assert.equal(reconcileDecorationUniverse(null,buildings),'');
 assert.equal(reconcileDecorationUniverse('',buildings),'');
 assert.equal(reconcileDecorationUniverse('Frozen',null),'');
});

test('DEC-UX-06: Svelte uses verified decorationRecords per selected family before current query/family/universe filter',()=>{
 assert.match(ui,/\$: decorationRecords=allRecords\.filter\(\(record\)=>DECORATION_FAMILIES\.includes\(record\.family\)\)/);
 assert.match(ui,/\$: universes=decorationFamilyUniverses\(decorationRecords,family\)/);
 assert.match(ui,/\$: if\(universe && reconcileDecorationUniverse\(universe,universes\)!==universe\) universe='';/);
 assert.doesNotMatch(ui,/\$: universes=runtimeIndex\?\.u \?\? \[\]/,'do not use globally unfiltered Universe vocabulary');
 assert.match(ui,/data-explore-family-select/);
 assert.match(ui,/data-explore-family-universe-filter/);
 assert.match(ui,/data-explore-universe-select/);
 assert.match(ui,/filterCollectionRecords\(decorationRecords,\{query,family,universe\}\)/);
 assert.match(ui,/collectionFacetLabel\(runtimeIndex,'universe',value,\$locale\)/);
 assert.match(ui,/data-explore-search-disclosure/);
 assert.match(ui,/data-explore-moodboard-toggle/);
 assert.match(ui,/data-explore-card-review/);
 assert.equal(Object.keys(EXPLORE_COPY).length,8);
 for(const [locale,copy] of Object.entries(EXPLORE_COPY))assert.ok(copy.family&&copy.universe&&copy.all,locale);
});
