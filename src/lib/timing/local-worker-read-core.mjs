// Wand 01A — local read-only timing Session/Cursor boundary (no editor engine).
// Worker owns the save, crypto state, search, and all pagination. Never serialize
// the profile, P1G bytes, key or the decoded document back to a UI thread.
export const TIMING_WORKER_READ_CONTRACT = 'wand.timing.local-worker-read@1';
export const TIMING_WORKER_WRITER_ENABLED = false;
export const TIMING_WORKER_PRODUCT_RUST_ACCEPTED = false;
export const SWITCH_1253_BID = '9A239D3DB569756D';
const MAX_CIPHERTEXT = 128 * 1024 * 1024; // existing accepted JS Codec hard cap
const MAX_PAGE = 64;
const MAX_ROWS = 20000;
const MAX_ROW_UTF8 = 16384;
const MAX_MESSAGE_UTF8 = 1024 * 1024;
const encoder = new TextEncoder();
const hexadecimal = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const cleanQuery = value => {
  if (typeof value !== 'string' || value.length > 120) throw Error('READ_SEARCH_BOUNDS');
  return value.trim().toLocaleLowerCase();
};
function fail(code) { throw Error(code); }

/**
 * A local Reader/Worker transport; it never acts as a Rust writer or grants a
 * trusted Rust production Worker capability. This migrates main's already
 * accepted schema626 JS P1G READ into a private Worker for the first operable
 * vertical slice while PR348 native Rust/raw WASM bridge is independently gated.
 */
export function createTimingWorkerReadCore({
  openSave, project, filter, loadRegistry, cryptoRef = globalThis.crypto
}) {
  if (typeof openSave !== 'function' || typeof project !== 'function' ||
      typeof filter !== 'function' || typeof loadRegistry !== 'function' ||
      !cryptoRef?.subtle || !cryptoRef?.getRandomValues)
    throw Error('READ_TRUSTED_WORKER_CRYPTO_UNAVAILABLE');

  let epoch = 0;
  let state = null;

  const revoke = () => { epoch += 1; state = null; };
  async function open({ file, buildId, sourceConfirmed }) {
    // Revocation precedes all await points, including a malformed B source.
    revoke();
    const generation = epoch;
    if (!(file instanceof Blob) || !file.size || file.size > MAX_CIPHERTEXT)
      fail('READ_FILE_BOUNDS');
    // Explicit external attestation, not a cryptographic BID recovered from P1G.
    if (sourceConfirmed !== true || buildId !== SWITCH_1253_BID)
      fail('READ_EXTERNAL_BUILD_REQUIRED');
    // Registry comes from the fixed Worker-owned same-origin asset loader,
    // never from caller-provided metadata or a user-supplied Registry object.
    const registry = await loadRegistry();
    if (generation !== epoch) fail('READ_OPEN_REVOKED');
    if (!record(registry)) fail('READ_REGISTRY_MISSING');
    // Only the Worker can mint a new Session/HMAC key, never a UI-supplied ID.
    const nonce = new Uint8Array(16);
    const secret = new Uint8Array(32);
    cryptoRef.getRandomValues(nonce);
    cryptoRef.getRandomValues(secret);
    const sessionId = hexadecimal(nonce);
    const hmacKey = await cryptoRef.subtle.importKey(
      'raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    secret.fill(0);
    if (generation !== epoch) fail('READ_OPEN_REVOKED');

    let source = new Uint8Array(await file.arrayBuffer());
    if (generation !== epoch) fail('READ_OPEN_REVOKED');
    const sourceSha256 = hexadecimal(new Uint8Array(await cryptoRef.subtle.digest('SHA-256', source)));
    if (generation !== epoch) fail('READ_OPEN_REVOKED');
    const opened = await openSave(source, {
      sourcePlatform: 'switch',
      targetBuild: { platform: 'switch', kind: 'switch-bid', value: buildId },
      sourceEvidence: 'switch-exefs-bid-externally-verified'
    });
    // The existing JS Codec owns all decoding here; the Rust writer remains OFF.
    source = null;
    if (generation !== epoch) fail('READ_OPEN_REVOKED');
    if (opened?.inputFormat !== 'packaged' ||
        opened?.profileSchemaVersion !== 626 ||
        opened?.compatibility?.productionReadAccepted !== true ||
        opened?.compatibility?.readOnly !== true ||
        opened?.compatibility?.editingAuthorized !== false ||
        opened?.compatibility?.persistentWriteAuthorized !== false)
      fail('READ_SCHEMA626_CONTRACT_DENIED');

    const projected = project(opened.profile, registry);
    if (generation !== epoch) fail('READ_OPEN_REVOKED');
    if (projected?.writerAuthorized !== false ||
        projected?.encodeCopyAuthorized !== false ||
        !Array.isArray(projected?.rows) || projected.rows.length > MAX_ROWS)
      fail('READ_W1_PROJECTION_DENIED');
    state = {
      sessionId, epoch: generation, sourceSha256, hmacKey,
      rows: projected.rows, savedContainerCount: projected.savedContainerCount,
      unsupportedContainerCount: projected.unsupportedContainerCount,
      searchScope: null, pendingCursor: null, nextOffset: 0, finished: false,
      queryGeneration: 0, queryBusy: false
    };
    return {
      sessionId, revision: 0, indexGeneration: generation,
      sourceSha256, sourceSchema: 626,
      savedContainerCount: projected.savedContainerCount,
      unsupportedContainerCount: projected.unsupportedContainerCount,
      productRustWorkerAccepted: false, writerAuthorized: false,
      sourceIdentity: 'externally-attested-switch-bid'
    };
  }

  async function query({ search = '', cursor = null, limit = MAX_PAGE } = {}) {
    const q = cleanQuery(search);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE ||
        !(cursor === null || (typeof cursor === 'string' && cursor.length <= 160)))
      fail('READ_QUERY_BOUNDS');
    const s = state;
    if (!s) fail('READ_SESSION_NOT_OPEN');
    if (s.queryBusy) fail('READ_QUERY_CONCURRENT_DENIED');
    // Reserve the cursor before async signing to defeat concurrent reuse.
    if (cursor === null) {
      s.searchScope = q;
      s.nextOffset = 0;
      s.pendingCursor = null;
      s.finished = false;
      s.queryGeneration += 1;
    } else if (s.finished || s.searchScope !== q ||
        cursor !== s.pendingCursor || !cursor.startsWith('w1r1.')) {
      fail('READ_CURSOR_REPLAY_OR_SCOPE');
    }
    if (s.finished) fail('READ_CURSOR_EXHAUSTED');
    s.pendingCursor = null; // consumed, even if an unrelated concurrent query arrives
    const ownQueryGen = s.queryGeneration;
    s.queryBusy = true;
    try {
      const results = filter(s.rows, q);
      const offset = s.nextOffset;
      const pageRows = results.slice(offset, offset + limit);
      if (pageRows.length > MAX_PAGE ||
          pageRows.some(row => encoder.encode(JSON.stringify(row)).byteLength > MAX_ROW_UTF8) ||
          encoder.encode(JSON.stringify(pageRows)).byteLength > MAX_MESSAGE_UTF8)
        fail('READ_PAGE_OUTPUT_BOUNDS');
      const end = offset + pageRows.length;
      const complete = end === results.length;
      let nextCursor = null;
      if (!complete) {
        const identity = [TIMING_WORKER_READ_CONTRACT, s.sessionId,
          s.epoch, s.sourceSha256, s.queryGeneration, q, end].join('|');
        const sig = new Uint8Array(await cryptoRef.subtle.sign(
          'HMAC', s.hmacKey, encoder.encode(identity)
        ));
        nextCursor = 'w1r1.' + String(end) + '.' + hexadecimal(sig);
      }
      if (epoch !== s.epoch || state !== s || ownQueryGen !== s.queryGeneration)
        fail('READ_QUERY_STALE');
      s.nextOffset = end;
      s.finished = complete;
      s.pendingCursor = nextCursor;
      return {
        sessionId: s.sessionId, revision: 0, indexGeneration: s.epoch,
        sourceSha256: s.sourceSha256,
        total: results.length, rows: pageRows, nextCursor, complete,
        productRustWorkerAccepted: false, writerAuthorized: false
      };
    } finally {
      s.queryBusy = false;
    }
  }

  function close() { revoke(); return { closed: true, writerAuthorized: false }; }
  function status() { return Object.freeze({ active: Boolean(state), epoch,
    writerAuthorized: false, productRustWorkerAccepted: false }); }
  return Object.freeze({ open, query, close, status });
}
