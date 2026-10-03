import {
  clone,
  descriptorKey,
  descriptorOrder,
  fail,
  nativeDescriptor,
  normalizeGridObjects,
  positiveInteger,
  safeInteger
} from './common.js';

function sourceAccounting(objects, catalog, kind) {
  const counts = { roadCell: 0, base: 0, ext: 0, diagExt: 0 };
  let logicalQuantity = 0;
  for (const object of objects) {
    if (kind === 'road') {
      const descriptor = catalog.roadItems.get(object.itemID);
      if (!descriptor) {
        fail(
          'ROAD_SOURCE_OBJECT_FAMILY_MISMATCH',
          'owned source object is not a Road item',
          { gridObjectId: object.id }
        );
      }
      counts.roadCell += 1;
      logicalQuantity += 1;
      continue;
    }

    const descriptor = catalog.fenceItems.get(object.itemID);
    if (!descriptor) {
      fail(
        'FENCE_SOURCE_OBJECT_FAMILY_MISMATCH',
        'owned source object is not a Fence item',
        { gridObjectId: object.id }
      );
    }
    counts[descriptor.role] += 1;
    logicalQuantity += descriptor.role === 'base' ? 1 : descriptor.key;
  }
  return { counts, logicalQuantity };
}

function replacementSlot(object, role, key) {
  return JSON.stringify({
    role,
    key: key ?? null,
    x: object.x ?? object.X,
    y: object.y ?? object.Y,
    orientation: object.orientation ?? object.Orientation,
    state: object.state === undefined ? object.State ?? null : object.state
  });
}

export function reconcileNativeRepresentation({
  sourceGrid,
  sourceObjectIds,
  plannedObjects,
  kind,
  catalog
}) {
  const allObjects = normalizeGridObjects(sourceGrid);
  const allById = new Map(allObjects.map((object) => [object.id, object]));
  const ownedIds = [
    ...new Set(
      (sourceObjectIds ?? []).map((id) => safeInteger(id, 'sourceObjectId'))
    )
  ].sort((a, b) => a - b);

  const owned = ownedIds.map((id) => {
    const object = allById.get(id);
    if (!object) fail('ROADFENCE_SOURCE_OBJECT_ID_MISSING', String(id));
    return object;
  });
  const ownedSet = new Set(ownedIds);
  const accounting = sourceAccounting(owned, catalog, kind);
  const desired = plannedObjects.map(nativeDescriptor).sort(descriptorOrder);

  const desiredExactKeys = new Set();
  for (const descriptor of desired) {
    const exactKey = descriptorKey(descriptor);
    if (desiredExactKeys.has(exactKey)) {
      fail('ROADFENCE_DUPLICATE_NATIVE_DESCRIPTOR', exactKey);
    }
    desiredExactKeys.add(exactKey);

    for (const existing of allObjects) {
      if (ownedSet.has(existing.id)) continue;
      if (existing.x !== descriptor.x || existing.y !== descriptor.y) continue;
      if (
        catalog.roadItems.has(existing.itemID) ||
        catalog.fenceItems.has(existing.itemID)
      ) {
        fail(
          'ROADFENCE_UNRELATED_COORDINATE_OCCUPIED',
          'unrelated Road/Fence object occupies a planned native anchor',
          {
            gridObjectId: existing.id,
            x: descriptor.x,
            y: descriptor.y
          }
        );
      }
    }
  }

  const sourceQueues = new Map();
  for (const object of owned) {
    const key = descriptorKey(object.raw);
    const queue = sourceQueues.get(key) ?? [];
    queue.push(object);
    queue.sort((a, b) => a.id - b.id);
    sourceQueues.set(key, queue);
  }

  const matchedIds = new Set();
  const preserved = [];
  const pending = [];
  for (const descriptor of desired) {
    const queue = sourceQueues.get(descriptorKey(descriptor)) ?? [];
    const match = queue.find((object) => !matchedIds.has(object.id));
    if (!match) {
      pending.push(descriptor);
      continue;
    }
    matchedIds.add(match.id);
    preserved.push({
      gridObjectId: match.id,
      descriptor,
      sourceObject: clone(match.raw)
    });
  }

  const deletedSourceObjects = owned.filter(
    (object) => !matchedIds.has(object.id)
  );
  for (const object of deletedSourceObjects) {
    const known = new Set([
      'ID', 'ItemID', 'X', 'Y', 'Orientation', 'State'
    ]);
    const unknownFields = Object.keys(object.raw).filter(
      (field) => !known.has(field)
    );
    if (unknownFields.length) {
      fail(
        'ROADFENCE_SOURCE_OBJECT_UNKNOWN_FIELD_REPLACEMENT_UNSUPPORTED',
        'owned Road/Fence object with unknown fields cannot be deleted or replaced',
        { gridObjectId: object.id, unknownFields }
      );
    }
  }

  const deleted = deletedSourceObjects
    .map((object) => {
      const fenceDescriptor = catalog.fenceItems.get(object.itemID);
      return {
        gridObjectId: object.id,
        role:
          kind === 'road'
            ? 'roadCell'
            : fenceDescriptor?.role ?? 'unknown',
        key: fenceDescriptor?.key ?? null,
        sourceObject: clone(object.raw),
        descriptor: {
          itemID: object.itemID,
          x: object.x,
          y: object.y,
          orientation: object.orientation,
          state: clone(object.state)
        }
      };
    });

  const nextBefore = positiveInteger(
    sourceGrid.NextGridObjectID,
    'NextGridObjectID'
  );
  const existingIds = new Set(allObjects.map((object) => object.id));
  const maximumExistingId = allObjects.length
    ? Math.max(...allObjects.map((object) => object.id))
    : 0;
  if (nextBefore <= maximumExistingId) {
    fail(
      'GRIDOBJECT_ID_ALLOCATION_INVALID',
      'NextGridObjectID must be greater than every existing GridObject ID',
      { nextGridObjectID: nextBefore, maximumExistingId }
    );
  }
  const nextAfter = nextBefore + pending.length;
  if (!Number.isSafeInteger(nextAfter)) {
    fail('GRIDOBJECT_ID_ALLOCATION_INVALID', String(nextAfter));
  }
  const created = pending.map((descriptor, index) => {
    const id = nextBefore + index;
    if (!Number.isSafeInteger(id) || existingIds.has(id)) {
      fail('GRIDOBJECT_ID_ALLOCATION_INVALID', String(id));
    }
    return {
      gridObjectId: id,
      descriptor,
      object: {
        ID: id,
        ItemID: descriptor.itemID,
        X: descriptor.x,
        Y: descriptor.y,
        Orientation: descriptor.orientation,
        State: clone(descriptor.state)
      }
    };
  });

  const deletedBySlot = new Map();
  for (const entry of deleted) {
    const key = replacementSlot(
      entry.descriptor,
      entry.role,
      entry.key
    );
    const queue = deletedBySlot.get(key) ?? [];
    queue.push(entry.gridObjectId);
    deletedBySlot.set(key, queue);
  }
  const replacementIdentityPairs = [];
  for (const entry of created) {
    const key = replacementSlot(
      entry.descriptor,
      entry.descriptor.role,
      entry.descriptor.key
    );
    const candidates = deletedBySlot.get(key) ?? [];
    if (candidates.length === 1) {
      replacementIdentityPairs.push({
        deletedGridObjectId: candidates[0],
        createdGridObjectId: entry.gridObjectId
      });
    }
  }

  const representationCountsAfter = desired.reduce(
    (accumulator, descriptor) => {
      accumulator[descriptor.role] =
        (accumulator[descriptor.role] ?? 0) + 1;
      return accumulator;
    },
    { roadCell: 0, base: 0, ext: 0, diagExt: 0 }
  );

  return {
    preserved,
    deleted,
    created,
    replacementIdentityPairs,
    nextGridObjectID: {
      before: nextBefore,
      after: nextAfter
    },
    nativeObjectCount: {
      before: owned.length,
      after: desired.length
    },
    logicalQuantityBefore: accounting.logicalQuantity,
    representationCountsBefore: accounting.counts,
    representationCountsAfter
  };
}
