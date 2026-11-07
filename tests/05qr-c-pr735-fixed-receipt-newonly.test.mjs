// 05 QR-C Task094, independent changed-only verification against Source PR735 87d634b6.
// Synthetic malformed Rust/WASM receipt injection: no genuine P1G, keys, browser runtime or Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';

const BUILD=Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true});
const ID='1'.repeat(32),SHA='2'.repeat(64),CUR='a'.repeat(32),NEXT='b'.repeat(32);
const decodedChunks=async function*(){yield new Uint8Array([123,125]);};
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
  indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const issue=()=>({cursor:CUR,sessionId:ID,revision:0,indexGeneration:1,
  decodedSha256:SHA,domain:'/Player',maxEntriesPerPage:16,
  completeAllDomains:false,productReadAccepted:false,writerAuthorized:false});
const page=()=>({sessionId:ID,revision:0,indexGeneration:1,
  decodedSha256:SHA,domain:'/Player',
  fields:[{key:'typedOnly',kind:'object',valueBytes:9}],
  nextCursor:NEXT,completeAllDomains:false,productReadAccepted:false,writerAuthorized:false});
function owner({issueRaw=x=>JSON.stringify(x),pageRaw=x=>JSON.stringify(x)}={}){
  class MockRust {
    constructor(platform,kind,bid,schema,attested,entropy){
      assert.equal(platform,'steam-windows');
      assert.equal(kind,'steam-full-version');
      assert.equal(bid,BUILD.buildId);
      assert.equal(schema,626);assert.equal(attested,true);
      assert.ok(entropy instanceof Uint8Array&&entropy.length===32&&entropy.some(x=>x!==0));
      this.closed=false;
    }
    append_chunk(chunk){assert.ok(chunk instanceof Uint8Array);}
    finish(){return JSON.stringify({contract:'wand.product.single-save-session.boundary@1',
      sessionId:ID,decodedSha256:SHA,revision:0,indexGeneration:1,schema:626,
      fullDocumentJsonValidated:true,productWorkerBound:true,
      allDomainReferencesVerified:false,productReadAccepted:false,
      writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});}
    issue_typed_cursor(domain,id,revision,indexGeneration,sha){
      assert.equal(domain,'player');assert.equal(id,ID);assert.equal(sha,SHA);
      assert.equal(typeof revision,'bigint');assert.equal(revision,0n);
      assert.equal(typeof indexGeneration,'bigint');assert.equal(indexGeneration,1n);
      return issueRaw(issue());
    }
    read_typed_page(cursor,id,revision,indexGeneration,sha){
      assert.equal(cursor,CUR);assert.equal(id,ID);assert.equal(sha,SHA);
      assert.equal(revision,0n);assert.equal(indexGeneration,1n);
      return pageRaw(page());
    }
    close(){this.closed=true;}
  }
  return createProductWasmReadOwner(async()=>({WorkerWasmSource:MockRust}));
}
const open=async w=>w.openDecoded({build:BUILD,decodedChunks:decodedChunks()});

test('Q94-R02 initial all-zero 128-bit typed cursor rejects, revokes and blocks a subsequent read',async()=>{
  const w=owner({issueRaw:x=>JSON.stringify({...x,cursor:'0'.repeat(32)})});
  const r=await open(w),s=scope(r);
  assert.throws(()=>w.issueTypedCursor(s,'player'),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
  assert.equal(w.getReceipt(),null);
  assert.throws(()=>w.readTypedPage(s,CUR),/PRODUCT_WORKER_SESSION_CLOSED/);
});

test('Q94-R03a escaped-equivalent duplicate cursor at root cannot be collapsed by JSON.parse',async()=>{
  const w=owner({issueRaw:x=>{
    const raw=JSON.stringify(x),key='"cursor":"'+CUR+'"';
    assert.ok(raw.includes(key));
    return raw.replace(key,key+',"cu\\u0072sor":"'+CUR+'"');
  }});
  const r=await open(w);
  assert.throws(()=>w.issueTypedCursor(scope(r),'player'),
    /PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
  assert.equal(w.getReceipt(),null);
});

test('Q94-R03b nested escaped-equivalent duplicate descriptor key rejects before parsing',async()=>{
  const w=owner({pageRaw:x=>{
    const raw=JSON.stringify(x),key='"valueBytes":9';
    assert.ok(raw.includes(key));
    return raw.replace(key,key+',"value\\u0042ytes":9');
  }});
  const r=await open(w),s=scope(r),c=w.issueTypedCursor(s,'player');
  assert.throws(()=>w.readTypedPage(s,c.cursor),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
  assert.equal(w.getReceipt(),null);
});

test('Q94-R04 all-zero nextCursor refuses rotation, revokes Worker and hides receipt',async()=>{
  const w=owner({pageRaw:x=>JSON.stringify({...x,nextCursor:'0'.repeat(32)})});
  const r=await open(w),s=scope(r),c=w.issueTypedCursor(s,'player');
  assert.throws(()=>w.readTypedPage(s,c.cursor),/PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID/);
  assert.equal(w.getReceipt(),null);
  assert.throws(()=>w.issueTypedCursor(s,'player'),/PRODUCT_WORKER_SESSION_CLOSED/);
});

test('Q94-RPOS nonzero grant, legal escaped sole key and rotation remain usable, close revokes',async()=>{
  const w=owner({pageRaw:x=>{
    const raw=JSON.stringify(x);
    return raw.replace('"key":"typedOnly"','"\\u006bey":"typedOnly"');
  }});
  const r=await open(w),s=scope(r),c=w.issueTypedCursor(s,'player');
  assert.equal(c.cursor,CUR);
  const p=w.readTypedPage(s,c.cursor);
  assert.deepEqual(p.fields,[{key:'typedOnly',kind:'object',valueBytes:9}]);
  assert.equal(p.nextCursor,NEXT);
  assert.equal(w.getCapabilities().canReadTypedMetadataInProduct,false);
  assert.equal(w.getCapabilities().canExportEditedCopy,false);
  assert.throws(()=>w.submitOperation({kind:'APPLY'}),/PRODUCT_WORKER_WRITER_DISABLED/);
  w.close();
  assert.equal(w.getReceipt(),null);
  assert.throws(()=>w.readTypedPage(s,NEXT),/PRODUCT_WORKER_SESSION_CLOSED/);
});
