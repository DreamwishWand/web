import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile,syntheticProfile} from './helpers/p1g-fixture.mjs';
import {createP1gRustWorkerReadOnlyBridge} from '../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';

const BUILD={platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true};
let seq=0;const hex=v=>v.toString(16).padStart(32,'0');
function fixture(version=626){
 const root=syntheticProfile('DeviceType_Windows');
 root.GameInfo.Version=version;
 root.Player.name='synthetic 🌿 縁';root.Player.multibyte='🌿'.repeat(300000);
 root.World.future={unknown:[{nested:true},null,3]};
 return {root,source:makeSyntheticP1gProfile(root)};
}
class MockRust {
 constructor(platform,buildKind,buildId,schema,confirmed,entropy){
  assert.equal(platform,'steam-windows');
  assert.equal(buildKind,'steam-full-version');
  assert.equal(buildId,BUILD.buildId);
  assert.equal(schema,626);assert.equal(confirmed,true);
  assert.ok(entropy instanceof Uint8Array&&entropy.length===32&&entropy.some(x=>x!==0));
  this.id=hex(++seq);this.buffers=[];this.closed=false;this.grants=new Set();
 }
 append_chunk(chunk){
  assert.ok(chunk instanceof Uint8Array&&chunk.length>0&&chunk.length<=1048576);
  this.buffers.push(Buffer.from(chunk));
 }
 finish(){
  if(this.closed)throw Error('CLOSED');
  const b=Buffer.concat(this.buffers);this.bytes=b;
  const doc=JSON.parse(b.toString('utf8'));
  assert.equal(doc.GameInfo.Version,626);
  assert.equal(doc.Player.name,'synthetic 🌿 縁');
  this.sha=createHash('sha256').update(b).digest('hex');
  return JSON.stringify({contract:'wand.product.single-save-session.boundary@1',
   sessionId:this.id,decodedSha256:this.sha,revision:0,indexGeneration:1,schema:626,
   fullDocumentJsonValidated:true,productWorkerBound:true,
   allDomainReferencesVerified:false,productReadAccepted:false,writerAuthorized:false,
   editedCopyAuthorized:false,applyAuthorized:false});
 }
 read_core_version_witness(session,rev,gen,source){
  if(this.closed||session!==this.id||source!==this.sha||rev!==0n||gen!==1n)
    throw Error('CAS_DENIED');
  return JSON.stringify({sessionId:this.id,revision:0,indexGeneration:1,
    decodedSha256:this.sha,coreOwnedReadset:'/GameInfo/Version',
    completeAllDomains:false,writerAuthorized:false});
 }
 issue_typed_cursor(domain,id,rev,gen,digest){
  if(this.closed||!['player','world'].includes(domain)||id!==this.id||
    rev!==0n||gen!==1n||digest!==this.sha)throw Error('SCOPE_DENIED');
  const cursor=hex(++seq);this.grants.add(cursor);
  return JSON.stringify({cursor,sessionId:id,revision:0,indexGeneration:1,
    decodedSha256:this.sha,domain:domain==='player'?'/Player':'/World',
    maxEntriesPerPage:16,completeAllDomains:false,productReadAccepted:false,
    writerAuthorized:false});
 }
 read_typed_page(token,id,rev,gen,digest){
  if(this.closed||!this.grants.delete(token)||id!==this.id||rev!==0n||gen!==1n||
    digest!==this.sha)throw Error('TOKEN_DENIED');
  return JSON.stringify({sessionId:id,revision:0,indexGeneration:1,
    decodedSha256:this.sha,domain:'/Player',
    fields:[{key:'name',kind:'string',valueBytes:22}],
    nextCursor:null,completeAllDomains:false,
    productReadAccepted:false,writerAuthorized:false});
 }
 close(){this.closed=true;this.buffers=[];this.grants.clear()}
}
const make=()=>createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource:MockRust}));
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
 indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
test('S01 existing P1G Codec→same Rust Worker source: chunked unicode, metadata only',async()=>{
 const {source,root}=fixture(),original=source.slice(),bridge=make();
 const receipt=await bridge.openEncrypted({build:BUILD,encryptedBytes:source});
 assert.equal(receipt.fullDocumentJsonValidated,true);
 assert.equal(receipt.schema,626);
 assert.equal(receipt.decodedByExistingP1gCodec,true);
 assert.equal(receipt.externalPhysicalBuildVerified,false);
 assert.equal(receipt.productReadAccepted,false);
 assert.equal(receipt.writerAuthorized,false);
 assert.equal(receipt.editedCopyAuthorized,false);
 assert.equal(receipt.applyAuthorized,false);
 assert.equal(receipt.allDomainReferencesVerified,false);
 assert.equal(bridge.getCapabilities().canReadTypedMetadataInProduct,false);
 assert.equal(bridge.getCapabilities().canExportEditedCopy,false);
 assert.ok(!('jsonText' in receipt)&&!('encryptedBytes' in receipt));
 const expected=createHash('sha256').update(JSON.stringify(root),'utf8').digest('hex');
 assert.equal(receipt.decodedSha256,expected);
 assert.deepEqual(source,original); // never mutate caller bytes
 const s=scope(receipt);
 assert.equal(bridge.readCoreVersion(s).coreOwnedReadset,'/GameInfo/Version');
 const cursor=bridge.issueTypedCursor(s,'player');
 const page=bridge.readTypedPage(s,cursor.cursor);
 assert.equal(page.fields[0].key,'name');
 assert.equal(page.writerAuthorized,false);
 assert.throws(()=>bridge.readTypedPage(s,cursor.cursor),/PRODUCT_WORKER_CURSOR_UNKNOWN_OR_CONSUMED/);
 assert.equal(bridge.close().closed,true);
 assert.throws(()=>bridge.issueTypedCursor(s,'player'),/PRODUCT_WORKER_SESSION_CLOSED/);
});
test('S02 reject bad encrypted, unsupported schema/build, unknown BID and Switch/Steam mismatch',async()=>{
 const {source}=fixture(),bad=fixture(624).source,bridge=make();
 for(const args of [
   {build:BUILD,encryptedBytes:new Uint8Array()},
   {build:BUILD,encryptedBytes:source.slice(0,-1)},
   {build:{...BUILD,schema:624},encryptedBytes:source},
   {build:{...BUILD,externallyConfirmed:false},encryptedBytes:source},
   {build:{...BUILD,buildId:'unknown'},encryptedBytes:source},
   {build:{...BUILD,platform:'switch'},encryptedBytes:source},
   {build:BUILD,encryptedBytes:bad},
   {build:BUILD,encryptedBytes:source,entropy:'untrusted'},
 ]){
   await assert.rejects(bridge.openEncrypted(args));
   assert.equal(bridge.getReceipt(),null);
 }
 assert.equal(bridge.close().closed,true);
});
test('S03 A→B concurrent decode discards A, preserves only one Session and close',async()=>{
 const {source}=fixture(),bridge=make();
 const a=bridge.openEncrypted({build:BUILD,encryptedBytes:source});
 const b=bridge.openEncrypted({build:BUILD,encryptedBytes:source});
 await assert.rejects(a,/P1G_WORKER_OPEN_REVOKED/);
 const newer=await b;
 assert.equal(bridge.getReceipt().sessionId,newer.sessionId);
 assert.equal(newer.writerAuthorized,false);
 bridge.close();
 assert.equal(bridge.getReceipt(),null);
});
test('S04 stale/forged source revision and readset never request Writer',async()=>{
 const {source}=fixture(),bridge=make(),r=await bridge.openEncrypted({build:BUILD,encryptedBytes:source});
 const s=scope(r);
 for(const wrong of [{revision:4},{indexGeneration:4},{sessionId:'f'.repeat(32)},
   {decodedSha256:'f'.repeat(64)},{uiReadset:'/World/Secrets'}]){
   assert.throws(()=>bridge.readCoreVersion({...s,...wrong}));
 }
 assert.throws(()=>bridge.issueTypedCursor(s,'../../Secrets'),/PRODUCT_WORKER_DOMAIN_DENIED/);
 assert.equal(bridge.getReceipt().sessionId,r.sessionId);
 assert.equal(bridge.getCapabilities().canApply,false);
 bridge.close();
});
