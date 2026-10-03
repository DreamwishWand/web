import {
  authoritativeRootBoundsFromEditorDocument,
  regionWithinAuthoritativeBounds
} from './griddata-v17-contract.ts';

export type WepLayer =
  | 'furniture'
  | 'building'
  | 'landscaping'
  | 'road'
  | 'fence'
  | 'static';

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
  portableState?: unknown;
  dependencyIds?: string[];
  editability?: 'editable' | 'readonly' | 'blocked' | string;
  source?: unknown;
  metadata?: Record<string, unknown>;
}

export interface EditorDocument {
  schema?: string;
  version?: number;
  target?: {
    gameVersion?: string | null;
    platform?: string | null;
    areaKey?: string | null;
    [key: string]: unknown;
  };
  objects: EditorObject[];
  networks?: unknown;
  capabilities?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CaptureRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NetworkCaptureAdapter {
  capture(
    kind: 'roads' | 'fences',
    document: EditorDocument,
    region: CaptureRegion
  ):
    | { status: 'supported'; data: unknown; code?: string; issues?: CaptureIssue[] }
    | { status: string; data?: unknown; code?: string; issues?: CaptureIssue[] };
}

export interface CaptureSceneOptions {
  selectionIds: string[];
  captureRegion?: CaptureRegion | null;
  includeRoads?: boolean;
  includeFences?: boolean;
  networkAdapter?: NetworkCaptureAdapter | null;
  title?: string;
}

export interface ScenePublicationValidation {
  ok: boolean;
  issues: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export type ScenePublicationValidator = (
  artifact: unknown
) => ScenePublicationValidation;

export interface CaptureIssue {
  severity: 'BLOCK' | 'WARNING';
  code: string;
  [key: string]: unknown;
}

type AnyRecord = Record<string, any>;

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requireSafeInteger(value: unknown, code: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(code);
  return number;
}

function requirePositiveInteger(value: unknown, code: string): number {
  const number = requireSafeInteger(value, code);
  if (number <= 0) throw new Error(code);
  return number;
}

function sanitizeFootprint(value: unknown): FootprintCell[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('WEP_SCENE_FOOTPRINT_INVALID');
  }
  return value.map((cell) => {
    if (!plain(cell)) throw new Error('WEP_SCENE_FOOTPRINT_INVALID');
    return {
      x: requireSafeInteger(cell.x, 'WEP_SCENE_FOOTPRINT_INVALID'),
      y: requireSafeInteger(cell.y, 'WEP_SCENE_FOOTPRINT_INVALID')
    };
  });
}

function sanitizePortableState(value: unknown): unknown {
  if (value == null) return null;
  if (!plain(value)) throw new Error('WEP_SCENE_PORTABLE_STATE_INVALID');

  const codec = String(value.codec ?? '');
  if (codec === 'none') return null;
  if (codec === 'subgrid.itemdata-default-empty-child@1') {
    return { codec };
  }
  if (codec !== 'subgrid.serialized-local-child@1') {
    throw new Error('WEP_SCENE_PORTABLE_STATE_CODEC_UNSUPPORTED');
  }

  const child = value.child;
  if (!plain(child) || !Array.isArray(child.objects)) {
    throw new Error('WEP_SCENE_SUBGRID_CHILD_INVALID');
  }

  const width = requirePositiveInteger(
    child.width,
    'WEP_SCENE_SUBGRID_DIMENSIONS_INVALID'
  );
  const height = requirePositiveInteger(
    child.height,
    'WEP_SCENE_SUBGRID_DIMENSIONS_INVALID'
  );
  const tessellationFactor = requirePositiveInteger(
    child.tessellationFactor ?? 1,
    'WEP_SCENE_SUBGRID_DIMENSIONS_INVALID'
  );

  const normalized = child.objects.map((raw: unknown, index: number) => {
    if (!plain(raw)) throw new Error('WEP_SCENE_SUBGRID_OBJECT_INVALID');
    const itemId = requirePositiveInteger(
      raw.itemId,
      'WEP_SCENE_SUBGRID_OBJECT_INVALID'
    );
    const localX = requireSafeInteger(
      raw.localX,
      'WEP_SCENE_SUBGRID_OBJECT_INVALID'
    );
    const localY = requireSafeInteger(
      raw.localY,
      'WEP_SCENE_SUBGRID_OBJECT_INVALID'
    );
    const orientation = requireSafeInteger(
      raw.orientation,
      'WEP_SCENE_SUBGRID_OBJECT_INVALID'
    );
    if (orientation < 0 || orientation > 15) {
      throw new Error('WEP_SCENE_SUBGRID_OBJECT_INVALID');
    }

    return {
      itemId,
      localX,
      localY,
      orientation,
      footprint: sanitizeFootprint(raw.footprint),
      portableState: sanitizePortableState(
        raw.state ?? raw.portableState ?? null
      ),
      originalIndex: index
    };
  });

  normalized.sort(
    (a, b) =>
      a.localY - b.localY ||
      a.localX - b.localX ||
      a.itemId - b.itemId ||
      a.orientation - b.orientation ||
      JSON.stringify(a.footprint).localeCompare(JSON.stringify(b.footprint)) ||
      a.originalIndex - b.originalIndex
  );

  return {
    codec,
    child: {
      width,
      height,
      tessellationFactor,
      objects: normalized.map((object, index) => ({
        artifactObjectId: `c${index}`,
        itemId: object.itemId,
        localX: object.localX,
        localY: object.localY,
        orientation: object.orientation,
        footprint: object.footprint,
        portableState: object.portableState
      }))
    }
  };
}

function normalizeObject(raw: EditorObject): EditorObject {
  if (!plain(raw)) throw new Error('WEP_OBJECT_INVALID');
  const editorId = String(raw.editorId ?? '');
  if (!editorId) throw new Error('WEP_OBJECT_ID_INVALID');
  const itemId = requirePositiveInteger(raw.itemId, 'WEP_ITEM_ID_INVALID');
  const layer = String(raw.layer ?? '') as WepLayer;
  if (
    !['furniture', 'building', 'landscaping', 'road', 'fence', 'static'].includes(
      layer
    )
  ) {
    throw new Error('WEP_LAYER_INVALID');
  }

  return {
    editorId,
    itemId,
    layer,
    x: requireSafeInteger(raw.x, 'WEP_X_INVALID'),
    y: requireSafeInteger(raw.y, 'WEP_Y_INVALID'),
    orientation: requireSafeInteger(
      raw.orientation ?? 0,
      'WEP_ORIENTATION_INVALID'
    ),
    footprint: sanitizeFootprint(raw.footprint ?? [{ x: 0, y: 0 }]),
    portableState: clone(raw.portableState ?? null),
    dependencyIds: [...(raw.dependencyIds ?? [])].map(String),
    editability: raw.editability ?? 'editable',
    source: raw.source == null ? null : clone(raw.source),
    metadata: clone(raw.metadata ?? {})
  };
}

function normalizeDocument(input: EditorDocument): EditorDocument {
  if (!plain(input) || !Array.isArray(input.objects)) {
    throw new Error('WEP_DOC_INVALID');
  }
  const objects = input.objects.map(normalizeObject);
  const ids = new Set<string>();
  for (const object of objects) {
    if (ids.has(object.editorId)) throw new Error('WEP_DUPLICATE_EDITOR_ID');
    ids.add(object.editorId);
  }

  return {
    schema: 'dreamwish-wand-wep-editor-document',
    version: 1,
    target: clone(input.target ?? {}),
    objects,
    networks: clone(input.networks ?? { roads: null, fences: null }),
    capabilities: clone(input.capabilities ?? {}),
    metadata: clone(input.metadata ?? {})
  };
}

function occupiedCells(object: EditorObject): FootprintCell[] {
  return object.footprint.map((cell) => ({
    x: object.x + cell.x,
    y: object.y + cell.y
  }));
}

function boundsFor(objects: EditorObject[]): CaptureRegion {
  if (objects.length === 0) throw new Error('WEP_BOUNDS_EMPTY');

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

function normalizeRegion(region: CaptureRegion): CaptureRegion {
  const normalized = {
    x: requireSafeInteger(region.x, 'WEP_SCENE_REGION_INVALID'),
    y: requireSafeInteger(region.y, 'WEP_SCENE_REGION_INVALID'),
    w: requirePositiveInteger(region.w, 'WEP_SCENE_REGION_INVALID'),
    h: requirePositiveInteger(region.h, 'WEP_SCENE_REGION_INVALID')
  };
  return normalized;
}

function authoritativeRootBounds(document: EditorDocument) {
  const resolved = authoritativeRootBoundsFromEditorDocument(
    document as AnyRecord
  );
  return resolved ? { ...resolved.bounds } : null;
}

function regionInsideBounds(region: CaptureRegion, bounds: CaptureRegion) {
  return regionWithinAuthoritativeBounds(region, bounds);
}

function dependencyClosure(
  document: EditorDocument,
  selectionIds: string[]
): string[] {
  const index = new Map(document.objects.map((object) => [object.editorId, object]));
  const output = new Set(selectionIds.map(String));
  const queue = [...output];

  while (queue.length) {
    const id = queue.shift()!;
    const object = index.get(id);
    if (!object) throw new Error('WEP_SELECTION_OBJECT_MISSING');

    for (const dependencyId of object.dependencyIds ?? []) {
      if (!index.has(dependencyId)) throw new Error('WEP_DEPENDENCY_MISSING');
      if (!output.has(dependencyId)) {
        output.add(dependencyId);
        queue.push(dependencyId);
      }
    }
  }

  return [...output];
}

function classifyObject(object: EditorObject) {
  if (
    object.layer === 'static' ||
    object.editability === 'readonly' ||
    object.editability === 'blocked'
  ) {
    return {
      status: 'blocked' as const,
      code: 'OBJECT_NOT_PORTABLE'
    };
  }
  if (object.layer === 'road' || object.layer === 'fence') {
    return {
      status: 'blocked' as const,
      code: 'NETWORK_LAYER_NOT_ROOT_OBJECT'
    };
  }
  return { status: 'portable' as const };
}

export function captureScenePreset(
  documentInput: EditorDocument,
  {
    selectionIds,
    captureRegion = null,
    includeRoads = false,
    includeFences = false,
    networkAdapter = null,
    title = ''
  }: CaptureSceneOptions,
  publicationValidator: ScenePublicationValidator | null = null
) {
  const document = normalizeDocument(documentInput);
  const closureIds = dependencyClosure(document, selectionIds ?? []);
  const index = new Map(document.objects.map((object) => [object.editorId, object]));
  const selected = closureIds.map((id) => index.get(id)!);

  if (selected.length === 0) throw new Error('WEP_SCENE_SELECTION_EMPTY');

  const classifications = selected.map((object) => ({
    editorId: object.editorId,
    ...classifyObject(object)
  }));
  const blocked = classifications.filter((entry) => entry.status === 'blocked');
  if (blocked.length) throw new Error('WEP_SCENE_SELECTION_BLOCKED');

  const region = captureRegion
    ? normalizeRegion(captureRegion)
    : boundsFor(selected);
  const rootBounds = authoritativeRootBounds(document);
  const localIds = new Map(
    selected.map((object, index) => [object.editorId, `o${index}`])
  );

  const objects = selected.map((object) => ({
    artifactObjectId: localIds.get(object.editorId)!,
    itemId: object.itemId,
    layer: object.layer,
    localX: object.x - region.x,
    localY: object.y - region.y,
    orientation: object.orientation,
    footprint: sanitizeFootprint(object.footprint),
    portableState: sanitizePortableState(object.portableState),
    dependencyIds: (object.dependencyIds ?? [])
      .filter((id) => localIds.has(id))
      .map((id) => localIds.get(id)!)
  }));

  const issues: CaptureIssue[] = [];
  if (rootBounds && !regionInsideBounds(region, rootBounds)) {
    issues.push({
      severity: 'BLOCK',
      code: 'CAPTURE_REGION_OUTSIDE_AUTHORITATIVE_ROOT_BOUNDS',
      rootBounds: clone(rootBounds),
      captureRegion: clone(region)
    });
  }
  const networks: { roads: unknown; fences: unknown } = {
    roads: null,
    fences: null
  };

  const captureNetwork = (
    kind: 'roads' | 'fences',
    requested: boolean
  ): unknown => {
    if (!requested) return null;
    if (
      issues.some(
        (entry) =>
          entry.code ===
          'CAPTURE_REGION_OUTSIDE_AUTHORITATIVE_ROOT_BOUNDS'
      )
    ) {
      return null;
    }
    if (!networkAdapter) {
      issues.push({
        severity: 'BLOCK',
        code: `${kind.toUpperCase()}_TOPOLOGY_CAPTURE_UNAVAILABLE`
      });
      return null;
    }

    const result = networkAdapter.capture(
      kind,
      clone(document),
      clone(region)
    );

    if (!plain(result) || result.status !== 'supported') {
      const propagated = Array.isArray(result?.issues)
        ? result.issues.filter(
            (entry: unknown): entry is CaptureIssue =>
              plain(entry) &&
              entry.severity === 'BLOCK' &&
              typeof entry.code === 'string' &&
              entry.code.length > 0
          )
        : [];
      if (propagated.length) {
        issues.push(...propagated.map((entry) => clone(entry)));
      } else if (typeof result?.code === 'string' && result.code.length > 0) {
        issues.push({
          severity: 'BLOCK',
          code: result.code
        });
      } else {
        issues.push({
          severity: 'BLOCK',
          code: `${kind.toUpperCase()}_TOPOLOGY_CAPTURE_UNAVAILABLE`
        });
      }
      return null;
    }
    return clone(result.data);
  };

  networks.roads = captureNetwork('roads', includeRoads);
  networks.fences = captureNetwork('fences', includeFences);

  const itemQuantities: Record<string, number> = {};
  for (const object of objects) {
    const key = String(object.itemId);
    itemQuantities[key] = (itemQuantities[key] ?? 0) + 1;
  }

  const artifact = {
    schema: 'dreamwish-wand-preset',
    artifactVersion: 1,
    type: 'scene',
    title: String(title || ''),
    source: {
      gameVersion: document.target?.gameVersion ?? null,
      platform: document.target?.platform ?? null,
      areaKey: document.target?.areaKey ?? null
    },
    bounds: { w: region.w, h: region.h },
    originPolicy: 'capture-region-top-left',
    objects,
    networks,
    requirements: {
      itemQuantities,
      roadTopology: includeRoads,
      fenceTopology: includeFences
    },
    normalization: {
      sourceGridIdsRemoved: true,
      sourceGridObjectIdsRemoved: true,
      dependencyClosureIncluded: true
    }
  } as const;

  const publication = publicationValidator
    ? publicationValidator(artifact)
    : null;
  const allIssues = [
    ...issues,
    ...(publication?.issues ?? []).map((entry) => ({ ...entry }))
  ];
  const captureReady = issues.every((entry) => entry.severity !== 'BLOCK');

  return {
    artifact,
    region,
    classifications,
    issues: allIssues,
    captureReady,
    publicationReady: captureReady && publication?.ok === true,
    publication
  };
}

export {
  boundsFor,
  dependencyClosure,
  normalizeDocument,
  sanitizePortableState
};
