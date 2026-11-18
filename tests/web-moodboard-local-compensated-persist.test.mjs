import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MOODBOARD_STORAGE_KEY as MAIN,MOODBOARD_BACKUP_KEY as BACKUP,
 createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {persistMoodboardLocalChange} from '../src/lib/moodboards/local-persist-compensated.mjs';

const original=createMoodboard(createEmptyMoodboardDocument('2026-11-18T00:00:00.000Z'),
 {title:'Original'},{now:'2026-11-18T00:00:01.000Z',idFactory:()=>1}).document;
const next=createMoodboard(original,{title:'Edited'},
 {now:'2026-11-18T00:00:02.000Z',idFactory:()=>2}).document;
const raw=serializeMoodboardDocument(original);
const backup='{"old":"already-recoverable-from-a-prior-success"}';
const setup=(initial=[[MAIN,raw],[BACKUP,backup]])=>{
 const map=new Map(initial),writes=[];
 const storage={
  getItem:k=>map.has(k)?map.get(k):null,
  setItem(k,v){writes.push(k);map.set(k,String(v))},
  removeItem(k){writes.push('remove:'+k);map.delete(k)}
 };
 return {map,writes,storage};
};
test('Successful persisted board retains original full raw backup and restores exact next state',()=>{
 const {map,storage}=setup(),serialized=persistMoodboardLocalChange(storage,next,raw);
 assert.equal(serialized,serializeMoodboardDocument(next));
 assert.equal(map.get(MAIN),serialized);assert.equal(map.get(BACKUP),raw);
 assert.notEqual(map.get(BACKUP),backup);
});
test('No-op preserves previous accepted snapshot without churn',()=>{
 const {map,storage,writes}=setup(),saved=persistMoodboardLocalChange(storage,original,raw);
 assert.equal(saved,raw);assert.deepEqual(writes,[]);
 assert.equal(map.get(BACKUP),backup);
});
test('Quota denial during primary write restores PREVIOUS backup byte-for-byte',()=>{
 const {map,storage}=setup();
 const set=storage.setItem.bind(storage);
 storage.setItem=(key,v)=>{if(key===MAIN)throw Error('SYNTHETIC_PRIMARY_QUOTA');set(key,v)};
 assert.throws(()=>persistMoodboardLocalChange(storage,next,raw),/SYNTHETIC_PRIMARY_QUOTA/);
 assert.equal(map.get(MAIN),raw);assert.equal(map.get(BACKUP),backup);
});
test('Backup write denied before main commit leaves both raw documents unchanged',()=>{
 const {map,storage}=setup();
 const set=storage.setItem.bind(storage);
 storage.setItem=(key,v)=>{if(key===BACKUP)throw Error('SYNTHETIC_BACKUP_QUOTA');set(key,v)};
 assert.throws(()=>persistMoodboardLocalChange(storage,next,raw),/SYNTHETIC_BACKUP_QUOTA/);
 assert.equal(map.get(MAIN),raw);assert.equal(map.get(BACKUP),backup);
});
test('Silent uncommitted primary write cannot report success or alter old backup',()=>{
 const {map,storage}=setup();
 const set=storage.setItem.bind(storage);
 storage.setItem=(key,v)=>{if(key!==MAIN)set(key,v)};
 assert.throws(()=>persistMoodboardLocalChange(storage,next,raw),/MOODBOARD_LOCAL_COMMIT_UNVERIFIED/);
 assert.equal(map.get(MAIN),raw);assert.equal(map.get(BACKUP),backup);
});
test('Initial Board create primary quota failure cannot replace an unrelated prior backup',()=>{
 const {map,storage}=setup([[BACKUP,backup]]),blank=createEmptyMoodboardDocument();
 const set=storage.setItem.bind(storage);
 storage.setItem=(key,v)=>{if(key===MAIN)throw Error('SYNTHETIC_FIRST_QUOTA');set(key,v)};
 assert.throws(()=>persistMoodboardLocalChange(storage,blank,null),/SYNTHETIC_FIRST_QUOTA/);
 assert.equal(map.has(MAIN),false);assert.equal(map.get(BACKUP),backup);
});
test('Partially written primary is removed after failed commit with no original',()=>{
 const {map,storage}=setup([[BACKUP,backup]]),blank=createEmptyMoodboardDocument();
 const set=storage.setItem.bind(storage);
 storage.setItem=(key,v)=>{set(key,v);if(key===MAIN)throw Error('SYNTHETIC_POSTWRITE_FAILURE')};
 assert.throws(()=>persistMoodboardLocalChange(storage,blank,null),/SYNTHETIC_POSTWRITE_FAILURE/);
 assert.equal(map.has(MAIN),false);assert.equal(map.get(BACKUP),backup);
});
test('Rollback failure is explicit, never false success, and still attempts both keys',()=>{
 const {map,storage,writes}=setup();
 const set=storage.setItem.bind(storage);
 let backupWritten=false;
 storage.setItem=(key,v)=>{
  if(key===BACKUP&&backupWritten)throw Error('SYNTHETIC_BACKUP_RESTORE_FAILURE');
  if(key===BACKUP)backupWritten=true;
  if(key===MAIN)throw Error('SYNTHETIC_PRIMARY_QUOTA');
  set(key,v);
 };
 assert.throws(()=>persistMoodboardLocalChange(storage,next,raw),/MOODBOARD_LOCAL_ROLLBACK_UNVERIFIED/);
 assert.equal(map.get(MAIN),raw);assert.ok(writes.includes(BACKUP));
});
test('Second browser tab stale in-memory Board cannot overwrite a newer primary or its backup',()=>{
 const {map,storage,writes}=setup();
 const newer=serializeMoodboardDocument(next);map.set(MAIN,newer);
 assert.throws(()=>persistMoodboardLocalChange(storage,original,raw),/MOODBOARD_LOCAL_STALE/);
 assert.equal(map.get(MAIN),newer);assert.equal(map.get(BACKUP),backup);
 assert.deepEqual(writes,[]);
});
test('Invalid future document fails before either write; no untrusted key or serialized bypass',()=>{
 const {map,storage,writes}=setup();
 assert.throws(()=>persistMoodboardLocalChange(storage,{schema:'WRONG',version:2,boards:[]},raw));
 assert.equal(map.get(MAIN),raw);assert.equal(map.get(BACKUP),backup);assert.deepEqual(writes,[]);
 assert.throws(()=>persistMoodboardLocalChange(storage,next,undefined),/MOODBOARD_LOCAL_STORAGE_UNAVAILABLE/);
});
test('Real Moodboard route uses compensated storage and keeps UI fields after rejected write',()=>{
 const route=readFileSync(new URL('../src/routes/moodboards/+page.svelte',import.meta.url),'utf8');
 assert.match(route,/persistMoodboardLocalChange\(localStorage,next,observedRaw\)/);
 assert.match(route,/if\(!persist\(result\.document\)\)return;selectedId=/);
 assert.match(route,/if\(!persist\(next\)\)return;status=copy\.ungrouped/);
 assert.match(route,/if\(!persist\(removeMoodboardReference/);
 assert.match(route,/observedRaw=localStorage\.getItem\(MOODBOARD_STORAGE_KEY\)/);
 assert.match(route,/data-moodboard-local-restore/);
 assert.ok(route.includes('if(localStorage.getItem(MOODBOARD_STORAGE_KEY)!==observedRaw)'),
  'explicit Restore must also deny stale other-tab writes');
 assert.doesNotMatch(route,/if\(current\)localStorage\.setItem\(MOODBOARD_BACKUP_KEY,current\)/);
});
