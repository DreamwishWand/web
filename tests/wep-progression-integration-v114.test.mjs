import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {
  PROGRESSION_V114_SCHEMA,
  PROGRESSION_V114_SHA256,
  createSwitchV125ProgressionIntegrationBindingFromContract
} from '../src/lib/wep/progression-integration-v114.ts';

const contract=JSON.parse(readFileSync(
  new URL('../static/ddv/core/world/v1.25/progression-world-object-integration-v125.json',import.meta.url),
  'utf8'
));
const binding=createSwitchV125ProgressionIntegrationBindingFromContract(contract);

test('WEP consumes v1.14 dependency closure without positive permission',()=>{
  assert.equal(binding.schema,PROGRESSION_V114_SCHEMA);
  assert.equal(binding.artifactId,'DDV-PROGRESSION-WORLD-OBJECT-INTEGRATION-V125-V1_14');
  assert.equal(binding.contractSha256,PROGRESSION_V114_SHA256);
  assert.equal(binding.proofStatus().questDefinitionGraph,'CLOSED');
  assert.equal(binding.proofStatus().saveProgressionReferenceIndex,'CLOSED');
  assert.equal(binding.proofStatus().terminalEditableMutationAuthorized,false);
  assert.equal(binding.positivePermissionGranted,false);
  assert.equal(binding.persistentWriteAuthorized,false);
});

test('remaining native/state gates keep terminal mutation closed',()=>{
  const status=binding.proofStatus();
  assert.equal(status.conditionalSpawnRemoveWhenDone,'OPEN');
  assert.equal(status.dynamicNativeConsumerExclusion,'OPEN');
  assert.equal(status.objectSerializedStateCompatibility,'OPEN');
});

test('active and unknown references block while historical alone does not',()=>{
  assert.equal(
    binding.referenceDisposition('ACTIVE').blockerCode,
    'REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN'
  );
  assert.equal(
    binding.referenceDisposition('UNKNOWN').blockerCode,
    'PROGRESSION_OWNERSHIP_UNKNOWN'
  );
  const historical=binding.referenceDisposition('HISTORICAL');
  assert.equal(historical.status,'no-active-reference-veto');
  assert.equal(historical.positivePermissionGranted,false);
  assert.equal(historical.requiresNormalCoreValidation,true);
});

test('document annotation is diagnostic-only and preserves object editability',()=>{
  const source={
    schema:'dreamwish-wand-editor-document',
    objects:[
      {editorId:'a',itemId:4001,editability:'editable',metadata:{reasons:[]}},
      {editorId:'b',itemId:4002,editability:'readonly',metadata:{reasons:['X']}}
    ],
    metadata:{existing:true}
  };
  const annotated=binding.annotateEditorDocument(source);
  assert.equal(annotated.objects[0].editability,'editable');
  assert.equal(annotated.objects[1].editability,'readonly');
  assert.deepEqual(annotated.objects,source.objects);
  assert.equal(annotated.metadata.existing,true);
  assert.equal(annotated.metadata.progressionIntegration.proofStatus.questDefinitionGraph,'CLOSED');
  assert.equal(annotated.metadata.progressionIntegration.proofStatus.terminalEditableMutationAuthorized,false);
  assert.equal(annotated.metadata.progressionIntegration.persistentWriteAuthorized,false);
});
