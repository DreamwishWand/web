import { PlatformFamily } from '../ddv/core/save/versioning.js';
import { SafeProfileEditSession } from '../ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../ddv/core/save/p1g-packaged-profile-codec.js';
import { createVerifiedCandidateExportBundle } from '../ddv/core/save/verified-export-bundle.js';
import {
  ROOM_FINISH_MUTATION_SET_CONTRACT,
  ROOM_FINISH_OPERATION,
  WALLPAPER_SCOPE,
  compileRoomFlooringMutationV125,
  compileRoomWallpaperMutationV125,
  resolveCurrentWallV125,
  resolveIndoorRoomFinishV125
} from '../ddv/core/world/room-finish-v125.js';
import {
  ROOM_FINISH_ADAPTER_ID,
  buildRoomFinishTransactionPlanV125,
  createRoomFinishVerifiedWriteCandidateV125
} from '../ddv/core/world/room-finish-transaction-v125.js';
import { openWorldSaveBytes } from './world-save-source.ts';

type AnyRecord = Record<string, any>;
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export { WALLPAPER_SCOPE };

export const ROOM_FINISH_TRIMMING_PACK_PATH =
  '/ddv/wep/world/v1.25/room-finish-trimming-pack-v125.json';
export const ROOM_FINISH_TRIMMING_PACK_SHA256 =
  '32899e10d4d864ed7a9ee5571539807fec96016ceb48d747cac5315dbab3873c';
export const ROOM_FINISH_DRAFT_CONTRACT =
  'dreamwish-wand-wep-room-finish-draft@1';
export const ROOM_FINISH_VERIFIED_EXPORT_CONTRACT =
  'dreamwish-wand-wep-room-finish-verified-export-v125@1';
export const ROOM_FINISH_RUNTIME_REQUEST =
  '01B-TO-01E-ROOM-FINISH-V125-V1';
export const ROOM_FINISH_RUNTIME_EVIDENCE = Object.freeze({
  requestId: ROOM_FINISH_RUNTIME_REQUEST,
  status: 'CLOSED_PASS',
  flooringCaseA: 'PASS',
  allWallsStaleOffsetCaseB: 'PASS',
  currentWallCoveredBySharedPerWallSerializer: true,
  evidence:
    'Flooring Case A and All-Walls Wallpaper stale-offset cleanup Case B persisted through ordinary DDV save/re-extract; no additional Current Wall device cycle required.'
});
export const ROOM_FINISH_TARGET = Object.freeze({
  platform: 'Nintendo Switch',
  gameVersion: '1.25.0',
  buildID: '52BD625D9B4E0053',
  titleID: '0100D39012C1A000',
  profileSchemaVersion: 624
});
export const ROOM_FINISH_SURFACES = Object.freeze(['Floor', 'Wall', 'Ceiling']);
export const ROOM_FINISH_WALLS = Object.freeze([
  Object.freeze({ wallPosition: 0, name: 'Top' }),
  Object.freeze({ wallPosition: 1, name: 'Right' }),
  Object.freeze({ wallPosition: 2, name: 'Bottom' }),
  Object.freeze({ wallPosition: 3, name: 'Left' })
]);

function clone<T>(value:T):T { return structuredClone(value); }
function asObj(value:any):AnyRecord|null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as AnyRecord
    : null;
}
function fail(code:string, detail:any = null):never {
  const error:any = new Error(code);
  error.code = code;
  if (detail !== null) error.detail = detail;
  throw error;
}
function int(value:any, code:string) {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) fail(code);
  return n;
}
async function sha256Hex(bytes:Uint8Array) {
  if (!globalThis.crypto?.subtle) fail('WEP_ROOM_FINISH_SHA256_UNAVAILABLE');
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), value =>
    value.toString(16).padStart(2, '0')
  ).join('');
}
function coreSource() {
  return {
    platform: ROOM_FINISH_TARGET.platform,
    gameVersion: ROOM_FINISH_TARGET.gameVersion,
    buildIdentity: ROOM_FINISH_TARGET.buildID,
    profileSchemaVersion: ROOM_FINISH_TARGET.profileSchemaVersion
  };
}
function exactOpened(opened:any) {
  return Boolean(
    opened?.inputFormat === 'packaged' &&
    opened?.saveIdentity?.sourcePlatform === 'switch' &&
    opened?.compatibility?.gameVersion === ROOM_FINISH_TARGET.gameVersion &&
    Number(opened?.profileSchemaVersion) === ROOM_FINISH_TARGET.profileSchemaVersion
  );
}

export async function loadRoomFinishTrimmingPackV125({
  basePath = '',
  fetchImpl = globalThis.fetch.bind(globalThis)
}:{
  basePath?:string;
  fetchImpl?:FetchLike;
} = {}) {
  const prefix = String(basePath || '').replace(/\/$/, '');
  const response = await fetchImpl(prefix + ROOM_FINISH_TRIMMING_PACK_PATH);
  if (!response.ok) fail('WEP_ROOM_FINISH_TRIMMING_PACK_FETCH_FAILED');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = await sha256Hex(bytes);
  if (hash !== ROOM_FINISH_TRIMMING_PACK_SHA256) {
    fail('WEP_ROOM_FINISH_TRIMMING_PACK_HASH_MISMATCH', { hash });
  }
  let pack:any;
  try {
    pack = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail('WEP_ROOM_FINISH_TRIMMING_PACK_JSON_INVALID');
  }
  if (
    pack?.schema !== 'dreamwish-wand-v125-room-finish-trimming-pack' ||
    Number(pack?.version) !== 1 ||
    pack?.platform !== ROOM_FINISH_TARGET.platform ||
    pack?.gameVersion !== ROOM_FINISH_TARGET.gameVersion ||
    pack?.buildID !== ROOM_FINISH_TARGET.buildID ||
    Number(pack?.profileSchemaVersion) !== ROOM_FINISH_TARGET.profileSchemaVersion ||
    Number(pack?.counts?.total) !== 360 ||
    Number(pack?.counts?.wallpaper) !== 215 ||
    Number(pack?.counts?.flooring) !== 145 ||
    Object.keys(pack?.records ?? {}).length !== 360
  ) {
    fail('WEP_ROOM_FINISH_TRIMMING_PACK_CONTRACT_MISMATCH');
  }
  return Object.freeze(pack);
}

function trimmingInventory(profile:any, roleHint:number) {
  const player = asObj(profile?.Player);
  const inventories = asObj(player?.ListInventories);
  if (!inventories) fail('WEP_ROOM_FINISH_LIST_INVENTORIES_REQUIRED');
  const inventory = asObj(inventories[String(roleHint)] ?? inventories[roleHint]);
  if (!inventory) fail('WEP_ROOM_FINISH_TRIMMING_INVENTORY_REQUIRED');
  const compatible = inventory.CompatibleItemType;
  if (
    !(
      Number(compatible) === 16 ||
      compatible === 'ItemType_Trimming' ||
      compatible === 'Trimming'
    )
  ) {
    fail('WEP_ROOM_FINISH_TRIMMING_INVENTORY_ROLE_MISMATCH');
  }
  const data = asObj(inventory.Inventory);
  if (!data) fail('WEP_ROOM_FINISH_TRIMMING_INVENTORY_DATA_REQUIRED');
  return data;
}

export function resolveRoomFinishTrimmingEvidenceV125({
  profile,
  pack,
  itemId,
  requiredSubtype
}:{
  profile:any;
  pack:any;
  itemId:number;
  requiredSubtype:0|1;
}) {
  const id = int(itemId, 'WEP_ROOM_FINISH_ITEM_ID_INVALID');
  const record = pack?.records?.[String(id)];
  if (!Array.isArray(record) || record.length !== 3) {
    fail('WEP_ROOM_FINISH_ITEM_NOT_TRIMMING');
  }
  const subtype = int(record[0], 'WEP_ROOM_FINISH_TRIMMING_SUBTYPE_INVALID');
  if (subtype !== requiredSubtype) {
    fail(
      requiredSubtype === 1
        ? 'WEP_ROOM_FINISH_FLOORING_SUBTYPE_REQUIRED'
        : 'WEP_ROOM_FINISH_WALLPAPER_SUBTYPE_REQUIRED'
    );
  }
  const canonicalItemId = int(
    record[1],
    'WEP_ROOM_FINISH_CANONICAL_OWNERSHIP_ID_INVALID'
  );
  const roleHint = int(record[2], 'WEP_ROOM_FINISH_INVENTORY_ROLE_INVALID');
  const data = trimmingInventory(profile, roleHint);
  const raw = asObj(data[String(canonicalItemId)] ?? data[canonicalItemId]);
  const amount = raw ? Number(raw.Amount) : 0;
  if (!Number.isSafeInteger(amount) || amount < 0) {
    fail('WEP_ROOM_FINISH_OWNED_AMOUNT_INVALID');
  }
  return Object.freeze({
    itemId: id,
    concreteType: 'TrimmingItemData',
    trimmingItemType: subtype,
    ownedAmount: amount,
    ownershipCanonicalItemID: canonicalItemId,
    listInventoryRoleHint: roleHint,
    owned: amount >= 1,
    ownershipMutationAuthorized: false
  });
}

export function listOwnedRoomFinishTrimmingV125({
  profile,
  pack,
  subtype
}:{
  profile:any;
  pack:any;
  subtype:0|1;
}) {
  const out:any[] = [];
  for (const key of Object.keys(pack?.records ?? {})) {
    const record = pack.records[key];
    if (!Array.isArray(record) || Number(record[0]) !== Number(subtype)) continue;
    const evidence = resolveRoomFinishTrimmingEvidenceV125({
      profile,
      pack,
      itemId:Number(key),
      requiredSubtype:subtype
    });
    if (evidence.owned) out.push(evidence);
  }
  return Object.freeze(out.sort((a,b)=>a.itemId-b.itemId));
}

export function listIndoorRoomFinishRoutesV125(profile:any) {
  const houses = profile?.World?.PlayerHouses;
  if (!Array.isArray(houses)) return Object.freeze({ routes:[], diagnostics:[] });
  const routes:any[] = [];
  const diagnostics:any[] = [];
  houses.forEach((house:any, playerHouseIndex:number)=>{
    const houseItemId = Number(house?.HouseItemID);
    const floors = house?.Floors;
    if (!Number.isSafeInteger(houseItemId) || !Array.isArray(floors)) {
      diagnostics.push({
        code:'WEP_ROOM_FINISH_HOUSE_SHAPE_UNSUPPORTED',
        playerHouseIndex
      });
      return;
    }
    floors.forEach((floor:any, floorIndex:number)=>{
      const rooms = asObj(floor?.Rooms);
      if (!rooms) return;
      for (const roomKey of Object.keys(rooms)) {
        const roomSlot = Number(roomKey);
        if (!Number.isSafeInteger(roomSlot)) {
          diagnostics.push({
            code:'WEP_ROOM_FINISH_ROOM_SLOT_INVALID',
            playerHouseIndex,floorIndex,roomKey
          });
          continue;
        }
        const locator = {
          houseItemId,
          playerHouseIndex,
          floorIndex,
          roomSlot
        };
        const resolved:any = (resolveIndoorRoomFinishV125 as any)({
          source:coreSource(),
          profile,
          locator
        });
        if (resolved?.status !== 'VALID' || !resolved?.projection) {
          diagnostics.push({
            code:'WEP_ROOM_FINISH_ROOM_UNRESOLVED',
            locator:clone(locator),
            reasonCodes:clone(resolved?.reasonCodes ?? [])
          });
          continue;
        }
        routes.push(Object.freeze({
          locator:Object.freeze(locator),
          roomName:String(rooms[roomKey]?.Name ?? ''),
          projection:Object.freeze(clone(resolved.projection))
        }));
      }
    });
  });
  return Object.freeze({
    routes:Object.freeze(routes),
    diagnostics:Object.freeze(diagnostics)
  });
}

function finishState(projection:any) {
  return Object.freeze({
    flooringItemId:Number(projection.flooringItemId),
    wallpapers:Object.freeze(clone(projection.wallpapers ?? {})),
    wallpaperOffsetById:Object.freeze(clone(projection.wallpaperOffsetById ?? {})),
    ceilingItemId:Number(projection.ceilingItemId)
  });
}
function finishTarget(projection:any) {
  return Object.freeze({
    kind:'PLAYER_HOUSE_ROOM',
    playerHouseIndex:Number(projection.currentSaveLocator?.playerHouseIndex),
    houseItemId:Number(projection.semanticIdentity?.houseItemId),
    floorIndex:Number(projection.semanticIdentity?.floorIndex),
    roomSlot:Number(projection.semanticIdentity?.roomSlot),
    floorGridId:Number(projection.currentSaveLocator?.floorGridId),
    wallGridIds:Object.freeze(clone(projection.currentSaveLocator?.wallGridIds ?? {}))
  });
}

export function createRoomFinishEditorDocumentV125(projection:any) {
  if (projection?.contract !== 'ddv.indoor-room-finish-projection@1') {
    fail('WEP_ROOM_FINISH_PROJECTION_REQUIRED');
  }
  const state = finishState(projection);
  const target = finishTarget(projection);
  return {
    schema:'dreamwish-wand-editor-document',
    version:1,
    target:{
      platform:ROOM_FINISH_TARGET.platform,
      gameVersion:ROOM_FINISH_TARGET.gameVersion,
      buildID:ROOM_FINISH_TARGET.buildID,
      ...clone(target)
    },
    objects:[],
    networks:{},
    capabilities:{
      roomFinishDraft:true,
      roomFinishVerifiedExport:true,
      worldPersistentWrite:'unsupported'
    },
    metadata:{
      roomFinish:{
        roomPath:String(projection.roomPath ?? ''),
        ceilingWriteAuthorized:false,
        exactBuildKnown:false,
        persistentWriteAuthorized:false
      }
    },
    roomFinish:{
      contract:ROOM_FINISH_DRAFT_CONTRACT,
      target:clone(target),
      projection:clone(projection),
      baseline:clone(state),
      current:clone(state),
      pendingMutationSet:null,
      persistentWriteAuthorized:false,
      productApplyAuthorized:false,
      directSourceReplacementAuthorized:false
    }
  };
}

export function resolveRoomFinishCurrentWallV125(
  document:any,
  wallPosition:number
) {
  const projection = document?.roomFinish?.projection;
  const gridId = projection?.currentSaveLocator?.wallGridIds?.[String(wallPosition)];
  const resolved:any = (resolveCurrentWallV125 as any)(projection, {
    wallPosition,
    wallGridId:gridId
  });
  if (resolved?.status !== 'VALID') {
    fail('WEP_ROOM_FINISH_CURRENT_WALL_UNRESOLVED', {
      reasonCodes:clone(resolved?.reasonCodes ?? [])
    });
  }
  return resolved.wall;
}

function ensureCleanRoomFinishDraft(document:any) {
  if (document?.roomFinish?.contract !== ROOM_FINISH_DRAFT_CONTRACT) {
    fail('WEP_ROOM_FINISH_DRAFT_REQUIRED');
  }
  if (document.roomFinish.pendingMutationSet) {
    fail('WEP_ROOM_FINISH_PENDING_REVIEW_REQUIRED');
  }
}

function applyMutationToState(state:any, mutation:any) {
  const next = clone(state);
  for (const change of mutation?.changes ?? []) {
    const path = String(change.path ?? '');
    if (path.endsWith('/Flooring')) {
      next.flooringItemId = Number(change.after);
      continue;
    }
    const wallpaper = path.match(/\/Wallpapers\/(\d+)$/);
    if (wallpaper) {
      next.wallpapers[String(Number(wallpaper[1]))] = Number(change.after);
      continue;
    }
    const offset = path.match(/\/WallpaperOffsetById\/(\d+)$/);
    if (offset && change.kind === 'REMOVE') {
      delete next.wallpaperOffsetById[String(Number(offset[1]))];
      continue;
    }
    fail('WEP_ROOM_FINISH_DRAFT_CHANGE_UNSUPPORTED', { path });
  }
  return next;
}

export function compileRoomFinishFlooringDraftV125({
  document, profile, pack, itemId
}:{
  document:any;
  profile:any;
  pack:any;
  itemId:number;
}) {
  ensureCleanRoomFinishDraft(document);
  const evidence = resolveRoomFinishTrimmingEvidenceV125({
    profile,pack,itemId,requiredSubtype:1
  });
  const compiled:any = (compileRoomFlooringMutationV125 as any)({
    projection:document.roomFinish.projection,
    itemEvidence:evidence
  });
  if (compiled?.status !== 'READY') {
    fail('WEP_ROOM_FINISH_FLOORING_COMPILE_REJECTED', {
      reasonCodes:clone(compiled?.reasonCodes ?? [])
    });
  }
  return Object.freeze({
    mutationSet:clone(compiled.mutation),
    nextState:Object.freeze(
      applyMutationToState(document.roomFinish.current, compiled.mutation)
    )
  });
}

export function compileRoomFinishWallpaperDraftV125({
  document, profile, pack, itemId, scope, wallPosition = null
}:{
  document:any;
  profile:any;
  pack:any;
  itemId:number;
  scope:'CURRENT_WALL'|'ALL_WALLS';
  wallPosition?:number|null;
}) {
  ensureCleanRoomFinishDraft(document);
  const evidence = resolveRoomFinishTrimmingEvidenceV125({
    profile,pack,itemId,requiredSubtype:0
  });
  let currentWall:any = null;
  if (scope === WALLPAPER_SCOPE.CURRENT_WALL) {
    if (!Number.isSafeInteger(Number(wallPosition))) {
      fail('WEP_ROOM_FINISH_CURRENT_WALL_REQUIRED');
    }
    currentWall = resolveRoomFinishCurrentWallV125(
      document,
      Number(wallPosition)
    );
  } else if (scope !== WALLPAPER_SCOPE.ALL_WALLS) {
    fail('WEP_ROOM_FINISH_WALLPAPER_SCOPE_INVALID');
  }
  const compiled:any = (compileRoomWallpaperMutationV125 as any)({
    projection:document.roomFinish.projection,
    itemEvidence:evidence,
    scope,
    currentWall
  });
  if (compiled?.status !== 'READY') {
    fail('WEP_ROOM_FINISH_WALLPAPER_COMPILE_REJECTED', {
      reasonCodes:clone(compiled?.reasonCodes ?? [])
    });
  }
  return Object.freeze({
    mutationSet:clone(compiled.mutation),
    nextState:Object.freeze(
      applyMutationToState(document.roomFinish.current, compiled.mutation)
    )
  });
}

export function roomFinishDraftReviewChange(document:any) {
  const room = document?.roomFinish;
  const mutation = room?.pendingMutationSet;
  if (
    room?.contract !== ROOM_FINISH_DRAFT_CONTRACT ||
    mutation?.contract !== ROOM_FINISH_MUTATION_SET_CONTRACT
  ) return null;
  const target = clone(mutation.target);
  if (mutation.operation === ROOM_FINISH_OPERATION.SET_FLOORING) {
    const change = mutation.changes?.find((entry:any)=>
      String(entry.path).endsWith('/Flooring')
    );
    return Object.freeze({
      kind:'ROOM_FINISH',
      finishKind:'FLOORING',
      operation:'SET_FLOORING',
      target,
      oldItemId:Number(change?.before),
      newItemId:Number(change?.after),
      nativePreservation:[],
      diagnosticPaths:clone(mutation.allowedSemanticPaths ?? [])
    });
  }
  const wallChanges = (mutation.changes ?? []).filter((entry:any)=>
    /\/Wallpapers\/\d+$/.test(String(entry.path))
  );
  const cleanup = (mutation.changes ?? []).filter((entry:any)=>
    /\/WallpaperOffsetById\/\d+$/.test(String(entry.path)) &&
    entry.kind === 'REMOVE'
  );
  return Object.freeze({
    kind:'ROOM_FINISH',
    finishKind:'WALLPAPER',
    operation:'SET_WALLPAPER',
    scope:String(mutation.scope),
    target,
    affectedWallPositions:clone(mutation.selectedWallPositions ?? []),
    wallChanges:clone(wallChanges),
    newItemId:Number(mutation.itemId),
    nativePreservation:cleanup.map((entry:any)=>({
      kind:'REMOVE_DISPLACED_STALE_WALLPAPER_OFFSET',
      itemId:Number(String(entry.path).split('/').pop()),
      before:clone(entry.before)
    })),
    diagnosticPaths:clone(mutation.allowedSemanticPaths ?? [])
  });
}

export function applyRoomFinishDraftMutationV125(
  document:any,
  input:{mutationSet:any;nextState:any}
) {
  ensureCleanRoomFinishDraft(document);
  if (
    input?.mutationSet?.contract !== ROOM_FINISH_MUTATION_SET_CONTRACT ||
    !input?.nextState
  ) fail('WEP_ROOM_FINISH_DRAFT_MUTATION_INVALID');
  const next = clone(document);
  next.roomFinish.current = clone(input.nextState);
  next.roomFinish.pendingMutationSet = clone(input.mutationSet);
  return next;
}

function mutationSame(a:any,b:any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function reviewRoomFinishVerifiedExportV125({
  sourceBytes,
  sourceName,
  sourceEpoch,
  opened,
  draftDocument,
  exactBuildConfirmed = false
}:{
  sourceBytes:Uint8Array;
  sourceName:string;
  sourceEpoch:number;
  opened:any;
  draftDocument:any;
  exactBuildConfirmed?:boolean;
}) {
  if (!(sourceBytes instanceof Uint8Array) || !sourceBytes.length) {
    fail('WEP_ROOM_FINISH_SOURCE_REQUIRED');
  }
  if (exactBuildConfirmed !== true) {
    fail('WEP_ROOM_FINISH_EXACT_BUILD_CONFIRMATION_REQUIRED');
  }
  if (!exactOpened(opened)) fail('WEP_ROOM_FINISH_UNSUPPORTED_VERSION_BUILD');
  const mutationSet = draftDocument?.roomFinish?.pendingMutationSet;
  if (mutationSet?.contract !== ROOM_FINISH_MUTATION_SET_CONTRACT) {
    fail('WEP_ROOM_FINISH_PENDING_MUTATION_REQUIRED');
  }
  const safeSession = await SafeProfileEditSession.open({
    sourceBytes:sourceBytes.slice(),
    codec:p1gPackagedProfileCodec as any,
    sourcePlatform:PlatformFamily.Switch
  });
  const ctx = safeSession.getPreflightContext();
  const plan:any = (buildRoomFinishTransactionPlanV125 as any)({
    session:safeSession,
    mutationSet,
    planId:
      'wep-room-finish-' +
      String(mutationSet.target?.playerHouseIndex) + '-' +
      String(mutationSet.target?.floorIndex) + '-' +
      String(mutationSet.target?.roomSlot) + '-' +
      String(ctx.saveIdentity.sourceRawSha256).slice(0,12)
  });
  if (
    plan?.target?.kind !== 'PLAYER_HOUSE_ROOM' ||
    plan?.mutationAdapter?.id !== ROOM_FINISH_ADAPTER_ID
  ) {
    fail('WEP_ROOM_FINISH_CORE_BINDING_MISMATCH');
  }
  return Object.freeze({
    contract:ROOM_FINISH_VERIFIED_EXPORT_CONTRACT,
    status:'READY',
    sourceEpoch:Number(sourceEpoch),
    sourceName:String(sourceName || 'profile'),
    sourceSha256:String(ctx.saveIdentity.sourceRawSha256),
    sourceByteLength:safeSession.source.length,
    targetBuild:Object.freeze({
      platform:'switch',
      kind:'bid',
      value:ROOM_FINISH_TARGET.buildID
    }),
    mutationSet:clone(mutationSet),
    semanticChange:roomFinishDraftReviewChange(draftDocument),
    plan:clone(plan),
    runtimeAcceptance:ROOM_FINISH_RUNTIME_EVIDENCE,
    productExportAuthorized:true,
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

function assertReloadAgainstMutation(projection:any, mutation:any) {
  if (mutation.operation === ROOM_FINISH_OPERATION.SET_FLOORING) {
    if (Number(projection.flooringItemId) !== Number(mutation.itemId)) {
      fail('WEP_ROOM_FINISH_RELOAD_FLOORING_MISMATCH');
    }
  } else if (mutation.operation === ROOM_FINISH_OPERATION.SET_WALLPAPER) {
    for (const position of mutation.selectedWallPositions ?? []) {
      if (Number(projection.wallpapers?.[String(position)]) !== Number(mutation.itemId)) {
        fail('WEP_ROOM_FINISH_RELOAD_WALLPAPER_MISMATCH', { position });
      }
    }
  } else {
    fail('WEP_ROOM_FINISH_RELOAD_OPERATION_UNSUPPORTED');
  }
  for (const change of mutation.changes ?? []) {
    const offset = String(change.path ?? '').match(
      /\/WallpaperOffsetById\/(\d+)$/
    );
    if (
      offset &&
      change.kind === 'REMOVE' &&
      Object.prototype.hasOwnProperty.call(
        projection.wallpaperOffsetById ?? {},
        String(Number(offset[1]))
      )
    ) {
      fail('WEP_ROOM_FINISH_RELOAD_STALE_OFFSET_PRESENT', {
        itemId:Number(offset[1])
      });
    }
  }
}

export async function verifyRoomFinishReplacementArtifactPipelineV125({
  review,
  currentSourceEpoch,
  sourceBytes,
  draftDocument
}:{
  review:any;
  currentSourceEpoch:number;
  sourceBytes:Uint8Array;
  draftDocument:any;
}) {
  if (
    review?.contract !== ROOM_FINISH_VERIFIED_EXPORT_CONTRACT ||
    review?.status !== 'READY'
  ) fail('WEP_ROOM_FINISH_REVIEW_REQUIRED');
  if (Number(currentSourceEpoch) !== Number(review.sourceEpoch)) {
    fail('WEP_ROOM_FINISH_SOURCE_CHANGED_SINCE_PLAN');
  }
  const mutationSet = draftDocument?.roomFinish?.pendingMutationSet;
  if (!mutationSame(mutationSet, review.mutationSet)) {
    fail('WEP_ROOM_FINISH_REVIEW_STALE');
  }
  const sourceHashBefore = await sha256Hex(sourceBytes);
  if (
    sourceHashBefore !== review.sourceSha256 ||
    sourceBytes.length !== review.sourceByteLength
  ) fail('WEP_ROOM_FINISH_SOURCE_CHANGED_SINCE_PLAN');

  const safeSession = await SafeProfileEditSession.open({
    sourceBytes:sourceBytes.slice(),
    codec:p1gPackagedProfileCodec as any,
    sourcePlatform:PlatformFamily.Switch
  });
  let result:any;
  try {
    result = await (createRoomFinishVerifiedWriteCandidateV125 as any)({
      session:safeSession,
      mutationSet:review.mutationSet,
      planId:review.plan.planId
    });
  } catch (cause:any) {
    fail('WEP_ROOM_FINISH_CANDIDATE_GENERATION_FAILED', {
      causeCode:String(cause?.code ?? cause?.message ?? cause)
    });
  }
  if (result?.status !== 'PASS' || result?.verification?.status !== 'PASS') {
    fail('WEP_ROOM_FINISH_CANDIDATE_VERIFICATION_FAILED');
  }

  let artifacts:any;
  try {
    artifacts = await createVerifiedCandidateExportBundle({
      candidate:result.candidate,
      verification:result.verification,
      gameVersion:ROOM_FINISH_TARGET.gameVersion,
      targetBuild:review.targetBuild,
      sourceName:review.sourceName
    });
  } catch (cause:any) {
    fail('WEP_ROOM_FINISH_ASSEMBLY_FAILED', {
      causeCode:String(cause?.message ?? cause)
    });
  }

  let reopened:any;
  let projection:any;
  try {
    reopened = await openWorldSaveBytes(result.candidate.candidateBytes, {
      sourcePlatform:PlatformFamily.Switch
    });
    const resolved:any = (resolveIndoorRoomFinishV125 as any)({
      source:coreSource(),
      profile:reopened.profile,
      locator:{
        houseItemId:Number(review.mutationSet.target?.houseItemId),
        playerHouseIndex:Number(review.mutationSet.target?.playerHouseIndex),
        floorIndex:Number(review.mutationSet.target?.floorIndex),
        roomSlot:Number(review.mutationSet.target?.roomSlot)
      }
    });
    if (resolved?.status !== 'VALID' || !resolved?.projection) {
      throw new Error('ROOM_RELOAD_PROJECTION_FAILED');
    }
    projection = resolved.projection;
    assertReloadAgainstMutation(projection, review.mutationSet);
  } catch (cause:any) {
    fail('WEP_ROOM_FINISH_RELOAD_REPARSE_FAILED', {
      causeCode:String(cause?.message ?? cause)
    });
  }

  const sourceHashAfter = await sha256Hex(sourceBytes);
  if (sourceHashAfter !== sourceHashBefore) {
    fail('WEP_ROOM_FINISH_SOURCE_MUTATED');
  }
  return Object.freeze({
    contract:'dreamwish-wand-wep-room-finish-candidate-evidence@1',
    status:'PASS',
    review:clone(review),
    candidateManifest:clone(result.candidate.manifest),
    verification:clone(result.verification),
    artifacts,
    reload:Object.freeze({
      status:'PASS',
      profileSchemaVersion:reopened.profileSchemaVersion,
      roomIdentity:clone(review.mutationSet.target),
      finishState:finishState(projection)
    }),
    runtimeAcceptance:ROOM_FINISH_RUNTIME_EVIDENCE,
    source:Object.freeze({
      sha256Before:sourceHashBefore,
      sha256After:sourceHashAfter,
      byteLength:sourceBytes.length,
      untouched:sourceHashBefore === sourceHashAfter
    }),
    productExportAuthorized:true,
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

export async function commitRoomFinishVerifiedExportV125(
  input:Parameters<typeof verifyRoomFinishReplacementArtifactPipelineV125>[0]
) {
  const evidence = await verifyRoomFinishReplacementArtifactPipelineV125(input);
  if (evidence.runtimeAcceptance?.status !== 'CLOSED_PASS') {
    fail('WEP_ROOM_FINISH_RUNTIME_ACCEPTANCE_NOT_BOUND', {
      requestId:ROOM_FINISH_RUNTIME_REQUEST
    });
  }
  return evidence;
}
