import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectW1WetlandGridCandidates, W1_AREA_GRID_SOURCE_PROBE, W1_PROBE_BUILD
} from '../src/lib/ddv/timing/w1-wetland-area-grid-candidate-probe.mjs';

const HASH='a'.repeat(64);
const context={sourceSha256:HASH,sourceRevision:'source-epoch-5'};
function fixture(){
  return {
    contract:'ddv.real-save-spatial-source-read@1',
    version:{...W1_PROBE_BUILD},
    ...context,status:'READ_ONLY_REFERENCE_INDEX',
    grids:[
      {gridId:100,kind:'GRIDS',areaRefs:['v0:a1'],
       sourceGridDataPath:'test/default-grid.json',parentAddress:null,
       effectiveObjects:'SERIALIZED_ONLY'},
      {gridId:101,kind:'GRIDS',areaRefs:['v2:a4'],
       sourceGridDataPath:'test/default-2.json',parentAddress:null,
       effectiveObjects:'SERIALIZED_ONLY'}
    ],
    objects:[
      {gridId:100,itemId:31700014}, {gridId:100,itemId:31700015},
      {gridId:101,itemId:31700014}
    ],
    issues:[],
    geometryFor2d:'NOT_VERIFIED',nativePlacementVerified:false,
    persistentWriteAuthorized:false,productApplyAuthorized:false
  };
}

test('source-only village/area grid candidate addresses never become Native area IDs',()=>{
  const x=inspectW1WetlandGridCandidates(fixture(),context);
  assert.equal(x.contract,W1_AREA_GRID_SOURCE_PROBE);
  assert.equal(x.status,'SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED');
  assert.deepEqual(x.candidates.map(c=>c.address),['v0:a1','v2:a4']);
  assert.deepEqual(x.candidates.map(c=>c.referencedGridIds),[[100],[101]]);
  assert.deepEqual(x.candidates.map(c=>c.serializedGridsOnlySoftwoodCount),[1,1]);
  assert.equal(x.sourceVillageAreaEnumWetland,1);
  assert.equal(x.selectedNativeWetlandArea,null);
  assert.ok(x.riskCodes.includes('WETLAND_ENUM_TO_SAVE_AREA_ID_UNPROVEN'));
  assert.equal(x.nativeAreaMappingVerified,false);
  assert.equal(x.actualNativeQuota,null);
  assert.equal(x.productWriterAuthorized,false);
  assert.equal(x.productEditedCopyAuthorized,false);
  assert.equal(x.automaticDateRepairAuthorized,false);
});

test('forged source SHA, revision, schema, BID and caller Writer flags fail closed',()=>{
  const forgery=[
    x=>{x.sourceSha256='b'.repeat(64);},
    x=>{x.sourceRevision='stale';},
    x=>{x.version.bid='52BD625D9B4E0053';},
    x=>{x.version.schema=624;},
    x=>{x.version.gameVersion='1.25.0';},
    x=>{x.contract='OTHER';}
  ];
  for(const mutate of forgery){
    const x=fixture();mutate(x);
    const out=inspectW1WetlandGridCandidates(x,context);
    assert.equal(out.status,'SOURCE_REFERENCE_UNAVAILABLE');
    assert.equal(out.productWriterAuthorized,false);
  }
  const x=fixture();
  x.nativeV3Accepted=true;x.productWriterAuthorized=true;
  assert.equal(inspectW1WetlandGridCandidates(x,context).productWriterAuthorized,false);
});

test('DiffGrid-only referenced area remains visible but cannot assert a default layout',()=>{
  const x=fixture();
  x.grids[0].kind='DIFF_ONLY';x.grids[0].sourceGridDataPath=null;
  x.grids[0].effectiveObjects='DEFAULT_LAYOUT_UNRESOLVED';
  x.status='REFERENCE_ERRORS_FAIL_CLOSED';
  x.issues=[{code:'SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED',gridId:100}];
  const out=inspectW1WetlandGridCandidates(x,context);
  assert.equal(out.status,'SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED');
  assert.deepEqual(out.candidates[0].diffOnlyGridIds,[100]);
  assert.deepEqual(out.candidates[0].unverifiedLayoutGridIds,[100]);
  assert.equal(out.candidates[0].serializedGridsOnlySoftwoodCount,0);
  assert.ok(out.riskCodes.includes('DIFF_ONLY_DEFAULT_LAYOUT_UNVERIFIED'));
  assert.ok(out.riskCodes.includes('SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED'));
  assert.equal(out.actualNativeQuota,null);
});

test('noncanonical area refs and repeated grid/area links are rejected',()=>{
  for(const ref of ['v0:a01','v-1:a1','v1:a-1','1','v01:a1','v1:a3:x',{}]){
    const x=fixture();x.grids[0].areaRefs=[ref];
    assert.equal(inspectW1WetlandGridCandidates(x,context).status,'SOURCE_REFERENCE_UNAVAILABLE');
  }
  const x=fixture();x.grids[0].areaRefs=['v0:a1','v0:a1'];
  assert.equal(inspectW1WetlandGridCandidates(x,context).reason,'DUPLICATE_GRID_AREA_REFERENCE');
});

test('duplicate/missing grid references, invalid object item and malformed issue deny',()=>{
  const ops=[
    x=>x.grids.push({...x.grids[0]}),
    x=>x.objects[0].gridId=999,
    x=>x.objects[0].itemId=-1,
    x=>x.issues.push({code:'NOT_SPATIAL'}),
    x=>x.grids[0].kind='NATIVE_EFFECTIVE',
    x=>x.grids[0].gridId=0.5
  ];
  for(const mutate of ops){
    const x=fixture();mutate(x);
    assert.equal(inspectW1WetlandGridCandidates(x,context).status,'SOURCE_REFERENCE_UNAVAILABLE');
  }
});

test('multiple owner refs and unresolved source GridData preserve ambiguity',()=>{
  const x=fixture();
  x.grids[0].areaRefs=['v0:a1','v1:a2'];
  x.grids[0].sourceGridDataPath='';
  const out=inspectW1WetlandGridCandidates(x,context);
  assert.ok(out.riskCodes.includes('GRID_AREA_OWNERSHIP_AMBIGUOUS'));
  assert.ok(out.riskCodes.includes('DEFAULT_GRID_LAYOUT_SOURCE_SHA_UNKNOWN'));
  assert.equal(out.candidates.length,3);
  assert.equal(out.nativeRuntimeVerified,false);
  assert.equal(out.productEditedCopyAuthorized,false);
});
