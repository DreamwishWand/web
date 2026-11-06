// 05 QR-C Task094 / Stage D NEW_ONLY / fixed 01A Source PR735.
// Synthetic malformed WASM receipt boundary only. No private P1G, key or Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';

const BUILD={platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true};
const ID='1'.repeat(32), SHA='2'.repeat(64), CUR='a'.repeat(32), NEXT='b'.repeat(32);
const chunks=async function*(){yield new Uint8Array([123,125]);};
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
  indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const validIssue=()=>({cursor:CUR,sessionId:ID,revision:0,indexGeneration:1,
  decodedSha256:SHA,domain:'/Player',maxEntriesPerPage:16,
  completeAllDomains:false,productReadAccepted:false,writerAuthorized:false});
const validPage=()=>({sessionId:ID,revision:0,indexGeneration:1,
  decodedSha256:SHA,domain:'/Player',
  fields:[{key:'typedOnly',kind:'object',valueBytes:9}],
  nextCursor:NEXT,completeAllDomains:false,
  productReadAccepted:false,writerAuthorized:false});
function instance({mutateIssue=x=>JSON.stringify(x),mutatePage=x=>JSON.stringify(x)}={}){
  class MockRust {
    constructor(platform,kind,bid,schema,attested,entropy){
      assert.equal(platform,'steam-windows');
      assert.equal(kind,'steam-full-version');
      assert.equal(schema,626);
      assert.equal(attested,true);
      assert.ok(entropy instanceof Uint8Array && entropy.length===32);
      assert.ok(entropy.some(x=>x!==0));
      this.closed=false;
    }
    append_chunk(v){assert.ok(v instanceof Uint8Array);}
    finish(){return JSON.stringify({contract:'wand.product.single-save-session.boundary@1',
      sessionId:ID,decodedSha256:SHA,revision:0,indexGeneration:1,schema:626,
      fullDocumentJsonValidated:true,productWorkerBound:true,
      allDomainReferencesVerified:false,productReadAccepted:false,
      writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});}
    issue_typed_cursor(domain,id,rev,gen,sha){
      assert.equal(domain,'player');assert.equal(id,ID);
      assert.equal(typeof rev,'bigint');assert.equal(typeof gen,'bigint');
      assert.equal(rev,0n);assert.equal(gen,1n);assert.equal(sha,SHA);
      return mutateIssue(validIssue());
    }
    read_typed_page(cursor,id,rev,gen,sha){
      assert.equal(cursor,CUR);assert.equal(id,ID);
      assert.equal(rev,0n);assert.equal(gen,1n);assert.equal(sha,SHA);
      return mutatePage(validPage());
    }
    close(){this.closed=true;}
  }
  return createProductWasmReadOwner(async()=>({WorkerWasmSource:MockRust}));
}
const open=async w=>w.openDecoded({build:BUILD,decodedChunks:chunks()});

test('Q94-01 strict BigInt JS bridge accepts valid metadata but Writer stays OFF',async()=>{
  const w=instance(),receipt=await open(w),s=scope(receipt);
  const grant=w.issueTypedCursor(s,'player');
  assert.equal(grant.cursor,CUR);
  const page=w.readTypedPage(s,grant.cursor);
  assert.equal(page.fields.length,1);
  assert.deepEqual(page.fields[0],{key:'typedOnly',kind:'object',valueBytes:9});
  assert.equal(page.nextCursor,NEXT);
  assert.equal(w.getCapabilities().canReadTypedMetadataInProduct,false);
  assert.equal(w.getCapabilities().canExportEditedCopy,false);
  assert.throws(()=>w.submitOperation({kind:'APPLY'}),/PRODUCT_WORKER_WRITER_DISABLED/);
  w.close();
});

test('Q94-02 forged all-zero Rust cursor receipt must fail closed and revoke Worker',async()=>{
  const w=instance({mutateIssue:x=>JSON.stringify({...x,cursor:'0'.repeat(32)})});
  const r=await open(w);
  assert.throws(()=>w.issueTypedCursor(scope(r),'player'),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
  assert.equal(w.getReceipt(),null);
});

test('Q94-03 malformed duplicate JSON receipt property must fail closed before cursor grant',async()=>{
  const w=instance({mutateIssue:x=>{
    const json=JSON.stringify(x);
    const key='"cursor":"'+CUR+'"';
    assert.equal(json.split(key).length,2);
    return json.replace(key,key+','+key);
  }});
  const r=await open(w);
  assert.throws(()=>w.issueTypedCursor(scope(r),'player'),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
  assert.equal(w.getReceipt(),null);
});

test('Q94-04 forged zero nextCursor from Rust must fail closed and revoke Worker',async()=>{
  const w=instance({mutatePage:x=>JSON.stringify({...x,nextCursor:'0'.repeat(32)})});
  const r=await open(w),s=scope(r),grant=w.issueTypedCursor(s,'player');
  assert.throws(()=>w.readTypedPage(s,grant.cursor),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
  assert.equal(w.getReceipt(),null);
});

test('Q94-05 unexpected extra metadata payload in a page must fail closed',async()=>{
  const w=instance({mutatePage:x=>JSON.stringify({...x,rawValue:'personal_binary_not_allowed'})});
  const r=await open(w),s=scope(r),grant=w.issueTypedCursor(s,'player');
  assert.throws(()=>w.readTypedPage(s,grant.cursor),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
  assert.equal(w.getReceipt(),null);
});
