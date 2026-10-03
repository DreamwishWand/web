import { SafeProfileEditSession } from '../ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../ddv/core/save/p1g-packaged-profile-codec.js';
import {
  BuildIdentityKind,
  PlatformFamily
} from '../ddv/core/save/versioning.js';
import {
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../ddv/core/save/transaction-foundation.js';
import {
  createVerifiedCandidateExportBundle
} from '../ddv/core/save/verified-export-bundle.js';
import {
  buildMinimumTransformTransactionPlan,
  classifyMinimumPersistentTransform,
  minimumPersistentTransformAdapter
} from '../ddv/core/world/min-transform-write-v125.js';
import {
  buildSwitchV125DestinationProgressionProjection
} from './progression-destination-projection-v115.ts';
import {
  openWorldSaveBytes
} from './world-save-source.ts';
import {
  projectSwitchAreaGrid
} from './world-browser-adapter.ts';

type AnyRecord = Record<string, any>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const MIN_VERIFIED_EXPORT_CONTRACT =
  'dreamwish-wand-wep-min-verified-transform-export@1';
export const MIN_TRANSFORM_SCOPE_PACK_PATH =
  '/ddv/core/world/v1.25/min-transform-scope-pack-v125.json';
export const MIN_TRANSFORM_SCOPE_PACK_SHA256 =
  '8fb0c2ba53977eb98a63930f56ae67408f59b6c2a7e01549a3430c9b5f6c8934';
export const SWITCH_V125_BID = '52BD625D9B4E0053';

const targetBuild = Object.freeze({
  platform: PlatformFamily.Switch,
  kind: BuildIdentityKind.SwitchBid,
  value: SWITCH_V125_BID
});

function error(code:string, detail:unknown = null):never {
  const e:any = new Error(code);
  e.code = code;
  e.detail = detail;
  throw e;
}

function semanticEqual(a:unknown,b:unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function clone<T>(value:T):T {
  return structuredClone(value);
}

async function sha256Hex(bytes:Uint8Array) {
  if (!globalThis.crypto?.subtle) error('WEP_EXPORT_SHA256_UNAVAILABLE');
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function fetchScopePack(
  basePath:string,
  fetchImpl:FetchLike
) {
  const prefix=String(basePath ?? '').replace(/\/$/,'');
  const response=await fetchImpl(`${prefix}${MIN_TRANSFORM_SCOPE_PACK_PATH}`);
  if(!response.ok) error('WEP_EXPORT_SCOPE_PACK_FETCH_FAILED');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if((await sha256Hex(bytes))!==MIN_TRANSFORM_SCOPE_PACK_SHA256) {
    error('WEP_EXPORT_SCOPE_PACK_HASH_MISMATCH');
  }
  let pack:any;
  try {
    pack=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch {
    error('WEP_EXPORT_SCOPE_PACK_JSON_INVALID');
  }
  if(
    pack?.schema!=='dreamwish-wand-v125-furniture-write-scope-core-browser-pack' ||
    Number(pack?.version)!==1 ||
    pack?.gameVersion!=='1.25.0' ||
    pack?.buildID!==SWITCH_V125_BID ||
    Number(pack?.sourceCount)!==6233 ||
    Number(pack?.coreCount)!==3276 ||
    !pack?.items ||
    typeof pack.items!=='object'
  ) error('WEP_EXPORT_SCOPE_PACK_CONTRACT_MISMATCH');
  return pack;
}

function scopeRecord(pack:AnyRecord,itemId:number) {
  const row=pack.items?.[String(itemId)];
  if(!Array.isArray(row)||row.length!==8) {
    error('WEP_EXPORT_OBJECT_NO_LONGER_ADMISSIBLE',{
      reason:'WRITE_SCOPE_RECORD_MISSING',
      itemId
    });
  }
  return Object.freeze({
    itemID:itemId,
    concreteType:row[0],
    scopeTier:row[1],
    interaction:row[2],
    isMissionItem:row[3],
    forPuzzleOnly:row[4],
    explicitGridEditRestriction:clone(row[5]),
    nativePresetKnownRejectReasons:clone(row[6]),
    isSyncOnlineItem:row[7]
  });
}

function documentShell(document:AnyRecord) {
  const shell=clone(document);
  delete shell.objects;
  return shell;
}

export function analyzeMinimumTransformDraft({
  baselineDocument,
  draftDocument
}:{
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
}) {
  if(!baselineDocument||!draftDocument) {
    error('WEP_EXPORT_NO_ELIGIBLE_PENDING_CHANGE');
  }
  if(!semanticEqual(documentShell(baselineDocument),documentShell(draftDocument))) {
    error('WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE',{
      reason:'DOCUMENT_NON_OBJECT_STATE_CHANGED'
    });
  }

  const beforeObjects=Array.isArray(baselineDocument.objects)
    ? baselineDocument.objects : [];
  const afterObjects=Array.isArray(draftDocument.objects)
    ? draftDocument.objects : [];
  if(beforeObjects.length!==afterObjects.length) {
    error('WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE',{
      reason:'OBJECT_IDENTITY_SET_CHANGED'
    });
  }

  const afterById=new Map(
    afterObjects.map((object:any)=>[String(object.editorId),object])
  );
  const changed:any[]=[];
  for(const before of beforeObjects) {
    const after=afterById.get(String(before.editorId));
    if(!after) {
      error('WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE',{
        reason:'OBJECT_IDENTITY_SET_CHANGED'
      });
    }
    if(!semanticEqual(before,after)) changed.push({before,after});
  }
  if(changed.length===0) error('WEP_EXPORT_NO_ELIGIBLE_PENDING_CHANGE');
  if(changed.length!==1) {
    error('WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE',{
      reason:'MULTI_OBJECT_CHANGE_UNSUPPORTED',
      count:changed.length
    });
  }

  const {before,after}=changed[0];
  const beforeStable=clone(before);
  const afterStable=clone(after);
  for(const key of ['x','y','orientation']) {
    delete beforeStable[key];
    delete afterStable[key];
  }
  if(!semanticEqual(beforeStable,afterStable)) {
    error('WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE',{
      reason:'NON_TRANSFORM_OBJECT_FIELD_CHANGED'
    });
  }

  const moved=Number(before.x)!==Number(after.x) ||
    Number(before.y)!==Number(after.y);
  const rotated=Number(before.orientation)!==Number(after.orientation);
  let operation:'MOVE'|'ROTATE';
  if(moved&&!rotated) operation='MOVE';
  else if(!moved&&rotated) operation='ROTATE';
  else {
    error('WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE',{
      reason:'MOVE_ROTATE_COMBINATION_UNSUPPORTED'
    });
  }

  if(
    before?.source?.relation!=='ROOT' ||
    after?.source?.relation!=='ROOT' ||
    !semanticEqual(before.source,after.source) ||
    Number(before.itemId)!==Number(after.itemId)
  ) {
    error('WEP_EXPORT_TARGET_IDENTITY_MISMATCH');
  }

  return Object.freeze({
    operation,
    editorId:String(before.editorId),
    itemId:Number(before.itemId),
    gridId:Number(before.source.gridId),
    gridObjectId:Number(before.source.gridObjectId),
    objectMapKey:String(before.source.objectMapKey),
    before:Object.freeze({
      x:Number(before.x),
      y:Number(before.y),
      orientation:Number(before.orientation)
    }),
    after:Object.freeze({
      x:Number(after.x),
      y:Number(after.y),
      orientation:Number(after.orientation)
    }),
    beforeObject:clone(before),
    afterObject:clone(after)
  });
}

export async function reviewMinimumVerifiedTransform({
  sourceBytes,
  sourceName,
  sourceEpoch,
  opened,
  baselineDocument,
  draftDocument,
  placementBinding,
  worldBinding,
  basePath='',
  fetchImpl=globalThis.fetch.bind(globalThis)
}:{
  sourceBytes:Uint8Array;
  sourceName:string;
  sourceEpoch:number;
  opened:AnyRecord;
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
  placementBinding:AnyRecord;
  worldBinding:AnyRecord;
  basePath?:string;
  fetchImpl?:FetchLike;
}) {
  if(!(sourceBytes instanceof Uint8Array)||!sourceBytes.length) {
    error('WEP_EXPORT_SOURCE_REQUIRED');
  }
  if(
    opened?.inputFormat!=='packaged' ||
    opened?.saveIdentity?.sourcePlatform!=='switch' ||
    opened?.compatibility?.gameVersion!=='1.25.0' ||
    Number(opened?.profileSchemaVersion)!==624
  ) error('WEP_EXPORT_UNSUPPORTED_VERSION_BUILD');

  const change=analyzeMinimumTransformDraft({
    baselineDocument,draftDocument
  });
  if(
    Number(draftDocument?.target?.rootGridId)!==change.gridId ||
    Number(baselineDocument?.target?.rootGridId)!==change.gridId
  ) error('WEP_EXPORT_CROSS_GRID_UNSUPPORTED');

  const [pack,progression,safeSession]=await Promise.all([
    fetchScopePack(basePath,fetchImpl),
    buildSwitchV125DestinationProgressionProjection({
      profile:opened.profile,
      progressionScopeIndex:worldBinding?.progressionScopeIndex,
      basePath,
      fetchImpl
    }),
    SafeProfileEditSession.open({
      sourceBytes:sourceBytes.slice(),
      codec:p1gPackagedProfileCodec,
      sourcePlatform:PlatformFamily.Switch
    })
  ]);

  const scope=scopeRecord(pack,change.itemId);
  const address=`${change.gridId}:${change.gridObjectId}`;
  const progressionRecord=progression?.projection?.byAddress?.[address];
  if(!progressionRecord) {
    error('WEP_EXPORT_PROGRESSION_VETO',{
      reason:'PROGRESSION_RECORD_MISSING',
      address
    });
  }
  if(
    progressionRecord.negativeVetoFound===true ||
    progressionRecord.destinationProtected===true ||
    (progressionRecord.operationVetoes?.[change.operation]??[]).length>0
  ) {
    error('WEP_EXPORT_PROGRESSION_VETO',{
      reasonCodes:clone(
        progressionRecord.operationVetoes?.[change.operation]??[]
      )
    });
  }

  if(typeof placementBinding?.classifyMinimumTransformPlacement!=='function') {
    error('WEP_EXPORT_PLACEMENT_BINDING_MISSING');
  }
  const placementEvidence=
    placementBinding.classifyMinimumTransformPlacement({
      document:draftDocument,
      editorId:change.editorId
    });
  if(
    placementEvidence?.result?.status!=='VALID' ||
    placementEvidence?.result?.valid!==true ||
    placementEvidence?.result?.verdict!=='VALID'
  ) {
    error('WEP_EXPORT_INVALID_DESTINATION',{
      placement:clone(placementEvidence)
    });
  }

  const coreClassification={
    itemId:change.itemId,
    concreteType:String(change.beforeObject?.metadata?.worldClass??''),
    stateKind:String(change.beforeObject?.metadata?.stateKind??''),
    layer:String(change.beforeObject?.layer??''),
    editability:String(change.beforeObject?.editability??''),
    reasons:clone(change.beforeObject?.metadata?.reasons??[])
  };
  const rootEvidence={
    relation:'ROOT',
    gridId:change.gridId,
    gridObjectId:change.gridObjectId,
    objectMapKey:change.objectMapKey
  };
  const admissibility=classifyMinimumPersistentTransform({
    source:{
      platform:'Nintendo Switch',
      gameVersion:'1.25.0',
      profileSchemaVersion:624,
      buildIdentity:SWITCH_V125_BID
    },
    profile:opened.profile,
    target:{
      gridId:change.gridId,
      gridObjectId:change.gridObjectId,
      itemId:change.itemId,
      objectMapKey:change.objectMapKey
    },
    scopeRecord:scope,
    coreClassification,
    rootEvidence,
    progressionRecord,
    placementEvidence,
    operation:change.operation,
    finalTransform:change.after
  });
  if(admissibility?.status!=='ADMISSIBLE') {
    error('WEP_EXPORT_OBJECT_NO_LONGER_ADMISSIBLE',{
      reasonCodes:clone(admissibility?.reasonCodes??[])
    });
  }

  const ctx=safeSession.getPreflightContext();
  const grid=opened.profile?.World?.GridCollection?.Grids?.[
    String(change.gridId)
  ];
  if(!grid||!Number.isSafeInteger(Number(grid.NextGridObjectID))) {
    error('WEP_EXPORT_TARGET_IDENTITY_MISMATCH',{
      reason:'NEXT_GRID_OBJECT_ID_UNRESOLVED'
    });
  }
  const transactionInput={
    platform:PlatformFamily.Switch,
    gameVersion:'1.25.0',
    profileGameInfoVersion:624,
    originalFileLength:safeSession.source.length,
    originalSha256:ctx.saveIdentity.sourceRawSha256,
    codecContract:ctx.codecContract,
    targetBuild:{...targetBuild}
  };
  const plan=buildMinimumTransformTransactionPlan({
    admissibility,
    transactionInput,
    nextGridObjectId:Number(grid.NextGridObjectID),
    planId:`wep-${change.operation.toLowerCase()}-${change.gridId}-${change.gridObjectId}-${String(ctx.saveIdentity.sourceRawSha256).slice(0,12)}`
  });

  return Object.freeze({
    contract:MIN_VERIFIED_EXPORT_CONTRACT,
    status:'READY',
    sourceEpoch:Number(sourceEpoch),
    sourceName:String(sourceName||'profile'),
    sourceSha256:String(ctx.saveIdentity.sourceRawSha256),
    sourceByteLength:safeSession.source.length,
    targetBuild,
    change,
    plan,
    admissibility:clone(admissibility),
    progressionRecord:clone(progressionRecord),
    placementEvidence:clone(placementEvidence),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false
  });
}

export async function commitMinimumVerifiedTransform({
  review,
  currentSourceEpoch,
  sourceBytes,
  worldBinding
}:{
  review:AnyRecord;
  currentSourceEpoch:number;
  sourceBytes:Uint8Array;
  worldBinding:AnyRecord;
}) {
  if(
    review?.contract!==MIN_VERIFIED_EXPORT_CONTRACT ||
    review?.status!=='READY'
  ) error('WEP_EXPORT_REVIEW_REQUIRED');
  if(Number(currentSourceEpoch)!==Number(review.sourceEpoch)) {
    error('WEP_EXPORT_SOURCE_CHANGED_SINCE_PLAN');
  }
  if(!(sourceBytes instanceof Uint8Array)||!sourceBytes.length) {
    error('WEP_EXPORT_SOURCE_REQUIRED');
  }

  const sourceHashBefore=await sha256Hex(sourceBytes);
  if(
    sourceHashBefore!==review.sourceSha256 ||
    sourceBytes.length!==review.sourceByteLength
  ) error('WEP_EXPORT_SOURCE_CHANGED_SINCE_PLAN');

  const safeSession=await SafeProfileEditSession.open({
    sourceBytes:sourceBytes.slice(),
    codec:p1gPackagedProfileCodec,
    sourcePlatform:PlatformFamily.Switch
  });
  const ctx=safeSession.getPreflightContext();
  if(ctx.saveIdentity.sourceRawSha256!==review.plan?.input?.originalSha256) {
    error('WEP_EXPORT_SOURCE_CHANGED_SINCE_PLAN');
  }

  let candidate:any;
  try {
    candidate=await createVerifiedWriteCandidate({
      session:safeSession,
      plan:review.plan,
      adapter:minimumPersistentTransformAdapter
    });
  } catch(cause:any) {
    error('WEP_EXPORT_CANDIDATE_GENERATION_FAILED',{
      causeCode:String(cause?.code??cause?.message??cause)
    });
  }

  let verification:any;
  try {
    verification=await verifyWriteCandidate({
      candidate,
      codec:p1gPackagedProfileCodec
    });
  } catch(cause:any) {
    error('WEP_EXPORT_CANDIDATE_VERIFICATION_FAILED',{
      causeCode:String(cause?.code??cause?.message??cause)
    });
  }
  if(verification?.status!=='PASS') {
    error('WEP_EXPORT_CANDIDATE_VERIFICATION_FAILED');
  }

  let artifacts:any;
  try {
    artifacts=await createVerifiedCandidateExportBundle({
      candidate,
      verification,
      gameVersion:'1.25.0',
      targetBuild:{...targetBuild},
      sourceName:review.sourceName
    });
  } catch(cause:any) {
    error('WEP_EXPORT_ASSEMBLY_FAILED',{
      causeCode:String(cause?.message??cause)
    });
  }

  let reopened:any;
  let projected:any;
  try {
    reopened=await openWorldSaveBytes(candidate.candidateBytes,{
      sourcePlatform:PlatformFamily.Switch
    });
    const villageIndex=Number(review.plan?.target?.villageIndex ??
      review.change?.beforeObject?.metadata?.villageIndex ??
      review.change?.beforeObject?.source?.villageIndex ??
      review.change?.route?.villageIndex ??
      review.change?.baselineTarget?.villageIndex);
    const areaId=Number(review.change?.baselineTarget?.areaId);
    const baselineTarget=review.change?.baselineTarget ??
      review.baselineTarget;
    const v=Number.isSafeInteger(villageIndex)
      ? villageIndex
      : Number(baselineTarget?.villageIndex);
    const a=Number.isSafeInteger(areaId)
      ? areaId
      : Number(baselineTarget?.areaId);
    const area=reopened.areas.find(
      (entry:any)=>
        Number(entry.villageIndex)===v &&
        Number(entry.areaId)===a
    );
    if(!area) throw new Error('RELOAD_AREA_ROUTE_MISSING');
    projected=projectSwitchAreaGrid(
      reopened,
      area,
      Number(review.change.gridId),
      worldBinding
    );
  } catch(cause:any) {
    error('WEP_EXPORT_RELOAD_REPARSE_FAILED',{
      causeCode:String(cause?.message??cause)
    });
  }

  const projectedObject=(projected?.objects??[]).find(
    (object:any)=>
      Number(object?.source?.gridId)===Number(review.change.gridId) &&
      Number(object?.source?.gridObjectId)===Number(review.change.gridObjectId)
  );
  const rawObject=
    reopened?.profile?.World?.GridCollection?.Grids?.[
      String(review.change.gridId)
    ]?.Objects?.[String(review.change.gridObjectId)];
  if(
    !projectedObject ||
    !rawObject ||
    Number(rawObject.ID)!==Number(review.change.gridObjectId) ||
    Number(rawObject.ItemID)!==Number(review.change.itemId) ||
    rawObject.State!==null ||
    Number(projectedObject.itemId)!==Number(review.change.itemId) ||
    Number(projectedObject.x)!==Number(review.change.after.x) ||
    Number(projectedObject.y)!==Number(review.change.after.y) ||
    Number(projectedObject.orientation)!==Number(review.change.after.orientation) ||
    Number(projectedObject?.source?.gridId)!==Number(review.change.gridId)
  ) {
    error('WEP_EXPORT_RELOAD_IDENTITY_OR_TRANSFORM_MISMATCH');
  }

  const sourceHashAfter=await sha256Hex(sourceBytes);
  if(sourceHashAfter!==sourceHashBefore) {
    error('WEP_EXPORT_SOURCE_MUTATED');
  }

  return Object.freeze({
    contract:MIN_VERIFIED_EXPORT_CONTRACT,
    status:'PASS',
    review:clone(review),
    candidateManifest:clone(candidate.manifest),
    verification:clone(verification),
    artifacts,
    reload:Object.freeze({
      status:'PASS',
      inputFormat:reopened.inputFormat,
      profileSchemaVersion:reopened.profileSchemaVersion,
      gridId:Number(review.change.gridId),
      gridObjectId:Number(review.change.gridObjectId),
      itemId:Number(review.change.itemId),
      transform:clone(review.change.after),
      rootMembershipPreserved:true,
      sourceIdentityPreserved:true
    }),
    source:Object.freeze({
      sha256Before:sourceHashBefore,
      sha256After:sourceHashAfter,
      byteLength:sourceBytes.length,
      untouched:sourceHashBefore===sourceHashAfter
    }),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false
  });
}
