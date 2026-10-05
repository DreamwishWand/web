export const WEP_EDITOR_SCHEMA = 'dreamwish-wand-wep-editor-document';
export const WEP_EDITOR_VERSION = 1;
export const CARDINAL_ORIENTATIONS = Object.freeze([0, 4, 8, 12] as const);
export const WEP_LAYERS = Object.freeze([
  'furniture',
  'building',
  'landscaping',
  'road',
  'fence',
  'static'
] as const);

export type WepLayer = (typeof WEP_LAYERS)[number];

export interface FootprintCell {
  x: number;
  y: number;
}

export interface EditorObject {
  editorId: string;
  itemId: number;
  layer: WepLayer;
  x: number;
  y: number;
  orientation: number;
  footprint: FootprintCell[];
  source: unknown | null;
  portableState: unknown | null;
  dependencyIds: string[];
  editability: string;
  metadata: Record<string, any>;
}

export interface EditorDocument {
  schema: string;
  version: number;
  target: Record<string, any>;
  objects: EditorObject[];
  networks: Record<string, any>;
  capabilities: Record<string, any>;
  metadata: Record<string, any>;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ValidationResult {
  ok: boolean;
  issues: any[];
  [key: string]: any;
}

export interface GeometryAdapter {
  translate?: (
    object: EditorObject,
    dx: number,
    dy: number
  ) => EditorObject;
  rotateCardinal?: (
    object: EditorObject,
    turns: number,
    pivot: { x: number; y: number }
  ) => EditorObject;
  rotateSelectionCardinal?: (
    objects: EditorObject[],
    turns: number,
    options: {
      bounds: Rect;
      pivot: { x: number; y: number } | null;
    }
  ) => EditorObject[];
  supportsCustomSelectionPivot?: boolean;
}

export type EditorValidator = (
  candidate: EditorDocument,
  context: Record<string, any>,
  before: EditorDocument
) => ValidationResult;

export interface DraftGraphObject {
  localId: string;
  itemId: number;
  layer: WepLayer;
  localX: number;
  localY: number;
  orientation?: number;
  footprint?: FootprintCell[];
  portableState?: unknown;
  dependencyLocalIds?: string[];
  metadata?: Record<string, any>;
}

type AnyRecord = Record<string, any>;

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function int(value: unknown, code: string): number {
  const number = Number(value);
  assert(Number.isSafeInteger(number), code);
  return number;
}

export function normalizeRect(value: Rect): Rect {
  assert(plain(value), 'WEP_RECT_INVALID');
  const x = int(value.x, 'WEP_RECT_X_INVALID');
  const y = int(value.y, 'WEP_RECT_Y_INVALID');
  const w = int(value.w, 'WEP_RECT_W_INVALID');
  const h = int(value.h, 'WEP_RECT_H_INVALID');
  assert(w > 0 && h > 0, 'WEP_RECT_SIZE_INVALID');
  return { x, y, w, h };
}

export function normalizeEditorObject(input: any): EditorObject {
  assert(plain(input), 'WEP_OBJECT_INVALID');
  assert(typeof input.editorId === 'string' && input.editorId, 'WEP_OBJECT_ID_INVALID');
  assert(Number.isSafeInteger(Number(input.itemId)), 'WEP_ITEM_ID_INVALID');
  assert(WEP_LAYERS.includes(input.layer), 'WEP_LAYER_INVALID');

  const footprint = (input.footprint ?? [{ x: 0, y: 0 }]).map((cell: any) => ({
    x: int(cell.x, 'WEP_FP_X_INVALID'),
    y: int(cell.y, 'WEP_FP_Y_INVALID')
  }));
  assert(footprint.length > 0, 'WEP_FP_EMPTY');

  return {
    editorId: input.editorId,
    itemId: Number(input.itemId),
    layer: input.layer,
    x: int(input.x, 'WEP_X_INVALID'),
    y: int(input.y, 'WEP_Y_INVALID'),
    orientation: int(input.orientation ?? 0, 'WEP_ORIENTATION_INVALID'),
    footprint,
    source: input.source ? clone(input.source) : null,
    portableState:
      input.portableState === undefined ? null : clone(input.portableState),
    dependencyIds: [...(input.dependencyIds ?? [])].map(String),
    editability: input.editability ?? 'editable',
    metadata: input.metadata ? clone(input.metadata) : {}
  };
}

export function normalizeEditorDocument(input: any): EditorDocument {
  assert(plain(input), 'WEP_DOC_INVALID');

  const objects = (input.objects ?? []).map(normalizeEditorObject);
  const ids = new Set<string>();
  for (const object of objects) {
    assert(!ids.has(object.editorId), 'WEP_DUPLICATE_EDITOR_ID');
    ids.add(object.editorId);
  }

  return {
    schema: WEP_EDITOR_SCHEMA,
    version: WEP_EDITOR_VERSION,
    target: clone(input.target ?? {}),
    objects,
    networks: clone(input.networks ?? { roads: null, fences: null }),
    capabilities: clone(input.capabilities ?? {}),
    metadata: clone(input.metadata ?? {})
  };
}

export function indexEditorObjects(
  document: EditorDocument
): Map<string, EditorObject> {
  return new Map(document.objects.map((object) => [object.editorId, object]));
}

export function occupiedCells(object: EditorObject): FootprintCell[] {
  return object.footprint.map((cell) => ({
    x: object.x + cell.x,
    y: object.y + cell.y
  }));
}

export function boundsFor(objects: EditorObject[]): Rect {
  assert(objects.length > 0, 'WEP_BOUNDS_EMPTY');

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const object of objects) {
    for (const cell of occupiedCells(object)) {
      minX = Math.min(minX, cell.x);
      minY = Math.min(minY, cell.y);
      maxX = Math.max(maxX, cell.x);
      maxY = Math.max(maxY, cell.y);
    }
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  };
}

export function dependencyClosure(
  document: EditorDocument,
  selectionIds: string[]
): string[] {
  const index = indexEditorObjects(document);
  const output = new Set(selectionIds.map(String));
  const queue = [...output];

  while (queue.length) {
    const id = queue.shift()!;
    const object = index.get(id);
    assert(object, 'WEP_SELECTION_OBJECT_MISSING');

    for (const dependencyId of object.dependencyIds) {
      assert(index.has(dependencyId), 'WEP_DEPENDENCY_MISSING');
      if (!output.has(dependencyId)) {
        output.add(dependencyId);
        queue.push(dependencyId);
      }
    }
  }

  return [...output];
}

export function createEditorSession(
  input: any,
  {
    geometryAdapter = null,
    validator = null,
    allowInvalidDraft = false,
    recoverySnapshot = null
  }: {
    geometryAdapter?: GeometryAdapter | null;
    validator?: EditorValidator | null;
    allowInvalidDraft?: boolean;
    recoverySnapshot?: any;
  } = {}
) {
  let document = normalizeEditorDocument(input);
  let selection = new Set<string>();
  let lastValidation: ValidationResult = {
    ok: true,
    issues: [],
    status: 'INITIAL'
  };
  const undoStack: Array<Record<string, any>> = [];
  const redoStack: Array<Record<string, any>> = [];
  let sequence = 0;

  const normalizeHistoryEntry = (entry: any) => {
    assert(plain(entry), 'WEP_RECOVERY_HISTORY_ENTRY_INVALID');
    assert(typeof entry.kind === 'string' && entry.kind, 'WEP_RECOVERY_HISTORY_KIND_INVALID');
    const before = normalizeEditorDocument(entry.before);
    const after = normalizeEditorDocument(entry.after);
    assert(
      JSON.stringify(before.target) === JSON.stringify(document.target) &&
        JSON.stringify(after.target) === JSON.stringify(document.target),
      'WEP_RECOVERY_HISTORY_TARGET_MISMATCH'
    );
    const beforeValidation = plain(entry.beforeValidation)
      ? clone(entry.beforeValidation)
      : { ok: true, issues: [] };
    const afterValidation = plain(entry.afterValidation)
      ? clone(entry.afterValidation)
      : { ok: true, issues: [] };
    assert(
      beforeValidation.persistentWriteAuthorized !== true &&
        afterValidation.persistentWriteAuthorized !== true,
      'WEP_RECOVERY_HISTORY_WRITE_AUTH_INVALID'
    );
    return {
      kind: entry.kind,
      before,
      after,
      beforeSelection: Array.isArray(entry.beforeSelection)
        ? entry.beforeSelection.map(String)
        : [],
      afterSelection: Array.isArray(entry.afterSelection)
        ? entry.afterSelection.map(String)
        : [],
      beforeValidation,
      afterValidation,
      context: plain(entry.context) ? clone(entry.context) : {},
      result: plain(entry.result) ? clone(entry.result) : {}
    };
  };

  if (recoverySnapshot !== null) {
    assert(plain(recoverySnapshot), 'WEP_RECOVERY_SNAPSHOT_INVALID');
    assert(
      recoverySnapshot.schema === 'dreamwish-wand-wep-editor-session-recovery@1' &&
        Number(recoverySnapshot.version) === 1,
      'WEP_RECOVERY_SNAPSHOT_SCHEMA_MISMATCH'
    );
    assert(
      recoverySnapshot.persistentWriteAuthorized === false &&
        recoverySnapshot.WORLD_PERSISTENT_WRITE_V125 === false &&
        recoverySnapshot.PERSISTENT_WRITE === false &&
        recoverySnapshot.productApplyAuthorized === false &&
        recoverySnapshot.directSourceReplacementAuthorized === false,
      'WEP_RECOVERY_SNAPSHOT_SAFETY_INVALID'
    );
    const restored = normalizeEditorDocument(recoverySnapshot.document);
    assert(
      JSON.stringify(restored.target) === JSON.stringify(document.target),
      'WEP_RECOVERY_SNAPSHOT_TARGET_MISMATCH'
    );
    document = restored;
    const objectIds = new Set(document.objects.map((object) => object.editorId));
    selection = new Set(
      (Array.isArray(recoverySnapshot.selection)
        ? recoverySnapshot.selection.map(String)
        : []
      ).filter((id: string) => objectIds.has(id))
    );
    lastValidation = plain(recoverySnapshot.lastValidation)
      ? (clone(recoverySnapshot.lastValidation) as ValidationResult)
      : { ok: true, issues: [], status: 'RECOVERED' };
    assert(
      lastValidation.persistentWriteAuthorized !== true,
      'WEP_RECOVERY_VALIDATION_WRITE_AUTH_INVALID'
    );
    for (const entry of recoverySnapshot.undoStack ?? []) {
      undoStack.push(normalizeHistoryEntry(entry));
    }
    for (const entry of recoverySnapshot.redoStack ?? []) {
      redoStack.push(normalizeHistoryEntry(entry));
    }
    sequence = int(
      recoverySnapshot.sequence ?? 0,
      'WEP_RECOVERY_SEQUENCE_INVALID'
    );
    assert(sequence >= 0, 'WEP_RECOVERY_SEQUENCE_INVALID');
  }

  const index = () => indexEditorObjects(document);

  const ensureSelection = (ids: string[] | null | undefined): string[] => {
    const map = index();
    const chosen = [...new Set((ids ?? []).map(String))];
    assert(chosen.length > 0, 'WEP_SELECTION_EMPTY');

    for (const id of chosen) {
      const object = map.get(id);
      assert(object, 'WEP_SELECTION_OBJECT_MISSING');
      assert(object.editability === 'editable', 'WEP_OBJECT_NOT_EDITABLE');
    }

    return chosen;
  };

  const validate = (
    candidate: EditorDocument,
    context: Record<string, any>,
    before: EditorDocument
  ): ValidationResult => {
    if (!validator) return { ok: true, issues: [] };

    const result = validator(
      clone(candidate),
      clone(context),
      clone(before)
    );
    assert(
      plain(result) && typeof result.ok === 'boolean',
      'WEP_VALIDATOR_INVALID'
    );
    return result;
  };

  const commit = (
    kind: string,
    mutator: (candidate: EditorDocument) => Record<string, any> | void,
    context: Record<string, any> = {},
    selectionAfter:
      | ((input: {
          beforeSelection: string[];
          result: Record<string, any>;
          after: EditorDocument;
        }) => string[])
      | null = null,
    validationOverride: ValidationResult | null = null
  ) => {
    const before = clone(document);
    const beforeSelection = [...selection];
    const beforeValidation = clone(lastValidation);
    const candidate = clone(document);
    const result = mutator(candidate) ?? {};
    const validation = validationOverride
      ? clone(validationOverride)
      : validate(
          candidate,
          { kind, ...context, result: clone(result) },
          before
        );
    assert(
      plain(validation) &&
        typeof validation.ok === 'boolean' &&
        validation.persistentWriteAuthorized !== true,
      'WEP_VALIDATION_OVERRIDE_INVALID'
    );

    if (!validation.ok && !allowInvalidDraft) {
      return {
        applied: false,
        draftBlocked: true,
        kind,
        validation,
        result
      };
    }

    document = normalizeEditorDocument(candidate);
    const afterSelection = selectionAfter
      ? selectionAfter({
          beforeSelection: [...beforeSelection],
          result: clone(result),
          after: clone(document)
        })
      : beforeSelection;
    const afterIndex = index();
    selection = new Set(
      [...new Set(afterSelection.map(String))].filter((id) =>
        afterIndex.has(id)
      )
    );
    lastValidation = clone(validation);

    undoStack.push({
      kind,
      before,
      after: clone(document),
      beforeSelection,
      afterSelection: [...selection],
      beforeValidation,
      afterValidation: clone(lastValidation),
      context: clone(context),
      result: clone(result)
    });
    redoStack.length = 0;

    return {
      applied: true,
      draftBlocked: !validation.ok,
      kind,
      validation,
      result,
      selection: [...selection]
    };
  };

  const defaultTranslate = (
    object: EditorObject,
    dx: number,
    dy: number
  ): EditorObject => ({
    ...object,
    x: object.x + dx,
    y: object.y + dy
  });

  const defaultRotate = (
    object: EditorObject,
    pivot: { x: number; y: number },
    turns: number
  ): EditorObject => {
    let x = object.x;
    let y = object.y;
    let orientation = object.orientation;

    for (let index = 0; index < ((turns % 4) + 4) % 4; index += 1) {
      const rx = x - pivot.x;
      const ry = y - pivot.y;
      x = pivot.x - ry;
      y = pivot.y + rx;
      orientation = (orientation + 4) & 15;
    }

    return {
      ...object,
      x,
      y,
      orientation
    };
  };

  return Object.freeze({
    getDocument: () => clone(document),
    getSelection: () => [...selection],
    getLastValidation: () => clone(lastValidation),
    getHistoryState: () => ({
      undoDepth: undoStack.length,
      redoDepth: redoStack.length,
      lastKind: undoStack.at(-1)?.kind ?? null
    }),
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    reviewChanges() {
      const baseline = undoStack.length
        ? normalizeEditorDocument(undoStack[0].before)
        : normalizeEditorDocument(document);
      const before = new Map(
        baseline.objects.map((object) => [object.editorId, object])
      );
      const after = new Map(
        document.objects.map((object) => [object.editorId, object])
      );
      const ids = new Set([...before.keys(), ...after.keys()]);
      const changes: Array<Record<string, any>> = [];

      for (const id of ids) {
        const previous = before.get(id) ?? null;
        const current = after.get(id) ?? null;
        if (!previous && current) {
          changes.push({
            kind: 'ADD',
            editorId: id,
            itemId: current.itemId,
            before: null,
            after: {
              x: current.x,
              y: current.y,
              orientation: current.orientation
            }
          });
          continue;
        }
        if (previous && !current) {
          changes.push({
            kind: 'REMOVE',
            editorId: id,
            itemId: previous.itemId,
            before: {
              x: previous.x,
              y: previous.y,
              orientation: previous.orientation
            },
            after: null
          });
          continue;
        }
        if (!previous || !current) continue;
        const moved =
          previous.x !== current.x ||
          previous.y !== current.y;
        const rotated =
          previous.orientation !== current.orientation;
        if (!moved && !rotated) continue;
        changes.push({
          kind:
            moved && rotated
              ? 'MOVE_ROTATE'
              : moved
                ? 'MOVE'
                : 'ROTATE',
          editorId: id,
          itemId: current.itemId,
          before: {
            x: previous.x,
            y: previous.y,
            orientation: previous.orientation
          },
          after: {
            x: current.x,
            y: current.y,
            orientation: current.orientation
          }
        });
      }

      return {
        schema: 'dreamwish-wand-wep-draft-review@1',
        version: 1,
        target: clone(document.target),
        changes,
        commands: undoStack.map((entry) => ({
          kind: entry.kind,
          command: String(
            entry.context?.command ?? entry.result?.command ?? entry.kind
          )
        })),
        writeReady: false,
        persistentWriteAuthorized: false,
        WORLD_PERSISTENT_WRITE_V125: false,
        PERSISTENT_WRITE: false,
        productApplyAuthorized: false,
        directSourceReplacementAuthorized: false
      };
    },
    exportRecoverySnapshot() {
      return {
        schema: 'dreamwish-wand-wep-editor-session-recovery@1',
        version: 1,
        document: clone(document),
        selection: [...selection],
        lastValidation: clone(lastValidation),
        undoStack: clone(undoStack),
        redoStack: clone(redoStack),
        sequence,
        persistentWriteAuthorized: false,
        WORLD_PERSISTENT_WRITE_V125: false,
        PERSISTENT_WRITE: false,
        productApplyAuthorized: false,
        directSourceReplacementAuthorized: false
      };
    },

    setSelection(ids: string[]) {
      const map = index();
      selection = new Set(
        (ids ?? []).map(String).filter((id) => map.has(id))
      );
      return [...selection];
    },

    toggleSelection(id: string) {
      const key = String(id);
      assert(index().has(key), 'WEP_SELECTION_OBJECT_MISSING');
      if (selection.has(key)) selection.delete(key);
      else selection.add(key);
      return [...selection];
    },

    clearSelection() {
      selection.clear();
    },

    selectRect(
      rect: Rect,
      {
        includeLocked = false,
        layers = null
      }: {
        includeLocked?: boolean;
        layers?: WepLayer[] | null;
      } = {}
    ) {
      const normalized = normalizeRect(rect);
      const allowed = layers ? new Set(layers) : null;

      selection = new Set(
        document.objects
          .filter((object) => {
            if (!includeLocked && object.editability !== 'editable') {
              return false;
            }
            if (allowed && !allowed.has(object.layer)) return false;

            return occupiedCells(object).some(
              (cell) =>
                cell.x >= normalized.x &&
                cell.y >= normalized.y &&
                cell.x < normalized.x + normalized.w &&
                cell.y < normalized.y + normalized.h
            );
          })
          .map((object) => object.editorId)
      );

      return [...selection];
    },

    move(
      ids: string[] | null | undefined,
      dx: number,
      dy: number
    ) {
      const chosen = ensureSelection(
        ids?.length ? ids : [...selection]
      );
      const deltaX = int(dx, 'WEP_MOVE_DX_INVALID');
      const deltaY = int(dy, 'WEP_MOVE_DY_INVALID');

      return commit(
        'MOVE',
        (candidate) => {
          const selected = new Set(chosen);
          candidate.objects = candidate.objects.map((object) =>
            selected.has(object.editorId)
              ? geometryAdapter?.translate
                ? geometryAdapter.translate(
                    clone(object),
                    deltaX,
                    deltaY
                  )
                : defaultTranslate(object, deltaX, deltaY)
              : object
          );

          return {
            ids: chosen,
            dx: deltaX,
            dy: deltaY
          };
        },
        { ids: chosen }
      );
    },

    setPositions(
      ids: string[] | null | undefined,
      positions: Record<string, { x: number; y: number }>,
      command = 'PRECISE_POSITION'
    ) {
      const chosen = ensureSelection(
        ids?.length ? ids : [...selection]
      );
      assert(plain(positions), 'WEP_POSITION_MAP_INVALID');
      const selected = new Set(chosen);
      for (const id of chosen) {
        assert(plain(positions[id]), 'WEP_POSITION_TARGET_MISSING');
        int(positions[id].x, 'WEP_POSITION_X_INVALID');
        int(positions[id].y, 'WEP_POSITION_Y_INVALID');
      }
      for (const object of document.objects) {
        if (!selected.has(object.editorId)) continue;
        assert(
          object.layer !== 'road' &&
            object.layer !== 'fence' &&
            object.metadata?.worldClass !== 'FenceAndRoadItemData',
          'WEP_GENERIC_TRANSFORM_NETWORK_OBJECT_UNSUPPORTED'
        );
      }

      return commit(
        'MOVE',
        (candidate) => {
          candidate.objects = candidate.objects.map((object) => {
            if (!selected.has(object.editorId)) return object;
            const target = positions[object.editorId];
            const dx = int(target.x, 'WEP_POSITION_X_INVALID') - object.x;
            const dy = int(target.y, 'WEP_POSITION_Y_INVALID') - object.y;
            return geometryAdapter?.translate
              ? geometryAdapter.translate(clone(object), dx, dy)
              : defaultTranslate(object, dx, dy);
          });
          return {
            ids: chosen,
            command: String(command),
            positions: Object.fromEntries(
              chosen.map((id) => [
                id,
                {
                  x: int(positions[id].x, 'WEP_POSITION_X_INVALID'),
                  y: int(positions[id].y, 'WEP_POSITION_Y_INVALID')
                }
              ])
            )
          };
        },
        { ids: chosen, command: String(command) }
      );
    },

    align(
      ids: string[] | null | undefined,
      mode:
        | 'left'
        | 'right'
        | 'top'
        | 'bottom'
        | 'horizontal-center'
        | 'vertical-center'
    ) {
      const chosen = ensureSelection(
        ids?.length ? ids : [...selection]
      );
      assert(chosen.length >= 2, 'WEP_ALIGN_SELECTION_TOO_SMALL');
      const selectedObjects = document.objects.filter((object) =>
        chosen.includes(object.editorId)
      );
      const group = boundsFor(selectedObjects);
      const groupRight = group.x + group.w - 1;
      const groupBottom = group.y + group.h - 1;
      const positions: Record<string, { x: number; y: number }> = {};

      for (const object of selectedObjects) {
        assert(
          object.layer !== 'road' &&
            object.layer !== 'fence' &&
            object.metadata?.worldClass !== 'FenceAndRoadItemData',
          'WEP_GENERIC_TRANSFORM_NETWORK_OBJECT_UNSUPPORTED'
        );
        const box = boundsFor([object]);
        const right = box.x + box.w - 1;
        const bottom = box.y + box.h - 1;
        let dx = 0;
        let dy = 0;
        if (mode === 'left') dx = group.x - box.x;
        else if (mode === 'right') dx = groupRight - right;
        else if (mode === 'top') dy = group.y - box.y;
        else if (mode === 'bottom') dy = groupBottom - bottom;
        else if (mode === 'horizontal-center') {
          const numerator =
            group.x + groupRight - (box.x + right);
          assert(numerator % 2 === 0, 'WEP_ALIGN_CENTER_NON_INTEGER');
          dx = numerator / 2;
        } else if (mode === 'vertical-center') {
          const numerator =
            group.y + groupBottom - (box.y + bottom);
          assert(numerator % 2 === 0, 'WEP_ALIGN_CENTER_NON_INTEGER');
          dy = numerator / 2;
        } else {
          throw new Error('WEP_ALIGN_MODE_INVALID');
        }
        positions[object.editorId] = {
          x: object.x + dx,
          y: object.y + dy
        };
      }
      return this.setPositions(chosen, positions, `ALIGN_${mode.toUpperCase().replaceAll('-', '_')}`);
    },

    distribute(
      ids: string[] | null | undefined,
      axis: 'horizontal' | 'vertical'
    ) {
      const chosen = ensureSelection(
        ids?.length ? ids : [...selection]
      );
      assert(chosen.length >= 3, 'WEP_DISTRIBUTE_SELECTION_TOO_SMALL');
      assert(
        axis === 'horizontal' || axis === 'vertical',
        'WEP_DISTRIBUTE_AXIS_INVALID'
      );
      const objects = document.objects
        .filter((object) => chosen.includes(object.editorId))
        .map((object) => ({
          object,
          box: boundsFor([object])
        }));
      for (const { object } of objects) {
        assert(
          object.layer !== 'road' &&
            object.layer !== 'fence' &&
            object.metadata?.worldClass !== 'FenceAndRoadItemData',
          'WEP_GENERIC_TRANSFORM_NETWORK_OBJECT_UNSUPPORTED'
        );
      }
      objects.sort((a, b) =>
        axis === 'horizontal'
          ? a.box.x - b.box.x || a.box.y - b.box.y
          : a.box.y - b.box.y || a.box.x - b.box.x
      );

      const first = objects[0];
      const last = objects[objects.length - 1];
      const firstStart = axis === 'horizontal' ? first.box.x : first.box.y;
      const lastEnd =
        axis === 'horizontal'
          ? last.box.x + last.box.w - 1
          : last.box.y + last.box.h - 1;
      const totalSize = objects.reduce(
        (sum, entry) =>
          sum + (axis === 'horizontal' ? entry.box.w : entry.box.h),
        0
      );
      const free = lastEnd - firstStart + 1 - totalSize;
      const divisor = objects.length - 1;
      assert(free >= 0, 'WEP_DISTRIBUTE_OVERLAPPING_BOUNDS_UNSUPPORTED');
      assert(free % divisor === 0, 'WEP_DISTRIBUTE_NON_INTEGER_GAP');
      const gap = free / divisor;
      const positions: Record<string, { x: number; y: number }> = {};
      let cursor = firstStart;
      for (const entry of objects) {
        const currentStart =
          axis === 'horizontal' ? entry.box.x : entry.box.y;
        const delta = cursor - currentStart;
        positions[entry.object.editorId] = {
          x: entry.object.x + (axis === 'horizontal' ? delta : 0),
          y: entry.object.y + (axis === 'vertical' ? delta : 0)
        };
        cursor +=
          (axis === 'horizontal' ? entry.box.w : entry.box.h) + gap;
      }
      return this.setPositions(
        chosen,
        positions,
        axis === 'horizontal'
          ? 'DISTRIBUTE_HORIZONTAL'
          : 'DISTRIBUTE_VERTICAL'
      );
    },

    rotateCardinal(
      ids: string[] | null | undefined,
      turns = 1,
      pivot: { x: number; y: number } | null = null
    ) {
      const chosen = ensureSelection(
        ids?.length ? ids : [...selection]
      );
      const normalizedTurns = int(turns, 'WEP_ROTATE_INVALID');
      const realTarget = document.target?.platform !== 'synthetic';
      const selected = document.objects.filter((object) =>
        chosen.includes(object.editorId)
      );

      if (geometryAdapter?.rotateSelectionCardinal) {
        if (
          pivot &&
          !geometryAdapter.supportsCustomSelectionPivot
        ) {
          return {
            applied: false,
            kind: 'ROTATE_CARDINAL',
            validation: {
              ok: false,
              issues: [
                {
                  severity: 'BLOCK',
                  code: 'CUSTOM_SELECTION_PIVOT_UNSUPPORTED'
                }
              ]
            },
            result: {
              ids: chosen,
              turns: normalizedTurns
            }
          };
        }

        return commit(
          'ROTATE_CARDINAL',
          (candidate) => {
            const current = candidate.objects.filter((object) =>
              chosen.includes(object.editorId)
            );
            const bounds = boundsFor(current);
            const options = {
              bounds: clone(bounds),
              pivot: pivot
                ? {
                    x: int(pivot.x, 'WEP_PIVOT_X_INVALID'),
                    y: int(pivot.y, 'WEP_PIVOT_Y_INVALID')
                  }
                : null
            };

            const output = geometryAdapter.rotateSelectionCardinal!(
              clone(current),
              normalizedTurns,
              clone(options)
            );

            assert(
              Array.isArray(output) &&
                output.length === current.length,
              'WEP_SELECTION_ROTATION_RESULT_INVALID'
            );

            const map = new Map<string, EditorObject>();
            for (const raw of output) {
              const object = normalizeEditorObject(raw);
              assert(
                chosen.includes(object.editorId),
                'WEP_SELECTION_ROTATION_ID_INVALID'
              );
              assert(
                !map.has(object.editorId),
                'WEP_SELECTION_ROTATION_ID_DUPLICATE'
              );
              map.set(object.editorId, object);
            }

            assert(
              map.size === chosen.length,
              'WEP_SELECTION_ROTATION_ID_MISSING'
            );

            candidate.objects = candidate.objects.map(
              (object) => map.get(object.editorId) ?? object
            );

            return {
              ids: chosen,
              turns: normalizedTurns,
              pivot: options.pivot,
              selectionTransform: true
            };
          },
          { ids: chosen }
        );
      }

      if (realTarget && chosen.length > 1) {
        return {
          applied: false,
          kind: 'ROTATE_CARDINAL',
          validation: {
            ok: false,
            issues: [
              {
                severity: 'BLOCK',
                code: 'SELECTION_GEOMETRY_ADAPTER_REQUIRED'
              }
            ]
          },
          result: {
            ids: chosen,
            turns: normalizedTurns
          }
        };
      }

      if (!geometryAdapter?.rotateCardinal && realTarget) {
        return {
          applied: false,
          kind: 'ROTATE_CARDINAL',
          validation: {
            ok: false,
            issues: [
              {
                severity: 'BLOCK',
                code: 'GEOMETRY_ADAPTER_REQUIRED'
              }
            ]
          },
          result: {
            ids: chosen,
            turns: normalizedTurns
          }
        };
      }

      const bounds = boundsFor(selected);
      const actualPivot = pivot
        ? {
            x: int(pivot.x, 'WEP_PIVOT_X_INVALID'),
            y: int(pivot.y, 'WEP_PIVOT_Y_INVALID')
          }
        : {
            x: bounds.x + (bounds.w - 1) / 2,
            y: bounds.y + (bounds.h - 1) / 2
          };

      return commit(
        'ROTATE_CARDINAL',
        (candidate) => {
          const selectedIds = new Set(chosen);
          candidate.objects = candidate.objects.map((object) =>
            selectedIds.has(object.editorId)
              ? geometryAdapter?.rotateCardinal
                ? geometryAdapter.rotateCardinal(
                    clone(object),
                    normalizedTurns,
                    clone(actualPivot)
                  )
                : defaultRotate(
                    object,
                    actualPivot,
                    normalizedTurns
                  )
              : object
          );

          return {
            ids: chosen,
            turns: normalizedTurns,
            pivot: actualPivot,
            selectionTransform: false
          };
        },
        { ids: chosen }
      );
    },

    copySelectionGraph(
      ids: string[] | null | undefined
    ) {
      const chosen = ensureSelection(
        ids?.length ? ids : [...selection]
      );
      const closure = dependencyClosure(document, chosen);
      const byId = index();
      const objects = closure.map((id) => byId.get(id)!);
      const originX = Math.min(...objects.map((object) => object.x));
      const originY = Math.min(...objects.map((object) => object.y));
      const localIdByEditorId = new Map<string, string>();
      closure.forEach((id, index) => {
        localIdByEditorId.set(id, `copy-${index}`);
      });

      const graph: DraftGraphObject[] = objects.map((object) => ({
        localId: localIdByEditorId.get(object.editorId)!,
        itemId: object.itemId,
        layer: object.layer,
        localX: object.x - originX,
        localY: object.y - originY,
        orientation: object.orientation,
        footprint: clone(object.footprint),
        portableState: clone(object.portableState),
        dependencyLocalIds: object.dependencyIds.map(
          (dependencyId) =>
            localIdByEditorId.get(dependencyId)!
        ),
        metadata: {
          ...(clone(object.metadata) ?? {}),
          copiedDraftGraph: true
        }
      }));

      return {
        schema: 'dreamwish-wand-wep-draft-clipboard@1',
        graph,
        sourceIds: [...closure],
        sourceBounds: boundsFor(objects),
        persistentWriteAuthorized: false
      };
    },

    duplicate(
      ids: string[] | null | undefined,
      {
        offsetX = 1,
        offsetY = 1
      }: {
        offsetX?: number;
        offsetY?: number;
      } = {}
    ) {
      const chosen = ensureSelection(
        ids?.length ? ids : [...selection]
      );
      const closure = dependencyClosure(document, chosen);

      return commit(
        'DUPLICATE',
        (candidate) => {
          const map = new Map(
            candidate.objects.map((object) => [
              object.editorId,
              object
            ])
          );
          const idMap = new Map<string, string>();
          const created: string[] = [];

          for (const id of closure) {
            idMap.set(id, `draft-${++sequence}`);
          }

          for (const id of closure) {
            const object = clone(map.get(id)!);
            object.editorId = idMap.get(id)!;
            object.source = null;
            object.x += int(offsetX, 'WEP_DUP_X_INVALID');
            object.y += int(offsetY, 'WEP_DUP_Y_INVALID');
            object.dependencyIds = object.dependencyIds.map(
              (dependencyId) =>
                idMap.get(dependencyId) ?? dependencyId
            );
            object.metadata = {
              ...(object.metadata ?? {}),
              draftDuplicate: true
            };
            candidate.objects.push(object);
            created.push(object.editorId);
          }

          return {
            sourceIds: closure,
            createdIds: created,
            idMap: Object.fromEntries(idMap)
          };
        },
        { ids: chosen },
        ({ result }) =>
          Array.isArray(result.createdIds)
            ? result.createdIds.map(String)
            : chosen
      );
    },

    insertDraftGraph(
      graph: DraftGraphObject[],
      {
        anchorX = 0,
        anchorY = 0,
        selectCreated = true,
        kind = 'PASTE'
      }: {
        anchorX?: number;
        anchorY?: number;
        selectCreated?: boolean;
        kind?: string;
      } = {}
    ) {
      assert(
        Array.isArray(graph) && graph.length > 0,
        'WEP_DRAFT_GRAPH_EMPTY'
      );

      const x = int(anchorX, 'WEP_DRAFT_ANCHOR_X_INVALID');
      const y = int(anchorY, 'WEP_DRAFT_ANCHOR_Y_INVALID');
      const localIds = new Set<string>();

      for (const specification of graph) {
        assert(
          plain(specification) &&
            typeof specification.localId === 'string' &&
            specification.localId,
          'WEP_DRAFT_LOCAL_ID_INVALID'
        );
        assert(
          !localIds.has(specification.localId),
          'WEP_DRAFT_LOCAL_ID_DUPLICATE'
        );
        localIds.add(specification.localId);
      }

      for (const specification of graph) {
        for (const dependency of specification.dependencyLocalIds ?? []) {
          assert(
            localIds.has(String(dependency)),
            'WEP_DRAFT_DEPENDENCY_MISSING'
          );
        }
      }

      const result = commit(
        kind,
        (candidate) => {
          const idMap = new Map<string, string>();
          const created: string[] = [];

          for (const specification of graph) {
            idMap.set(
              specification.localId,
              `draft-${++sequence}`
            );
          }

          for (const specification of graph) {
            const object = normalizeEditorObject({
              editorId: idMap.get(specification.localId),
              itemId: specification.itemId,
              layer: specification.layer,
              x:
                x +
                int(
                  specification.localX,
                  'WEP_DRAFT_LOCAL_X_INVALID'
                ),
              y:
                y +
                int(
                  specification.localY,
                  'WEP_DRAFT_LOCAL_Y_INVALID'
                ),
              orientation: specification.orientation ?? 0,
              footprint: clone(
                specification.footprint ?? [{ x: 0, y: 0 }]
              ),
              portableState:
                specification.portableState === undefined
                  ? null
                  : clone(specification.portableState),
              dependencyIds: (
                specification.dependencyLocalIds ?? []
              ).map((dependencyId) =>
                idMap.get(String(dependencyId))
              ),
              editability: 'editable',
              metadata: {
                ...(specification.metadata ?? {}),
                draftInserted: true
              },
              source: null
            });

            candidate.objects.push(object);
            created.push(object.editorId);
          }

          return {
            createdIds: created,
            idMap: Object.fromEntries(idMap)
          };
        },
        { graphSize: graph.length },
        ({ beforeSelection, result }) =>
          selectCreated && Array.isArray(result.createdIds)
            ? result.createdIds.map(String)
            : beforeSelection
      );

      return result;
    },

    replaceNetworkDraft(
      networkKind: 'roads' | 'fences',
      value: any,
      {
        command = 'ROADFENCE_DRAFT_UPDATE',
        validation = {
          ok: true,
          issues: [],
          status: 'MODEL_PREVIEW',
          persistentWriteAuthorized: false
        }
      }: {
        command?: string;
        validation?: ValidationResult;
      } = {}
    ) {
      assert(
        networkKind === 'roads' || networkKind === 'fences',
        'WEP_NETWORK_KIND_INVALID'
      );
      assert(
        plain(validation) &&
          typeof validation.ok === 'boolean' &&
          validation.persistentWriteAuthorized !== true,
        'WEP_NETWORK_VALIDATION_INVALID'
      );

      return commit(
        String(command),
        (candidate) => {
          candidate.networks = {
            ...(candidate.networks ?? {}),
            [networkKind]:
              value === null ? null : clone(value)
          };
          return {
            networkKind,
            topologyChanged:
              command.includes('TOPOLOGY') ||
              command.includes('DRAW') ||
              command.includes('DELETE') ||
              command.includes('TRANSFORM'),
            representationOnly:
              command.includes('REPRESENTATION'),
            persistentWriteAuthorized: false
          };
        },
        { networkKind },
        null,
        validation
      );
    },

    remove(ids: string[] | null | undefined) {
      const chosen = ensureSelection(
        ids?.length ? ids : [...selection]
      );
      const closure = new Set(
        dependencyClosure(document, chosen)
      );

      return commit(
        'DELETE',
        (candidate) => {
          candidate.objects = candidate.objects.filter(
            (object) => !closure.has(object.editorId)
          );

          return {
            removedIds: [...closure]
          };
        },
        { ids: chosen },
        ({ beforeSelection }) =>
          beforeSelection.filter((id) => !closure.has(id))
      );
    },

    undo() {
      if (!undoStack.length) return { applied: false };
      const entry = undoStack.pop()!;
      redoStack.push(clone(entry));
      document = normalizeEditorDocument(entry.before);
      selection = new Set(entry.beforeSelection ?? []);
      lastValidation = clone(
        entry.beforeValidation ?? { ok: true, issues: [] }
      );
      return {
        applied: true,
        kind: entry.kind,
        validation: clone(lastValidation),
        selection: [...selection]
      };
    },

    redo() {
      if (!redoStack.length) return { applied: false };
      const entry = redoStack.pop()!;
      undoStack.push(clone(entry));
      document = normalizeEditorDocument(entry.after);
      selection = new Set(entry.afterSelection ?? []);
      lastValidation = clone(
        entry.afterValidation ?? { ok: true, issues: [] }
      );
      return {
        applied: true,
        kind: entry.kind,
        validation: clone(lastValidation),
        selection: [...selection]
      };
    },

    previewPersistentCommit() {
      return {
        schema: 'dreamwish-wand-wep-preview-plan',
        version: 1,
        writeReady: false,
        reason: 'NO_PERSISTENT_WRITER_BOUND',
        target: clone(document.target),
        document: clone(document),
        capabilities: clone(document.capabilities),
        draftValidation: clone(lastValidation),
        history: {
          undoDepth: undoStack.length,
          redoDepth: redoStack.length
        }
      };
    }
  });
}
