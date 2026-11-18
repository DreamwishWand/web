import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MOODBOARD_STORAGE_KEY as MAIN,MOODBOARD_BACKUP_KEY as PREVIOUS,
 createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument,parseMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {persistMoodboardLocalChange} from '../src/lib/moodboards/local-persist-compensated.mjs';

const route=readFileSync(new URL('../src/routes/moodboards/+page.svelte',import.meta.url),'utf8');
const a=createMoodboard(createEmptyMoodboardDocument('2026-11-18T00:00:00Z'),
 {title:'A'}, {now:'2026-11-18T00:00:01Z',idFactory:()=>1}).document;
const b=createMoodboard(a,{title:'B'},
 {now:'2026-11-18T00:00:02Z',idFactory:()=>2}).document;
const rawA=serializeMoodboardDocument(a);
const rawB=serializeMoodboardDocument(b);
const make=(current=rawB,previous=rawA)=>{
 const map=new Map([[MAIN,current],[PREVIOUS,previous]]),writes=[];
 return {map,writes,storage:{
  getItem:k=>map.has(k)?map.get(k):null,
  setItem(k,v){writes.push(k);map.set(k,String(v))},
  removeItem(k){writes.push('remove:'+k);map.delete(k)}
 }};
};
const restore=(storage,current)=>persistMoodboardLocalChange(
 storage,parseMoodboardDocument(storage.getItem(PREVIOUS)),current
);

test('Svelte manual Restore uses approved exact Main+Previous compensated CAS, not unsafe primary setItem',()=>{
 const chunk=route.split('function restoreBackup()')[1]?.split('async function openInWorldEditor')[0]??'';
 assert.match(chunk,/localStorage\.getItem\(MOODBOARD_STORAGE_KEY\)!==observedRaw/);
 assert.match(chunk,/const next=parseMoodboardDocument\(previous\)/);
 assert.match(chunk,/persistMoodboardLocalChange\(localStorage,next,observedRaw\)/);
 assert.doesNotMatch(chunk,/localStorage\.setItem/);
 const writer=chunk.indexOf('persistMoodboardLocalChange(localStorage,next,observedRaw)');
 const receipt=chunk.indexOf('observedRaw=committed;document=next');
 assert.ok(writer>=0&&receipt>writer,'UI receipt only after verified full commit');
});
test('Real previous restore is reversible and records old current byte-identically in Previous',()=>{
 const {map,storage}=make(),saved=restore(storage,rawB);
 assert.equal(saved,rawA);
 assert.equal(map.get(MAIN),rawA);
 assert.equal(map.get(PREVIOUS),rawB,'restoring A retains edited B as immediately previous');
 assert.deepEqual(parseMoodboardDocument(saved).boards.map(x=>x.title),['A']);
 const again=restore(storage,rawA);
 assert.equal(again,rawB);
 assert.equal(map.get(MAIN),rawB);
 assert.equal(map.get(PREVIOUS),rawA);
});
test('Denied first primary write after Previous replacement rolls both exact raw keys back',()=>{
 const {map,storage}=make();
 const set=storage.setItem.bind(storage);
 storage.setItem=(k,v)=>{if(k===MAIN)throw Error('PRIMARY_QUOTA');set(k,v)};
 assert.throws(()=>restore(storage,rawB),/PRIMARY_QUOTA/);
 assert.equal(map.get(MAIN),rawB);
 assert.equal(map.get(PREVIOUS),rawA);
});
test('Partial primary write then error is compensated, restoring old current and Previous',()=>{
 const {map,storage}=make();
 const set=storage.setItem.bind(storage);let affected=false;
 storage.setItem=(k,v)=>{set(k,v);if(k===MAIN&&!affected){affected=true;throw Error('PARTIAL_PRIMARY_QUOTA')}};
 assert.throws(()=>restore(storage,rawB),/PARTIAL_PRIMARY_QUOTA/);
 assert.equal(map.get(MAIN),rawB);
 assert.equal(map.get(PREVIOUS),rawA);
});
test('Stale second-tab CAS refuses restore without changing either key',()=>{
 const {map,storage,writes}=make();
 assert.throws(()=>restore(storage,rawA),/MOODBOARD_LOCAL_STALE/);
 assert.equal(map.get(MAIN),rawB);assert.equal(map.get(PREVIOUS),rawA);
 assert.deepEqual(writes,[]);
});
test('A denied primary rollback must still restore the original older Previous snapshot',()=>{
 const {map,storage}=make();
 const original=storage.setItem.bind(storage);let primary=0;
 storage.setItem=(k,v)=>{
  if(k===MAIN){
   if(++primary===1){original(k,v);throw Error('PRIMARY_PARTIAL_WRITE')}
   throw Error('PRIMARY_ROLLBACK_DENIED');
  }
  original(k,v);
 };
 assert.throws(()=>restore(storage,rawB),/MOODBOARD_LOCAL_ROLLBACK_UNVERIFIED/);
 assert.equal(map.get(PREVIOUS),rawA);
 assert.notEqual(map.get(MAIN),rawB,'partial current may change, but is never reported as Restored');
});
test('Malformed previous document cannot mutate a valid current document',()=>{
 const {map,storage,writes}=make(rawB,'{corrupt');
 assert.throws(()=>restore(storage,rawB));
 assert.equal(map.get(MAIN),rawB);
 assert.equal(map.get(PREVIOUS),'{corrupt');
 assert.deepEqual(writes,[]);
});
