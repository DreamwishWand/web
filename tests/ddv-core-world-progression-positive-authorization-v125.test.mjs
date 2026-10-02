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
  assert.deepEqual(audit.gates.map((gate)=>gate.status),['OPEN','OPEN','OPEN']);
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
