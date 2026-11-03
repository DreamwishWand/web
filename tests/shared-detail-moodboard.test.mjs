import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyMoodboardDocument, createMoodboard, MOODBOARD_SCHEMA } from '../src/lib/moodboards/store.js';
import { addCatalogEntityToMoodboard } from '../src/lib/entity/entity-moodboard-action.mjs';
const original=()=>createMoodboard(createEmptyMoodboardDocument('2026-11-03T00:00:00.000Z'),{title:'Valley plan'},{now:'2026-11-03T00:00:00.000Z',idFactory:()=> 'board-1'});
const valid=()=>({status:'FOUND',canExplore:true,source:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},item:{itemId:30000123,label:'Test Furniture',family:'Furniture'}});
test('shared catalog detail adds a typed stable ItemID reference to existing local Moodboard only',()=>{
 const before=original();
 const added=addCatalogEntityToMoodboard(before.document,before.board.id,valid(),{now:'2026-11-03T00:00:01.000Z',idFactory:()=> 'ref-1'});
 assert.equal(before.document.boards[0].references.length,0);
 assert.equal(added.document.schema,MOODBOARD_SCHEMA);
 assert.equal(added.reference.type,'ITEM');
 assert.equal(added.reference.entityId,'30000123');
 assert.equal(added.reference.label,'Test Furniture');
 assert.equal(added.document.boards[0].references.length,1);
 const repeated=addCatalogEntityToMoodboard(added.document,before.board.id,valid(),{now:'2026-11-03T00:00:02.000Z'});
 assert.equal(repeated.document.boards[0].references.length,1);
});
test('missing board, incorrect source/version or nondecorating entity fail closed',()=>{
 const before=original();
 for(const invalid of [null,{}, {...valid(),canExplore:false},{...valid(),source:{...valid().source,gameVersion:'1.25.3'}},{...valid(),source:{...valid().source,buildID:'BID-UNVERIFIED'}},{...valid(),item:{...valid().item,itemId:0}}]){
  assert.throws(()=>addCatalogEntityToMoodboard(before.document,before.board.id,invalid),/NOT_VERIFIED/);
 }
 assert.throws(()=>addCatalogEntityToMoodboard(before.document,'missing',valid()),/Unknown Moodboard/);
 assert.throws(()=>addCatalogEntityToMoodboard(before.document,'',valid()),/SELECTION_REQUIRED/);
});
