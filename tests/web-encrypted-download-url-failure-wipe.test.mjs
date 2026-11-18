import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const consumers=[
 ['placement',new URL('../src/lib/dev/LocalPlacementEditorDev.svelte',import.meta.url)],
 ['collection',new URL('../src/lib/collection/CollectionExact1Dev.svelte',import.meta.url)]
];

function actualDownload(file){
 const source=readFileSync(file,'utf8');
 const needle=' async function download(which){';
 const start=source.indexOf(needle);
 assert.ok(start>=0,'expected actual Svelte UI download handler');
 assert.equal(source.indexOf(needle,start+needle.length),-1,'unique handler');
 const end=source.indexOf('\n }\n</script>',start);
 assert.ok(end>start,'extract whole original handler, including its finally branches');
 return source.slice(start,end+3);
}

function harness(downloadSource,mode,bytes){
 let blob=null,revoked=0,clicked=0;
 const binding={
  downloadVerifiedCopy:async()=>({name:'encrypted-copy.p1g',encryptedBytes:bytes}),
  snapshot:()=>({phase:'ready'})
 };
 const browser={
  URL:{
   createObjectURL(v){if(mode==='url-throw')throw Error('OBJECT_URL_DENIED');blob=v;return 'blob:synthetic';},
   revokeObjectURL(){revoked++;}
  },
  document:{
   createElement(){if(mode==='element-throw')throw Error('ELEMENT_DENIED');return{
    href:'',download:'',
    click(){clicked++;if(mode==='click-throw')throw Error('CLICK_DENIED');},
    remove(){}
   }},
   body:{
    append(){if(mode==='append-throw')throw Error('APPEND_DENIED');},
    appendChild(){if(mode==='append-throw')throw Error('APPEND_DENIED');}
   }
  },
  setTimeout(fn){fn();}
 };
 // Exercise the actual Svelte handler, not a copied test-only implementation.
 // Variables are the two UI components' exact closure names.
 const make=new Function('binding','browser',[
  'let workflow=binding,consumer=binding,epoch=7,pending=false,error=false,state={};',
  'const URL=browser.URL,Blob=globalThis.Blob,document=browser.document,setTimeout=browser.setTimeout;',
  downloadSource,
  'return {download,stale(){epoch++},get pending(){return pending},get error(){return error}};'
 ].join('\n'));
 return {ui:make(binding,browser),get blob(){return blob},get revoked(){return revoked},get clicked(){return clicked}};
}

for(const [kind,path] of consumers){
 const actual=actualDownload(path);
 test(kind+' successful verified download copies Blob and wipes transient source',async()=>{
  const bytes=Uint8Array.from([0,1,7,91,255]),original=Uint8Array.from(bytes);
  const h=harness(actual,'ok',bytes);
  await h.ui.download('backup');
  assert.ok(h.blob instanceof Blob);
  assert.deepEqual(new Uint8Array(await h.blob.arrayBuffer()),original);
  assert.deepEqual([...bytes],[0,0,0,0,0]);
  assert.equal(h.clicked,1);
  assert.equal(h.revoked,1);
  assert.equal(h.ui.pending,false);
  assert.equal(h.ui.error,false);
 });
 for(const mode of ['url-throw','element-throw','append-throw','click-throw']){
  test(kind+' '+mode+' wipes encrypted buffer and reports failure',async()=>{
   const bytes=Uint8Array.from([7,99,252]);
   const h=harness(actual,mode,bytes);
   await h.ui.download('edited');
   assert.deepEqual([...bytes],[0,0,0]);
   assert.equal(h.ui.pending,false);
   assert.equal(h.ui.error,true);
   if(mode==='url-throw')assert.equal(h.blob,null);
   if(mode==='click-throw'||mode==='append-throw'||mode==='element-throw')assert.equal(h.revoked,1);
  });
 }
 test(kind+' stale UI session never creates Blob/URL and wipes encrypted buffer',async()=>{
  const bytes=Uint8Array.from([4,5,6]);
  const h=harness(actual,'ok',bytes);
  const p=h.ui.download('backup');
  h.ui.stale();
  await p;
  assert.deepEqual([...bytes],[0,0,0]);
  assert.equal(h.blob,null);
  assert.equal(h.clicked,0);
  assert.equal(h.ui.error,false);
 });
}
