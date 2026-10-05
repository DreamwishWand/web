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
  buildOrdinaryFurnitureAddTransactionPlan,
  classifyOrdinaryFurnitureAdd,
  ordinaryFurnitureAddAdapter
} from '../ddv/core/world/ordinary-furniture-add-v125.js';
import { openWorldSaveBytes } from './world-save-source.ts';
import { projectSwitchAreaGrid } from './world-browser-adapter.ts';

type AnyRecord = Record<string, any>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const ORDINARY_FURNITURE_ADD_VERIFIED_EXPORT_CONTRACT =
  'dreamwish-wand-wep-ordinary-furniture-add-verified-export@1';
export const ORDINARY_FURNITURE_ADD_SCOPE_PACK_PATH =
  '/ddv/wep/world/v1.25/ordinary-furniture-add-scope-pack-v125.json';
export const ORDINARY_FURNITURE_ADD_SCOPE_PACK_SHA256 =
  '4aba15602f0ce8b99ac61cae81810c443f30ab8ce84063519c5431f2d3b10563';
export const ORDINARY_FURNITURE_ADD_RUNTIME_REQUEST =
  '01B-TO-01E-ORDINARY-FURNITURE-ADD-V125-V1';
export const ORDINARY_FURNITURE_ADD_RUNTIME_STATUS =
  'PENDING_01E_EXACT_ADD_AFTER_SEMANTIC_FREEZE';
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

function clone<T>(value:T):T {
  return structuredClone(value);
}

function semanticEqual(a:unknown,b:unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function sha256Hex(bytes:Uint8Array) {
  if (!globalThis.crypto?.subtle) error('WEP_ADD_SHA256_UNAVAILABLE');
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function fetchAddScopePack(
  basePath:string,
  fetchImpl:FetchLike
) {
  const prefix=String(basePath ?? '').replace(/\/$/,'');
  const response=await fetchImpl(
    `${prefix}${ORDINARY_FURNITURE_ADD_SCOPE_PACK_PATH}`
  );
  if(!response.ok) error('WEP_ADD_SCOPE_PACK_FETCH_FAILED');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if((await sha256Hex(bytes))!==ORDINARY_FURNITURE_ADD_SCOPE_PACK_SHA256) {
    error('WEP_ADD_SCOPE_PACK_HASH_MISMATCH');
  }
  let pack:any;
  try {
    pack=JSON.parse(
      new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    );
  } catch {
    error('WEP_ADD_SCOPE_PACK_JSON_INVALID');
  }
  if(
    pack?.schema!==
      'dreamwish-wand-v125-ordinary-furniture-add-scope-browser-pack' ||
    Number(pack?.version)!==1 ||
    pack?.gameVersion!=='1.25.0' ||
    pack?.buildID!==SWITCH_V125_BID ||
    pack?.sourceSha256!==
      'e4b13913017b3406f9a49bb9e343a6843d8907c98a8d779eb0726c5de955607a' ||
    Number(pack?.sourceCount)!==6233 ||
    Number(pack?.coreCount)!==3276 ||
    Number(pack?.eligibleCount)!==1099 ||
    !pack?.items ||
    typeof pack.items!=='object'
  ) error('WEP_ADD_SCOPE_PACK_CONTRACT_MISMATCH');
  return pack;
}

function scopeRecord(pack:AnyRecord,itemId:number) {
  const row=pack.items?.[String(itemId)];
  if(!Array.isArray(row)||row.length!==9) {
    error('WEP_ADD_OBJECT_NO_LONGER_ADMISSIBLE',{
      reason:'ADD_SCOPE_RECORD_MISSING',
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
    isSyncOnlineItem:row[7],
    isUnavailableForGenerator:row[8]
  });
}

function documentShell(document:AnyRecord) {
  const shell=clone(document);
  delete shell.objects;
  return shell;
}

export function analyzeOrdinaryFurnitureAddDraft({
  baselineDocument,
  draftDocument
}:{
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
}) {
  if(!baselineDocument||!draftDocument) {
    error('WEP_ADD_NO_ELIGIBLE_PENDING_CHANGE');
  }
  if(!semanticEqual(
    documentShell(baselineDocument),
    documentShell(draftDocument)
  )) {
    error('WEP_ADD_UNSUPPORTED_PENDING_CHANGE',{
      reason:'DOCUMENT_NON_OBJECT_STATE_CHANGED'
    });
  }

  const beforeObjects=Array.isArray(baselineDocument.objects)
    ? baselineDocument.objects : [];
  const afterObjects=Array.isArray(draftDocument.objects)
    ? draftDocument.objects : [];
  if(afterObjects.length!==beforeObjects.length+1) {
    error('WEP_ADD_UNSUPPORTED_PENDING_CHANGE',{
      reason:'EXACTLY_ONE_CREATED_OBJECT_REQUIRED',
      beforeCount:beforeObjects.length,
      afterCount:afterObjects.length
    });
  }

  const beforeById=new Map(
    beforeObjects.map((object:any)=>[String(object.editorId),object])
  );
  const afterById=new Map(
    afterObjects.map((object:any)=>[String(object.editorId),object])
  );
  for(const before of beforeObjects) {
    const after=afterById.get(String(before.editorId));
    if(!after || !semanticEqual(before,after)) {
      error('WEP_ADD_UNSUPPORTED_PENDING_CHANGE',{
        reason:'PREEXISTING_OBJECT_CHANGED',
        editorId:String(before.editorId)
      });
    }
  }

  const added=afterObjects.filter(
    (object:any)=>!beforeById.has(String(object.editorId))
  );
  if(added.length!==1) {
    error('WEP_ADD_UNSUPPORTED_PENDING_CHANGE',{
      reason:'EXACTLY_ONE_CREATED_OBJECT_REQUIRED',
      addedCount:added.length
    });
  }
  const object=added[0];
  const gridId=Number(draftDocument?.target?.rootGridId);
  if(
    !Number.isSafeInteger(gridId) ||
    Number(baselineDocument?.target?.rootGridId)!==gridId
  ) error('WEP_ADD_CROSS_GRID_UNSUPPORTED');

  const itemId=Number(object?.itemId);
  const x=Number(object?.x);
  const y=Number(object?.y);
  const orientation=Number(object?.orientation);
  if(
    !Number.isSafeInteger(itemId) ||
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    ![0,4,8,12].includes(orientation)
  ) error('WEP_ADD_CREATED_OBJECT_TRANSFORM_INVALID');

  if(
    object?.source!==null ||
    object?.portableState!==null ||
    (object?.dependencyIds??[]).length!==0 ||
    object?.layer!=='furniture' ||
    object?.editability!=='editable' ||
    object?.metadata?.worldClass!=='FurnitureItemData' ||
    object?.metadata?.stateKind!=='NONE'
  ) {
    error('WEP_ADD_CREATED_OBJECT_NOT_ORDINARY_ROOT_STATELESS_FURNITURE');
  }

  return Object.freeze({
    operation:'ADD',
    editorId:String(object.editorId),
    itemId,
    gridId,
    after:Object.freeze({x,y,orientation}),
    afterObject:clone(object)
  });
}

export async function reviewOrdinaryFurnitureAddVerifiedExport({
  sourceBytes,
  sourceName,
  sourceEpoch,
  opened,
  baselineDocument,
  draftDocument,
  placementBinding,
  basePath='',
  fetchImpl=globalThis.fetch.bind(globalThis),
  exactBuildConfirmed=false
}:{
  sourceBytes:Uint8Array;
  sourceName:string;
  sourceEpoch:number;
  opened:AnyRecord;
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
  placementBinding:AnyRecord;
  basePath?:string;
  fetchImpl?:FetchLike;
  exactBuildConfirmed?:boolean;
}) {
  if(!(sourceBytes instanceof Uint8Array)||!sourceBytes.length) {
    error('WEP_ADD_SOURCE_REQUIRED');
  }
  if(exactBuildConfirmed!==true) {
    error('WEP_ADD_EXACT_BUILD_CONFIRMATION_REQUIRED');
  }
  if(
    opened?.inputFormat!=='packaged' ||
    opened?.saveIdentity?.sourcePlatform!=='switch' ||
    opened?.compatibility?.gameVersion!=='1.25.0' ||
    Number(opened?.profileSchemaVersion)!==624
  ) error('WEP_ADD_UNSUPPORTED_VERSION_BUILD');

  const change=analyzeOrdinaryFurnitureAddDraft({
    baselineDocument,draftDocument
  });

  const [pack,safeSession]=await Promise.all([
    fetchAddScopePack(basePath,fetchImpl),
    SafeProfileEditSession.open({
      sourceBytes:sourceBytes.slice(),
      codec:p1gPackagedProfileCodec as any,
      sourcePlatform:PlatformFamily.Switch
    })
  ]);

  const scope=scopeRecord(pack,change.itemId);
  if(
    typeof placementBinding?.classifyMinimumTransformPlacement!=='function'
  ) error('WEP_ADD_PLACEMENT_BINDING_MISSING');

  const rawPlacement=
    placementBinding.classifyMinimumTransformPlacement({
      document:draftDocument,
      editorId:change.editorId
    });
  const placementEvidence=Object.freeze({
    ...clone(rawPlacement),
    candidate:Object.freeze({
      itemId:change.itemId,
      x:change.after.x,
      y:change.after.y,
      orientation:change.after.orientation
    })
  });
  if(
    placementEvidence?.result?.status!=='VALID' ||
    placementEvidence?.result?.valid!==true ||
    placementEvidence?.result?.verdict!=='VALID'
  ) {
    error('WEP_ADD_INVALID_DESTINATION',{
      placement:clone(placementEvidence)
    });
  }

  const coreClassification={
    itemId:change.itemId,
    concreteType:String(
      change.afterObject?.metadata?.worldClass??''
    ),
    stateKind:String(
      change.afterObject?.metadata?.stateKind??''
    ),
    layer:String(change.afterObject?.layer??''),
    editability:String(change.afterObject?.editability??''),
    reasons:clone(change.afterObject?.metadata?.reasons??[])
  };
  const rootEvidence={
    relation:'ROOT',
    gridId:change.gridId,
    parentAddress:null
  };

  const admissibility=classifyOrdinaryFurnitureAdd({
    source:{
      platform:'Nintendo Switch',
      gameVersion:'1.25.0',
      profileSchemaVersion:624,
      buildIdentity:SWITCH_V125_BID
    },
    profile:opened.profile,
    target:{
      gridId:change.gridId,
      itemId:change.itemId,
      x:change.after.x,
      y:change.after.y,
      orientation:change.after.orientation
    },
    scopeRecord:scope,
    coreClassification,
    rootEvidence,
    placementEvidence
  });
  if(admissibility?.status!=='ADMISSIBLE') {
    error('WEP_ADD_OBJECT_NO_LONGER_ADMISSIBLE',{
      reasonCodes:clone(admissibility?.reasonCodes??[])
    });
  }

  const ctx=safeSession.getPreflightContext();
  const grid=opened.profile?.World?.GridCollection?.Grids?.[
    String(change.gridId)
  ];
  if(
    !grid ||
    !Number.isSafeInteger(Number(grid.NextGridObjectID))
  ) {
    error('WEP_ADD_TARGET_IDENTITY_MISMATCH',{
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
  const plan=buildOrdinaryFurnitureAddTransactionPlan({
    admissibility,
    transactionInput,
    planId:
      `wep-add-${change.gridId}-`+
      `${admissibility.target.createdGridObjectId}-`+
      String(ctx.saveIdentity.sourceRawSha256).slice(0,12)
  });

  return Object.freeze({
    contract:ORDINARY_FURNITURE_ADD_VERIFIED_EXPORT_CONTRACT,
    status:'READY_STATIC_RUNTIME_PENDING',
    sourceEpoch:Number(sourceEpoch),
    sourceName:String(sourceName||'profile'),
    sourceSha256:String(ctx.saveIdentity.sourceRawSha256),
    sourceByteLength:safeSession.source.length,
    targetBuild,
    change,
    baselineTarget:clone(baselineDocument.target),
    plan,
    admissibility:clone(admissibility),
    placementEvidence:clone(placementEvidence),
    runtimeAcceptance:Object.freeze({
      status:ORDINARY_FURNITURE_ADD_RUNTIME_STATUS,
      requestId:ORDINARY_FURNITURE_ADD_RUNTIME_REQUEST
    }),
    productExportAuthorized:false,
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

/**
 * Exercises the complete candidate -> independent verifier -> export-bundle ->
 * canonical reopen pipeline without exposing the artifacts through product UI.
 * This is source/acceptance evidence only while 01E cold-reload is pending.
 */
export async function verifyOrdinaryFurnitureAddReplacementArtifactPipeline({
  review,
  currentSourceEpoch,
  sourceBytes,
  baselineDocument,
  draftDocument,
  worldBinding
}:{
  review:AnyRecord;
  currentSourceEpoch:number;
  sourceBytes:Uint8Array;
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
  worldBinding:AnyRecord;
}) {
  if(
    review?.contract!==ORDINARY_FURNITURE_ADD_VERIFIED_EXPORT_CONTRACT ||
    review?.status!=='READY_STATIC_RUNTIME_PENDING'
  ) error('WEP_ADD_REVIEW_REQUIRED');
  if(Number(currentSourceEpoch)!==Number(review.sourceEpoch)) {
    error('WEP_ADD_SOURCE_CHANGED_SINCE_PLAN');
  }
  const currentChange=analyzeOrdinaryFurnitureAddDraft({
    baselineDocument,draftDocument
  });
  if(!semanticEqual(currentChange,review.change)) {
    error('WEP_ADD_REVIEW_STALE');
  }
  if(!(sourceBytes instanceof Uint8Array)||!sourceBytes.length) {
    error('WEP_ADD_SOURCE_REQUIRED');
  }

  const sourceHashBefore=await sha256Hex(sourceBytes);
  if(
    sourceHashBefore!==review.sourceSha256 ||
    sourceBytes.length!==review.sourceByteLength
  ) error('WEP_ADD_SOURCE_CHANGED_SINCE_PLAN');

  const safeSession=await SafeProfileEditSession.open({
    sourceBytes:sourceBytes.slice(),
    codec:p1gPackagedProfileCodec as any,
    sourcePlatform:PlatformFamily.Switch
  });
  const ctx=safeSession.getPreflightContext();
  if(ctx.saveIdentity.sourceRawSha256!==review.plan?.input?.originalSha256) {
    error('WEP_ADD_SOURCE_CHANGED_SINCE_PLAN');
  }

  let candidate:any;
  try {
    candidate=await createVerifiedWriteCandidate({
      session:safeSession,
      plan:review.plan,
      adapter:ordinaryFurnitureAddAdapter
    });
  } catch(cause:any) {
    error('WEP_ADD_CANDIDATE_GENERATION_FAILED',{
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
    error('WEP_ADD_CANDIDATE_VERIFICATION_FAILED',{
      causeCode:String(cause?.code??cause?.message??cause)
    });
  }
  if(verification?.status!=='PASS') {
    error('WEP_ADD_CANDIDATE_VERIFICATION_FAILED');
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
    error('WEP_ADD_ASSEMBLY_FAILED',{
      causeCode:String(cause?.message??cause)
    });
  }

  let reopened:any;
  let projected:any;
  try {
    reopened=await openWorldSaveBytes(candidate.candidateBytes,{
      sourcePlatform:PlatformFamily.Switch
    });
    const v=Number(review.baselineTarget?.villageIndex);
    const a=Number(review.baselineTarget?.areaId);
    if(!Number.isSafeInteger(v)||!Number.isSafeInteger(a)) {
      throw new Error('RELOAD_AREA_IDENTITY_MISSING');
    }
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
      worldBinding as any
    );
  } catch(cause:any) {
    error('WEP_ADD_RELOAD_REPARSE_FAILED',{
      causeCode:String(cause?.message??cause)
    });
  }

  const createdId=Number(
    review.admissibility?.target?.createdGridObjectId
  );
  const rawGrid=
    reopened?.profile?.World?.GridCollection?.Grids?.[
      String(review.change.gridId)
    ];
  const rawObject=rawGrid?.Objects?.[String(createdId)];
  const projectedObject=(projected?.objects??[]).find(
    (object:any)=>
      Number(object?.source?.gridId)===Number(review.change.gridId) &&
      Number(object?.source?.gridObjectId)===createdId
  );
  const expectedKeys=[
    'ID','ItemID','Orientation','State','X','Y'
  ];
  if(
    !rawObject ||
    JSON.stringify(Object.keys(rawObject).sort())!==
      JSON.stringify(expectedKeys) ||
    Number(rawObject.ID)!==createdId ||
    Number(rawObject.ItemID)!==Number(review.change.itemId) ||
    Number(rawObject.X)!==Number(review.change.after.x) ||
    Number(rawObject.Y)!==Number(review.change.after.y) ||
    rawObject.State!==null ||
    Object.prototype.hasOwnProperty.call(rawObject,'From') ||
    Number(rawGrid?.NextGridObjectID)!==
      Number(review.admissibility?.nextGridObjectID?.after) ||
    !projectedObject ||
    Number(projectedObject.itemId)!==Number(review.change.itemId) ||
    Number(projectedObject.x)!==Number(review.change.after.x) ||
    Number(projectedObject.y)!==Number(review.change.after.y) ||
    Number(projectedObject.orientation)!==
      Number(review.change.after.orientation)
  ) error('WEP_ADD_RELOAD_IDENTITY_OR_TRANSFORM_MISMATCH');

  const sourceHashAfter=await sha256Hex(sourceBytes);
  if(sourceHashAfter!==sourceHashBefore) {
    error('WEP_ADD_SOURCE_MUTATED');
  }

  return Object.freeze({
    contract:
      'dreamwish-wand-wep-ordinary-furniture-add-candidate-evidence@1',
    status:'PASS_STATIC_BROWSER_PIPELINE_RUNTIME_PENDING',
    review:clone(review),
    candidateManifest:clone(candidate.manifest),
    verification:clone(verification),
    artifacts,
    reload:Object.freeze({
      status:'PASS',
      inputFormat:reopened.inputFormat,
      profileSchemaVersion:reopened.profileSchemaVersion,
      gridId:Number(review.change.gridId),
      gridObjectId:createdId,
      itemId:Number(review.change.itemId),
      transform:clone(review.change.after),
      nextGridObjectID:Number(rawGrid.NextGridObjectID)
    }),
    runtimeAcceptance:Object.freeze({
      status:ORDINARY_FURNITURE_ADD_RUNTIME_STATUS,
      requestId:ORDINARY_FURNITURE_ADD_RUNTIME_REQUEST
    }),
    source:Object.freeze({
      sha256Before:sourceHashBefore,
      sha256After:sourceHashAfter,
      byteLength:sourceBytes.length,
      untouched:sourceHashBefore===sourceHashAfter
    }),
    productExportAuthorized:false,
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

export async function commitOrdinaryFurnitureAddVerifiedExport(
  _input:AnyRecord
):Promise<never> {
  error('WEP_ADD_RUNTIME_ACCEPTANCE_PENDING',{
    status:ORDINARY_FURNITURE_ADD_RUNTIME_STATUS,
    requestId:ORDINARY_FURNITURE_ADD_RUNTIME_REQUEST
  });
}
