// 04 QR-W changed-only L2 independent validation, immutable original 08 WEB PR2223.
// Literal product Svelte download() handlers; synthetic encrypted bytes; NO real Save/Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const subjects=[
 ['placement',new URL('../src/lib/dev/LocalPlacementEditorDev.svelte',import.meta.url)],
 ['collection',new URL('../src/lib/collection/CollectionExact1Dev.svelte',import.meta.url)]
];
function exactHandler(file){
 const source=readFileSync(file,'utf8');
 const key=' async function download(which){',start=source.indexOf(key);
 assert.ok(start>=0,'actual product download handler found');
 assert.equal(source.indexOf(key,start+key.length),-1,'only one product handler');
 const end=source.indexOf('\n }\n</script>',start);
 assert.ok(end>start,'full original Svelte function ends at real script');
 assert.match(source,/data-product-writer="off"/);
 return source.slice(start,end+3);
}
function runProduct(kind,body,mode='success'){
 const bytes=Uint8Array.from([9,23,0,137,255]),copy=Uint8Array.from(bytes);
 let resolve=null,clicked=0,revokes=0,urls=0,blobs=0,added=0;
 let snapshotCalls=0;
 const actor={
  downloadVerifiedCopy(){return new Promise(r=>{resolve=r})},
  snapshot(){
   snapshotCalls++;
   if(mode==='snapshot-throws-once'&&snapshotCalls===1)throw Error('SNAPSHOT_FAILURE');
   return {phase:mode==='closed'?'closed':'ready'};
  }
 };
 const browser={
  URL:{
   createObjectURL(blob){urls++;if(mode==='url-fail')throw Error('URL_FAILURE');blobs++;browser.blob=blob;return 'blob:private'},
   revokeObjectURL(){revokes++}
  },
  document:{
   createElement(){if(mode==='element-fail')throw Error('ELEMENT_FAILURE');return {
    href:'',download:'',
    click(){clicked++;if(mode==='click-fail')throw Error('CLICK_FAILURE')},
    remove(){if(mode==='remove-fail')throw Error('REMOVE_FAILURE')}
   }},
   body:{
    append(){added++;if(mode==='append-fail')throw Error('APPEND_FAILURE')},
    appendChild(){added++;if(mode==='append-fail')throw Error('APPEND_FAILURE')}
   }
  },
  blob:null,
  Blob:function(parts,options){if(mode==='blob-fail')throw Error('BLOB_FAILURE');return new Blob(parts,options)},
  setTimeout(fn){if(mode==='timer-fail')throw Error('TIMER_FAILURE');fn()}
 };
 const evalSource=new Function('actor','browser',[
  'let workflow=actor,consumer=actor,epoch=7,pending=false,error=false,state={};',
  'const URL=browser.URL,Blob=browser.Blob,document=browser.document,setTimeout=browser.setTimeout;',
  body,
  'return {download,stale(){epoch++},switchActor(){workflow={};consumer={}},get pending(){return pending},get error(){return error}};'
 ].join('\n'));
 const ui=evalSource(actor,browser);
 return {
  ui,bytes,copy,browser,
  complete(){assert.equal(typeof resolve,'function');resolve({name:'edited-copy.p1g',encryptedBytes:bytes})},
  stats:()=>({clicked,revokes,urls,blobs,added})
 };
}
for(const [name,file] of subjects){
 const fn=exactHandler(file);
 test(name+' original Svelte correct Blob copy and original encrypted view zero on success',async()=>{
  const h=runProduct(name,fn);
  const wait=h.ui.download('backup');h.complete();await wait;
  assert.deepEqual([...h.bytes],[0,0,0,0,0]);
  assert.ok(h.browser.blob instanceof Blob);
  assert.deepEqual([...new Uint8Array(await h.browser.blob.arrayBuffer())],[...h.copy]);
  assert.equal(h.stats().clicked,1);
  assert.equal(h.stats().revokes,1);
  assert.equal(h.ui.error,false);
  assert.equal(h.ui.pending,false);
 });
 for(const fault of ['blob-fail','url-fail','element-fail','append-fail','click-fail','remove-fail','timer-fail']){
  test(name+' original Svelte '+fault+' zeroes bytes before any error escapes UI',async()=>{
   const h=runProduct(name,fn,fault);
   const wait=h.ui.download('edited');h.complete();await wait;
   assert.deepEqual([...h.bytes],[0,0,0,0,0],fault);
   assert.equal(h.ui.error,true,fault);
   assert.equal(h.ui.pending,false,fault);
   if(fault==='blob-fail')assert.equal(h.stats().urls,0);
   if(fault==='url-fail')assert.equal(h.browser.blob,null);
  });
 }
 for(const stale of ['epoch','switched',...(name==='collection'?['closed']:[])]){
  test(name+' '+stale+' stale consumer never allocates URL and still wipes',async()=>{
   const h=runProduct(name,fn,stale);
   const wait=h.ui.download('backup');
   if(stale==='epoch')h.ui.stale();
   else if(stale==='switched')h.ui.switchActor();
   h.complete();await wait;
   assert.deepEqual([...h.bytes],[0,0,0,0,0]);
   assert.equal(h.stats().urls,0);
   assert.equal(h.stats().clicked,0);
   assert.equal(h.ui.error,false);
  });
 }
 test(name+' first synchronous snapshot exception cannot bypass byte finally',async()=>{
  const h=runProduct(name,fn,'snapshot-throws-once');
  const p=h.ui.download('backup');h.complete();await p;
  assert.deepEqual([...h.bytes],[0,0,0,0,0]);
  // Placement has no snapshot call before successful download and therefore
  // still succeeds; Collection checks the snapshot and reports failure.
  assert.equal(h.ui.error,name==='collection');
 });
}
