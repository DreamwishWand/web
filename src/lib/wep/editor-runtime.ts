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
    allowInvalidDraft = false
  }: {
    geometryAdapter?: GeometryAdapter | null;
    validator?: EditorValidator | null;
    allowInvalidDraft?: boolean;
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
