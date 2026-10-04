type AnyRecord = Record<string, any>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const PROGRESSION_V113_STATIC_PATH =
  '/ddv/core/world/v1.25/progression-world-object-safety-v125.json';
export const PROGRESSION_V113_SHA256 =
  'e8fd80775276e95cb70b0dd684534244ebe21b6dba04ec341b5cf92e90c32213';
export const PROGRESSION_V113_SCHEMA =
  'ddv.progression-world-object-safety@1';

export const PROGRESSION_V113_BLOCKERS = Object.freeze([
  'PROTECTED_PROGRESSION_OBJECT_CONFLICT',
  'QUEST_OWNED_OBJECT_MUTATION_FORBIDDEN',
  'PROGRESSION_OWNERSHIP_UNKNOWN',
  'SYSTEM_SPAWNED_OBJECT_MUTATION_FORBIDDEN',
  'REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN',
  'PROGRESSION_STATE_INCONSISTENT'
] as const);

const PROTECTED_OWNERSHIP = new Set([
  'QUEST_OWNED',
  'PROGRESSION_BOUND',
  'PUZZLE_OWNED',
  'SYSTEM_SPAWNED',
  'GLOBAL_SHARED_STATE',
  'UNKNOWN_OWNERSHIP'
]);

const BLOCKED_PHASE = new Set([
  'PROGRESSION_ACTIVE_LOCKED',
  'PROGRESSION_FUTURE_DEPENDENCY',
  'PROGRESSION_TERMINAL_FIXED_STATE',
  'UNKNOWN',
  'INCONSISTENT'
]);

function clone<T>(value:T):T {
  return structuredClone(value);
}

async function sha256Hex(bytes:Uint8Array) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WEP_PROGRESSION_V113_SHA256_UNAVAILABLE');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function fetchPinnedContract(
  url:string,
  fetchImpl:FetchLike
) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error('WEP_PROGRESSION_V113_CONTRACT_FETCH_FAILED');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if ((await sha256Hex(bytes)) !== PROGRESSION_V113_SHA256) {
    throw new Error('WEP_PROGRESSION_V113_CONTRACT_HASH_MISMATCH');
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return JSON.parse(text);
}

function validateContract(contract:AnyRecord) {
  if (
    contract?.schema !== PROGRESSION_V113_SCHEMA ||
    contract?.artifactId !==
      'DDV-PROGRESSION-WORLD-OBJECT-SAFETY-V125-V1_13' ||
    contract?.version !== 'v1.13' ||
    contract?.status !== 'PROMOTED' ||
    contract?.target?.platform !== 'Nintendo Switch' ||
    contract?.target?.gameVersion !== '1.25.0' ||
    contract?.target?.buildId !== '52BD625D9B4E0053' ||
    Number(contract?.target?.profileSchemaVersion) !== 624 ||
    contract?.positiveAuthorizationBoundary
      ?.authorizesUserControlledClassification !== false ||
    contract?.positiveAuthorizationBoundary
      ?.authorizesTerminalEditableMutation !== false ||
    contract?.writerBoundary?.persistentWriteAuthorized !== false ||
    contract?.writerBoundary?.WORLD_PERSISTENT_WRITE_V125 !== false ||
    contract?.dependencies?.questDefinitionGraph?.status !== 'OPEN' ||
    contract?.dependencies?.saveProgressionReferenceIndex?.status !== 'OPEN'
  ) {
    throw new Error('WEP_PROGRESSION_V113_CONTRACT_MISMATCH');
  }
  return true;
}

function blockerForOwnership(ownershipClass:string) {
  if (ownershipClass === 'QUEST_OWNED') {
    return 'QUEST_OWNED_OBJECT_MUTATION_FORBIDDEN';
  }
  if (ownershipClass === 'SYSTEM_SPAWNED') {
    return 'SYSTEM_SPAWNED_OBJECT_MUTATION_FORBIDDEN';
  }
  if (ownershipClass === 'UNKNOWN_OWNERSHIP') {
    return 'PROGRESSION_OWNERSHIP_UNKNOWN';
  }
  if (PROTECTED_OWNERSHIP.has(ownershipClass)) {
    return 'PROTECTED_PROGRESSION_OBJECT_CONFLICT';
  }
  return null;
}

function createBindingFromContract(contract:AnyRecord) {
  validateContract(contract);

  function evaluateProgressionEvidence({
    ownershipClass,
    phaseClass,
    operation,
    activeIdentityReference = false,
    stateConsistent = true,
    explicitlyClassified = false
  }: {
    ownershipClass?: string | null;
    phaseClass?: string | null;
    operation?: string | null;
    activeIdentityReference?: boolean;
    stateConsistent?: boolean;
    explicitlyClassified?: boolean;
  } = {}) {
    const ownership = String(ownershipClass ?? '');
    const phase = String(phaseClass ?? '');
    const op = String(operation ?? '');

    if (!explicitlyClassified) {
      return Object.freeze({
        schema: 'ddv.progression-operation-evaluation@1',
        status: 'blocked',
        blockerCode: 'PROGRESSION_OWNERSHIP_UNKNOWN',
        positivePermissionGranted: false,
        persistentWriteAuthorized: false
      });
    }

    if (!stateConsistent || phase === 'INCONSISTENT') {
      return Object.freeze({
        schema: 'ddv.progression-operation-evaluation@1',
        status: 'blocked',
        blockerCode: 'PROGRESSION_STATE_INCONSISTENT',
        positivePermissionGranted: false,
        persistentWriteAuthorized: false
      });
    }

    if (
      activeIdentityReference === true &&
      ['MOVE','REMOVE','REPLACE','DESTINATION_OVERWRITE']
        .includes(op)
    ) {
      return Object.freeze({
        schema: 'ddv.progression-operation-evaluation@1',
        status: 'blocked',
        blockerCode:
          'REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN',
        positivePermissionGranted: false,
        persistentWriteAuthorized: false
      });
    }

    const ownershipBlocker = blockerForOwnership(ownership);
    if (ownershipBlocker) {
      return Object.freeze({
        schema: 'ddv.progression-operation-evaluation@1',
        status: 'blocked',
        blockerCode: ownershipBlocker,
        positivePermissionGranted: false,
        persistentWriteAuthorized: false
      });
    }

    if (BLOCKED_PHASE.has(phase)) {
      return Object.freeze({
        schema: 'ddv.progression-operation-evaluation@1',
        status: 'blocked',
        blockerCode:
          phase === 'INCONSISTENT'
            ? 'PROGRESSION_STATE_INCONSISTENT'
            : 'PROTECTED_PROGRESSION_OBJECT_CONFLICT',
        positivePermissionGranted: false,
        persistentWriteAuthorized: false
      });
    }

    if (phase === 'PROGRESSION_TERMINAL_EDITABLE') {
      return Object.freeze({
        schema: 'ddv.progression-operation-evaluation@1',
        status: 'blocked',
        blockerCode: 'PROGRESSION_OPERATION_PROOF_NOT_CLOSED',
        positivePermissionGranted: false,
        persistentWriteAuthorized: false
      });
    }

    if (ownership !== 'USER_CONTROLLED') {
      return Object.freeze({
        schema: 'ddv.progression-operation-evaluation@1',
        status: 'blocked',
        blockerCode: 'PROGRESSION_OWNERSHIP_UNKNOWN',
        positivePermissionGranted: false,
        persistentWriteAuthorized: false
      });
    }

    return Object.freeze({
      schema: 'ddv.progression-operation-evaluation@1',
      status: 'no-progression-blocker',
      blockerCode: null,
      positivePermissionGranted: false,
      requiresNormalCoreValidation: true,
      persistentWriteAuthorized: false
    });
  }

  function progressionBlockersFromObjectMetadata(
    metadata:AnyRecord|null|undefined
  ) {
    const reasons = Array.isArray(metadata?.reasons)
      ? metadata.reasons.map(String)
      : [];
    return reasons.filter((reason:string) =>
      (PROGRESSION_V113_BLOCKERS as readonly string[])
        .includes(reason)
    );
  }

  return Object.freeze({
    schema: PROGRESSION_V113_SCHEMA,
    artifactId:
      'DDV-PROGRESSION-WORLD-OBJECT-SAFETY-V125-V1_13',
    contractSha256: PROGRESSION_V113_SHA256,
    platform: 'Nintendo Switch',
    gameVersion: '1.25.0',
    buildId: '52BD625D9B4E0053',
    profileSchemaVersion: 624,
    blockers: PROGRESSION_V113_BLOCKERS,
    evaluateProgressionEvidence,
    progressionBlockersFromObjectMetadata,
    contractSnapshot: Object.freeze(clone(contract)),
    persistentWriteAuthorized: false,
    positivePermissionGranted: false
  });
}

export async function createSwitchV125ProgressionSafetyBinding({
  basePath = '',
  fetchImpl = globalThis.fetch
}: {
  basePath?: string;
  fetchImpl?: FetchLike;
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('WEP_PROGRESSION_V113_FETCH_UNAVAILABLE');
  }
  const prefix = String(basePath ?? '').replace(/\/$/, '');
  const contract = await fetchPinnedContract(
    `${prefix}${PROGRESSION_V113_STATIC_PATH}`,
    fetchImpl
  );
  return createBindingFromContract(contract);
}

export function createSwitchV125ProgressionSafetyBindingFromContract(
  contract:AnyRecord
) {
  return createBindingFromContract(clone(contract));
}
