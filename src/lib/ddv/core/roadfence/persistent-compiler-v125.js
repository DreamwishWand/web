import { ROADFENCE_NATIVE_CATALOG_SWITCH_V125 } from './catalog-v125-switch.js';
import {
  FenceRepresentationPolicy,
  RoadFencePersistentOperation,
  FENCE_GENERATED_LAYOUT_REQUEST_CONTRACT,
  RoadFenceWriterSupportStatus,
  REPRESENTATION_ONLY_FENCE_OPS
} from './persistent-v125/constants.js';
import {
  normalizeBuildIdentity,
  normalizeCatalog,
  normalizeGridObjects,
  normalizeTransform,
  positiveInteger,
  requireWritableSupport,
  topologyFingerprintIgnoringFamily,
  support,
  fail
} from './persistent-v125/common.js';
import {
  classifyRoadWriterSupport,
  normalizeRoadNetwork,
  planRoadNativeV125
} from './persistent-v125/road.js';
import {
  normalizeFenceNetwork,
  planFenceNativeV125,
  requireFenceTessellationFactor
} from './persistent-v125/fence-layout.js';
import { classifyFenceWriterSupport } from './persistent-v125/fence-support.js';
import { reconcileNativeRepresentation } from './persistent-v125/reconcile.js';
import {
  buildCompilerResult,
  compilerFailure
} from './persistent-v125/result-core.js';
import {
  compilerMetadataV125,
  structuralTransactionExtensionRequestV125
} from './persistent-v125/metadata.js';

export {
  FENCE_GENERATED_LAYOUT_REQUEST_CONTRACT,
  FenceRepresentationPolicy,
  RoadFencePersistentOperation,
  RoadFenceWriterSupportStatus
};


function requireCompilerTransformQuantum(sourceGrid, transform, kind) {
  const tessellationFactor = positiveInteger(
    sourceGrid?.TessellationFactor,
    'TessellationFactor'
  );
  const expectedPitch =
    kind === 'road' ? tessellationFactor * 2 : tessellationFactor;
  if (
    transform.pitchX !== expectedPitch ||
    transform.pitchY !== expectedPitch
  ) {
    fail('ROADFENCE_INVALID_GRID_QUANTUM', undefined, {
      kind,
      expectedPitch,
      pitchX: transform.pitchX,
      pitchY: transform.pitchY
    });
  }
}

function requireOwnedSourceFamily({
  sourceGrid,
  sourceObjectIds,
  kind,
  catalogMaps,
  expectedFamilyBaseItemID
}) {
  if (!(sourceObjectIds ?? []).length) return;
  const byId = new Map(
    normalizeGridObjects(sourceGrid).map((object) => [object.id, object])
  );
  for (const rawId of sourceObjectIds) {
    const id = Number(rawId);
    const object = byId.get(id);
    if (!object) fail('ROADFENCE_SOURCE_OBJECT_ID_MISSING', String(id));
    const descriptor =
      kind === 'road'
        ? catalogMaps.roadItems.get(object.itemID)
        : catalogMaps.fenceItems.get(object.itemID);
    if (!descriptor) {
      fail(
        kind === 'road'
          ? 'ROAD_SOURCE_OBJECT_FAMILY_MISMATCH'
          : 'FENCE_SOURCE_OBJECT_FAMILY_MISMATCH',
        String(id)
      );
    }
    if (descriptor.familyBaseItemID !== expectedFamilyBaseItemID) {
      fail(
        kind === 'road'
          ? 'ROAD_SOURCE_OBJECT_FAMILY_MISMATCH'
          : 'FENCE_SOURCE_OBJECT_FAMILY_MISMATCH',
        String(id),
        {
          expectedFamilyBaseItemID,
          actualFamilyBaseItemID: descriptor.familyBaseItemID
        }
      );
    }
  }
}

function checkRoadSourceFamily(sourceNetwork, desiredNetwork, operation) {
  if (!sourceNetwork) return;
  if (
    operation === RoadFencePersistentOperation.ROAD_SAME_FAMILY_MERGE &&
    sourceNetwork.familyBaseItemID !== desiredNetwork.familyBaseItemID
  ) {
    fail('ROAD_SAME_FAMILY_MERGE_FAMILY_MISMATCH');
  }
}

function checkFenceRepresentationTopology(
  sourceNetwork,
  desiredNetwork,
  operation
) {
  if (!REPRESENTATION_ONLY_FENCE_OPS.has(operation)) return;
  if (!sourceNetwork) {
    fail('FENCE_REPRESENTATION_EDIT_SOURCE_TOPOLOGY_REQUIRED');
  }
  if (sourceNetwork.familyBaseItemID !== desiredNetwork.familyBaseItemID) {
    fail('FENCE_REPRESENTATION_EDIT_FAMILY_CHANGED');
  }
  if (
    topologyFingerprintIgnoringFamily(sourceNetwork) !==
    topologyFingerprintIgnoringFamily(desiredNetwork)
  ) {
    fail('FENCE_POST_LAYOUT_TOPOLOGY_CHANGED');
  }
}

export function compileRoadMutationV125({
  buildIdentity,
  sourceGrid,
  sourceObjectIds = [],
  sourceNetwork = null,
  desiredNetwork,
  operation = RoadFencePersistentOperation.ROAD_SET_TOPOLOGY,
  transform,
  targetSurfaceValidated = false,
  catalog = ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} = {}) {
  try {
    const build = normalizeBuildIdentity(buildIdentity);
    if (!targetSurfaceValidated) fail('TARGET_SURFACE_UNVERIFIED');

    const catalogMaps = normalizeCatalog(catalog);
    const network = normalizeRoadNetwork(desiredNetwork);
    if (!catalogMaps.roadItems.has(network.familyBaseItemID)) {
      fail('UNKNOWN_ROADFENCE_FAMILY');
    }

    const normalizedSourceNetwork = sourceNetwork == null
      ? null
      : normalizeRoadNetwork(sourceNetwork);
    checkRoadSourceFamily(
      normalizedSourceNetwork,
      network,
      operation
    );
    const support = classifyRoadWriterSupport(
      network,
      operation,
      sourceObjectIds
    );
    requireWritableSupport(support);

    const normalizedTransform = normalizeTransform(transform);
    requireCompilerTransformQuantum(
      sourceGrid,
      normalizedTransform,
      'road'
    );
    requireOwnedSourceFamily({
      sourceGrid,
      sourceObjectIds,
      kind: 'road',
      catalogMaps,
      expectedFamilyBaseItemID: network.familyBaseItemID
    });

    const planned = planRoadNativeV125(
      network,
      normalizedTransform
    );
    const reconciliation = reconcileNativeRepresentation({
      sourceGrid,
      sourceObjectIds,
      plannedObjects: planned.objects,
      kind: 'road',
      catalog: catalogMaps
    });
    if (
      operation === RoadFencePersistentOperation.ROAD_SAME_FAMILY_MERGE &&
      reconciliation.preserved.length === 0
    ) {
      fail('ROAD_NATIVE_SEED_NOT_PRESERVED');
    }

    return {
      ok: true,
      ...buildCompilerResult({
        kind: 'road',
        sourceGrid,
        sourceObjectIds,
        desiredNetwork: network,
        representationLayout: null,
        planned,
        supportResult: support,
        reconciliation,
        operation,
        buildIdentity: build
      })
    };
  } catch (error) {
    return compilerFailure(error);
  }
}

export function compileFenceMutationV125({
  buildIdentity,
  sourceGrid,
  sourceObjectIds = [],
  sourceNetwork = null,
  desiredNetwork,
  representationLayout = null,
  operation = RoadFencePersistentOperation.FENCE_SET_TOPOLOGY,
  transform,
  targetSurfaceValidated = false,
  catalog = ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} = {}) {
  try {
    const build = normalizeBuildIdentity(buildIdentity);
    if (!targetSurfaceValidated) fail('TARGET_SURFACE_UNVERIFIED');

    const catalogMaps = normalizeCatalog(catalog);
    const network = normalizeFenceNetwork(desiredNetwork);
    const family = catalogMaps.fenceFamilies.get(
      network.familyBaseItemID
    );
    if (!family) fail('UNKNOWN_ROADFENCE_FAMILY');

    const normalizedSourceNetwork = sourceNetwork == null
      ? null
      : normalizeFenceNetwork(sourceNetwork);

    if (representationLayout == null) {
      fail('FENCE_REPRESENTATION_LAYOUT_REQUIRED');
    }
    checkFenceRepresentationTopology(
      normalizedSourceNetwork,
      network,
      operation
    );

    const normalizedTransform = normalizeTransform(transform);
    requireCompilerTransformQuantum(
      sourceGrid,
      normalizedTransform,
      'fence'
    );
    const expectedSourceFamilyBaseItemID =
      operation === RoadFencePersistentOperation.FENCE_STYLE_REPLACE
        ? normalizedSourceNetwork?.familyBaseItemID
        : network.familyBaseItemID;
    if (
      (sourceObjectIds ?? []).length &&
      !Number.isInteger(expectedSourceFamilyBaseItemID)
    ) {
      fail('FENCE_SOURCE_TOPOLOGY_REQUIRED');
    }
    requireOwnedSourceFamily({
      sourceGrid,
      sourceObjectIds,
      kind: 'fence',
      catalogMaps,
      expectedFamilyBaseItemID: expectedSourceFamilyBaseItemID
    });

    const planned = planFenceNativeV125({
      network,
      representationLayout,
      family,
      transform: normalizedTransform,
      tessellationFactor:
        requireFenceTessellationFactor(sourceGrid)
    });

    const support = classifyFenceWriterSupport(
      network,
      planned,
      { operation, sourceNetwork: normalizedSourceNetwork }
    );
    requireWritableSupport(support);

    const reconciliation = reconcileNativeRepresentation({
      sourceGrid,
      sourceObjectIds,
      plannedObjects: planned.objects,
      kind: 'fence',
      catalog: catalogMaps
    });

    return {
      ok: true,
      ...buildCompilerResult({
        kind: 'fence',
        sourceGrid,
        sourceObjectIds,
        desiredNetwork: network,
        representationLayout: planned.representationLayout,
        planned,
        supportResult: support,
        reconciliation,
        operation,
        buildIdentity: build
      })
    };
  } catch (error) {
    return compilerFailure(error);
  }
}

export function roadFenceStructuralTransactionExtensionRequestV125() {
  return structuralTransactionExtensionRequestV125();
}

export function roadFencePersistentCompilerMetadataV125() {
  return compilerMetadataV125();
}


function plannedBaseAtLogical(component, side) {
  const x = Number(side?.x);
  const y = Number(side?.y);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return false;
  return component.planned.objects.some((object) =>
    object.role === 'base' &&
    String(object.logicalNodeId ?? '') !== '' &&
    component.network.graph.nodes.some((node) =>
      String(node.id) === String(object.logicalNodeId) &&
      Number(node.x) === x &&
      Number(node.y) === y
    )
  );
}

function exactFm01BoundaryBatch(components, modeBoundaryTouches) {
  if (components.length !== 2 || modeBoundaryTouches.length !== 1) {
    return false;
  }
  const touch = modeBoundaryTouches[0];
  if (
    touch?.classification !== 'geometric-cross-mode-touch' ||
    touch?.authoritativeConnectedEdge !== false
  ) {
    return false;
  }

  const ax = Number(touch?.a?.x);
  const ay = Number(touch?.a?.y);
  const bx = Number(touch?.b?.x);
  const by = Number(touch?.b?.y);
  if (
    ![ax, ay, bx, by].every(Number.isSafeInteger) ||
    Math.abs(ax - bx) !== 1 ||
    Math.abs(ay - by) !== 1
  ) {
    return false;
  }

  const byId = new Map(
    components.map((component) => [
      String(component.networkId),
      component
    ])
  );
  const a = byId.get(String(touch?.a?.networkId ?? ''));
  const b = byId.get(String(touch?.b?.networkId ?? ''));
  if (!a || !b || a === b) return false;
  if (
    Number(touch.familyBaseItemID) !== 40700246 ||
    Number(a.network.familyBaseItemID) !== 40700246 ||
    Number(b.network.familyBaseItemID) !== 40700246
  ) {
    return false;
  }

  const modeOf = (component) => {
    const modes = [
      ...new Set(
        component.network.graph.nodes.map((node) =>
          String(node.mode ?? '')
        )
      )
    ];
    return modes.length === 1 ? modes[0] : null;
  };
  const orthogonal = [a, b].find(
    (component) => modeOf(component) === 'orthogonal'
  );
  const diagonal = [a, b].find(
    (component) => modeOf(component) === 'diagonal'
  );
  if (!orthogonal || !diagonal) return false;
  if (
    orthogonal.network.graph.nodes.length !== 3 ||
    diagonal.network.graph.nodes.length !== 1 ||
    orthogonal.network.graph.edges.length !== 2 ||
    diagonal.network.graph.edges.length !== 0
  ) {
    return false;
  }

  const orthSide =
    String(touch.a.networkId) === String(orthogonal.networkId)
      ? touch.a
      : touch.b;
  const diagSide =
    String(touch.a.networkId) === String(diagonal.networkId)
      ? touch.a
      : touch.b;
  return (
    plannedBaseAtLogical(orthogonal, orthSide) &&
    plannedBaseAtLogical(diagonal, diagSide)
  );
}

function compileFenceComponentV125({
  raw,
  sourceGrid,
  catalogMaps
}) {
  const operation = String(
    raw.operation ??
      RoadFencePersistentOperation.FENCE_SET_TOPOLOGY
  );
  const networkId = String(
    raw.desiredNetwork?.networkId ??
      raw.networkId ??
      ''
  );
  if (!networkId) fail('FENCE_BATCH_NETWORK_ID_REQUIRED');

  const network = normalizeFenceNetwork(raw.desiredNetwork);
  const family = catalogMaps.fenceFamilies.get(
    network.familyBaseItemID
  );
  if (!family) fail('UNKNOWN_ROADFENCE_FAMILY');

  const sourceNetwork =
    raw.sourceNetwork == null
      ? null
      : normalizeFenceNetwork(raw.sourceNetwork);
  checkFenceRepresentationTopology(
    sourceNetwork,
    network,
    operation
  );

  const normalizedTransform = normalizeTransform(raw.transform);
  requireCompilerTransformQuantum(
    sourceGrid,
    normalizedTransform,
    'fence'
  );

  const expectedSourceFamilyBaseItemID =
    operation === RoadFencePersistentOperation.FENCE_STYLE_REPLACE
      ? sourceNetwork?.familyBaseItemID
      : network.familyBaseItemID;
  if (
    (raw.sourceObjectIds ?? []).length &&
    !Number.isInteger(expectedSourceFamilyBaseItemID)
  ) {
    fail('FENCE_SOURCE_TOPOLOGY_REQUIRED');
  }
  requireOwnedSourceFamily({
    sourceGrid,
    sourceObjectIds: raw.sourceObjectIds ?? [],
    kind: 'fence',
    catalogMaps,
    expectedFamilyBaseItemID: expectedSourceFamilyBaseItemID
  });

  if (raw.representationLayout == null) {
    fail('FENCE_REPRESENTATION_LAYOUT_REQUIRED');
  }
  const planned = planFenceNativeV125({
    network,
    representationLayout: raw.representationLayout,
    family,
    transform: normalizedTransform,
    tessellationFactor:
      requireFenceTessellationFactor(sourceGrid)
  });
  const supportResult = classifyFenceWriterSupport(
    network,
    planned,
    { operation, sourceNetwork }
  );
  requireWritableSupport(supportResult);

  return {
    networkId,
    network,
    sourceNetwork,
    sourceObjectIds: [...(raw.sourceObjectIds ?? [])],
    representationLayout: planned.representationLayout,
    planned,
    supportResult,
    operation
  };
}

export function compileFenceNetworkBatchV125({
  buildIdentity,
  sourceGrid,
  components = [],
  modeBoundaryTouches = [],
  targetSurfaceValidated = false,
  catalog = ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} = {}) {
  try {
    const build = normalizeBuildIdentity(buildIdentity);
    if (!targetSurfaceValidated) fail('TARGET_SURFACE_UNVERIFIED');
    if (!Array.isArray(components) || components.length === 0) {
      fail('FENCE_BATCH_COMPONENT_REQUIRED');
    }

    const catalogMaps = normalizeCatalog(catalog);
    const compiled = components.map((raw) =>
      compileFenceComponentV125({
        raw,
        sourceGrid,
        catalogMaps
      })
    );

    const networkIds = compiled.map((entry) => entry.networkId);
    if (new Set(networkIds).size !== networkIds.length) {
      fail('FENCE_BATCH_NETWORK_ID_DUPLICATE');
    }

    const sourceObjectIds = compiled.flatMap(
      (entry) => entry.sourceObjectIds
    );
    if (
      new Set(sourceObjectIds.map(Number)).size !==
      sourceObjectIds.length
    ) {
      fail('FENCE_BATCH_SOURCE_OBJECT_ID_OVERLAP');
    }

    if (
      modeBoundaryTouches.length > 0 &&
      !exactFm01BoundaryBatch(compiled, modeBoundaryTouches)
    ) {
      fail(
        'ROADFENCE_RUNTIME_EVIDENCE_REQUIRED',
        'mode-boundary batch is outside the promoted FM01 class',
        {
          support: support(
            RoadFenceWriterSupportStatus.RUNTIME_REQUIRED,
            'FENCE_MODE_BOUNDARY_BATCH_NOT_RUNTIME_PROMOTED'
          )
        }
      );
    }

    const planned = {
      kind: 'fence',
      familyBaseItemID: null,
      logicalQuantity: compiled.reduce(
        (sum, entry) =>
          sum + Number(entry.planned.logicalQuantity),
        0
      ),
      nativeObjectCount: compiled.reduce(
        (sum, entry) =>
          sum + Number(entry.planned.nativeObjectCount),
        0
      ),
      objects: compiled.flatMap(
        (entry) => entry.planned.objects
      ),
      representationLayout: compiled.map(
        (entry) => entry.representationLayout
      ),
      compiled: {
        batch: true,
        modeBoundaryTouches: structuredClone(
          modeBoundaryTouches
        )
      }
    };

    const reconciliation = reconcileNativeRepresentation({
      sourceGrid,
      sourceObjectIds,
      plannedObjects: planned.objects,
      kind: 'fence',
      catalog: catalogMaps
    });
    const evidence = [
      ...new Set(
        compiled.flatMap(
          (entry) => entry.supportResult.evidence ?? []
        )
      )
    ];
    if (modeBoundaryTouches.length) evidence.push('DW-FM01');
    const supportResult = support(
      RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE,
      modeBoundaryTouches.length
        ? 'FENCE_FM01_COMPONENT_BATCH_CONFIRMED'
        : 'FENCE_COMPONENT_BATCH_ALL_CONFIRMED',
      [...new Set(evidence)]
    );

    const desiredNetwork = {
      kind: 'fence-batch',
      networks: compiled.map((entry) => ({
        networkId: entry.networkId,
        ...structuredClone(entry.network)
      })),
      modeBoundaryTouches: structuredClone(
        modeBoundaryTouches
      )
    };

    return {
      ok: true,
      ...buildCompilerResult({
        kind: 'fence',
        sourceGrid,
        sourceObjectIds,
        desiredNetwork,
        representationLayout:
          planned.representationLayout,
        planned,
        supportResult,
        reconciliation,
        operation:
          RoadFencePersistentOperation.FENCE_SET_TOPOLOGY,
        buildIdentity: build
      }),
      batch: true,
      componentCount: compiled.length
    };
  } catch (error) {
    return compilerFailure(error);
  }
}
