import { ROADFENCE_NATIVE_CATALOG_SWITCH_V125 } from './catalog-v125-switch.js';
import {
  FenceRepresentationPolicy,
  RoadFencePersistentOperation,
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

    checkRoadSourceFamily(sourceNetwork, network, operation);
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

    if (
      REPRESENTATION_ONLY_FENCE_OPS.has(operation) &&
      representationLayout == null
    ) {
      fail('FENCE_REPRESENTATION_LAYOUT_REQUIRED');
    }
    checkFenceRepresentationTopology(
      sourceNetwork,
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
        ? sourceNetwork?.familyBaseItemID
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
      { operation, sourceNetwork }
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
