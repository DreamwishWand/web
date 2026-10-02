import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const a=JSON.parse(readFileSync(new URL('../static/ddv/core/world/v1.25/progression-menhir-family-audit-v125.json',import.meta.url),'utf8'));
test('bounded Story Menhir family is exact and current-v1.25 scoped',()=>{
 assert.equal(a.schema,'ddv.progression-bounded-family-audit@1');
 assert.equal(a.status,'CLOSED_BOUNDED_FAMILY_BLOCKED');
 assert.equal(a.target.platform,'Nintendo Switch');
 assert.equal(a.target.gameVersion,'1.25.0');
 assert.equal(a.target.buildId,'52BD625D9B4E0053');
 assert.equal(a.target.profileSchemaVersion,624);
 assert.equal(a.family.membershipCount,8);
 assert.deepEqual(a.family.members.map(x=>x.itemID),[40001060,40001062,40001068,40001071,40001072,40001073,40001074,40001075]);
 assert.ok(a.family.members.every(x=>x.isMissionItem===true&&x.nativeGridEditRestriction.REMOVE===false));
});
test('Target 2 closes only the declared static universe and keeps unknown classes explicit',()=>{
 const t=a.target2DynamicNativeConsumerAudit;
 assert.equal(t.status,'CLOSED_FOR_DECLARED_STATIC_UNIVERSE_WITH_EXPLICIT_UNKNOWN_CLASSES');
 assert.equal(t.evidenceLevel,'CONFIRMED');
 assert.ok(t.searchUniverse.length>=4);
 assert.ok(t.unknownClasses.length>=1);
 assert.match(t.negativeProofBoundary,/No claim is made outside/);
 assert.equal(t.positiveAuthorization,false);
});
test('bounded audit found consumers outside promoted 01D rather than claiming absence',()=>{
 const cs=a.target2DynamicNativeConsumerAudit.consumersFound;
 const migration=cs.find(x=>x.kind==='VERSIONED_PROFILE_MIGRATION');
 assert.equal(migration.hardcodedItemID,40001073);
 assert.equal(migration.profileUpdaterVersion,164);
 assert.equal(migration.currentSchema624Active,false);
 assert.equal(migration.representedBy01D,false);
 const keyhole=cs.find(x=>x.kind==='PROFILEWORLD_KEYHOLE_LINKED_STATE');
 assert.deepEqual(keyhole.membership,[40001072,40001074,40001075]);
 assert.equal(keyhole.persistent,true);
 assert.equal(keyhole.representedBy01D,false);
 assert.equal(keyhole.representedBy01A,true);
 const restriction=cs.find(x=>x.kind==='DEFINITION_NATIVE_GRID_EDIT_RESTRICTION');
 assert.match(restriction.details,/2070000860/);
 assert.match(restriction.details,/2070000948/);
});
test('Target 3 records exact Keyhole linked state and no SubGrid for all eight',()=>{
 const t=a.target3SerializedStateAgreement;
 assert.equal(t.status,'CLOSED_OPERATION_SPECIFIC_FOR_FAMILY');
 assert.deepEqual(t.stateFamilies.keyholeMembers,[40001072,40001074,40001075]);
 assert.equal(t.stateFamilies.keyholeGridState,'GridState.Keyhole.KeyholeConfigDataGUID');
 assert.match(t.stateFamilies.keyholeLinkedPersistentState,/ProfileWorld\.Keyholes/);
 assert.equal(t.stateFamilies.subGrid,'NONE_ALL_8');
 assert.equal(t.nativeLifecycle.keyholeDeinitialize.includes('no-op'),true);
});
test('operation matrix closes negative operations without creating MOVE/ROTATE permission',()=>{
 const m=a.target3SerializedStateAgreement.operationMatrix;
 assert.equal(m.REMOVE.authorization,'CONFIRMED_FORBIDDEN');
 assert.equal(m.PRESET_CAPTURE.authorization,'CONFIRMED_EXCLUDED');
 assert.equal(m.MOVE.positivePermissionNow,false);
 assert.equal(m.ROTATE.positivePermissionNow,false);
 assert.equal(m.STATE_EDIT.authorization,'BLOCKED');
 assert.equal(a.target3SerializedStateAgreement.positiveAuthorization,false);
});
test('writer boundary remains closed',()=>{
 assert.equal(a.writerBoundary.persistentWriteAuthorized,false);
 assert.equal(a.writerBoundary.WORLD_PERSISTENT_WRITE_V125,false);
 assert.equal(a.writerBoundary.applyAuthorized,false);
});
