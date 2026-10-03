import {
  CURRENT_BID,
  CURRENT_GAME_VERSION,
  CURRENT_SCHEMA,
  ROADFENCE_PERSISTENT_COMPILER_V125_CONTRACT,
  ROADFENCE_PERSISTENT_COMPILER_V125_ID,
  ROADFENCE_SEMANTIC_OWNER,
  ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY
} from './constants.js';

export function structuralTransactionExtensionRequestV125() {
  return Object.freeze({
    contract: 'ddv.roadfence-01a-structural-extension-request@1',
    id: ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY,
    requestedBy: ROADFENCE_SEMANTIC_OWNER,
    targetFoundation:
      'DDV-SAFE-PERSISTENT-TRANSACTION-FOUNDATION-V125-V1_0',
    currentBlocker: {
      planTarget: 'single existing GRID_OBJECT',
      gridObjectIdentityPolicy:
        'PRESERVE_ALL_GRID_OBJECT_IDENTITIES',
      identityDeltaFailure: 'TX_GRID_OBJECT_IDENTITY_CHANGED'
    },
    minimumAdditiveCapability: {
      capability: 'STRUCTURAL_WRITE_CANDIDATE',
      targetKind: 'GRID_OBJECT_SET',
      identityPolicy: 'ALLOW_DECLARED_GRID_OBJECT_SET_DELTA',
      declarations: [
        'gridId',
        'preservedGridObjectIds',
        'createdGridObjectIds',
        'deletedGridObjectIds',
        'replacementIdentityPairs',
        'nextGridObjectIDBefore',
        'nextGridObjectIDAfter',
        'allowedStructuralPaths'
      ],
      pathClasses: [
        '/World/GridCollection/Grids/{gridId}/Objects/{declaredCreatedOrDeletedId}',
        '/World/GridCollection/Grids/{gridId}/NextGridObjectID'
      ],
      verification: [
        'identity delta equals declaration exactly',
        'created object-map keys are new and unique',
        'created object.ID equals map key',
        'deleted identities are absent after',
        'deleted IDs are never reused',
        'preserved raw objects remain unchanged',
        'NextGridObjectID is exact and monotonic',
        'unrelated identity and opaque state remain unchanged',
        'canonical reparse and serializer-normalization rejection remain mandatory'
      ]
    },
    unchangedPolicies: [
      'exact build/source-hash/codec binding',
      'GameInfo forbidden',
      'unknown and opaque state preservation',
      'inventory and Collection and entitlement preservation',
      'progression and Store and Shop preservation',
      'browser-local immutable-source replacement artifact architecture'
    ],
    explicitlyNotRequested: [
      'arbitrary JSON patch',
      'generic array structural mutation',
      'cross-grid mutation',
      'inventory mutation',
      'persistent filesystem replacement',
      'relaxation of minimum Furniture identity policy'
    ],
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false
  });
}

export function compilerMetadataV125() {
  return Object.freeze({
    contract: ROADFENCE_PERSISTENT_COMPILER_V125_CONTRACT,
    id: ROADFENCE_PERSISTENT_COMPILER_V125_ID,
    gameVersion: CURRENT_GAME_VERSION,
    platform: 'Nintendo Switch',
    bid: CURRENT_BID,
    profileSchema: CURRENT_SCHEMA,
    semanticOwner: ROADFENCE_SEMANTIC_OWNER,
    compilerProducesStructuralMutationSet: true,
    bindsToCurrent01aWriteCandidate: false,
    structuralTransactionDependency:
      ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY,
    preservesInventoryCollectionEntitlement: true,
    productApplyAuthorized: false,
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false
  });
}
