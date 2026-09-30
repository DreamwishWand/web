import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { evaluateSavePreflight, createRuntimeAssertionManifest } from '../src/lib/ddv/core/save/save-preflight.js';
import { BuildIdentityKind, PlatformFamily, RuntimeGateStatus } from '../src/lib/ddv/core/save/versioning.js';
import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';

const preflightSchema=JSON.parse(await readFile(new URL('../contracts/save-preflight.schema.json',import.meta.url),'utf8'));
const runtimeSchema=JSON.parse(await readFile(new URL('../contracts/runtime-assertion.schema.json',import.meta.url),'utf8'));

function assertContractShape(value,schema){
  assert.equal(value.contract,schema.$id);
  for(const k of schema.required) assert.ok(Object.hasOwn(value,k),`missing ${k}`);
  if(schema.properties.persistentWriteAuthorized?.const===false) assert.equal(value.persistentWriteAuthorized,false);
}

test('published contract schemas use the runtime contract identifiers',()=>{
  assert.equal(preflightSchema.$schema,'https://json-schema.org/draft/2020-12/schema');
  assert.equal(runtimeSchema.$schema,'https://json-schema.org/draft/2020-12/schema');
  assert.equal(preflightSchema.$id,'dreamwish.ddv.save-preflight@1');
  assert.equal(runtimeSchema.$id,'dreamwish.ddv.runtime-assertion@1');
});

test('generated preflight and runtime assertion retain the published top-level schema shape',async()=>{
  const source=makeSyntheticP1gProfile(syntheticProfile());
  const session=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform:PlatformFamily.Switch});
  const targetBuild={platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'52BD625D9B4E0053'};
  const operation={id:'save.contract.schema',owner:'01A',structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true,runtimeGate:RuntimeGateStatus.NotRequired};
  const preflight=evaluateSavePreflight({session,targetBuild,operation});
  assertContractShape(preflight,preflightSchema);
  assert.equal(preflight.targetBuild.platform,'switch');
  assert.equal(preflight.capabilities.persistentReplace,false);

  const result=await session.exportVerifiedCopy({edit(root){root.World.__wandContractSchema={value:1};},exactAllowedPaths:['/World/__wandContractSchema'],targetBuild,operation});
  const runtime=createRuntimeAssertionManifest({preflight,exportResult:result});
  assertContractShape(runtime,runtimeSchema);
  assert.equal(runtime.targetBuild.value,'52BD625D9B4E0053');
  assert.deepEqual(runtime.output.changedPaths,['/World/__wandContractSchema']);
  assert.equal(runtime.capabilitiesAtExport.persistentReplace,false);
});
