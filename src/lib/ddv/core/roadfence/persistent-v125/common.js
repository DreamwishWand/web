import {
  CURRENT_BID,
  CURRENT_GAME_VERSION,
  CURRENT_SCHEMA,
  CURRENT_TID,
  RoadFenceWriterSupportStatus
} from './constants.js';

export function compilerError(code, message = code, detail = {}) {
  const error = new Error(message);
  error.code = code;
  error.detail = detail;
  return error;
}

export function fail(code, message, detail = {}) {
  throw compilerError(code, message, detail);
}

export function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function safeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail('ROADFENCE_INTEGER_REQUIRED', label + ' must be a safe integer');
  return number;
}

export function positiveInteger(value, label) {
  const number = safeInteger(value, label);
  if (number <= 0) fail('ROADFENCE_POSITIVE_INTEGER_REQUIRED', label + ' must be positive');
  return number;
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!plain(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(sortDeep(value));
}

export function coordKey(x, y) {
  return String(x) + ',' + String(y);
}

export function edgeKey(a, b) {
  a = String(a);
  b = String(b);
  return a < b ? a + '::' + b : b + '::' + a;
}

export function support(status, reason, evidence = []) {
  return { status, reason, evidence: [...evidence] };
}

export function requireWritableSupport(result) {
  if (
    result.status === RoadFenceWriterSupportStatus.ROAD_CONFIRMED_WRITABLE ||
    result.status === RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE
  ) return;
  fail(
    result.status === RoadFenceWriterSupportStatus.RUNTIME_REQUIRED
      ? 'ROADFENCE_RUNTIME_EVIDENCE_REQUIRED'
      : 'ROADFENCE_SUPPORT_UNAVAILABLE',
    result.reason,
    { support: result }
  );
}

export function normalizeBuildIdentity(input = {}) {
  const result = {
    platform: String(input.platform ?? ''),
    gameVersion: String(input.gameVersion ?? ''),
    tid: String(input.tid ?? ''),
    bid: String(input.bid ?? ''),
    profileSchema: Number(input.profileSchema)
  };
  if (
    result.platform !== 'Nintendo Switch' ||
    result.gameVersion !== CURRENT_GAME_VERSION ||
    result.tid !== CURRENT_TID ||
    result.bid !== CURRENT_BID ||
    result.profileSchema !== CURRENT_SCHEMA
  ) {
    fail(
      'ROADFENCE_UNSUPPORTED_BUILD_IDENTITY',
      'exact Nintendo Switch v1.25.0 build identity required',
      result
    );
  }
  return result;
}

export function normalizeCatalog(catalog) {
  if (
    !plain(catalog) ||
    catalog.schema !== 'dreamwish-wand-roadfence-native-catalog' ||
    catalog.version !== 1 ||
    catalog.gameVersion !== CURRENT_GAME_VERSION ||
    catalog.complete !== true
  ) fail('ROADFENCE_CATALOG_CONTRACT_MISMATCH');

  const roadItems = new Map();
  for (const [itemIDText, descriptor] of Object.entries(catalog.roadItems ?? {})) {
    const itemID = positiveInteger(itemIDText, 'Road ItemID');
    roadItems.set(itemID, { ...descriptor, itemID });
  }

  const fenceItems = new Map();
  const fenceFamilies = new Map();
  for (const [itemIDText, descriptor] of Object.entries(catalog.fenceItems ?? {})) {
    const itemID = positiveInteger(itemIDText, 'Fence ItemID');
    const normalized = { ...descriptor, itemID };
    fenceItems.set(itemID, normalized);
    const family = fenceFamilies.get(normalized.familyBaseItemID) ?? {
      base: null,
      ext: new Map(),
      diagExt: new Map(),
      familyBaseItemID: normalized.familyBaseItemID,
      familyName: normalized.familyName ?? null
    };
    if (normalized.role === 'base') family.base = normalized;
    if (normalized.role === 'ext') family.ext.set(normalized.key, normalized);
    if (normalized.role === 'diagExt') family.diagExt.set(normalized.key, normalized);
    fenceFamilies.set(normalized.familyBaseItemID, family);
  }
  for (const family of fenceFamilies.values()) {
    if (!family.base) fail('FENCE_CATALOG_BASE_MISSING', String(family.familyBaseItemID));
  }
  return { roadItems, fenceItems, fenceFamilies };
}

export function normalizeTransform(input = {}) {
  if (!plain(input.originSave)) fail('ROADFENCE_ORIGIN_SAVE_REQUIRED');
  const pitchX = safeInteger(input.pitchX, 'pitchX');
  const pitchY = safeInteger(input.pitchY == null ? pitchX : input.pitchY, 'pitchY');
  if (pitchX <= 0 || pitchY <= 0) fail('ROADFENCE_INVALID_GRID_QUANTUM');
  return {
    originLogical: {
      x: safeInteger(input.originLogical?.x ?? 0, 'originLogical.x'),
      y: safeInteger(input.originLogical?.y ?? 0, 'originLogical.y')
    },
    originSave: {
      x: safeInteger(input.originSave.x, 'originSave.x'),
      y: safeInteger(input.originSave.y, 'originSave.y')
    },
    pitchX,
    pitchY
  };
}

export function logicalToSave(point, transform) {
  return {
    x: transform.originSave.x + (point.x - transform.originLogical.x) * transform.pitchX,
    y: transform.originSave.y + (point.y - transform.originLogical.y) * transform.pitchY
  };
}

export function normalizeGridObjects(grid) {
  if (!plain(grid) || !plain(grid.Objects)) {
    fail('ROADFENCE_SOURCE_GRID_OBJECT_MAP_REQUIRED');
  }
  const seenIds = new Set();
  return Object.entries(grid.Objects).map(([mapKey, object]) => {
    if (!plain(object)) fail('ROADFENCE_SOURCE_GRID_OBJECT_INVALID', mapKey);
    const mapId = safeInteger(mapKey, 'GridObject map key');
    const id = safeInteger(object.ID, 'GridObject.ID');
    if (mapId !== id) {
      fail('ROADFENCE_SOURCE_OBJECT_MAP_KEY_MISMATCH', mapKey, {
        mapKey: mapId,
        objectId: id
      });
    }
    if (seenIds.has(id)) {
      fail('ROADFENCE_SOURCE_OBJECT_ID_DUPLICATE', String(id));
    }
    seenIds.add(id);
    return {
      raw: object,
      id,
      itemID: positiveInteger(object.ItemID, 'GridObject.ItemID'),
      x: safeInteger(object.X, 'GridObject.X'),
      y: safeInteger(object.Y, 'GridObject.Y'),
      orientation: String(object.Orientation ?? ''),
      state: object.State ?? null
    };
  });
}

export function nativeDescriptor(object) {
  return {
    role: object.role,
    ...(object.key == null ? {} : { key: object.key }),
    ...(object.logical ? { logical: clone(object.logical) } : {}),
    ...(object.logicalNodeId ? { logicalNodeId: object.logicalNodeId } : {}),
    ...(object.fromNodeId ? { fromNodeId: object.fromNodeId } : {}),
    ...(object.toNodeId ? { toNodeId: object.toNodeId } : {}),
    itemID: positiveInteger(object.itemID, 'planned ItemID'),
    x: safeInteger(object.x, 'planned X'),
    y: safeInteger(object.y, 'planned Y'),
    orientation: String(object.orientation),
    state: clone(object.state ?? null)
  };
}

export function descriptorKey(object) {
  return canonicalJson({
    ItemID: object.ItemID ?? object.itemID,
    X: object.X ?? object.x,
    Y: object.Y ?? object.y,
    Orientation: object.Orientation ?? object.orientation,
    State: object.State === undefined ? object.state ?? null : object.State
  });
}

export function descriptorOrder(a, b) {
  const roleOrder = { roadCell: 0, base: 1, ext: 2, diagExt: 3 };
  return (
    a.y - b.y ||
    a.x - b.x ||
    (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) ||
    a.itemID - b.itemID ||
    String(a.orientation).localeCompare(String(b.orientation)) ||
    canonicalJson(a.state).localeCompare(canonicalJson(b.state))
  );
}

export function topologyFingerprintIgnoringFamily(network) {
  if (network.kind === 'road') {
    return canonicalJson({
      kind: 'road',
      cells: [...(network.cells ?? [])]
        .map((cell) => ({ x: cell.x, y: cell.y, mode: cell.mode }))
        .sort((a, b) => a.y - b.y || a.x - b.x || String(a.mode).localeCompare(String(b.mode)))
    });
  }
  return canonicalJson({
    kind: 'fence',
    nodes: [...(network.graph?.nodes ?? [])]
      .map((node) => ({ id: String(node.id), x: node.x, y: node.y, mode: node.mode }))
      .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)),
    edges: [...(network.graph?.edges ?? [])].map((item) => edgeKey(item.a, item.b)).sort()
  });
}
