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
