import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 ATOMIC_FIRST_BOARD_OPERATION,ATOMIC_FIRST_BOARD_GATE,ATOMIC_MOODBOARD_DB,
 ATOMIC_MOODBOARD_STORE,ATOMIC_MOODBOARD_SLOT,
 createAtomicFirstBoard,toggleAtomicFirstBoardItem,openAtomicFirstBoardDatabase
} from '../src/lib/moodboards/atomic-first-board.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('isolated transactional first-board cannot change accepted legacy Moodboards data or UI',()=>{
 assert.equal(ATOMIC_FIRST_BOARD_OPERATION,'WEB_LOCAL_FIRST_MOODBOARD_ATOMIC_CREATE');
 assert.equal(ATOMIC_FIRST_BOARD_GATE,'ISOLATED_LOCAL_ONLY__NOT_LEGACY_MIGRATED');
 assert.equal(ATOMIC_MOODBOARD_STORE,'snapshots');
 assert.equal(ATOMIC_MOODBOARD_SLOT,'first');
 assert.match(ATOMIC_MOODBOARD_DB,/atomic-first:v1$/);
 const s=read('../src/lib/moodboards/atomic-first-board.mjs');
 assert.doesNotMatch(s,/[.]getItem\(|[.]setItem\(|globalThis[.]localStorage|window[.]localStorage|navigator[.]locks/);
 assert.match(s,/transaction\(ATOMIC_MOODBOARD_STORE,mode\)/);
 assert.match(s,/tx[.]oncomplete/);
 assert.match(s,/expectedRevision/);
 assert.match(s,/validateRow\(request[.]result\)/);
 const accepted=read('../src/lib/collection/moodboard-inspire.mjs');
 assert.match(accepted,/COLLECTION_FIRST_MOODBOARD_GATE = 'OFF_LEGACY_WRITER_NO_ATOMIC_CAS'/);
 assert.match(accepted,/COLLECTION_FIRST_MOODBOARD_DISABLED_LEGACY_WRITER/);
 const route=read('../src/routes/moodboards/atomic/+page.svelte');
 assert.match(route,/noindex,nofollow/);
 assert.match(route,/data-atomic-first-board/);
 assert.doesNotMatch(route,/uploadSave|CloudUpload|service_role/);
});
test('invalid crypto ID, invalid ItemID and unsupported DB reject before storage mutation',async()=>{
 await assert.rejects(openAtomicFirstBoardDatabase(null),/INDEXEDDB_UNAVAILABLE/);
 const db={transaction(){throw new Error('MUST_NOT_USE_DB');}};
 await assert.rejects(createAtomicFirstBoard(db,' '),/Valid board title/);
 await assert.rejects(createAtomicFirstBoard(db,'A',{idFactory:()=> 'unsafe'}),/Strong random BoardID/);
 await assert.rejects(toggleAtomicFirstBoardItem(db,{
  boardId:'x',expectedRevision:1,itemId:0,verifiedRecords:[]
 }),/Verified numeric ItemID/);
 await assert.rejects(toggleAtomicFirstBoardItem(db,{
  boardId:'x',expectedRevision:1,itemId:40000047,verifiedRecords:[]
 }),/ItemID missing in verified source scope/);
});
