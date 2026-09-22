/**
 * Dreamwish Wand – transitional v1 Worker RPC boundary.
 * DDV v1.24.13 / GameInfo.Version 608 ONLY.
 * This describes the isolated standalone experiment; it is NOT an integrated
 * SvelteKit codec and does NOT promise large-save support or game acceptance.
 *
 * The UI sends only exact, selected leaf-amount edit descriptors. Never send a
 * whole parsed profile to the Worker for each operation. The Worker owns the
 * parsed verified session and the original input bytes until terminated.
 */
export const CORE_WORKER_PROTOCOL = 1 as const;
export type CoreWorkerProtocol = typeof CORE_WORKER_PROTOCOL;

export interface ContainerAmountEntry {
  kind: 'container';
  containerKey: string;
  slotIndex: number;
  itemID: number;
  amount: number;
  path: string;
  editable: boolean;
}
export interface ListAmountEntry {
  kind: 'list';
  listKey: string;
  itemID: number;
  amount: number;
  path: string;
  editable: boolean;
}
export type AmountEdit = { entry: ContainerAmountEntry | ListAmountEntry; next: number };

export type CoreRequest =
  | { protocol: CoreWorkerProtocol; id: number; op: 'open'; bytes: ArrayBuffer }
  | { protocol: CoreWorkerProtocol; id: number; op: 'export'; sessionId: number; edits: AmountEdit[] };

/** Transitional open response. jsonText is an additional full-size copy: replace
 * with paginated query results before declaring 100–200 MiB decoded support. */
export type OpenResult = { inputType: 'plain' | 'encrypted'; jsonText: string; version: 608 };
export type ExportResult = {
  format: 'plain' | 'encrypted';
  backupOriginalBytes: Uint8Array;
  editedBytes: Uint8Array;
  changedPaths: string[];
  sourceVersion: 608;
  noOp: boolean;
};
export type CoreResponse =
  | { protocol: CoreWorkerProtocol; id: number; ok: true; result: OpenResult | ExportResult }
  | { protocol: CoreWorkerProtocol; id: number; ok: false; error: string };

export function isCoreResponse(value: unknown): value is CoreResponse {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Record<string, unknown>;
  if (msg.protocol !== CORE_WORKER_PROTOCOL ||
      !Number.isSafeInteger(msg.id) || (msg.id as number) < 1 ||
      typeof msg.ok !== 'boolean') return false;
  return msg.ok === false ? typeof msg.error === 'string' :
    !!msg.result && typeof msg.result === 'object';
}
