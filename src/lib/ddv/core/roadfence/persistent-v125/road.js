import { FenceMode, createRoadNetwork, validateRoadCells } from '../logical.js';
import { ITEM, RoadFenceWriterSupportStatus, RoadFencePersistentOperation, persistentModeState } from './constants.js';
import { canonicalJson, coordKey, fail, logicalToSave, support } from './common.js';

function connected(cells) {
  if (!cells.length) return true;
  const byCoord = new Map(cells.map((cell) => [coordKey(cell.x, cell.y), cell]));
  const seen = new Set([coordKey(cells[0].x, cells[0].y)]);
  const queue = [cells[0]];
  while (queue.length) {
    const cell = queue.shift();
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        const key = coordKey(cell.x + dx, cell.y + dy);
        if (byCoord.has(key) && !seen.has(key)) {
          seen.add(key);
          queue.push(byCoord.get(key));
        }
      }
    }
  }
  return seen.size === cells.length;
}

function normalized(cells) {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells
    .map((cell) => String(cell.x - minX) + ',' + String(cell.y - minY) + ',' + cell.mode)
    .sort();
}

function isDenseDiagonal2x2(cells) {
  return (
    cells.length === 4 &&
    cells.every((cell) => cell.mode === FenceMode.DIAGONAL) &&
    canonicalJson(normalized(cells)) === canonicalJson([
      '0,0,diagonal',
      '0,1,diagonal',
      '1,0,diagonal',
      '1,1,diagonal'
    ])
  );
}

function isConfirmedPositiveMixedQ5(cells) {
  return cells.length === 5 && canonicalJson(normalized(cells)) === canonicalJson([
    '0,0,orthogonal',
    '1,0,diagonal',
    '1,1,diagonal',
    '2,0,diagonal',
    '2,1,diagonal'
  ]);
}

function isOrthogonal3x3(cells) {
  if (cells.length !== 9 || !cells.every((cell) => cell.mode === FenceMode.ORTHOGONAL)) return false;
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const actual = cells.map((cell) => String(cell.x - minX) + ',' + String(cell.y - minY)).sort();
  const expected = [];
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) expected.push(String(x) + ',' + String(y));
  }
  return canonicalJson(actual) === canonicalJson(expected.sort());
}

export function normalizeRoadNetwork(input) {
  const created = createRoadNetwork(input ?? {});
  if (!created.ok) fail('ROAD_CELL_VALIDATION_FAILED', 'Road network invalid', { errors: created.errors });
  return created.network;
}

export function classifyRoadWriterSupport(network, operation, sourceObjectIds = []) {
  const cells = network.cells ?? [];
  const validation = validateRoadCells(cells);
  if (!validation.ok) {
    return support(RoadFenceWriterSupportStatus.UNSUPPORTED, 'ROAD_CELL_VALIDATION_FAILED');
  }
  if (!connected(cells) && cells.length) {
    return support(RoadFenceWriterSupportStatus.UNSUPPORTED, 'ROAD_MULTI_COMPONENT_SCOPE_UNSUPPORTED_V1');
  }

  if (network.familyBaseItemID === ITEM.MAIN_STREET) {
    if (cells.every((cell) => cell.mode === FenceMode.ORTHOGONAL)) {
      return support(
        RoadFenceWriterSupportStatus.ROAD_CONFIRMED_WRITABLE,
        'ROAD_ORTHOGONAL_CELL_GRAPH_CONFIRMED',
        ['DW-R01', 'ROAD-COMP-01', 'ROAD-COMP-02', 'STEAM-COMPOSITE-BATCH-C']
      );
    }
    if (isDenseDiagonal2x2(cells)) {
      return support(
        RoadFenceWriterSupportStatus.ROAD_CONFIRMED_WRITABLE,
        'ROAD_DIAGONAL_QUANTUM_CONFIRMED',
        ['DW-R02', 'S-R02']
      );
    }
    if (isConfirmedPositiveMixedQ5(cells)) {
      return support(
        RoadFenceWriterSupportStatus.ROAD_CONFIRMED_WRITABLE,
        'ROAD_POSITIVE_MIXED_Q5_CONFIRMED',
        ['ROAD-RM01', 'S-R03']
      );
    }
    return support(
      RoadFenceWriterSupportStatus.RUNTIME_REQUIRED,
      'ROAD_MODE_OR_ORIENTATION_NOT_RUNTIME_PROMOTED',
      ['ROAD-RM01_PROMOTION_BOUNDARY']
    );
  }

  if (
    network.familyBaseItemID === ITEM.PATH_GOLD &&
    operation === RoadFencePersistentOperation.ROAD_SAME_FAMILY_MERGE &&
    sourceObjectIds.length > 0 &&
    isOrthogonal3x3(cells)
  ) {
    return support(
      RoadFenceWriterSupportStatus.ROAD_CONFIRMED_WRITABLE,
      'ROAD_NATIVE_SEED_MERGE_Q9_CONFIRMED',
      ['ROAD-COMP-03']
    );
  }

  return support(
    RoadFenceWriterSupportStatus.RUNTIME_REQUIRED,
    'ROAD_FAMILY_STRUCTURAL_WRITE_NOT_RUNTIME_PROMOTED'
  );
}

export function planRoadNativeV125(network, transform) {
  const validation = validateRoadCells(network.cells ?? []);
  if (!validation.ok) fail('ROAD_CELL_VALIDATION_FAILED', 'Road cells invalid', { errors: validation.errors });
  return {
    kind: 'road',
    familyBaseItemID: network.familyBaseItemID,
    logicalQuantity: network.cells.length,
    objects: [...network.cells]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((cell) => {
        if (![FenceMode.ORTHOGONAL, FenceMode.DIAGONAL].includes(cell.mode)) {
          fail('ROAD_MODE_STATE_UNSUPPORTED');
        }
        const save = logicalToSave(cell, transform);
        return {
          role: 'roadCell',
          itemID: network.familyBaseItemID,
          logical: { x: cell.x, y: cell.y },
          x: save.x,
          y: save.y,
          orientation: 'GridOrientation_Down',
          state: persistentModeState(cell.mode)
        };
      })
  };
}
