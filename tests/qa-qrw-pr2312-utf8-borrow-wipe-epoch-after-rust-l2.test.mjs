// 04 QR-W independent L2: real existing ProductSession bridge must never
// retain generator-owned decoded UTF8 after synchronous Rust borrow completes,
// an early Rust throw, shadowed .fill or a mid-append Close epoch revocation.
// All P1G fixtures are synthetic. This is not genuine Owner Save/OS V2.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile,syntheticProfile} from './helpers/p1g-fixture.mjs';
import {createP1gRustWorkerReadOnlyBridge}
 from '../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';

const BUILD=Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',
 buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 schema:626,externallyConfirmed:true});
const sha=s=>createHash('sha256').update(s).digest('hex');
const fixture=()=>{
 const root=syntheticProfile('DeviceType_Windows');
 root.GameInfo.Version=626;
 root.Player.name='Independent 04 QR-W 🔒';
 root.Player.unicode='🍁'.repeat(300000);
 root.World.opaqueNew={nextUnknown:[null,true,13]};
 return {root,source:makeSyntheticP1gProfile(root)};
};
function instrument(onBorrow=()=>{}){
 const borrowed=[],synchronousCopies=[];
 class CapturedRust {
  constructor(platform,kind,buildId,schema,confirmed,entropy){
   assert.equal(platform,'steam-windows');assert.equal(kind,'steam-full-version');
   assert.equal(buildId,BUILD.buildId);assert.equal(schema,626);
   assert.equal(confirmed,true);
   assert(entropy instanceof Uint8Array&&entropy.length===32);
   this.parts=[];this.closed=false;
  }
  append_chunk(chunk){
   assert(chunk instanceof Uint8Array);
   assert(chunk.length>0&&chunk.length<=1048576);
   assert(chunk.some(x=>x!==0),'borrowed decoded plaintext must still be readable by synchronous Rust consumer');
   const copied=Buffer.from(chunk);
   const index=borrowed.push(chunk);
   synchronousCopies.push(copied);
   onBorrow({index,chunk,copied});
   this.parts.push(copied);
  }
  finish(){
   assert.equal(this.closed,false);
   const json=Buffer.concat(this.parts);
   const obj=JSON.parse(json.toString('utf8'));
   assert.equal(obj.GameInfo.Version,626);
   const digest=sha(json);
   return JSON.stringify({
    contract:'wand.product.single-save-session.boundary@1',
    sessionId:'f'.repeat(32),decodedSha256:digest,
    revision:0,indexGeneration:1,schema:626,
    fullDocumentJsonValidated:true,productWorkerBound:true,
    allDomainReferencesVerified:false,productReadAccepted:false,
    writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false
   });
  }
  close(){this.closed=true}
 }
 return {CapturedRust,borrowed,synchronousCopies};
}
const makeBridge=h=>createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource:h.CapturedRust}));
const zeros=items=>{
 assert(items.length>0,'actual Rust append must borrow at least one decoded chunk');
 for(const bytes of items){
  assert(bytes instanceof Uint8Array&&bytes.length>0);
  assert(bytes.every(x=>x===0),'generator-owned decoded UTF8 temporary still resident after consumer exit');
 }
};
test('Rust sees exact Unicode bytes before wipe, but all borrowed buffers are cleared before success receipt',async()=>{
 const {source,root}=fixture(),original=source.slice(),h=instrument(),bridge=makeBridge(h);
 const receipt=await bridge.openEncrypted({build:BUILD,encryptedBytes:source});
 assert(h.borrowed.length>=2,'Unicode fixture must cross UTF8 chunk boundary');
 zeros(h.borrowed);
 const copied=Buffer.concat(h.synchronousCopies);
 assert.deepEqual(copied,Buffer.from(JSON.stringify(root),'utf8'),
   'synchronous Rust append must receive uncorrupted exact decoded bytes with no surrogate truncation');
 assert.equal(receipt.decodedSha256,sha(copied));
 assert.equal(receipt.writerAuthorized,false);
 assert.equal(receipt.editedCopyAuthorized,false);
 assert.deepEqual(source,original,'caller encrypted P1G remains immutable');
 bridge.close();
});
test('hostile own fill shadow on Rust-borrowed chunk cannot bypass intrinsic Uint8Array wipe',async()=>{
 const {source}=fixture(),original=source.slice();
 const h=instrument(({chunk})=>{
  Object.defineProperty(chunk,'fill',{value:()=>{throw Error('OWN_FILL_SHOULD_NOT_BE_CALLED')}});
 });
 const bridge=makeBridge(h);
 const receipt=await bridge.openEncrypted({build:BUILD,encryptedBytes:source});
 zeros(h.borrowed);
 assert.equal(receipt.writerAuthorized,false);
 assert.deepEqual(source,original);
 bridge.close();
});
test('Rust rejects FIRST borrowed chunk: emitted and rejected plaintext is wiped, no partial ProductSession receipt',async()=>{
 const {source}=fixture(),original=source.slice();
 const h=instrument(()=>{throw Error('INJECTED_FIRST_APPEND_THROW')});
 const bridge=makeBridge(h);
 await assert.rejects(bridge.openEncrypted({build:BUILD,encryptedBytes:source}),/PRODUCT_WORKER_RUST_FAILURE/);
 assert.equal(h.borrowed.length,1);
 zeros(h.borrowed);
 assert.equal(bridge.getReceipt(),null);
 assert.deepEqual(source,original);
 assert.equal(bridge.getCapabilities().canExportEditedCopy,false);
 bridge.close();
});
test('explicit Close DURING synchronous Rust append revokes epoch; no stale read grant and every borrowed plaintext chunk erased',async()=>{
 const {source}=fixture(),original=source.slice();
 let bridge=null,closes=0;
 const h=instrument(({index})=>{
  if(index===1){bridge.close();closes++}
 });
 bridge=makeBridge(h);
 await assert.rejects(bridge.openEncrypted({build:BUILD,encryptedBytes:source}),
  /PRODUCT_WORKER_OPEN_REVOKED|P1G_WORKER_OPEN_REVOKED|PRODUCT_WORKER_RUST_FAILURE/);
 assert.equal(closes,1);
 zeros(h.borrowed);
 assert.equal(bridge.getReceipt(),null);
 assert.deepEqual(source,original);
 assert.equal(bridge.getCapabilities().canReadTypedMetadataInProduct,false);
 bridge.close();
});

test('bounds rejection BEFORE Rust borrowing still zeroes generator-created oversized plaintext chunk',async()=>{
 const {source}=fixture(),original=source.slice();
 const MAX=1024*1024,MAX_UNITS=Math.floor(MAX/3)-1;
 const originalEncode=TextEncoder.prototype.encode;
 const allocated=[];
 TextEncoder.prototype.encode=function(value){
  if(typeof value==='string'&&value.length>=MAX_UNITS-1&&value.length<=MAX_UNITS){
   const bytes=new Uint8Array(MAX+1);
   bytes.fill(117); // fake oversized output: model a hostile Unicode encoder
   allocated.push(bytes);
   return bytes;
  }
  return originalEncode.call(this,value);
 };
 const h=instrument(),bridge=makeBridge(h);
 try{
  await assert.rejects(bridge.openEncrypted({build:BUILD,encryptedBytes:source}),
   /PRODUCT_WORKER_RUST_FAILURE|P1G_WORKER_UTF8_CHUNK_BOUNDS/);
 }finally{
  TextEncoder.prototype.encode=originalEncode;
  bridge.close();
 }
 assert.equal(allocated.length,1,'only the first generated decoded UTF8 chunk must trigger bounds failure');
 zeros(allocated);
 assert.equal(h.borrowed.length,0,'oversized plaintext never reaches Rust append_chunk');
 assert.equal(bridge.getReceipt(),null);
 assert.deepEqual(source,original,'caller encrypted original bytes never modified by injected encoder');
});
