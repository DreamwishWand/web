import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';

const BUILD=Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true});
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
  indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const source=async function*(){yield new Uint8Array([1,2,3,4])};
let serial=0;
const token=()=>((++serial).toString(16)).padStart(32,'0');
const sha='a'.repeat(64);
class MockRust {
  constructor(platform,kind,build,schema,confirmed,entropy){
    assert.equal(platform,'steam-windows');
    assert.equal(kind,'steam-full-version');
    assert.equal(schema,626);
    assert.equal(confirmed,true);
    assert.ok(entropy instanceof Uint8Array && entropy.length===32 &&
      entropy.some(b=>b!==0),'trusted WebCrypto nonzero entropy');
    this.id=token();this.closed=false;this.grants=new Map();
  }
  append_chunk(chunk){assert.ok(chunk instanceof Uint8Array && chunk.byteLength<=1024*1024)}
  finish(){return JSON.stringify({contract:'wand.product.single-save-session.boundary@1',
    sessionId:this.id,decodedSha256:sha,revision:0,indexGeneration:1,schema:626,
    fullDocumentJsonValidated:true,productWorkerBound:true,
    allDomainReferencesVerified:false,productReadAccepted:false,
    writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false})}
  issue_typed_cursor(domain,id,rev,gen,digest){
    assert.equal(rev,0n);assert.equal(gen,1n);assert.equal(typeof rev,'bigint');
    assert.equal(id,this.id);assert.equal(digest,sha);
    if(this.closed || !['player','world'].includes(domain))throw Error('DENIED');
    const cursor=token();
    const path=domain==='player'?'/Player':'/World';
    this.grants.set(cursor,{domain:path,pos:0});
    return JSON.stringify({cursor,sessionId:id,revision:0,indexGeneration:1,
      decodedSha256:sha,domain:path,maxEntriesPerPage:16,
      completeAllDomains:false,productReadAccepted:false,writerAuthorized:false});
  }
  read_typed_page(cursor,id,rev,gen,digest){
    assert.equal(rev,0n);assert.equal(gen,1n);assert.equal(id,this.id);
    assert.equal(digest,sha);
    if(this.closed || !this.grants.has(cursor))throw Error('CURSOR_DENIED');
    const grant=this.grants.get(cursor);this.grants.delete(cursor);
    const world=grant.domain==='/World';const total=world?2:33;
    const count=Math.min(16,total-grant.pos);
    const fields=Array.from({length:count},(_,n)=>({
      key:world?(n===0?'WorldRoot':'Clock'):'field_'+String(grant.pos+n).padStart(3,'0'),
      kind:world?(n===0?'object':'number'):['object','array','string','number','boolean','null'][(grant.pos+n)%6],
      valueBytes:(grant.pos+n===0&&!world)?16*1024*1024:6
    }));
    const pos=grant.pos+count;const nextCursor=pos>=total?null:token();
    if(nextCursor)this.grants.set(nextCursor,{domain:grant.domain,pos});
    return JSON.stringify({sessionId:id,revision:0,indexGeneration:1,
      decodedSha256:sha,domain:grant.domain,fields,nextCursor,
      completeAllDomains:false,productReadAccepted:false,writerAuthorized:false});
  }
  read_core_version_witness(id,rev,gen,digest){
    return JSON.stringify({sessionId:id,revision:Number(rev),indexGeneration:Number(gen),
      decodedSha256:digest,coreOwnedReadset:'/GameInfo/Version',
      completeAllDomains:false,writerAuthorized:false});
  }
  close(){this.closed=true;this.grants.clear()}
}
const make=(Ctor=MockRust)=>createProductWasmReadOwner(async()=>({WorkerWasmSource:Ctor}));
const open=async w=>w.openDecoded({build:BUILD,decodedChunks:source()});

test('D01 Worker-owned Rust metadata page16/16/1 with single session and no raw body',async()=>{
 const w=make(),r=await open(w),s=scope(r);
 const capabilities=w.getCapabilities();
 assert.equal(capabilities.productReadAccepted,false);
 assert.equal(capabilities.canReadTypedMetadataInProduct,false);
 assert.equal(capabilities.canExportEditedCopy,false);
 let c=w.issueTypedCursor(s,'player');
 assert.equal(c.cursor.length,32);assert.equal(c.domain,'/Player');
 const fields=[];
 for(let n=0;n<3;n++){
   const page=w.readTypedPage(s,c.cursor);
   assert.ok(page.fields.length<=16);
   assert.equal(page.sessionId,s.sessionId);
   assert.equal(page.writerAuthorized,false);
   assert.equal(page.completeAllDomains,false);
   assert.equal(page.productReadAccepted,false);
   assert.ok(page.fields.every(f=>Object.keys(f).sort().join(',')==='key,kind,valueBytes'));
   fields.push(...page.fields);
   assert.throws(()=>w.readTypedPage(s,c.cursor),/CURSOR_UNKNOWN_OR_CONSUMED/);
   if(n<2){assert.ok(page.nextCursor);c={cursor:page.nextCursor}}
   else assert.equal(page.nextCursor,null);
 }
 assert.equal(fields.length,33);
 assert.equal(fields[0].valueBytes,16*1024*1024);
 assert.equal(fields[0].kind,'object');
 assert.equal(fields[1].kind,'array');
 assert.equal(fields[2].kind,'string');
 assert.equal(fields.at(-1).key,'field_032');
 const world=w.issueTypedCursor(s,'world');
 const p=w.readTypedPage(s,world.cursor);
 assert.deepEqual(p.fields.map(f=>f.key),['WorldRoot','Clock']);
 assert.equal(w.getReceipt().decodedSha256,sha);
 assert.throws(()=>w.submitOperation({kind:'Apply'}),/PRODUCT_WORKER_WRITER_DISABLED/);
 w.close();
});
test('D02 forged scope, unknown domain and cursor are denied without losing valid grant',async()=>{
 const w=make(),r=await open(w),s=scope(r),c=w.issueTypedCursor(s,'player');
 for(const changed of [{sessionId:'f'.repeat(32)},{revision:2},{indexGeneration:2},
   {decodedSha256:'f'.repeat(64)},{uiReadset:'/World'},{entropy:new Uint8Array(32)}]){
   assert.throws(()=>w.readTypedPage({...s,...changed},c.cursor),/PRODUCT_WORKER_SCOPE_CAS/);
 }
 assert.throws(()=>w.issueTypedCursor(s,'../../Secrets'),/DOMAIN_DENIED/);
 assert.throws(()=>w.readTypedPage(s,'0'.repeat(32)),/CURSOR_UNKNOWN_OR_CONSUMED/);
 assert.ok(w.readTypedPage(s,c.cursor).nextCursor);
 w.close();
});
test('D03 cap2, one-use rotation, forged cross-session and Close revocation',async()=>{
 const w=make(),r=await open(w),s=scope(r);
 const a=w.issueTypedCursor(s,'player'),b=w.issueTypedCursor(s,'world');
 assert.throws(()=>w.issueTypedCursor(s,'world'),/PRODUCT_WORKER_CURSOR_LIMIT/);
 const next=w.readTypedPage(s,a.cursor).nextCursor;
 assert.ok(next);
 assert.throws(()=>w.issueTypedCursor(s,'world'),/PRODUCT_WORKER_CURSOR_LIMIT/);
 w.readTypedPage(s,b.cursor);
 const newer=w.issueTypedCursor(s,'world');
 assert.ok(newer.cursor);
 const v=await open(w);
 assert.notEqual(v.sessionId,s.sessionId);
 assert.throws(()=>w.readTypedPage(s,next),/PRODUCT_WORKER_SCOPE_CAS/);
 assert.throws(()=>w.readTypedPage(scope(v),next),/CURSOR_UNKNOWN_OR_CONSUMED/);
 const cur=w.issueTypedCursor(scope(v),'player');
 w.close();
 assert.throws(()=>w.readTypedPage(scope(v),cur.cursor),/PRODUCT_WORKER_SESSION_CLOSED/);
});
test('D04 no indexed WASM feature remains fail-closed, product API still denies',async()=>{
 class NoIndex extends MockRust{constructor(...a){super(...a);this.issue_typed_cursor=undefined;this.read_typed_page=undefined;}}
 const w=make(NoIndex),r=await open(w);
 assert.throws(()=>w.issueTypedCursor(scope(r),'player'),/PRODUCT_WORKER_TYPED_FEATURE_DISABLED/);
 assert.equal(w.getCapabilities().canReadTypedMetadataInProduct,false);
 assert.throws(()=>w.submitOperation({kind:'Stage'}),/PRODUCT_WORKER_WRITER_DISABLED/);
 w.close();
});
test('D05 forged Rust cursor receipt, elevated flag, wrong owner or domain revoke Worker',async()=>{
 for(const changed of [
   {productReadAccepted:true},{writerAuthorized:true},{completeAllDomains:true},
   {cursor:'bad'},{sessionId:'f'.repeat(32)},{domain:'/Secret'},
   {maxEntriesPerPage:128},{revision:9},{extra:'untrusted'}
 ]){
   class Forged extends MockRust {
     issue_typed_cursor(...args){return JSON.stringify({...JSON.parse(super.issue_typed_cursor(...args)),...changed})}
   }
   const w=make(Forged),r=await open(w);
   assert.throws(()=>w.issueTypedCursor(scope(r),'player'),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
   assert.equal(w.getReceipt(),null);
 }
});
test('D06 forged page extra raw value/key/value bytes/field count and permission revoke',async()=>{
 for(const forge of [
    x=>({...x,writerAuthorized:true}),
    x=>({...x,fields:[{key:'secret',kind:'string',valueBytes:5,rawValue:'LEAK'}]}),
    x=>({...x,fields:[{key:'X'.repeat(129),kind:'string',valueBytes:4}]}),
    x=>({...x,fields:[{key:'ok',kind:'blob',valueBytes:9}]}),
    x=>({...x,fields:[{key:'ok',kind:'string',valueBytes:Number.MAX_VALUE}]}),
    x=>({...x,fields:Array.from({length:17},(_,i)=>({key:String(i),kind:'number',valueBytes:1}))}),
    x=>({...x,decodedSha256:'f'.repeat(64)}),
    x=>({...x,domain:'/Secret'}),
    x=>({...x,nextCursor:'0'.repeat(32),rawBody:{private:true}}),
 ]){
   class Forged extends MockRust{
     read_typed_page(...args){return JSON.stringify(forge(JSON.parse(super.read_typed_page(...args))))}
   }
   const w=make(Forged),r=await open(w),c=w.issueTypedCursor(scope(r),'player');
   assert.throws(()=>w.readTypedPage(scope(r),c.cursor),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
   assert.equal(w.getReceipt(),null);
 }
});
test('D07 caller-supplied entropy/open params and invalid build are refused',async()=>{
 const w=make();
 await assert.rejects(w.openDecoded({build:BUILD,decodedChunks:source(),entropy:new Uint8Array(32)}),
    /PRODUCT_WORKER_UNTRUSTED_OPEN_ARGS/);
 await assert.rejects(w.openDecoded({build:BUILD,decodedChunks:source(),cursor:'untrusted'}),
    /PRODUCT_WORKER_UNTRUSTED_OPEN_ARGS/);
 await assert.rejects(w.openDecoded({build:{...BUILD,schema:624},decodedChunks:source()}),
    /PRODUCT_WORKER_BUILD_NOT_VERIFIED/);
 assert.equal(w.getReceipt(),null);
});
test('D08 absent or zero WebCrypto entropy cannot open; no token minted or leaked',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 try{
   Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
   const w=make();
   await assert.rejects(open(w),/PRODUCT_WORKER_ENTROPY_UNAVAILABLE/);
   assert.equal(w.getReceipt(),null);
   Object.defineProperty(globalThis,'crypto',{configurable:true,
     value:{getRandomValues(array){array.fill(0);return array}}});
   const other=make();
   await assert.rejects(open(other),/PRODUCT_WORKER_ENTROPY_UNAVAILABLE/);
   assert.equal(other.getReceipt(),null);
 }finally{
   if(original)Object.defineProperty(globalThis,'crypto',original);
   else delete globalThis.crypto;
 }
});

test('Q94-02 source regression: all-zero initial Rust cursor revokes Worker',async()=>{
 class ZeroCursor extends MockRust {
   issue_typed_cursor(...args){
     return JSON.stringify({...JSON.parse(super.issue_typed_cursor(...args)),
       cursor:'0'.repeat(32)});
   }
 }
 const w=make(ZeroCursor),r=await open(w);
 assert.throws(()=>w.issueTypedCursor(scope(r),'player'),
   /PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
 assert.equal(w.getReceipt(),null);
});
test('Q94-03 source regression: duplicate top-level cursor JSON key revoked before parse',async()=>{
 class DuplicateCursor extends MockRust {
   issue_typed_cursor(...args){
     const raw=super.issue_typed_cursor(...args);
     const m=raw.match(/"cursor":"[a-f0-9]{32}"/);
     assert.ok(m);
     return raw.replace(m[0],m[0]+','+m[0]);
   }
 }
 const w=make(DuplicateCursor),r=await open(w);
 assert.throws(()=>w.issueTypedCursor(scope(r),'player'),
   /PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
 assert.equal(w.getReceipt(),null);
});
test('Q94-03 nested escaped-equivalent duplicate typed JSON keys also revoke',async()=>{
 class NestedDuplicate extends MockRust {
   read_typed_page(...args){
     const raw=super.read_typed_page(...args);
     const key='"valueBytes":16777216';
     assert.ok(raw.includes(key));
     // JSON.parse alone would silently overwrite the escaped equivalent.
     return raw.replace(key,key+',"value\\u0042ytes":16777216');
   }
 }
 const w=make(NestedDuplicate),r=await open(w);
 const c=w.issueTypedCursor(scope(r),'player');
 assert.throws(()=>w.readTypedPage(scope(r),c.cursor),
   /PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
 assert.equal(w.getReceipt(),null);
});
test('Q94-04 source regression: all-zero nextCursor revokes Worker',async()=>{
 class ZeroNext extends MockRust {
   read_typed_page(...args){
     return JSON.stringify({...JSON.parse(super.read_typed_page(...args)),
       nextCursor:'0'.repeat(32)});
   }
 }
 const w=make(ZeroNext),r=await open(w);
 const c=w.issueTypedCursor(scope(r),'player');
 assert.throws(()=>w.readTypedPage(scope(r),c.cursor),
   /PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
 assert.equal(w.getReceipt(),null);
});
