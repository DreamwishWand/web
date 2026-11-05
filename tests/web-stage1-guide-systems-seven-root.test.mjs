import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  GUIDE_SYSTEMS_TAXONOMY_VERSION, GUIDE_SYSTEMS_SOURCE, GUIDE_SYSTEMS_CATEGORIES,
  GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED, guideSystemsCategoryLabel,
  filterGuideSystemsCategories, findGuideSystemsCategory
} from '../src/lib/guide/systems-stage1-taxonomy.mjs';
const ui=readFileSync(new URL('../src/routes/guide/systems/+page.svelte',import.meta.url),'utf8');
const ids=['basics','exploration','villagers','gathering','inventory','decorating','activities'];

test('seven owner taxonomy categories, exact 106 unique primary source mechanic keys',()=>{
 assert.equal(GUIDE_SYSTEMS_TAXONOMY_VERSION,'wand.guide.systems.stage1@1');
 assert.deepEqual(GUIDE_SYSTEMS_SOURCE,{platform:'Nintendo Switch',gameVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624});
 assert.deepEqual(GUIDE_SYSTEMS_CATEGORIES.map(c=>c.id),ids);
 assert.deepEqual(GUIDE_SYSTEMS_CATEGORIES.map(c=>c.expected),[16,13,13,21,17,14,12]);
 assert.deepEqual(GUIDE_SYSTEMS_CATEGORIES.map(c=>c.subgroups.length),[3,3,3,4,3,3,2]);
 const all=GUIDE_SYSTEMS_CATEGORIES.flatMap(c=>c.subgroups.flatMap(g=>g.mechanicKeys));
 assert.equal(all.length,106);
 assert.equal(new Set(all).size,106);
 for(const cat of GUIDE_SYSTEMS_CATEGORIES){
  assert.equal(cat.subgroups.reduce((n,g)=>n+g.mechanicKeys.length,0),cat.expected);
  assert.ok(Object.isFrozen(cat));
  for(const g of cat.subgroups){
   assert.equal(g.expected,g.mechanicKeys.length);
   assert.ok(Object.isFrozen(g.mechanicKeys));
  }
 }
});

test('product cross-domain assignment preserved, no guessing Native/version rules',()=>{
 const byKey=new Map(GUIDE_SYSTEMS_CATEGORIES.flatMap(c=>c.subgroups.flatMap(g=>g.mechanicKeys.map(k=>[k,c.id]))));
 for(const [key,id] of [['cloud_cross_save','basics'],['premium_dlc_entitlements','basics'],
 ['expansion_adventure_access','exploration'],['timebending','gathering'],
 ['snippets_lorekeeper','inventory'],['roads_fences','decorating'],
 ['dreamsnaps','activities'],['dreamsnaps_voting','activities']]){
  assert.equal(byKey.get(key),id,key);
 }
 assert.equal(byKey.has('unknown_native_key'),false);
});

test('eight locales and source-gated query, no positive public guide inference',()=>{
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const labels=ids.map(id=>guideSystemsCategoryLabel(id,lang));
  assert.equal(new Set(labels).size,7);
  assert.ok(labels.every(x=>typeof x==='string'&&x.length>2));
 }
 assert.equal(guideSystemsCategoryLabel('basics','ja'),'基本・進行・設定');
 assert.equal(guideSystemsCategoryLabel('activities','en'),'Photography, Social & Activities');
 assert.equal(guideSystemsCategoryLabel('bad','en'),null);
 assert.equal(findGuideSystemsCategory('bad'),null);
 assert.equal(GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED,false);
 assert.deepEqual(filterGuideSystemsCategories().map(x=>x.id),ids);
 assert.deepEqual(filterGuideSystemsCategories('Timebending').map(x=>x.id),['gathering']);
 assert.deepEqual(filterGuideSystemsCategories('クラフト','ja').map(x=>x.id),['gathering']);
 assert.deepEqual(filterGuideSystemsCategories('DLC').map(x=>x.id),['basics','exploration']);
 assert.deepEqual(filterGuideSystemsCategories('no-such-source-000').map(x=>x.id),[]);
});

test('read-only Systems UI never promotes 106 candidates to published pages',()=>{
 for(const snippet of ['data-guide-systems-seven','data-systems-category-grid',
 'data-systems-subgroups','name="robots" content="noindex,nofollow"',
 'data-guide-rights="unverified" data-published-articles="off" data-writer="off"',
 '!GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED','@media(max-width:590px)','@media(max-width:360px)',
 '.systems-category-card:focus-visible']){
  assert.ok(ui.includes(snippet),snippet);
 }
 for(const unsafe of ['<img','<video','fetch(','onMount(','publishWork','saveEditedCopy','cloudUpload']){
  assert.equal(ui.includes(unsafe),false,unsafe);
 }
 assert.equal(ui.includes('group.mechanicKeys'),false);
});
