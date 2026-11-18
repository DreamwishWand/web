// 04 QR-W independent actual Placement Svelte UI handler adversarial test.
// Source PR2275; synthetic File objects/Worker CLOSED receipts only, no P1G or Owner data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
const source=readFileSync(new URL('../src/lib/dev/LocalPlacementEditorDev.svelte',import.meta.url),'utf8');
const start=source.indexOf(' async function act(fn){');
const end=source.indexOf(' const preview=()=>',start);
assert(start>0&&end>start,'extract real act/select/close handlers; do not reimplement them');
const actual=source.slice(start,end);
function worker(){
 let phase='ready',closeCalls=0,resolveClose,failClose,resolvePreview;
 let closing=new Promise((res,rej)=>{resolveClose=res;failClose=rej});
 let preview=new Promise(res=>{resolvePreview=res});
 const w={
  close(){closeCalls++;phase='closed';return closing},
  preview(){return preview},
  snapshot(){return {phase,preview:phase==='ready'?{itemId:123}:null}}
 };
 return {w,calls:()=>closeCalls,finish(){resolveClose({phase:'closed',preview:null})},
  fail(){phase='close-failed';failClose(Error('NO_CLOSED_ACK'))},
  finishPreview(){resolvePreview({phase:'previewed',preview:{itemId:123}})}};
}
function harness(w){
 const factory=new Function('initialWorker',[
  "let workflow=initialWorker,pending=false,error=false,file={name:'A.p1g'},",
  "confirmed=true,seed=42,grid=900,x=1,y=2,oldIds=[1,2,3,4],",
  "epoch=0,input={value:'A'},state={phase:'ready',preview:{itemId:123}};",
  actual,
  "return {act,select,close,unmount:()=>{++epoch;workflow=null},snapshot:()=>({workflow,pending,error,file,confirmed,seed,grid,x,y,oldIds,epoch,state,inputValue:input.value})};"
 ].join('\n'));
 return factory(w);
}
const event=file=>({currentTarget:{files:file?[file]:[],value:'incoming'}});
test('actual LocalPlacementEditorDev.svelte compiles; Worker port and P1G import still OFF without signed scope',()=>{
 const result=compile(source,{filename:'LocalPlacementEditorDev.svelte',generate:'ssr'});
 assert(result.js.code.includes('data-product-writer'));
 assert.match(source,/productPlacementPortScope\(trustedWorkerAdapter\)/);
 assert.match(source,/data-product-writer="off"/);
 assert.match(source,/disabled=\{pending\|\|!file\|\|!confirmed\}/);
 assert.match(source,/if\(!workflow\|\|pending\)return/);
});
test('while an ORIGINAL in-flight preview operation is busy, late File B input cannot erase active selected A',async()=>{
 const v=worker(),ui=harness(v.w),a=ui.snapshot().file,b={name:'B.p1g'};
 const p=ui.act(w=>w.preview());
 assert.equal(ui.snapshot().pending,true);
 const evt=event(b);
 await ui.select(evt);
 assert.equal(evt.currentTarget.value,'');
 await ui.close();
 assert.strictEqual(ui.snapshot().file,a);
 assert.equal(ui.snapshot().confirmed,true);
 assert.deepEqual(ui.snapshot().oldIds,[1,2,3,4]);
 assert.equal(ui.snapshot().epoch,0);
 assert.equal(v.calls(),0);
 v.finishPreview();await p;
 assert.equal(ui.snapshot().state.phase,'previewed');
 assert.strictEqual(ui.snapshot().file,a);
 assert.equal(ui.snapshot().pending,false);
});
test('unmounted workflow refuses late file selection without making a Worker close or resurrecting File',async()=>{
 const v=worker(),ui=harness(v.w);
 ui.unmount();
 const before=ui.snapshot().file,evt=event({name:'after-unmount.p1g'});
 await ui.select(evt);
 assert.equal(evt.currentTarget.value,'');
 assert.strictEqual(ui.snapshot().file,before);
 assert.equal(ui.snapshot().workflow,null);
 assert.equal(v.calls(),0);
});
test('cancelled selection closes previous Worker but does not bind an undefined new File',async()=>{
 const v=worker(),ui=harness(v.w),evt=event(null),p=ui.select(evt);
 assert.equal(v.calls(),1);
 assert.equal(ui.snapshot().file,null);
 assert.equal(ui.snapshot().confirmed,false);
 assert.equal(ui.snapshot().state.phase,'closed');
 v.finish();await p;
 assert.equal(ui.snapshot().file,null);
 assert.equal(ui.snapshot().pending,false);
 assert.equal(ui.snapshot().error,false);
});
test('a reselected same File A is not rebound until CLOSED and must reconfirm Build',async()=>{
 const v=worker(),ui=harness(v.w),same=ui.snapshot().file,evt=event(same),p=ui.select(evt);
 assert.equal(evt.currentTarget.value,'');
 assert.equal(ui.snapshot().file,null);
 assert.equal(ui.snapshot().confirmed,false);
 assert.equal(ui.snapshot().pending,true);
 assert.equal(v.calls(),1);
 v.finish();await p;
 assert.strictEqual(ui.snapshot().file,same);
 assert.equal(ui.snapshot().confirmed,false);
 assert.equal(ui.snapshot().state.phase,'closed');
 assert.equal(ui.snapshot().pending,false);
});
test('failed selected CLOSED does not accept file B; existing stale preview remains revoked',async()=>{
 const v=worker(),ui=harness(v.w),p=ui.select(event({name:'B.p1g'}));
 assert.equal(ui.snapshot().state.phase,'closed');
 assert.equal(ui.snapshot().file,null);
 v.fail();await p;
 assert.equal(ui.snapshot().state.phase,'close-failed');
 assert.equal(ui.snapshot().file,null);
 assert.equal(ui.snapshot().confirmed,false);
 assert.equal(ui.snapshot().error,true);
 assert.equal(ui.snapshot().pending,false);
});
test('manual Close while preview is pending must NOT clear File A or reset the UI epoch',async()=>{
 const v=worker(),ui=harness(v.w),a=ui.snapshot().file,p=ui.act(w=>w.preview());
 await ui.close();
 assert.equal(v.calls(),0);
 assert.strictEqual(ui.snapshot().file,a);
 assert.equal(ui.snapshot().epoch,0);
 v.finishPreview();await p;
 assert.equal(ui.snapshot().pending,false);
 assert.strictEqual(ui.snapshot().file,a);
});
