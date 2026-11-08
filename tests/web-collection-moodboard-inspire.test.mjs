import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MOODBOARD_STORAGE_KEY, MOODBOARD_BACKUP_KEY, createEmptyMoodboardDocument,
 createMoodboard, parseMoodboardDocument, serializeMoodboardDocument,
 MOODBOARD_MAX_REFERENCES
} from '../src/lib/moodboards/store.js';
import {
 readCollectionMoodboards, toggleCollectionMoodboardInspiration,
 createFirstCollectionMoodboardWithItem, COLLECTION_FIRST_MOODBOARD_GATE
} from '../src/lib/collection/moodboard-inspire.mjs';
import {exploreCopy} from '../src/lib/explore/copy.js';
const page=readFileSync(new URL('../src/routes/collection/+page.svelte',import.meta.url),'utf8');
const catalog=[{itemId:40000047,label:'Verified Chair',family:'Furniture'},
 {itemId:40000048,label:'Verified Table',family:'Furniture'}];
function fixture(){
 const {document,board}=createMoodboard(createEmptyMoodboardDocument('2026-11-08T00:00:00.000Z'),
 {title:'My Scene'},{now:'2026-11-08T00:00:00.000Z',idFactory:()=> 'scene'});
 return {text:serializeMoodboardDocument(document),board};
}
function makeStorage(raw,failKey=null){
 const values=new Map(raw===null?[]:[[MOODBOARD_STORAGE_KEY,raw]]);
 return {getItem:k=>values.get(k)??null,
  setItem(k,v){if(k===failKey)throw new DOMException('Quota reached','QuotaExceededError');values.set(k,String(v));}};
}
const toggle=(storage,id,rows=catalog)=>toggleCollectionMoodboardInspiration(storage,'board_scene',id,rows,'Furniture');

test('Collection adds and removes the one existing typed ITEM reference with exact backup/reopen',()=>{
 const {text,board}=fixture();
 assert.equal(board.id,'board_scene');
 const storage=makeStorage(text);
 const added=toggle(storage,40000047);
 assert.equal(added.action,'added');
 const item=added.document.boards[0].references[0];
 assert.deepEqual([item.type,item.entityId,item.label],['ITEM','40000047','Verified Chair']);
 assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),text);
 const beforeRemove=storage.getItem(MOODBOARD_STORAGE_KEY);
 assert.equal(parseMoodboardDocument(beforeRemove).boards[0].references[0].entityId,'40000047');
 assert.equal(serializeMoodboardDocument(parseMoodboardDocument(beforeRemove)),
  serializeMoodboardDocument(added.document));
 const removed=toggle(storage,40000047);
 assert.equal(removed.action,'removed');
 assert.equal(parseMoodboardDocument(storage.getItem(MOODBOARD_STORAGE_KEY)).boards[0].references.length,0);
 assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),beforeRemove);
});

test('reads latest cross-tab document and does not overwrite other boards',()=>{
 const one=fixture();
 const {document:two,board:other}=createMoodboard(parseMoodboardDocument(one.text),
  {title:'Another Scene'},{now:'2026-11-08T00:00:01.000Z',idFactory:()=> 'second'});
 assert.equal(other.id,'board_second');
 const storage=makeStorage(one.text),latest=serializeMoodboardDocument(two);
 storage.setItem(MOODBOARD_STORAGE_KEY,latest);
 const added=toggle(storage,40000047);
 assert.equal(added.document.boards.length,2);
 assert.equal(added.document.boards[1].title,'Another Scene');
 assert.equal(added.document.boards[1].references.length,0);
 assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),latest);
});

test('forged, unsupported, invisible and noninteger IDs do not write a typed reference',()=>{
 const {text}=fixture();
 for(const [id,rows] of [[999999,catalog],['40000047',catalog],[40000047,[]],
  [Number.NaN,catalog],[0,catalog],[1.5,catalog],[40000047,[{itemId:40000047,label:''}]]]){
  const storage=makeStorage(text);
  assert.throws(()=>toggle(storage,id,rows));
  assert.equal(storage.getItem(MOODBOARD_STORAGE_KEY),text);
  assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),null);
 }
});

test('missing board, malformed source and unknown schema fail closed without overwrite',()=>{
 const {text}=fixture();
 const cases=[null,'{broken','{"schema":"unknown","boards":[]}',
  serializeMoodboardDocument(createEmptyMoodboardDocument())];
 for(const raw of cases){
  const storage=makeStorage(raw);
  assert.throws(()=>toggle(storage,40000047));
  assert.equal(storage.getItem(MOODBOARD_STORAGE_KEY),raw);
  assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),null);
 }
 const storage=makeStorage(text);
 assert.throws(()=>toggleCollectionMoodboardInspiration(storage,'missing',40000047,catalog));
 assert.equal(storage.getItem(MOODBOARD_STORAGE_KEY),text);
 assert.throws(()=>readCollectionMoodboards(makeStorage('{broken')));
});

test('failed backup, quota and 500-reference cap preserve primary document',()=>{
 const {text}=fixture();
 for(const key of [MOODBOARD_BACKUP_KEY,MOODBOARD_STORAGE_KEY]){
  const storage=makeStorage(text,key);
  assert.throws(()=>toggle(storage,40000047),/Quota/);
  assert.equal(storage.getItem(MOODBOARD_STORAGE_KEY),text);
 }
 const fullDoc=parseMoodboardDocument(text);
 fullDoc.boards[0].references=Array.from({length:MOODBOARD_MAX_REFERENCES},(_,i)=>({
  id:'ref_'+i,type:'ITEM',label:'Known '+i,entityId:String(i+1),groupIds:[],
  note:null,createdAt:'2026-11-08T00:00:00.000Z'
 }));
 const full=serializeMoodboardDocument(fullDoc),storage=makeStorage(full);
 assert.throws(()=>toggle(storage,40000047),/limit reached/i);
 assert.equal(storage.getItem(MOODBOARD_STORAGE_KEY),full);
});

test('Collection Info reuses Explore 8-locale copy and preserves read-only/catalog UX',()=>{
 for(const text of [
  "from '$lib/collection/moodboard-inspire.mjs'",
  'readCollectionMoodboards(localStorage)',
  'localStorage, selectedMoodboardId, item.itemId, scoped',
  'data-collection-moodboard-inspire','data-collection-moodboard-toggle',
  'data-collection-moodboard-select','aria-pressed={selectedItemInMoodboard}',
  "href={base+'/moodboards/'}",'data-stage1-info-close',
  'origin.context!==infoContext()',
  'data-personal-progress="unknown" data-writer="off" data-media-rights="unverified"'
 ])assert.ok(page.includes(text),text);
 assert.doesNotMatch(page,/saveEditedCopy|createPublicWork|cloudUpload/);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const copy=exploreCopy(locale);
  for(const key of ['moodboard','chooseBoard','noBoards','add','remove','added','removed','openMoodboards'])
   assert.ok(typeof copy[key]==='string'&&copy[key].length>0,locale+' '+key);
 }
});


test('QA777 backup seam and QA789 last-read/primary seam are unreachable while first-board operation is OFF',()=>{
 assert.equal(COLLECTION_FIRST_MOODBOARD_GATE,'OFF_LEGACY_WRITER_NO_ATOMIC_CAS');
 const inputs=[
  null,
  serializeMoodboardDocument(createEmptyMoodboardDocument('2026-11-08T00:00:00.000Z')),
  fixture().text,
  '{broken',
  '{"schema":"not-a-real-schema","boards":[]}'
 ];
 for(const original of inputs){
  const cells=new Map(original===null?[]:[[MOODBOARD_STORAGE_KEY,original]]);
  let reads=0,writes=0,postReadCollision=false,backupCollision=false;
  // If first-board code ever reaches the legacy storage surface, the
  // hostile adapter would trigger both historical independent QA seams.
  const storage={
   getItem(key){reads++;postReadCollision=true;return cells.get(key)??null;},
   setItem(key,value){
    writes++;
    if(key===MOODBOARD_BACKUP_KEY){backupCollision=true;}
    if(key===MOODBOARD_STORAGE_KEY)cells.set(key,String(value));
   }
  };
  assert.throws(
   ()=>createFirstCollectionMoodboardWithItem(storage,'First Board',40000047,catalog,'Furniture'),
   /COLLECTION_FIRST_MOODBOARD_DISABLED_LEGACY_WRITER/
  );
  assert.equal(reads,0,'QA789 old-writer race seam never entered');
  assert.equal(writes,0,'QA777 backup and QA789 primary write never reached');
  assert.equal(postReadCollision,false);
  assert.equal(backupCollision,false);
  assert.equal(cells.get(MOODBOARD_STORAGE_KEY)??null,original,'original local primary byte-exact');
  assert.equal(cells.has(MOODBOARD_BACKUP_KEY),false,'existing backup never modified');
 }
});

test('first-board Collection UI is absent, old Moodboards route and existing-board typed Item remain',()=>{
 assert.doesNotMatch(page,/data-collection-first-moodboard|on:submit\|preventDefault/);
 assert.doesNotMatch(page,/createFirstCollectionMoodboardWithItem/);
 assert.match(page,/data-collection-moodboard-toggle/);
 assert.match(page,/data-collection-moodboard-select/);
 assert.ok(page.includes("href={base+'/moodboards/'}"));
 const {text}=fixture();
 const storage=makeStorage(text);
 const result=toggle(storage,40000047);
 assert.equal(result.action,'added');
 assert.equal(parseMoodboardDocument(storage.getItem(MOODBOARD_STORAGE_KEY)).boards[0].references[0].entityId,'40000047');
 assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),text);
});
