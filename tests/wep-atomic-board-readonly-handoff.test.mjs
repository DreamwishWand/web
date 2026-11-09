import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyAtomicBoardReference,verifyAtomicHandoffIdentity,readExistingAtomicBoard} from '../src/lib/wep/world-editor-atomic-board-guard.mjs';
import {worldEditorStage1Copy,WORLD_EDITOR_STAGE1_LOCALES} from '../src/lib/wep/world-editor-stage1-copy.js';
const boardId='board_atomic_abcdefghij',itemId=40000048,referenceId='ref-a';
const seed=()=>({schema:'wand.moodboards.atomic-first@1',boardId,revision:2,deleted:false,
 document:{schema:'wand.moodboards.local@1',version:2,boards:[{id:boardId,references:[
  {id:referenceId,type:'ITEM',entityId:String(itemId),groupIds:[]}
 ]}]}});
const req=()=>({boardId,revision:2,referenceId,itemId});
const items=()=>new Map([[itemId,{itemId,label:'Verified Furniture'}]]);
test('current IDB revision and verified catalog Item allow read-only pending',()=>{
 const value=verifyAtomicBoardReference(seed(),req(),items());
 assert.equal(value.reference.id,referenceId);assert.equal(value.persistentWriteAuthorized,false);
});
for(const [name,mutate] of [
 ['legacy BoardID',(s,q)=>{q.boardId='board_legacy';}],
 ['stale CAS',(s,q)=>{q.revision=1;}],
 ['newer tab',(s)=>{s.revision=3;}],
 ['deleted Board',(s)=>{s.deleted=true;}],
 ['unknown schema',(s)=>{s.schema='fake';}],
 ['retargeted Item',(s)=>{s.document.boards[0].references[0].entityId='40000049';}],
 ['wrong type',(s)=>{s.document.boards[0].references[0].type='NOTE';}],
 ['removed ref',(s)=>{s.document.boards[0].references=[];}],
 ['forged ItemID',(s,q)=>{q.itemId=40000049;}],
 ['group changed',(s)=>{s.document.boards[0].references[0].groupIds=['new'];}]
])test('reject '+name,()=>{
 const s=seed(),q=req();mutate(s,q);
 assert.throws(()=>verifyAtomicBoardReference(s,q,items()),/WEP_ATOMIC_/);
});
test('ephemeral handoff rejects reference, revision and writer changes',()=>{
 const pin={sourceSurface:'atomic-moodboard',intent:'ATOMIC_MOODBOARD',boardId,revision:2,referenceId,
  createdAt:'2026-11-09T00:00:00.000Z',persistentWriteAuthorized:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false};
 assert.equal(verifyAtomicHandoffIdentity({...pin},pin),true);
 for(const patch of [{revision:3},{referenceId:'new'},{sourceSurface:'moodboard'},{productApplyAuthorized:true}])
 assert.throws(()=>verifyAtomicHandoffIdentity({...pin,...patch},pin),/WEP_ATOMIC_HANDOFF_CHANGED/);
});
test('missing existing IDB must abort upgrade instead of creating empty Board',async()=>{
 let aborted=false;
 const fake={open(name,version){
  assert.equal(name,'dreamwishwand:moodboards:atomic-first:v1');assert.equal(version,1);
  const request={transaction:{abort(){aborted=true;setImmediate(()=>request.onerror());}}};
  setImmediate(()=>request.onupgradeneeded());
  return request;
 }};
 await assert.rejects(readExistingAtomicBoard(fake),/WEP_ATOMIC_DB_NOT_EXISTING/);
 assert.equal(aborted,true);
});
test('eight locales have read-only and stale messages; WEP owns receiver, not WEB board screen',()=>{
 assert.equal(WORLD_EDITOR_STAGE1_LOCALES.length,8);
 for(const loc of WORLD_EDITOR_STAGE1_LOCALES)
  for(const key of ['atomicBoard','atomicOpen','atomicReadonly','atomicStale'])
   assert.ok(worldEditorStage1Copy(loc)[key],loc+':'+key);
 const panel=readFileSync(new URL('../src/lib/wep/WorldEditorStage1DecoratePanel.svelte',import.meta.url),'utf8');
 for(const token of ['data-wep-atomic-open','verifyAtomicBoardReference','readExistingAtomicBoard','verifyCurrentMoodboardEditorSession'])
  assert.ok(panel.includes(token),token);
});
