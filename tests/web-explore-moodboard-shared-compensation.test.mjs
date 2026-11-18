import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXPLORE_COPY} from '../src/lib/explore/copy.js';
import {
 MOODBOARD_STORAGE_KEY as MAIN,MOODBOARD_BACKUP_KEY as PREVIOUS,
 createEmptyMoodboardDocument,createMoodboard,addMoodboardReference,
 parseMoodboardDocument,serializeMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {persistMoodboardLocalChange} from '../src/lib/moodboards/local-persist-compensated.mjs';

const route=readFileSync(new URL('../src/routes/explore/+page.svelte',import.meta.url),'utf8');
const stamp='2026-11-18T00:00:00.000Z';
const make=()=>{
 const d=createMoodboard(createEmptyMoodboardDocument(stamp),{title:'Explore local'},{now:stamp,idFactory:()=>1}).document;
 const b=d.boards[0];return {d,b};
};
function storage(initial){
 const values=new Map(initial),writes=[];
 return {values,writes,
  getItem(k){return values.get(k)??null},
  setItem(k,v){writes.push(k);values.set(k,String(v))},
  removeItem(k){writes.push('remove:'+k);values.delete(k)}
 };
}
test('Explore code routes BOTH add/remove through accepted shared helper and raw CAS; no shadow local writer',()=>{
 assert.match(route,/import \{ persistMoodboardLocalChange \} from '\$lib\/moodboards\/local-persist-compensated\.mjs'/);
 assert.match(route,/moodboardsRaw=persistMoodboardLocalChange\(localStorage,next,moodboardsRaw\)/);
 assert.match(route,/moodboards=next;/);
 assert.match(route,/const stored=localStorage\.getItem\(MOODBOARD_STORAGE_KEY\)/);
 assert.match(route,/moodboardsRaw=stored/);
 assert.match(route,/on:storage=\{handleExploreStorage\}/);
 assert.match(route,/handleWandFavoriteStorage\(event\)/);
 assert.match(route,/event\.key!==MOODBOARD_STORAGE_KEY/);
 assert.match(route,/status=copy\.moodboardSaveFailed/);
 assert.doesNotMatch(route,/localStorage\.setItem\(MOODBOARD_BACKUP_KEY,current\)/);
 assert.doesNotMatch(route,/localStorage\.setItem\(MOODBOARD_STORAGE_KEY,serializeMoodboardDocument\(next\)\)/);
});
test('Successful Explore item add/removal retains exactly full raw A then B backup',()=>{
 const {d,b}=make(),rawA=serializeMoodboardDocument(d);
 const s=storage([[MAIN,rawA],[PREVIOUS,'legacy-previous']]);
 const add=addMoodboardReference(d,b.id,{type:'ITEM',label:'Plant',entityId:'40000047'}, {now:stamp,idFactory:()=>2}).document;
 const rawB=persistMoodboardLocalChange(s,add,rawA);
 assert.equal(s.getItem(MAIN),rawB);assert.equal(s.getItem(PREVIOUS),rawA);
 assert.equal(parseMoodboardDocument(rawB).boards[0].references.length,1);
 const removed={...add,boards:[{...add.boards[0],references:[]}]};
 const rawC=persistMoodboardLocalChange(s,removed,rawB);
 assert.equal(s.getItem(MAIN),rawC);assert.equal(s.getItem(PREVIOUS),rawB);
 assert.equal(parseMoodboardDocument(rawC).boards[0].references.length,0);
 assert.deepEqual([...s.values.keys()].sort(),[MAIN,PREVIOUS].sort());
});
test('Denied primary after replacing prior backup does not mutate either accepted snapshot',()=>{
 const {d,b}=make(),raw=serializeMoodboardDocument(d),prior='separate valid older previous';
 const s=storage([[MAIN,raw],[PREVIOUS,prior]]);
 const edited=addMoodboardReference(d,b.id,{type:'ITEM',label:'Plant',entityId:'40000047'},{now:stamp,idFactory:()=>2}).document;
 const real=s.setItem.bind(s);
 s.setItem=(key,value)=>{if(key===MAIN)throw Error('SYNTHETIC_WEB_STORAGE_QUOTA');real(key,value)};
 assert.throws(()=>persistMoodboardLocalChange(s,edited,raw),/SYNTHETIC_WEB_STORAGE_QUOTA/);
 assert.equal(s.getItem(MAIN),raw);assert.equal(s.getItem(PREVIOUS),prior);
});
test('Stale tab or invalid raw source never alters previous snapshot or accepted later board',()=>{
 const {d,b}=make(),raw=serializeMoodboardDocument(d),s=storage([[MAIN,raw],[PREVIOUS,'before']]);
 const changed=addMoodboardReference(d,b.id,{type:'ITEM',label:'New',entityId:'40000047'},{now:stamp,idFactory:()=>2}).document;
 const newer=serializeMoodboardDocument(changed);
 s.setItem(MAIN,newer);s.writes.length=0;
 assert.throws(()=>persistMoodboardLocalChange(s,d,raw),/MOODBOARD_LOCAL_STALE/);
 assert.equal(s.getItem(MAIN),newer);assert.equal(s.getItem(PREVIOUS),'before');
 assert.deepEqual(s.writes,[]);
});
test('Eight locales disclose failed/uncertain commit; no Game Favorite or server write implied',()=>{
 assert.deepEqual(Object.keys(EXPLORE_COPY).sort(),['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'].sort());
 for(const [loc,copy] of Object.entries(EXPLORE_COPY)){
  assert.ok(copy.moodboardSaveFailed?.length>12,loc);
  assert.notEqual(copy.moodboardSaveFailed,copy.add,loc);
  assert.notEqual(copy.moodboardSaveFailed,copy.wandFavoriteSaved,loc);
 }
 assert.doesNotMatch(route,/saveGameFavorite\(|fetch\([^)]*moodboard|postMessage\([^)]*moodboard/);
});
