/**
 * 02 WEP — additive SOURCE REFERENCE consumer for the accepted 01B 626 reader.
 *
 * No 2D/native Grid positions, no separate SaveSession, no writer, no upload.
 * This wrapper is bound to the current decoded local Save object identity and
 * UI SourceSHA/Epoch only. These are UI scope fences, NOT trusted Core CAS.
 */
import {
  inspect626SourceObjectAtRevision,
  read626SpatialReferences,
  SWITCH_626
} from './real-save-spatial-source.ts';
import type { SpatialSourceRead } from './real-save-spatial-source.ts';
import type { OpenWorldSaveResult } from './world-save-source.ts';

export const WEP_626_SOURCE_INSPECTOR_CONTRACT = 'wep.626.source-reference-inspector@1';

export type Source626Identity = Readonly<{
  editorId: string;
  gridId: number;
  gridObjectId: number;
  itemId: number;
  serializedGridLocalX: number;
  serializedGridLocalY: number;
  serializedOrientation: number | string;
  relation: 'AREA_ROOT' | 'SUBGRID_CHILD';
  parentEditorId: string | null;
  geometryFor2d: 'NOT_VERIFIED';
  trustedCoreRevision: false;
  nativePlacementVerified: false;
  persistentWriteAuthorized: false;
  productApplyAuthorized: false;
}>;

export interface Bound626Inspector {
  readonly contract: typeof WEP_626_SOURCE_INSPECTOR_CONTRACT;
  readonly sourceInstance: OpenWorldSaveResult;
  readonly sourceSha256: string;
  readonly uiEpoch: number;
  readonly index: SpatialSourceRead;
  readonly sourceRevision: string;
  readonly acceptedRootGridIds: readonly number[];
  readonly geometryFor2d: 'NOT_VERIFIED';
  readonly trustedCoreRevision: false;
  readonly persistentWriteAuthorized: false;
  readonly productApplyAuthorized: false;
}

function uint(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}
function canonical(v: unknown): number | null {
  if (typeof v === 'number') return uint(v) ? v : null;
  if (typeof v !== 'string' || !/^(0|[1-9][0-9]*)$/.test(v)) return null;
  const x = Number(v);
  return uint(x) ? x : null;
}
function rawRecord(v: unknown): Record<string, any> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? v as Record<string, any> : null;
}

/** The original P1G was already decoded in the existing World read flow. */
export function bind626SourceInspector(
  opened: OpenWorldSaveResult,
  sourceSha256: string,
  uiEpoch: number,
  externallyConfirmedBid: string
): Bound626Inspector {
  if (!opened || opened.profileSchemaVersion !== 626 ||
      opened.inputFormat !== 'packaged' ||
      opened.saveIdentity?.sourcePlatform !== 'switch' ||
      opened.compatibility?.gameVersion !== SWITCH_626.gameVersion ||
      opened.compatibility?.readOnly !== true ||
      opened.compatibility?.productionReadAccepted !== true ||
      opened.compatibility?.routesAuthorized !== false ||
      opened.compatibility?.exactBuildKnown !== true ||
      opened.compatibility?.editingAuthorized !== false ||
      opened.compatibility?.persistentWriteAuthorized !== false ||
      externallyConfirmedBid !== SWITCH_626.bid) {
    throw Error('WEP_626_INSPECTOR_EXACT_READONLY_SOURCE_REQUIRED');
  }
  if (!/^[0-9a-f]{64}$/i.test(sourceSha256) || !uint(uiEpoch) || uiEpoch < 1)
    throw Error('WEP_626_INSPECTOR_SOURCE_SCOPE_REQUIRED');
  const sourceRevision = 'wep626-ui-epoch:' + uiEpoch;
  const index = read626SpatialReferences(opened.profile, {
    ...SWITCH_626,sourceSha256,sourceRevision
  });
  const blocked = new Set(index.issues.map(issue => issue.gridId).filter(uint));
  const roots = index.grids.filter(grid =>
    grid.kind === 'GRIDS' && grid.areaRefs.length === 1 &&
    !grid.parentAddress && !blocked.has(grid.gridId)
  ).map(grid => grid.gridId);
  return Object.freeze({
    contract: WEP_626_SOURCE_INSPECTOR_CONTRACT,
    sourceInstance: opened, sourceSha256, uiEpoch, index,
    sourceRevision, acceptedRootGridIds: Object.freeze(roots),
    geometryFor2d: 'NOT_VERIFIED' as const,
    trustedCoreRevision: false as const,
    persistentWriteAuthorized: false as const,
    productApplyAuthorized: false as const
  });
}

function verifyCurrent(
  binding: Bound626Inspector | null,
  opened: OpenWorldSaveResult | null,
  sha: string,
  epoch: number
): asserts binding is Bound626Inspector {
  if (!binding || binding.contract !== WEP_626_SOURCE_INSPECTOR_CONTRACT ||
      binding.sourceInstance !== opened || binding.sourceSha256 !== sha ||
      binding.uiEpoch !== epoch || binding.index.sourceRevision !== binding.sourceRevision ||
      binding.index.sourceSha256 !== sha ||
      opened?.compatibility?.readOnly !== true ||
      opened?.profileSchemaVersion !== 626)
    throw Error('WEP_626_INSPECTOR_STALE_SOURCE_OR_SESSION');
}

/** A source-minted and raw-rechecked native ID. Never emits scene coordinates. */
export function inspect626BoundObject(
  binding: Bound626Inspector | null,
  opened: OpenWorldSaveResult | null,
  sourceSha256: string,
  uiEpoch: number,
  gridKey: number | string,
  objectKey: number | string
): Source626Identity {
  verifyCurrent(binding,opened,sourceSha256,uiEpoch);
  const gridId = canonical(gridKey), objectId = canonical(objectKey);
  if (gridId === null || objectId === null)
    throw Error('WEP_626_INSPECTOR_CANONICAL_ADDRESS_REQUIRED');
  const editorId = `g${gridId}:o${objectId}`;
  const entry = inspect626SourceObjectAtRevision(
    binding.index,editorId,binding.sourceRevision,binding.sourceSha256
  );
  if (entry.address.gridId !== gridId ||
      entry.address.gridObjectId !== objectId ||
      entry.address.objectMapKey !== String(objectId) ||
      entry.geometryFor2d !== 'NOT_VERIFIED' ||
      entry.persistentWriteAuthorized !== false ||
      entry.productApplyAuthorized !== false)
    throw Error('WEP_626_INSPECTOR_SOURCE_ADDRESS_CONFLICT');
  const root = rawRecord(opened!.profile?.World?.GridCollection?.Grids);
  const grid = rawRecord(root?.[String(gridId)]);
  const raw = rawRecord(rawRecord(grid?.Objects)?.[String(objectId)]);
  if (!grid || grid.ID !== gridId || !raw || raw.ID !== objectId ||
      raw.ItemID !== entry.itemId ||
      raw.X !== entry.gridLocalSerialized.x ||
      raw.Y !== entry.gridLocalSerialized.y ||
      raw.Orientation !== entry.gridLocalSerialized.orientation)
    throw Error('WEP_626_INSPECTOR_RAW_SOURCE_CHANGED');
  if (entry.relation !== 'AREA_ROOT' && entry.relation !== 'SUBGRID_CHILD')
    throw Error('WEP_626_INSPECTOR_RELATION_UNRESOLVED');
  return Object.freeze({
    editorId,gridId,gridObjectId:objectId,itemId:entry.itemId,
    serializedGridLocalX:entry.gridLocalSerialized.x,
    serializedGridLocalY:entry.gridLocalSerialized.y,
    serializedOrientation:entry.gridLocalSerialized.orientation,
    relation:entry.relation,
    parentEditorId:entry.parentAddress?.editorId ?? null,
    geometryFor2d:'NOT_VERIFIED' as const,
    trustedCoreRevision:false as const,
    nativePlacementVerified:false as const,
    persistentWriteAuthorized:false as const,
    productApplyAuthorized:false as const
  });
}

export type Page626 = Readonly<{
  gridId: number;
  offset: number;
  totalCandidates: number;
  items: readonly Source626Identity[];
  blockedCount: number;
  nextOffset: number | null;
  geometryFor2d: 'NOT_VERIFIED';
}>;

/** Bounded on-device listing. No unvalidated native ID is ever displayed as selectable. */
export function page626BoundObjects(
  binding: Bound626Inspector | null,
  opened: OpenWorldSaveResult | null,
  sha: string,
  epoch: number,
  gridKey: number | string,
  offset: number = 0,
  limit: number = 20
): Page626 {
  verifyCurrent(binding,opened,sha,epoch);
  const gridId = canonical(gridKey);
  if (gridId === null || !uint(offset) || !uint(limit) || limit < 1 || limit > 25)
    throw Error('WEP_626_INSPECTOR_PAGE_BOUNDS_INVALID');
  if (!binding.index.grids.some(g => g.gridId === gridId && g.kind === 'GRIDS'))
    throw Error('WEP_626_INSPECTOR_GRID_UNKNOWN');
  const matches = binding.index.objects.filter(o => o.gridId === gridId);
  const selected = matches.slice(offset,offset+limit);
  const items: Source626Identity[] = [];
  let blockedCount = 0;
  for (const entry of selected) {
    try {
      items.push(inspect626BoundObject(
        binding,opened,sha,epoch,gridId,entry.address.gridObjectId
      ));
    } catch {
      blockedCount++;
    }
  }
  return Object.freeze({
    gridId,offset,totalCandidates:matches.length,
    items:Object.freeze(items),
    blockedCount,nextOffset:offset+limit < matches.length ? offset+limit : null,
    geometryFor2d:'NOT_VERIFIED' as const
  });
}
