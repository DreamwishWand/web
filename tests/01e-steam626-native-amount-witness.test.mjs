import test from 'node:test';
import assert from 'node:assert/strict';
import {describeNativeOperation,NATIVE_SOURCE_TARGETS} from '../src/lib/ddv/native/operation-native-static-gate.mjs';
const steam=NATIVE_SOURCE_TARGETS.steam1253, sw=NATIVE_SOURCE_TARGETS.switch1253;
const witness=id=>describeNativeOperation(id,steam).archivedSteam626NativeWitness;
test('Steam626 archived Inventory native quantity witness retains variation and quest closure',()=>{
  const w=witness('INV_AMOUNT');
  assert.equal(w.localMutation,'EXISTING_CANONICAL_AMOUNT_DECREMENT_ONLY');
  assert.ok(w.consumer.includes('VARIATION_CAN_CHANGE_ITEM_AND_AMOUNT'));
  assert.ok(w.producer.includes('LOW_LEVEL_ZERO_RETAINS_ROW_NOT_PRODUCT_AUTHORIZATION'));
  assert.ok(w.derived.includes('POSSESS_SUBSCRIBES_ADD_REMOVE_MOVE_AND_RECALCULATES_PROGRESS_STATUS'));
  assert.ok(w.requiredBeforeOperationV3.includes('ACTIVE_MISSION_FILTER_AND_OTHER_SUBSCRIBER_CLOSURE'));
});
test('Steam626 archived Chest witness distinguishes zero reset and runtime cache',()=>{
  const w=witness('CHEST_AMOUNT');
  assert.equal(w.localMutation,'EXISTING_SLOT_POSITIVE_REMAINDER_ONLY');
  assert.ok(w.producer.includes('ZERO_RESETS_ITEM_AMOUNT_STATE_434C250_NOT_PRODUCT_AUTHORIZATION'));
  assert.ok(w.derived.includes('POSITIVE_REMAINDER_UPDATES_RUNTIME_CACHE_NOT_NEW_SAVE_FIELD'));
  assert.ok(w.requiredBeforeOperationV3.includes('AUTHENTIC_PLAYER_CHEST_PARENT_ACTIVE_REFERENCE_AND_SLOT'));
});
test('Steam626 archived Grid witness distinguishes default-only clone and decor mission dependency',()=>{
  const w=witness('GRID_MOVE');
  assert.ok(w.producer.includes('DEFAULT_ONLY_OBJECT_REQUIRES_CLONE_AND_MODIFIED_MAP_INSERT'));
  assert.ok(w.derived.includes('MISSION_GRID_CHANGED_CAN_CHANGE_STATUS_AFTER_DECOR_CHECK'));
  assert.ok(w.requiredBeforeOperationV3.includes('01C_ROADFENCE_SEPARATE_OWNER'));
});
test('Steam626 archive evidence is exact-build-only and nonauthoritative',()=>{
  for(const id of ['INV_AMOUNT','CHEST_AMOUNT','GRID_MOVE']){
    const p=describeNativeOperation(id,{...steam,writerAuthorized:true,nativeV3Accepted:true});
    const w=p.archivedSteam626NativeWitness;
    assert.equal(w.binarySha256,'66644cf655e158086f83ffd654222ecfb5744c08423a644d3c0edc3244d66e4c');
    for(const v of [w,w.consumer,w.producer,w.derived,w.requiredBeforeOperationV3])assert.ok(Object.isFrozen(v));
    for(const k of ['fullReferenceClosureVerified','nativeV3Accepted','nativeEventReplayAuthorized','productWriterAuthorized'])assert.equal(w[k],false);
    assert.equal(p.nativeV3Accepted,false); assert.equal(p.productWriterAuthorized,false);
    assert.equal(p.coreIssuedReadsetVerified,false);
    assert.equal(describeNativeOperation(id,sw).archivedSteam626NativeWitness,undefined);
    assert.equal(describeNativeOperation(id,{...steam,buildId:'WRONG'}).status,'REJECTED');
    assert.equal(describeNativeOperation(id,{...steam,schema:624}).status,'REJECTED');
  }
  assert.equal(describeNativeOperation('TIME_EVENT',steam).archivedSteam626NativeWitness,undefined);
});
