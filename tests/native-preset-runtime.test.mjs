import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NATIVE_PRESET_ACTIVE_LIMIT,
  NATIVE_PRESET_BACKUP_SCHEMA,
  addNativePresetBackup,
  createEmptyNativePresetLibrary,
  createNativePresetBackup,
  extractNativePresetSnapshots,
  nativePresetRestoreReadiness,
  parseNativePresetLibrary,
  serializeNativePresetLibrary
} from '../src/lib/presets/native-preset-runtime.js';

function preset(name,{deleted=false,unknown=null,root=true}={}){
  const grids=root?{'0':{ID:0,GridDataPath:'',GridDefaultLayoutPath:'',TessellationFactor:2,Objects:{'0':{ID:0,ItemID:40000001,X:0,Y:0,Orientation:'GridOrientation_Up',State:null}},NextGridObjectID:1}}:{};
  return {GridCollection:{Grids:grids,DiffGrids:{},NextGridID:root?1:0},PresetName:name,ThumbnailItems:[40000001],ShareInfo:null,StateFlags:0,...(deleted?{Deleted:true}:{}),...(unknown?{FutureField:unknown}:{})};
}

test('native preset extraction separates physical index from active ordinal and keeps tombstones',()=>{
  const profile={World:{DecorationPresets:[preset('A'),preset('old',{deleted:true}),preset('B')]}};
  const rows=extractNativePresetSnapshots(profile);
  assert.deepEqual(rows.map(x=>[x.physicalPresetIndex,x.activeSlotOrdinalZeroBased,x.deleted]),[[0,0,false],[1,null,true],[2,1,false]]);
  assert.equal(NATIVE_PRESET_ACTIVE_LIMIT,20);
});

test('native preset backup preserves unknown native payload fields losslessly',()=>{
  const profile={World:{DecorationPresets:[preset('Future',{unknown:{nested:[1,2,3]}})]}};
  const snapshot=extractNativePresetSnapshots(profile)[0];
  const backup=createNativePresetBackup(snapshot,{now:'2026-10-04T00:00:00Z',idFactory:()=> 'fixed'});
  assert.equal(backup.schema,NATIVE_PRESET_BACKUP_SCHEMA);
  assert.deepEqual(backup.payload.FutureField,{nested:[1,2,3]});
  assert.equal(backup.persistentWriteAuthorized,false);
  assert.deepEqual(backup.payload,profile.World.DecorationPresets[0]);
});

test('capture is preservation-first: malformed allocation produces warnings but backup remains possible',()=>{
  const broken=preset('broken');
  broken.GridCollection.Grids['0'].NextGridObjectID=0;
  const snapshot=extractNativePresetSnapshots({World:{DecorationPresets:[broken]}})[0];
  assert.ok(snapshot.warnings.includes('NEXT_GRID_OBJECT_ID_NOT_ABOVE_OBSERVED'));
  const readiness=nativePresetRestoreReadiness(snapshot);
  assert.equal(readiness.canPreserveBackup,true);
  assert.equal(readiness.restoreShapeClean,false);
  assert.equal(readiness.persistentWriteAuthorized,false);
});

test('local native preset library can hold more backups than the native 20-slot active limit',()=>{
  let library=createEmptyNativePresetLibrary();
  const snapshot=extractNativePresetSnapshots({World:{DecorationPresets:[preset('A')]}})[0];
  for(let i=0;i<25;i++){
    const backup=createNativePresetBackup(snapshot,{now:`2026-10-04T00:00:${String(i).padStart(2,'0')}Z`,idFactory:()=>String(i)});
    library=addNativePresetBackup(library,backup,{now:'2026-10-04T01:00:00Z'});
  }
  assert.equal(library.backups.length,25);
  const roundtrip=parseNativePresetLibrary(serializeNativePresetLibrary(library));
  assert.equal(roundtrip.backups.length,25);
  assert.equal(roundtrip.backups.every(x=>x.persistentWriteAuthorized===false),true);
});
