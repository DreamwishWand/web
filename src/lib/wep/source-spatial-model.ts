/**
 * 01B CORE -> 02 WEP: source-addressed spatial READ/PREVIEW boundary.
 * Consumes EXISTING WEP EditorDocument/direct-root v1.25.0 projection. This is
 * never a GridObject writer, native placement verdict, or v1.25.3 projection.
 * Grid coordinates are the imported object's native X/Y integer grid cells;
 * screen coordinates below are a Y-down UI transform ONLY.
 */
import type { EditorDocument, EditorObject, FootprintCell, WepLayer } from './editor-runtime.ts';

export const SPATIAL_MODEL_SCHEMA = 'ddv.world-source-spatial@1' as const;
// A hit belongs to the exact in-memory scene. A copied/older hit must not select
// an object from another re-opened Save even when editorId happens to match.
const hitScene = new WeakMap<object, SpatialScene>();
export const SPATIAL_SOURCE = Object.freeze({
  platform: 'Nintendo Switch', gameVersion: '1.25.0',
  bid: '52BD625D9B4E0053', schema: 624,
  gridDataDimensionsSha256: '75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa'
});

export type GridObjectAddress = Readonly<{
  gridId: number;
  gridObjectId: number;
  objectMapKey: string;
}>;
export type SpatialRelation = 'ROOT' | 'SUBGRID_CHILD';
export type SpatialNode = Readonly<{
  // Exactly the existing EditorObject.editorId, never a second UUID.
  editorId: string;
  address: GridObjectAddress;
  relation: SpatialRelation;
  parentAddress: GridObjectAddress | null;
  itemId: number;
  layer: WepLayer;
  x: number;
  y: number;
  orientation: number; // Existing saved 16-step GridOrientation index.
  footprint: ReadonlyArray<Readonly<FootprintCell>>; // Already oriented by 01B projector.
  editability: string;
  stateKind: string;
  dependencyIds: ReadonlyArray<string>;
  footprintMode: string | null;
}>;
export type SpatialGrid = Readonly<{
  gridId: number;
  parentAddress: GridObjectAddress | null;
  gridDataPath: string;
  tessellationFactor: number;
  bounds: Readonly<{ x: number; y: number; w: number; h: number }>;
}>;
export type SpatialScene = Readonly<{
  schema: typeof SPATIAL_MODEL_SCHEMA;
  sourceRevision: string; // UI epoch only. NEVER a trusted Core Session/Revision CAS.
  sourceVersion: typeof SPATIAL_SOURCE;
  nativeAxis: 'GRID_LOCAL_XY';
  displayAxis: 'SCREEN_X_RIGHT_Y_DOWN';
  nodes: ReadonlyArray<SpatialNode>;
  grids: ReadonlyArray<SpatialGrid>;
  persistentWriteAuthorized: false;
  productApplyAuthorized: false;
  directSourceReplacementAuthorized: false;
}>;
export type Camera = Readonly<{ gridId: number; cellPixels: number; panX: number; panY: number }>;

function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw Error(code);
}
function plain(v: unknown): v is Record<string, any> {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v));
}
function integer(v: unknown, code: string): number {
  check(typeof v === 'number' && Number.isSafeInteger(v), code);
  return v;
}
function positive(v: unknown, code: string): number {
  const n = integer(v, code);
  check(n > 0, code);
  return n;
}
function address(v: unknown, code: string): GridObjectAddress {
  check(plain(v), code);
  const gridId = integer(v.gridId, code);
  const gridObjectId = integer(v.gridObjectId, code);
  check(gridId >= 0 && gridObjectId >= 0 && v.objectMapKey === String(gridObjectId), code);
  return Object.freeze({ gridId, gridObjectId, objectMapKey: String(gridObjectId) });
}
function sameAddress(a: GridObjectAddress | null, b: GridObjectAddress | null): boolean {
  return a === b || Boolean(a && b && a.gridId === b.gridId && a.gridObjectId === b.gridObjectId && a.objectMapKey === b.objectMapKey);
}
function bounds(v: unknown, code: string) {
  check(plain(v) && v.status === 'AUTHORITATIVE_GRIDDATAPATH', code);
  const x = integer(v.x, code), y = integer(v.y, code);
  const w = positive(v.w, code), h = positive(v.h, code);
  check(Number.isSafeInteger(x + w) && Number.isSafeInteger(y + h), code);
  return { x, y, w, h };
}
function cells(v: unknown, code: string): FootprintCell[] {
  check(Array.isArray(v) && v.length > 0 && v.length <= 4096, code);
  const seen = new Set<string>();
  return v.map((c) => {
    check(plain(c), code);
    const x = integer(c.x, code), y = integer(c.y, code);
    const k = `${x}:${y}`;
    check(!seen.has(k), 'SPATIAL_FOOTPRINT_DUPLICATE_CELL');
    seen.add(k);
    return { x, y };
  });
}
function contained(grid: SpatialGrid, x: number, y: number, fp: ReadonlyArray<FootprintCell>): boolean {
  return fp.every(c => {
    const xx = x + c.x, yy = y + c.y;
    return Number.isSafeInteger(xx) && Number.isSafeInteger(yy) &&
      xx >= grid.bounds.x && xx < grid.bounds.x + grid.bounds.w &&
      yy >= grid.bounds.y && yy < grid.bounds.y + grid.bounds.h;
  });
}
function nodeOf(o: EditorObject, grid: SpatialGrid, relation: SpatialRelation, parentAddress: GridObjectAddress | null): SpatialNode {
  check(plain(o.source), 'SPATIAL_SOURCE_OBJECT_REQUIRED');
  const a = address(o.source, 'SPATIAL_SOURCE_ADDRESS_INVALID');
  check(a.gridId === grid.gridId, 'SPATIAL_GRID_ID_MISMATCH');
  check(o.source.relation === relation, 'SPATIAL_RELATION_MISMATCH');
  const parent = o.source.parentAddress == null ? null : address(o.source.parentAddress, 'SPATIAL_PARENT_ADDRESS_INVALID');
  check(sameAddress(parent, parentAddress), 'SPATIAL_PARENT_ADDRESS_MISMATCH');
  check(o.editorId === `g${a.gridId}:o${a.gridObjectId}`, 'SPATIAL_EDITOR_ID_NOT_SOURCE_ADDRESS');
  const itemId = positive(o.itemId, 'SPATIAL_ITEM_ID_INVALID');
  const x = integer(o.x, 'SPATIAL_X_INVALID'), y = integer(o.y, 'SPATIAL_Y_INVALID');
  const orientation = integer(o.orientation, 'SPATIAL_ORIENTATION_INVALID');
  check(orientation >= 0 && orientation < 16, 'SPATIAL_ORIENTATION_INVALID');
  const footprint = cells(o.footprint, 'SPATIAL_FOOTPRINT_UNVERIFIED');
  check(contained(grid, x, y, footprint), 'SPATIAL_FOOTPRINT_OUT_OF_GRID');
  check(Array.isArray(o.dependencyIds), 'SPATIAL_DEPENDENCIES_INVALID');
  return Object.freeze({
    editorId: o.editorId, address: a, relation, parentAddress: parent,
    itemId, layer: o.layer, x, y, orientation,
    footprint: Object.freeze(footprint.map(c => Object.freeze({...c}))), editability: o.editability,
    stateKind: String(o.metadata?.stateKind ?? 'UNKNOWN'),
    dependencyIds: Object.freeze(o.dependencyIds.map(String)),
    footprintMode: typeof o.metadata?.footprintMode === 'string' ? o.metadata.footprintMode : null
  });
}

/** Do NOT accept 626/v1.25.3 here until its geometry/source mapping has its own QA. */
export function projectSourceSpatialScene(doc: EditorDocument, sourceRevision: string): SpatialScene {
  check(typeof sourceRevision === 'string' && sourceRevision.length > 0, 'SPATIAL_VIEW_REVISION_REQUIRED');
  check(plain(doc) && doc.schema === 'dreamwish-wand-wep-editor-document' && doc.version === 1, 'SPATIAL_EDITOR_DOCUMENT_UNSUPPORTED');
  const target = doc.target ?? {};
  check(target.platform === SPATIAL_SOURCE.platform && target.gameVersion === SPATIAL_SOURCE.gameVersion &&
    target.profileSchemaVersion === SPATIAL_SOURCE.schema && target.contractBuildIdentity === SPATIAL_SOURCE.bid,
    'SPATIAL_SOURCE_BUILD_UNSUPPORTED');
  check(target.persistentWriteAuthorized === false, 'SPATIAL_WRITER_FLAG_FORBIDDEN');
  check(target.sourceBuildIdentity == null || target.sourceBuildIdentity === SPATIAL_SOURCE.bid,
    'SPATIAL_ACTUAL_SOURCE_BID_MISMATCH');
  check(target.exactBuildKnown !== true || target.sourceBuildIdentity === SPATIAL_SOURCE.bid,
    'SPATIAL_EXACT_BID_ATTESTATION_MISSING');
  check(plain(doc.metadata?.directRootProjection) && doc.metadata.directRootProjection.evidenceStatus === 'CONFIRMED' &&
    doc.metadata.directRootProjection?.boundsAuthority?.sha256 === SPATIAL_SOURCE.gridDataDimensionsSha256,
    'SPATIAL_GEOMETRY_AUTHORITY_REQUIRED');
  const rootId = integer(target.rootGridId, 'SPATIAL_ROOT_GRID_INVALID');
  const rootGrid: SpatialGrid = {
    gridId: rootId, parentAddress: null,
    gridDataPath: String(target.gridDataPath ?? ''),
    tessellationFactor: positive(target.tessellationFactor, 'SPATIAL_TESSELLATION_INVALID'),
    bounds: bounds(doc.metadata?.rootGridBounds, 'SPATIAL_ROOT_BOUNDS_UNVERIFIED')
  };
  check(rootGrid.gridDataPath.length > 0, 'SPATIAL_GRID_PATH_REQUIRED');
  const grids: SpatialGrid[] = [rootGrid], nodes: SpatialNode[] = [];
  const ids = new Set<string>(), gridIds = new Set<number>([rootId]);
  function appendNode(object: EditorObject, grid: SpatialGrid, relation: SpatialRelation, parent: GridObjectAddress | null) {
    const projected = nodeOf(object, grid, relation, parent);
    check(!ids.has(projected.editorId), 'SPATIAL_DUPLICATE_SOURCE_ID');
    ids.add(projected.editorId);
    nodes.push(projected);
  }
  check(Array.isArray(doc.objects), 'SPATIAL_ROOT_OBJECTS_REQUIRED');
  for (const object of doc.objects) appendNode(object, rootGrid, 'ROOT', null);
  const hierarchy = doc.metadata?.subGridHierarchy ?? [];
  check(Array.isArray(hierarchy), 'SPATIAL_SUBGRID_HIERARCHY_INVALID');
  function visit(raw: any, ancestor: Set<number>, immediateParentGridId: number) {
    check(plain(raw), 'SPATIAL_SUBGRID_NODE_INVALID');
    const id = integer(raw.gridId, 'SPATIAL_SUBGRID_ID_INVALID');
    check(!ancestor.has(id) && !gridIds.has(id), 'SPATIAL_SUBGRID_CYCLE_OR_DUPLICATE');
    const parent = address(raw.parentAddress, 'SPATIAL_SUBGRID_PARENT_REQUIRED');
    check(parent.gridId === immediateParentGridId, 'SPATIAL_SUBGRID_PARENT_GRID_MISMATCH');
    const grid: SpatialGrid = {
      gridId: id, parentAddress: parent,
      gridDataPath: String(raw.gridDataPath ?? ''),
      tessellationFactor: positive(raw.tessellationFactor, 'SPATIAL_SUBGRID_TESSELLATION_INVALID'),
      bounds: bounds(raw.bounds, 'SPATIAL_SUBGRID_BOUNDS_UNVERIFIED')
    };
    check(grid.gridDataPath.length > 0 && typeof raw.dimensionSourceSha256 === 'string' &&
      raw.dimensionSourceSha256.length > 0, 'SPATIAL_SUBGRID_GEOMETRY_SOURCE_UNVERIFIED');
    gridIds.add(id); grids.push(grid);
    check(Array.isArray(raw.objects) && Array.isArray(raw.children), 'SPATIAL_SUBGRID_MEMBERS_INVALID');
    for (const object of raw.objects) appendNode(object, grid, 'SUBGRID_CHILD', parent);
    const next = new Set(ancestor); next.add(id);
    for (const child of raw.children) visit(child, next, id);
  }
  for (const child of hierarchy) visit(child, new Set([rootId]), rootId);
  const byAddress = new Map(nodes.map(n => [n.editorId, n]));
  for (const grid of grids) {
    if (!grid.parentAddress) continue;
    const p = byAddress.get(`g${grid.parentAddress.gridId}:o${grid.parentAddress.gridObjectId}`);
    check(p && p.stateKind === 'SubGrid', 'SPATIAL_SUBGRID_PARENT_NOT_OBJECT');
    // The parent source State.SubGrid.GridID is the authoritative linkage;
    // parent local XY cannot be used as a child-grid world matrix.
    const parentRaw = [...doc.objects, ...hierarchy.flatMap((h:any) => flattenChildren(h))].find(o => o.editorId === p.editorId);
    check(parentRaw?.metadata?.rawState?.SubGrid?.GridID === grid.gridId,
      'SPATIAL_SUBGRID_NATIVE_LINK_MISMATCH');
  }
  return Object.freeze({
    schema: SPATIAL_MODEL_SCHEMA, sourceRevision, sourceVersion: SPATIAL_SOURCE,
    nativeAxis: 'GRID_LOCAL_XY' as const,
    displayAxis: 'SCREEN_X_RIGHT_Y_DOWN' as const,
    nodes: Object.freeze(nodes), grids: Object.freeze(grids.map(g => Object.freeze({...g, bounds: Object.freeze({...g.bounds})}))), persistentWriteAuthorized: false as const,
    productApplyAuthorized: false as const,
    directSourceReplacementAuthorized: false as const
  });
}
function flattenChildren(h: any): EditorObject[] {
  return [...(h.objects ?? []), ...(h.children ?? []).flatMap((c:any) => flattenChildren(c))];
}
function camera(c: Camera) {
  integer(c.gridId, 'SPATIAL_CAMERA_GRID_INVALID');
  check(Number.isFinite(c.cellPixels) && c.cellPixels > 0 && c.cellPixels <= 1024,
    'SPATIAL_CAMERA_SCALE_INVALID');
  check(Number.isFinite(c.panX) && Number.isFinite(c.panY), 'SPATIAL_CAMERA_PAN_INVALID');
}
export function sourceToScreen(p: { x: number; y: number }, c: Camera) {
  camera(c);
  check(Number.isFinite(p.x) && Number.isFinite(p.y), 'SPATIAL_SCREEN_SOURCE_INVALID');
  return { x: (p.x - c.panX) * c.cellPixels, y: (p.y - c.panY) * c.cellPixels };
}
export function screenToSource(p: { x: number; y: number }, c: Camera) {
  camera(c);
  check(Number.isFinite(p.x) && Number.isFinite(p.y), 'SPATIAL_SCREEN_POSITION_INVALID');
  return { x: p.x / c.cellPixels + c.panX, y: p.y / c.cellPixels + c.panY };
}
/** Hit-test yields all overlapping source objects. No guessed Native z-order. */
export function hitTestSource(scene: SpatialScene, screen: { x: number; y: number }, c: Camera) {
  camera(c);
  check(scene.schema === SPATIAL_MODEL_SCHEMA, 'SPATIAL_SCENE_SCHEMA_MISMATCH');
  check(scene.grids.some(g => g.gridId === c.gridId), 'SPATIAL_CAMERA_GRID_NOT_IN_SCENE');
  const p = screenToSource(screen, c), cellX = Math.floor(p.x), cellY = Math.floor(p.y);
  const candidates = scene.nodes.filter(n => n.address.gridId === c.gridId &&
    n.footprint.some(fp => n.x + fp.x === cellX && n.y + fp.y === cellY));
  const hit = Object.freeze({ gridId: c.gridId, cellX, cellY, candidates: Object.freeze(candidates),
    ambiguous: candidates.length > 1, selected: null as SpatialNode | null });
  hitScene.set(hit, scene);
  return hit;
}
/** Selection must retain the exact source GridObject address, not a render UUID. */
export function selectHitCandidate(scene: SpatialScene, hit: ReturnType<typeof hitTestSource>, editorId: string, revision: string) {
  check(scene.sourceRevision === revision, 'SPATIAL_STALE_VIEW_REVISION');
  check(hitScene.get(hit) === scene, 'SPATIAL_HIT_SCENE_STALE_OR_FORGED');
  const node = hit.candidates.find(n => n.editorId === editorId);
  check(node, 'SPATIAL_HIT_CANDIDATE_REQUIRED');
  return node;
}
function rotatedRect(fp: ReadonlyArray<FootprintCell>, turns: number): FootprintCell[] {
  check(Number.isInteger(turns) && turns >= 0 && turns <= 3, 'SPATIAL_ROTATE_TURNS_INVALID');
  let current = fp.map(c => ({ x: c.x, y: c.y }));
  for (let i = 0; i < turns; i++) {
    const h = 1 + Math.max(...current.map(c => c.y));
    current = current.map(c => ({ x: h - 1 - c.y, y: c.x }));
  }
  return current;
}
function rectangular(fp: ReadonlyArray<FootprintCell>) {
  const xs = fp.map(c => c.x), ys = fp.map(c => c.y);
  const w = Math.max(...xs) + 1, h = Math.max(...ys) + 1;
  return Math.min(...xs) === 0 && Math.min(...ys) === 0 && w*h === fp.length &&
    fp.every(c => c.x >= 0 && c.y >= 0);
}
/** Schematic preview only. Not a Native placement validator or Save command. */
export function previewSourceTransform(scene: SpatialScene, editorId: string, revision: string,
  request: { dx: number; dy: number; quarterTurns?: number }) {
  check(scene.sourceRevision === revision, 'SPATIAL_STALE_VIEW_REVISION');
  const node = scene.nodes.find(n => n.editorId === editorId);
  check(node, 'SPATIAL_SOURCE_NODE_NOT_FOUND');
  check(node.relation === 'ROOT' && node.parentAddress === null && node.stateKind === 'NONE' &&
    node.layer === 'furniture' && node.editability === 'editable' &&
    node.dependencyIds.length === 0,
    'SPATIAL_TRANSFORM_PREVIEW_ROOT_ONLY');
  const dx = integer(request.dx, 'SPATIAL_PREVIEW_DX_INVALID');
  const dy = integer(request.dy, 'SPATIAL_PREVIEW_DY_INVALID');
  const turns = request.quarterTurns ?? 0;
  check(Number.isInteger(turns) && turns >= 0 && turns <= 3,
    'SPATIAL_ROTATE_TURNS_INVALID');
  check(dx !== 0 || dy !== 0 || turns !== 0, 'SPATIAL_PREVIEW_NOOP');
  check(node.footprintMode === 'ORIENTED_BOUNDING_RECT' && rectangular(node.footprint),
    'SPATIAL_PREVIEW_FOOTPRINT_UNVERIFIED');
  check([0,4,8,12].includes(node.orientation), 'SPATIAL_PREVIEW_CARDINAL_ONLY');
  const grid = scene.grids.find(g => g.gridId === node.address.gridId);
  check(grid, 'SPATIAL_PREVIEW_GRID_MISSING');
  const x = node.x + dx, y = node.y + dy;
  check(Number.isSafeInteger(x) && Number.isSafeInteger(y), 'SPATIAL_PREVIEW_POSITION_OVERFLOW');
  const footprint = rotatedRect(node.footprint, turns);
  check(contained(grid, x, y, footprint), 'SPATIAL_PREVIEW_OUT_OF_BOUNDS');
  const target = new Set(footprint.map(c => `${x+c.x}:${y+c.y}`));
  for (const other of scene.nodes) {
    if (other.editorId === node.editorId || other.address.gridId !== grid.gridId) continue;
    check(!other.footprint.some(c => target.has(`${other.x+c.x}:${other.y+c.y}`)),
      'SPATIAL_PREVIEW_OCCUPANCY_COLLISION');
  }
  return Object.freeze({
    editorId: node.editorId,
    address: node.address,
    sourceRevision: scene.sourceRevision,
    before: { x: node.x, y: node.y, orientation: node.orientation },
    after: { x, y, orientation: (node.orientation + turns*4) % 16 },
    footprint,
    status: 'SCHEMATIC_ONLY' as const,
    nativePlacementVerified: false as const,
    persistentWriteAuthorized: false as const,
    productApplyAuthorized: false as const
  });
}
