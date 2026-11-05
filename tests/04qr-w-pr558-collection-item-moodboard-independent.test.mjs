import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const MAIN='e40075c48f025fc640160615c70fc962dd1f5617';
const SOURCE='10d375adeb87fa7eb3d354d77e4324b5eb0a919e';
const PATH='scripts/web-shared-catalog-e2e-chrome.mjs';
const QA=[
 '.github/workflows/04qr-w-pr558-collection-item-moodboard-independent.yml',
 'scripts/04qr-w-pr558-item-collection-moodboard-chromium.mjs',
 'tests/04qr-w-pr558-collection-item-moodboard-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const prior=git('show',MAIN+':'+PATH);
const repaired=git('show',SOURCE+':'+PATH);
test('PR558 exactly one Source script and QA-only three files with frozen blobs',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n'),[PATH]);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),QA);
 assert.equal(git('rev-parse',MAIN+':'+PATH),'b845abe00d8f9842f50b543b410160a7e809c674');
 assert.equal(git('rev-parse',SOURCE+':'+PATH),'584e13cc7b7ad1fd4651aff940266c0c62761167');
 assert.equal(readFileSync(PATH,'utf8').trimEnd(),repaired.trimEnd(),'test Source unchanged (ignore trailing newline)');
});
test('two Desktop/320 stale Collection navigation blocks replaced, all other E2E behavior byte-identical',()=>{
 const oldDesktop=[
 " await page.locator('.collection-grid .collection-card').first().waitFor({timeout:35000});",
 " await page.locator('.collection-controls input[type=\"search\"]').fill(ITEM);",
 " await page.waitForFunction(()=>document.querySelectorAll('.collection-card').length===1,{timeout:20000});",
 " assert.match(await page.locator('.collection-card').first().innerText(),new RegExp(ITEM));",
 " await page.locator('.collection-card h2 a').click();"
 ].join('\n');
 const newDesktop=[
 " await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:35000});",
 " assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-personal-progress'),'unknown');",
 " assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-writer'),'off');",
 " await page.locator('[data-stage1-search]').fill(ITEM);",
 " await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:20000});",
 " assert.equal(await page.locator('[data-stage1-search-groups] .item-card').count(),1);",
 " await page.locator('[data-stage1-search-groups] .item-card').first().click();",
 " await page.locator('[data-stage1-item-info]').waitFor({timeout:20000});",
 " assert.match(await page.locator('[data-stage1-item-info]').innerText(),new RegExp(ITEM));",
 " await page.locator('[data-stage1-item-info] .info-actions a').click();"
 ].join('\n');
 const oldMobile=[
 " await page.locator('.collection-grid .collection-card').first().waitFor({timeout:35000});",
 " await page.locator('.collection-controls input[type=\"search\"]').fill(ITEM);",
 " await page.locator('.collection-card h2 a').first().click();"
 ].join('\n');
 const newMobile=[
 " await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:35000});",
 " await page.locator('[data-stage1-search]').fill(ITEM);",
 " await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:20000});",
 " await page.locator('[data-stage1-search-groups] .item-card').first().click();",
 " await page.locator('[data-stage1-item-info] .info-actions a').click();"
 ].join('\n');
 assert.ok(prior.includes(oldDesktop),'old exact Desktop found');
 assert.ok(prior.includes(oldMobile),'old exact Mobile found');
 assert.ok(repaired.includes(newDesktop),'new Desktop includes exact source ID and UNKNOWN OFF');
 assert.ok(repaired.includes(newMobile),'new Mobile honors item-info selection');
 assert.equal(prior.replace(oldDesktop,newDesktop).replace(oldMobile,newMobile),repaired,
  'outside ONLY two navigation snippets, not one existing important negative or feature test may change');
});
test('real E2E retained verified Item identity/version, typed Moodboard persist, legacy negative/version/HTTP404',()=>{
 for(const exact of [
  "const ITEM='40000047'","/52BD625D9B4E0053/",
  "LOCAL_MOODBOARD_CREATED_WITHOUT_ACCOUNT",
  "COLLECTION_ITEM_VERIFIED_ID_VERSION_RELATED_LINKS",
  "DETAIL_TYPED_ITEM_MOODBOARD_SAVE_AND_RELOAD",
  "EXPLORE_TO_SAME_TYPED_ITEM_DETAIL",
  "EDITOR_ITEMS_VERIFIED_CATALOG_NOT_TWELVE_FAKE_OWNED",
  "ALL_EIGHT_ACTUAL_BROWSER_DETAIL_LOCALES_NOINDEX",
  "FORGED_SOURCE_VERSION_DENIED_IN_REAL_BROWSER",
  "MOBILE_320_ZOOM200_KEYBOARD_NO_OVERFLOW",
  "DIRECT_STATIC_FALLBACK_HTTP404_NOT_SEO_HTTP200",
  "NO_PRIVATE_NETWORK_AND_NO_PAGE_EXCEPTIONS",
  "assert.deepEqual(network,[]", "assert.deepEqual(errors,[]",
  "index.t.gameVersion='1.25.3'", "assert.equal(response.status,404)",
  "await page.reload", "'data-owned'","'unknown'", "'data-writer'","'off'"
 ])assert.ok(repaired.includes(exact),'E2E gate must remain '+exact);
 assert.equal((repaired.match(/\[data-stage1-search\]/g)||[]).length,2,'both desktop and 320 target current Stage1 search');
 assert.doesNotMatch(repaired,/\.collection-grid|\.collection-controls|\.collection-card/);
 assert.doesNotMatch(repaired,/skip\(|test\.skip|if\s*\(false\)|continue-on-error|window\.localStorage\.clear\(/);
});
test('safety: full browse source does not write private P1G, enable Writer or infer real Native Owned',()=>{
 const collection=readFileSync('src/routes/collection/+page.svelte','utf8');
 for(const a of ['data-stage1-category-grid','data-stage1-search','data-stage1-search-groups','data-stage1-item-info'])
  assert.ok(collection.includes(a),'actual current main 29 category UI includes '+a);
 assert.match(collection,/data-personal-progress="unknown"/);
 assert.match(collection,/data-writer="off"/);
 assert.ok(repaired.includes("const ITEM='40000047'"));
 assert.doesNotMatch(repaired,/WEP_PRIVATE_P1G_PATH\s*=|WEP_PRIVATE_LOCAL_ONLY_ACK\s*=|productApplyAuthorized:true|persistentWriterAuthorized:true|uploadPrivateSave/);
});
