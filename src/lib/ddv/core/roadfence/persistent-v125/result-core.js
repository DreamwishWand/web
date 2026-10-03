import {
  CURRENT_BID,
  CURRENT_GAME_VERSION,
  ROADFENCE_NATIVE_MUTATION_SET_V125_CONTRACT,
  ROADFENCE_PERSISTENT_COMPILER_V125_CONTRACT,
  ROADFENCE_PERSISTENT_COMPILER_V125_ID,
  ROADFENCE_SEMANTIC_OWNER,
  ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY,
  REPRESENTATION_ONLY_FENCE_OPS
} from './constants.js';
import { clone, fail, safeInteger } from './common.js';

function preservationContract() {
  return {
    unrelatedGridObjects: 'EXACT_UNCHANGED',
    unrelatedGridObjectIdentity: 'EXACT_UNCHANGED',
    preservedOwnedGridObjects: 'RAW_OBJECT_EXACT_UNCHANGED',
    unknownOpaqueFields: 'PRESERVE_ON_UNRELATED_AND_PRESERVED_OBJECTS',
    unrelatedGridAreaMetadata: 'EXACT_UNCHANGED',
    listInventory: 'EXACT_UNCHANGED',
    collection: 'EXACT_UNCHANGED',
    entitlement: 'EXACT_UNCHANGED',
    progression: 'EXACT_UNCHANGED',
    storeShop: 'EXACT_UNCHANGED',
    gameInfo: 'EXACT_UNCHANGED',
    unrelatedRootCounters: 'EXACT_UNCHANGED',
    nativeInventoryAccounting: 'ORACLE_ONLY_NO_WAND_MUTATION'
  };
}

function allowedStructuralPaths(gridId, reconciliation) {
  const root = '/World/GridCollection/Grids/' + String(gridId);
  const paths = [];
  for (const entry of reconciliation.deleted) {
    paths.push(root + '/Objects/' + String(entry.gridObjectId));
  }
  for (const entry of reconciliation.created) {
    paths.push(root + '/Objects/' + String(entry.gridObjectId));
  }
  if (
    reconciliation.nextGridObjectID.before !==
    reconciliation.nextGridObjectID.after
  ) {
    paths.push(root + '/NextGridObjectID');
  }
  return paths.sort();
}

export function buildCompilerResult({
  kind,
  sourceGrid,
  sourceObjectIds,
  desiredNetwork,
  representationLayout,
  planned,
  supportResult,
  reconciliation,
  operation,
  buildIdentity
}) {
  const gridId = safeInteger(sourceGrid.ID, 'Grid.ID');
  const logicalBefore = reconciliation.logicalQuantityBefore;
  const logicalAfter = planned.logicalQuantity;

  if (
    REPRESENTATION_ONLY_FENCE_OPS.has(operation) &&
    logicalBefore !== logicalAfter
  ) {
    fail(
      'FENCE_POST_LAYOUT_QUANTITY_CHANGED',
      String(logicalBefore) + ' -> ' + String(logicalAfter)
    );
  }

  return {
    contract: ROADFENCE_NATIVE_MUTATION_SET_V125_CONTRACT,
    compiler: {
      contract: ROADFENCE_PERSISTENT_COMPILER_V125_CONTRACT,
      id: ROADFENCE_PERSISTENT_COMPILER_V125_ID,
      gameVersion: CURRENT_GAME_VERSION,
      platform: 'Nintendo Switch',
      bid: CURRENT_BID,
      semanticOwner: ROADFENCE_SEMANTIC_OWNER
    },
    sourceBuildIdentity: clone(buildIdentity),
    targetGrid: {
      gridId,
      tessellationFactor: sourceGrid.TessellationFactor ?? null
    },
    operation,
    support: supportResult,
    semanticOwner: ROADFENCE_SEMANTIC_OWNER,
    input: {
      logicalTopology: clone(desiredNetwork),
      ...(kind === 'fence'
        ? {
            representationLayout: clone(
              representationLayout ?? planned.representationLayout
            )
          }
        : {})
    },
    sourceObjectIds: [...sourceObjectIds].sort((a, b) => a - b),
    preservedObjectIdentities: reconciliation.preserved.map(
      (entry) => entry.gridObjectId
    ),
    createdObjectIdentities: reconciliation.created.map(
      (entry) => entry.gridObjectId
    ),
    deletedObjectIdentities: reconciliation.deleted.map(
      (entry) => entry.gridObjectId
    ),
    replacementIdentityPairs: reconciliation.replacementIdentityPairs,
    preservedObjects: reconciliation.preserved,
    createdObjects: reconciliation.created,
    deletedObjects: reconciliation.deleted,
    resultingNativeDescriptors: [
      ...reconciliation.preserved.map((entry) => ({
        gridObjectId: entry.gridObjectId,
        descriptor: entry.descriptor
      })),
      ...reconciliation.created.map((entry) => ({
        gridObjectId: entry.gridObjectId,
        descriptor: entry.descriptor
      }))
    ].sort((a, b) => a.gridObjectId - b.gridObjectId),
    nextGridObjectID: reconciliation.nextGridObjectID,
    logicalQuantity: { before: logicalBefore, after: logicalAfter },
    nativeObjectCount: reconciliation.nativeObjectCount,
    representationCounts: {
      before: reconciliation.representationCountsBefore,
      after: reconciliation.representationCountsAfter
    },
    allowedSemanticPaths: allowedStructuralPaths(
      gridId,
      reconciliation
    ),
    structuralTransactionDependency: {
      required: true,
      satisfied: true,
      id: ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY,
      current01aWriteCandidateCompatible: true
    },
    quantityInvariant: {
      logicalQuantityIsNotNativeObjectCount: true,
      representationOnlyOperationPreservesLogicalQuantity:
        REPRESENTATION_ONLY_FENCE_OPS.has(operation),
      wandInventoryDelta: 0
    },
    preservation: preservationContract(),
    evidence: supportResult.evidence.map((id) => ({
      id,
      status: 'CONFIRMED'
    })),
    failClosedReason: null,
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false,
    productApplyAuthorized: false
  };
}

export function compilerFailure(error) {
  return {
    contract: ROADFENCE_NATIVE_MUTATION_SET_V125_CONTRACT,
    ok: false,
    status: error.detail?.support?.status ?? 'UNSUPPORTED',
    failClosedReason: {
      code: error.code ?? 'ROADFENCE_COMPILER_ERROR',
      message: String(error.message ?? error),
      detail: clone(error.detail ?? {})
    },
    semanticOwner: ROADFENCE_SEMANTIC_OWNER,
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false,
    productApplyAuthorized: false
  };
}
