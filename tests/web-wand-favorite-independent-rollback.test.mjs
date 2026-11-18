import test from 'node:test';
import assert from 'node:assert/strict';
import {
 WAND_FAVORITES_SCHEMA,WAND_FAVORITES_STORAGE_KEY,WAND_FAVORITES_BACKUP_KEY,
 persistWandFavorite
} from '../src/lib/explore/wand-favorites-local.mjs';

// Genuine negative combinations absent from the older accepted 8 tests.
// These never supply a game Save, auth token, or public signed media.
test('Postwrite primary exception plus denied primary rollback STILL independently restores prior backup raw bytes',()=>{
 const raw=JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40000047]});
 const previous='  '+JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40700007]})+'  ';
 const data=new Map([[WAND_FAVORITES_STORAGE_KEY,raw],[WAND_FAVORITES_BACKUP_KEY,previous]]);
 const attempts=[];
 let primary=0;
 const s={
  getItem:k=>data.get(k)??null,
  setItem(k,v){
   attempts.push(k);
   if(k===WAND_FAVORITES_STORAGE_KEY){
    if(++primary===1){data.set(k,String(v));throw Error('SYNTHETIC_POSTWRITE_PRIMARY_FAILURE');}
    throw Error('SYNTHETIC_PRIMARY_RESTORE_DENIED');
   }
   data.set(k,String(v));
  }
 };
 assert.throws(()=>persistWandFavorite(s,30200001,true),/WAND_FAVORITES_ROLLBACK_UNVERIFIED/);
 assert.equal(data.get(WAND_FAVORITES_BACKUP_KEY),previous,
  'independent prior raw snapshot must be restored even when current cannot be rolled back');
 assert.notEqual(data.get(WAND_FAVORITES_STORAGE_KEY),raw,'an unverified primary must never be called committed');
 assert.deepEqual(attempts,[
  WAND_FAVORITES_BACKUP_KEY,WAND_FAVORITES_STORAGE_KEY,
  WAND_FAVORITES_BACKUP_KEY,WAND_FAVORITES_STORAGE_KEY
 ],'attempt both independent compensations in recovery-first order');
});
test('Denied backup compensation cannot skip restoring a partially mutated primary',()=>{
 const raw=JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40000047]});
 const previous='ORIGINAL_PREVIOUS_BYTES_NOT_A_GAME_SAVE';
 const data=new Map([[WAND_FAVORITES_STORAGE_KEY,raw],[WAND_FAVORITES_BACKUP_KEY,previous]]);
 const attempts=[];
 let backup=0,primary=0;
 const s={
  getItem:k=>data.get(k)??null,
  setItem(k,v){
   attempts.push(k);
   if(k===WAND_FAVORITES_BACKUP_KEY&&++backup>1)throw Error('SYNTHETIC_BACKUP_RESTORE_DENIED');
   if(k===WAND_FAVORITES_STORAGE_KEY&&++primary===1){
    data.set(k,String(v));throw Error('SYNTHETIC_POSTWRITE_PRIMARY_FAILURE');
   }
   data.set(k,String(v));
  }
 };
 assert.throws(()=>persistWandFavorite(s,30200001,true),/WAND_FAVORITES_ROLLBACK_UNVERIFIED/);
 assert.equal(data.get(WAND_FAVORITES_STORAGE_KEY),raw,
  'original primary is recovered even when previous snapshot restoration is denied');
 assert.notEqual(data.get(WAND_FAVORITES_BACKUP_KEY),previous);
 assert.deepEqual(attempts,[
  WAND_FAVORITES_BACKUP_KEY,WAND_FAVORITES_STORAGE_KEY,
  WAND_FAVORITES_BACKUP_KEY,WAND_FAVORITES_STORAGE_KEY
 ]);
});
test('Silent partial primary commit is rejected and restores exact raw current and prior bytes',()=>{
 const raw='\t'+JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40000047]})+' ';
 const previous=' '+JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40700007]});
 const data=new Map([[WAND_FAVORITES_STORAGE_KEY,raw],[WAND_FAVORITES_BACKUP_KEY,previous]]);
 const s={getItem:k=>data.get(k)??null,
  setItem(k,v){if(k!==WAND_FAVORITES_STORAGE_KEY)data.set(k,String(v))}};
 assert.throws(()=>persistWandFavorite(s,30200001,true),/WAND_FAVORITES_COMMIT_UNVERIFIED/);
 assert.equal(data.get(WAND_FAVORITES_STORAGE_KEY),raw);
 assert.equal(data.get(WAND_FAVORITES_BACKUP_KEY),previous);
});
