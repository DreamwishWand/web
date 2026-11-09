// F-P04: explicit, detached local Scene -> read-only geometry Draft.
// This is NOT an EditorSession command, Native Apply, game Save or ownership proof.
import { preflightScene, validatePublishablePreset } from './scene-preset-runtime.ts';

export const WEP_LOCAL_SCENE_REUSE_OPERATION =
  'WEP_LOCAL_SCENE_REUSE_DETACHED_READONLY_DRAFT@1';

const reject = (code: string): never => { throw Error('WEP_SCENE_REUSE_' + code); };
const safeInt = (x: unknown): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x);
const plain = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const layers = new Set(['furniture', 'building', 'landscaping']);

export interface LocalSceneReuseObject {
  artifactObjectId: string;
  itemId: number;
  layer: string;
  x: number;
  y: number;
  orientation: number;
  footprint: Array<{ x: number; y: number }>;
  dependencyIds: string[];
  editability: 'readonly';
  source: null;
  nativeGridObjectId: null;
}
export interface LocalSceneReuseDraft {
  operation: typeof WEP_LOCAL_SCENE_REUSE_OPERATION;
  sceneId: string;
  sourceRevision: number;
  bounds: { w: number; h: number };
  objects: LocalSceneReuseObject[];
  localOnly: true;
  detachedFromEditorSession: true;
  inventoryVerified: false;
  nativePlacementAuthorized: false;
  editorMutationAuthorized: false;
  writeReady: false;
  applyReady: false;
}

// Inputs must come from the verified read-only IndexedDB snapshot. Even then,
// treat every byte as untrusted and never copy Native/Editor identities into a
// reusable draft. Callers must re-open and match revision at user click time.
export function buildReadonlyLocalSceneReuseDraft({
  sceneId, sourceRevision, artifact
}: { sceneId: string; sourceRevision: number; artifact: unknown }): LocalSceneReuseDraft {
  if (typeof sceneId !== 'string' ||
      !/^scene_[0-9a-f-]{36}$/.test(sceneId) ||
      !safeInt(sourceRevision) || sourceRevision < 1) reject('SOURCE_IDENTITY_INVALID');
  const validation = validatePublishablePreset(artifact);
  if (!validation.ok || validation.presetType !== 'scene' || !plain(artifact))
    reject('ARTIFACT_INVALID');
  const a = artifact as Record<string, any>;
  if (a.networks?.roads != null || a.networks?.fences != null ||
      a.requirements?.roadTopology !== false ||
      a.requirements?.fenceTopology !== false)
    reject('TOPOLOGY_UNVERIFIED');
  const preflight = preflightScene(a);
  if (!preflight.ok || preflight.writeReady !== false)
    reject('PREFLIGHT_DENIED');
  const w = a.bounds?.w, h = a.bounds?.h;
  // A bounded local canvas is a visualization coordinate system, NOT a
  // Grid/Area/SubGrid or physical Native destination.
  if (!safeInt(w) || !safeInt(h) || w <= 0 || h <= 0 ||
      w > 4096 || h > 4096 || !Array.isArray(a.objects) ||
      a.objects.length < 1 || a.objects.length > 4096)
    reject('BOUNDS_UNVERIFIED');
  const seen = new Set<string>();
  const objects: LocalSceneReuseObject[] = [];
  for (const object of a.objects) {
    if (!plain(object) || !layers.has(String(object.layer)) ||
        object.portableState != null || !safeInt(object.itemId) ||
        object.itemId <= 0 || !safeInt(object.localX) ||
        !safeInt(object.localY) || !safeInt(object.orientation) ||
        object.orientation < 0 || object.orientation > 15 ||
        typeof object.artifactObjectId !== 'string' ||
        !/^o\d+$/.test(object.artifactObjectId) ||
        seen.has(object.artifactObjectId) ||
        !Array.isArray(object.footprint) ||
        object.footprint.length < 1 || object.footprint.length > 4096 ||
        !Array.isArray(object.dependencyIds))
      reject('OBJECT_UNVERIFIED');
    seen.add(object.artifactObjectId);
    const footprint = [];
    for (const cell of object.footprint) {
      if (!plain(cell) || !safeInt(cell.x) || !safeInt(cell.y))
        reject('FOOTPRINT_UNVERIFIED');
      const x = object.localX + cell.x, y = object.localY + cell.y;
      if (!safeInt(x) || !safeInt(y) || x < 0 || y < 0 ||
          x >= w || y >= h) reject('FOOTPRINT_OUTSIDE_LOCAL_BOUNDS');
      footprint.push({ x: cell.x, y: cell.y });
    }
    objects.push({
      artifactObjectId: object.artifactObjectId,
      itemId: object.itemId,
      layer: String(object.layer),
      x: object.localX, y: object.localY,
      orientation: object.orientation,
      footprint,
      dependencyIds: [...object.dependencyIds],
      editability: 'readonly',
      source: null,
      nativeGridObjectId: null
    });
  }
  for (const object of objects) {
    if (object.dependencyIds.some(id => !seen.has(id) ||
      id === object.artifactObjectId ||
      objects.find(other => other.artifactObjectId === id) === undefined))
      reject('DEPENDENCY_UNVERIFIED');
  }
  // Never return executable Editor commands or route a local artifact into a
  // game-facing consumer. The caller may display these local coordinates only.
  return {
    operation: WEP_LOCAL_SCENE_REUSE_OPERATION,
    sceneId, sourceRevision, bounds: { w, h }, objects,
    localOnly: true, detachedFromEditorSession: true,
    inventoryVerified: false, nativePlacementAuthorized: false,
    editorMutationAuthorized: false, writeReady: false, applyReady: false
  };
}
