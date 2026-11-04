import test from 'node:test';
import assert from 'node:assert/strict';
import {openWorldSaveBytes,WEP_WORLD_READONLY_626_PROVENANCE} from '../src/lib/wep/world-save-source.ts';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

// Synthetic packaged profile ONLY. No genuine Save or native 626 semantics.
const binding={
  sourcePlatform:'switch',
  targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'},
  sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE
};
const source=()=>({
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
  Player:{},World:{
    Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true},'8':{GridIDs:[],Unlocked:false}}},
              {Areas:{'9':{GridIDs:[],Unlocked:true}}}],
    GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{}}}}},DiffGrids:{}}
  }
});
async function inspect(profile){
  const p1g=makeSyntheticP1gProfile(profile);
  const before=p1g.slice();
  const opened=await openWorldSaveBytes(p1g,binding);
  assert.deepEqual(p1g,before,'synthetic source bytes untouched');
  assert.equal(opened.profileSchemaVersion,626);
  assert.equal(opened.compatibility.readOnly,true);
  assert.equal(opened.compatibility.editingAuthorized,false);
  assert.equal(opened.compatibility.persistentWriteAuthorized,false);
  assert.equal(opened.compatibility.productApplyAuthorized,false);
  return opened.structuralDiagnostics;
}
test('serialized area count across valid Villages is structural, not Native area route',async()=>{
  const diag=await inspect(source());
  assert.equal(diag.villageCount,2);
  assert.equal(diag.areaRecordCount,3);
  assert.equal(diag.gridRecordCount,1);
  assert.equal(diag.gridObjectEntryCount,1);
});
test('empty but present Areas maps are genuine zero',async()=>{
  const p=source();
  p.World.Villages=[{Areas:{}},{Areas:{}}];
  const diag=await inspect(p);
  assert.equal(diag.villageCount,2);
  assert.equal(diag.areaRecordCount,0);
  assert.equal(diag.gridObjectEntryCount,1);
});
test('missing Areas in any Village forces UNKNOWN for total, not misleading partial or 0',async()=>{
  const p=source();
  delete p.World.Villages[1].Areas;
  const diag=await inspect(p);
  assert.equal(diag.villageCount,2);
  assert.equal(diag.areaRecordCount,null);
  assert.equal(diag.gridObjectEntryCount,1);
});
test('nonobject Areas or malformed Village forces UNKNOWN, not a Native zero',async()=>{
  for(const bad of [null,[],42,'untrusted']){
    const p=source();
    p.World.Villages[1].Areas=bad;
    const diag=await inspect(p);
    assert.equal(diag.areaRecordCount,null,JSON.stringify(bad));
  }
  const p=source();p.World.Villages[1]=null;
  assert.equal((await inspect(p)).areaRecordCount,null);
});
test('absent/non-array Villages remains UNKNOWN instead of inventing no areas',async()=>{
  for(const bad of [undefined,null,{},'none']){
    const p=source();
    if(bad===undefined) delete p.World.Villages;
    else p.World.Villages=bad;
    const diag=await inspect(p);
    assert.equal(diag.areaRecordCount,null);
    assert.equal(diag.villageCount,null);
  }
});
test('unknown Area count must never unlock Source Editor or 626 geometry/writer',async()=>{
  const p=source();p.World.Villages=[{Areas:null}];
  const opened=await openWorldSaveBytes(makeSyntheticP1gProfile(p),binding);
  assert.equal(opened.structuralDiagnostics.areaRecordCount,null);
  assert.deepEqual(opened.areas,[]);
  assert.equal(opened.compatibility.routesAuthorized,false);
  assert.equal(opened.compatibility.persistentWriteAuthorized,false);
  assert.equal(opened.compatibility.verifiedReplacementCandidateAuthorized,false);
});
