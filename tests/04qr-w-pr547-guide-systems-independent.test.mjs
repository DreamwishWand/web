/** 04 QR-W independent, new-only Guide Systems Stage1 P0.
 * Owner canonical 7/21/106 categories, but no published Guides or Native Writer.
 * Source HEAD fixed; ancestor Guide four-card QA536 is reused, never replayed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 GUIDE_SYSTEMS_TAXONOMY_VERSION,GUIDE_SYSTEMS_SOURCE,
 GUIDE_SYSTEMS_CATEGORIES,GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED,
 guideSystemsCategoryLabel,filterGuideSystemsCategories,findGuideSystemsCategory
} from '../src/lib/guide/systems-stage1-taxonomy.mjs';
const MAIN='87f656833491b87712eee031f51ca135bda26b30';
const SOURCE='b04f7b6e6eb119e93eae12aaa7285fb2a98604df';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const source=[
 '.github/workflows/web-stage1-guide-systems.yml',
 'scripts/web-stage1-guide-systems-chrome.mjs',
 'src/lib/guide/systems-stage1-taxonomy.mjs',
 'src/routes/guide/systems/+page.svelte',
 'tests/web-stage1-guide-systems-seven-root.test.mjs'
];
const qa=[
 '.github/workflows/04qr-w-pr547-guide-systems-independent.yml',
 'scripts/04qr-w-pr547-guide-systems-chromium.mjs',
 'tests/04qr-w-pr547-guide-systems-independent.test.mjs'
];
const page=readFileSync('src/routes/guide/systems/+page.svelte','utf8');
test('exact five original Systems-only paths on main87, three independent QA-only paths, other Guide untouched',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),source);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 assert.equal(git('rev-parse',SOURCE+':src/lib/guide/systems-stage1-taxonomy.mjs'),'c872c967de6cc62b8555b4aeb7744838ed524be1');
 assert.equal(git('rev-parse',SOURCE+':src/routes/guide/systems/+page.svelte'),'ccddd4f9df8033e133d977518d7c3c61998a43c9');
 assert.equal(git('rev-parse',SOURCE+':.github/workflows/web-stage1-guide-systems.yml'),git('rev-parse',SOURCE+':.github/workflows/web-stage1-guide-systems.yml'));
 for(const original of ['src/routes/guide/+page.svelte','src/lib/guide/copy.js','src/lib/guide/runtime.js','src/routes/help/+page.svelte'])
  assert.equal(git('rev-parse',SOURCE+':'+original),git('rev-parse',MAIN+':'+original),'unchanged legacy '+original);
});
test('Owner 2026-10-24 canonical 7 categories, 21 subgroups, 106 unique source mechanics WITHOUT 106 pages',()=>{
 const ids=['basics','exploration','villagers','gathering','inventory','decorating','activities'];
 assert.equal(GUIDE_SYSTEMS_TAXONOMY_VERSION,'wand.guide.systems.stage1@1');
 assert.deepEqual(GUIDE_SYSTEMS_SOURCE,{platform:'Nintendo Switch',gameVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624});
 assert.deepEqual(GUIDE_SYSTEMS_CATEGORIES.map(c=>c.id),ids);
 assert.deepEqual(GUIDE_SYSTEMS_CATEGORIES.map(c=>c.expected),[16,13,13,21,17,14,12]);
 assert.deepEqual(GUIDE_SYSTEMS_CATEGORIES.map(c=>c.subgroups.length),[3,3,3,4,3,3,2]);
 assert.equal(GUIDE_SYSTEMS_CATEGORIES.reduce((n,c)=>n+c.subgroups.length,0),21);
 const flattened=GUIDE_SYSTEMS_CATEGORIES.flatMap(c=>c.subgroups.flatMap(g=>g.mechanicKeys));
 assert.equal(flattened.length,106);
 assert.equal(new Set(flattened).size,106);
 assert.ok(flattened.every(x=>/^[a-z][a-z0-9_]*$/.test(x)));
 for(const cat of GUIDE_SYSTEMS_CATEGORIES){
  assert.equal(cat.subgroups.reduce((n,g)=>n+g.mechanicKeys.length,0),cat.expected);
  assert.ok(cat.subgroups.every(g=>g.expected===g.mechanicKeys.length&&!!g.ja&&!!g.en));
  assert.ok(Object.isFrozen(cat));
 }
 assert.equal(GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED,false);
 assert.doesNotMatch(page,/group\.mechanicKeys|href=\{base\+'\/guide\/systems\/mechanic|<a[^>]*data-systems-group/);
});
test('adversarial cross-domain source identity and ambiguous aliases never infer player entitlement, version626, or public Works',()=>{
 const targetFor=k=>GUIDE_SYSTEMS_CATEGORIES.filter(c=>c.subgroups.some(g=>g.mechanicKeys.includes(k))).map(c=>c.id);
 const bindings={
  cloud_cross_save:'basics',premium_dlc_entitlements:'basics',
  expansion_adventure_access:'exploration',timebending:'gathering',
  snippets_lorekeeper:'inventory',roads_fences:'decorating',
  native_decoration_presets:'decorating',dreamsnaps:'activities',dreamsnaps_voting:'activities'
 };
 for(const [key,expected] of Object.entries(bindings))assert.deepEqual(targetFor(key),[expected],key);
 for(const k of ['unknown_native_626','__proto__','MoonstonePurchaseReceipt','real_save_ownership'])assert.deepEqual(targetFor(k),[]);
 assert.deepEqual(filterGuideSystemsCategories(' DLC ').map(c=>c.id),['basics','exploration']);
 assert.deepEqual(filterGuideSystemsCategories('cloud_cross_save').map(c=>c.id),['basics']);
 assert.deepEqual(filterGuideSystemsCategories('DLC world entry').map(c=>c.id),['exploration']);
 assert.deepEqual(filterGuideSystemsCategories('Roads').map(c=>c.id),['decorating']);
 assert.deepEqual(filterGuideSystemsCategories('DreamSnaps').map(c=>c.id),['activities']);
 assert.deepEqual(filterGuideSystemsCategories('<img src=x onerror=alert(1)>').map(c=>c.id),[]);
 assert.deepEqual(filterGuideSystemsCategories('NO_CORRESPONDING_SOURCE_MECHANIC').map(c=>c.id),[]);
 assert.equal(findGuideSystemsCategory('__proto__'),null);
 assert.equal(findGuideSystemsCategory(''),null);
 assert.equal(guideSystemsCategoryLabel('__proto__','ja'),null);
});
test('8-locale categories and genuinely honest JA vs EN subgroup fallback and rights/SEO fail-closed',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const l of locales){
  const labels=GUIDE_SYSTEMS_CATEGORIES.map(c=>guideSystemsCategoryLabel(c.id,l));
  assert.equal(labels.length,7);
  assert.equal(new Set(labels).size,7);
  assert.ok(labels.every(x=>typeof x==='string'&&x.trim().length>=3),l);
 }
 assert.equal(guideSystemsCategoryLabel('basics','ja'),'基本・進行・設定');
 assert.equal(guideSystemsCategoryLabel('activities','en'),'Photography, Social & Activities');
 assert.equal(guideSystemsCategoryLabel('basics','unknown'),guideSystemsCategoryLabel('basics','en'),'unknown locale falls back EN, not guessed');
 for(const part of [
  'name="robots" content="noindex,nofollow"',
  'data-guide-rights="unverified" data-published-articles="off" data-writer="off"',
  'data-accepted-source-version={GUIDE_SYSTEMS_SOURCE.gameVersion}',
  "group.ja:group.en",
  "locale!=='ja' && $locale!=='en'",
  '!GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED',
  "on:click={back}"
 ])assert.ok(page.includes(part),part);
 for(const unsafe of ['<img','<video','onMount(','fetch(','publishWork','saveEditedCopy','uploadPrivateSave','premium_entitlement_write','remote_provider_search']){
  assert.equal(page.includes(unsafe),false,unsafe);
 }
 assert.equal(page.includes('schema626'),false,'schema626 not inferred from 624 catalog');
});
