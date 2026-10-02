import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const audit=JSON.parse(readFileSync(
  new URL('../static/ddv/core/world/v1.25/progression-positive-authorization-audit-v125.json',import.meta.url),
  'utf8'
));

test('v1.15 candidate starts only after 01A/01D dependency closure',()=>{
  assert.equal(audit.schema,'ddv.progression-positive-authorization-audit@1');
  assert.equal(audit.status,'ACTIVE_TARGETED_AUDIT');
  assert.equal(audit.dependencies.questDefinitionGraph.status,'CLOSED');
  assert.equal(audit.dependencies.questDefinitionGraph.validation,'PASS');
  assert.equal(audit.dependencies.questDefinitionGraph.summary.resolvedMissions,27);
  assert.equal(audit.dependencies.saveProgressionReferenceIndex.status,'CLOSED');
});

test('positive progression mutation remains impossible while any targeted gate is open',()=>{
  assert.deepEqual(audit.gates.map((gate)=>gate.status),['CLOSED_STATIC','OPEN','OPEN']);
  assert.equal(audit.positiveAuthorization.userControlledClassification,false);
  assert.equal(audit.positiveAuthorization.terminalEditableMutation,false);
  assert.equal(audit.positiveAuthorization.nativeRestoreExecution,false);
  assert.equal(audit.positiveAuthorization.persistentWriter,false);
  assert.equal(audit.writerBoundary.persistentWriteAuthorized,false);
  assert.equal(audit.writerBoundary.WORLD_PERSISTENT_WRITE_V125,false);
  assert.equal(audit.writerBoundary.applyAuthorized,false);
});

test('audit remains static-first and runtime escalation is narrowly scoped',()=>{
  const remove=audit.gates.find((gate)=>gate.id==='conditionalSpawnRemoveWhenDone');
  assert.equal(remove.staticFirst,true);
  assert.match(remove.runtimeEscalationRule,/01E/);
  assert.match(remove.runtimeEscalationRule,/minimal/);

  const dynamic=audit.gates.find((gate)=>gate.id==='dynamicNativeConsumerExclusion');
  assert.equal(dynamic.staticFirst,true);
  assert.match(dynamic.prohibition,/Do not claim whole-game absence/);
});

test('operation policy does not silently convert no-veto into permission',()=>{
  for(const op of ['MOVE','ROTATE','REMOVE','DUPLICATE','REPLACE','STATE_EDIT']){
    assert.equal(
      audit.operationPolicy[op],
      'BLOCK_UNLESS_ALL_RELEVANT_GATES_CLOSED_FOR_OBJECT'
    );
  }
  assert.equal(audit.operationPolicy.PRESET_CAPTURE,'EXCLUDE_WHILE_PROTECTED_OR_UNKNOWN');
});


test('RemoveWhenDone native semantics are statically closed without turning completion into permission',()=>{
  const remove=audit.gates.find((gate)=>gate.id==='conditionalSpawnRemoveWhenDone');
  assert.equal(remove.status,'CLOSED_STATIC');
  assert.equal(remove.evidenceLevel,'CONFIRMED');
  assert.equal(remove.runtimeEscalationDecision,'NOT_REQUIRED_STATIC_CLOSED');
  assert.equal(remove.observedEvidence.staticDefinitionSummary.removeWhenDoneSpawnActionCount,18);
  assert.equal(remove.observedEvidence.staticDefinitionSummary.targetMissionCount,9);
  assert.equal(remove.observedEvidence.currentSchema624Samples.switchAndSteamBothContainAllNineMissionsCompleted,true);
  assert.equal(remove.observedEvidence.currentSchema624Samples.counterexample.removeWhenDone,true);
  assert.equal(remove.observedEvidence.currentSchema624Samples.counterexample.doOnce,false);
  assert.equal(remove.observedEvidence.currentSchema624Samples.counterexample.currentDefinition.conditionsOperator,'AND');
  assert.deepEqual(
    remove.observedEvidence.currentSchema624Samples.counterexample.currentDefinition.conditions[0],
    {type:'MissionStepStatus',missionId:2070001380,stepId:9,status:'Completed'}
  );
  assert.equal(remove.observedEvidence.currentSchema624Samples.counterexample.activeSpawnStateAddressPersistsInBothSamples,true);
  assert.equal(remove.observedEvidence.currentSchema624Samples.counterexample.referencedTargetMaterializedInSaveLocalGrids,false);
  assert.equal(remove.observedEvidence.currentSchema624Samples.counterexample.rawGridObjectAddress,'REDACTED_FROM_PUBLIC_REPO');
  assert.equal(remove.observedEvidence.conclusions.missionCompletionImpliesSpawnStateReferenceRemoved,false);
  assert.equal(remove.observedEvidence.conclusions.persistedSpawnedObjectsAddressProvesLiveMaterializedObject,false);
  assert.equal(remove.observedEvidence.conclusions.exactNativeCleanupTimingClosed,true);
  assert.equal(remove.observedEvidence.conclusions.removeWhenDoneIsPositiveTerminalityEvidence,false);
  assert.equal(remove.nativeSemantics.reloadPersistence.initializeReevaluation,true);
  assert.equal(remove.nativeSemantics.retainedRecordClassification.activeEventsMeaning,'OPERATIONAL_ACTIVE_STATE');
  assert.equal(remove.nativeSemantics.retainedRecordClassification.spawnedObjectAddressMeaning,'RECORDED_SPAWN_IDENTITY_NOT_LIVENESS_PROOF');
  assert.equal(remove.nativeSemantics.terminality.removeWhenDoneAlonePositiveEvidence,false);
  assert.match(remove.nativeSemantics.ordering.join(' '),/UndoAction/);
  assert.match(remove.nativeSemantics.ordering.join(' '),/ActiveEvents\.Remove/);
  assert.equal(audit.positiveAuthorization.terminalEditableMutation,false);
});
