import { getSingleSaveSessionBridge } from '$lib/ddv/core/save/local-save-session-bridge.mjs';
// Bundled as a separate Vite module Worker; never enable Writer commands.
export const TIMING_LOCAL_WORKER_READ_ENABLED = true;
export const TIMING_LOCAL_WORKER_WRITER_ENABLED = false;
export function createTimingLocalReadWorker(): Worker {
  return new Worker(new URL('./local-timing-read.worker.ts', import.meta.url), {
    type: 'module', name: 'wand-local-timing-read'
  });
}

/** Same Worker-owned local SaveSession is shared across Collection, Detail,
 * Timing and World Editor within this browser tab. No Writer methods. */
export function getLocalSaveSessionBridge() {
  return getSingleSaveSessionBridge(createTimingLocalReadWorker);
}
