// Independent changed-two QA; real Worker message transport + MOCK adapter.
// Prior QA955 accepted workflow/OPFS/geometry and QA931 real Rust are reused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {Worker} from 'node:worker_threads';
import {installLocalDevAmountWorker,createLocalAmountDevPort} from '../src/lib/dev/local-amount-worker-adapter.mjs';
const S='2074334603195fa59a2b90f7f75e7e2eb1870514',P='71fcdd7ef34c1e9adc091991cb5f691a9aff0de6',F='406ac11f2d9252f619b7489e61e063f19a9adba4';
const files={'src/lib/dev/local-amount-worker-adapter.mjs':'fca040fe50cb40464d38f7681203713f502c5733','tests/web-local-dev-amount-worker-port.test.mjs':'23d654993340bf35d99e6a92d7ed7003d61c6e05'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const ok=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
const defer=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}};
function endpoint(adapter){
 const replies=[],p={postMessage:v=>replies.push(v)};installLocalDevAmountWorker(p,adapter);
 return{replies,send:(id,method,args=[])=>p.onmessage({data:{id,method,args}})};
}
const denied=id=>({id,ok:false,error:'DENIED'});
test('immutable original10 and repair2; QA-only ADD, no tracked DEV route',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);
 const orig=git('diff','--name-status',F,S).split('\n');assert.equal(orig.length,10);assert.ok(orig.every(x=>x.startsWith('A\t')));
 assert.deepEqual(git('diff','--name-status',P,S).split('\n').sort(),Object.keys(files).map(p=>'M\t'+p).sort());
 for(const [p,h]of Object.entries(files))assert.equal(git('rev-parse',S+':'+p),h);
 assert.ok(git('diff','--name-status',S,'HEAD').split('\n').every(x=>x.startsWith('A\t')&&x.includes('04qr-w-pr932-close-repair')));
 assert.equal(git('ls-files','src/routes/test-dev-amount-ui','src/routes/test-04qrw-pr932'), '');
});
test('QA955 old failing case: held close denies every method and repeated Close before adapter invocation',async()=>{
 const entered=defer(),release=defer(),calls=[];
 const adapter={async close(){calls.push('close');entered.resolve();await release.promise;return ok('CLOSED')}};
 const methods=['open','backupOriginal','listVerifiedTargets','stageTyped','undo','redo','exportEditedCopy'];
 for(const m of methods)adapter[m]=async()=>{calls.push(m);return ok(m)};
 const {send,replies}=endpoint(adapter);const c=send(1,'close');await entered.promise;
 for(let i=0;i<methods.length;i++){const m=methods[i];await send(i+2,m,['open','stageTyped'].includes(m)?[{}]:[]);assert.deepEqual(replies.at(-1),denied(i+2))}
 await send(9,'close');assert.deepEqual(replies.at(-1),denied(9));assert.deepEqual(calls,['close']);
 release.resolve();await c;assert.deepEqual(replies.at(-1),{id:1,ok:true,data:ok('CLOSED')});
 for(let i=0;i<methods.length;i++){const m=methods[i];await send(i+2,m,['open','stageTyped'].includes(m)?[{}]:[]);assert.deepEqual(replies.at(-1),denied(i+2))}
 await send(9,'close');assert.deepEqual(calls,['close']);
 await send(10,'open',[{name:'B'}]);assert.equal(replies.at(-1).ok,true);assert.deepEqual(calls,['close','open']);
 console.log('QRW932_CLOSE_REPAIR_OLD_QA955_FAIL_RESOLVED_ALL_METHODS_WATERMARK');
});
for(const drainFirst of [true,false])for(const closeFails of [true,false]){
 test('preempt old active: '+(drainFirst?'active drains first':'close settles first')+', close '+(closeFails?'rejects':'succeeds'),async()=>{
  const entered=defer(),activeEnd=defer(),closeEntered=defer(),closeEnd=defer(),calls=[];
  const {send,replies}=endpoint({async open(a){calls.push(a.name);if(a.name==='A'){entered.resolve();await activeEnd.promise}return ok('OPEN')},
   async close(){calls.push('close');closeEntered.resolve();await closeEnd.promise;return ok('CLOSED')},
   async undo(){calls.push('undo');return ok('UNDONE')}});
  const old=send(11,'open',[{name:'A'}]);await entered.promise;const c=send(12,'close');await closeEntered.promise;
  await send(13,'open',[{name:'B'}]);await send(14,'close');assert.deepEqual(calls,['A','close']);
  const settleClose=()=>closeFails?closeEnd.reject(Error('private failure')):closeEnd.resolve();
  if(drainFirst){activeEnd.resolve();await old;assert.deepEqual(replies.at(-1),denied(11));await send(15,'undo');assert.deepEqual(replies.at(-1),denied(15));settleClose();await c;}
  else{settleClose();await c;await send(15,'undo');assert.deepEqual(replies.at(-1),denied(15));activeEnd.resolve();await old;assert.deepEqual(replies.at(-1),denied(11));}
  assert.deepEqual(calls,['A','close']);const cr=replies.find(x=>x.id===12);assert.equal(cr.ok,!closeFails);if(closeFails)assert.deepEqual(cr,denied(12));
  await send(13,'open',[{name:'B'}]);await send(14,'close');await send(15,'undo');assert.deepEqual(calls,['A','close']);
  await send(16,'open',[{name:'B'}]);assert.equal(replies.at(-1).ok,true);await send(17,'undo');assert.equal(replies.at(-1).ok,true);assert.deepEqual(calls,['A','close','B','undo']);
 });
}
test('Close synchronous throw and async rejection release only their ownership; IDs remain consumed',async()=>{
 let n=0;const {send,replies}=endpoint({close(){if(++n===1)throw Error('private');return n===2?Promise.reject(Error('private2')):ok('CLOSED')},async open(){return ok('OPEN')}});
 for(const id of [1,2]){await send(id,'close');assert.deepEqual(replies.at(-1),denied(id))}
 await send(1,'close');await send(2,'close');assert.equal(n,2);
 await send(3,'close');assert.equal(replies.at(-1).ok,true);await send(4,'open',[{}]);assert.equal(replies.at(-1).ok,true);
});
test('real Worker thread / structured clone / actual client RPC: Close barrier and fresh session', {timeout:15000},async()=>{
 const url=new URL('../src/lib/dev/local-amount-worker-adapter.mjs',import.meta.url).href;
 const source="const {parentPort}=require('node:worker_threads'); (async()=>{const {installLocalDevAmountWorker}=await import("+JSON.stringify(url)+");let release;const calls=[];const p={postMessage:v=>parentPort.postMessage({rpc:v})};installLocalDevAmountWorker(p,{async close(){calls.push('close');parentPort.postMessage({event:'close-entered'});await new Promise(r=>release=r);return {kind:'CLOSED'}},async open(a){calls.push('open:'+a.name);return {kind:'OPEN',name:a.name}},async undo(){calls.push('undo');return {kind:'UNDONE'}}});parentPort.on('message',m=>{if(m.control==='release')release();else if(m.control==='calls')parentPort.postMessage({event:'calls',calls:[...calls]});else p.onmessage({data:m})});parentPort.postMessage({event:'ready'});})().catch(e=>{throw e});";
 const worker=new Worker(source,{eval:true});const events=new Map(),waiting=new Map();
 const event=k=>events.has(k)?Promise.resolve(events.get(k)):new Promise(r=>waiting.set(k,r));
 const transport={postMessage:v=>worker.postMessage(v),terminate:()=>worker.terminate()};
 worker.on('message',m=>{if(m.rpc)transport.onmessage?.({data:m.rpc});else{events.set(m.event,m);waiting.get(m.event)?.(m)}});
 worker.on('error',e=>transport.onerror?.(e));
 const p=createLocalAmountDevPort(transport);
 try{await event('ready');const c=p.close();await event('close-entered');
  await assert.rejects(p.open({name:'B'}),/DEV_WORKER_DENIED/);await assert.rejects(p.undo(),/DEV_WORKER_DENIED/);await assert.rejects(p.close(),/DEV_WORKER_DENIED/);
  worker.postMessage({control:'release'});assert.equal((await c).kind,'CLOSED');
  const b=await p.open({name:'B'});assert.equal(b.name,'B');assert.equal((await p.undo()).kind,'UNDONE');
  worker.postMessage({control:'calls'});assert.deepEqual((await event('calls')).calls,['close','open:B','undo']);
  console.log('QRW932_CLOSE_REPAIR_REAL_WORKER_MOCK_TRANSPORT_PASS');
 }finally{p.dispose();await worker.terminate()}
});
