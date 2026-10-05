export const WORLD_EDITOR_HANDOFF_SCHEMA = 'dreamwish-wand-world-editor-handoff@1';
export const WORLD_EDITOR_HANDOFF_STORAGE_KEY = 'dreamwishwand:world-editor:handoff:v1';

export type WorldEditorHandoff =
  | {
      schema: typeof WORLD_EDITOR_HANDOFF_SCHEMA;
      version: 1;
      sourceSurface: 'explore';
      intent: 'ITEM';
      itemId: number;
      createdAt: string;
      persistentWriteAuthorized: false;
      productApplyAuthorized: false;
      directSourceReplacementAuthorized: false;
    }
  | {
      schema: typeof WORLD_EDITOR_HANDOFF_SCHEMA;
      version: 1;
      sourceSurface: 'moodboard';
      intent: 'MOODBOARD';
      boardId: string;
      referenceId: string | null;
      groupId: string | null;
      createdAt: string;
      persistentWriteAuthorized: false;
      productApplyAuthorized: false;
      directSourceReplacementAuthorized: false;
    };

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function stamp(value = new Date().toISOString()) {
  const parsed = new Date(value);
  assert(!Number.isNaN(parsed.getTime()), 'WEP_HANDOFF_TIMESTAMP_INVALID');
  return parsed.toISOString();
}

function safety() {
  return {
    persistentWriteAuthorized: false as const,
    productApplyAuthorized: false as const,
    directSourceReplacementAuthorized: false as const
  };
}

export function createExploreItemHandoff(
  itemId: number,
  createdAt?: string
): WorldEditorHandoff {
  assert(Number.isSafeInteger(itemId) && itemId > 0, 'WEP_HANDOFF_ITEM_ID_INVALID');
  return Object.freeze({
    schema: WORLD_EDITOR_HANDOFF_SCHEMA,
    version: 1 as const,
    sourceSurface: 'explore' as const,
    intent: 'ITEM' as const,
    itemId,
    createdAt: stamp(createdAt),
    ...safety()
  });
}

export function createMoodboardHandoff(
  boardId: string,
  {
    referenceId = null,
    groupId = null,
    createdAt
  }: {
    referenceId?: string | null;
    groupId?: string | null;
    createdAt?: string;
  } = {}
): WorldEditorHandoff {
  const normalizedBoardId = String(boardId ?? '').trim();
  assert(normalizedBoardId, 'WEP_HANDOFF_BOARD_ID_REQUIRED');
  return Object.freeze({
    schema: WORLD_EDITOR_HANDOFF_SCHEMA,
    version: 1 as const,
    sourceSurface: 'moodboard' as const,
    intent: 'MOODBOARD' as const,
    boardId: normalizedBoardId,
    referenceId: referenceId ? String(referenceId) : null,
    groupId: groupId ? String(groupId) : null,
    createdAt: stamp(createdAt),
    ...safety()
  });
}

export function normalizeWorldEditorHandoff(value: unknown): WorldEditorHandoff {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'WEP_HANDOFF_INVALID');
  const input = value as Record<string, unknown>;
  assert(input.schema === WORLD_EDITOR_HANDOFF_SCHEMA, 'WEP_HANDOFF_SCHEMA_MISMATCH');
  assert(Number(input.version) === 1, 'WEP_HANDOFF_VERSION_MISMATCH');
  assert(input.persistentWriteAuthorized === false, 'WEP_HANDOFF_PERSISTENT_WRITE_FORBIDDEN');
  assert(input.productApplyAuthorized === false, 'WEP_HANDOFF_PRODUCT_APPLY_FORBIDDEN');
  assert(input.directSourceReplacementAuthorized === false, 'WEP_HANDOFF_SOURCE_REPLACEMENT_FORBIDDEN');

  if (input.sourceSurface === 'explore' && input.intent === 'ITEM') {
    return createExploreItemHandoff(Number(input.itemId), String(input.createdAt ?? ''));
  }
  if (input.sourceSurface === 'moodboard' && input.intent === 'MOODBOARD') {
    return createMoodboardHandoff(String(input.boardId ?? ''), {
      referenceId: input.referenceId == null ? null : String(input.referenceId),
      groupId: input.groupId == null ? null : String(input.groupId),
      createdAt: String(input.createdAt ?? '')
    });
  }
  throw new Error('WEP_HANDOFF_KIND_UNSUPPORTED');
}

export function writeWorldEditorHandoff(
  storage: StorageLike,
  handoff: WorldEditorHandoff
) {
  const normalized = normalizeWorldEditorHandoff(handoff);
  storage.setItem(WORLD_EDITOR_HANDOFF_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function readWorldEditorHandoff(storage: StorageLike): WorldEditorHandoff | null {
  const raw = storage.getItem(WORLD_EDITOR_HANDOFF_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeWorldEditorHandoff(JSON.parse(raw));
  } catch {
    storage.removeItem(WORLD_EDITOR_HANDOFF_STORAGE_KEY);
    return null;
  }
}

export function clearWorldEditorHandoff(storage: StorageLike) {
  storage.removeItem(WORLD_EDITOR_HANDOFF_STORAGE_KEY);
}
