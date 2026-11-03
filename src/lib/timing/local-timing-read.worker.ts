// 01A: real local P1G decoding and registry projection run entirely inside
// this browser Worker. No profile, key, original ciphertext or edit command
// is forwarded to the UI or network.
import { openWorldSaveBytes } from '$lib/wep/world-save-source';
import {
  projectRecurringEventsReadonly, filterRecurringEventsReadonly
} from './recurring-readonly.mjs';
import { createTimingWorkerReadCore } from './local-worker-read-core.mjs';

const core = createTimingWorkerReadCore({
  openSave: openWorldSaveBytes,
  project: projectRecurringEventsReadonly,
  filter: filterRecurringEventsReadonly
});
const own = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const allowed = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every(k => keys.includes(k));
const safeError = (error: unknown) =>
  error instanceof Error && /^READ_[A-Z0-9_]+$/.test(error.message)
    ? error.message : 'READ_SAVE_OR_REGISTRY_REJECTED';

self.addEventListener('message', (event: MessageEvent) => {
  const message = event.data;
  const id = own(message) && Number.isSafeInteger(message.id) &&
    Number(message.id) > 0 ? Number(message.id) : null;
  if (id === null) return;
  void (async () => {
    try {
      if (message.type === 'OPEN_FILE') {
        // New open invalidates A before any async B operation or validation.
        if (!allowed(message, ['id', 'type', 'file', 'buildId', 'sourceConfirmed', 'registry'])) {
          core.close();
          throw Error('READ_FORGED_OPEN_REQUEST');
        }
        const result = await core.open({
          file: message.file, buildId: message.buildId,
          sourceConfirmed: message.sourceConfirmed, registry: message.registry
        });
        self.postMessage({ id, ok: true, result });
      } else if (message.type === 'QUERY') {
        if (!allowed(message, ['id', 'type', 'search', 'cursor', 'limit']))
          throw Error('READ_FORGED_QUERY_REQUEST');
        const result = await core.query({
          search: message.search, cursor: message.cursor, limit: message.limit
        });
        self.postMessage({ id, ok: true, result });
      } else if (message.type === 'CLOSE') {
        if (!allowed(message, ['id', 'type']))
          throw Error('READ_FORGED_CLOSE_REQUEST');
        self.postMessage({ id, ok: true, result: core.close() });
      } else {
        throw Error('READ_WRITER_OPERATION_DISABLED');
      }
    } catch (error) {
      self.postMessage({ id, ok: false, error: safeError(error) });
    }
  })();
});

// Worker bootstrap handshake prevents UI file input before module imports finish.
self.postMessage({ id: 0, ready: true, writerAuthorized: false });
