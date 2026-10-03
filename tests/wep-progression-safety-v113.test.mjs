import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {
  PROGRESSION_V113_BLOCKERS,
  PROGRESSION_V113_SCHEMA,
  PROGRESSION_V113_SHA256,
  createSwitchV125ProgressionSafetyBindingFromContract
} from '../src/lib/wep/progression-safety-v113.ts';

const contract=JSON.parse(readFileSync(
  new URL('../static/ddv/core/world/v1.25/progression-world-object-safety-v125.json',import.meta.url),
  'utf8'
));
const binding=createSwitchV125ProgressionSafetyBindingFromContract(contract);

test('WEP consumes promoted progression safety v1.13 without positive permission',()=>{
  assert.equal(binding.schema,PROGRESSION_V113_SCHEMA);
  assert.equal(binding.artifactId,'DDV-PROGRESSION-WORLD-OBJECT-SAFETY-V125-V1_13');
  assert.equal(binding.contractSha256,PROGRESSION_V113_SHA256);
  assert.equal(binding.persistentWriteAuthorized,false);
  assert.equal(binding.positivePermissionGranted,false);
  assert.ok(PROGRESSION_V113_BLOCKERS.includes('PROGRESSION_OWNERSHIP_UNKNOWN'));
});

test('missing authoritative progression classification fails closed',()=>{
  const result=binding.evaluateProgressionEvidence({
    operation:'MOVE',
    ownershipClass:'USER_CONTROLLED',
    phaseClass:'PROGRESSION_TERMINAL_EDITABLE',
    explicitlyClassified:false
  });
  assert.equal(result.status,'blocked');
  assert.equal(result.blockerCode,'PROGRESSION_OWNERSHIP_UNKNOWN');
  assert.equal(result.positivePermissionGranted,false);
});

test('quest-owned and system-spawned objects block generic mutation',()=>{
  const quest=binding.evaluateProgressionEvidence({
    operation:'REMOVE',
    ownershipClass:'QUEST_OWNED',
    phaseClass:'PROGRESSION_ACTIVE_LOCKED',
    explicitlyClassified:true
  });
  assert.equal(quest.blockerCode,'QUEST_OWNED_OBJECT_MUTATION_FORBIDDEN');

  const system=binding.evaluateProgressionEvidence({
    operation:'DUPLICATE',
    ownershipClass:'SYSTEM_SPAWNED',
    phaseClass:'PROGRESSION_ACTIVE_LOCKED',
    explicitlyClassified:true
  });
  assert.equal(system.blockerCode,'SYSTEM_SPAWNED_OBJECT_MUTATION_FORBIDDEN');
});

test('active identity references block identity-changing operations',()=>{
  const result=binding.evaluateProgressionEvidence({
    operation:'MOVE',
    ownershipClass:'USER_CONTROLLED',
    phaseClass:'',
    activeIdentityReference:true,
    explicitlyClassified:true
  });
  assert.equal(
    result.blockerCode,
    'REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN'
  );
});

test('terminal editable phase still grants no mutation permission',()=>{
  const result=binding.evaluateProgressionEvidence({
    operation:'ROTATE',
    ownershipClass:'USER_CONTROLLED',
    phaseClass:'PROGRESSION_TERMINAL_EDITABLE',
    explicitlyClassified:true
  });
  assert.equal(result.status,'blocked');
  assert.equal(result.blockerCode,'PROGRESSION_OPERATION_PROOF_NOT_CLOSED');
  assert.equal(result.positivePermissionGranted,false);
});

test('explicit USER_CONTROLLED only clears this progression gate and still authorizes no write',()=>{
  const result=binding.evaluateProgressionEvidence({
    operation:'ROTATE',
    ownershipClass:'USER_CONTROLLED',
    phaseClass:'',
    explicitlyClassified:true
  });
  assert.equal(result.status,'no-progression-blocker');
  assert.equal(result.requiresNormalCoreValidation,true);
  assert.equal(result.positivePermissionGranted,false);
  assert.equal(result.persistentWriteAuthorized,false);
});

test('explicit Core progression blocker codes are extracted without inference',()=>{
  assert.deepEqual(
    binding.progressionBlockersFromObjectMetadata({
      reasons:[
        'MISSION_ITEM_READ_ONLY',
        'PROGRESSION_STATE_INCONSISTENT',
        'PROTECTED_PROGRESSION_OBJECT_CONFLICT'
      ]
    }),
    [
      'PROGRESSION_STATE_INCONSISTENT',
      'PROTECTED_PROGRESSION_OBJECT_CONFLICT'
    ]
  );
});
