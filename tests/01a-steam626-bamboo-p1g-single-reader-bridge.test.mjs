import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile,syntheticProfile} from './helpers/p1g-fixture.mjs';
import {createP1gRustWorkerReadOnlyBridge} from '../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';

const BUILD=Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true});
const TARGET=Object.freeze({gridId:7,x:294,y:0});
const SHA='b'.repeat(64);
let id=0,instances=0;
const fixture=()=>makeSyntheticP1gProfile(syntheticProfile('DeviceType_Windows'));
class MockRust {
 constructor(platform,kind,build,schema,confirmed,entropy){
  assert.equal(platform,BUILD.platform);
  assert.equal(kind,BUILD.buildKind);
  assert.equal(build,BUILD.buildId);
  assert.equal(schema,626);assert.equal(confirmed,true);
  assert.ok(entropy instanceof Uint8Array&&entropy.some(v=>v!==0));
  instances++;this.id=(++id).toString(16).padStart(32,'0');
  this.closed=false;this.buffers=[];this.bambooCalls=0;
 }
 append_chunk(c){this.buffers.push(Buffer.from(c))}
 finish(){
  if(this.closed)throw Error('CLOSED');
  const bytes=Buffer.concat(this.buffers);
  const source=JSON.parse(bytes.toString('utf8'));
  assert.equal(source.GameInfo.Version,626);
  this.sha=createHash('sha256').update(bytes).digest('hex');
  return JSON.stringify({
   contract:'wand.product.single-save-session.boundary@1',
   sessionId:this.id,decodedSha256:this.sha,revision:0,indexGeneration:1,
   schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,
   allDomainReferencesVerified:false,productReadAccepted:false,
   writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false
  });
 }
 read_steam626_bamboo_single_target(grid,x,y,session,revision,generation,sha){
  this.bambooCalls++;
  if(this.closed||grid!==TARGET.gridId||x!==TARGET.x||y!==TARGET.y||
     session!==this.id||revision!==0n||generation!==1n||sha!==this.sha)
    throw Error('RUST_CAS_DENIED');
  return JSON.stringify(this.bambooResponse(grid,x,y));
 }
 bambooResponse(grid,x,y){
  return {
   contract:'wand.worker.steam626.bamboo.readonly-target@1',
   sessionId:this.id,revision:0,indexGeneration:1,decodedSha256:this.sha,
   platform:'SteamWindows',schema:626,itemId:40700007,gridId:grid,x,y,
   nextGridObjectId:15949,oldStock:9140,
   rootSha256:SHA,gridSha256:SHA,counterSha256:SHA,
   stockSha256:SHA,housesSha256:SHA,referencePairs:1749,
   stockDelta:0,readOnly:true,productReadAccepted:false,
   writerAuthorized:false,stageAuthorized:false,
   editedCopyAuthorized:false,operationOn:false
  };
 }
 close(){this.closed=true;this.buffers=[]}
}
const make=(R=MockRust,opt={allowSteam626BambooReadOnlySource:true})=>
  createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource:R}),opt);
const open=async (bridge,build=BUILD,encryptedBytes=fixture())=>
  bridge.openEncrypted({build,encryptedBytes});

test('B01 opt-in exact P1G→one Rust ProductSession, sanitized receipt, no Writer',async()=>{
 const before=instances,bridge=make(),bytes=fixture(),original=bytes.slice();
 const r=await open(bridge,BUILD,bytes);
 assert.equal(instances,before+1,'only one Rust WASM/session');
 const result=bridge.readSteam626BambooSingleTarget(TARGET);
 assert.deepEqual(Object.keys(result).sort(),[
  'itemId','gridId','x','y','oldStock','nextGridObjectId','readOnly',
  'productReadAccepted','writerAuthorized','stageAuthorized',
  'editedCopyAuthorized','operationOn'
 ].sort());
 assert.equal(result.itemId,40700007);assert.equal(result.oldStock,9140);
 assert.equal(result.nextGridObjectId,15949);
 assert.ok(Object.isFrozen(result));assert.equal(result.operationOn,false);
 assert.equal(r.writerAuthorized,false);
 assert.equal(bridge.getCapabilities().canExportEditedCopy,false);
 assert.equal(bridge.getCapabilities().canReadTypedMetadataInProduct,false);
 assert.equal('exportScopedEditedCopy' in bridge,false);
 assert.equal('stageScoped' in bridge,false);
 assert.equal('decodedSha256' in result,false);
 assert.equal('sessionId' in result,false);
 assert.equal('referencePairs' in result,false);
 assert.deepEqual(bytes,original,'caller original P1G remains byte-identical');
 assert.throws(()=>bridge.readSteam626BambooSingleTarget(TARGET),/BAMBOO_READ_OFF/);
 assert.equal(bridge.close().closed,true);
 assert.equal(bridge.getReceipt(),null);
});

test('B02 no implicit Bamboo route, strict mode exclusivity and Steam Build gate',async()=>{
 const defaultBridge=make(MockRust,{});
 await open(defaultBridge);assert.equal(defaultBridge.readSteam626BambooSingleTarget,undefined);
 defaultBridge.close();
 assert.throws(()=>make(MockRust,{allowSteam626BambooReadOnlySource:true,
   allowSteam626Catalog0Source:true}),/PRODUCT_WORKER_SCOPED_SOURCE_CONFLICT/);
 const b=make();
 for(const build of [
   {...BUILD,platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D'},
   {...BUILD,schema:624},
   {...BUILD,externallyConfirmed:false},
   {...BUILD,buildId:'another-steam-build'}
 ]) {
   await assert.rejects(open(b,build),/PRODUCT_WORKER_(BAMBOO_STEAM_ONLY|BUILD_NOT_VERIFIED)/);
   assert.equal(b.getReceipt(),null);
 }
 assert.equal(b.close().closed,true);
});

test('B03 forged selectors, extra fields and wrong coordinates denied without second Rust',async()=>{
 const bridge=make();await open(bridge);
 for(const selector of [null,{},[7,294,0],{...TARGET,itemId:40700007},
   {gridId:7,x:294,y:0.5},{gridId:7,x:-1,y:0},
   {gridId:2**32,x:294,y:0},{...TARGET,x:NaN}])
   assert.throws(()=>bridge.readSteam626BambooSingleTarget(selector),
     /PRODUCT_WORKER_BAMBOO_SELECTOR_DENIED/);
 assert.throws(()=>bridge.readSteam626BambooSingleTarget({...TARGET,x:1}),
   /PRODUCT_WORKER_BAMBOO_READ_DENIED/);
 assert.equal(bridge.getReceipt(),null,'native CAS rejection revokes session');
});

test('B04 every forged Rust typed receipt fails closed without leaking metadata',async()=>{
 const mutations=[
   r=>({...r,sessionId:'a'.repeat(32)}),
   r=>({...r,revision:1}),
   r=>({...r,indexGeneration:2}),
   r=>({...r,decodedSha256:'a'.repeat(64)}),
   r=>({...r,platform:'Switch'}),
   r=>({...r,itemId:40700246}),
   r=>({...r,gridId:2}),
   r=>({...r,nextGridObjectId:-1}),
   r=>({...r,oldStock:2**40}),
   r=>({...r,stockSha256:'secret'}),
   r=>({...r,referencePairs:1000001}),
   r=>({...r,stockDelta:-1}),
   r=>({...r,writerAuthorized:true}),
   r=>({...r,stageAuthorized:true}),
   r=>({...r,editedCopyAuthorized:true}),
   r=>({...r,operationOn:true}),
   r=>({...r,productReadAccepted:true}),
   r=>({...r,readOnly:false}),
   r=>({...r,rawJson:{Player:{secret:'LEAK'}}}),
 ];
 for(const mutate of mutations){
   class Forged extends MockRust{
     bambooResponse(...args){return mutate(super.bambooResponse(...args))}
   }
   const b=make(Forged);await open(b);
   assert.throws(()=>b.readSteam626BambooSingleTarget(TARGET),/PRODUCT_WORKER_BAMBOO_READ_DENIED/);
   assert.equal(b.getReceipt(),null);
 }
});

test('B05 duplicate JSON and missing native per-op ABI refused, stale Close/Open invalidates prior',async()=>{
 class Duplicate extends MockRust {
  read_steam626_bamboo_single_target(...args){
   const response=super.read_steam626_bamboo_single_target(...args);
   return response.slice(0,-1)+',"writerAuthorized":false}';
  }
 }
 class Missing extends MockRust{}
 Missing.prototype.read_steam626_bamboo_single_target=undefined;
 for(const Type of [Duplicate,Missing]){
   const b=make(Type);await open(b);
   assert.throws(()=>b.readSteam626BambooSingleTarget(TARGET),/PRODUCT_WORKER_BAMBOO_READ_DENIED/);
   assert.equal(b.getReceipt(),null);
 }
 const b=make(),initial=await open(b);
 assert.equal(b.close().closed,true);
 assert.throws(()=>b.readSteam626BambooSingleTarget(TARGET),/BAMBOO_READ_OFF/);
 const reopened=await open(b);
 assert.notEqual(reopened.sessionId,initial.sessionId);
 const target=b.readSteam626BambooSingleTarget(TARGET);
 assert.equal(target.gridId,TARGET.gridId);
 assert.throws(()=>b.readSteam626BambooSingleTarget(TARGET),/BAMBOO_READ_OFF/);
 b.close();
});
