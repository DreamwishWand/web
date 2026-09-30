/**
 * Dreamwish Wand DDV save/build identity and writer authorization.
 *
 * This module deliberately separates three axes that can differ under DDV cross-save:
 * - source/storage platform: where the imported file came from,
 * - last-save device: GameInfo.LastSaveDeviceInfo from the profile,
 * - target build: the exact game build the output is intended for.
 *
 * Save schema/version evidence never substitutes for an exact platform build identity.
 */

/** @typedef {'switch'|'steam-windows'|'unknown'} PlatformFamily */
/** @typedef {'switch-bid'|'steam-full-version'} BuildIdentityKind */
/** @typedef {'NOT_REQUIRED'|'PASSED'|'PENDING'|'FAILED'} RuntimeGateStatus */

export const PlatformFamily = Object.freeze({
  Switch: 'switch',
  SteamWindows: 'steam-windows',
  Unknown: 'unknown'
});

export const BuildIdentityKind = Object.freeze({
  SwitchBid: 'switch-bid',
  SteamFullVersion: 'steam-full-version'
});

export const RuntimeGateStatus = Object.freeze({
  NotRequired: 'NOT_REQUIRED',
  Passed: 'PASSED',
  Pending: 'PENDING',
  Failed: 'FAILED'
});

export const BuildMatchStatus = Object.freeze({
  Exact: 'EXACT',
  UnsupportedBuild: 'UNSUPPORTED_BUILD',
  SchemaMismatch: 'SCHEMA_MISMATCH',
  InvalidTarget: 'INVALID_TARGET'
});

/**
 * Current 01A research contracts only. Do not add a build by analogy.
 * Persistent replacement is intentionally disabled until A4 + required 01E gates close.
 */
export const CURRENT_V125_BUILD_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'ddv-switch-v1.25.0-52BD625D9B4E0053-v624',
    platform: PlatformFamily.Switch,
    gameVersion: '1.25.0',
    profileGameInfoVersion: 624,
    buildIdentity: Object.freeze({
      kind: BuildIdentityKind.SwitchBid,
      value: '52BD625D9B4E0053'
    }),
    codecContract: 'p1g-v0',
    persistentWriteAuthorized: false
  }),
  Object.freeze({
    id: 'ddv-steam-windows-v1.25.0-releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14-v624',
    platform: PlatformFamily.SteamWindows,
    gameVersion: '1.25.0',
    profileGameInfoVersion: 624,
    buildIdentity: Object.freeze({
      kind: BuildIdentityKind.SteamFullVersion,
      value: 'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14'
    }),
    codecContract: 'p1g-v0',
    persistentWriteAuthorized: false
  })
]);

/**
 * @typedef {object} SaveIdentity
 * @property {number|null} profileGameInfoVersion
 * @property {number|null} initialProfileGameInfoVersion
 * @property {string|null} lastSaveDeviceType
 * @property {PlatformFamily} lastSavePlatform
 * @property {PlatformFamily} sourcePlatform
 * @property {'SAME'|'DIFFERENT_CROSS_SAVE_POSSIBLE'|'UNKNOWN'} sourceLastSaveRelationship
 * @property {string|null} sourceRawSha256
 */

/**
 * @typedef {object} TargetBuildIdentity
 * @property {PlatformFamily} platform
 * @property {BuildIdentityKind} kind
 * @property {string} value
 */

/**
 * @typedef {object} BuildContract
 * @property {string} id
 * @property {PlatformFamily} platform
 * @property {string} gameVersion
 * @property {number} profileGameInfoVersion
 * @property {{kind: BuildIdentityKind, value: string}} buildIdentity
 * @property {string} codecContract
 * @property {boolean} persistentWriteAuthorized
 */

/**
 * @param {unknown} root
 * @param {{sourcePlatform?: PlatformFamily, sourceRawSha256?: string|null}} [options]
 * @returns {SaveIdentity}
 */
export function detectSaveIdentity(root, options = {}) {
  const obj = asObject(root);
  const gameInfo = asObject(obj?.GameInfo);
  const lastSaveDeviceInfo = asObject(gameInfo?.LastSaveDeviceInfo);

  const version = asSafeInteger(gameInfo?.Version);
  const initialVersion = asSafeInteger(gameInfo?.InitialVersion);
  const deviceType = typeof lastSaveDeviceInfo?.deviceType === 'string'
    ? lastSaveDeviceInfo.deviceType
    : null;
  const lastSavePlatform = platformFromDeviceType(deviceType);
  const sourcePlatform = normalizePlatform(options.sourcePlatform);

  /** @type {'SAME'|'DIFFERENT_CROSS_SAVE_POSSIBLE'|'UNKNOWN'} */
  let relationship = 'UNKNOWN';
  if (sourcePlatform !== PlatformFamily.Unknown && lastSavePlatform !== PlatformFamily.Unknown) {
    relationship = sourcePlatform === lastSavePlatform
      ? 'SAME'
      : 'DIFFERENT_CROSS_SAVE_POSSIBLE';
  }

  return Object.freeze({
    profileGameInfoVersion: version,
    initialProfileGameInfoVersion: initialVersion,
    lastSaveDeviceType: deviceType,
    lastSavePlatform,
    sourcePlatform,
    sourceLastSaveRelationship: relationship,
    sourceRawSha256: typeof options.sourceRawSha256 === 'string' && options.sourceRawSha256.length > 0
      ? options.sourceRawSha256
      : null
  });
}

/**
 * @param {string|null} deviceType
 * @returns {PlatformFamily}
 */
export function platformFromDeviceType(deviceType) {
  if (deviceType === 'DeviceType_Switch') return PlatformFamily.Switch;
  if (deviceType === 'DeviceType_Windows') return PlatformFamily.SteamWindows;
  return PlatformFamily.Unknown;
}

/**
 * @param {unknown} value
 * @returns {PlatformFamily}
 */
export function normalizePlatform(value) {
  return value === PlatformFamily.Switch || value === PlatformFamily.SteamWindows
    ? value
    : PlatformFamily.Unknown;
}

/**
 * @param {SaveIdentity} saveIdentity
 * @param {TargetBuildIdentity} targetBuild
 * @param {readonly BuildContract[]} [contracts]
 */
export function matchSupportedBuild(saveIdentity, targetBuild, contracts = CURRENT_V125_BUILD_CONTRACTS) {
  if (!isTargetBuildIdentity(targetBuild)) {
    return Object.freeze({ status: BuildMatchStatus.InvalidTarget, contract: null, reason: 'Target build identity is incomplete or invalid.' });
  }

  const candidate = contracts.find((contract) =>
    contract.platform === targetBuild.platform &&
    contract.buildIdentity.kind === targetBuild.kind &&
    contract.buildIdentity.value === targetBuild.value
  ) ?? null;

  if (!candidate) {
    return Object.freeze({ status: BuildMatchStatus.UnsupportedBuild, contract: null, reason: 'Exact target build is not in the supported build registry.' });
  }

  if (saveIdentity.profileGameInfoVersion !== candidate.profileGameInfoVersion) {
    return Object.freeze({
      status: BuildMatchStatus.SchemaMismatch,
      contract: candidate,
      reason: `Profile GameInfo.Version ${String(saveIdentity.profileGameInfoVersion)} does not match build contract ${candidate.profileGameInfoVersion}.`
    });
  }

  return Object.freeze({ status: BuildMatchStatus.Exact, contract: candidate, reason: 'Exact target build and profile version contract match.' });
}

/**
 * @typedef {object} CodecGate
 * @property {boolean} readSupported
 * @property {boolean} encodeSupported
 * @property {boolean} roundTripVerified
 * @property {string} [contract]
 */

/**
 * @typedef {object} OperationGate
 * @property {boolean} structuralCapabilitiesSupported
 * @property {boolean} planSupported
 * @property {boolean} validationPassed
 * @property {RuntimeGateStatus} runtimeGate
 */

/**
 * @typedef {object} PersistenceGate
 * @property {boolean} backupReady
 * @property {boolean} atomicReplaceReady
 * @property {boolean} postCommitVerifyReady
 */

/**
 * @param {{
 *   saveIdentity: SaveIdentity,
 *   targetBuild: TargetBuildIdentity,
 *   codec: CodecGate,
 *   operation: OperationGate,
 *   persistence?: PersistenceGate,
 *   contracts?: readonly BuildContract[]
 * }} args
 */
export function evaluateWriterAuthorization(args) {
  const contracts = args.contracts ?? CURRENT_V125_BUILD_CONTRACTS;
  const build = matchSupportedBuild(args.saveIdentity, args.targetBuild, contracts);
  const exactBuild = build.status === BuildMatchStatus.Exact;
  const codecContractMatches = exactBuild && (
    args.codec.contract === undefined || args.codec.contract === build.contract.codecContract
  );

  const readProfile = Boolean(args.codec.readSupported);
  const planOperation = readProfile && exactBuild && codecContractMatches &&
    args.operation.structuralCapabilitiesSupported && args.operation.planSupported;
  const encodeCopy = planOperation && args.codec.encodeSupported && args.codec.roundTripVerified &&
    args.operation.validationPassed;

  const runtimeReady = args.operation.runtimeGate === RuntimeGateStatus.NotRequired ||
    args.operation.runtimeGate === RuntimeGateStatus.Passed;
  const persistence = args.persistence ?? {
    backupReady: false,
    atomicReplaceReady: false,
    postCommitVerifyReady: false
  };
  const releaseAuthorized = Boolean(build.contract?.persistentWriteAuthorized);
  const persistentReplace = encodeCopy && releaseAuthorized && runtimeReady &&
    persistence.backupReady && persistence.atomicReplaceReady && persistence.postCommitVerifyReady;

  /** @type {{code:string,severity:'INFO'|'WARNING'|'ERROR',message:string}[]} */
  const findings = [];

  if (args.saveIdentity.sourceLastSaveRelationship === 'DIFFERENT_CROSS_SAVE_POSSIBLE') {
    findings.push({
      code: 'SOURCE_LAST_SAVE_PLATFORM_DIFFER',
      severity: 'INFO',
      message: 'Source/storage platform differs from LastSaveDeviceInfo; this can be a legitimate DDV cross-save state and is not itself a write blocker.'
    });
  }
  if (!readProfile) findings.push({ code: 'CODEC_READ_UNSUPPORTED', severity: 'ERROR', message: 'Profile codec did not authorize safe read.' });
  if (!exactBuild) findings.push({ code: build.status, severity: 'ERROR', message: build.reason });
  if (exactBuild && !codecContractMatches) findings.push({ code: 'CODEC_CONTRACT_MISMATCH', severity: 'ERROR', message: 'Codec contract does not match the exact build registry entry.' });
  if (!args.operation.structuralCapabilitiesSupported) findings.push({ code: 'STRUCTURAL_CAPABILITY_UNSUPPORTED', severity: 'ERROR', message: 'Required save structural capability is not supported.' });
  if (!args.operation.planSupported) findings.push({ code: 'OPERATION_PLAN_UNSUPPORTED', severity: 'ERROR', message: 'Operation planning is not supported for this contract.' });
  if (!args.operation.validationPassed) findings.push({ code: 'OPERATION_VALIDATION_FAILED', severity: 'ERROR', message: 'Operation validation has not passed.' });
  if (!args.codec.encodeSupported || !args.codec.roundTripVerified) findings.push({ code: 'ENCODE_COPY_NOT_VERIFIED', severity: 'ERROR', message: 'Safe encoded-copy production is not fully verified.' });
  if (!releaseAuthorized) findings.push({ code: 'PERSISTENT_WRITE_NOT_RELEASE_AUTHORIZED', severity: 'WARNING', message: 'Exact build is known, but the current registry intentionally keeps persistent replacement disabled.' });
  if (!runtimeReady) findings.push({ code: 'RUNTIME_GATE_NOT_READY', severity: 'WARNING', message: `Runtime gate is ${args.operation.runtimeGate}.` });
  if (!persistence.backupReady || !persistence.atomicReplaceReady || !persistence.postCommitVerifyReady) {
    findings.push({ code: 'PERSISTENCE_BOUNDARY_NOT_READY', severity: 'WARNING', message: 'Backup, atomic replacement, and post-commit verification are not all ready.' });
  }

  return Object.freeze({
    build,
    capabilities: Object.freeze({
      readProfile,
      planOperation,
      encodeCopy,
      persistentReplace
    }),
    findings: Object.freeze(findings)
  });
}

/** @param {unknown} value */
function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

/** @param {unknown} value */
function asSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

/** @param {unknown} value */
function isTargetBuildIdentity(value) {
  const obj = asObject(value);
  return Boolean(
    obj &&
    (obj.platform === PlatformFamily.Switch || obj.platform === PlatformFamily.SteamWindows) &&
    (obj.kind === BuildIdentityKind.SwitchBid || obj.kind === BuildIdentityKind.SteamFullVersion) &&
    typeof obj.value === 'string' && obj.value.length > 0
  );
}
