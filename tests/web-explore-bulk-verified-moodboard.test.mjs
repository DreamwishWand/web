import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 planVerifiedExploreMoodboardBatch,verifiedMoodboardBatchCopy,
 EXPLORE_MOODBOARD_BATCH_MAX,EXPLORE_MOODBOARD_BATCH_LOCALES
} from '../src/lib/explore/verified-moodboard-batch.mjs';
import {
 createEmptyMoodboardDocument,createMoodboard,MOODBOARD_STORAGE_KEY,
 MOODBOARD_BACKUP_KEY,serializeMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {persistMoodboardLocalChange} from '../src/lib/moodboards/local-persist-compensated.mjs';
const time='2026-11-20T08:00:00.000Z';
const doc=()=>createMoodboard(createEmptyMoodboardDocument(time),{title:'Local'},{
 now:time,idFactory:()=> 'verified'
}).document;
const row=(id,extra={})=>Object.freeze({
 itemId:id,family:'Furniture',label:'Verified '+id,...extra
});
const rows=n=>Object.freeze(Array.from({length:n},(_,i)=>row(40000047+i)));
const options={now:time};
const refs=(document)=>document.boards[0].references;
function store(primary=null,backup=null,options={}){
 const values=new Map();
 if(primary!==null)values.set(MOODBOARD_STORAGE_KEY,primary);
 if(backup!==null)values.set(MOODBOARD_BACKUP_KEY,backup);
 let writes=0;
 return {
  get writes(){return writes},
  getItem:k=>values.has(k)?values.get(k):null,
  setItem(k,v){
   writes++;
   if(options.failKey===k&&(!options.failAt || writes===options.failAt))throw Error('STORAGE_QUOTA');
   values.set(k,String(v));
  },
  removeItem(k){values.delete(k)}
 };
}
test('one 24-item bounded verified visible batch builds a single local document; repeated click is no-op',()=>{
 const verified=rows(40),initial=doc();
 const x=planVerifiedExploreMoodboardBatch(initial,initial.boards[0].id,verified.slice(0,35),verified,options);
 assert.equal(x.added,24);
 assert.deepEqual(x.ids,verified.slice(0,24).map(r=>r.itemId));
 assert.equal(refs(initial).length,0,'source document immutable');
 assert.equal(refs(x.document).length,24);
 assert.ok(refs(x.document).every(r=>r.type==='ITEM'&&r.url===null&&r.groupIds.length===0));
 const y=planVerifiedExploreMoodboardBatch(x.document,initial.boards[0].id,verified.slice(0,35),verified,options);
 assert.equal(y.added,11,'skip old and add only new visible matches');
 const z=planVerifiedExploreMoodboardBatch(y.document,initial.boards[0].id,verified.slice(0,35),verified,options);
 assert.equal(z.added,0);
 assert.equal(refs(z.document).length,35);
});
test('strict same-source catalog identity, duplicate/forged IDs, ambiguous verified records and unauthorized family all denied',()=>{
 const d=doc(),v=rows(3),id=d.boards[0].id;
 const variants=[
  [v.map(r=>({...r})),v],
  [[{...v[0],itemId:123456}],v],
  [[v[0],v[0]],v],
  [[v[0]], [...v,v[0]]],
  [[row(99999999,{family:'DLC'})],[row(99999999,{family:'DLC'})]],
  [[v[0]],[]],
  [Array.from({length:121},()=>v[0]),v]
 ];
 for(const [shown,verified] of variants){
  assert.throws(()=>planVerifiedExploreMoodboardBatch(d,id,shown,verified,options),/EXPLORE_BULK_MOODBOARD_/);
 }
 assert.throws(()=>planVerifiedExploreMoodboardBatch(d,'missing',[v[0]],v,options));
 assert.equal(refs(d).length,0);
});
test('all-or-nothing capacity refusal before any localStorage mutation',()=>{
 const d=doc(),v=rows(4),id=d.boards[0].id;
 d.boards[0].references=Array.from({length:499},(_,i)=>({
  id:'note_'+i,type:'NOTE',label:'Existing '+i,createdAt:time,groupIds:[],entityId:null
 }));
 const before=JSON.stringify(d);
 assert.throws(()=>planVerifiedExploreMoodboardBatch(d,id,v,v,options),/CAPACITY_EXCEEDED_NO_PARTIAL_COMMIT/);
 assert.equal(JSON.stringify(d),before);
});
test('one compensated CAS writes original backup then new primary; stale other tab denies without writes',()=>{
 const d=doc(),v=rows(5),original=serializeMoodboardDocument(d);
 const local=store(original,'previous snapshot');
 const batch=planVerifiedExploreMoodboardBatch(d,d.boards[0].id,v,v,options);
 const nextRaw=persistMoodboardLocalChange(local,batch.document,original);
 assert.equal(local.writes,2,'no per-item storage writes');
 assert.equal(local.getItem(MOODBOARD_BACKUP_KEY),original);
 assert.equal(local.getItem(MOODBOARD_STORAGE_KEY),nextRaw);
 const beforeWrites=local.writes;
 assert.throws(()=>persistMoodboardLocalChange(local,d,original),/STALE/);
 assert.equal(local.writes,beforeWrites);
 assert.equal(local.getItem(MOODBOARD_BACKUP_KEY),original);
});
test('quota denial compensates both raw local snapshots, never commits subset',()=>{
 const d=doc(),v=rows(4),old=serializeMoodboardDocument(d);
 const local=store(old,'old backup',{failKey:MOODBOARD_STORAGE_KEY});
 const batch=planVerifiedExploreMoodboardBatch(d,d.boards[0].id,v,v,options);
 assert.throws(()=>persistMoodboardLocalChange(local,batch.document,old));
 assert.equal(local.getItem(MOODBOARD_STORAGE_KEY),old);
 assert.equal(local.getItem(MOODBOARD_BACKUP_KEY),'old backup');
});
test('8 locale copy, accessible actual Svelte button and Save/Media/ownership boundary',()=>{
 assert.equal(EXPLORE_MOODBOARD_BATCH_MAX,24);
 assert.deepEqual([...EXPLORE_MOODBOARD_BATCH_LOCALES],
  ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']);
 for(const locale of EXPLORE_MOODBOARD_BATCH_LOCALES){
  const copy=verifiedMoodboardBatchCopy(locale);
  for(const k of ['action','added','already','blocked'])
   assert.ok(typeof copy[k]==='string'&&copy[k].length>6,locale+'/'+k);
 }
 const ui=readFileSync(new URL('../src/routes/explore/+page.svelte',import.meta.url),'utf8');
 assert.match(ui,/data-explore-bulk-moodboard-add/);
 assert.match(ui,/data-auto-cloud="off"/);
 assert.match(ui,/data-game-save-writer="off"/);
 assert.match(ui,/data-catalog-personal-owned="unknown"/);
 assert.match(ui,/planVerifiedExploreMoodboardBatch\(moodboards,selectedBoardId,visible,decorationRecords\)/);
 assert.match(ui,/persistMoodboards\(planned.document\)/);
 assert.match(ui,/disabled=\{!visible.some/);
 assert.match(ui,/on:click=\{addVisibleToMoodboard\}/);
 assert.doesNotMatch(ui,/setGameFavorite|setOwnership|stageScopedAmount|begin_scoped_amount_output/);
});
