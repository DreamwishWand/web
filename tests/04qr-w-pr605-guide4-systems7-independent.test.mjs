// 04 QR-W exact Guide Source 952 on main35; original a3db/main d7 ancestry is independently pinned.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {GUIDE_ROOT_SECTIONS,GUIDE_SYSTEM_CATEGORIES,GUIDE_SYSTEM_EVIDENCE_KEYS,GUIDE_SYSTEM_TARGET,searchGuideSystemCategories,assertGuideSystemsTaxonomy,guideTaxonomyLabel} from '../src/lib/guide/stage1-systems-taxonomy.mjs';
import {guideStage1Ui} from '../src/lib/guide/stage1-guide-ui.mjs';
const BASE='d7d9a76e1b4d2d17135d92c7a4a1e0ff35b59b22';
const LATEST='35d98696c7e989737621654c7b8031914dadfa6d';
const ORIGINAL='a3db13846b84b200cb8eb93743d882b727c6b339';
const SRC='95238781039b51b2604cbb7da8235cd0f10096c4';
const source=[
 'src/lib/guide/stage1-guide-ui.mjs',
 'src/lib/guide/stage1-systems-taxonomy.mjs',
 'src/routes/guide/+page.svelte',
 'tests/web-stage1-guide-four-root-systems.test.mjs'
].sort();
const latest=[
 '.github/workflows/wep-private-626-readonly-browser-20261104.yml',
 'docs/wep/private-626-world-readonly-browser-20261104.md',
 'scripts/wep-private-626-readonly-boundary-20261104.mjs',
 'scripts/wep-private-626-readonly-browser-receipt-20261104.mjs',
 'tests/wep-private-626-readonly-browser-boundary.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-pr605-guide4-systems7-real-chrome.yml',
 'scripts/04qr-w-pr605-guide4-systems7-live-chrome.mjs',
 'tests/04qr-w-pr605-guide4-systems7-independent.test.mjs'
].sort();
const pins={
 'src/lib/guide/stage1-guide-ui.mjs':'bcc135cbbd416df10995181826f27b1df08b843d',
 'src/lib/guide/stage1-systems-taxonomy.mjs':'c6b73d41d519482fbc9150d6f9ae6340c24683a6',
 'src/routes/guide/+page.svelte':'cf50043c2b5de34f604c74fdc05fddcf2ea4257d',
 'tests/web-stage1-guide-four-root-systems.test.mjs':'898c577f26cb5703fbd3d7594e84c5924567b1b4'
};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
test('only four fixed Guide Source paths, independent three QA paths; 09 INT new main35 has disjoint owner-private5',()=>{
 assert.equal(git('merge-base',BASE,ORIGINAL),BASE);
 assert.equal(git('merge-base',BASE,LATEST),BASE);
 assert.equal(git('merge-base',LATEST,SRC),LATEST,'recomposed source must descend from protected main35');
 assert.deepEqual(git('diff','--name-only',BASE,ORIGINAL).split('\n').sort(),source,'original Guide four paths');
 assert.deepEqual(git('diff','--name-only',BASE,LATEST).split('\n').sort(),latest,'inherited WEP five paths');
 assert.deepEqual(git('diff','--name-only',LATEST,SRC).split('\n').sort(),source,'latest-main Guide four paths only');
 assert.deepEqual(git('diff','--name-only',SRC,'HEAD').split('\n').sort(),qa,'QA-only three paths');
 for(const [path,sha] of Object.entries(pins)){
  assert.equal(git('rev-parse',ORIGINAL+':'+path),sha,'original '+path);
  assert.equal(git('rev-parse',SRC+':'+path),sha,'recomposed '+path);
 }
 for(const path of latest)assert.equal(git('rev-parse',LATEST+':'+path),git('rev-parse',SRC+':'+path),'WEP unchanged '+path);
 assert.equal(git('diff','--name-only',LATEST,SRC,'--','supabase/','static/','src/lib/ddv/','.github/workflows/pages.yml'),'');
});
test('final approved Guide root 4, ordered Systems7/21/106 taxonomy only and no fake public article',()=>{
 assert.deepEqual(GUIDE_ROOT_SECTIONS,['systems','quests','starPaths','events']);
 assert.equal(assertGuideSystemsTaxonomy(),true);
 assert.equal(GUIDE_SYSTEM_CATEGORIES.length,7);
 assert.equal(GUIDE_SYSTEM_CATEGORIES.reduce((n,c)=>n+c.groups.length,0),21);
 assert.equal(GUIDE_SYSTEM_EVIDENCE_KEYS.length,106);
 assert.equal(new Set(GUIDE_SYSTEM_EVIDENCE_KEYS).size,106);
 assert.equal(GUIDE_SYSTEM_TARGET.publicArticlesApproved,0);
 assert.equal(GUIDE_SYSTEM_TARGET.schema,624);
 assert.equal(GUIDE_SYSTEM_TARGET.bid,'52BD625D9B4E0053');
 const ids=GUIDE_SYSTEM_CATEGORIES.map(c=>c.id);
 assert.deepEqual(ids,['basics','exploration','villagers','gathering','inventory','decorating','activities']);
 assert.deepEqual(searchGuideSystemCategories('timebending').map(c=>c.id),['gathering']);
 assert.deepEqual(searchGuideSystemCategories('DreamSnaps').map(c=>c.id),['activities']);
 assert.deepEqual(searchGuideSystemCategories('unknown-no-public-article').map(c=>c.id),[]);
 assert.equal(guideTaxonomyLabel(GUIDE_SYSTEM_CATEGORIES[0],'fr'),GUIDE_SYSTEM_CATEGORIES[0].en);
});
test('all 8 UI languages preserve owner 4 root and Rights/noindex default',()=>{
 const route=readFileSync('src/routes/guide/+page.svelte','utf8');
 for(const loc of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  const copy=guideStage1Ui(loc);
  for(const k of ['browse','back','groupOnly','noPublished','referenceOnly','englishFallback','systemsInfo','questsInfo','starPathsInfo','eventsInfo'])assert.ok(copy[k]?.trim().length>=2,loc+'/'+k);
 }
 assert.match(route,/data-guide-four-root/);
 assert.match(route,/data-guide-systems-seven/);
 assert.match(route,/data-guide-subgroup=\{group.id\}/);
 assert.match(route,/<meta name="robots" content="noindex,nofollow"/);
 assert.match(route,/base \+ '\/help\/'/);
 assert.doesNotMatch(route,/guideIssueView|section==='issues'|LIMIT\s*=\s*160|copy\.available|dispatchShellIntent|writerCommit|cloudUpload/);
 assert.match(route,/PAGE_SIZE = 40/);
 assert.match(route,/shown \+= PAGE_SIZE/);
 const w=readFileSync('.github/workflows/04qr-w-pr605-guide4-systems7-real-chrome.yml','utf8');
 assert.match(w,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(w,/node --test tests\/04qr-w-pr605-guide4-systems7-independent.test.mjs/);
 assert.match(w,/playwright-core@1\.55\.0/);
 assert.doesNotMatch(w,/secrets\.|pull_request_target|workflow_dispatch|deploy-pages|git push/);
});