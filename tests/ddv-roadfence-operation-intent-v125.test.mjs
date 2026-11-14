import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROADFENCE_OPERATION_INTENT_CONTRACT,
  RoadFenceEditIntent,
  assessRoadFenceEditIntentV125
} from '../src/lib/ddv/core/roadfence/operation-intent-v125.js';
import { FenceMode } from '../src/lib/ddv/core/roadfence/logical.js';
import { BUILD_V125_SWITCH } from './helpers/ddv-roadfence-persistent-v125-fixtures.mjs';

const R = FenceMode.ORTHOGONAL;
const D = FenceMode.DIAGONAL;
function cell(x, y, mode = R) { return { x, y, mode }; }
function road(cells) { return { familyBaseItemID: 40100068, cells }; }
function fence(nodes, edges) {
  return { familyBaseItemID: 40700246, graph: { nodes, edges } };
}
function node(id, x, y, mode = R) { return { id, x, y, mode }; }
function assess(kind, intent, sourceNetwork, desiredNetwork, motion) {
  return assessRoadFenceEditIntentV125({
    buildIdentity: BUILD_V125_SWITCH,
    kind, intent, sourceNetwork, desiredNetwork, motion
  });
}
function accepted(result) {
  assert.equal(result.contract, ROADFENCE_OPERATION_INTENT_CONTRACT);
  assert.equal(result.status, 'STATIC_INTENT_VALIDATED_ONLY');
  assert.equal(result.layoutPolicy, 'PRESERVE_EXISTING');
  assert.equal(result.sourceBuildIdentity.bid, BUILD_V125_SWITCH.bid);
  assert.equal(result.sourceBuildIdentity.profileSchema, 624);
  assert.equal(result.sourceBinding, 'REQUIRES_CORE_SESSION_TYPED_SOURCE_WITNESS');
  assert.equal(result.nativeProducerConsumerRecompileV3, 'UNKNOWN');
  assert.equal(result.nativeInventoryCostRefund, 'UNKNOWN');
  assert.equal(result.wandInventoryDelta, 0);
  assert.equal(result.writerAuthorized, false);
  assert.equal(result.persistentWriteAuthorized, false);
  assert.equal(result.WORLD_PERSISTENT_WRITE_V125, false);
  assert.equal(result.productApplyAuthorized, false);
}

test('Road ADD/ERASE are monotonic only; quantity delta is logical and not an inventory charge', () => {
  const one = road([cell(0, 0)]);
  const two = road([cell(0, 0), cell(1, 0)]);
  const add = assess('road', RoadFenceEditIntent.ADD, one, two);
  accepted(add);
  assert.equal(add.logicalQuantityDelta, 1);
  assert.equal(add.addedLogicalElements, 1);
  assert.equal(add.compilerOperation, 'ROAD_SET_TOPOLOGY');
  const erase = assess('road', RoadFenceEditIntent.ERASE, two, one);
  accepted(erase);
  assert.equal(erase.logicalQuantityDelta, -1);
  assert.equal(erase.compilerOperation, 'ROAD_ERASE');
  assert.equal(
    assess('road', RoadFenceEditIntent.ADD, two, one).errorCode,
    'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC'
  );
  assert.equal(
    assess('road', RoadFenceEditIntent.ERASE, one, two).errorCode,
    'ROADFENCE_OPERATION_ERASE_NOT_MONOTONIC'
  );
});

test('Road MOVE/ROTATE require exact canonical transform; no Native orientation inferred', () => {
  const horizontal = road([cell(0, 0), cell(1, 0)]);
  const moved = road([cell(2, 0), cell(3, 0)]);
  const rotated = road([cell(0, 0), cell(0, 1)]);
  accepted(assess('road', RoadFenceEditIntent.MOVE, horizontal, moved,
    { translateX: 2, translateY: 0 }));
  accepted(assess('road', RoadFenceEditIntent.ROTATE, horizontal, rotated,
    { pivot: { x: 0, y: 0 }, rotateQuarterTurns: 1 }));
  assert.equal(
    assess('road', RoadFenceEditIntent.MOVE, horizontal, rotated,
      { translateX: 1, translateY: 0 }).errorCode,
    'ROADFENCE_OPERATION_TRANSFORM_MISMATCH'
  );
  assert.equal(
    assess('road', RoadFenceEditIntent.ROTATE, horizontal, rotated,
      { rotateQuarterTurns: 0 }).errorCode,
    'ROADFENCE_OPERATION_ROTATE_TRANSFORM_INVALID'
  );
  assert.equal(
    assess('road', RoadFenceEditIntent.MOVE, horizontal, moved,
      { translateX: 2, rotateQuarterTurns: 1 }).errorCode,
    'ROADFENCE_OPERATION_MOVE_TRANSFORM_INVALID'
  );
  assert.equal(
    assess('road', RoadFenceEditIntent.MOVE, horizontal, horizontal,
      { translateX: 0 }).errorCode,
    'ROADFENCE_OPERATION_MOVE_TRANSFORM_INVALID'
  );
  assert.equal(
    assess('road', RoadFenceEditIntent.MOVE, horizontal, moved,
      { translateX: 2, reflected: true }).errorCode,
    'ROADFENCE_OPERATION_TRANSFORM_UNRECOGNIZED_FIELD'
  );
});

test('Road CONNECT/DISCONNECT distinguish bridge from no-op and do not claim write support', () => {
  const islands = road([cell(0, 0), cell(2, 0)]);
  const bridged = road([cell(0, 0), cell(1, 0), cell(2, 0)]);
  const connect = assess('road', RoadFenceEditIntent.CONNECT, islands, bridged);
  accepted(connect);
  assert.equal(connect.sourceComponents, 2);
  assert.equal(connect.desiredComponents, 1);
  assert.equal(connect.logicalQuantityDelta, 1);
  const disconnect = assess('road', RoadFenceEditIntent.DISCONNECT, bridged, islands);
  accepted(disconnect);
  assert.equal(disconnect.sourceComponents, 1);
  assert.equal(disconnect.desiredComponents, 2);
  assert.equal(disconnect.compilerOperation, 'ROAD_ERASE');
  assert.equal(
    assess('road', RoadFenceEditIntent.CONNECT, bridged, bridged).errorCode,
    'ROADFENCE_OPERATION_CONNECTION_NOT_PROVEN'
  );
  assert.equal(
    assess('road', RoadFenceEditIntent.DISCONNECT, islands, bridged).errorCode,
    'ROADFENCE_OPERATION_DISCONNECTION_NOT_PROVEN'
  );
});

test('Fence connection is edge-specific and does not create/debit items', () => {
  const a = node('a', 0, 0);
  const b = node('b', 1, 0);
  const separate = fence([a, b], []);
  const joined = fence([a, b], [{ a: 'a', b: 'b' }]);
  const result = assess('fence', RoadFenceEditIntent.CONNECT, separate, joined);
  accepted(result);
  assert.equal(result.addedExplicitConnections, 1);
  assert.equal(result.logicalQuantityDelta, 0);
  const disconnected = assess('fence', RoadFenceEditIntent.DISCONNECT, joined, separate);
  accepted(disconnected);
  assert.equal(disconnected.removedExplicitConnections, 1);
  assert.equal(disconnected.logicalQuantityDelta, 0);
  assert.equal(
    assess('fence', RoadFenceEditIntent.ADD, separate, joined).errorCode,
    'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC'
  );
  assert.equal(
    assess('fence', RoadFenceEditIntent.ERASE, joined, separate).errorCode,
    'ROADFENCE_OPERATION_ERASE_NOT_MONOTONIC'
  );
});

test('Fence MOVE uses existing logical transform without touching post layout', () => {
  const source = fence([node('a', 0, 0), node('b', 1, 0)], [{ a: 'a', b: 'b' }]);
  const desired = fence([node('a', 2, 0), node('b', 3, 0)], [{ b: 'b', a: 'a' }]);
  accepted(assess('fence', RoadFenceEditIntent.MOVE, source, desired,
    { translateX: 2, translateY: 0 }));
});

test('RECOMPILE is only a static identity check, not Native regeneration evidence', () => {
  const source = road([cell(0, 0), cell(1, 0)]);
  const same = assess('road', RoadFenceEditIntent.RECOMPILE, source, source);
  accepted(same);
  assert.equal(same.logicalQuantityDelta, 0);
  assert.equal(same.nativeProducerConsumerRecompileV3, 'UNKNOWN');
  assert.equal(
    assess('road', RoadFenceEditIntent.RECOMPILE, source,
      road([cell(0, 0)])).errorCode,
    'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY'
  );
});

test('unproven build, invalid diagonal, changed family and unknown intent fail closed', () => {
  const source = road([cell(0, 0)]);
  assert.equal(assessRoadFenceEditIntentV125({
    buildIdentity: { ...BUILD_V125_SWITCH, bid: 'BAD_BID' },
    kind: 'road', intent: RoadFenceEditIntent.ADD,
    sourceNetwork: source, desiredNetwork: road([cell(0, 0), cell(1, 0)])
  }).status, 'FAIL_CLOSED');
  assert.equal(
    assess('road', 'UNSUPPORTED_ACTION', source, source).errorCode,
    'ROADFENCE_OPERATION_INTENT_UNKNOWN'
  );
  assert.equal(
    assess('road', RoadFenceEditIntent.ADD, source,
      { familyBaseItemID: 40100038, cells: [cell(0, 0), cell(1, 0)] }).errorCode,
    'ROADFENCE_OPERATION_FAMILY_CHANGED'
  );
  const invalid = fence(
    [node('a', 0, 0, D), node('b', 1, 0, D)],
    [{ a: 'a', b: 'b' }]
  );
  assert.equal(
    assess('fence', RoadFenceEditIntent.CONNECT,
      fence([node('a', 0, 0, D), node('b', 1, 0, D)], []),
      invalid).errorCode,
    'ROADFENCE_OPERATION_TOPOLOGY_INVALID'
  );
});

test('Fence ADD never hides a removed edge behind delimiter-colliding node IDs', () => {
  const oldNodes = [
    node('a', 0, 0), node('b|c', 1, 0),
    node('a|b', 10, 0), node('c', 11, 0)
  ];
  const old = fence(oldNodes, [{ a: 'a', b: 'b|c' }]);
  const withExtraNode = [...oldNodes, node('spare', 20, 0)];
  const substituted = fence(withExtraNode, [{ a: 'a|b', b: 'c' }]);

  assert.equal(
    assess('fence', RoadFenceEditIntent.ADD, old, substituted).errorCode,
    'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC'
  );

  // A true monotonic addition must remain accepted.
  accepted(assess('fence', RoadFenceEditIntent.ADD,
    old, fence(withExtraNode, [{ a: 'a', b: 'b|c' }])));
});


test('Fence RECOMPILE compares collision-free endpoint tuples, not legacy :: fingerprint', () => {
  const nodes = [
    node('a', 0, 0), node('b::c', 1, 0),
    node('a::b', 10, 0), node('c', 11, 0)
  ];
  const before = fence(nodes, [{ a: 'a', b: 'b::c' }]);
  const rewired = fence(nodes, [{ a: 'a::b', b: 'c' }]);
  const denied = assess('fence', RoadFenceEditIntent.RECOMPILE, before, rewired);
  assert.equal(denied.status, 'FAIL_CLOSED');
  assert.equal(denied.errorCode, 'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
  assert.equal(denied.writerAuthorized, false);
  assert.equal(denied.productApplyAuthorized, false);

  // The connection changes, but both components and logical quantity remain
  // 3 and 4 respectively: neither count is sufficient for topology equality.
  const beforeConnected = assess('fence', RoadFenceEditIntent.RECOMPILE, before, before);
  accepted(beforeConnected);
  assert.equal(beforeConnected.sourceComponents, 3);
  assert.equal(beforeConnected.desiredComponents, 3);
  assert.equal(beforeConnected.logicalQuantityBefore, 4);
  assert.equal(beforeConnected.logicalQuantityDelta, 0);

  // Node/edge order and undirected endpoint order must not change identity.
  const reordered = fence([...nodes].reverse(), [{ a: 'b::c', b: 'a' }]);
  const valid = assess('fence', RoadFenceEditIntent.RECOMPILE, before, reordered);
  accepted(valid);
  assert.equal(valid.sourceComponents, 3);
  assert.equal(valid.desiredComponents, 3);
  assert.equal(valid.logicalQuantityDelta, 0);
  assert.equal(valid.addedExplicitConnections, 0);
  assert.equal(valid.removedExplicitConnections, 0);
  assert.equal(valid.nativeProducerConsumerRecompileV3, 'UNKNOWN');

  // This existing 01C case must not regress: '|' endpoint collisions are
  // rejected for RECOMPILE and for the previously fixed monotonic ADD.
  const pipes = [
    node('a', 0, 0), node('b|c', 1, 0),
    node('a|b', 10, 0), node('c', 11, 0)
  ];
  const oldPipe = fence(pipes, [{ a: 'a', b: 'b|c' }]);
  const changedPipe = fence(pipes, [{ a: 'a|b', b: 'c' }]);
  assert.equal(
    assess('fence', RoadFenceEditIntent.RECOMPILE, oldPipe, changedPipe).errorCode,
    'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY'
  );
  assert.equal(
    assess('fence', RoadFenceEditIntent.ADD, oldPipe, changedPipe).errorCode,
    'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC'
  );
});
