import {
  BuildIdentityKind,
  PlatformFamily,
  ProfileReadCompatibilityStatus,
  detectSaveIdentity,
  matchProfileReadContract
} from './versioning.js';

export const PROFILE626_STATIC_GATE_CONTRACT = 'ddv.save.profile626-serialization-structural-gate@1';
export const PROFILE626_SCHEMA_VERSION = 626;
export const PROFILE626_GAME_VERSION = '1.25.3';

export const PROFILE626_SWITCH_TARGET = Object.freeze({
  platform: PlatformFamily.Switch,
  kind: BuildIdentityKind.SwitchBid,
  value: '9A239D3DB569756D'
});

export const PROFILE626_STEAM_TARGET = Object.freeze({
  platform: PlatformFamily.SteamWindows,
  kind: BuildIdentityKind.SteamFullVersion,
  value: 'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'
});

const HARD_FLAGS = Object.freeze({
  persistentWriteAuthorized: false,
  WORLD_PERSISTENT_WRITE_V125: false,
  PERSISTENT_WRITE: false,
  productApplyAuthorized: false,
  directSourceReplacementAuthorized: false,
  localSaveWriterAuthorized: false,
  verifiedReplacementCandidateAuthorized: false
});

/**
 * Static/read-only v1.25.3 gate. This deliberately does not use the writer
 * authorization registry and cannot produce an encoded replacement candidate.
 *
 * @param {{
 *   profile: Record<string, unknown>,
 *   targetBuild: import('./versioning.js').TargetBuildIdentity,
 *   sourcePlatform?: import('./versioning.js').PlatformFamily,
 *   sourceRawSha256?: string|null
 * }} args
 */
export function evaluateProfile626ReadOnlyCompatibility(args) {
  const structural = inspectProfile626Structure(args?.profile);
  const saveIdentity = detectSaveIdentity(args?.profile, {
    sourcePlatform: args?.sourcePlatform,
    sourceRawSha256: args?.sourceRawSha256 ?? null
  });
  const readMatch = matchProfileReadContract(saveIdentity, args?.targetBuild);

  const exactStaticTarget = structural.valid &&
    structural.profileGameInfoVersion === PROFILE626_SCHEMA_VERSION &&
    readMatch.status === ProfileReadCompatibilityStatus.StaticCompatibleRuntimePending &&
    readMatch.contract?.gameVersion === PROFILE626_GAME_VERSION;

  const productionAccepted = structural.valid &&
    readMatch.status === ProfileReadCompatibilityStatus.ExactAccepted;

  const findings = [];
  if (!structural.valid) {
    findings.push({ code: structural.code, severity: 'ERROR', message: structural.message });
  }
  if (readMatch.status === ProfileReadCompatibilityStatus.SchemaMismatch ||
      readMatch.status === ProfileReadCompatibilityStatus.UnsupportedBuild ||
      readMatch.status === ProfileReadCompatibilityStatus.InvalidTarget) {
    findings.push({ code: readMatch.status, severity: 'ERROR', message: readMatch.reason });
  } else if (readMatch.status === ProfileReadCompatibilityStatus.StaticCompatibleRuntimePending) {
    findings.push({
      code: 'SCHEMA626_REAL_SAVE_RUNTIME_ACCEPTANCE_PENDING',
      severity: 'WARNING',
      message: 'Static protobuf/profile compatibility is closed, but a DDV-produced schema 626 save has not completed the version-specific read-only runtime gate.'
    });
  }

  return deepFreeze({
    contract: PROFILE626_STATIC_GATE_CONTRACT,
    gameVersion: PROFILE626_GAME_VERSION,
    saveIdentity,
    targetBuild: freezeTarget(args?.targetBuild),
    readMatch,
    structural,
    capabilities: {
      offlineReadInspectionAllowed: Boolean(exactStaticTarget || productionAccepted),
      productionReadAccepted: Boolean(productionAccepted),
      structuralReadOnly: Boolean(exactStaticTarget || productionAccepted),
      planOperation: false,
      encodeCopy: false,
      verifiedReplacementCandidate: false,
      localSaveWriter: false,
      persistentWrite: false
    },
    hardFlags: HARD_FLAGS,
    findings
  });
}

/**
 * Structural checks intentionally stay minimal and preservation-oriented.
 * Static comparison proves the generated protobuf model declarations are unchanged
 * between schema 624 and 626; this function must not invent required new fields.
 */
export function inspectProfile626Structure(profile) {
  const root = asObject(profile);
  if (!root) return invalid('PROFILE626_ROOT_INVALID', 'Profile root must be an object.');
  const gameInfo = asObject(root.GameInfo);
  const player = asObject(root.Player);
  const world = asObject(root.World);
  if (!gameInfo || !player || !world) {
    return invalid('PROFILE626_REQUIRED_SECTIONS_MISSING', 'GameInfo, Player, and World objects are required.');
  }
  const version = toSafeInteger(gameInfo.Version);
  if (version !== PROFILE626_SCHEMA_VERSION) {
    return invalid('PROFILE626_SCHEMA_MISMATCH', `Expected GameInfo.Version 626; received ${String(version)}.`, version);
  }
  return Object.freeze({
    valid: true,
    code: 'PROFILE626_STRUCTURE_STATIC_COMPATIBLE',
    message: 'Required profile root is present and schema is 626.',
    profileGameInfoVersion: version,
    rootKeys: Object.freeze(Object.keys(root).slice().sort())
  });
}

function invalid(code, message, version = null) {
  return Object.freeze({
    valid: false,
    code,
    message,
    profileGameInfoVersion: version,
    rootKeys: Object.freeze([])
  });
}
function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function toSafeInteger(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}
function freezeTarget(value) {
  if (!value || typeof value !== 'object') return null;
  return Object.freeze({
    platform: value.platform,
    kind: value.kind,
    value: value.value
  });
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
