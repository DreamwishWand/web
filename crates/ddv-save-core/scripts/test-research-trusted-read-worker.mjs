// Research-only Worker bridge regression. No Rust/WASM module or save in CI.
import assert from 'node:assert/strict';
import {createResearchReadIngress,PRODUCT_READ_ENABLED,PRODUCT_WRITER_ENABLED}
 from './research-trusted-read-worker.mjs';
assert.equal(PRODUCT_READ_ENABLED,false);
assert.equal(PRODUCT_WRITER_ENABLED,false);
const fakePage = (index=0) => ({
 rows:[{event_id:2010000021,saved_index:index,decoded_timestamp_utc:'2126-08-20T00:00:00Z'}],
 total_w1_rows:2,complete:false,next_cursor:'core-issued-cursor',
 product_read_worker_accepted:false,product_writer_authorized:false,
 full_domain_reference_closure_complete:false
});
let seq=0,closed=[],calls=[];
const core={
 async openLocalTrusted(bytes) {
  calls.push({type:'OPEN',len:bytes.length});
  return {session_id:++seq,index_generation:seq,revision:0,
    product_read_worker_accepted:false,product_writer_authorized:false};
 },
 async queryIndexedPage(ticket,cursor,limit) {
  calls.push({type:'QUERY',ticket,cursor,limit});
  return fakePage();
 },
 async close(ticket){closed.push(ticket.session_id);}
};
const ingress=createResearchReadIngress(core);
let v=await ingress.dispatch({type:'OPEN_LOCAL',bytes:new Uint8Array([1,2,3]),
 sessionId:123,sourceSha:'forged'});
assert.equal(v.ok,false);
assert.equal(v.reason,'WORKER_OPEN_BOUNDS_OR_FAKE_METADATA');
assert.equal(calls.length,0);
v=await ingress.dispatch({type:'OPEN_LOCAL',bytes:new Uint8Array([1,2,3])});
assert.equal(v.ok,true);
assert.equal(v.ticket.session_id,1);
assert.equal(v.productReadAccepted,false);
assert.equal(v.productWriterAuthorized,false);
v=await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:3,
 complete:true,session_id:1,capability:'WRITE'});
assert.equal(v.ok,false);
assert.equal(v.reason,'WORKER_QUERY_INVALID_OR_FORGED_CLAIM');
for(const type of ['ENCODE_COPY','STAGE_CHANGESET','UNDO','REDO','PERSISTENT_REPLACE','APPLY','EXPORT']) {
 v=await ingress.dispatch({type});
 assert.equal(v.ok,false);
 assert.equal(v.reason,'PRODUCT_SAVE_OPERATION_NOT_ACCEPTED');
}
v=await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:65});
assert.equal(v.ok,false);
v=await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:2});
assert.equal(v.ok,true);
assert.equal(v.page.rows[0].event_id,2010000021);
assert.equal(calls.at(-1).ticket.session_id,1);
v=await ingress.dispatch({type:'OPEN_LOCAL',bytes:new Uint8Array([9])});
assert.equal(v.ok,true);
assert.equal(v.ticket.session_id,2);
assert.deepEqual(closed,[1]);
v=await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:2});
assert.equal(v.ok,true);
await ingress.revokeForNavigation();
v=await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
assert.equal(v.reason,'WORKER_NO_LIVE_SESSION');
assert.deepEqual(closed,[1,2]);

let release;
const deferred=new Promise(resolve=>{release=resolve;});
let queryCount=0;
const slowCore={
 async openLocalTrusted(){return {session_id:++queryCount,
  revision:0,index_generation:queryCount,product_read_worker_accepted:false,
  product_writer_authorized:false};},
 async queryIndexedPage(){return await deferred;},
 async close(){}
};
const slow=createResearchReadIngress(slowCore);
await slow.dispatch({type:'OPEN_LOCAL',bytes:new Uint8Array([1])});
const old=slow.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
await slow.dispatch({type:'OPEN_LOCAL',bytes:new Uint8Array([2])});
release(fakePage());
const stale=await old;
assert.equal(stale.ok,false);
assert.equal(stale.reason,'WORKER_STALE_QUERY_REPLY');

const badCore={
 async openLocalTrusted(){return {session_id:1,index_generation:1,revision:0,
  product_read_worker_accepted:false,product_writer_authorized:false};},
 async queryIndexedPage(){return { ...fakePage(),rows:[{opaque:'X'.repeat(65536)}]};},
 async close(){}
};
const bounded=createResearchReadIngress(badCore);
await bounded.dispatch({type:'OPEN_LOCAL',bytes:new Uint8Array([1])});
v=await bounded.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
assert.equal(v.reason,'WORKER_CORE_PAGE_DENIED');

const inconsistentCore={
 async openLocalTrusted(){return {session_id:7,index_generation:1,revision:0,
   product_read_worker_accepted:false,product_writer_authorized:false};},
 async queryIndexedPage(){return {...fakePage(),complete:true,next_cursor:null};},
 async close(){}
};
const inconsistent=createResearchReadIngress(inconsistentCore);
await inconsistent.dispatch({type:'OPEN_LOCAL',bytes:new Uint8Array([1])});
v=await inconsistent.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
assert.equal(v.reason,'WORKER_CORE_PAGE_DENIED');

console.log('READ_WORKER_RESEARCH_ONLY_SYNTHETIC_PASS=1');
console.log('PRODUCT_READ_WORKER=OFF PRODUCT_WRITER=OFF PRIVATE_SAVE_IN_CI=NO');
