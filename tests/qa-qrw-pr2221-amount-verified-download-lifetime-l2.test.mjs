// 04 QR-W existing ACT-20261118-04QRW-PR2221-AMOUNT-DOWNLOAD-BUFFER-ZEROIZE-L2
// Execute literal product Svelte downloadCopy plus its unchanged imported helper.
// Synthetic already-encrypted bytes only; no genuine Save, key, session, or Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {consumeVerifiedAmountDownloadBytes as helper} from '../src/lib/dev/consume-verified-amount-download-bytes.mjs';

const source=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
const begin=source.indexOf('  async function downloadCopy(which){');
const end=source.indexOf('  async function close(){',begin);
assert.ok(begin>=0&&end>begin,'actual current Svelte handler, not a QA imitation');
const original=source.slice(begin,end);
assert.match(original,/consumeVerifiedAmountDownloadBytes\(result\.encryptedBytes,bytes=>\{/);
assert.match(source,/data-product-writer="off"/);
assert.match(source,/data-cloud="off"/);

function fixture(mode='success',options={}){
 const bytes=Uint8Array.from([13,91,0,204,255]);
 let saved=null,clicked=0,revoked=0,created=0,appended=0,timeout=0;
 let resolve;
 const consumer={snapshot:()=>({phase:options.closed?'closed':'ready'}),downloadVerifiedCopy(){
  if(options.defer)return new Promise(r=>{resolve=r});
  return Promise.resolve({encryptedBytes:bytes,name:'edited-copy.p1g'});
 }};
 const dom={
  createElement(){if(mode==='element')throw Error('ELEMENT_FAIL');return {
    href:'',download:'',click(){clicked++;if(mode==='click')throw Error('CLICK_FAIL')},
    remove(){if(mode==='remove')throw Error('REMOVE_FAIL')}
  }},
  body:{appendChild(){appended++;if(mode==='append')throw Error('APPEND_FAIL')}}
 };
 const urls={
  createObjectURL(b){created++;if(mode==='url')throw Error('URL_FAIL');saved=b;return 'blob:synthetic'},
  revokeObjectURL(){revoked++}
 };
 const makeBlob=function(parts,opt){if(mode==='blob')throw Error('BLOB_FAIL');return new Blob(parts,opt)};
 const schedule=(fn)=>{timeout++;if(mode==='timer')throw Error('TIMER_FAIL');fn()};
 const evalHandler=new Function('consumer','dom','urls','makeBlob','schedule','helper',
  'let workflow=consumer,pending=false,error=false,state={};'
  +'const document=dom,URL=urls,Blob=makeBlob,setTimeout=schedule;'
  +'const consumeVerifiedAmountDownloadBytes=helper;'
  +original
  +'return {downloadCopy,replace(v){workflow=v},get pending(){return pending},get error(){return error}};');
 const ui=evalHandler(consumer,dom,urls,makeBlob,schedule,helper);
 return {bytes,ui,complete(){resolve({encryptedBytes:bytes,name:'backup.p1g'})},
  get blob(){return saved},stats(){return{clicked,revoked,created,appended,timeout}}};
}

test('original Svelte success retains exact encrypted Blob and zeros transient view',async()=>{
 const f=fixture();
 await f.ui.downloadCopy('edited');
 assert.deepEqual([...f.bytes],[0,0,0,0,0]);
 assert.equal(f.blob?.type,'application/octet-stream');
 assert.deepEqual([...new Uint8Array(await f.blob.arrayBuffer())],[13,91,0,204,255]);
 assert.deepEqual(f.stats(),{clicked:1,revoked:1,created:1,appended:1,timeout:1});
 assert.equal(f.ui.error,false);
 assert.equal(f.ui.pending,false);
});

test('original Svelte detects stale replacement/closed session without Blob, URL or retained buffer',async()=>{
 for(const mode of ['replaced','closed']){
  const f=fixture('success',{defer:mode==='replaced',closed:mode==='closed'});
  const p=f.ui.downloadCopy('backup');
  if(mode==='replaced'){f.ui.replace({});f.complete()}
  await p;
  assert.deepEqual([...f.bytes],[0,0,0,0,0],mode);
  assert.equal(f.blob,null,mode);
  assert.equal(f.stats().created,0,mode);
  assert.equal(f.stats().clicked,0,mode);
  assert.equal(f.ui.error,false,mode);
 }
});

test('real Svelte Blob and URL creation, DOM, click, removal and timer failure all wipe',async()=>{
 for(const mode of ['blob','url','element','append','click','remove','timer']){
  const f=fixture(mode);
  await f.ui.downloadCopy('edited');
  assert.deepEqual([...f.bytes],[0,0,0,0,0],mode);
  assert.equal(f.ui.error,true,mode);
  assert.equal(f.ui.pending,false,mode);
  if(mode==='blob')assert.equal(f.stats().created,0);
  if(mode==='url')assert.equal(f.blob,null);
 }
});

test('actual helper denies invalid synchronous callbacks and wipes on Promise consumer',()=>{
 for(const consume of [null,()=>{throw Error('SYNC_DENIED')},()=>Promise.resolve('too-late')]){
  const bytes=Uint8Array.of(10,11,12);
  assert.throws(()=>helper(bytes,consume));
  assert.deepEqual([...bytes],[0,0,0]);
 }
 const empty=new Uint8Array(0);
 assert.throws(()=>helper(empty,()=>{}),/AMOUNT_DOWNLOAD_CONSUMER_DENIED/);
});

test('no new Save authority or plaintext transfer in new amount helper or local UI boundary',()=>{
 const helperSource=readFileSync(new URL('../src/lib/dev/consume-verified-amount-download-bytes.mjs',import.meta.url),'utf8');
 const executable=helperSource.split('\n').filter(x=>!x.trimStart().startsWith('//')).join('\n');
 for(const forbidden of [/\bfetch\s*\(/,/\bnew\s+Worker\b/,/\.postMessage\s*\(/,/\blocalStorage\b/,/\bsessionStorage\b/,/\.exportEditedCopy\s*\(/])
  assert.doesNotMatch(executable,forbidden);
 assert.doesNotMatch(original,/new Blob\(\[result\.encryptedBytes\]/);
 assert.match(original,/await active\.downloadVerifiedCopy\(which\)/);
});
