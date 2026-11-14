import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument,MOODBOARD_STORAGE_KEY as P,MOODBOARD_BACKUP_KEY as B} from '../src/lib/moodboards/store.js';
import {exportPortableMoodboard,importPortableMoodboard,readMoodboardMigrationSnapshot as read,MOODBOARD_PORTABLE_MAX_BYTES,decodePortableMoodboardBytes} from '../src/lib/moodboards/origin-portability.mjs';
const t='2026-11-14T00:00:00.000Z';
const raw=(title)=>serializeMoodboardDocument(createMoodboard(createEmptyMoodboardDocument(t),{title},{now:t,idFactory:()=>title}).document);
const empty=serializeMoodboardDocument(createEmptyMoodboardDocument(t));
const a=raw('source'),b=raw('target');
function store(primary=null,backup=null){
 const m=new Map();if(primary!==null)m.set(P,primary);if(backup!==null)m.set(B,backup);
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};
}
test('canonical old-origin current and previous export; separate empty destination; exact reopen and idempotence',()=>{
 const old=store(a,b),target=store();
 assert.equal(exportPortableMoodboard(old),a);assert.equal(exportPortableMoodboard(old,true),b);
 assert.equal(importPortableMoodboard(target,read(target),a).status,'IMPORTED');
 assert.deepEqual(read(target),{primary:a,backup:null});assert.deepEqual(read(old),{primary:a,backup:b});
 assert.equal(importPortableMoodboard(target,read(target),a).status,'UNCHANGED');
});
test('nonempty primary, nonempty backup, corrupt slot, stale read all preserve both',()=>{
 for(const target of [store(b,a),store(empty,b),store('bad',null),store(null,'bad')]){
  const before=read(target);assert.throws(()=>importPortableMoodboard(target,before,a),/MOODBOARD_PORTABLE_/);assert.deepEqual(read(target),before);
 }
 const target=store(),expected=read(target);target.setItem(B,b);
 assert.throws(()=>importPortableMoodboard(target,expected,a),/STALE/);assert.deepEqual(read(target),{primary:null,backup:b});
});
test('lossy current-format mutations, malformed, unknown version, oversize, duplicate keys rejected without writes',()=>{
 const target=store(),before=read(target);
 const doc=JSON.parse(a);
 for(const value of ['bad',a.replace('"version": 2','"version": 99'),a.replace('"boards":','"extra": true, "boards":'),a.replace('"version": 2','"version": 2, "version": 2'),JSON.stringify({...doc,boards:Array(101).fill(doc.boards[0])}),JSON.stringify({...doc,boards:[{...doc.boards[0],references:[{id:'x',type:'NOTE',label:'x',groupIds:['unknown']}]}]}),'x'.repeat(MOODBOARD_PORTABLE_MAX_BYTES+1)]){
  assert.throws(()=>importPortableMoodboard(target,before,value),/INVALID/);assert.deepEqual(read(target),before);
 }
});
test('quota error leaves existing empty primary and backup unchanged; noncanonical source never exports',()=>{
 const target=store(empty,empty),before=read(target);target.setItem=()=>{throw Error('QUOTA');};
 assert.throws(()=>importPortableMoodboard(target,before,a),/QUOTA/);assert.deepEqual(read(target),before);
 assert.throws(()=>exportPortableMoodboard(store('bad',null)),/INVALID/);
 assert.throws(()=>exportPortableMoodboard(store(a,null),true),/INVALID/);
});

test('original UTF-8 file boundary retains legitimate Unicode and rejects lossy byte forms before writes',()=>{
 const canonical=raw('QA é 日本語 � 🎹');
 const good=Buffer.from(canonical);
 const target=store(),before=read(target);
 const replacement=Buffer.from(raw('QA X'));
 const at=replacement.indexOf(Buffer.from('QA X'))+3;
 assert.ok(at>=3);
 const mutate=bytes=>Buffer.concat([replacement.subarray(0,at),Buffer.from(bytes),replacement.subarray(at+1)]);
 const bad=[mutate([0xff]),mutate([0x80]),mutate([0xe3,0x28,0xa1]),mutate([0xe3,0x81]),mutate([0xc0,0xaf]),mutate([0xed,0xa0,0x80]),mutate([0xf4,0x90,0x80,0x80]),Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),good]),Buffer.alloc(0),Buffer.alloc(MOODBOARD_PORTABLE_MAX_BYTES+1)];
 for(const bytes of bad){
  assert.throws(()=>importPortableMoodboard(target,before,decodePortableMoodboardBytes(bytes)),/MOODBOARD_PORTABLE_INVALID/);
  assert.deepEqual(read(target),before);
 }
 assert.equal(decodePortableMoodboardBytes(good),canonical);
 assert.equal(importPortableMoodboard(target,before,decodePortableMoodboardBytes(good)).status,'IMPORTED');
 assert.deepEqual(Buffer.from(exportPortableMoodboard(target)),good);
 assert.equal(read(target).backup,null);
 assert.throws(()=>decodePortableMoodboardBytes('not bytes'),/MOODBOARD_PORTABLE_INVALID/);
});
