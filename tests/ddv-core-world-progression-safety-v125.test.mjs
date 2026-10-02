import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';

const url=new URL('../static/ddv/core/world/v1.25/progression-world-object-safety-v125.json',import.meta.url);
const raw=fs.readFileSync(url,'utf8');
const c=JSON.parse(raw);

assert.equal(c.schema,'ddv.progression-world-object-safety@1');
assert.equal(c.artifactId,'DDV-PROGRESSION-WORLD-OBJECT-SAFETY-V125-V1_13');
assert.equal(c.status,'PROMOTED');
assert.equal(c.target.platform,'Nintendo Switch');
assert.equal(c.target.gameVersion,'1.25.0');
assert.equal(c.target.buildId,'52BD625D9B4E0053');
assert.equal(c.target.profileSchemaVersion,624);

assert.equal(c.confirmedStaticFacts.progressionRiskDefinitionCount,2808);
assert.equal(c.confirmedStaticFacts.explicitStatusEdgeCount,145);
assert.equal(c.confirmedStaticFacts.referencedMissionIdCount,27);
assert.equal(c.confirmedStaticFacts.gridEditRestrictionSufficient,false);
assert.equal(c.confirmedStaticFacts.isMissionItemSufficient,false);
assert.equal(c.confirmedStaticFacts.absenceOfGridEditRestrictionMeansUserControlled,false);

assert.ok(c.failClosedPolicy.protectedOwnershipClasses.includes('UNKNOWN_OWNERSHIP'));
assert.ok(c.failClosedPolicy.blockedPhaseClasses.includes('INCONSISTENT'));
assert.match(c.failClosedPolicy.terminalEditableRule,/not a blanket authorization/);
assert.match(c.failClosedPolicy.questCompletionRule,/never enables/);

assert.equal(c.presetPolicy.protectedSourceCapture,'EXCLUDE');
assert.equal(c.presetPolicy.protectedDestinationOccupancy,'PRESERVE_AS_OCCUPANCY');
assert.equal(c.presetPolicy.nativeReplaceOrRemoveClassOverridesProtection,false);
assert.equal(c.blockers.protectedDestinationConflict,'PROTECTED_PROGRESSION_OBJECT_CONFLICT');

assert.equal(c.positiveAuthorizationBoundary.authorizesUserControlledClassification,false);
assert.equal(c.positiveAuthorizationBoundary.authorizesTerminalEditableMutation,false);
assert.equal(c.positiveAuthorizationBoundary.authorizesPersistentWriter,false);
assert.equal(c.dependencies.questDefinitionGraph.status,'OPEN');
assert.equal(c.dependencies.saveProgressionReferenceIndex.status,'OPEN');

assert.equal(c.writerBoundary.persistentWriteAuthorized,false);
assert.equal(c.writerBoundary.WORLD_PERSISTENT_WRITE_V125,false);
assert.ok(c.writerBoundary.prohibitedActions.includes('Apply'));

assert.equal(createHash('sha256').update(raw).digest('hex'),'e8fd80775276e95cb70b0dd684534244ebe21b6dba04ec341b5cf92e90c32213');
console.log('PASS ddv.progression-world-object-safety@1 v1.13');
