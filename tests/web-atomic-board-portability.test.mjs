import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyMoodboardDocument,createMoodboard,addMoodboardReference,serializeMoodboardDocument} from '../src/lib/moodboards/store.js';
import {ATOMIC_BOARD_PORTABLE_SCHEMA,decodeAtomicBoardPortable,importAtomicBoardPortable,ATOMIC_BOARD_PORTABLE_MAX_BYTES} from '../src/lib/moodboards/atomic-first-board.mjs';
import {atomicPortabilityCopy} from '../src/lib/moodboards/atomic-portability-copy.mjs';
const t='2026-11-14T00:00:00.000Z',empty=createEmptyMoodboardDocument(t);
const doc=createMoodboard(empty,{title:'Portable'},{now:t,idFactory:()=> 'atomic_synthetic1234'}).document;
const id=doc.boards[0].id;
const filled=addMoodboardReference(doc,id,{type:'ITEM',label:'Lamp',entityId:'40000047'},{now:t,idFactory:()=> 'ref1234'}).document;
const row={schema:'wand.moodboards.atomic-first@1',revision:2,boardId:id,primary:serializeMoodboardDocument(filled),backup:serializeMoodboardDocument(doc),deleted:false};
const enc=r=>JSON.stringify({schema:ATOMIC_BOARD_PORTABLE_SCHEMA,version:1,snapshot:r},null,2)+'\n';
const catalog=[{itemId:40000047,label:'Lamp'}];
test('exact portable source record and catalog references; eight localized controls',()=>{
 assert.deepEqual(decodeAtomicBoardPortable(enc(row),catalog),row);
 for(const locale of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'])for(const key of ['export','import','note','exported','imported','rejected'])assert.ok(atomicPortabilityCopy(locale)[key]);
});
test('malformed, forged, unknown, overflow, altered, noncanonical and unverified catalog denied before transaction',async()=>{
 const db={transaction(){throw Error('MUST_NOT_OPEN_TX');}};
 for(const raw of ['bad',enc({...row,revision:0}),enc({...row,revision:Number.MAX_SAFE_INTEGER}),enc({...row,boardId:'other'}),enc({...row,extra:true}),enc({...row,backup:serializeMoodboardDocument(empty)}),enc({...row,primary:row.primary.replace('"ITEM"','"NOTE"')}),enc(row).replace('"version": 1','"version": 2'),enc(row).trim(),'x'.repeat(ATOMIC_BOARD_PORTABLE_MAX_BYTES+1)])
  await assert.rejects(importAtomicBoardPortable(db,raw,catalog),/ATOMIC_FIRST_BOARD_/);
 await assert.rejects(importAtomicBoardPortable(db,enc(row),[]),/PORTABLE_ITEM_UNVERIFIED/);
});
