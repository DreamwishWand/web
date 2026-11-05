import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUIDE_ROOT_SECTIONS, GUIDE_SYSTEM_CATEGORIES, GUIDE_SYSTEM_EVIDENCE_KEYS, GUIDE_SYSTEM_TARGET, assertGuideSystemsTaxonomy, searchGuideSystemCategories, guideTaxonomyLabel } from '../src/lib/guide/stage1-systems-taxonomy.mjs';
import { guideStage1Ui } from '../src/lib/guide/stage1-guide-ui.mjs';

const route = readFileSync(new URL('../src/routes/guide/+page.svelte', import.meta.url),'utf8');
const localeCodes = ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'];

test('OWNER FINAL 06C: four Guide root entries, Issues belongs to Help Center', () => {
  assert.deepEqual(GUIDE_ROOT_SECTIONS, ['systems','quests','starPaths','events']);
  assert.equal(new Set(GUIDE_ROOT_SECTIONS).size, 4);
  assert.match(route, /data-guide-four-root/);
  assert.match(route, /data-guide-root=\{entry.id\}/);
  assert.doesNotMatch(route, /'issues'|'Issues'|"Issues"|guideIssueView|issueView|section==='issues'/);
  assert.match(route, /base \+ '\/help\/'/);
  assert.doesNotMatch(route, /LIMIT\s*=\s*160|slice\(0,\s*160\)|duties\.slice\(0,\s*80\)/);
});

test('OWNER approved Systems7 / 21 subgroups / 106 unique candidate keys remain internal', () => {
  assert.equal(assertGuideSystemsTaxonomy(), true);
  assert.equal(GUIDE_SYSTEM_CATEGORIES.length, 7);
  assert.equal(GUIDE_SYSTEM_EVIDENCE_KEYS.length, 106);
  assert.equal(new Set(GUIDE_SYSTEM_EVIDENCE_KEYS).size, 106);
  assert.equal(GUIDE_SYSTEM_CATEGORIES.flatMap(c=>c.groups).length, 21);
  assert.deepEqual(GUIDE_SYSTEM_CATEGORIES.map(c=>[c.id,c.candidateCount]),[
    ['basics',16],['exploration',13],['villagers',13],['gathering',21],
    ['inventory',17],['decorating',14],['activities',12]
  ]);
  assert.deepEqual(GUIDE_SYSTEM_CATEGORIES.map(c=>c.groups.length),[3,3,3,4,3,3,2]);
  for(const key of ['cloud_cross_save','premium_dlc_entitlements','timebending','native_decoration_presets','roads_fences','dreamsnaps_voting','snippets_lorekeeper']) {
    assert.equal(GUIDE_SYSTEM_EVIDENCE_KEYS.filter(x=>x===key).length,1,key);
  }
  assert.deepEqual(GUIDE_SYSTEM_TARGET,{
    platform:'Nintendo Switch',version:'1.25.0',bid:'52BD625D9B4E0053',schema:624,publicArticlesApproved:0
  });
});

test('Systems query supports category/subgroup/JA+EN/internal alias without claiming public article', () => {
  assert.deepEqual(searchGuideSystemCategories('').map(x=>x.id),GUIDE_SYSTEM_CATEGORIES.map(x=>x.id));
  assert.deepEqual(searchGuideSystemCategories('timebending').map(x=>x.id),['gathering']);
  assert.deepEqual(searchGuideSystemCategories('スニペット').map(x=>x.id),[]); // no undocumented alias inference
  assert.deepEqual(searchGuideSystemCategories('設定').map(x=>x.id),['basics']);
  assert.deepEqual(searchGuideSystemCategories('DreamSnaps').map(x=>x.id),['activities']);
  assert.equal(searchGuideSystemCategories('nonexisting_dlc___').length,0);
  assert.equal(guideTaxonomyLabel(GUIDE_SYSTEM_CATEGORIES[0],'ja'),'基本・進行・設定');
  assert.equal(guideTaxonomyLabel(GUIDE_SYSTEM_CATEGORIES[0],'fr'),'Basics, Progression & Settings');
  assert.match(route,/data-guide-systems-seven/);
  assert.match(route,/data-guide-subgroup=\{group.id\}/);
  assert.match(route,/ui.noPublished/);
  assert.doesNotMatch(route,/group\.keys\}/); // keys must not be rendered as published pages
});

test('eight locale UI with explicit EN taxonomy fallback; no unapproved Guide content authority', () => {
  for(const loc of localeCodes) {
    const ui=guideStage1Ui(loc);
    for(const key of ['browse','back','systemsInfo','questsInfo','starPathsInfo','eventsInfo','scope','topicSearch','groupOnly','referenceOnly','englishFallback','noPublished']) {
      assert.equal(typeof ui[key],'string');
      assert.ok(ui[key].trim().length >= 2,loc+' '+key);
    }
  }
  assert.match(route,/<meta name="robots" content="noindex,nofollow"/);
  assert.match(route,/ui\.referenceOnly/);
  assert.doesNotMatch(route,/copy\.available|selected\.status|selected\.accessibility|selected\.availability/);
  assert.match(route,/PAGE_SIZE = 40/);
  assert.match(route,/shown \+= PAGE_SIZE/); // no record truncation
  assert.match(route,/if \(!next \|\| next === 'systems' \|\| runtime \|\| loading\) return/);
  assert.doesNotMatch(route,/dispatchShellIntent|localStorage|upload|autoCloud|writerCommit/);
});
