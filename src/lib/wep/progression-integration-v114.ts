type AnyRecord = Record<string, any>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const PROGRESSION_V114_STATIC_PATH =
  '/ddv/core/world/v1.25/progression-world-object-integration-v125.json';
export const PROGRESSION_V114_SHA256 =
  'de7f3590c285547fd0e8f70f6141432d6c242c4c6e59540e271d6af4a1813434';
export const PROGRESSION_V114_SCHEMA =
  'ddv.progression-world-object-integration@1';

function clone<T>(value:T):T {
  return structuredClone(value);
}

async function sha256Hex(bytes:Uint8Array) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WEP_PROGRESSION_V114_SHA256_UNAVAILABLE');
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
    throw new Error('WEP_PROGRESSION_V114_CONTRACT_FETCH_FAILED');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if ((await sha256Hex(bytes)) !== PROGRESSION_V114_SHA256) {
    throw new Error('WEP_PROGRESSION_V114_CONTRACT_HASH_MISMATCH');
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return JSON.parse(text);
}

function validateContract(contract:AnyRecord) {
  if (
    contract?.schema !== PROGRESSION_V114_SCHEMA ||
    contract?.artifactId !==
      'DDV-PROGRESSION-WORLD-OBJECT-INTEGRATION-V125-V1_14' ||
    contract?.version !== 'v1.14' ||
    contract?.status !== 'PROMOTED' ||
    contract?.target?.platform !== 'Nintendo Switch' ||
    contract?.target?.gameVersion !== '1.25.0' ||
    contract?.target?.buildId !== '52BD625D9B4E0053' ||
    Number(contract?.target?.profileSchemaVersion) !== 624 ||
    contract?.dependencyClosure?.questDefinitionGraph?.status !== 'CLOSED' ||
    contract?.dependencyClosure?.saveProgressionReferenceIndex?.status !== 'CLOSED' ||
    contract?.positiveAuthorizationBoundary
      ?.authorizesUserControlledClassification !== false ||
    contract?.positiveAuthorizationBoundary
      ?.authorizesTerminalEditableMutation !== false ||
    contract?.positiveAuthorizationBoundary
      ?.authorizesPersistentWriter !== false ||
    contract?.remainingGates?.conditionalSpawnRemoveWhenDone?.status !== 'OPEN' ||
    contract?.remainingGates?.dynamicNativeConsumerExclusion?.status !== 'OPEN' ||
    contract?.remainingGates?.objectSerializedStateCompatibility?.status !== 'OPEN' ||
    contract?.writerBoundary?.persistentWriteAuthorized !== false ||
    contract?.writerBoundary?.WORLD_PERSISTENT_WRITE_V125 !== false ||
    contract?.writerBoundary?.applyAuthorized !== false
  ) {
    throw new Error('WEP_PROGRESSION_V114_CONTRACT_MISMATCH');
  }
  return true;
}

function createBindingFromContract(contract:AnyRecord) {
  validateContract(contract);

  function proofStatus() {
    return Object.freeze({
      schema:'ddv.progression-proof-status@1',
      questDefinitionGraph:'CLOSED',
      saveProgressionReferenceIndex:'CLOSED',
      conditionalSpawnRemoveWhenDone:'OPEN',
      dynamicNativeConsumerExclusion:'OPEN',
      objectSerializedStateCompatibility:'OPEN',
      terminalEditableMutationAuthorized:false,
      positivePermissionGranted:false,
      persistentWriteAuthorized:false
    });
  }

  function referenceDisposition(activityInput:unknown) {
    const activity=String(activityInput ?? '');
    if (activity === 'ACTIVE') {
      return Object.freeze({
        status:'blocked',
        blockerCode:'REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN',
        positivePermissionGranted:false
      });
    }
    if (activity === 'UNKNOWN') {
      return Object.freeze({
        status:'blocked',
        blockerCode:'PROGRESSION_OWNERSHIP_UNKNOWN',
        positivePermissionGranted:false
      });
    }
    if (activity === 'HISTORICAL') {
      return Object.freeze({
        status:'no-active-reference-veto',
        blockerCode:null,
        positivePermissionGranted:false,
        requiresNormalCoreValidation:true
      });
    }
    return Object.freeze({
      status:'blocked',
      blockerCode:'PROGRESSION_OWNERSHIP_UNKNOWN',
      positivePermissionGranted:false
    });
  }

  function annotateEditorDocument(documentInput:AnyRecord) {
    const document=clone(documentInput);
    return {
      ...document,
      metadata:{
        ...(document?.metadata ?? {}),
        progressionIntegration:{
          schema:PROGRESSION_V114_SCHEMA,
          artifactId:'DDV-PROGRESSION-WORLD-OBJECT-INTEGRATION-V125-V1_14',
          contractSha256:PROGRESSION_V114_SHA256,
          proofStatus:proofStatus(),
          integratedFindings:clone(contract.integratedFindings),
          persistentWriteAuthorized:false
        }
      }
    };
  }

  return Object.freeze({
    schema:PROGRESSION_V114_SCHEMA,
    artifactId:'DDV-PROGRESSION-WORLD-OBJECT-INTEGRATION-V125-V1_14',
    contractSha256:PROGRESSION_V114_SHA256,
    proofStatus,
    referenceDisposition,
    annotateEditorDocument,
    contractSnapshot:Object.freeze(clone(contract)),
    positivePermissionGranted:false,
    persistentWriteAuthorized:false
  });
}

export async function createSwitchV125ProgressionIntegrationBinding({
  basePath='',
  fetchImpl=globalThis.fetch
}: {
  basePath?:string;
  fetchImpl?:FetchLike;
}={}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('WEP_PROGRESSION_V114_FETCH_UNAVAILABLE');
  }
  const prefix=String(basePath ?? '').replace(/\/$/,'');
  const contract=await fetchPinnedContract(
    `${prefix}${PROGRESSION_V114_STATIC_PATH}`,
    fetchImpl
  );
  return createBindingFromContract(contract);
}

export function createSwitchV125ProgressionIntegrationBindingFromContract(
  contract:AnyRecord
) {
  return createBindingFromContract(clone(contract));
}
