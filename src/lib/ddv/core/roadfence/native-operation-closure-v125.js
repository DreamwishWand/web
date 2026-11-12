/**
 * 01C CORE — read-only Native dependency closure contract for Switch v1.25.0.
 * This is a checklist derived from validated logical intent, NOT a Native V3
 * trace, source Save witness, compiler execution, inventory mutation or Writer.
 * 01E collects same-build executable Consumer/Producer/recompute evidence.
 */
import {
  assessRoadFenceEditIntentV125,
  ROADFENCE_OPERATION_INTENT_CONTRACT,
  RoadFenceEditIntent
} from './operation-intent-v125.js';

export const ROADFENCE_NATIVE_OPERATION_CLOSURE_CONTRACT =
  'ddv.roadfence-native-operation-closure@1';

const COMMON = Object.freeze([
  'CORE_ATTESTED_EXACT_BUILD_AND_SOURCE_SHA',
  'SINGLE_PRODUCT_SESSION_TYPED_GRID_SOURCE_AND_REVISION_CAS',
  '01B_BOUNDS_FOOTPRINT_PARENT_AND_COLLISION',
  '01C_CANONICAL_COMPILER_SUPPORT_AND_NATIVE_DESCRIPTOR_DIFF',
  '01E_SAME_BUILD_NATIVE_CONSUMER_INPUT_CALLGRAPH',
  '01E_SAME_BUILD_NATIVE_PRODUCER_OUTPUT_CALLGRAPH',
  '01E_DEPENDENT_RECALC_NEGATIVE_BRANCH_CLOSURE',
  '01A_ATOMIC_EXACT_DIFF_UNDO_BACKUP_EDITED_COPY_INDEPENDENT_REOPEN',
  '05QR_INDEPENDENT_OPERATION_SCOPE_AND_00CTRL_WRITE_GATE'
]);

const KIND = Object.freeze({
  road: Object.freeze([
    'ROAD_NEIGHBOR_ADJACENCY_AND_MODE_RECOMPILE',
    'ROAD_CELL_ORIENTATION_AND_VARIATION',
    'ROAD_GRID_OBJECT_ALLOCATION_AND_PRESERVED_IDENTITIES'
  ]),
  fence: Object.freeze([
    'FENCE_BASE_EXT_DIAGEXT_CANONICAL_RECOMPILE',
    'FENCE_POST_LAYOUT_PRESERVE_EXISTING_AND_ANCHOR_BOUNDARY',
    'FENCE_VARIATION_AND_EXTENSION_KEY',
    'FENCE_GRID_OBJECT_ALLOCATION_AND_PRESERVED_IDENTITIES'
  ])
});

const OP = Object.freeze({
  [RoadFenceEditIntent.ADD]: Object.freeze([
    'SOURCE_AND_DESTINATION_COMPONENT_EXTENT',
    'NATIVE_PLACEMENT_AND_NEIGHBOR_RECOMPILE',
    'NATIVE_QUANTITY_DEBIT_OR_NO_DEBIT_PROOF'
  ]),
  [RoadFenceEditIntent.MOVE]: Object.freeze([
    'EXACT_OLD_NEW_POSITION_AND_NATIVE_ORIENTATION',
    'SOURCE_AND_DESTINATION_NEIGHBOR_RECOMPILE',
    'MOVE_COST_OR_NO_COST_NATIVE_PROOF'
  ]),
  [RoadFenceEditIntent.ROTATE]: Object.freeze([
    'EXACT_ROTATED_FOOTPRINT_AND_ORIENTATION',
    'ROTATED_NEIGHBOR_MODE_AND_VARIATION',
    'ROTATION_COST_OR_NO_COST_NATIVE_PROOF'
  ]),
  [RoadFenceEditIntent.ERASE]: Object.freeze([
    'FULL_AFFECTED_COMPONENT_AND_ID_DELETION',
    'NATIVE_NEIGHBOR_RECOMPILE_AFTER_ERASE',
    'NATIVE_QUANTITY_REFUND_OR_NO_REFUND_PROOF'
  ]),
  [RoadFenceEditIntent.CONNECT]: Object.freeze([
    'BOTH_OLD_COMPONENTS_AND_NEW_MERGED_COMPONENT',
    'NATIVE_NEW_EDGE_OR_CELL_REPRESENTATION',
    'NATIVE_MERGE_VARIATION_QUANTITY_COST_PROOF'
  ]),
  [RoadFenceEditIntent.DISCONNECT]: Object.freeze([
    'OLD_COMPONENT_AND_ALL_SPLIT_COMPONENTS',
    'NATIVE_EDGE_OR_CELL_REMOVAL_RECOMPILE',
    'NATIVE_SPLIT_VARIATION_QUANTITY_REFUND_PROOF'
  ]),
  [RoadFenceEditIntent.RECOMPILE]: Object.freeze([
    'UNCHANGED_LOGICAL_TOPOLOGY_AND_UNCHANGED_FAMILY',
    'EXACT_NATIVE_BEFORE_AFTER_DESCRIPTOR_COMPARISON',
    'NATIVE_RECOMPILE_TRIGGER_IDEMPOTENCE_AND_SIDE_EFFECTS'
  ])
});

function deny(code, kind = null, intent = null) {
  return Object.freeze({
    contract: ROADFENCE_NATIVE_OPERATION_CLOSURE_CONTRACT,
    status: 'FAIL_CLOSED',
    kind, intent, errorCode: code,
    readOnly: true,
    nativeConsumerAccepted: false,
    nativeProducerAccepted: false,
    nativeV3Accepted: false,
    productWriterAuthorized: false,
    productApplyAuthorized: false,
    productEditedCopyAuthorized: false
  });
}

/**
 * Produces operation-specific requirements only from 01C's canonical intent.
 * Every input remains untrusted until 01A's Core-minted source and independent
 * Native evidence are verified. Caller-supplied proof flags are ignored.
 */
export function assessRoadFenceNativeRequirementsV125(input = {}) {
  try {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return deny('ROADFENCE_NATIVE_INPUT_INVALID');
    }
    const { buildIdentity, kind, intent, sourceNetwork, desiredNetwork,
      motion = null } = input;
    const staticIntent = assessRoadFenceEditIntentV125({
      buildIdentity, kind, intent, sourceNetwork, desiredNetwork, motion
    });
    if (
      staticIntent.contract !== ROADFENCE_OPERATION_INTENT_CONTRACT ||
      staticIntent.status !== 'STATIC_INTENT_VALIDATED_ONLY'
    ) {
      return deny(staticIntent.errorCode || 'ROADFENCE_INTENT_NOT_VALIDATED',
        kind ?? null, intent ?? null);
    }
    if (!KIND[kind] || !OP[intent]) {
      return deny('ROADFENCE_NATIVE_OPERATION_UNKNOWN', kind, intent);
    }
    const requirements = Object.freeze([
      ...COMMON, ...KIND[kind], ...OP[intent]
    ]);
    const componentDelta =
      staticIntent.desiredComponents - staticIntent.sourceComponents;
    return Object.freeze({
      contract: ROADFENCE_NATIVE_OPERATION_CLOSURE_CONTRACT,
      status: 'STATIC_REQUIREMENTS_ONLY',
      operation: intent,
      kind,
      operationTier: 'B_NATIVE_RECOMPUTE',
      targetBuild: staticIntent.sourceBuildIdentity,
      declaredBuildIsAuthenticated: false,
      sourceBinding: staticIntent.sourceBinding,
      sourceTopologyAuthenticatedByCore: false,
      compilerOperation: staticIntent.compilerOperation,
      canonicalCompilerMustRunSeparately: true,
      layoutPolicy: 'PRESERVE_EXISTING',
      sourceComponents: staticIntent.sourceComponents,
      desiredComponents: staticIntent.desiredComponents,
      logicalComponentDelta: componentDelta,
      logicalQuantityDelta: staticIntent.logicalQuantityDelta,
      logicalQuantityIsNotInventoryDelta: true,
      nativeBaseExtDiagExtVariationDelta: 'UNKNOWN_UNTIL_EXACT_COMPILER_AND_NATIVE_V3',
      nativeInventoryDebitRefund: 'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_V3',
      nativeConsumerProducerRecompute: 'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_V3',
      nativeRecompileRequirement: intent === RoadFenceEditIntent.RECOMPILE
        ? 'EXPLICIT_REQUEST_REQUIRES_NATIVE_RECOMPILE_PROOF'
        : 'RECOMPILE_OR_PROVE_NO_NATIVE_DELTA_PER_OPERATION',
      nativeSavedFieldPath: 'UNKNOWN_UNTIL_AUTHENTIC_CORE_SOURCE',
      requiredEvidence: requirements,
      nextOwner: Object.freeze({
        topology: '01C CORE',
        sessionAndWriter: '01A CORE',
        spatialLegality: '01B CORE',
        nativeCallgraphWitness: '01E CORE',
        independentQa: '05 QR-C / 05 QR-L',
        merge: '09 INT'
      }),
      readOnly: true,
      nativeConsumerAccepted: false,
      nativeProducerAccepted: false,
      nativeV3Accepted: false,
      productWriterAuthorized: false,
      productApplyAuthorized: false,
      productEditedCopyAuthorized: false,
      deviceV4Mandatory: false
    });
  } catch {
    return deny('ROADFENCE_NATIVE_REQUIREMENTS_FAIL_CLOSED');
  }
}
