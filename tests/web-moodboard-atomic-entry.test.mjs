import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOODBOARD_COPY,moodboardCopy} from '../src/lib/moodboards/copy.js';
import {COLLECTION_FIRST_MOODBOARD_GATE} from '../src/lib/collection/moodboard-inspire.mjs';
import {canonicalForApprovedStaticPath,inspectCustomDomainPath,OWNER_CUSTOM_DOMAIN} from '../src/lib/foundation/canonical-domain-preview.mjs';
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('8 locales make an informed opt-in: separate storage, no automated migration or deletion',()=>{
 const codes=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(MOODBOARD_COPY),codes);
 for(const locale of codes){
  const copy=moodboardCopy(locale);
  for(const key of ['atomicLink','atomicNote']){
   assert.equal(typeof copy[key],'string',locale+' '+key);
   assert.ok(copy[key].length>12,locale+' '+key+' nonempty');
  }
  assert.match(copy.atomicNote,/IndexedDB/);
  assert.ok(copy.atomicLink!==copy.newBoard,locale+' explicit alternative not primary create');
  assert.ok(copy.atomicNote!==moodboardCopy('en').atomicNote||locale==='en',
    locale+' reviewed localized separation warning');
 }
 assert.match(moodboardCopy('ja').atomicNote,/自動移行|上書き/);
 assert.match(moodboardCopy('en').atomicNote,/not migrated, merged, replaced or deleted/);
});
test('Moodboard link is user-initiated only, old create/inspire/storage and the isolated route remain unchanged',()=>{
 const route=text('src/routes/moodboards/+page.svelte');
 const atomic=text('src/routes/moodboards/atomic/+page.svelte');
 assert.equal(route.split('data-moodboard-atomic-link').length-1,1);
 assert.match(route,/href=\{base\+'\/moodboards\/atomic\/'\}/);
 for(const marker of ['data-storage-separation="explicit"','data-legacy-migration="off"',
 'data-first-collection-create="off"','data-moodboard-atomic-warning']){
  assert.ok(route.includes(marker),marker);
 }
 assert.match(route,/copy\.atomicNote/);
 assert.match(route,/copy\.atomicLink/);
 assert.match(route,/function createBoard\(\)/);
 assert.match(route,/function persist\(next:any\)/);
 assert.match(route,/MOODBOARD_STORAGE_KEY/);
 assert.match(route,/MOODBOARD_BACKUP_KEY/);
 assert.doesNotMatch(route,/from '\$lib\/moodboards\/atomic-first-board\.mjs'/);
 assert.doesNotMatch(route,/indexedDB\.open\(|deleteDatabase\(|migrateLegacy|autoImportAtomic/);
 assert.match(atomic,/<meta name="robots" content="noindex,nofollow"/);
 assert.match(atomic,/ATOMIC_FIRST_BOARD_GATE/);
 assert.match(atomic,/data-writer="off" data-media-public="off"/);
 assert.equal(COLLECTION_FIRST_MOODBOARD_GATE,'OFF_LEGACY_WRITER_NO_ATOMIC_CAS');
 assert.equal(canonicalForApprovedStaticPath('/moodboards/atomic/',{origin:OWNER_CUSTOM_DOMAIN,basePath:''}),null);
 const inspected=inspectCustomDomainPath('/moodboards/atomic/');
 assert.equal(inspected.eligibleForPublicIndex,false);
 assert.equal(inspected.authoritativeStatus,null);
});
