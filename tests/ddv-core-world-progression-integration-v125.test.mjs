import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

function read(path){return JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));}
function raw(path){return readFileSync(new URL(path,import.meta.url),'utf8');}

const savePath='../static/ddv/core/save/v1.25/progression-reference-index-v125.json';
const graphPath='../static/ddv/core/world/v1.25/mission-world-object-consumer-graph-v125.json';
const integrationPath='../static/ddv/core/world/v1.25/progression-world-object-integration-v125.json';
const parentPath='../static/ddv/core/world/v1.25/progression-world-object-safety-v125.json';

const save=read(savePath);
const graph=read(graphPath);
const integration=read(integrationPath);
const parent=read(parentPath);

test('01A schema-624 reference-index dependency is promoted without terminal inference',()=>{
  assert.equal(save.schema,'ddv.progression-reference-index-manifest@1');
  assert.equal(save.artifactId,'DDV-PROGRESSION-REFERENCE-INDEX-V125-V1_0');
  assert.equal(save.status,'PROMOTED_DEPENDENCY');
  assert.equal(save.target.profileSchemaVersion,624);
  assert.equal(save.reusablePackage.sha256,'340fcab446a0f2e7db31604a927d90e1664398652285e325da2b1bcb092d480b');
  assert.equal(save.reusablePackage.components.syntheticTestResult,'11/11 PASS');
  assert.equal(save.currentSamples.switch.active,1716);
  assert.equal(save.currentSamples.switch.activeAddressItemIdResolved,42);
  assert.equal(save.currentSamples.switch.activeAddressItemIdUnmaterialized,1674);
  assert.equal(save.currentSamples.steam.historical,3);
  assert.equal(save.promotedSemantics.historicalCollectedReferences,'PRESERVE_HISTORY_ONLY__NO_ACTIVE_OWNERSHIP_VETO');
  assert.equal(save.promotedSemantics.activeAddressWithoutItemId,'STILL_VETOES_IDENTITY_CHANGING_MUTATION');
  assert.equal(save.terminalityAuthorized,false);
  assert.equal(save.writerBoundary.persistentWriteAuthorized,false);
});

test('01D 27-Mission consumer graph closes static dependency with explicit unknowns',()=>{
  assert.equal(graph.schema,'ddv.mission-world-object-consumer-graph-manifest@1');
  assert.equal(graph.artifactId,'DDV-MISSION-WORLD-OBJECT-CONSUMER-GRAPH-SWITCH-V125-27-V1');
  assert.equal(graph.validation,'PASS');
  assert.equal(graph.summary.targetMissionCount,27);
  assert.equal(graph.summary.resolvedMissionCount,27);
  assert.equal(graph.summary.confirmedPostCompletionConsumerMissionCount,4);
  assert.equal(graph.summary.currentConsumerTemporalityUnknownMissionCount,21);
  assert.equal(graph.summary.noStaticPostCompletionProofMissionCount,2);
  const all=[...graph.confirmedPostCompletionConsumerMissionIds,...graph.temporalityUnknownMissionIds,...graph.noStaticPostCompletionProofMissionIds];
  assert.equal(all.length,27);
  assert.equal(new Set(all).size,27);
  assert.deepEqual(graph.confirmedPostCompletionConsumerMissionIds,[2070000868,2070000968,2070001348,2070001496]);
  assert.deepEqual(graph.noStaticPostCompletionProofMissionIds,[2070000994,2070001617]);
  assert.equal(graph.terminalEditabilityAuthorized,false);
});

test('v1.14 closes 01A/01D dependencies but preserves positive-authorization boundary',()=>{
  assert.equal(integration.schema,'ddv.progression-world-object-integration@1');
  assert.equal(integration.artifactId,'DDV-PROGRESSION-WORLD-OBJECT-INTEGRATION-V125-V1_14');
  assert.equal(integration.status,'PROMOTED');
  assert.equal(integration.parent.artifactId,'DDV-PROGRESSION-WORLD-OBJECT-SAFETY-V125-V1_13');
  assert.equal(integration.parent.sha256,'e8fd80775276e95cb70b0dd684534244ebe21b6dba04ec341b5cf92e90c32213');
  assert.equal(parent.artifactId,integration.parent.artifactId);
  assert.equal(integration.dependencyClosure.questDefinitionGraph.status,'CLOSED');
  assert.equal(integration.dependencyClosure.saveProgressionReferenceIndex.status,'CLOSED');
  assert.equal(integration.positiveAuthorizationBoundary.authorizesUserControlledClassification,false);
  assert.equal(integration.positiveAuthorizationBoundary.authorizesTerminalEditableMutation,false);
  assert.equal(integration.positiveAuthorizationBoundary.authorizesPersistentWriter,false);
  assert.equal(integration.operationPolicy.historicalReference,'NO_ACTIVE_OWNERSHIP_VETO_FROM_THIS_REFERENCE');
  assert.equal(integration.operationPolicy.noStaticPostCompletionConsumerFound,'NOT_POSITIVE_PERMISSION');
  assert.equal(integration.remainingGates.conditionalSpawnRemoveWhenDone.status,'OPEN');
  assert.equal(integration.remainingGates.dynamicNativeConsumerExclusion.status,'OPEN');
  assert.equal(integration.remainingGates.objectSerializedStateCompatibility.status,'OPEN');
  assert.equal(integration.writerBoundary.persistentWriteAuthorized,false);
  assert.equal(integration.writerBoundary.applyAuthorized,false);
});

test('promoted dependency manifests are pinned by bytes',()=>{
  assert.equal(createHash('sha256').update(raw(savePath)).digest('hex'),'fc2445f8877eb00950c506814341d5b81a3f70d2a0a6540b77d86cb7a0182b2f');
  assert.equal(createHash('sha256').update(raw(graphPath)).digest('hex'),'f27083a8f650a2bbe6853e12c50adf2012ffb3d52f3087fba2a0b0598823b808');
  assert.equal(createHash('sha256').update(raw(integrationPath)).digest('hex'),'de7f3590c285547fd0e8f70f6141432d6c242c4c6e59540e271d6af4a1813434');
});
