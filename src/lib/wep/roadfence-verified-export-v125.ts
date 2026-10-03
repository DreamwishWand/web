import { SafeProfileEditSession } from '../ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../ddv/core/save/p1g-packaged-profile-codec.js';
import { PlatformFamily } from '../ddv/core/save/versioning.js';
import {
  createVerifiedCandidateExportBundle
} from '../ddv/core/save/verified-export-bundle.js';
import {
  ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} from '../ddv/core/roadfence/catalog-v125-switch.js';
import {
  readRoadFenceNativeGridV125
} from '../ddv/core/roadfence/native-reader-v125.js';
import {
  RoadFencePersistentOperation,
  compileFenceMutationV125,
  compileRoadMutationV125
} from '../ddv/core/roadfence/persistent-compiler-v125.js';
import {
  createRoadFenceVerifiedWriteCandidateV125
} from '../ddv/core/roadfence/persistent-transaction-v125.js';

type AnyRecord = Record<string, any>;

export const ROADFENCE_VERIFIED_EXPORT_CONTRACT =
  'dreamwish-wand-wep-roadfence-verified-export@1';
export const ROADFENCE_BINDING_ID =
  'DDV-ROADFENCE-STRUCTURAL-TRANSACTION-BINDING-V125-V1_0';
export const SWITCH_V125_BID = '52BD625D9B4E0053';

const BUILD_V125_SWITCH = Object.freeze({
  platform: 'Nintendo Switch',
  gameVersion: '1.25.0',
  tid: '0100D39012C1A000',
  bid: SWITCH_V125_BID,
  profileSchema: 624
});

function clone<T>(value:T):T {
  return structuredClone(value);
}
function fail(code:string,detail:unknown=null):never {
  const error:any=new Error(code);
  error.code=code;
  error.detail=detail;
  throw error;
}
function stable(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    const record=value as AnyRecord;
    return '{'+Object.keys(record).sort().map(
      key=>JSON.stringify(key)+':'+stable(record[key])
    ).join(',')+'}';
  }
  return JSON.stringify(value);
}
function equal(a:unknown,b:unknown) {
  return stable(a)===stable(b);
}
async function sha256Hex(bytes:Uint8Array) {
  if(!globalThis.crypto?.subtle) fail('WEP_ROADFENCE_SHA256_UNAVAILABLE');
  const digest=await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest),byte=>
    byte.toString(16).padStart(2,'0')
  ).join('');
}
function documentShell(document:AnyRecord) {
  const shell=clone(document);
  delete shell.networks;
  return shell;
}
function container(document:AnyRecord,kind:'road'|'fence') {
  return document?.networks?.[kind==='road'?'roads':'fences']??null;
}
function networks(document:AnyRecord,kind:'road'|'fence'):AnyRecord[] {
  const value=container(document,kind)?.networks;
  return Array.isArray(value)?value:[];
}
function networkMap(document:AnyRecord,kind:'road'|'fence') {
  const map=new Map<string,AnyRecord>();
  for(const network of networks(document,kind)){
    const id=String(network?.networkId??'');
    if(!id||map.has(id)) fail('WEP_ROADFENCE_NETWORK_ID_INVALID',{kind,id});
    map.set(id,network);
  }
  return map;
}
function roadShape(network:AnyRecord|null) {
  if(!network) return null;
  return {
    familyBaseItemID:Number(network.familyBaseItemID),
    cells:[...(network.cells??[])].map((cell:any)=>({
      x:Number(cell.x),y:Number(cell.y),mode:String(cell.mode)
    })).sort((a,b)=>a.y-b.y||a.x-b.x||a.mode.localeCompare(b.mode))
  };
}
function fenceShape(network:AnyRecord|null) {
  if(!network) return null;
  const nodes=[...(network.graph?.nodes??[])].map((node:any)=>({
    id:String(node.id),x:Number(node.x),y:Number(node.y),mode:String(node.mode)
  })).sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const edgeCoordinateKey=(edge:any)=>{
    const a=byId.get(String(edge.a));
    const b=byId.get(String(edge.b));
    if(!a||!b) return 'INVALID:'+String(edge.a)+':'+String(edge.b);
    const point=(node:any)=>[node.x,node.y,node.mode];
    const pair=[point(a),point(b)].sort((x,y)=>
      Number(x[1])-Number(y[1])||
      Number(x[0])-Number(y[0])||
      String(x[2]).localeCompare(String(y[2]))
    );
    return stable(pair);
  };
  return {
    familyBaseItemID:Number(network.familyBaseItemID),
    nodes:nodes.map(({id,...node})=>node),
    edges:[...(network.graph?.edges??[])].map(edgeCoordinateKey).sort()
  };
}
function nativeShape(kind:'road'|'fence',network:AnyRecord|null) {
  return kind==='road'?roadShape(network):fenceShape(network);
}
function layoutFor(document:AnyRecord,networkId:string) {
  return container(document,'fence')?.representationLayouts?.[
    String(networkId)
  ]??null;
}
function nativePostIds(layout:AnyRecord|null) {
  return [...(layout?.representationLayout?.posts??[])]
    .map((post:any)=>String(post.nodeId))
    .sort();
}
function inferFenceRepresentationOperation(
  before:AnyRecord,
  after:AnyRecord
) {
  const beforeIds=nativePostIds(before);
  const afterIds=nativePostIds(after);
  if(equal(beforeIds,afterIds)) {
    fail('WEP_ROADFENCE_NO_NATIVE_REPRESENTATION_CHANGE');
  }
  if(afterIds.length===beforeIds.length+1) {
    return RoadFencePersistentOperation.FENCE_INSERT_POST;
  }
  if(afterIds.length===beforeIds.length-1) {
    return RoadFencePersistentOperation.FENCE_REMOVE_POST;
  }
  if(afterIds.length===beforeIds.length) {
    const beforeOnly=beforeIds.filter(id=>!afterIds.includes(id));
    const afterOnly=afterIds.filter(id=>!beforeIds.includes(id));
    if(beforeOnly.length===1&&afterOnly.length===1) {
      return RoadFencePersistentOperation.FENCE_MOVE_POST;
    }
  }
  fail('WEP_ROADFENCE_MULTI_POST_EDIT_UNSUPPORTED',{
    before:beforeIds,after:afterIds
  });
}
function analyzeChangedNetwork({
  baselineDocument,
  draftDocument
}:{
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
}) {
  if(!equal(documentShell(baselineDocument),documentShell(draftDocument))) {
    fail('WEP_ROADFENCE_CONCURRENT_NON_NETWORK_CHANGE');
  }

  const changes:any[]=[];
  for(const kind of ['road','fence'] as const){
    const before=networkMap(baselineDocument,kind);
    const after=networkMap(draftDocument,kind);
    const ids=new Set([...before.keys(),...after.keys()]);
    for(const id of ids){
      const source=before.get(id)??null;
      const desired=after.get(id)??null;
      const sourceLayout=kind==='fence'?layoutFor(baselineDocument,id):null;
      const desiredLayout=kind==='fence'?layoutFor(draftDocument,id):null;
      if(
        !equal(nativeShape(kind,source),nativeShape(kind,desired)) ||
        !equal(sourceLayout,desiredLayout)
      ){
        changes.push({
          kind,networkId:id,source,desired,
          sourceLayout,desiredLayout
        });
      }
    }
  }

  if(changes.length===0) fail('WEP_ROADFENCE_NO_ELIGIBLE_PENDING_CHANGE');
  if(changes.length!==1) {
    fail('WEP_ROADFENCE_MULTI_NETWORK_CHANGE_UNSUPPORTED',{
      count:changes.length,
      networkIds:changes.map(change=>change.networkId)
    });
  }
  const change=changes[0];
  if(!change.desired) {
    fail('WEP_ROADFENCE_NETWORK_REMOVAL_UNSUPPORTED_V1');
  }
  return change;
}
function gridFor(profile:AnyRecord,gridId:number) {
  const grid=profile?.World?.GridCollection?.Grids?.[String(gridId)];
  if(!grid||Number(grid.ID)!==gridId) {
    fail('WEP_ROADFENCE_SOURCE_GRID_REQUIRED',{gridId});
  }
  return grid;
}
function sourceReader(profile:AnyRecord,gridId:number) {
  const grid=gridFor(profile,gridId);
  const result=readRoadFenceNativeGridV125({
    grid,
    gridId,
    catalog:ROADFENCE_NATIVE_CATALOG_SWITCH_V125
  });
  if(result?.ok!==true||result?.status!=='supported') {
    fail('WEP_ROADFENCE_SOURCE_READER_BLOCKED',{
      issues:clone(result?.issues??[])
    });
  }
  return result;
}
function transformFor(network:AnyRecord) {
  const coordinate=network?.coordinateSpace;
  const pitch=Number(coordinate?.savePitch);
  const x=Number(coordinate?.saveResidueX);
  const y=Number(coordinate?.saveResidueY);
  if(
    !Number.isSafeInteger(pitch)||pitch<=0||
    !Number.isSafeInteger(x)||!Number.isSafeInteger(y)
  ){
    fail('WEP_ROADFENCE_COORDINATE_SPACE_REQUIRED');
  }
  return {
    originSave:{x,y},
    pitchX:pitch,
    pitchY:pitch
  };
}
function logicalPoints(kind:'road'|'fence',network:AnyRecord) {
  return kind==='road'
    ? [...(network.cells??[])]
    : [...(network.graph?.nodes??[])];
}
function validateTargetSurface(
  document:AnyRecord,
  kind:'road'|'fence',
  network:AnyRecord,
  transform:AnyRecord
) {
  const bounds=document?.metadata?.rootGridBounds;
  if(
    bounds?.status!=='AUTHORITATIVE_GRIDDATAPATH'||
    ![bounds.x,bounds.y,bounds.w,bounds.h].every(
      (value:any)=>Number.isSafeInteger(Number(value))
    )||
    Number(bounds.w)<=0||
    Number(bounds.h)<=0
  ){
    fail('WEP_ROADFENCE_TARGET_SURFACE_BOUNDS_REQUIRED');
  }
  const minX=Number(bounds.x),minY=Number(bounds.y);
  const maxX=minX+Number(bounds.w),maxY=minY+Number(bounds.h);
  const footprint=Number(transform.pitchX);
  for(const point of logicalPoints(kind,network)){
    const x=Number(transform.originSave.x)+Number(point.x)*footprint;
    const y=Number(transform.originSave.y)+Number(point.y)*footprint;
    if(
      !Number.isSafeInteger(x)||!Number.isSafeInteger(y)||
      x<minX||y<minY||x+footprint>maxX||y+footprint>maxY
    ){
      fail('WEP_ROADFENCE_TARGET_SURFACE_OUT_OF_BOUNDS',{
        kind,networkId:String(network.networkId??''),x,y,bounds:clone(bounds)
      });
    }
  }
  return {
    status:'VALID',
    gridId:Number(document?.target?.rootGridId),
    targetSurfaceValidated:true,
    evidence:'AUTHORITATIVE_GRIDDATAPATH'
  };
}
function sourceMatch(
  reader:AnyRecord,
  kind:'road'|'fence',
  baselineNetwork:AnyRecord|null,
  networkId:string
) {
  if(!baselineNetwork) return {
    sourceNetwork:null,
    sourceObjectIds:[]
  };
  const list=kind==='road'?reader.roads:reader.fences;
  const source=(list??[]).find(
    (network:any)=>String(network.networkId)===String(networkId)
  );
  if(!source||!equal(nativeShape(kind,source),nativeShape(kind,baselineNetwork))){
    fail('WEP_ROADFENCE_BASELINE_SOURCE_DRIFT',{kind,networkId});
  }
  const provenance=reader?.provenance?.[
    kind==='road'?'roads':'fences'
  ]?.[String(networkId)];
  if(!provenance||!Array.isArray(provenance.gridObjectIds)){
    fail('WEP_ROADFENCE_SOURCE_PROVENANCE_REQUIRED',{kind,networkId});
  }
  return {
    sourceNetwork:source,
    sourceObjectIds:[...provenance.gridObjectIds]
  };
}
function chooseRoadOperation(source:AnyRecord|null,desired:AnyRecord,sourceObjectIds:number[]) {
  if(
    source &&
    Number(source.familyBaseItemID)===40100038 &&
    Number(desired.familyBaseItemID)===40100038 &&
    sourceObjectIds.length>0 &&
    Number(desired.cells?.length)===9
  ){
    return RoadFencePersistentOperation.ROAD_SAME_FAMILY_MERGE;
  }
  if(
    source &&
    Number(desired.cells?.length)<Number(source.cells?.length)
  ){
    return RoadFencePersistentOperation.ROAD_ERASE;
  }
  return RoadFencePersistentOperation.ROAD_SET_TOPOLOGY;
}
function chooseFenceOperation(change:AnyRecord) {
  const source=change.source;
  const desired=change.desired;
  if(!source) return RoadFencePersistentOperation.FENCE_SET_TOPOLOGY;
  const topologyEqual=equal(
    {...fenceShape(source),familyBaseItemID:0},
    {...fenceShape(desired),familyBaseItemID:0}
  );
  if(
    topologyEqual &&
    Number(source.familyBaseItemID)!==Number(desired.familyBaseItemID)
  ){
    return RoadFencePersistentOperation.FENCE_STYLE_REPLACE;
  }
  if(topologyEqual){
    if(!change.sourceLayout||!change.desiredLayout) {
      fail('WEP_ROADFENCE_FENCE_LAYOUT_REQUIRED');
    }
    return inferFenceRepresentationOperation(
      change.sourceLayout,
      change.desiredLayout
    );
  }
  if(!change.desiredLayout) {
    fail('WEP_ROADFENCE_FENCE_LAYOUT_INVALIDATED');
  }
  const sourceQuantity=Number(source.graph?.nodes?.length??0);
  const desiredQuantity=Number(desired.graph?.nodes?.length??0);
  return desiredQuantity<sourceQuantity
    ? RoadFencePersistentOperation.FENCE_TOPOLOGY_ERASE
    : RoadFencePersistentOperation.FENCE_SET_TOPOLOGY;
}

export function analyzeRoadFenceVerifiedDraft({
  opened,
  baselineDocument,
  draftDocument
}:{
  opened:AnyRecord;
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
}) {
  const gridId=Number(draftDocument?.target?.rootGridId);
  if(
    !Number.isSafeInteger(gridId)||
    Number(baselineDocument?.target?.rootGridId)!==gridId
  ){
    fail('WEP_ROADFENCE_CROSS_GRID_UNSUPPORTED');
  }
  const change=analyzeChangedNetwork({
    baselineDocument,draftDocument
  });
  const reader=sourceReader(opened.profile,gridId);
  const sourceBinding=sourceMatch(
    reader,change.kind,change.source,change.networkId
  );
  const transform=transformFor(
    change.desired?.coordinateSpace??
    sourceBinding.sourceNetwork?.coordinateSpace
  );
  const surface=validateTargetSurface(
    draftDocument,change.kind,change.desired,transform
  );
  const sourceGrid=gridFor(opened.profile,gridId);
  let operation:string;
  let mutationSet:any;
  if(change.kind==='road'){
    operation=chooseRoadOperation(
      sourceBinding.sourceNetwork,
      change.desired,
      sourceBinding.sourceObjectIds
    );
    mutationSet=compileRoadMutationV125({
      buildIdentity:BUILD_V125_SWITCH,
      sourceGrid,
      sourceObjectIds:sourceBinding.sourceObjectIds,
      sourceNetwork:sourceBinding.sourceNetwork,
      desiredNetwork:change.desired,
      operation,
      transform,
      targetSurfaceValidated:surface.targetSurfaceValidated,
      catalog:ROADFENCE_NATIVE_CATALOG_SWITCH_V125
    });
  }else{
    operation=chooseFenceOperation(change);
    if(!change.desiredLayout) {
      fail('WEP_ROADFENCE_FENCE_LAYOUT_REQUIRED');
    }
    mutationSet=compileFenceMutationV125({
      buildIdentity:BUILD_V125_SWITCH,
      sourceGrid,
      sourceObjectIds:sourceBinding.sourceObjectIds,
      sourceNetwork:sourceBinding.sourceNetwork,
      desiredNetwork:change.desired,
      representationLayout:change.desiredLayout,
      operation,
      transform,
      targetSurfaceValidated:surface.targetSurfaceValidated,
      catalog:ROADFENCE_NATIVE_CATALOG_SWITCH_V125
    });
  }
  if(mutationSet?.ok!==true) {
    fail('WEP_ROADFENCE_COMPILER_BLOCKED',{
      status:String(mutationSet?.status??'UNSUPPORTED'),
      reason:clone(mutationSet?.failClosedReason??null)
    });
  }
  return Object.freeze({
    kind:change.kind,
    networkId:String(change.networkId),
    operation,
    gridId,
    desiredNetwork:clone(change.desired),
    representationLayout:
      change.kind==='fence'?clone(change.desiredLayout):null,
    sourceObjectIds:[...sourceBinding.sourceObjectIds],
    surface,
    mutationSet:clone(mutationSet)
  });
}

export async function reviewRoadFenceVerifiedExport({
  sourceBytes,
  sourceName,
  sourceEpoch,
  opened,
  baselineDocument,
  draftDocument,
  exactBuildConfirmed=false
}:{
  sourceBytes:Uint8Array;
  sourceName:string;
  sourceEpoch:number;
  opened:AnyRecord;
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
  exactBuildConfirmed?:boolean;
}) {
  if(!(sourceBytes instanceof Uint8Array)||!sourceBytes.length) {
    fail('WEP_ROADFENCE_SOURCE_REQUIRED');
  }
  if(exactBuildConfirmed!==true) {
    fail('WEP_ROADFENCE_EXACT_BUILD_CONFIRMATION_REQUIRED');
  }
  if(
    opened?.inputFormat!=='packaged'||
    opened?.saveIdentity?.sourcePlatform!=='switch'||
    opened?.compatibility?.gameVersion!=='1.25.0'||
    Number(opened?.profileSchemaVersion)!==624
  ){
    fail('WEP_ROADFENCE_UNSUPPORTED_VERSION_BUILD');
  }

  const analysis=analyzeRoadFenceVerifiedDraft({
    opened,baselineDocument,draftDocument
  });
  const safeSession=await SafeProfileEditSession.open({
    sourceBytes:sourceBytes.slice(),
    codec:p1gPackagedProfileCodec as any,
    sourcePlatform:PlatformFamily.Switch
  });
  const context=safeSession.getPreflightContext();

  return Object.freeze({
    contract:ROADFENCE_VERIFIED_EXPORT_CONTRACT,
    bindingId:ROADFENCE_BINDING_ID,
    status:'READY',
    sourceEpoch:Number(sourceEpoch),
    sourceName:String(sourceName||'profile'),
    sourceSha256:String(context.saveIdentity.sourceRawSha256),
    sourceByteLength:safeSession.source.length,
    targetBuild:clone(BUILD_V125_SWITCH),
    analysis,
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

export async function commitRoadFenceVerifiedExport({
  review,
  currentSourceEpoch,
  sourceBytes,
  opened,
  baselineDocument,
  draftDocument
}:{
  review:AnyRecord;
  currentSourceEpoch:number;
  sourceBytes:Uint8Array;
  opened:AnyRecord;
  baselineDocument:AnyRecord;
  draftDocument:AnyRecord;
}) {
  if(
    review?.contract!==ROADFENCE_VERIFIED_EXPORT_CONTRACT||
    review?.bindingId!==ROADFENCE_BINDING_ID||
    review?.status!=='READY'
  ){
    fail('WEP_ROADFENCE_REVIEW_REQUIRED');
  }
  if(Number(currentSourceEpoch)!==Number(review.sourceEpoch)) {
    fail('WEP_ROADFENCE_SOURCE_CHANGED_SINCE_PLAN');
  }
  if(!(sourceBytes instanceof Uint8Array)||!sourceBytes.length) {
    fail('WEP_ROADFENCE_SOURCE_REQUIRED');
  }
  const currentAnalysis=analyzeRoadFenceVerifiedDraft({
    opened,baselineDocument,draftDocument
  });
  if(
    !equal(
      {
        kind:currentAnalysis.kind,
        networkId:currentAnalysis.networkId,
        operation:currentAnalysis.operation,
        mutationSet:currentAnalysis.mutationSet
      },
      {
        kind:review.analysis.kind,
        networkId:review.analysis.networkId,
        operation:review.analysis.operation,
        mutationSet:review.analysis.mutationSet
      }
    )
  ){
    fail('WEP_ROADFENCE_REVIEW_STALE');
  }

  const sourceHashBefore=await sha256Hex(sourceBytes);
  if(
    sourceHashBefore!==review.sourceSha256||
    sourceBytes.length!==review.sourceByteLength
  ){
    fail('WEP_ROADFENCE_SOURCE_CHANGED_SINCE_PLAN');
  }

  const safeSession=await SafeProfileEditSession.open({
    sourceBytes:sourceBytes.slice(),
    codec:p1gPackagedProfileCodec as any,
    sourcePlatform:PlatformFamily.Switch
  });
  let bound:any;
  try {
    bound=await createRoadFenceVerifiedWriteCandidateV125({
      session:safeSession,
      mutationSet:review.analysis.mutationSet,
      planId:
        'wep-roadfence-'+
        String(review.analysis.kind)+'-'+
        String(review.analysis.gridId)+'-'+
        String(review.analysis.networkId)
    });
  } catch(cause:any) {
    fail('WEP_ROADFENCE_CANDIDATE_GENERATION_FAILED',{
      causeCode:String(cause?.code??cause?.message??cause)
    });
  }
  if(bound?.verification?.status!=='PASS') {
    fail('WEP_ROADFENCE_CANDIDATE_VERIFICATION_FAILED');
  }

  let artifacts:any;
  try {
    artifacts=await createVerifiedCandidateExportBundle({
      candidate:bound.candidate,
      verification:bound.verification,
      gameVersion:'1.25.0',
      targetBuild:{
        platform:PlatformFamily.Switch,
        kind:'switch-bid',
        value:SWITCH_V125_BID
      },
      sourceName:review.sourceName
    });
  } catch(cause:any) {
    fail('WEP_ROADFENCE_EXPORT_ASSEMBLY_FAILED',{
      causeCode:String(cause?.message??cause)
    });
  }

  let reopened:any;
  try {
    reopened=await SafeProfileEditSession.open({
      sourceBytes:bound.candidate.candidateBytes,
      codec:p1gPackagedProfileCodec as any,
      sourcePlatform:PlatformFamily.Switch
    });
  } catch(cause:any) {
    fail('WEP_ROADFENCE_RELOAD_REPARSE_FAILED',{
      causeCode:String(cause?.code??cause?.message??cause)
    });
  }
  const candidateProfile=reopened.getSnapshot();
  const grid=gridFor(candidateProfile,Number(review.analysis.gridId));
  const reader=readRoadFenceNativeGridV125({
    grid,
    gridId:Number(review.analysis.gridId),
    catalog:ROADFENCE_NATIVE_CATALOG_SWITCH_V125
  });
  if(reader?.ok!==true||reader?.status!=='supported') {
    fail('WEP_ROADFENCE_RELOAD_NATIVE_READER_BLOCKED',{
      issues:clone(reader?.issues??[])
    });
  }
  const list=review.analysis.kind==='road'?reader.roads:reader.fences;
  if(
    !(list??[]).some((network:any)=>
      equal(
        nativeShape(review.analysis.kind,network),
        nativeShape(
          review.analysis.kind,
          review.analysis.desiredNetwork
        )
      )
    )
  ){
    fail('WEP_ROADFENCE_RELOAD_LOGICAL_NETWORK_MISMATCH');
  }

  const sourceHashAfter=await sha256Hex(sourceBytes);
  if(sourceHashAfter!==sourceHashBefore) {
    fail('WEP_ROADFENCE_SOURCE_MUTATED');
  }

  return Object.freeze({
    contract:ROADFENCE_VERIFIED_EXPORT_CONTRACT,
    bindingId:ROADFENCE_BINDING_ID,
    status:'PASS',
    review:clone(review),
    candidateManifest:clone(bound.candidate.manifest),
    verification:clone(bound.verification),
    artifacts,
    reload:{
      status:'PASS',
      gridId:Number(review.analysis.gridId),
      kind:String(review.analysis.kind),
      operation:String(review.analysis.operation),
      networkMatch:true,
      nativeReaderStatus:'supported'
    },
    source:{
      sha256Before:sourceHashBefore,
      sha256After:sourceHashAfter,
      byteLength:sourceBytes.length,
      untouched:sourceHashBefore===sourceHashAfter
    },
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}
