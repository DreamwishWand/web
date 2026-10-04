import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { BuildIdentityKind, PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';
import {
  NATIVE_PRESET_STATE_FLAG_DELETED,
  createNativePresetBackup,
  extractNativePresetSnapshots
} from '../src/lib/presets/native-preset-runtime.js';
import {
  NATIVE_PRESET_RESTORE_ALLOWED_PATH,
  NATIVE_PRESET_RESTORE_SWITCH_TARGET,
  classifyNativePresetRestoreV125,
  createNativePresetRestoreWriteCandidate,
  verifyNativePresetRestoreWriteCandidate
} from '../src/lib/presets/native-preset-persistent-restore-v125.js';

const encoder=new TextEncoder();
const decoder=new TextDecoder();

function preset(name,{flags=0,shareInfo=null,item=40000001,unknown=null,root=true,diffGrids={}}={}){
  const grids=root?{
    '0':{
      ID:0,GridDataPath:'',GridDefaultLayoutPath:'',TessellationFactor:2,
      Objects:{'0':{ID:0,ItemID:item,X:0,Y:0,Orientation:'GridOrientation_Up',State:null}},
      NextGridObjectID:1
    }
  }:{};
  return {
    GridCollection:{Grids:grids,DiffGrids:diffGrids,NextGridID:root?1:0},
    PresetName:name,
    ThumbnailItems:[item],
    ShareInfo:shareInfo,
    StateFlags:flags,
    ...(unknown?{FutureField:unknown}:{})
  };
}
function profile(presets=[preset('A'),preset('old',{flags:NATIVE_PRESET_STATE_FLAG_DELETED,item:40000002}),preset('B',{item:40000003})]){
  return {
    GameInfo:{InitialVersion:518,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
    Player:{Level:7,Name:'RestoreTest'},
    World:{DecorationPresets:presets,FutureWorldField:{keep:['opaque',1]}},
    Opaque:{keep:{sentinel:'unchanged'}}
  };
}
function makeCodec(){
  return {
    contract:'p1g-v0',
    async loadProfile(bytes){
      const packaged=bytes[0]===80&&bytes[1]===58;
      const jsonText=decoder.decode(packaged?bytes.slice(2):bytes);
      const root=JSON.parse(jsonText);
      return {inputType:packaged?'packaged':'plain',jsonText,metadata:{version:root.GameInfo.Version}};
    },
    parseProfileText(text){
      const root=JSON.parse(text);
      return {metadata:{version:root.GameInfo.Version}};
    },
    async createEncodedProfile(text){return encoder.encode(`P:${text}`);},
    getProfileVersion(metadata){return metadata.version;}
  };
}
async function sessionFor(root=profile()){
  return SafeProfileEditSession.open({
    sourceBytes:encoder.encode(`P:${JSON.stringify(root)}`),
    codec:makeCodec(),
    sourcePlatform:PlatformFamily.Switch
  });
}
function backupFrom(rawPreset,physicalPresetIndex=0){
  const rows=extractNativePresetSnapshots({World:{DecorationPresets:[rawPreset]}});
  const snapshot={...rows[0],physicalPresetIndex,activeSlotOrdinalZeroBased:0};
  return createNativePresetBackup(snapshot,{
    now:'2026-10-04T00:00:00.000Z',
    idFactory:()=> 'restore-fixture'
  });
}

test('append-only classifier uses native Deleted flag count and never reuses a tombstone slot',()=>{
  const root=profile();
  const backup=backupFrom(preset('Restored',{unknown:{nested:['preserve']}}),9);
  const result=classifyNativePresetRestoreV125({
    profile:root,backup,sourcePlatform:PlatformFamily.Switch,targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
  });
  assert.equal(result.status,'ADMISSIBLE');
  assert.equal(result.destination.physicalPresetCountBefore,3);
  assert.equal(result.destination.activePresetCountBefore,2);
  assert.equal(result.destination.physicalPresetIndex,3);
  assert.equal(result.destination.activeSlotOrdinalZeroBased,2);
  assert.equal(result.destination.tombstoneReuse,false);
  assert.equal(result.destination.replacement,false);
  assert.equal(result.payload.FutureField.nested[0],'preserve');
  assert.equal(result.persistentWriteAuthorized,false);
});

test('candidate and independent verifier append one exact native payload and preserve unrelated state',async()=>{
  const root=profile();
  const backup=backupFrom(preset('Restored',{unknown:{nested:[1,2,3]}}),12);
  const session=await sessionFor(root);
  const sourceBytes=session.source.slice();

  const candidate=await createNativePresetRestoreWriteCandidate({
    session,backup,targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET,candidateId:'native-restore-test'
  });
  assert.deepEqual(session.source,sourceBytes);
  assert.equal(candidate.manifest.destination.physicalPresetIndex,3);
  assert.equal(candidate.manifest.destination.activePresetCountBefore,2);
  assert.deepEqual(candidate.manifest.operation.allowedChanges,[NATIVE_PRESET_RESTORE_ALLOWED_PATH]);
  assert.equal(candidate.manifest.persistentWriteAuthorized,false);
  assert.equal(candidate.manifest.PERSISTENT_WRITE,false);
  assert.equal(candidate.manifest.productApplyAuthorized,false);
  assert.equal(candidate.manifest.directSourceReplacementAuthorized,false);

  const verification=await verifyNativePresetRestoreWriteCandidate({
    candidate,codec:makeCodec(),targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
  });
  assert.equal(verification.status,'PASS');
  assert.deepEqual(verification.semanticDiff.changedPaths,[NATIVE_PRESET_RESTORE_ALLOWED_PATH]);
  assert.equal(verification.semanticDiff.preExistingPhysicalEntriesUnchanged,true);
  assert.equal(verification.semanticDiff.appendedPhysicalPresetIndex,3);
  assert.equal(verification.semanticDiff.activePresetCountBefore,2);
  assert.equal(verification.semanticDiff.activePresetCountAfter,3);
  assert.equal(verification.semanticDiff.unrelatedStatePreserved,true);

  const after=JSON.parse(decoder.decode(candidate.candidateBytes.slice(2)));
  assert.deepEqual(after.World.DecorationPresets.slice(0,3),root.World.DecorationPresets);
  assert.deepEqual(after.World.DecorationPresets[3],backup.payload);
  assert.deepEqual(after.Opaque,root.Opaque);
  assert.deepEqual(after.World.FutureWorldField,root.World.FutureWorldField);
});

test('physical list may exceed native active limit denominator when tombstones exist; append uses physical tail',()=>{
  const presets=[];
  for(let i=0;i<19;i++)presets.push(preset(`deleted-${i}`,{flags:NATIVE_PRESET_STATE_FLAG_DELETED,item:40000100+i}));
  presets.push(preset('active-a',{item:40000200}),preset('active-b',{item:40000201}));
  const result=classifyNativePresetRestoreV125({
    profile:profile(presets),
    backup:backupFrom(preset('restore')),
    sourcePlatform:PlatformFamily.Switch,
    targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
  });
  assert.equal(result.status,'ADMISSIBLE');
  assert.equal(result.destination.physicalPresetCountBefore,21);
  assert.equal(result.destination.activePresetCountBefore,2);
  assert.equal(result.destination.physicalPresetIndex,21);
});

test('active count 20 fails closed even when physical storage includes tombstones',()=>{
  const presets=[preset('deleted',{flags:NATIVE_PRESET_STATE_FLAG_DELETED})];
  for(let i=0;i<20;i++)presets.push(preset(`active-${i}`,{item:40001000+i}));
  const result=classifyNativePresetRestoreV125({
    profile:profile(presets),
    backup:backupFrom(preset('restore')),
    sourcePlatform:PlatformFamily.Switch,
    targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
  });
  assert.equal(result.status,'REJECTED');
  assert.ok(result.reasonCodes.includes('NATIVE_ACTIVE_LIMIT_REACHED'));
});

test('restore v1 rejects Deleted, shared/imported/modified metadata and non-null ShareInfo',()=>{
  const cases=[
    [preset('deleted',{flags:NATIVE_PRESET_STATE_FLAG_DELETED}),'BACKUP_DELETED_TOMBSTONE_UNSUPPORTED'],
    [preset('shared',{flags:1}),'BACKUP_STATE_FLAGS_ZERO_REQUIRED'],
    [preset('imported',{flags:2}),'BACKUP_STATE_FLAGS_ZERO_REQUIRED'],
    [preset('modified',{flags:4}),'BACKUP_STATE_FLAGS_ZERO_REQUIRED'],
    [preset('shareinfo',{shareInfo:{ShareCode:'ABCDEFGH'}}),'BACKUP_SHARE_INFO_NULL_REQUIRED']
  ];
  for(const [payload,code] of cases){
    const backup=backupFrom(payload);
    const result=classifyNativePresetRestoreV125({
      profile:profile(),backup,sourcePlatform:PlatformFamily.Switch,targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
    });
    assert.equal(result.status,'REJECTED',code);
    assert.ok(result.reasonCodes.includes(code),`${code}: ${result.reasonCodes.join(',')}`);
  }
});

test('restore v1 rejects malformed native structure and non-empty DiffGrids',()=>{
  const missingRoot=backupFrom(preset('missing-root',{root:false}));
  const nonEmptyDiff=backupFrom(preset('diff',{diffGrids:{'0':{ID:0}}}));
  const a=classifyNativePresetRestoreV125({
    profile:profile(),backup:missingRoot,sourcePlatform:PlatformFamily.Switch,targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
  });
  const b=classifyNativePresetRestoreV125({
    profile:profile(),backup:nonEmptyDiff,sourcePlatform:PlatformFamily.Switch,targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
  });
  assert.equal(a.status,'REJECTED');
  assert.ok(a.reasonCodes.includes('BACKUP_SHAPE_ROOT_GRID_0_MISSING'));
  assert.equal(b.status,'REJECTED');
  assert.ok(b.reasonCodes.includes('BACKUP_DIFF_GRIDS_EMPTY_REQUIRED'));
});

test('restore contract is Switch v1.25 only and fails closed on Steam or wrong BID/schema',()=>{
  const backup=backupFrom(preset('restore'));
  const steam=classifyNativePresetRestoreV125({
    profile:profile(),backup,sourcePlatform:PlatformFamily.SteamWindows,
    targetBuild:{platform:PlatformFamily.SteamWindows,kind:BuildIdentityKind.SteamFullVersion,value:'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14'}
  });
  assert.ok(steam.reasonCodes.includes('EXACT_SWITCH_V125_BUILD_REQUIRED'));

  const wrongBid=classifyNativePresetRestoreV125({
    profile:profile(),backup,sourcePlatform:PlatformFamily.Switch,
    targetBuild:{...NATIVE_PRESET_RESTORE_SWITCH_TARGET,value:'WRONG'}
  });
  assert.ok(wrongBid.reasonCodes.includes('EXACT_SWITCH_V125_BUILD_REQUIRED'));

  const wrongSchema=profile();
  wrongSchema.GameInfo.Version=625;
  const schema=classifyNativePresetRestoreV125({
    profile:wrongSchema,backup,sourcePlatform:PlatformFamily.Switch,targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
  });
  assert.ok(schema.reasonCodes.includes('PROFILE_SCHEMA_624_REQUIRED'));
});

test('independent verifier detects candidate byte tampering',async()=>{
  const candidate=await createNativePresetRestoreWriteCandidate({
    session:await sessionFor(),
    backup:backupFrom(preset('restore')),
    targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET
  });
  candidate.candidateBytes[5]^=1;
  await assert.rejects(
    ()=>verifyNativePresetRestoreWriteCandidate({candidate,codec:makeCodec(),targetBuild:NATIVE_PRESET_RESTORE_SWITCH_TARGET}),
    /CANDIDATE_HASH_MISMATCH/
  );
});
