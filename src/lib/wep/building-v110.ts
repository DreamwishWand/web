type AnyRecord = Record<string, any>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const BUILDING_V110_STATIC_PATH =
  '/ddv/core/world/v1.25/building-read-model-preflight-v125.json';
export const BUILDING_V110_SHA256 =
  'ca4e718218fbcd7e33080ede6ad5849b360c2fa237fb4c5630197a2234e2ab20';
export const BUILDING_V110_SCHEMA =
  'ddv.building-read-model-preflight@1';

export const BUILDING_V110_CLASS = Object.freeze({
  ORDINARY: 'ORDINARY_GRID_BUILDING',
  SPECIAL: 'SPECIAL_GRID_BUILDING',
  OFF_GRID: 'OFF_GRID_BUILDING',
  UNKNOWN: 'UNKNOWN_BUILDING_SEMANTICS'
});

export type BuildingV110Binding = ReturnType<
  typeof createBindingFromContract
>;

function clone<T>(value:T):T {
  return structuredClone(value);
}

async function sha256Hex(bytes:Uint8Array) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WEP_BUILDING_V110_SHA256_UNAVAILABLE');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

async function fetchPinnedContract(
  url:string,
  fetchImpl:FetchLike
) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error('WEP_BUILDING_V110_CONTRACT_FETCH_FAILED');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if ((await sha256Hex(bytes)) !== BUILDING_V110_SHA256) {
    throw new Error('WEP_BUILDING_V110_CONTRACT_HASH_MISMATCH');
  }
  let contract:AnyRecord;
  try {
    contract = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    );
  } catch {
    throw new Error('WEP_BUILDING_V110_CONTRACT_JSON_INVALID');
  }
  return contract;
}

function validateContract(contract:AnyRecord) {
  if (
    contract?.schema !== BUILDING_V110_SCHEMA ||
    contract?.artifactId !== 'DDV-BUILDING-V125-V1_10' ||
    contract?.version !== 'v1.10' ||
    contract?.status !== 'PROMOTED' ||
    contract?.mutable !== false ||
    contract?.target?.platform !== 'Nintendo Switch' ||
    contract?.target?.gameVersion !== '1.25.0' ||
    contract?.target?.buildId !== '52BD625D9B4E0053' ||
    Number(contract?.target?.profileSchemaVersion) !== 624 ||
    contract?.writerBoundary?.persistentWriteAuthorized !== false ||
    contract?.writerBoundary?.WORLD_PERSISTENT_WRITE_V125 !== false
  ) {
    throw new Error('WEP_BUILDING_V110_CONTRACT_MISMATCH');
  }
  const classes = new Set(
    contract?.classification?.classes ?? []
  );
  for (const value of Object.values(BUILDING_V110_CLASS)) {
    if (!classes.has(value)) {
      throw new Error('WEP_BUILDING_V110_CLASS_SET_MISMATCH');
    }
  }
  if (
    contract?.wepActivation?.withTypedCategoryGates !== true ||
    contract?.wepActivation?.replaceBlanketBlocker !==
      'BUILDING_DESTINATION_SEMANTICS_UNRESOLVED'
  ) {
    throw new Error('WEP_BUILDING_V110_ACTIVATION_MISMATCH');
  }
  return true;
}

function booleanSignal(value:unknown) {
  return value === true
    ? true
    : value === false
      ? false
      : null;
}

function directSubtype(
  evidence:AnyRecord,
  contract:AnyRecord
) {
  const buildingItemType = String(
    evidence?.buildingItemType ?? ''
  );
  const direct =
    contract.classification.directSpecialByBuildingItemType?.[
      buildingItemType
    ];
  if (direct) {
    return {
      classification: String(direct),
      subtype:
        buildingItemType === 'Stall'
          ? 'StallShop'
          : buildingItemType === 'PlayerHouse'
            ? 'PlayerHouse'
            : buildingItemType === 'Garden'
              ? 'Garden'
              : buildingItemType === 'OffGridBuilding'
                ? 'OffGridBuilding'
                : buildingItemType,
      evidence: 'BUILDING_ITEM_TYPE'
    };
  }

  if (String(evidence?.restorationKind ?? '') === 'PLAYER_HOUSE') {
    return {
      classification: BUILDING_V110_CLASS.SPECIAL,
      subtype: 'PlayerHouse',
      evidence: 'PROTECTED_PLAYERHOUSE_BINDING'
    };
  }

  if (String(evidence?.sourceStateFamily ?? '') === 'StallData') {
    return {
      classification: BUILDING_V110_CLASS.SPECIAL,
      subtype: 'StallShop',
      evidence: 'PROMOTED_STALLDATA_TYPED_STATE'
    };
  }

  return null;
}

function classifyHouseOrOther(
  evidence:AnyRecord,
  contract:AnyRecord
) {
  const gate =
    contract.classification.houseOrOtherOrdinaryGate;
  const type = String(evidence?.buildingItemType ?? '');
  if (!gate.eligibleBuildingItemTypes.includes(type)) {
    return null;
  }

  const signals:AnyRecord = evidence?.signals ?? {};
  const required:string[] =
    gate.requiredAuthoritativeFalseSignals;
  const values = Object.fromEntries(
    required.map((name) => [
      name,
      booleanSignal(signals[name])
    ])
  );

  const trueSignal = required.find(
    (name) => values[name] === true
  );
  if (trueSignal) {
    const subtype =
      trueSignal === 'isPlayerHouse'
        ? 'PlayerHouse'
        : trueSignal === 'isCharacterHouse'
          ? 'CharacterHouse'
          : trueSignal === 'isFastTravel'
            ? 'WellFastTravel'
            : trueSignal === 'hasBuildingStateSynchronizer'
              ? 'SharedSynchronizer'
              : 'UnknownSpecial';
    return {
      classification: BUILDING_V110_CLASS.SPECIAL,
      subtype,
      evidence: 'AUTHORITATIVE_SPECIAL_SIGNAL',
      signals: values
    };
  }

  const unknown = required.filter(
    (name) => values[name] === null
  );
  if (unknown.length) {
    return {
      classification: BUILDING_V110_CLASS.UNKNOWN,
      subtype: null,
      evidence: 'ORDINARY_GATE_INCOMPLETE',
      signals: values,
      blockers: [
        {
          code: BUILDING_V110_CLASS.UNKNOWN,
          missingSignals: unknown
        }
      ]
    };
  }

  return {
    classification: BUILDING_V110_CLASS.ORDINARY,
    subtype: null,
    evidence: 'ALL_SPECIAL_SIGNALS_AUTHORITATIVE_FALSE',
    signals: values
  };
}

function specialBlocker(
  subtype:string|null,
  contract:AnyRecord
) {
  if (!subtype) {
    return contract.specialCategoryBlockers.UnknownSpecial;
  }
  return (
    contract.specialCategoryBlockers[subtype] ??
    contract.specialCategoryBlockers.UnknownSpecial
  );
}

function createBindingFromContract(contract:AnyRecord) {
  validateContract(contract);

  function classifyEvidence(evidence:AnyRecord = {}) {
    const direct = directSubtype(evidence, contract);
    if (direct) {
      return Object.freeze({
        schema: 'ddv.building-classification-result@1',
        ...clone(direct),
        blockers:
          direct.classification === BUILDING_V110_CLASS.OFF_GRID
            ? [
                {
                  code:
                    contract.specialCategoryBlockers.OffGridBuilding
                }
              ]
            : [
                {
                  code: specialBlocker(
                    direct.subtype,
                    contract
                  )
                }
              ],
        persistentWriteAuthorized: false
      });
    }

    const houseOrOther =
      classifyHouseOrOther(evidence, contract);
    if (houseOrOther) {
      const blockers =
        houseOrOther.classification ===
        BUILDING_V110_CLASS.SPECIAL
          ? [
              {
                code: specialBlocker(
                  houseOrOther.subtype,
                  contract
                )
              }
            ]
          : houseOrOther.blockers ?? [];
      return Object.freeze({
        schema: 'ddv.building-classification-result@1',
        ...clone(houseOrOther),
        blockers,
        persistentWriteAuthorized: false
      });
    }

    return Object.freeze({
      schema: 'ddv.building-classification-result@1',
      classification: BUILDING_V110_CLASS.UNKNOWN,
      subtype: null,
      evidence: 'BUILDING_CLASSIFICATION_EVIDENCE_INCOMPLETE',
      signals: clone(evidence?.signals ?? {}),
      blockers: [
        {
          code: BUILDING_V110_CLASS.UNKNOWN
        }
      ],
      persistentWriteAuthorized: false
    });
  }

  function sameGridTransformPreflight({
    evidence,
    routeSupported,
    cardinalTransformSupported,
    boundsReady,
    floorMapReady,
    placementResult
  }:AnyRecord) {
    const classification = classifyEvidence(evidence);
    const blockers:AnyRecord[] = [];

    if (
      classification.classification !==
      BUILDING_V110_CLASS.ORDINARY
    ) {
      blockers.push({
        code:
          classification.classification ===
          BUILDING_V110_CLASS.UNKNOWN
            ? BUILDING_V110_CLASS.UNKNOWN
            : contract.operationGates.sameGridTransform
                .specialOrUnknown.blocker
      });
    }
    if (routeSupported !== true) {
      blockers.push({
        code: 'WEP_BUILDING_CURRENT_ROUTE_UNSUPPORTED'
      });
    }
    if (cardinalTransformSupported !== true) {
      blockers.push({
        code: 'WEP_BUILDING_CARDINAL_TRANSFORM_UNSUPPORTED'
      });
    }
    if (boundsReady !== true) {
      blockers.push({
        code: 'AUTHORITATIVE_GRIDDATAPATH_BOUNDS_NOT_BOUND'
      });
    }
    if (floorMapReady !== true) {
      blockers.push({
        code: 'WEP_BUILDING_FLOOR_MAP_NOT_BOUND'
      });
    }
    const nativeClass = String(
      placementResult?.nativeClass ?? ''
    );
    if (nativeClass !== 'NATIVE_VALID_CLEAR') {
      blockers.push({
        code:
          nativeClass ===
          'NATIVE_VALID_REPLACES_OR_REMOVES_EXISTING'
            ? 'NATIVE_REPLACEMENT_OR_REMOVAL_POLICY_REQUIRED'
            : nativeClass === 'NATIVE_INVALID'
              ? 'NATIVE_PLACEMENT_INVALID'
              : 'NATIVE_PLACEMENT_UNVERIFIED'
      });
    }

    return Object.freeze({
      schema: 'ddv.building-same-grid-transform-preflight@1',
      classification: clone(classification),
      ready: blockers.length === 0,
      blockers,
      persistentWriteAuthorized: false
    });
  }

  function ordinaryPlacementPreflight({
    evidence,
    destinationStockOwnership,
    currentSceneMultiplicity,
    typedInitialStateCompatibility,
    boundsReady,
    floorMapReady,
    placementResult
  }:AnyRecord) {
    const classification = classifyEvidence(evidence);
    const blockers:AnyRecord[] = [];

    if (
      classification.classification ===
      BUILDING_V110_CLASS.UNKNOWN
    ) {
      blockers.push({
        code: BUILDING_V110_CLASS.UNKNOWN
      });
    } else if (
      classification.classification !==
      BUILDING_V110_CLASS.ORDINARY
    ) {
      blockers.push({
        code:
          contract.operationGates.placement
            .specialOrOffGrid.blocker,
        subtype: classification.subtype
      });
      for (const blocker of classification.blockers ?? []) {
        blockers.push(clone(blocker));
      }
    }

    const validator = (
      result:unknown,
      missingCode:string,
      blockedCode:string
    ) => {
      if (!result || typeof result !== 'object') {
        blockers.push({ code: missingCode });
        return;
      }
      const status = String((result as AnyRecord).status ?? '');
      if (!['VALID', 'VALID_NOOP'].includes(status)) {
        blockers.push({
          code: blockedCode,
          status,
          detail: clone(result as AnyRecord)
        });
      }
    };

    if (
      classification.classification ===
      BUILDING_V110_CLASS.ORDINARY
    ) {
      validator(
        destinationStockOwnership,
        'WEP_BUILDING_STOCK_OWNERSHIP_VALIDATOR_NOT_BOUND',
        'WEP_BUILDING_STOCK_OWNERSHIP_BLOCKED'
      );
      validator(
        currentSceneMultiplicity,
        'WEP_BUILDING_MULTIPLICITY_VALIDATOR_NOT_BOUND',
        'WEP_BUILDING_MULTIPLICITY_BLOCKED'
      );
      validator(
        typedInitialStateCompatibility,
        'WEP_BUILDING_TYPED_STATE_VALIDATOR_NOT_BOUND',
        'WEP_BUILDING_TYPED_STATE_BLOCKED'
      );
      if (boundsReady !== true) {
        blockers.push({
          code: 'AUTHORITATIVE_GRIDDATAPATH_BOUNDS_NOT_BOUND'
        });
      }
      if (floorMapReady !== true) {
        blockers.push({
          code: 'WEP_BUILDING_FLOOR_MAP_NOT_BOUND'
        });
      }
      const nativeClass = String(
        placementResult?.nativeClass ?? ''
      );
      if (nativeClass !== 'NATIVE_VALID_CLEAR') {
        blockers.push({
          code:
            nativeClass ===
            'NATIVE_VALID_REPLACES_OR_REMOVES_EXISTING'
              ? 'NATIVE_REPLACEMENT_OR_REMOVAL_POLICY_REQUIRED'
              : nativeClass === 'NATIVE_INVALID'
                ? 'NATIVE_PLACEMENT_INVALID'
                : 'NATIVE_PLACEMENT_UNVERIFIED'
        });
      }
    }

    return Object.freeze({
      schema: 'ddv.building-placement-preflight@1',
      classification: clone(classification),
      ready: blockers.length === 0,
      blockers,
      persistentWriteAuthorized: false
    });
  }

  return Object.freeze({
    contract: BUILDING_V110_SCHEMA,
    artifactId: 'DDV-BUILDING-V125-V1_10',
    version: 'v1.10',
    platform: 'Nintendo Switch',
    gameVersion: '1.25.0',
    buildId: '52BD625D9B4E0053',
    profileSchemaVersion: 624,
    contractSha256: BUILDING_V110_SHA256,
    classes: BUILDING_V110_CLASS,
    classifyEvidence,
    sameGridTransformPreflight,
    ordinaryPlacementPreflight,
    contractSnapshot: Object.freeze(clone(contract)),
    persistentWriteAuthorized: false
  });
}

export async function createSwitchV125BuildingBinding({
  basePath = '',
  fetchImpl = globalThis.fetch
}: {
  basePath?: string;
  fetchImpl?: FetchLike;
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('WEP_BUILDING_V110_FETCH_UNAVAILABLE');
  }
  const prefix = String(basePath ?? '').replace(/\/$/, '');
  const contract = await fetchPinnedContract(
    `${prefix}${BUILDING_V110_STATIC_PATH}`,
    fetchImpl
  );
  return createBindingFromContract(contract);
}

export function createSwitchV125BuildingBindingFromContract(
  contract:AnyRecord
) {
  return createBindingFromContract(clone(contract));
}
