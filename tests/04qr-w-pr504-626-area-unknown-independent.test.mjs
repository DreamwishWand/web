/** Independent 04QR-W PR504 exact new-only schema626 Area UNKNOWN tests.
 * No real Save bytes or private credentials. PR499/QA502 accepted parent reused.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openWorldSaveBytes,WEP_WORLD_READONLY_626_PROVENANCE} from '../src/lib/wep/world-save-source.ts';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
const BASE='1110f5359f4bcd9b1e27cc78c41c4de688920c6f';
const SOURCE='5364dbee8945d1725b621f8ec0852c554486bfe5';
const gi={Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}};
const binding={sourcePlatform:'switch',targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'},sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE};
const one=()=>({GameInfo:{...gi},Player:{},World:{Villages:[
 {Areas:{'7':{GridIDs:[10],Unlocked:true}}},
 {Areas:{'8':{GridIDs:[],Unlocked:false},'9':{GridIDs:[],Unlocked:true}}}
],GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{}}}}},DiffGrids:{}}}});
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const count=async obj=>{
  const bytes=makeSyntheticP1gProfile(obj),sha=createHash('sha256').update(bytes).digest('hex'),original=bytes.slice();
  const data=await openWorldSaveBytes(bytes,binding);
  assert.deepEqual(bytes,original);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
  assert.equal(data.profileSchemaVersion,626);
  assert.equal(data.compatibility.readOnly,true);
  assert.equal(data.compatibility.routesAuthorized,false);
  assert.equal(data.compatibility.persistentWriteAuthorized,false);
  assert.equal(data.compatibility.productApplyAuthorized,false);
  assert.equal(data.compatibility.verifiedReplacementCandidateAuthorized,false);
  return data.structuralDiagnostics;
};
test('fixed ancestor and exact two source paths; all PR499 World/Spatial parents unchanged',()=>{
  assert.equal(git('merge-base',BASE,SOURCE),BASE);
  assert.deepEqual(git('diff','--name-only',BASE,SOURCE).split('\n').sort(),
    ['src/lib/wep/world-save-source.ts','tests/wep-schema626-area-record-unknown.test.mjs']);
  assert.equal(git('hash-object','src/lib/wep/world-save-source.ts'),'2287fc98306bffe8c28f52ac48509ea2e63f54ac');
  assert.equal(git('hash-object','tests/wep-schema626-area-record-unknown.test.mjs'),'791f8216c0e98876a1b48b81e0c2506c3bd7219c');
  assert.equal(git('hash-object','src/routes/editor/world/+page.svelte'),'5ae7f7640a99b05083b20b784fb0cbf3693fee84');
  assert.equal(git('hash-object','src/lib/wep/real-save-spatial-read.ts'),'48b32c3bd3132c6e48a47d7b8f017a35642d2623');
});
test('QA-only exact three new paths without changing source, native 626 geometry or flags',()=>{
  assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),[
    '.github/workflows/04qr-w-pr504-626-village-area-unknown.yml',
    'scripts/04qr-w-pr504-626-area-unknown-chromium.mjs',
    'tests/04qr-w-pr504-626-area-unknown-independent.test.mjs'
  ]);
});
test('newly authored cross-village source combinations: null if ANY area is missing or malformed',async()=>{
  for(const mutated of [
    p=>{p.World.Villages[0].Areas=null;},
    p=>{p.World.Villages[1].Areas=undefined;},
    p=>{p.World.Villages[0].Areas={};p.World.Villages[1].Areas=[];},
    p=>{p.World.Villages[0].Areas={};p.World.Villages[1].Areas='0';},
    p=>{p.World.Villages[0].Areas={'7':{}};p.World.Villages[1]=null;},
    p=>{p.World.Villages[0]={};p.World.Villages[1].Areas={};}
  ]){
    const p=one();mutated(p);const d=await count(p);
    assert.equal(d.areaRecordCount,null,'one malformed village must poison aggregate');
    assert.equal(d.gridObjectEntryCount,1,'unrelated accepted raw GridObject count preserved');
  }
});
test('strict distinction: present legitimate zero, empty Villages, nonempty 3, absent Villages UNKNOWN',async()=>{
  const p=one();assert.equal((await count(p)).areaRecordCount,3);
  p.World.Villages=[{Areas:{}},{Areas:{}}];
  assert.equal((await count(p)).areaRecordCount,0);
  p.World.Villages=[];
  const zero=await count(p);
  assert.equal(zero.areaRecordCount,0);
  assert.equal(zero.villageCount,0);
  delete p.World.Villages;
  const unknown=await count(p);
  assert.equal(unknown.areaRecordCount,null);
  assert.equal(unknown.villageCount,null);
});
test('mismatched platform/BID fails before rendering or elevated 626 capabilities',async()=>{
 const p=one(),bytes=makeSyntheticP1gProfile(p);
 await assert.rejects(()=>openWorldSaveBytes(bytes,{...binding,targetBuild:{...binding.targetBuild,value:'0000000000000000'}}),/UNSUPPORTED_BUILD/);
 await assert.rejects(()=>openWorldSaveBytes(bytes,{...binding,sourcePlatform:'unknown'}),/EXTERNAL_SOURCE_VERIFICATION_REQUIRED/);
 assert.match(readFileSync('src/lib/wep/world-save-source.ts','utf8'),/areaRecordCount = null/);
 assert.match(readFileSync('src/routes/editor/world/+page.svelte','utf8'),/structuralDiagnostics\?\.areaRecordCount \?\? '—'/);
});
