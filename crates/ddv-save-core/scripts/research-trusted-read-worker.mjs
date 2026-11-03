// W-CORE-004 isolated Worker transport prototype. NOT imported by products.
// This adapter intentionally does NOT instantiate or authenticate a Rust WASM
// module; the injected object MUST eventually be a trusted, independently
// accepted Wand-owned Core module. Until then PRODUCT_READ_ENABLED=false.
// No legacy save Writer, source-metadata trust, remote API or persistence.
export const PRODUCT_READ_ENABLED = false;
export const PRODUCT_WRITER_ENABLED = false;
const MAX_ROWS = 64;
const MAX_ROW_UTF8 = 64 * 1024;
const MAX_PAGE_UTF8 = 2 * 1024 * 1024;
const encoder = new TextEncoder();

const plain = (x) => x !== null && typeof x === 'object' &&
  !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
function keysExactly(message, allowed) {
  return plain(message) && Object.keys(message).every((k) => allowed.includes(k)) &&
    allowed.every((k) => Object.hasOwn(message, k));
}
const deny = (reason) => Object.freeze({ ok: false, reason });
function validatedPage(page) {
  if (!plain(page) || !Array.isArray(page.rows) || page.rows.length > MAX_ROWS ||
      !Number.isSafeInteger(page.total_w1_rows) || page.total_w1_rows < page.rows.length ||
      typeof page.complete !== 'boolean' ||
      (page.complete ? page.next_cursor !== null :
        typeof page.next_cursor !== 'string' || page.next_cursor.length > 256)) {
    throw Error('CORE_READ_PAGE_SHAPE_DENIED');
  }
  if (page.product_read_worker_accepted !== false ||
      page.product_writer_authorized !== false ||
      page.full_domain_reference_closure_complete !== false) {
    throw Error('CORE_READ_UNACCEPTED_PRODUCT_CLAIM');
  }
  for (const row of page.rows) {
    if (!plain(row) || encoder.encode(JSON.stringify(row)).byteLength > MAX_ROW_UTF8) {
      throw Error('CORE_READ_ROW_BOUNDS');
    }
  }
  if (encoder.encode(JSON.stringify(page)).byteLength > MAX_PAGE_UTF8) {
    throw Error('CORE_READ_PAGE_BOUNDS');
  }
  return Object.freeze(page);
}
/**
 * Research-local adapter only; do not install as navigator Worker handler.
 * Actual product acceptance requires genuine Rust/WASM identity, opaque
 * Core-owned cursor+source/session binding and independent Chrome/device QA.
 * None of the input messages can mint Session ID, Revision or capability.
 */
export function createResearchReadIngress(core) {
  if (!plain(core) && (typeof core !== 'object' || core === null)) {
    throw TypeError('CORE_HOST_NOT_TRUSTED');
  }
  for (const name of ['openLocalTrusted', 'queryIndexedPage', 'close']) {
    if (typeof core[name] !== 'function') throw TypeError('CORE_ABI_NOT_AVAILABLE');
  }
  let generation = 0;
  let lease = null;
  const retire = () => {generation++; const old = lease; lease = null; return old;};
  async function dispatch(message) {
    if (!plain(message) || typeof message.type !== 'string') {
      return deny('WORKER_MESSAGE_INVALID');
    }
    switch (message.type) {
      case 'OPEN_LOCAL': {
        if (!keysExactly(message, ['type', 'bytes']) ||
            !(message.bytes instanceof Uint8Array) ||
            message.bytes.length === 0 || message.bytes.length > 256 * 1024 * 1024) {
          return deny('WORKER_OPEN_BOUNDS_OR_FAKE_METADATA');
        }
        // A is invalidated before B opens, even when B is malformed.
        const old = retire();
        if (old) {
          try { await core.close(old); } catch { /* remain revoked */ }
        }
        const started = generation;
        try {
          // Core itself must derive SHA, index, session and trusted BID.
          const ticket = await core.openLocalTrusted(message.bytes);
          if (started !== generation) {
            await core.close(ticket);
            return deny('WORKER_STALE_OPEN_RESULT');
          }
          if (!plain(ticket) || !Number.isSafeInteger(ticket.session_id) ||
              !Number.isSafeInteger(ticket.index_generation) ||
              ticket.product_read_worker_accepted !== false ||
              ticket.product_writer_authorized !== false) {
            await core.close(ticket);
            return deny('WORKER_UNTRUSTED_CORE_TICKET');
          }
          lease = ticket;
          return Object.freeze({ ok: true, ticket: { session_id: ticket.session_id,
            revision: ticket.revision, index_generation: ticket.index_generation },
            productReadAccepted: false, productWriterAuthorized: false });
        } catch {
          return deny('WORKER_CORE_OPEN_DENIED');
        }
      }
      case 'QUERY_W1_PAGE': {
        if (!keysExactly(message, ['type', 'cursor', 'limit']) ||
            !(message.cursor === null || typeof message.cursor === 'string') ||
            (typeof message.cursor === 'string' && message.cursor.length > 256) ||
            !Number.isInteger(message.limit) || message.limit < 1 || message.limit > MAX_ROWS) {
          return deny('WORKER_QUERY_INVALID_OR_FORGED_CLAIM');
        }
        if (!lease) return deny('WORKER_NO_LIVE_SESSION');
        const current = generation;
        const ownedLease = lease;
        try {
          const page = await core.queryIndexedPage(ownedLease, message.cursor, message.limit);
          // Never egress A's late page after B open, CLOSE, or navigation.
          if (current !== generation || lease !== ownedLease) return deny('WORKER_STALE_QUERY_REPLY');
          return Object.freeze({ ok: true, page: validatedPage(page),
            productReadAccepted: false, productWriterAuthorized: false });
        } catch {
          return deny('WORKER_CORE_PAGE_DENIED');
        }
      }
      case 'CLOSE': {
        if (!keysExactly(message, ['type'])) return deny('WORKER_CLOSE_INVALID');
        const old = retire();
        if (old) {
          try { await core.close(old); } catch { /* revoked regardless */ }
        }
        return Object.freeze({ ok: true, productReadAccepted: false,
          productWriterAuthorized: false });
      }
      default:
        // Encode/edit/undo/apply/export and all unsupported requests fail closed.
        return deny('PRODUCT_SAVE_OPERATION_NOT_ACCEPTED');
    }
  }
  return Object.freeze({ dispatch,
    revokeForNavigation: async () => { const old = retire(); if (old) {
      try { await core.close(old); } catch { /* revoked */ }
    } }
  });
}
