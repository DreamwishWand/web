import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 WAND_FAVORITES_SCHEMA,WAND_FAVORITES_STORAGE_KEY,WAND_FAVORITES_BACKUP_KEY,
 WAND_FAVORITES_MAX_ITEMS,emptyWandFavorites,parseWandFavorites,
 changeWandFavorite,isWandFavorite,persistWandFavorite
} from '../src/lib/explore/wand-favorites-local.mjs';
import {EXPLORE_COPY} from '../src/lib/explore/copy.js';
const page=readFileSync(new URL('../src/routes/explore/+page.svelte',import.meta.url),'utf8');
const icons=readFileSync(new URL('../src/lib/ui/Icon.svelte',import.meta.url),'utf8');
const storage=()=>{
 const map=new Map();
 return {getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,String(v))},get all(){return map}};
};

test('Wand Favorite has a distinct bounded document and private namespace, not DDV Game Favorite, collection or Moodboard schema',()=>{
 const doc=emptyWandFavorites();
 assert.deepEqual(doc,{schema:'wand.explore.local-favorites@1',version:1,itemIds:[]});
 assert.equal(doc.schema,WAND_FAVORITES_SCHEMA);
 assert.notEqual(WAND_FAVORITES_STORAGE_KEY,'dreamwishwand:moodboards:v1');
 assert.notEqual(WAND_FAVORITES_STORAGE_KEY,WAND_FAVORITES_BACKUP_KEY);
 assert.equal(WAND_FAVORITES_MAX_ITEMS,5000);
 assert.deepEqual(parseWandFavorites(JSON.stringify(doc)),doc);
 const a=changeWandFavorite(doc,40000047,true);
 assert.equal(isWandFavorite(a,40000047),true);
 assert.equal(isWandFavorite(doc,40000047),false,'never mutate original document');
 assert.deepEqual(changeWandFavorite(a,40000047,true),a,'idempotent add');
 assert.deepEqual(changeWandFavorite(a,40000047,false),doc);
 assert.deepEqual(changeWandFavorite(a,40000047,false),doc);
});

test('Local primary storage writes preserve exact prior snapshot, retain independent Item IDs and reopen without saving Game Favorite',()=>{
 const s=storage();
 const first=persistWandFavorite(s,40000047,true);
 assert.deepEqual(first.itemIds,[40000047]);
 assert.equal(s.getItem(WAND_FAVORITES_BACKUP_KEY),null);
 const raw1=s.getItem(WAND_FAVORITES_STORAGE_KEY);
 const second=persistWandFavorite(s,40700007,true);
 assert.deepEqual(second.itemIds,[40000047,40700007]);
 assert.equal(s.getItem(WAND_FAVORITES_BACKUP_KEY),raw1);
 const raw2=s.getItem(WAND_FAVORITES_STORAGE_KEY);
 assert.deepEqual(parseWandFavorites(raw2),second);
 const after=persistWandFavorite(s,40000047,false);
 assert.deepEqual(after.itemIds,[40700007]);
 assert.equal(s.getItem(WAND_FAVORITES_BACKUP_KEY),raw2);
 assert.deepEqual(parseWandFavorites(s.getItem(WAND_FAVORITES_BACKUP_KEY)),second);
 assert.equal(persistWandFavorite(s,40000047,false).itemIds.length,1,'unchanged operation does not alter snapshot');
 assert.equal(s.getItem(WAND_FAVORITES_BACKUP_KEY),raw2);
 assert.deepEqual([...s.all.keys()].sort(),[WAND_FAVORITES_STORAGE_KEY,WAND_FAVORITES_BACKUP_KEY].sort(),'no game Save/Cloud/Moodboard write');
});

test('Malformed local source fails closed: duplicate/unsafe IDs, excessive capacity and corruption never replace original data',()=>{
 const s=storage();
 assert.throws(()=>changeWandFavorite(emptyWandFavorites(),-1,true),/TARGET_INVALID/);
 assert.throws(()=>changeWandFavorite(emptyWandFavorites(),1.5,true),/TARGET_INVALID/);
 assert.throws(()=>changeWandFavorite(emptyWandFavorites(),4294967296,true),/TARGET_INVALID/);
 assert.throws(()=>changeWandFavorite(emptyWandFavorites(),1,'true'),/TARGET_INVALID/);
 for(const invalid of [
   '', '{not-json', JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:2,itemIds:[]}),
   JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[7,7]}),
   JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:['7']}),
   JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:Array.from({length:5001},(_,i)=>i+1)}),
   ' '.repeat(100001)
 ])assert.throws(()=>parseWandFavorites(invalid));
 s.setItem(WAND_FAVORITES_STORAGE_KEY,'{broken');
 assert.throws(()=>persistWandFavorite(s,40000047,true));
 assert.equal(s.getItem(WAND_FAVORITES_STORAGE_KEY),'{broken');
 assert.equal(s.getItem(WAND_FAVORITES_BACKUP_KEY),null);
});

test('Explore uses first-party four-point sparkle and independent local controls/filter, never Save marker',()=>{
 assert.match(page,/import Icon from '\$lib\/ui\/Icon\.svelte'/);
 assert.match(icons,/sparkle:\s*\['M12 2c\.8 5\.3/);
 assert.match(page,/data-explore-wand-favorite/);
 assert.match(page,/data-explore-wand-favorites-only/);
 assert.match(page,/on:click=\{\(\)=>toggleWandFavorite\(item\)\}/);
 assert.match(page,/aria-pressed=\{isWandFavorite\(wandFavorites,Number\(item\.itemId\)\)\}/);
 assert.match(page,/<Icon name="sparkle" size=\{18\} decorative=\{true\}\/>/);
 assert.match(page,/filteredFavorites=wandFavoritesOnly\?filtered\.filter/);
 assert.match(page,/WAND_FAVORITES_STORAGE_KEY/);
 assert.match(page,/on:storage=\{handleWandFavoriteStorage\}/);
 assert.match(page,/data-explore-moodboard-toggle/);
 assert.match(page,/data-explore-card-review/);
 assert.doesNotMatch(page,/stage_steam626|changeGameFavorite|writeSaveFavorite|GameFavoriteMarker/);
 assert.doesNotMatch(page,/<Icon name="heart"/);
});

test('Eight languages distinguish Wand Favorite from board membership and Game Favorite',()=>{
 assert.equal(Object.keys(EXPLORE_COPY).length,8);
 for(const [locale,c] of Object.entries(EXPLORE_COPY)){
  for(const key of ['wandFavorite','wandFavoriteOnly','wandFavoriteAdd','wandFavoriteRemove','wandFavoriteSaved','wandFavoriteInvalid'])
   assert.ok(typeof c[key]==='string'&&c[key].trim().length>4,locale+' '+key);
  assert.notEqual(c.wandFavoriteAdd,c.add);
  assert.notEqual(c.wandFavoriteRemove,c.remove);
 }
});

test('Quota denial on current write preserves BOTH original document and previously committed backup bytes',()=>{
 const raw=JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40000047]});
 const prior=JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40700007]});
 const data=new Map([[WAND_FAVORITES_STORAGE_KEY,raw],[WAND_FAVORITES_BACKUP_KEY,prior]]);
 const s={
  getItem:k=>data.get(k)??null,
  setItem(k,v){if(k===WAND_FAVORITES_STORAGE_KEY)throw Error('SYNTHETIC_QUOTA_PRIMARY');data.set(k,String(v));}
 };
 assert.throws(()=>persistWandFavorite(s,30200001,true),/SYNTHETIC_QUOTA_PRIMARY/);
 assert.equal(data.get(WAND_FAVORITES_STORAGE_KEY),raw);
 assert.equal(data.get(WAND_FAVORITES_BACKUP_KEY),prior,'failed commit must not erase an older recoverable snapshot');
});

test('Failed first backup and first primary writes roll back without phantom favorites or other keys',()=>{
 const raw=JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40000047]});
 const foreign='{\"gameFavorite\":[\"KEEP\"]}';
 const data=new Map([[WAND_FAVORITES_STORAGE_KEY,raw],['dreamwishwand:game-favorite:v1',foreign]]);
 const s={
  getItem:k=>data.get(k)??null,
  setItem(k,v){if(k===WAND_FAVORITES_BACKUP_KEY)throw Error('SYNTHETIC_BACKUP_QUOTA');data.set(k,String(v));},
  removeItem:k=>data.delete(k)
 };
 assert.throws(()=>persistWandFavorite(s,40700007,true),/SYNTHETIC_BACKUP_QUOTA/);
 assert.equal(data.get(WAND_FAVORITES_STORAGE_KEY),raw);
 assert.equal(data.get(WAND_FAVORITES_BACKUP_KEY),undefined);
 const s2={
  getItem:k=>data.get(k)??null,
  setItem(k,v){if(k===WAND_FAVORITES_STORAGE_KEY)throw Error('SYNTHETIC_PRIMARY_QUOTA');data.set(k,String(v));},
  removeItem:k=>data.delete(k)
 };
 assert.throws(()=>persistWandFavorite(s2,40700007,true),/SYNTHETIC_PRIMARY_QUOTA/);
 assert.equal(data.get(WAND_FAVORITES_STORAGE_KEY),raw);
 assert.equal(data.get(WAND_FAVORITES_BACKUP_KEY),undefined,'new snapshot created before primary failure must be removed');
 assert.equal(data.get('dreamwishwand:game-favorite:v1'),foreign,'must not modify save-backed Favorite');
});

test('Unverifiable rollback never reports a successful Favorite commit',()=>{
 const raw=JSON.stringify({schema:WAND_FAVORITES_SCHEMA,version:1,itemIds:[40000047]});
 const data=new Map([[WAND_FAVORITES_STORAGE_KEY,raw]]);
 const s={
  getItem:k=>data.get(k)??null,
  setItem(k,v){if(k===WAND_FAVORITES_STORAGE_KEY)throw Error('SYNTHETIC_PRIMARY_QUOTA');data.set(k,String(v));},
  removeItem(){throw Error('SYNTHETIC_ROLLBACK_DENIED')}
 };
 assert.throws(()=>persistWandFavorite(s,40700007,true),/WAND_FAVORITES_ROLLBACK_UNVERIFIED/);
 assert.equal(data.get(WAND_FAVORITES_STORAGE_KEY),raw);
});


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
