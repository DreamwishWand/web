import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {loadCollectionRuntime,validateCollectionRuntimeIndex,decodeCollectionRecord} from '../src/lib/collection/runtime.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'../static/ddv/collection/v1.25');
const bytes=path=>readFileSync(join(root,path));
const index=JSON.parse(bytes('index.json').toString('utf8'));
const hex=b=>createHash('sha256').update(b).digest('hex');
const fixtureFiles=readdirSync(root).filter(x=>x.startsWith('records-')&&x.endsWith('.json')).sort();
const rootUrl='/ddv/collection/v1.25/';
function mockFetch({indexObject=index,missing='',corrupt='',replace=null}={}){
 const traces=[];
 async function fetch(url){
  const name=String(url).split('/').pop();
  traces.push(name);
  if(name===missing)return {ok:false,status:404};
  if(name==='index.json')return {ok:true,json:async()=>structuredClone(indexObject)};
  if(!fixtureFiles.includes(name))return {ok:false,status:404};
  let data=bytes(name);
  if(name===corrupt)data=Buffer.concat([data,Buffer.from(' ')]);
  if(replace&&replace.file===name)data=replace.data;
  return {ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
 }
 return {fetch,traces};
}
function clone(x){return structuredClone(x);}
test('QR192 independent all 18 on-repo shards: SHA256, exact bytes, contiguous offsets, distinct ItemID and Nintendo Switch target',()=>{
 assert.equal(index.s,'wand.collection.runtime@1');
 assert.equal(index.a,'COLLECTION_SEED_MANIFEST_DDV_v1.25.0_2026-10-02_V2');
 assert.deepEqual(index.t,{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'});
 assert.equal(index.shards.length,18);
 assert.equal(fixtureFiles.length,18);
 assert.deepEqual(index.shards.map(s=>s.file),fixtureFiles);
 let count=0,offset=0;
 const seen=new Set();
 let min=Number.MAX_SAFE_INTEGER,max=0;
 for(const s of index.shards){
  const raw=bytes(s.file),payload=JSON.parse(raw.toString('utf8'));
  assert.equal(raw.length,s.bytes,s.file+' raw byte size');
  assert.equal(hex(raw),s.sha256,s.file+' raw SHA256');
  assert.equal(payload.s,'wand.collection.records@1');
  assert.equal(payload.offset,offset);
  assert.equal(s.offset,offset);
  assert.equal(payload.count,s.count);
  assert.equal(payload.r.length,s.count);
  for(const row of payload.r){
   assert(Array.isArray(row)&&row.length===8,'row envelope');
   const id=row[0];
   assert(Number.isSafeInteger(id)&&id>=0,'valid ItemID');
   assert(!seen.has(id),'duplicate ItemID '+id);
   seen.add(id);min=Math.min(id,min);max=Math.max(id,max);
   for(const pos of [1,2,3]) assert(Number.isInteger(row[pos]),'dictionary scalar index');
   for(const pos of [4,5,6])assert(Array.isArray(row[pos]),'dictionary relation indexes');
   const decoded=decodeCollectionRecord(index,row,'en');
   assert.equal(decoded.itemId,id);
   assert(!Object.hasOwn(decoded,'owned')&&!Object.hasOwn(decoded,'discovered')&&!Object.hasOwn(decoded,'entitlement'));
  }
  count+=s.count;offset+=s.count;
 }
 assert.equal(count,12552);
 assert.equal(index.n,count);
 assert.equal(seen.size,count);
 console.log('QR_COLLECTION192_INDEPENDENT_ALL_SHARDS_BYTE_SHA_DUPLICATE_ID_PASS',JSON.stringify({shards:18,records:count,uniqueIds:seen.size,indexByteSHA256:hex(bytes('index.json')),minId:min,maxId:max,source:index.a,platform:index.t}));
});
test('QR192 loader fail-closed for absent shard, byte append, forged declared length, invalid source build and shard/manifest length',async()=>{
 for(const file of [fixtureFiles[0],fixtureFiles[17]]){
  await assert.rejects(loadCollectionRuntime('',mockFetch({missing:file}).fetch),/shard request failed/);
  await assert.rejects(loadCollectionRuntime('',mockFetch({corrupt:file}).fetch),/byte length mismatch/);
 }
 const wrongTarget=clone(index);wrongTarget.t={...wrongTarget.t,gameVersion:'1.25.3'};
 await assert.rejects(loadCollectionRuntime('',mockFetch({indexObject:wrongTarget}).fetch),/target does not match/);
 const steam=clone(index);steam.t={...steam.t,platform:'Steam'};
 await assert.rejects(loadCollectionRuntime('',mockFetch({indexObject:steam}).fetch),/target does not match/);
 const size=clone(index);size.shards[0].bytes++;
 await assert.rejects(loadCollectionRuntime('',mockFetch({indexObject:size}).fetch),/byte length mismatch/);
 const omitted=clone(index);omitted.shards.pop();
 await assert.rejects(loadCollectionRuntime('',mockFetch({indexObject:omitted}).fetch),/denominator mismatch/);
 const malformed=clone(index);malformed.shards[4].offset=99;
 assert.throws(()=>validateCollectionRuntimeIndex(malformed),/offset mismatch/);
});
test('QR192 Source red witness: unpinned index dictionary alteration accepted despite all shard checks',async()=>{
 const tampered=clone(index);
 tampered.f[0]='UNVERIFIED_SWITCH_SOURCE_DICTIONARY';
 const loaded=await loadCollectionRuntime('',mockFetch({indexObject:tampered}).fetch);
 assert.equal(loaded.rows.length,12552);
 assert.equal(loaded.index.f[0],'UNVERIFIED_SWITCH_SOURCE_DICTIONARY');
 console.log('QR_COLLECTION192_RED_UNPINNED_INDEX_DICTIONARY_ACCEPTED',JSON.stringify({
  accepted:true,validatedIndexFileAgainstPinnedSHA256:false,shardHashesUnchanged:true,
  impact:'category/display labels may be reassigned without changing shard bytes',
  sourceOnlyWitness:true
 }));
});
test('QR192 Source red witness: duplicate ItemID across shards accepted when attacker can update manifest hash',async()=>{
 const tampered=clone(index);
 const file=fixtureFiles[1],payload=JSON.parse(bytes(file).toString('utf8'));
 const otherId=JSON.parse(bytes(fixtureFiles[0]).toString('utf8')).r[0][0];
 payload.r[0][0]=otherId;
 const raw=Buffer.from(JSON.stringify(payload));
 tampered.shards[1].bytes=raw.byteLength;
 tampered.shards[1].sha256=hex(raw);
 const loaded=await loadCollectionRuntime('',mockFetch({indexObject:tampered,replace:{file,data:raw}}).fetch);
 const n=loaded.rows.filter(r=>r[0]===otherId).length;
 assert.equal(n,2);
 console.log('QR_COLLECTION192_RED_DUPLICATE_ID_AFTER_SELF_CONSISTENT_MANIFEST_ACCEPTED',JSON.stringify({
  duplicateItemId:otherId,copies:n,accepted:true,
  origin:'synthetic tampered manifest/shard fixture not checked-in dataset',sourceOnlyWitness:true
 }));
});
