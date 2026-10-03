import { ROADFENCE_NATIVE_CATALOG_SWITCH_V125 } from '../catalog-v125-switch.js';
import {
  FenceRepresentationPolicy,
  RoadFencePersistentOperation,
  RoadFenceWriterSupportStatus,
  REPRESENTATION_ONLY_FENCE_OPS
} from './constants.js';
import {
  normalizeBuildIdentity,
  normalizeCatalog,
  normalizeTransform,
  requireWritableSupport,
  topologyFingerprintIgnoringFamily,
  fail
} from './common.js';
import {
  classifyRoadWriterSupport,
  normalizeRoadNetwork,
  planRoadNativeV125
} from './road.js';
import {
  normalizeFenceNetwork,
  planFenceNativeV125,
  requireFenceTessellationFactor
} from './fence-layout.js';
import { classifyFenceWriterSupport } from './fence-support.js';
import { reconcileNativeRepresentation } from './reconcile.js';
import {
  buildCompilerResult,
  compilerFailure
} from './result-core.js';
import {
  compilerMetadataV125,
  structuralTransactionExtensionRequestV125
} from './metadata.js';

export {
  FenceRepresentationPolicy,
  RoadFencePersistentOperation,
  RoadFenceWriterSupportStatus
};

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

    const planned = planRoadNativeV125(
      network,
      normalizeTransform(transform)
    );
    const reconciliation = reconcileNativeRepresentation({
      sourceGrid,
      sourceObjectIds,
      plannedObjects: planned.objects,
      kind: 'road',
      catalog: catalogMaps
    });

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

    const planned = planFenceNativeV125({
      network,
      representationLayout,
      family,
      transform: normalizeTransform(transform),
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
