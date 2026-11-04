// 05 QR PR465 new-only. Synthetic 01B source index; no genuine Save or Native V3 evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {inspectW1WetlandGridCandidates,W1_AREA_GRID_SOURCE_PROBE,W1_PROBE_BUILD}
 from '../src/lib/ddv/timing/w1-wetland-area-grid-candidate-probe.mjs';
const H='ab'.repeat(32),BAD='cd'.repeat(32);
const context=()=>({sourceSha256:H,sourceRevision:'epoch-7'});
const grid=(gridId,kind='GRIDS',area='v0:a1')=>({gridId,kind,areaRefs:[area],
 sourceGridDataPath:kind==='GRIDS'?'fixtures/'+gridId+'.json':null,parentAddress:null,
 effectiveObjects:kind==='GRIDS'?'SERIALIZED_ONLY':'DEFAULT_LAYOUT_UNRESOLVED'});
const obj=(gridId,itemId=31700014)=>({gridId,itemId,gridObjectId:42,serializedX:11});
const fixture=()=>({contract:'ddv.real-save-spatial-source-read@1',version:{...W1_PROBE_BUILD},
 ...context(),status:'READ_ONLY_REFERENCE_INDEX',
 grids:[grid(42),grid(43,'DIFF_ONLY','v2:a4')],
 objects:[obj(42),obj(42,31700015),obj(43),obj(42)],
 issues:[],geometryFor2d:'NOT_VERIFIED',nativePlacementVerified:false,
 persistentWriteAuthorized:false,productApplyAuthorized:false});
const inspect=(p=fixture(),ctx=context())=>inspectW1WetlandGridCandidates(p,ctx);
function off(out){
 for(const k of ['nativeAreaMappingVerified','originalSourceAuthenticated',
  'sourceSessionCasVerified','actualNativeQuotaVerified','nativeRuntimeVerified',
  'productWriterAuthorized','productEditedCopyAuthorized','automaticDateRepairAuthorized'])
  assert.equal(out[k],false,k);
}
function safe(out){
 assert.equal(out.contract,W1_AREA_GRID_SOURCE_PROBE);off(out);
 assert.equal(out.status,'SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED');
 assert.equal(out.selectedNativeWetlandArea,null);assert.equal(out.actualNativeQuota,null);
 assert.equal(out.sourceVillageAreaEnumWetland,1);
 for(const risk of ['WETLAND_ENUM_TO_SAVE_AREA_ID_UNPROVEN',
  'TREE_TAG_POSITION_AND_SOFTWOOD_QUOTA_UNPROVEN',
  'CLOCK_ACTUALIZE_EXECUTE_LAST_NEXT_COLD_LOAD_UNPROVEN'])
  assert.ok(out.riskCodes.includes(risk),risk);
 assert.equal(Object.isFrozen(out),true);
 assert.equal(Object.isFrozen(out.candidates),true);
 for(const row of out.candidates){
  assert.equal(row.nativeWetlandMembershipVerified,false);
  assert.equal(row.nativeSoftwoodQuotaVerified,false);
  assert.equal(row.sourceReferenceOnly,true);
  assert.equal(Object.isFrozen(row.referencedGridIds),true);
 }
}
test('01 fixed Build/epoch source candidate positive never equates enum1 with area1, never Native quota',()=>{
 const input=fixture(),before=JSON.stringify(input),out=inspect(input);
 safe(out);
 assert.deepEqual(out.candidates.map(c=>c.address),['v0:a1','v2:a4']);
 assert.deepEqual(out.candidates.map(c=>c.referencedGridIds),[[42],[43]]);
 assert.deepEqual(out.candidates.map(c=>c.serializedGridsOnlySoftwoodCount),[2,0]);
 assert.deepEqual(out.candidates[1].diffOnlyGridIds,[43]);
 assert.deepEqual(out.candidates[1].unverifiedLayoutGridIds,[43]);
 assert.ok(out.riskCodes.includes('DIFF_ONLY_DEFAULT_LAYOUT_UNVERIFIED'));
 assert.equal(out.sourceSha256,H);assert.equal(out.sourceRevision,'epoch-7');
 assert.equal(JSON.stringify(input),before,'no source mutation');
});
test('02 wrong version/schema/BID/source SHA/revision and caller fake Writer are rejected or made strictly nonauthoritative',()=>{
 const alters=[
  p=>{p.version.platform='Windows';},p=>{p.version.gameVersion='1.25.0';},
  p=>{p.version.bid='52BD625D9B4E0053';},p=>{p.version.schema=624;},
  p=>{p.sourceSha256=BAD;},p=>{p.sourceRevision='old';},
  p=>{p.contract='OTHER';}
 ];
 for(const alter of alters){const p=fixture();alter(p);const o=inspect(p);
  assert.equal(o.status,'SOURCE_REFERENCE_UNAVAILABLE');off(o);}
 for(const x of [{sourceSha256:BAD,sourceRevision:'epoch-7'},
  {sourceSha256:'a'.repeat(63),sourceRevision:'epoch-7'},
  {sourceSha256:H,sourceRevision:''},{sourceSha256:H,sourceRevision:7}]){
  const o=inspect(fixture(),x);assert.equal(o.status,'SOURCE_REFERENCE_UNAVAILABLE');off(o);
 }
 const forged=fixture();Object.assign(forged,{
  productWriterAuthorized:true,productEditedCopyAuthorized:true,
  nativeAreaMappingVerified:true,nativeRuntimeVerified:true,
  sourceSessionCasVerified:true,selectedNativeWetlandArea:'v0:a1',actualNativeQuota:999});
 const result=inspect(forged);safe(result);
 assert.equal(result.originalSourceAuthenticated,false,'matching caller SHA is not Core CAS');
});
test('03 duplicate grid/area and malformed source area IDs or missing object parent reject',()=>{
 const bad=[
  p=>{p.grids[0].areaRefs=['v0:a01'];},
  p=>{p.grids[0].areaRefs=['v01:a1'];},
  p=>{p.grids[0].areaRefs=['v0:a9007199254740992'];},
  p=>{p.grids[0].areaRefs=['v-1:a1'];},
  p=>{p.grids[0].areaRefs=['v0:a1','v0:a1'];},
  p=>{p.grids[1].gridId=42;},
  p=>{p.grids[1].kind='NATIVE_EFFECTIVE';},
  p=>{p.grids[0].gridId=-1;},
  p=>{p.objects[0].gridId=404;},
  p=>{p.objects[0].itemId=NaN;},
  p=>{p.objects[0].itemId=-1;}
 ];
 for(const [i,fn] of bad.entries()){
  const p=fixture();fn(p);const out=inspect(p);
  assert.equal(out.status,'SOURCE_REFERENCE_UNAVAILABLE','malformed case '+i);
  off(out);
 }
});
test('04 unresolved DiffOnly default and source issue never become effective Softwood or Quota',()=>{
 const p=fixture();p.status='REFERENCE_ERRORS_FAIL_CLOSED';
 p.issues=[{code:'SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED',gridId:43}];
 p.objects=[obj(43),obj(42)];
 const out=inspect(p);safe(out);
 assert.deepEqual(out.candidates.map(c=>c.serializedGridsOnlySoftwoodCount),[1,0]);
 for(const r of ['SOURCE_SPATIAL_INDEX_HAS_UNRESOLVED_REFERENCES',
  'SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED','DIFF_ONLY_DEFAULT_LAYOUT_UNVERIFIED'])
  assert.ok(out.riskCodes.includes(r));
});
test('05 multiple candidate owners, unresolved source GridData and SubGrid parent stay ambiguous',()=>{
 const p=fixture();p.grids[0].areaRefs=['v0:a1','v1:a2'];
 p.grids[0].sourceGridDataPath='';
 p.grids[0].parentAddress={gridId:42,gridObjectId:4,editorId:'g42:o4'};
 p.objects=[obj(42),obj(43)];
 const out=inspect(p);safe(out);
 assert.deepEqual(out.candidates.map(c=>c.address),['v0:a1','v1:a2','v2:a4']);
 assert.deepEqual(out.candidates.map(c=>c.serializedGridsOnlySoftwoodCount),[1,1,0]);
 for(const r of ['GRID_AREA_OWNERSHIP_AMBIGUOUS','DEFAULT_GRID_LAYOUT_SOURCE_SHA_UNKNOWN',
  'ROOT_SUBGRID_RELATION_REQUIRES_NATIVE_PROOF'])
  assert.ok(out.riskCodes.includes(r));
});
test('06 malformed source status/issue, bounded array and empty candidates never authorize Native',()=>{
 const altered=[
  p=>{p.status='AUTHORITATIVE_NATIVE';},
  p=>{p.grids={};},
  p=>{p.objects=null;},
  p=>{p.issues=[{code:'NATIVE_VERIFIED'}];},
  p=>{p.grids[0].areaRefs=['not-an-area'];},
  p=>{p.grids[0].areaRefs=Array(10001).fill('v0:a1');},
  p=>{p.grids=Array(100001).fill(null);},
  p=>{p.objects=Array(100001).fill(null);}
 ];
 for(const f of altered){const p=fixture();f(p);
  const out=inspect(p);assert.equal(out.status,'SOURCE_REFERENCE_UNAVAILABLE');off(out);}
 const empty=fixture();empty.grids=[];empty.objects=[];
 const out=inspect(empty);safe(out);
 assert.deepEqual(out.candidates,[]);
 assert.ok(out.riskCodes.includes('NO_SOURCE_AREA_GRID_CANDIDATES'));
});
