import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const contractPath='../static/ddv/core/world/v1.25/progression-destination-veto-contract-v125.json';
const implPath='../static/ddv/core/world/v1.25/progression-destination-veto-v125.cjs';
const menhirPath='../static/ddv/core/world/v1.25/progression-menhir-family-audit-v125.json';

const contract=JSON.parse(readFileSync(new URL(contractPath,import.meta.url),'utf8'));
const menhir=JSON.parse(readFileSync(new URL(menhirPath,import.meta.url),'utf8'));
const api=require(implPath);

const refIndex=(refs=[])=>{
  const byGridObjectAddress={};
  for(const r of refs){
    if(r.gridId!=null&&r.gridObjectId!=null)(byGridObjectAddress[`${r.gridId}:${r.gridObjectId}`]??=[]).push(r.referenceId);
  }
  return {contract:'ddv.progression-reference-index@1',references:refs,indexes:{byGridObjectAddress,byItemId:{}}};
};

test('destination-veto v1.15 is promoted but negative-only',()=>{
  assert.equal(contract.artifactId,'DDV-PROGRESSION-DESTINATION-VETO-V125-V1_15');
  assert.equal(contract.version,'v1.15');
  assert.equal(contract.status,'PROMOTED');
  assert.equal(contract.noPositiveInference.absenceOfReferenceVetoIsPermission,false);
  assert.equal(contract.noPositiveInference.absenceOfDefinitionRiskIsUserControlled,false);
  assert.equal(contract.writerBoundary.persistentWriteAuthorized,false);
  assert.equal(contract.writerBoundary.applyAuthorized,false);
});

test('active progression reference protects destination without permission',()=>{
  const out=api.projectDestinationProgressionVeto({
    objects:[{itemId:40001060,source:{gridId:7,gridObjectId:9}}],
    progressionReferenceIndex:refIndex([{referenceId:'R1',gridId:7,gridObjectId:9,itemId:40001060,activity:'ACTIVE',activeOwnershipVeto:true,evidenceStatus:'CONFIRMED'}]),
    scopeIndex:{},
    source:{gameVersion:'1.25.0',profileSchemaVersion:624}
  });
  const r=out.records[0];
  assert.equal(out.version,'v1.15');
  assert.ok(r.operationVetoes.DESTINATION_OVERWRITE.includes('PROTECTED_PROGRESSION_OBJECT_CONFLICT'));
  assert.equal(r.positivePermission,false);
  assert.equal(out.semantics.absenceOfVetoIsPermission,false);
});

test('no-veto result remains neutral and unauthorized',()=>{
  const out=api.projectDestinationProgressionVeto({
    objects:[{itemId:99999999,source:{gridId:8,gridObjectId:10}}],
    progressionReferenceIndex:refIndex(),
    scopeIndex:{},
    source:{gameVersion:'1.25.0',profileSchemaVersion:624}
  });
  const r=out.records[0];
  assert.equal(r.ownershipClass,'UNCLASSIFIED_NO_POSITIVE_INFERENCE');
  assert.equal(r.negativeVetoFound,false);
  assert.equal(r.positivePermission,false);
  assert.equal(r.noVetoMeaning,'NO_VETO_FOUND_NOT_AUTHORIZED');
});

test('Menhir audit promotion remains bounded and operation-specific',()=>{
  assert.equal(menhir.artifactId,'DDV-PROGRESSION-MENHIR-FAMILY-AUDIT-V125-V1_15');
  assert.equal(menhir.version,'v1.15');
  assert.equal(menhir.status,'PROMOTED_BOUNDED_FAMILY_BLOCKED');
  assert.equal(menhir.family.id,'BASE_GAME_STORY_MENHIRS');
  assert.equal(menhir.family.membershipCount,8);
  assert.equal(menhir.target2DynamicNativeConsumerAudit.status,'CLOSED_FOR_DECLARED_STATIC_UNIVERSE_WITH_EXPLICIT_UNKNOWN_CLASSES');
  assert.equal(menhir.target3SerializedStateAgreement.status,'CLOSED_OPERATION_SPECIFIC_FOR_FAMILY');
  assert.equal(menhir.target3SerializedStateAgreement.operationMatrix.REMOVE.authorization,'CONFIRMED_FORBIDDEN');
  assert.equal(menhir.target3SerializedStateAgreement.operationMatrix.PRESET_CAPTURE.authorization,'CONFIRMED_EXCLUDED');
  assert.equal(menhir.target3SerializedStateAgreement.operationMatrix.MOVE.positivePermissionNow,false);
  assert.equal(menhir.target3SerializedStateAgreement.operationMatrix.ROTATE.positivePermissionNow,false);
  assert.equal(menhir.writerBoundary.persistentWriteAuthorized,false);
});

test('promoted artifact bytes are pinned',()=>{
  const h=p=>createHash('sha256').update(readFileSync(new URL(p,import.meta.url),'utf8')).digest('hex');
  assert.equal(h(contractPath),'d68364585b6563b583241b2cd98e28e70a26d3eed35c28b1f09fe672487c2123');
  assert.equal(h(implPath),'41bb86f2489079ab3b953a90124fc9898b1ceab40ca5c4553d7c8877538e2206');
  assert.equal(h(menhirPath),'d939055ff6e7c964a987f103215c1f6fedfb59d6e0892e420e70f8f04cea4018');
});
