import type { EditorDocument, EditorObject, Rect } from './editor-runtime.ts';
import { occupiedCells } from './editor-runtime';
import { projectObjects, type LayerState } from './canvas-runtime.ts';

// Local, non-authorizing scene projection. A single EditorSession document
// supplies both 2D geometry and the inspector identity; the scene never edits
// or manufactures source GridObject IDs or native transforms.
export const WEP_SPATIAL_SCENE_CONTRACT = 'dreamwish-wand-spatial-scene-readonly@1';

export interface SpatialIssue {
  editorId: string;
  itemId: number;
  code: string;
}
export interface SpatialObject extends EditorObject {
  ui: { locked: boolean; searchMatched: boolean; zIndex: number };
  spatial: {
    editorId: string;
    nativeGridObjectId: string | null;
    rootGridId: string | null;
    footprintCells: number;
    valid: true;
  };
}
export interface SpatialScene {
  contract: typeof WEP_SPATIAL_SCENE_CONTRACT;
  objects: SpatialObject[];
  unresolved: SpatialIssue[];
  targetRootGridId: string | null;
  persistentWriteAuthorized: false;
}

const present = (value: unknown) => value !== undefined && value !== null && value !== '';
const exactId = (value: unknown): string | null => {
  if (!present(value)) return null;
  if ((typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'number' && !Number.isSafeInteger(value))) return null;
  const id = String(value);
  return id.length > 0 ? id : null;
};
const record = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

export function buildSpatialScene(
  documentInput: EditorDocument,
  { layerState = null, query = '', bounds = null }: {
    layerState?: LayerState | null;
    query?: string;
    bounds?: Rect | null;
  } = {}
): SpatialScene {
  const target = record(documentInput.target);
  const root = exactId(target.rootGridId);
  const seen = new Set<string>();
  const objects: SpatialObject[] = [];
  const unresolved: SpatialIssue[] = [];
  // Existing layer/search projection is the ONLY rendering order. It also
  // preserves the actual Session editorId and already-transformed footprint.
  for (const object of projectObjects(documentInput, { layerState, query })) {
    const source = record(object.source);
    const metadata = record(object.metadata);
    const reject = (code: string) => {
      unresolved.push({ editorId: object.editorId, itemId: object.itemId, code });
    };
    if (seen.has(object.editorId)) {
      reject('SPATIAL_DUPLICATE_EDITOR_ID'); continue;
    }
    seen.add(object.editorId);
    if (!Number.isSafeInteger(object.x) || !Number.isSafeInteger(object.y) ||
        !Number.isInteger(object.orientation) ||
        !Array.isArray(object.footprint) ||
        object.footprint.length === 0 || object.footprint.length > 4096 ||
        !object.footprint.every(cell => Number.isSafeInteger(cell.x) && Number.isSafeInteger(cell.y))) {
      reject('SPATIAL_GEOMETRY_UNPROVEN'); continue;
    }
    const gridClaims = [
      metadata.rootGridId, metadata.gridId, metadata.gridID,
      source.rootGridId, source.gridId, source.gridID
    ].filter(present);
    if (target.platform !== 'synthetic' && !root) {
      reject('SPATIAL_ROOT_GRID_UNPROVEN'); continue;
    }
    if (gridClaims.some(value => root === null || exactId(value) !== root)) {
      reject('SPATIAL_GRID_CONFLICT'); continue;
    }
    if ([
      metadata.parentGridId, metadata.subGridId, metadata.subGridDataPath,
      source.parentGridId, source.subGridId, source.subGridDataPath
    ].some(present)) {
      // No guessed child-to-parent affine transform. SubGrid can be inspected
      // in its authoritative child route only after the Core contract lands.
      reject('SPATIAL_SUBGRID_TRANSFORM_UNPROVEN'); continue;
    }
    const nativeClaims = [
      metadata.gridObjectId, metadata.gridObjectID,
      source.gridObjectId, source.gridObjectID
    ].filter(present).map(exactId);
    if (nativeClaims.includes(null) || new Set(nativeClaims).size > 1) {
      reject('SPATIAL_OBJECT_ID_CONFLICT'); continue;
    }
    const cells = occupiedCells(object);
    if (cells.length !== object.footprint.length ||
        cells.some(cell => !Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y))) {
      reject('SPATIAL_FOOTPRINT_UNPROVEN'); continue;
    }
    if (bounds &&
        (!Number.isSafeInteger(bounds.x) || !Number.isSafeInteger(bounds.y) ||
         !Number.isSafeInteger(bounds.w) || !Number.isSafeInteger(bounds.h) ||
         bounds.w <= 0 || bounds.h <= 0 ||
         cells.some(cell => cell.x < bounds.x || cell.y < bounds.y ||
           cell.x >= bounds.x + bounds.w || cell.y >= bounds.y + bounds.h))) {
      reject('SPATIAL_OUTSIDE_ACTIVE_GRID'); continue;
    }
    objects.push({
      ...object,
      spatial: {
        editorId: object.editorId,
        nativeGridObjectId: nativeClaims[0] ?? null,
        rootGridId: root,
        footprintCells: cells.length,
        valid: true
      }
    });
  }
  return {
    contract: WEP_SPATIAL_SCENE_CONTRACT,
    objects, unresolved, targetRootGridId: root,
    persistentWriteAuthorized: false
  };
}

export function spatialHitTest(scene: SpatialScene, x: number, y: number): SpatialObject | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const cellX = Math.floor(x), cellY = Math.floor(y);
  // Same painter's order as actual SVG. Topmost editable/renderable object wins.
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const object = scene.objects[i];
    if (occupiedCells(object).some(cell => cell.x === cellX && cell.y === cellY)) {
      return object;
    }
  }
  return null;
}

export function spatialSelectedDetails(scene: SpatialScene, editorId: string) {
  const object = scene.objects.find(object => object.editorId === editorId);
  return object ? { ...object.spatial, x: object.x, y: object.y,
    orientation: object.orientation, itemId: object.itemId,
    dependencyIds: [...object.dependencyIds] } : null;
}
