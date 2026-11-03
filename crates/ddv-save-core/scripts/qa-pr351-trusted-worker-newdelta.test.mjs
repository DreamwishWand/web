// 05 QR independent PR351 transport test, SYNTHETIC stub only.
// No production Worker, no compiled Rust/WASM, no real save or user keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearchReadIngress,PRODUCT_READ_ENABLED,PRODUCT_WRITER_ENABLED}
  from '../scripts/research-trusted-read-worker.mjs';
const bytes=n=>new Uint8Array([n]);
const ticket=i=>({session_id:i,revision:0,index_generation:i,product_read_worker_accepted:false,product_writer_authorized:false});
const row=i=>({event_id:i,saved_index:0,oneof:'ItemSpawning'});
const page=(rows,total,complete,next_cursor=null)=>({
 rows,total_w1_rows:total,complete,next_cursor,
 product_read_worker_accepted:false,product_writer_authorized:false,
 full_domain_reference_closure_complete:false
});
const deferred=()=>{
 let resolve,reject;const promise=new Promise((y,n)=>{resolve=y;reject=n;});
 return {promise,resolve,reject};
};
test('A late query never appears after B OPEN even if A finishes later', async ()=>{
 const late=deferred(),closed=[];
 const host={
  async openLocalTrusted(buf){return ticket(buf[0]);},
  async queryIndexedPage(t){return t.session_id===1 ? late.promise : page([row(2)],1,true);},
  async close(t){closed.push(t.session_id);}
 };
 const ingress=createResearchReadIngress(host);
 assert.equal((await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(1)})).ok,true);
 const aQuery=ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
 const b=await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(2)});
 assert.equal(b.ok,true);
 late.resolve(page([row(1)],1,true));
 assert.equal((await aQuery).reason,'WORKER_STALE_QUERY_REPLY');
 assert.deepEqual(closed,[1]);
 const reply=await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
 assert.equal(reply.ok,true);assert.equal(reply.page.rows[0].event_id,2);
});
test('closing while pending A page invalidates egress and writer RPCs',async()=>{
 const late=deferred();const closed=[];
 const ingress=createResearchReadIngress({
  openLocalTrusted:async()=>ticket(1),
  queryIndexedPage:async()=>late.promise,
  close:async(t)=>{closed.push(t.session_id);}
 });
 await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(1)});
 const pending=ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
 assert.equal((await ingress.dispatch({type:'CLOSE'})).ok,true);
 late.resolve(page([row(1)],1,true));
 assert.equal((await pending).reason,'WORKER_STALE_QUERY_REPLY');
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1})).reason,'WORKER_NO_LIVE_SESSION');
 assert.equal((await ingress.dispatch({type:'APPLY',bytes:bytes(1)})).reason,'PRODUCT_SAVE_OPERATION_NOT_ACCEPTED');
 assert.equal(PRODUCT_READ_ENABLED,false);
 assert.equal(PRODUCT_WRITER_ENABLED,false);
 assert.deepEqual(closed,[1]);
});
test('invalid B open revokes previous A before Core validation',async()=>{
 const closed=[];
 const ingress=createResearchReadIngress({
  async openLocalTrusted(buf){if(buf[0]===2)throw Error('bad_source');return ticket(buf[0]);},
  async queryIndexedPage(){return page([row(1)],1,true);},
  async close(t){closed.push(t.session_id);}
 });
 assert.equal((await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(1)})).ok,true);
 assert.equal((await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(2)})).reason,'WORKER_CORE_OPEN_DENIED');
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1})).reason,'WORKER_NO_LIVE_SESSION');
 assert.deepEqual(closed,[1]);
});
test('fake COMPLETE, inconsistent total and oversized rows fail closed',async()=>{
 let staged=page([row(1)],2,true);
 const ingress=createResearchReadIngress({
  async openLocalTrusted(){return ticket(1);},
  async queryIndexedPage(){return staged;},
  async close(){}
 });
 assert.equal((await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(1)})).ok,true);
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1})).reason,'WORKER_CORE_PAGE_DENIED');
 staged=page([row(1)],2,false,'c1');
 const one=await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
 assert.equal(one.ok,true);
 staged=page([row(2)],3,true);
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:'c1',limit:1})).reason,'WORKER_CORE_PAGE_DENIED');
 staged=page([{...row(2),extra:'x'.repeat(65536)}],2,true);
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:'c1',limit:1})).reason,'WORKER_CORE_PAGE_DENIED');
 staged=page([row(2)],2,true);
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:'c1',limit:1})).ok,true);
});
test('UI cannot inject Session, Complete, cursor scope or product writer',async()=>{
 const ingress=createResearchReadIngress({
  async openLocalTrusted(){return ticket(3);},
  async queryIndexedPage(){return page([row(3)],1,true);},
  async close(){}
 });
 assert.equal((await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(3),session_id:99})).reason,'WORKER_OPEN_BOUNDS_OR_FAKE_METADATA');
 assert.equal((await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(3)})).ok,true);
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1,complete:true})).reason,'WORKER_QUERY_INVALID_OR_FORGED_CLAIM');
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:'x'.repeat(257),limit:1})).reason,'WORKER_QUERY_INVALID_OR_FORGED_CLAIM');
 assert.equal((await ingress.dispatch({type:'ENCODE_COPY'})).reason,'PRODUCT_SAVE_OPERATION_NOT_ACCEPTED');
 assert.equal((await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1})).ok,true);
});
test('opaque mock may lie about true source Complete: this is NOT a Rust/WASM acceptance',async()=>{
 // This proves the ceiling of the UNCONNECTED JS prototype, not acceptance:
 // A fake Core can assert internally self-consistent but false complete.
 const ingress=createResearchReadIngress({
  async openLocalTrusted(){return ticket(3);},
  async queryIndexedPage(){return page([row(1)],1,true);},
  async close(){}
 });
 await ingress.dispatch({type:'OPEN_LOCAL',bytes:bytes(3)});
 const spoof=await ingress.dispatch({type:'QUERY_W1_PAGE',cursor:null,limit:1});
 assert.equal(spoof.ok,true,'mock-only complete claim is accepted without real Rust provenance');
 assert.equal(spoof.page.complete,true);
 assert.equal(spoof.productReadAccepted,false);
});
