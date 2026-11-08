import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MOODBOARD_STORAGE_KEY, MOODBOARD_BACKUP_KEY, createEmptyMoodboardDocument,
 createMoodboard, parseMoodboardDocument, serializeMoodboardDocument,
 MOODBOARD_MAX_REFERENCES
} from '../src/lib/moodboards/store.js';
import {
 createFirstCollectionMoodboardWithItem, readCollectionMoodboards, toggleCollectionMoodboardInspiration
} from '../src/lib/collection/moodboard-inspire.mjs';
import {exploreCopy} from '../src/lib/explore/copy.js';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';
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


const first=(storage,title,id=40000047,records=catalog)=>
 createFirstCollectionMoodboardWithItem(storage,title,id,records,'Furniture');

test('Collection first Moodboard explicitly creates board and verified ITEM with one primary write',()=>{
 const empty=serializeMoodboardDocument(createEmptyMoodboardDocument('2026-11-08T00:00:00.000Z'));
 const storage=makeStorage(empty);
 let primaryWrites=0;
 const wrapped={
  getItem:k=>storage.getItem(k),
  setItem(k,v){if(k===MOODBOARD_STORAGE_KEY)primaryWrites++;storage.setItem(k,v);}
 };
 const result=first(wrapped,'  First Scene  ');
 assert.equal(primaryWrites,1,'single primary write for board plus ITEM');
 assert.equal(result.document.boards.length,1);
 assert.equal(result.document.boards[0].title,'First Scene');
 assert.equal(result.boardId,result.document.boards[0].id);
 assert.deepEqual(result.document.boards[0].references.map(r=>[r.type,r.entityId,r.label]),
  [['ITEM','40000047','Verified Chair']]);
 assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),empty,'exact previous valid empty document');
 const reopen=parseMoodboardDocument(storage.getItem(MOODBOARD_STORAGE_KEY));
 assert.equal(reopen.boards[0].references[0].entityId,'40000047');
 assert.equal(serializeMoodboardDocument(reopen),serializeMoodboardDocument(result.document));
 assert.throws(()=>first(storage,'Second','40000047'),/Verified Collection ItemID/);
 assert.equal(reopen.boards.length,1);
});

test('first-board empty-browser storage and second attempt after current board created are fail-closed',()=>{
 const browser=makeStorage(null);
 const created=first(browser,'First');
 assert.equal(created.document.boards.length,1);
 assert.equal(browser.getItem(MOODBOARD_BACKUP_KEY),null,'no previous user document to overwrite');
 const saved=browser.getItem(MOODBOARD_STORAGE_KEY);
 assert.throws(()=>first(browser,'Stale First'),/now exists/);
 assert.equal(browser.getItem(MOODBOARD_STORAGE_KEY),saved);
 assert.equal(parseMoodboardDocument(saved).boards[0].references.length,1);
});

test('first-board rejects forged or invisible catalog ItemID, blank title, malformed schema, quota and deleted concurrent state',()=>{
 const empty=serializeMoodboardDocument(createEmptyMoodboardDocument());
 for(const [title,id,records] of [['',40000047,catalog],['   ',40000047,catalog],
  ['x'.repeat(121),40000047,catalog],['Valid',0,catalog],
  ['Valid','40000047',catalog],['Valid',99999,catalog],
  ['Valid',40000047,[]],['Valid',40000047,[{itemId:40000047,label:'  '}]]]){
  const storage=makeStorage(empty);
  assert.throws(()=>first(storage,title,id,records));
  assert.equal(storage.getItem(MOODBOARD_STORAGE_KEY),empty);
  assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),null);
 }
 for(const original of ['{bad','{"schema":"WRONG","boards":[]}',fixture().text]){
  const storage=makeStorage(original);
  assert.throws(()=>first(storage,'First'),/invalid|Unsupported|now exists/i);
  assert.equal(storage.getItem(MOODBOARD_STORAGE_KEY),original);
  assert.equal(storage.getItem(MOODBOARD_BACKUP_KEY),null);
 }
 for(const key of [MOODBOARD_STORAGE_KEY,MOODBOARD_BACKUP_KEY]){
  const storage=makeStorage(empty,key);
  assert.throws(()=>first(storage,'First'),/Quota/);
  assert.equal(storage.getItem(MOODBOARD_STORAGE_KEY),empty);
 }
});

test('first-board UI is explicit user submit, localized for 8 locales, never implicit inside existing toggle',()=>{
 for(const s of [
  'createFirstCollectionMoodboardWithItem(', 'function createFirstMoodboardWithItem(item:any):void',
  'data-collection-first-moodboard','data-collection-first-moodboard-title',
  'data-collection-first-moodboard-create','on:submit|preventDefault',
  'moodboardCopyText.created','localBoards.length===0',
  "moodboardCopyText.create", 'maxlength="120" required',
  'origin.context!==infoContext()','window.scrollTo({left:origin.x,top:origin.y'
 ])assert.ok(page.includes(s),s);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  // Original Moodboard translations, reused without a second language dictionary.
  const cp=moodboardCopy(locale);
  for(const key of ['newBoard','titleLabel','create','created','invalid'])
   assert.ok(cp[key],locale+' '+key);
 }
 assert.doesNotMatch(page,/saveEditedCopy|createPublicWork|cloudUpload/);
});
