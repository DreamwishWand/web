import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimingWorkerReadCore, TIMING_WORKER_WRITER_ENABLED, SWITCH_1253_BID }
  from '../src/lib/timing/local-worker-read-core.mjs';
import { filterRecurringEventsReadonly } from '../src/lib/timing/recurring-readonly.mjs';

const sample = () => new Blob([new Uint8Array([3, 5, 7, 9])], {type:'application/octet-stream'});
const rows = Object.freeze([
  {mapKey:'155',eventId:2010000021,oneof:'ItemSpawning',name:'Wood',group:'Spawn',
    nextOccurrence:'2126-08-20T00:00:00Z',items:[{linkIndex:0,itemId:31700014,en:'Softwood',ja:'木材'}]},
  {mapKey:'156',eventId:2010500008,oneof:'FlowerSpawningInVillage',name:'Flower',group:'Spawn',
    nextOccurrence:'2025-01-01T00:00:00Z',items:[]}
]);
const goodOpened = () => ({
  inputFormat:'packaged',profileSchemaVersion:626,
  profile:{GameInfo:{Version:626},Player:{},World:{RecurringEvents:{}}},
  compatibility:{productionReadAccepted:true,readOnly:true,editingAuthorized:false,persistentWriteAuthorized:false}
});
const fake = (overrides={}) => createTimingWorkerReadCore({
  openSave:async()=>goodOpened(),
  project:()=>({writerAuthorized:false,encodeCopyAuthorized:false,
    savedContainerCount:2,unsupportedContainerCount:0,rows}),
  filter:filterRecurringEventsReadonly,...overrides
});
const bid={buildId:SWITCH_1253_BID,sourceConfirmed:true,registry:{source:'synthetic'}};
const open=(core,file=sample())=>core.open({...bid,file});

test('Worker mints source-bound read lease and only returns projected rows',async()=>{
 const worker=fake();
 const b=sample();const original=Buffer.from(await b.arrayBuffer());
 const ticket=await open(worker,b);
 assert.match(ticket.sessionId,/^[0-9a-f]{32}$/);
 assert.match(ticket.sourceSha256,/^[0-9a-f]{64}$/);
 assert.equal(ticket.sourceSchema,626);
 assert.equal(ticket.writerAuthorized,false);
 assert.equal(ticket.productRustWorkerAccepted,false);
 assert.equal('profile' in ticket,false);
 const page=await worker.query({limit:1});
 assert.equal(page.total,2);
 assert.equal(page.rows.length,1);
 assert.equal(page.rows[0].eventId,2010000021);
 assert.equal(page.complete,false);
 assert.equal(page.writerAuthorized,false);
 assert.equal('profile' in page,false);
 assert.deepEqual(Buffer.from(await b.arrayBuffer()),original);
 const old=page.nextCursor;
 const second=await worker.query({search:'',cursor:old,limit:1});
 assert.equal(second.rows[0].mapKey,'156');
 assert.equal(second.complete,true);
 await assert.rejects(worker.query({cursor:old,limit:1}),/READ_CURSOR_REPLAY_OR_SCOPE|READ_CURSOR_EXHAUSTED/);
});
test('ItemID query is scoped and source-indexed, not a UI-supplied event array',async()=>{
 const core=fake();await open(core);
 const rowsPage=await core.query({search:'31700014',limit:64});
 assert.equal(rowsPage.total,1);
 assert.equal(rowsPage.rows[0].eventId,2010000021);
 assert.equal(rowsPage.rows[0].items[0].itemId,31700014);
 assert.equal(rowsPage.complete,true);
 const next=await core.query({search:'2010500008',cursor:null,limit:1});
 assert.equal(next.total,1);
 assert.equal(next.rows[0].mapKey,'156');
});
test('invalid external BID, provenance and source bounds fail closed and revoke A',async()=>{
 const core=fake();const a=await open(core);
 await assert.rejects(core.open({...bid,file:sample(),sourceConfirmed:false}),/READ_EXTERNAL_BUILD_REQUIRED/);
 assert.equal(core.status().active,false);
 await assert.rejects(core.query({}),/READ_SESSION_NOT_OPEN/);
 await assert.rejects(core.open({...bid,file:sample(),buildId:'0000000000000000'}),/READ_EXTERNAL_BUILD_REQUIRED/);
 await assert.rejects(core.open({...bid,file:new Blob([])}),/READ_FILE_BOUNDS/);
 const b=await open(core); assert.notEqual(a.sessionId,b.sessionId);
});
test('separate Worker instances with same file never reuse signed Cursor or session identity',async()=>{
 const first=fake(),second=fake();
 const a=await open(first),b=await open(second);
 assert.notEqual(a.sessionId,b.sessionId);
 const x=await first.query({limit:1});
 const y=await second.query({limit:1});
 assert.notEqual(x.nextCursor,y.nextCursor);
 await assert.rejects(second.query({cursor:x.nextCursor,limit:1}),/READ_CURSOR_REPLAY_OR_SCOPE/);
 const okay=await second.query({cursor:y.nextCursor,limit:1});
 assert.equal(okay.complete,true);
});
test('forged/overflow Cursor and disallowed limits rejected without advancing page',async()=>{
 const core=fake();await open(core);
 await assert.rejects(core.query({limit:65}),/READ_QUERY_BOUNDS/);
 await assert.rejects(core.query({limit:0}),/READ_QUERY_BOUNDS/);
 const p=await core.query({limit:1});
 await assert.rejects(core.query({cursor:'w1r1.1.'+'f'.repeat(64),limit:1}),/READ_CURSOR_REPLAY_OR_SCOPE/);
 const second=await core.query({cursor:p.nextCursor,limit:1});
 assert.equal(second.rows[0].mapKey,'156');
});
test('A-to-B during asynchronous decode or close refuses late A read result',async()=>{
 let release, notifyEntered;
 const gate=new Promise(resolve=>{release=resolve;});
 const entered=new Promise(resolve=>{notifyEntered=resolve;});
 let calls=0;
 const core=fake({openSave:async()=>{
   ++calls;
   if(calls===1) { notifyEntered(); await gate; }
   return goodOpened();
 }});
 const pending=core.open({...bid,file:sample()});
 const denied=assert.rejects(pending,/READ_OPEN_REVOKED/);
 await entered; // Ensure A, not B, owns the artificially stalled decode.
 const fresh=await open(core);
 assert.equal(fresh.writerAuthorized,false);
 release();
 await denied;
 assert.equal((await core.query({limit:1})).rows.length,1);
 core.close();
 await assert.rejects(core.query({limit:1}),/READ_SESSION_NOT_OPEN/);
});
test('unsupported schema or any writer-like authority in decoded source denied',async()=>{
 const core=fake({openSave:async()=>({...goodOpened(),profileSchemaVersion:624})});
 await assert.rejects(open(core),/READ_SCHEMA626_CONTRACT_DENIED/);
 const writer=fake({project:()=>({writerAuthorized:true,encodeCopyAuthorized:false,rows})});
 await assert.rejects(open(writer),/READ_W1_PROJECTION_DENIED/);
 assert.equal(TIMING_WORKER_WRITER_ENABLED,false);
});
