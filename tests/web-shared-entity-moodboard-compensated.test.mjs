import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MOODBOARD_STORAGE_KEY as MAIN,MOODBOARD_BACKUP_KEY as PREVIOUS,
 createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument,parseMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {addCatalogEntityToMoodboard} from '../src/lib/entity/entity-moodboard-action.mjs';
import {persistMoodboardLocalChange} from '../src/lib/moodboards/local-persist-compensated.mjs';

const svelte=readFileSync(new URL('../src/lib/entity/SharedEntityDetail.svelte',import.meta.url),'utf8');
const t='2026-11-18T00:00:00.000Z';
const sample={status:'FOUND',canExplore:true,source:{
 platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'
},item:{itemId:40000047,label:'Verified furniture',family:'Furniture'}};
const original=()=>{
 const result=createMoodboard(createEmptyMoodboardDocument(t),{title:'Detail Board'},
  {now:t,idFactory:()=>1});return {document:result.document,id:result.board.id};
};
const setup=(map)=>({
 getItem:key=>map.has(key)?map.get(key):null,
 setItem:(key,v)=>map.set(key,String(v)),
 removeItem:key=>map.delete(key)
});
test('Detail UI uses same local Moodboard helper, not unsafe backup-first raw writes',()=>{
 assert.match(svelte,/persistMoodboardLocalChange\(localStorage, result\.document, current\)/);
 assert.doesNotMatch(svelte,/setItem\(MOODBOARD_BACKUP_KEY/);
 assert.doesNotMatch(svelte,/setItem\(MOODBOARD_STORAGE_KEY/);
 assert.match(svelte,/current === null \? createEmptyMoodboardDocument\(\) : parseMoodboardDocument\(current\)/);
 assert.match(svelte,/moodboardStatus = moodCopy\.invalid/);
 const apply=svelte.indexOf('persistMoodboardLocalChange(localStorage, result.document, current)');
 const display=svelte.indexOf('moodboardDocument = result.document');
 assert.ok(apply>0&&display>apply,'display commit only after real stored commit success');
});
test('Detail path typed item preserves exact old raw snapshot and can independently reopen',()=>{
 const {document,id}=original(),raw=serializeMoodboardDocument(document),prior='old recoverable';
 const map=new Map([[MAIN,raw],[PREVIOUS,prior]]),storage=setup(map);
 const proposal=addCatalogEntityToMoodboard(document,id,sample,{now:t,idFactory:()=>2});
 const next=persistMoodboardLocalChange(storage,proposal.document,raw);
 assert.equal(map.get(MAIN),next);assert.equal(map.get(PREVIOUS),raw);
 assert.equal(parseMoodboardDocument(next).boards[0].references[0].entityId,'40000047');
 assert.deepEqual([...map.keys()].sort(),[MAIN,PREVIOUS].sort());
});
test('Detail primary quota failure retains BOTH main and old backup, no new reference',()=>{
 const {document,id}=original(),raw=serializeMoodboardDocument(document);
 const prior='original previous before Detail',map=new Map([[MAIN,raw],[PREVIOUS,prior]]);
 const storage=setup(map),real=storage.setItem.bind(storage);
 storage.setItem=(key,value)=>{if(key===MAIN)throw Error('SYNTHETIC_PRIMARY_QUOTA');real(key,value)};
 const proposed=addCatalogEntityToMoodboard(document,id,sample,{now:t,idFactory:()=>2});
 assert.throws(()=>persistMoodboardLocalChange(storage,proposed.document,raw),/SYNTHETIC_PRIMARY_QUOTA/);
 assert.equal(map.get(MAIN),raw);assert.equal(map.get(PREVIOUS),prior);
});
test('Detail read then stale concurrent change fails closed; unauthorized Source remains denied',()=>{
 const {document,id}=original(),raw=serializeMoodboardDocument(document);
 const map=new Map([[MAIN,raw],[PREVIOUS,'prior']]),storage=setup(map);
 const next=addCatalogEntityToMoodboard(document,id,sample,{now:t,idFactory:()=>2}).document;
 map.set(MAIN,serializeMoodboardDocument(next));
 assert.throws(()=>persistMoodboardLocalChange(storage,next,raw),/MOODBOARD_LOCAL_STALE/);
 assert.equal(map.get(PREVIOUS),'prior');
 for(const bad of [
  {...sample,source:{...sample.source,buildID:'UNKNOWN'}},
  {...sample,canExplore:false},
  {...sample,item:{...sample.item,itemId:0}}
 ])assert.throws(()=>addCatalogEntityToMoodboard(document,id,bad));
});
