import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';

// Execute the actual Svelte handler source rather than testing a
// separately reimplemented UI state machine or a regex-only assertion.
const source=readFileSync(new URL('../src/lib/dev/LocalPlacementEditorDev.svelte',import.meta.url),'utf8');
const start=source.indexOf(' function clear(){'),end=source.indexOf(' const preview=()=>',start);
assert(start>0&&end>start,'real Placement selection/close handlers are present');
const handlers=source.slice(start,end);
function harness(worker){
 const factory=new Function('worker',[
  "let workflow=worker,pending=false,error=false,file={name:'A.p1g'},",
  "confirmed=true,seed=42,grid=900,x=1,y=2,oldIds=[1,2,3,4],",
  "epoch=0,input={value:'old-file'},state={phase:'ready',preview:{itemId:123}};",
  handlers,
  "return {select,close,read:()=>({workflow,pending,error,file,confirmed,seed,grid,x,y,oldIds,epoch,state,inputValue:input.value}),unmount:()=>{++epoch;workflow=null}};"
 ].join('\n'));
 return factory(worker);
}
function worker(){
 let finish,reject,phase='ready',calls=0;
 const wait=new Promise((resolve,rej)=>{finish=resolve;reject=rej});
 const w={
  close(){calls++;phase='closed';return wait},
  snapshot(){return {phase}}
 };
 return {w,finish:()=>finish({phase:'closed'}),reject:()=>{phase='close-failed';reject(Error('NO_CLOSED_ACK'))},calls:()=>calls};
}
const event=f=>({currentTarget:{files:f?[f]:[],value:'selected-file'}});
test('actual Placement editor Svelte handlers compile without changing trusted mount/Writer OFF boundary',()=>{
 const out=compile(source,{filename:'LocalPlacementEditorDev.svelte',generate:'ssr'});
 assert(out.js.code.includes('data-product-writer'));
 assert.match(source,/productPlacementPortScope\(trustedWorkerAdapter\)/);
 assert.match(source,/data-product-writer="off"/);
 assert.match(source,/const closing=w\.close\(\);state=w\.snapshot\(\)/);
});
test('new File B only binds AFTER previous session reports CLOSED; no stale preview during barrier',async()=>{
 const v=worker(),ui=harness(v.w),b={name:'B.p1g'};
 const e=event(b),p=ui.select(e);
 assert.equal(e.currentTarget.value,'','same original may be selected again');
 assert.equal(v.calls(),1);
 const inFlight=ui.read();
 assert.equal(inFlight.pending,true);
 assert.equal(inFlight.file,null);
 assert.equal(inFlight.confirmed,false);
 assert.equal(inFlight.state.phase,'closed');
 assert.equal(inFlight.state.preview,undefined);
 v.finish();await p;
 assert.equal(ui.read().pending,false);
 assert.equal(ui.read().file,b);
 assert.equal(ui.read().state.phase,'closed');
});
test('late synthetic File event while Worker is pending cannot clear or replace prior selection',async()=>{
 const v=worker(),ui=harness(v.w),b={name:'B.p1g'},c={name:'C.p1g'};
 const p=ui.select(event(b)),inFlight=ui.read(),late=event(c);
 await ui.select(late);await ui.close();
 assert.equal(late.currentTarget.value,'');
 assert.equal(v.calls(),1,'never invokes competing Close while busy');
 assert.equal(ui.read().epoch,inFlight.epoch,'late input cannot revoke pending generation');
 assert.equal(ui.read().file,null);
 v.finish();await p;
 assert.equal(ui.read().file,b,'first accepted selection wins after exact CLOSED');
});
test('failure of Worker CLOSED barrier never binds newly selected private File or re-enables open',async()=>{
 const v=worker(),ui=harness(v.w),b={name:'B.p1g'};
 const p=ui.select(event(b));v.reject();await p;
 assert.equal(ui.read().file,null);
 assert.equal(ui.read().state.phase,'close-failed');
 assert.equal(ui.read().error,true);
 assert.equal(ui.read().pending,false);
 assert.equal(ui.read().confirmed,false);
});
test('unmount during pending asynchronous Close cannot commit stale selected File',async()=>{
 const v=worker(),ui=harness(v.w),b={name:'B.p1g'};
 const p=ui.select(event(b));ui.unmount();v.finish();await p;
 assert.equal(ui.read().file,null);
 assert.equal(ui.read().workflow,null);
 assert.equal(ui.read().state.phase,'closed');
});
test('explicit Close clears active input only after idle guard and waits for the CLOSED receipt',async()=>{
 const v=worker(),ui=harness(v.w),p=ui.close();
 assert.equal(ui.read().pending,true);
 assert.equal(ui.read().file,null);
 assert.equal(ui.read().confirmed,false);
 assert.equal(ui.read().state.phase,'closed');
 assert.equal(ui.read().epoch,1);
 v.finish();await p;
 assert.equal(ui.read().pending,false);
 assert.equal(ui.read().error,false);
 assert.equal(ui.read().state.phase,'closed');
});
