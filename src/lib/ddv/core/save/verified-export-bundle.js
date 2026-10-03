import { TRANSACTION_CANDIDATE_CONTRACT, TRANSACTION_VERIFICATION_CONTRACT } from './transaction-foundation.js';
import { BuildMatchStatus, matchSupportedBuild } from './versioning.js';

const encoder = new TextEncoder();
const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;
const UTF8_FLAG = 0x0800;
const STORE = 0;

/**
 * Build a deterministic browser-download ZIP containing the exact original save,
 * the independently verified edited copy, and a non-sensitive integrity manifest.
 * This is an export boundary only. It never writes a source/destination path.
 */
export async function createVerifiedExportBundle({ result, gameVersion, targetBuild }) {
  requireExportResult(result);
  if (typeof gameVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(gameVersion)) {
    throw new Error('INVALID_GAME_VERSION');
  }
  const target = normalizeTargetBuild(targetBuild);
  const build = matchSupportedBuild(result.saveIdentity, target);
  if (build.status !== BuildMatchStatus.Exact || !build.contract) throw new Error('EXPORT_TARGET_BUILD_NOT_SUPPORTED');
  if (gameVersion !== build.contract.gameVersion) throw new Error('EXPORT_GAME_VERSION_BUILD_MISMATCH');
  if (!result.noOp) {
    const ctx = result.exportContext;
    if (!ctx || typeof ctx !== 'object') throw new Error('EXPORT_VERIFICATION_CONTEXT_REQUIRED');
    if (!sameTargetBuild(ctx.targetBuild, target)) throw new Error('EXPORT_TARGET_BUILD_CONTEXT_MISMATCH');
    if (ctx.exactBuildContractId !== build.contract.id) throw new Error('EXPORT_BUILD_CONTRACT_CONTEXT_MISMATCH');
    if (typeof ctx.codecContract !== 'string' || ctx.codecContract !== build.contract.codecContract) {
      throw new Error('EXPORT_CODEC_CONTRACT_CONTEXT_MISMATCH');
    }
  }

  const backup = result.backupOriginalBytes.slice();
  const edited = result.editedBytes.slice();
  const sourceSha256 = await sha256Hex(backup);
  const editedSha256 = await sha256Hex(edited);
  if (sourceSha256 !== result.sourceRawSha256) throw new Error('BACKUP_SOURCE_HASH_MISMATCH');
  if (typeof result.editedRawSha256 === 'string' && result.editedRawSha256 !== editedSha256) {
    throw new Error('EDITED_OUTPUT_HASH_MISMATCH');
  }
  if (result.authorization?.capabilities?.persistentReplace === true) {
    throw new Error('WEB_EXPORT_MUST_NOT_AUTHORIZE_PERSISTENT_REPLACE');
  }

  const safeVersion = gameVersion.replaceAll('.', '_');
  const backupName = `DDV_BACKUP_original_v${safeVersion}.profile`;
  const editedName = `DDV_EDITED_copy_v${safeVersion}.profile`;
  const manifestName = 'DDV_WAND_EXPORT_MANIFEST.json';
  const manifest = Object.freeze({
    artifact: 'dreamwish.ddv.verified-export-bundle',
    schemaVersion: 1,
    gameVersion,
    targetBuild: target,
    sourceSha256,
    editedSha256,
    backupFile: backupName,
    editedFile: editedName,
    changedPaths: Array.isArray(result.changedPaths) ? [...result.changedPaths] : [],
    noOp: Boolean(result.noOp),
    persistentWriteAuthorized: false
  });
  const manifestBytes = encoder.encode(JSON.stringify(manifest, null, 2) + '\n');
  const zipBytes = buildStoredZip([
    { name: backupName, bytes: backup },
    { name: editedName, bytes: edited },
    { name: manifestName, bytes: manifestBytes }
  ]);
  const bundleSha256 = await sha256Hex(zipBytes);
  return Object.freeze({
    fileName: `DreamwishWand_DDV_VerifiedExport_v${safeVersion}.zip`,
    mimeType: 'application/zip',
    bytes: zipBytes,
    sha256: bundleSha256,
    manifest
  });
}


/**
 * Build the launch browser-local replacement artifact set from an independently
 * verified 01A WRITE_CANDIDATE. The source bytes are never mutated or written.
 */
export async function createVerifiedCandidateExportBundle({
  candidate,
  verification,
  gameVersion,
  targetBuild,
  sourceName = 'profile'
}) {
  requireVerifiedCandidate(candidate, verification);
  if (typeof gameVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(gameVersion)) {
    throw new Error('INVALID_GAME_VERSION');
  }
  const target = normalizeTargetBuild(targetBuild);
  const manifest = candidate.manifest;
  if (!sameTargetBuild(manifest?.input?.targetBuild, target)) {
    throw new Error('EXPORT_TARGET_BUILD_CONTEXT_MISMATCH');
  }
  if (manifest?.input?.gameVersion !== gameVersion) {
    throw new Error('EXPORT_GAME_VERSION_BUILD_MISMATCH');
  }
  if (manifest?.persistentWriteAuthorized !== false ||
      manifest?.WORLD_PERSISTENT_WRITE_V125 !== false ||
      manifest?.capability?.persistentWrite !== false) {
    throw new Error('WEB_EXPORT_MUST_NOT_AUTHORIZE_PERSISTENT_REPLACE');
  }

  const backup = candidate.backupOriginalBytes.slice();
  const edited = candidate.candidateBytes.slice();
  const sourceSha256 = await sha256Hex(backup);
  const editedSha256 = await sha256Hex(edited);
  if (sourceSha256 !== manifest.input.originalSha256 ||
      sourceSha256 !== verification.sourceSha256) {
    throw new Error('BACKUP_SOURCE_HASH_MISMATCH');
  }
  if (editedSha256 !== manifest.output.candidateSha256 ||
      editedSha256 !== verification.candidateSha256) {
    throw new Error('EDITED_OUTPUT_HASH_MISMATCH');
  }

  const safeSourceName = sanitizeSourceName(sourceName);
  const backupName = `DDV_BACKUP_original_${safeSourceName}`;
  const editedName = safeSourceName;
  const integrityName = 'DDV_WAND_EXPORT_MANIFEST.json';
  const integrity = Object.freeze({
    artifact: 'dreamwish.ddv.verified-candidate-export-bundle',
    schemaVersion: 2,
    gameVersion,
    targetBuild: target,
    sourceSha256,
    editedSha256,
    backupFile: backupName,
    editedFile: editedName,
    transactionCandidateContract: TRANSACTION_CANDIDATE_CONTRACT,
    transactionVerificationContract: TRANSACTION_VERIFICATION_CONTRACT,
    candidateManifestSha256: manifest.candidateManifestSha256,
    planSha256: manifest.planSha256,
    planId: manifest.planId,
    operation: Object.freeze({
      id: manifest.operation?.id ?? null,
      kind: manifest.operation?.kind ?? null
    }),
    semanticDiff: structuredClone(manifest.semanticDiff),
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false
  });
  const integrityBytes = encoder.encode(JSON.stringify(integrity, null, 2) + '\n');
  const zipBytes = buildStoredZip([
    { name: backupName, bytes: backup },
    { name: editedName, bytes: edited },
    { name: integrityName, bytes: integrityBytes }
  ]);
  const bundleSha256 = await sha256Hex(zipBytes);

  return Object.freeze({
    contract: 'dreamwish.ddv.verified-candidate-browser-export@1',
    bundle: Object.freeze({
      fileName: `DreamwishWand_DDV_VerifiedExport_v${gameVersion.replaceAll('.', '_')}.zip`,
      mimeType: 'application/zip',
      bytes: zipBytes,
      sha256: bundleSha256
    }),
    edited: Object.freeze({
      fileName: editedName,
      mimeType: 'application/octet-stream',
      bytes: edited,
      sha256: editedSha256
    }),
    backup: Object.freeze({
      fileName: backupName,
      mimeType: 'application/octet-stream',
      bytes: backup,
      sha256: sourceSha256
    }),
    integrity: Object.freeze({
      fileName: integrityName,
      mimeType: 'application/json',
      bytes: integrityBytes,
      manifest: integrity
    }),
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false
  });
}

function requireVerifiedCandidate(candidate, verification) {
  if (!candidate || typeof candidate !== 'object' ||
      candidate.manifest?.contract !== TRANSACTION_CANDIDATE_CONTRACT ||
      !(candidate.backupOriginalBytes instanceof Uint8Array) ||
      !(candidate.candidateBytes instanceof Uint8Array)) {
    throw new Error('INVALID_TRANSACTION_CANDIDATE');
  }
  if (!verification || verification.contract !== TRANSACTION_VERIFICATION_CONTRACT ||
      verification.status !== 'PASS' ||
      verification.planId !== candidate.manifest.planId) {
    throw new Error('CANDIDATE_INDEPENDENT_VERIFICATION_REQUIRED');
  }
}

function sanitizeSourceName(value) {
  const name = String(value ?? '').trim().replace(/[\\/\u0000-\u001f\u007f]/g, '_');
  if (!name || name === '.' || name === '..') return 'profile';
  return name.slice(0, 180);
}

function requireExportResult(value) {
  if (!value || typeof value !== 'object') throw new Error('INVALID_EXPORT_RESULT');
  if (!(value.backupOriginalBytes instanceof Uint8Array) || value.backupOriginalBytes.length === 0) throw new Error('INVALID_BACKUP_BYTES');
  if (!(value.editedBytes instanceof Uint8Array) || value.editedBytes.length === 0) throw new Error('INVALID_EDITED_BYTES');
  if (typeof value.sourceRawSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.sourceRawSha256)) throw new Error('INVALID_SOURCE_SHA256');
  if (!Array.isArray(value.changedPaths)) throw new Error('INVALID_CHANGED_PATHS');
}

function normalizeTargetBuild(value) {
  if (!value || typeof value !== 'object') throw new Error('INVALID_TARGET_BUILD');
  if (typeof value.platform !== 'string' || typeof value.kind !== 'string' || typeof value.value !== 'string' || value.value.length === 0) {
    throw new Error('INVALID_TARGET_BUILD');
  }
  return Object.freeze({ platform: value.platform, kind: value.kind, value: value.value });
}

function sameTargetBuild(a, b) {
  return Boolean(a && b && a.platform === b.platform && a.kind === b.kind && a.value === b.value);
}

function buildStoredZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 0xffff) throw new Error('ZIP_ENTRY_COUNT_INVALID');
  const names = new Set();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    if (!entry || typeof entry.name !== 'string' || entry.name.length === 0 || !(entry.bytes instanceof Uint8Array)) throw new Error('ZIP_ENTRY_INVALID');
    if (names.has(entry.name)) throw new Error('ZIP_DUPLICATE_ENTRY_NAME');
    names.add(entry.name);
    const name = encoder.encode(entry.name);
    if (name.length > 0xffff || entry.bytes.length > 0xffffffff) throw new Error('ZIP64_UNSUPPORTED');
    const crc = crc32(entry.bytes);

    const local = new Uint8Array(30 + name.length + entry.bytes.length);
    const lv = new DataView(local.buffer);
    set32(lv, 0, ZIP_LOCAL); set16(lv, 4, 20); set16(lv, 6, UTF8_FLAG); set16(lv, 8, STORE);
    set16(lv, 10, 0); set16(lv, 12, 0x0021); set32(lv, 14, crc);
    set32(lv, 18, entry.bytes.length); set32(lv, 22, entry.bytes.length); set16(lv, 26, name.length); set16(lv, 28, 0);
    local.set(name, 30); local.set(entry.bytes, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    set32(cv, 0, ZIP_CENTRAL); set16(cv, 4, 20); set16(cv, 6, 20); set16(cv, 8, UTF8_FLAG); set16(cv, 10, STORE);
    set16(cv, 12, 0); set16(cv, 14, 0x0021); set32(cv, 16, crc);
    set32(cv, 20, entry.bytes.length); set32(cv, 24, entry.bytes.length); set16(cv, 28, name.length); set16(cv, 30, 0); set16(cv, 32, 0);
    set16(cv, 34, 0); set16(cv, 36, 0); set32(cv, 38, 0); set32(cv, 42, offset);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = centralParts.reduce((n, x) => n + x.length, 0);
  if (centralOffset > 0xffffffff || centralSize > 0xffffffff) throw new Error('ZIP64_UNSUPPORTED');
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  set32(ev, 0, ZIP_EOCD); set16(ev, 4, 0); set16(ev, 6, 0); set16(ev, 8, entries.length); set16(ev, 10, entries.length);
  set32(ev, 12, centralSize); set32(ev, 16, centralOffset); set16(ev, 20, 0);
  return concat(...localParts, ...centralParts, eocd);
}

let CRC_TABLE;
function crc32(data) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('WEB_CRYPTO_SHA256_UNAVAILABLE');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function set16(v,o,x){v.setUint16(o,x&0xffff,true);}
function set32(v,o,x){v.setUint32(o,x>>>0,true);}
function concat(...arrays){const n=arrays.reduce((s,a)=>s+a.length,0);const out=new Uint8Array(n);let o=0;for(const a of arrays){out.set(a,o);o+=a.length;}return out;}
