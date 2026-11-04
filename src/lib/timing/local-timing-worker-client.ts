import { getSingleSaveSessionBridge } from '$lib/ddv/core/save/local-save-session-bridge.mjs';
// Bundled as a separate Vite module Worker; never enable Writer commands.
export const TIMING_LOCAL_WORKER_READ_ENABLED = true;
export const TIMING_LOCAL_WORKER_WRITER_ENABLED = false;
export function createTimingLocalReadWorker(): Worker {
  return new Worker(new URL('./local-timing-read.worker.ts', import.meta.url), {
    type: 'module', name: 'wand-local-timing-read'
  });
}

/** Shared typed READ owner. Never construct per-route Workers: navigation
 * retains one trusted source in this browser tab until explicit Close/Destroy.
 * Native Rust Writer and all unaccepted command types remain fail closed.
 */
export function getLocalSaveSessionBridge() {
  return getSingleSaveSessionBridge(createTimingLocalReadWorker);
}
