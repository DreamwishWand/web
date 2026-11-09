import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOODBOARD_COPY} from '../src/lib/moodboards/copy.js';
import {EXPLORE_COPY} from '../src/lib/explore/copy.js';
import {COLLECTION_FIRST_MOODBOARD_GATE} from '../src/lib/collection/moodboard-inspire.mjs';
import {canonicalForApprovedStaticPath,inspectCustomDomainPath,OWNER_CUSTOM_DOMAIN} from '../src/lib/foundation/canonical-domain-preview.mjs';
import {ATOMIC_FIRST_BOARD_GATE} from '../src/lib/moodboards/atomic-first-board.mjs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('collection receives no new storage authority: only a verified visible ItemID link',()=>{
 const c=source('src/routes/collection/+page.svelte');
 assert.equal(c.split('<a data-collection-atomic-item-handoff').length-1,1);
 assert.match(c,/href=\{base\+'\/moodboards\/atomic\/\?item='\+encodeURIComponent\(String\(info\.itemId\)\)\}/);
 assert.match(c,/data-collection-atomic-separation/);
 assert.match(c,/moodboardCopyText\.atomicNote/);
 assert.match(c,/moodboardCopyText\.atomicLink/);
 assert.match(c,/info = scoped\.find\(\(item:any\)=>item\.itemId===infoId\)/);
 assert.doesNotMatch(c,/openAtomicFirstBoardDatabase|toggleAtomicFirstBoardItem|deleteDatabase\(|indexedDB\.open\(/);
 assert.match(c,/data-collection-moodboard-toggle/);
 assert.match(c,/toggleCollectionMoodboardInspiration/);
 assert.equal(COLLECTION_FIRST_MOODBOARD_GATE,'OFF_LEGACY_WRITER_NO_ATOMIC_CAS');
});
test('receiver fail-closed numeric canonical query + independent verified Collection runtime and explicit CAS only',()=>{
 const a=source('src/routes/moodboards/atomic/+page.svelte');
 assert.match(a,/params\.getAll\('item'\)/);
 assert.match(a,/values\.length===1&&Array\.from\(params\.keys\(\)\)\.length===1/);
 assert.match(a,/Number\.isSafeInteger\(Number\(raw\)\)/);
 assert.match(a,/String\(Number\(raw\)\)===raw/);
 assert.match(a,/loadCollectionRuntime\(base\)/);
 assert.match(a,/decodeCollectionRecord\(data\.index,row,\$locale\)/);
 assert.match(a,/row\.itemId===handoffItemId/);
 assert.match(a,/data-atomic-handoff-verified/);
 assert.match(a,/data-atomic-handoff-add/);
 assert.match(a,/handoffAlreadyStored\|\|/);
 assert.match(a,/expectedRevision:snapshot\.revision/);
 assert.match(a,/result\.action!=='added'/);
 assert.match(a,/verifiedAtomicFirstBoardReopen\(db\)/);
 assert.match(a,/data-atomic-handoff-separation/);
 assert.match(a,/copy\.atomicNote/);
 assert.match(a,/<meta name="robots" content="noindex,nofollow"/);
 // The new user-approved World Editor hint uses its already accepted distinct
 // localStorage key, NOT the legacy Moodboard primary or Backup. Forbid any
 // direct old-Store operations and all unapproved transport/storage writes.
 assert.match(a,/writeWorldEditorHandoff\(localStorage,hint\)/);
 assert.doesNotMatch(a,/(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)|MOODBOARD_STORAGE_KEY|MOODBOARD_BACKUP_KEY|fetch\(['"]https:|CloudUpload|service_role|POST/);
 assert.equal(ATOMIC_FIRST_BOARD_GATE,'ISOLATED_LOCAL_ONLY__NOT_LEGACY_MIGRATED');
 assert.equal(canonicalForApprovedStaticPath('/moodboards/atomic/',{origin:OWNER_CUSTOM_DOMAIN,basePath:''}),null);
 assert.equal(inspectCustomDomainPath('/moodboards/atomic/').eligibleForPublicIndex,false);
});
test('all 8 locales reuse preaccepted opt-in warnings and Item add labels, no new translation fork',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(MOODBOARD_COPY),locales);
 for(const locale of locales){
  assert.ok(typeof MOODBOARD_COPY[locale].atomicLink==='string'&&MOODBOARD_COPY[locale].atomicLink.length>8);
  assert.match(MOODBOARD_COPY[locale].atomicNote,/IndexedDB/);
  assert.ok(typeof EXPLORE_COPY[locale].add==='string'&&EXPLORE_COPY[locale].add.length>3);
  assert.ok(typeof EXPLORE_COPY[locale].added==='string'&&EXPLORE_COPY[locale].added.length>3);
 }
});
