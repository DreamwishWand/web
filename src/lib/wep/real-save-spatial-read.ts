/**
 * 02 WEP: local P1G -> already accepted EditorDocument -> 2D read provenance.
 * This is NOT a replacement decoder, native spatial authority, Core Revision
 * CAS, or a persistent Grid/Road/Fence writer. Only the originating Session
 * may consume this snapshot, and no private profile is retained here.
 */
import type { EditorDocument } from './editor-runtime.ts';
import type { SpatialScene } from './spatial-scene.ts';
import type { OpenWorldSaveResult } from './world-save-source.ts';
import { assert624ProjectedObjectsMatchSave, SWITCH_624 } from './real-save-spatial-source.ts';

export const WEP_REAL_SOURCE_READ_CONTRACT = 'wep.real-save-spatial-read@1';
const V125_BID = '52BD625D9B4E0053';
const ORIENTATIONS = [
  'GridOrientation_Up','GridOrientation_UpUpRight','GridOrientation_UpRight',
  'GridOrientation_UpRightRight','GridOrientation_Right',
  'GridOrientation_DownRightRight','GridOrientation_DownRight',
  'GridOrientation_DownDownRight','GridOrientation_Down',
  'GridOrientation_DownDownLeft','GridOrientation_DownLeft',
  'GridOrientation_DownLeftLeft','GridOrientation_Left',
  'GridOrientation_UpLeftLeft','GridOrientation_UpLeft',
  'GridOrientation_UpUpLeft'
];

type R = Record<string, any>;
const record = (value: unknown): R | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as R : null;
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);
const sourceOrientation = (value: unknown): number | null => {
  if (integer(value)) return value >= 0 && value < 16 ? value : null;
  if (typeof value === 'string') {
    const index = ORIENTATIONS.indexOf(value);
    return index < 0 ? null : index;
  }
  return null;
};
const sourceAddress = (source: unknown): { gridId: number; gridObjectId: number; objectMapKey: string } | null => {
  const s = record(source);
  if (!s || !integer(s.gridId) || !integer(s.gridObjectId) ||
      s.gridId < 0 || s.gridObjectId < 0 ||
      s.objectMapKey !== String(s.gridObjectId) ||
      s.relation !== 'ROOT' || s.parentAddress != null ||
      s.subGridId != null || s.subGridDataPath != null) return null;
  return { gridId: s.gridId, gridObjectId: s.gridObjectId, objectMapKey: s.objectMapKey };
};

export interface RealSaveSpatialIssue {
  editorId: string;
  itemId: number;
  code: string;
}
type SourceIdentity = Readonly<{
  editorId: string; gridId: number; objectId: number; itemId: number;
  sourceGridDataPath: string; worldClass: string;
}>;
// TypeScript ReadonlyMap/ReadonlySet is NOT runtime immutability. Never expose
// the mutable native-ID authority or the mutable post-inspection allowlist.
// These facades intentionally omit set/add/delete/clear and close over copies.
const issuedBindings = new WeakSet<object>();
const issuedVerdicts = new WeakSet<object>();
function sourceMapView<K, V>(source: Map<K, V>): ReadonlyMap<K, V> {
  const closed = new Map(source);
  const view: ReadonlyMap<K, V> = Object.freeze({
    get size() { return closed.size; },
    has(key: K) { return closed.has(key); },
    get(key: K) { return closed.get(key); },
    keys() { return closed.keys(); },
    values() { return closed.values(); },
    entries() { return closed.entries(); },
    [Symbol.iterator]() { return closed[Symbol.iterator](); },
    forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: any) {
      closed.forEach((value, key) => callbackfn.call(thisArg, value, key, view));
    }
  });
  return view;
}
function allowedIdView(source: Iterable<string>): ReadonlySet<string> {
  const closed = new Set(source);
  const view: ReadonlySet<string> = Object.freeze({
    get size() { return closed.size; },
    has(value: string) { return closed.has(value); },
    keys() { return closed.keys(); },
    values() { return closed.values(); },
    entries() { return closed.entries(); },
    [Symbol.iterator]() { return closed[Symbol.iterator](); },
    forEach(callbackfn: (value: string, key: string, set: ReadonlySet<string>) => void, thisArg?: any) {
      closed.forEach((value, key) => callbackfn.call(thisArg, value, key, view));
    }
  });
  return view;
}
function issuedVerdict(status: 'READY' | 'STALE', allowed: Iterable<string>, unresolved: RealSaveSpatialIssue[]): RealSaveSpatialVerdict {
  const result: RealSaveSpatialVerdict = Object.freeze({
    status, allowed: allowedIdView(allowed),
    unresolved: Object.freeze(unresolved.map(issue => Object.freeze({ ...issue }))),
    persistentWriteAuthorized: false as const
  });
  issuedVerdicts.add(result);
  return result;
}

export interface RealSaveSpatialBinding {
  contract: typeof WEP_REAL_SOURCE_READ_CONTRACT;
  sourceFingerprint: string;
  sourceEpoch: number;
  sourceSession: object;
  rootGridId: number;
  identities: ReadonlyMap<string, SourceIdentity>;
  rejected: ReadonlyArray<RealSaveSpatialIssue>;
  sourceVersion: '1.25.0';
  sourceSchema: 624;
  proof: 'LOCAL_SOURCE_SHAPED_READ_ONLY_NOT_NATIVE_V3';
  trustedCoreRevision: false;
  persistentWriteAuthorized: false;
  productApplyAuthorized: false;
}
export interface RealSaveSpatialVerdict {
  status: 'READY' | 'STALE';
  allowed: ReadonlySet<string>;
  unresolved: ReadonlyArray<RealSaveSpatialIssue>;
  persistentWriteAuthorized: false;
}
/**
 * Bind exactly one local opened schema624 source and one existing EditorSession.
 * Missing/unknown per-object provenance is diagnostic rather than fabricated
 * geometry. Unsupported source/version/root/revision rejects the whole binding.
 */
export function bindRealSaveSpatialRead({
  opened, document, session, sourceFingerprint, sourceEpoch, externalBid = ''
}: {
  opened: OpenWorldSaveResult;
  document: EditorDocument;
  session: object;
  sourceFingerprint: string;
  sourceEpoch: number;
  externalBid?: string;
}): RealSaveSpatialBinding {
  if (opened.profileSchemaVersion !== 624 ||
      opened.compatibility?.routesAuthorized !== true ||
      opened.compatibility?.gameVersion !== '1.25.0' ||
      opened.saveIdentity?.sourcePlatform !== 'switch' ||
      document?.target?.platform !== 'Nintendo Switch' ||
      document?.target?.gameVersion !== '1.25.0' ||
      document?.target?.profileSchemaVersion !== 624) {
    throw new Error('SPATIAL_READ_VERSION_OR_PLATFORM_UNSUPPORTED');
  }
  if (!session || typeof session !== 'object' ||
      !/^[a-f0-9]{64}$/i.test(sourceFingerprint) ||
      !integer(sourceEpoch) || sourceEpoch < 1) {
    throw new Error('SPATIAL_READ_SESSION_OR_FINGERPRINT_INVALID');
  }
  // An externally claimed incompatible BID must not borrow static v1.25.0
  // dimensions. Empty BID is still only a READ, never a verified Native gate.
  const claimed = [
    document.target?.sourceBuildIdentity, document.target?.buildIdentity,
    document.target?.contractBuildIdentity, externalBid
  ].filter((value) => typeof value === 'string' && value.trim());
  if (claimed.some((value) => String(value).trim().toUpperCase() !== V125_BID)) {
    throw new Error('SPATIAL_READ_BID_MISMATCH');
  }
  if (document.target?.exactBuildKnown === true &&
      !claimed.includes(V125_BID)) {
    throw new Error('SPATIAL_READ_EXACT_BUILD_UNPROVEN');
  }
  const rootId = document.target?.rootGridId;
  const grids = record(record(record(opened.profile?.World)?.GridCollection)?.Grids);
  if (!integer(rootId) || rootId < 0 || !grids ||
      !Object.prototype.hasOwnProperty.call(grids, String(rootId))) {
    throw new Error('SPATIAL_READ_ROOT_GRID_UNKNOWN');
  }
  const grid = record(grids[String(rootId)]);
  const gridPath = document.target?.gridDataPath;
  if (!grid || grid.ID !== rootId ||
      typeof grid.GridDataPath !== 'string' || !grid.GridDataPath ||
      grid.GridDataPath !== gridPath ||
      grid.TessellationFactor !== document.target?.tessellationFactor) {
    throw new Error('SPATIAL_READ_ROOT_GRID_CONFLICT');
  }
  const bounds = record(document.metadata?.rootGridBounds);
  if (!bounds || bounds.status !== 'AUTHORITATIVE_GRIDDATAPATH' ||
      !integer(bounds.x) || !integer(bounds.y) ||
      !integer(bounds.w) || !integer(bounds.h) ||
      bounds.w <= 0 || bounds.h <= 0) {
    throw new Error('SPATIAL_READ_GRID_BOUNDS_UNVERIFIED');
  }
  // Area membership is checked again against the raw source; the direct-root
  // (floating-island) location has already been checked by the 01B projector.
  const area = document.target?.areaId;
  if (area !== undefined && area !== null) {
    const village = opened.profile?.World?.Villages?.[document.target?.villageIndex];
    const areaRecord = record(record(village?.Areas)?.[String(area)]);
    if (!areaRecord || !Array.isArray(areaRecord.GridIDs) ||
        !areaRecord.GridIDs.includes(rootId)) {
      throw new Error('SPATIAL_READ_AREA_GRID_MEMBERSHIP_CONFLICT');
    }
  } else if (!document.target?.directRootRoute ||
             document.target.directRootRoute?.gridDataPath !== gridPath) {
    throw new Error('SPATIAL_READ_LOCATION_ROUTE_UNVERIFIED');
  }

  // PR418/QA424 source contract is independently accepted on current main.
  // Direct-root documents contain nested SubGrid hierarchy and must pass its
  // COMPLETE native root/child source membership checks, not just the list
  // of rendered root objects. Never use this v1.25.0 authority for schema626.
  if (document.metadata?.directRootProjection !== undefined) {
    assert624ProjectedObjectsMatchSave(opened.profile, document, {
      ...SWITCH_624,
      sourceSha256: sourceFingerprint,
      sourceRevision: 'WEP_UI_EPOCH_' + sourceEpoch
    });
  }
  const rawObjects = record(grid.Objects);
  if (!rawObjects || !Array.isArray(document.objects)) {
    throw new Error('SPATIAL_READ_OBJECT_MAP_UNKNOWN');
  }
  const identities = new Map<string, SourceIdentity>();
  const rejected: RealSaveSpatialIssue[] = [];
  const seenNative = new Set<string>();
  for (const obj of document.objects) {
    const reject = (code: string) => rejected.push({
      editorId: obj.editorId, itemId: obj.itemId, code
    });
    const address = sourceAddress(obj.source);
    if (!address || address.gridId !== rootId ||
        obj.editorId !== 'g' + rootId + ':o' + address.gridObjectId) {
      reject('SPATIAL_READ_SOURCE_ID_OR_PARENT_UNPROVEN');
      continue;
    }
    if (seenNative.has(address.objectMapKey)) {
      identities.delete(obj.editorId);
      reject('SPATIAL_READ_DUPLICATE_NATIVE_ID');
      continue;
    }
    seenNative.add(address.objectMapKey);
    if (!Object.prototype.hasOwnProperty.call(rawObjects, address.objectMapKey)) {
      reject('SPATIAL_READ_NATIVE_OBJECT_MISSING');
      continue;
    }
    const raw = record(rawObjects[address.objectMapKey]);
    if (!raw || raw.ID !== address.gridObjectId ||
        raw.ItemID !== obj.itemId ||
        raw.X !== obj.x || raw.Y !== obj.y ||
        sourceOrientation(raw.Orientation) !== obj.orientation) {
      reject('SPATIAL_READ_RAW_OBJECT_CONFLICT');
      continue;
    }
    if (obj.metadata?.geometryStatus !== 'RESOLVED' ||
        obj.metadata?.footprintMode !== 'ORIENTED_BOUNDING_RECT' ||
        obj.metadata?.sourceGridDataPath !== gridPath ||
        obj.metadata?.stateKind === 'UNKNOWN' ||
        obj.metadata?.stateKind === 'MULTI_OR_UNKNOWN') {
      reject('SPATIAL_READ_GEOMETRY_OR_STATE_UNVERIFIED');
      continue;
    }
    identities.set(obj.editorId, Object.freeze({
      editorId: obj.editorId, gridId: rootId,
      objectId: address.gridObjectId, itemId: obj.itemId,
      sourceGridDataPath: gridPath,
      worldClass: String(obj.metadata?.worldClass ?? '')
    }));
  }
  const bound: RealSaveSpatialBinding = Object.freeze({
    contract: WEP_REAL_SOURCE_READ_CONTRACT, sourceFingerprint, sourceEpoch,
    sourceSession: session, rootGridId: rootId,
    identities: sourceMapView(identities),
    rejected: Object.freeze(rejected.map(issue => Object.freeze({ ...issue }))),
    sourceVersion: '1.25.0' as const,
    sourceSchema: 624 as const,
    proof: 'LOCAL_SOURCE_SHAPED_READ_ONLY_NOT_NATIVE_V3' as const,
    trustedCoreRevision: false as const,
    persistentWriteAuthorized: false as const,
    productApplyAuthorized: false as const
  });
  issuedBindings.add(bound);
  return bound;
}

/** Validate against the active source/Session on EVERY re-projection. */
export function inspectRealSaveSpatialRead(
  binding: RealSaveSpatialBinding,
  document: EditorDocument,
  session: object,
  sourceFingerprint: string,
  sourceEpoch: number
): RealSaveSpatialVerdict {
  const stale = !binding || !issuedBindings.has(binding) ||
    binding.contract !== WEP_REAL_SOURCE_READ_CONTRACT ||
    binding.sourceSession !== session ||
    binding.sourceFingerprint !== sourceFingerprint ||
    binding.sourceEpoch !== sourceEpoch ||
    document?.target?.rootGridId !== binding.rootGridId ||
    document?.target?.profileSchemaVersion !== binding.sourceSchema ||
    document?.target?.gameVersion !== binding.sourceVersion;
  if (stale) {
    return issuedVerdict('STALE', [], (document?.objects ?? []).map(obj => ({
      editorId: obj.editorId, itemId: obj.itemId,
      code: 'SPATIAL_READ_SOURCE_REVISION_MISMATCH'
    })));
  }
  const allowed = new Set<string>();
  const unresolved = [...binding.rejected];
  const alreadyRejected = new Set(unresolved.map(issue => issue.editorId));
  for (const obj of document.objects) {
    if (alreadyRejected.has(obj.editorId)) continue;
    const original = binding.identities.get(obj.editorId);
    // A newly authored local EditorSession object is NOT a native GridObject.
    // Retain its existing draft-only schematic UX but never attach a Native ID.
    if (!original && obj.source == null &&
        /^draft-[1-9][0-9]*$/.test(obj.editorId) &&
        (obj.metadata?.draftInserted === true || obj.metadata?.draftDuplicate === true) &&
        obj.editability === 'editable' && obj.layer === 'furniture' &&
        Number.isSafeInteger(obj.x) && Number.isSafeInteger(obj.y) &&
        Array.isArray(obj.footprint) && obj.footprint.length > 0 &&
        obj.footprint.length <= 4096 &&
        obj.footprint.every(cell => Number.isSafeInteger(cell.x) && Number.isSafeInteger(cell.y))) {
      allowed.add(obj.editorId);
      continue;
    }
    const address = sourceAddress(obj.source);
    if (!original || !address ||
        address.gridId !== original.gridId ||
        address.gridObjectId !== original.objectId ||
        obj.editorId !== original.editorId ||
        obj.itemId !== original.itemId ||
        obj.metadata?.sourceGridDataPath !== original.sourceGridDataPath ||
        String(obj.metadata?.worldClass ?? '') !== original.worldClass ||
        obj.metadata?.geometryStatus !== 'RESOLVED' ||
        obj.metadata?.footprintMode !== 'ORIENTED_BOUNDING_RECT') {
      unresolved.push({
        editorId: obj.editorId, itemId: obj.itemId,
        code: 'SPATIAL_READ_SOURCE_ADDRESS_CHANGED_OR_UNVERIFIED'
      });
      continue;
    }
    allowed.add(obj.editorId);
  }
  return issuedVerdict('READY', allowed, unresolved);
}

/** Keep the existing painter order, hit-test and inspector identity intact. */
export function applyRealSaveReadToScene(
  scene: SpatialScene,
  verdict: RealSaveSpatialVerdict
): SpatialScene {
  // Never accept caller-constructed "READY" objects or a swapped allowlist.
  // The existing World route also supplies an unminted STALE fallback; it
  // must render zero native nodes, not throw or mint a new capability.
  const authorized = Boolean(verdict && issuedVerdicts.has(verdict) &&
    verdict.status === 'READY');
  const unresolvedIds = new Set(scene.unresolved.map(issue => issue.editorId));
  return {
    ...scene,
    objects: authorized
      ? scene.objects.filter(object => verdict.allowed.has(object.editorId))
      : [],
    unresolved: [
      ...scene.unresolved,
      ...(authorized ? verdict.unresolved.filter(issue => !unresolvedIds.has(issue.editorId)) : [])
    ],
    persistentWriteAuthorized: false
  };
}
