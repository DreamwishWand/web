import { BuildIdentityKind, PlatformFamily, evaluateWriterAuthorization, RuntimeGateStatus } from './versioning.js';

export const SAVE_PREFLIGHT_CONTRACT = 'dreamwish.ddv.save-preflight@1';
export const RUNTIME_ASSERTION_CONTRACT = 'dreamwish.ddv.runtime-assertion@1';

/**
 * Stable boundary consumed by semantic owners (01B/01C/01D) before they request
 * a verified encoded copy. No raw save bytes or mutable profile graph escape here.
 */
export function evaluateSavePreflight({ session, targetBuild, operation, persistence }) {
  if (!session || typeof session.getPreflightContext !== 'function') throw new Error('INVALID_SAFE_SESSION');
  const ctx = session.getPreflightContext();
  const op = normalizeOperation(operation);
  const authorization = evaluateWriterAuthorization({
    saveIdentity: ctx.saveIdentity,
    targetBuild,
    codec: {
      readSupported: true,
      encodeSupported: true,
      roundTripVerified: true,
      contract: ctx.codecContract
    },
    operation: op,
    persistence
  });
  return Object.freeze({
    contract: SAVE_PREFLIGHT_CONTRACT,
    saveIdentity: ctx.saveIdentity,
    inputFormat: ctx.inputFormat,
    codecContract: ctx.codecContract,
    targetBuild: freezeTarget(targetBuild),
    operation: Object.freeze({
      id: op.id,
      owner: op.owner,
      runtimeGate: op.runtimeGate
    }),
    capabilities: authorization.capabilities,
    build: authorization.build,
    findings: authorization.findings,
    persistentWriteAuthorized: authorization.capabilities.persistentReplace
  });
}

/**
 * Manifest passed to 01E with a concrete verified output. It binds the runtime
 * test to exact source bytes, exact target build, codec contract and changed paths.
 */
export function createRuntimeAssertionManifest({ preflight, exportResult }) {
  if (!preflight || preflight.contract !== SAVE_PREFLIGHT_CONTRACT) throw new Error('INVALID_PREFLIGHT_REPORT');
  if (!exportResult || typeof exportResult !== 'object') throw new Error('INVALID_EXPORT_RESULT');
  if (typeof exportResult.sourceRawSha256 !== 'string' || typeof exportResult.editedRawSha256 !== 'string') throw new Error('EXPORT_HASHES_REQUIRED');
  if (!Array.isArray(exportResult.changedPaths)) throw new Error('EXPORT_CHANGED_PATHS_REQUIRED');
  if (exportResult.sourceRawSha256 !== preflight.saveIdentity.sourceRawSha256) throw new Error('PREFLIGHT_SOURCE_HASH_MISMATCH');
  if (!preflight.capabilities.encodeCopy && !exportResult.noOp) throw new Error('RUNTIME_MANIFEST_REQUIRES_AUTHORIZED_ENCODE_COPY');
  if (exportResult.authorization?.capabilities?.persistentReplace === true) throw new Error('PERSISTENT_REPLACE_MUST_REMAIN_FALSE');

  if (!exportResult.noOp) {
    const ctx = exportResult.exportContext;
    if (!ctx || typeof ctx !== 'object') throw new Error('EXPORT_VERIFICATION_CONTEXT_REQUIRED');
    if (!sameTargetBuild(ctx.targetBuild, preflight.targetBuild)) throw new Error('PREFLIGHT_EXPORT_TARGET_BUILD_MISMATCH');
    if (ctx.codecContract !== preflight.codecContract) throw new Error('PREFLIGHT_EXPORT_CODEC_CONTRACT_MISMATCH');
    if (ctx.exactBuildContractId !== (preflight.build?.contract?.id ?? null)) throw new Error('PREFLIGHT_EXPORT_BUILD_CONTRACT_MISMATCH');
    if (!sameOperation(ctx.operation, preflight.operation)) throw new Error('PREFLIGHT_EXPORT_OPERATION_MISMATCH');
  }

  return deepFreeze({
    contract: RUNTIME_ASSERTION_CONTRACT,
    operation: {
      id: preflight.operation.id,
      owner: preflight.operation.owner,
      runtimeGate: preflight.operation.runtimeGate
    },
    source: {
      rawSha256: exportResult.sourceRawSha256,
      profileGameInfoVersion: preflight.saveIdentity.profileGameInfoVersion,
      initialProfileGameInfoVersion: preflight.saveIdentity.initialProfileGameInfoVersion,
      lastSaveDeviceType: preflight.saveIdentity.lastSaveDeviceType,
      sourcePlatform: preflight.saveIdentity.sourcePlatform,
      inputFormat: preflight.inputFormat
    },
    targetBuild: preflight.targetBuild,
    codecContract: preflight.codecContract,
    exactBuildContractId: preflight.build?.contract?.id ?? null,
    output: {
      rawSha256: exportResult.editedRawSha256,
      changedPaths: [...exportResult.changedPaths],
      noOp: Boolean(exportResult.noOp)
    },
    capabilitiesAtExport: {
      readProfile: Boolean(preflight.capabilities.readProfile),
      planOperation: Boolean(preflight.capabilities.planOperation),
      encodeCopy: Boolean(preflight.capabilities.encodeCopy),
      persistentReplace: false
    },
    persistentWriteAuthorized: false
  });
}

function normalizeOperation(value) {
  if (!value || typeof value !== 'object') throw new Error('INVALID_OPERATION_GATE');
  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : null;
  const owner = typeof value.owner === 'string' && value.owner.length > 0 ? value.owner : null;
  if (!id || !owner) throw new Error('OPERATION_ID_AND_OWNER_REQUIRED');
  if (!Object.values(RuntimeGateStatus).includes(value.runtimeGate)) throw new Error('INVALID_RUNTIME_GATE_STATUS');
  return Object.freeze({
    id,
    owner,
    structuralCapabilitiesSupported: value.structuralCapabilitiesSupported === true,
    planSupported: value.planSupported === true,
    validationPassed: value.validationPassed === true,
    runtimeGate: value.runtimeGate
  });
}
function sameTargetBuild(a, b) {
  return Boolean(a && b && a.platform === b.platform && a.kind === b.kind && a.value === b.value);
}
function sameOperation(a, b) {
  return Boolean(a && b && a.id === b.id && a.owner === b.owner && a.runtimeGate === b.runtimeGate);
}
function freezeTarget(value) {
  if (!value || typeof value !== 'object' || typeof value.value !== 'string' || value.value.length === 0) {
    throw new Error('INVALID_TARGET_BUILD');
  }
  const valid =
    (value.platform === PlatformFamily.Switch && value.kind === BuildIdentityKind.SwitchBid) ||
    (value.platform === PlatformFamily.SteamWindows && value.kind === BuildIdentityKind.SteamFullVersion);
  if (!valid) throw new Error('INVALID_TARGET_BUILD');
  return Object.freeze({ platform: value.platform, kind: value.kind, value: value.value });
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
