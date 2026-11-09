import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOODBOARD_COPY} from '../src/lib/moodboards/copy.js';
import {worldEditorStage1Copy,WORLD_EDITOR_STAGE1_LOCALES} from '../src/lib/wep/world-editor-stage1-copy.js';
import {COLLECTION_FIRST_MOODBOARD_GATE} from '../src/lib/collection/moodboard-inspire.mjs';
import {ATOMIC_FIRST_BOARD_GATE} from '../src/lib/moodboards/atomic-first-board.mjs';
import {canonicalForApprovedStaticPath,inspectCustomDomainPath,OWNER_CUSTOM_DOMAIN} from '../src/lib/foundation/canonical-domain-preview.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('src/routes/moodboards/atomic/+page.svelte');

test('Sender only in existing isolated Atomic Board UI, not new Reader/Store',()=>{
 assert.match(page,/data-atomic-wep-sender/);
 assert.match(page,/data-atomic-wep-send/);
 assert.match(page,/data-reference-id=\{reference\.id\}/);
 assert.match(page,/on:click=\{\(\)=>sendAtomicReferenceToWorldEditor\(reference\.id\)\}/);
 assert.match(page,/createAtomicMoodboardHandoff/);
 assert.match(page,/writeWorldEditorHandoff/);
 assert.match(page,/verifyAtomicBoardReference/);
 assert.match(page,/verifiedAtomicFirstBoardReopen\(db\)/);
 assert.match(page,/current\.revision!==observed\.revision/);
 assert.match(page,/current\.boardId!==observed\.boardId/);
 assert.match(page,/window\.location\.assign\(base\+'\/editor\/world\/'\)/);
 assert.match(page,/wepCopy\.atomicReadonly/);
 assert.match(page,/copy\.atomicNote/);
 assert.match(page,/copy\.openWorldEditor/);
 assert.match(page,/!verifiedWepReference\(reference\)/);
 // A fresh tab may render the IDB Board before SHA catalog hydration. The
 // direct template dependencies MUST re-enable the button after catalogReady.
 assert.match(page,/!catalogReady\|\|!catalogById\.has\(Number\(reference\.entityId\)\)/);
 assert.match(page,/data-atomic-wep-separate="true"/);
 assert.match(page,/<meta name="robots" content="noindex,nofollow"/);
 assert.doesNotMatch(page,/localStorage\.setItem|localStorage\.removeItem|indexedDB\.deleteDatabase|fetch\(['"]https:|post\(|autoPlace|guessFootprint/);
 assert.equal(COLLECTION_FIRST_MOODBOARD_GATE,'OFF_LEGACY_WRITER_NO_ATOMIC_CAS');
 assert.equal(ATOMIC_FIRST_BOARD_GATE,'ISOLATED_LOCAL_ONLY__NOT_LEGACY_MIGRATED');
 assert.equal(canonicalForApprovedStaticPath('/moodboards/atomic/',{origin:OWNER_CUSTOM_DOMAIN,basePath:''}),null);
 assert.equal(inspectCustomDomainPath('/moodboards/atomic/').eligibleForPublicIndex,false);
});
test('Only canonical catalog ItemID, verified CURRENT BoardID/Revision/ReferenceID and group-empty selection',()=>{
 assert.match(page,/typeof raw!=='string'\|\|!\/\^\[1-9\]\[0-9\]\{0,15\}\$\/\.test\(raw\)/);
 assert.match(page,/Number\.isSafeInteger\(Number\(raw\)\)/);
 assert.match(page,/String\(Number\(raw\)\)!==raw/);
 assert.match(page,/verifiedWepReference\(ref\)/);
 assert.match(page,/readAtomicFirstBoard\(db\)/);
 assert.match(page,/verifyAtomicBoardReference\(current/);
 assert.match(page,/referenceId,itemId:Number\(ref\.entityId\)/);
 assert.match(page,/new Map\(records\.map/);
 assert.match(page,/catalogReady/);
 assert.match(page,/current\.deleted/);
 assert.match(page,/wepSending=true/);
 assert.match(page,/catch\{\s*wepSendOutcome='REJECTED'/);
 assert.doesNotMatch(page,/createMoodboardHandoff\(|createExploreItemHandoff\(|toggleAtomicFirstBoardItem\(db,\{[^}]*referenceId/);
 const guard=read('src/lib/wep/world-editor-atomic-board-guard.mjs');
 assert.match(guard,/snapshot\.revision!==revision/);
 assert.match(guard,/reference\.type!=='ITEM'/);
 assert.match(guard,/reference\.groupIds\.length!==0/);
 assert.match(guard,/reference\.entityId!==String\(itemId\)/);
});
test('Accepted 8-locale producer label + separate-store warning and receiver readonly warning reused without fork',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(MOODBOARD_COPY),locales);
 assert.deepEqual([...WORLD_EDITOR_STAGE1_LOCALES],locales);
 for(const locale of locales){
  assert.ok(MOODBOARD_COPY[locale].openWorldEditor?.length>6,locale);
  assert.match(MOODBOARD_COPY[locale].atomicNote,/IndexedDB/);
  assert.ok(worldEditorStage1Copy(locale).atomicReadonly?.trim().length>3,locale);
  assert.ok(worldEditorStage1Copy(locale).atomicStale?.length>10,locale);
 }
});
