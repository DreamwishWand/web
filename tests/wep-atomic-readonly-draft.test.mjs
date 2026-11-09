import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 parseAtomicWorldEditorDraftQuery,
 WEP_ATOMIC_IDB_DRAFT_GATE,WEP_ATOMIC_IDB_DRAFT_OPERATION,
 verifyCurrentAtomicWorldEditorDraft
} from '../src/lib/wep/world-editor-atomic-readonly-draft.mjs';
import {WORLD_EDITOR_STAGE1_LOCALES,worldEditorStage1Copy} from '../src/lib/wep/world-editor-stage1-copy.js';
import {MOODBOARD_COPY} from '../src/lib/moodboards/copy.js';
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const boardId='board_atomic_1234567890ab',referenceId='ref_12345',url=
 '?atomicBoard='+boardId+'&atomicRevision=2&atomicReference='+referenceId+'&atomicItem=40000047';
const valid=()=>parseAtomicWorldEditorDraftQuery(url);
test('strict source-specific URL contract, no inherited legacy Board authority',()=>{
 assert.equal(parseAtomicWorldEditorDraftQuery(''),null);
 assert.equal(parseAtomicWorldEditorDraftQuery('?mode=read'),null);
 assert.equal(WEP_ATOMIC_IDB_DRAFT_OPERATION,'WEP_ATOMIC_IDB_BOARD_TO_WORLD_EDITOR_READONLY_DRAFT_HANDOFF');
 assert.equal(WEP_ATOMIC_IDB_DRAFT_GATE,'READONLY_PENDING_SELECTION__NO_NATIVE_PLACEMENT');
 const receipt=valid();
 assert.deepEqual(Object.keys(receipt).sort(),[
 'boardId','directSourceReplacementAuthorized','intent','itemId','nativePlacementAuthorized',
 'persistentWriteAuthorized','productApplyAuthorized','referenceId','revision','sourceSurface'
 ].sort());
 assert.equal(receipt.sourceSurface,'atomic-idb');
 assert.equal(receipt.intent,'READONLY_DRAFT_PREVIEW');
 assert.equal(receipt.boardId,boardId);
 assert.equal(receipt.revision,2);
 assert.equal(receipt.itemId,40000047);
 for(const k of ['persistentWriteAuthorized','productApplyAuthorized',
 'nativePlacementAuthorized','directSourceReplacementAuthorized'])
  assert.equal(receipt[k],false);
 for(const bad of [
 '?atomicBoard=stage1-board&atomicRevision=2&atomicReference='+referenceId+'&atomicItem=40000047',
 url+'&atomicItem=40000047',url+'&legacyBoard=stage1-board',
 url.replace('atomicRevision=2','atomicRevision=0'),
 url.replace('atomicRevision=2','atomicRevision=02'),
 url.replace('atomicItem=40000047','atomicItem=00040000047'),
 url.replace('atomicItem=40000047','atomicItem=9007199254740992'),
 url.replace('atomicReference='+referenceId,'atomicReference=../fake'),
 '?atomicRevision=2'
 ])assert.throws(()=>parseAtomicWorldEditorDraftQuery(bad),/WEP_ATOMIC_DRAFT_/);
});
test('independent verified Collection Catalog required BEFORE any IDB read',async()=>{
 const notOpened={};
 await assert.rejects(verifyCurrentAtomicWorldEditorDraft(notOpened,valid(),new Map()),
  /WEP_ATOMIC_DRAFT_ITEM_NOT_VERIFIED/);
 const bad={...valid(),productApplyAuthorized:true};
 await assert.rejects(verifyCurrentAtomicWorldEditorDraft(notOpened,bad,
   new Map([[40000047,{itemId:40000047,label:'Verified Item'}]])),
   /WEP_ATOMIC_DRAFT_INTENT_INVALID/);
 const map=new Map([[40000047,{itemId:40000047,label:'Verified Item'}]]);
 await assert.rejects(verifyCurrentAtomicWorldEditorDraft(notOpened,{
  ...valid(),fakeNativeObjectID:1
 },map),/WEP_ATOMIC_DRAFT_INTENT_INVALID/);
});
test('WEP receiver is a separate read-only preview; NEVER native pending placement',()=>{
 const panel=text('src/lib/wep/WorldEditorStage1DecoratePanel.svelte');
 const helper=text('src/lib/wep/world-editor-atomic-readonly-draft.mjs');
 assert.match(panel,/parseAtomicWorldEditorDraftQuery\(window\.location\.search\)/);
 const route=text('src/routes/editor/world/+page.svelte');
 assert.match(route,/pendingWorldEditorHandoff \|\| atomicReadonlyDraftRequested/);
 assert.match(route,/new URLSearchParams\(window\.location\.search\)/);
 assert.match(panel,/data-wep-atomic-draft-receiver/);
 assert.match(panel,/data-wep-atomic-inspect/);
 assert.match(panel,/data-wep-atomic-hold/);
 assert.match(panel,/data-wep-native-placement="off"/);
 assert.match(panel,/readCurrentAtomicWorldEditorDraft\(atomicIntent, itemById\)/);
 assert.match(panel,/atomicCatalogReady = true/);
 assert.match(panel,/atomicPending = fresh/);
 assert.doesNotMatch(helper,/localStorage\.(?:getItem|setItem)|setItem\(|insertDraftGraph\(|onMutation\(|writeWorldEditorHandoff\(|setPositions\(/);
 assert.match(helper,/verifiedAtomicFirstBoardReopen\(db\)/);
 assert.match(helper,/db\.close\(\)/);
 assert.match(helper,/snapshot\.revision!==requested\.revision/);
 assert.match(helper,/refs\[0\]\.type!=='ITEM'/);
 assert.match(helper,/refs\[0\]\.entityId!==String\(requested\.itemId\)/);
 assert.match(panel,/async function holdAtomicReadonlyDraft/);
 const fn=panel.slice(panel.indexOf('async function holdAtomicReadonlyDraft()'),
  panel.indexOf('function clearAtomicReadonlyDraft()'));
 assert.doesNotMatch(fn,/pendingItemId\s*=|insertDraftGraph\(|onMutation\(|session\.|editorDocument\s*=/);
});
test('8 locale copy includes explicit readonly, unknown Native and store separation',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual([...WORLD_EDITOR_STAGE1_LOCALES],locales);
 for(const locale of locales){
  const c=worldEditorStage1Copy(locale);
  for(const k of ['atomicInspect','atomicHold','atomicBoundary','atomicReady'])
   assert.ok(typeof c[k]==='string'&&c[k].trim().length>=4,locale+' '+k);
  assert.match(c.atomicBoundary,/ObjectID/);
  assert.match(MOODBOARD_COPY[locale].atomicNote,/IndexedDB/);
 }
});
