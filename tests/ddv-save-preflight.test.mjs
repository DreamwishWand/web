import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { evaluateSavePreflight, createRuntimeAssertionManifest, SAVE_PREFLIGHT_CONTRACT, RUNTIME_ASSERTION_CONTRACT } from '../src/lib/ddv/core/save/save-preflight.js';
import { BuildIdentityKind, PlatformFamily, RuntimeGateStatus } from '../src/lib/ddv/core/save/versioning.js';
import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';

const switchTarget={platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'52BD625D9B4E0053'};
const steamTarget={platform:PlatformFamily.SteamWindows,kind:BuildIdentityKind.SteamFullVersion,value:'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14'};
function op(id='world.object.move',owner='01B',runtimeGate=RuntimeGateStatus.Pending){return {id,owner,structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true,runtimeGate};}

test('preflight exposes stable build/capability boundary without raw bytes',async()=>{
 const source=makeSyntheticP1gProfile(syntheticProfile());
 const session=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform:PlatformFamily.Switch});
 const pre=evaluateSavePreflight({session,targetBuild:switchTarget,operation:op()});
 assert.equal(pre.contract,SAVE_PREFLIGHT_CONTRACT); assert.equal(pre.capabilities.encodeCopy,true); assert.equal(pre.capabilities.persistentReplace,false);
 assert.equal(pre.build.contract.id,'ddv-switch-v1.25.0-52BD625D9B4E0053-v624');
 assert.equal('source' in pre,false); assert.equal(pre.saveIdentity.profileGameInfoVersion,624);
});

test('preflight rejects malformed platform/build-kind pairs before emitting a schema-shaped report',async()=>{
 const session=await SafeProfileEditSession.open({sourceBytes:makeSyntheticP1gProfile(syntheticProfile()),codec:p1gPackagedProfileCodec});
 assert.throws(()=>evaluateSavePreflight({session,targetBuild:{platform:'bogus',kind:'bogus',value:'X'},operation:op()}),/INVALID_TARGET_BUILD/);
 assert.throws(()=>evaluateSavePreflight({session,targetBuild:{platform:PlatformFamily.Switch,kind:BuildIdentityKind.SteamFullVersion,value:'X'},operation:op()}),/INVALID_TARGET_BUILD/);
});

test('unknown target build fails preflight plan/encode without weakening read capability',async()=>{
 const session=await SafeProfileEditSession.open({sourceBytes:makeSyntheticP1gProfile(syntheticProfile()),codec:p1gPackagedProfileCodec});
 const pre=evaluateSavePreflight({session,targetBuild:{...switchTarget,value:'UNKNOWN'},operation:op()});
 assert.equal(pre.capabilities.readProfile,true); assert.equal(pre.capabilities.planOperation,false); assert.equal(pre.capabilities.encodeCopy,false);
});

test('runtime assertion binds source, target, codec, operation and exact changed paths',async()=>{
 const source=makeSyntheticP1gProfile(syntheticProfile());
 const session=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform:PlatformFamily.Switch});
 const operation=op('world.object.move','01B',RuntimeGateStatus.Pending);
 const pre=evaluateSavePreflight({session,targetBuild:switchTarget,operation});
 const result=await session.exportVerifiedCopy({edit(root){root.World.__wandPreflightSentinel={x:1};},exactAllowedPaths:['/World/__wandPreflightSentinel'],targetBuild:switchTarget,operation});
 const m=createRuntimeAssertionManifest({preflight:pre,exportResult:result});
 assert.equal(m.contract,RUNTIME_ASSERTION_CONTRACT); assert.equal(m.source.rawSha256,result.sourceRawSha256); assert.equal(m.output.rawSha256,result.editedRawSha256);
 assert.deepEqual(m.output.changedPaths,['/World/__wandPreflightSentinel']); assert.equal(m.exactBuildContractId,pre.build.contract.id); assert.equal(m.persistentWriteAuthorized,false);
});

for(const c of [
 {label:'Switch',env:'DDV_V125_SWITCH_PROFILE_RAW',platform:PlatformFamily.Switch,target:switchTarget},
 {label:'Steam',env:'DDV_V125_STEAM_PROFILE_RAW',platform:PlatformFamily.SteamWindows,target:steamTarget}
]){
 const p=process.env[c.env]; const maybe=p?test:test.skip;
 maybe(`${c.label} current raw fixture produces a runtime assertion manifest bound to current exact build`,async()=>{
  const source=new Uint8Array(await readFile(p)); const session=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform:c.platform});
  const operation=op('save.reference.sentinel','01A',RuntimeGateStatus.NotRequired);
  const pre=evaluateSavePreflight({session,targetBuild:c.target,operation});
  const result=await session.exportVerifiedCopy({edit(root){root.World.__wandRuntimeManifestSentinel={value:1};},exactAllowedPaths:['/World/__wandRuntimeManifestSentinel'],targetBuild:c.target,operation});
  const m=createRuntimeAssertionManifest({preflight:pre,exportResult:result});
  assert.equal(m.source.profileGameInfoVersion,624); assert.equal(m.targetBuild.value,c.target.value); assert.equal(m.capabilitiesAtExport.encodeCopy,true); assert.equal(m.capabilitiesAtExport.persistentReplace,false);
 });
}

test('runtime assertion rejects a preflight/export target-build mismatch',async()=>{
 const source=makeSyntheticP1gProfile(syntheticProfile());
 const session=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform:PlatformFamily.Switch});
 const operation=op('save.reference.target-binding','01A',RuntimeGateStatus.NotRequired);
 const switchPre=evaluateSavePreflight({session,targetBuild:switchTarget,operation});
 const steamResult=await session.exportVerifiedCopy({edit(root){root.World.__wandTargetBinding={value:1};},exactAllowedPaths:['/World/__wandTargetBinding'],targetBuild:steamTarget,operation});
 assert.throws(()=>createRuntimeAssertionManifest({preflight:switchPre,exportResult:steamResult}),/PREFLIGHT_EXPORT_TARGET_BUILD_MISMATCH/);
});

test('runtime assertion rejects a preflight/export operation mismatch',async()=>{
 const source=makeSyntheticP1gProfile(syntheticProfile());
 const session=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform:PlatformFamily.Switch});
 const exportedOperation=op('save.reference.operation-a','01A',RuntimeGateStatus.NotRequired);
 const assertedOperation=op('save.reference.operation-b','01A',RuntimeGateStatus.NotRequired);
 const pre=evaluateSavePreflight({session,targetBuild:switchTarget,operation:assertedOperation});
 const result=await session.exportVerifiedCopy({edit(root){root.World.__wandOperationBinding={value:1};},exactAllowedPaths:['/World/__wandOperationBinding'],targetBuild:switchTarget,operation:exportedOperation});
 assert.throws(()=>createRuntimeAssertionManifest({preflight:pre,exportResult:result}),/PREFLIGHT_EXPORT_OPERATION_MISMATCH/);
});

test('preflight rejects an unknown runtime gate token',async()=>{
 const session=await SafeProfileEditSession.open({sourceBytes:makeSyntheticP1gProfile(syntheticProfile()),codec:p1gPackagedProfileCodec});
 assert.throws(()=>evaluateSavePreflight({session,targetBuild:switchTarget,operation:{...op(),runtimeGate:'MAYBE'}}),/INVALID_RUNTIME_GATE_STATUS/);
});
