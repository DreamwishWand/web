/** 04QR-W independent NEW-ONLY Stage1 Collection PR519 repaired locale source.
 * Source is verified static 624 catalog; no private save/profile/rights or Writer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 STAGE1_COLLECTION_ORDER,stage1RootCategories,stage1CollectionCopy,
 stage1CategoryLabel,stage1ScopeRecords,groupStage1CategoryResults
} from '../src/lib/collection/stage1-root.mjs';
const MAIN='342823eb03eff6bb7c5d80f4a804249bb174df10',SOURCE='caaf6d35abdc7af8a353c017e0dc9c28b7aa96d8';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const source=[
 '.github/workflows/web-stage1-collection-ux.yml',
 'scripts/web-stage1-collection-chrome.mjs',
 'src/lib/collection/stage1-root.mjs',
 'src/routes/collection/+page.svelte',
 'tests/product-surface-routes.test.mjs',
 'tests/web-stage1-collection-root.test.mjs'
],qa=[
 '.github/workflows/04qr-w-pr519-collection-visual-independent.yml',
 'scripts/04qr-w-pr519-collection-visual-chromium.mjs',
 'tests/04qr-w-pr519-collection-visual-independent.test.mjs'
];
const page=readFileSync('src/routes/collection/+page.svelte','utf8');
const record=(id,family,worlds,universes,label)=>({itemId:id,family,worlds,universes,label,searchText:label.toLowerCase(),stateClass:'TRACKED'});
test('fixed exact six Owner source files on main342 with new locale repair; zero other mutations',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),source);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 assert.equal(git('hash-object','src/routes/collection/+page.svelte'),'413c539a6a06be50acf81d278c7ccd74182983cb');
 assert.equal(git('hash-object','src/lib/collection/stage1-root.mjs'),'df382afcab269cf8b77bf83d859f688e92ef00fe');
 assert.equal(git('hash-object','scripts/web-stage1-collection-chrome.mjs'),'5af5e4721b819198bea5f0deb3e4627545f60a17');
});
test('locale repair references observable $locale in Svelte template for every category and facet',()=>{
 assert.match(page,/label\(item\.id,\$locale\)/);
 assert.match(page,/worldLabel\(id,\$locale\)/);
 assert.match(page,/universeLabel\(id,\$locale\)/);
 assert.doesNotMatch(page,/function label\(id:string\):/);
 assert.doesNotMatch(page,/function worldLabel\(id:string\):/);
 for(const l of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  for(const k of STAGE1_COLLECTION_ORDER)assert.ok(stage1CategoryLabel(l,k).length>0,l+':'+k);
  assert.ok(stage1CollectionCopy(l).unknown,l);
 }
 assert.notEqual(stage1CategoryLabel('fr','Furniture'),stage1CategoryLabel('en','Furniture'));
 assert.notEqual(stage1CategoryLabel('ja','Memories'),stage1CategoryLabel('en','Memories'));
});
test('all twenty-nine category states deny invented 0% or progress from catalog cardinality',()=>{
 const index={f:['Furniture','Fish','UnknownFuture']},cats=stage1RootCategories(index);
 assert.equal(cats.length,29);
 for(const c of cats){
  assert.equal(c.progress,null);
  assert.equal(c.denominator,null);
  assert.equal(c.percentage,null);
  assert.equal(c.imageRightsAccepted,false);
 }
 assert.equal(cats.find(c=>c.id==='Quest Puzzles').sourceAvailable,false);
 assert.equal(cats.some(c=>c.id==='UnknownFuture'),false);
 assert.match(page,/data-personal-progress="unknown" data-writer="off" data-media-rights="unverified"/);
 assert.match(page, /const inertProgress='— \/ —'/);
 assert.doesNotMatch(page,/Owned\/Total|0\/12552|100% Owned|uploadPrivateSave/);
});
test('source-only facet combinations cannot turn missing or noncanonical catalog families into personal Owned',()=>{
 const records=[
  record(3,'Furniture',['Valley'],['Disney'],'Blue Chair'),
  record(4,'Furniture',['Isle'],['Mickey'],'Purple Table'),
  record(5,'Fish',['Valley'],['Mickey'],'Blue Fish'),
  record(6,'UnknownFuture',['Valley'],['Disney'],'Unverified')
 ];
 assert.deepEqual(stage1ScopeRecords(records,{worlds:['Valley','Isle'],universes:['Mickey']}).map(x=>x.itemId),[4,5]);
 assert.deepEqual(stage1ScopeRecords(records,{worlds:['Valley'],universes:['Disney']}).map(x=>x.itemId),[3,6]);
 assert.deepEqual(stage1ScopeRecords(records,{query:'Blue',worlds:['Valley']}).map(x=>x.itemId),[3,5]);
 const groups=groupStage1CategoryResults(records);
 assert.deepEqual(groups.map(g=>g.id),['Furniture','Fish']);
 assert.equal(groups.some(g=>g.id==='UnknownFuture'),false);
 assert.match(page,/disabled title=\{ui\.unknown\}/);
});
