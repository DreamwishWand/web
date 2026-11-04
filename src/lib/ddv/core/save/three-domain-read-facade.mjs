/**
 * 01A Core-owned read routing CONTRACT, not a Save engine or capability issuer.
 * Accepted PR394 Worker remains the only Session/decoder; this UI-side facade
 * never receives an original P1G, decoded profile, key or editable document.
 *
 * All three domains are named explicitly to prevent UI fallback to untyped
 * raw Save reads. Only W1 Timing has a current indexed Worker operation.
 * Collection/World require new independently accepted Core typed readers.
 */
export const LOCAL_THREE_DOMAIN_READ_CONTRACT='wand.local.three-domain.read@1';
export const LOCAL_THREE_DOMAIN_PRODUCT_WRITER_ENABLED=false;
export const LOCAL_THREE_DOMAIN_200MIB_JS_READ_ENABLED=false;
const TARGET=Object.freeze({
  platform:'switch',fullVersion:'1.25.3',
  buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626
});
const POLICY=Object.freeze({
  Timing:Object.freeze({sourceDomain:'RecurringEvents',root:'World.RecurringEvents',
    capability:'readW1RecurringEvents',sourceReadAccepted:true,
    nativeV3Accepted:false,canCommit:false}),
  Collection:Object.freeze({sourceDomain:'Ownership',root:'Player.CollectionSets',
    capability:'readOwnership',sourceReadAccepted:false,
    nativeV3Accepted:false,canCommit:false}),
  World:Object.freeze({sourceDomain:'Spatial',root:'World.GridCollection',
    capability:'readGrid',sourceReadAccepted:false,
    nativeV3Accepted:false,canCommit:false})
});
const H64=/^[a-f0-9]{64}$/;
const H32=/^[a-f0-9]{32}$/;
const rec=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const status=(code,extra={})=>Object.freeze({
  contract:LOCAL_THREE_DOMAIN_READ_CONTRACT,status:'UNAVAILABLE',code,
  productWriterAuthorized:false,verifiedNativeSemantics:false,
  privateCollectionOwned:'UNKNOWN',personalPercentage:null,...extra
});
function exactSession(receipt,caps){
  if(!rec(receipt)||receipt.contract!=='wand.local.save-session.read@1'||
     receipt.platform!==TARGET.platform||receipt.fullVersion!==TARGET.fullVersion||
     receipt.buildKind!==TARGET.buildKind||receipt.buildId!==TARGET.buildId||
     receipt.schema!==TARGET.schema||
     receipt.sourceIdentity!=='externally-attested-switch-bid'||
     !H32.test(receipt.sessionId)||!H64.test(receipt.sourceSha256)||
     !H64.test(receipt.registrySha256)||
     !Number.isSafeInteger(receipt.revision)||receipt.revision!==0||
     !Number.isSafeInteger(receipt.indexGeneration)||receipt.indexGeneration<1||
     receipt.writerAuthorized!==false||receipt.productRustWorkerAccepted!==false)
    return false;
  return rec(caps)&&caps.contract==='wand.local.save-session.read@1'&&
    caps.sessionOwner==='worker-singleton'&&
    caps.supportedBID===TARGET.buildId&&caps.supportedSchema===TARGET.schema&&
    caps.supportedFullVersion===TARGET.fullVersion&&
    caps.canCommit===false&&caps.canEncodeEditedCopy===false&&
    caps.canApply===false&&caps.canReplaceOriginal===false&&
    caps.readCompleteAllDomains===false;
}
function snapshot(bridge){
  if(!rec(bridge)||typeof bridge.getSession!=='function'||
     typeof bridge.getCapabilities!=='function')return null;
  try {
    const receipt=bridge.getSession(),caps=bridge.getCapabilities();
    return {receipt,caps,valid:exactSession(receipt,caps)};
  }catch{return null;}
}
export function describeThreeDomainReadCapabilities(bridge){
  const active=snapshot(bridge);
  const domains=Object.freeze(Object.fromEntries(Object.entries(POLICY).map(
    ([name,p])=>[name,Object.freeze({
      root:p.root,sourceDomain:p.sourceDomain,
      workerReadAvailable:active?.valid===true&&p.sourceReadAccepted&&
        active.caps[p.capability]===true,
      nativeV3Accepted:false,readPersonalOwnership:false,
      readCompleteDomain:false,writerAuthorized:false
    })]
  )));
  return Object.freeze({
    contract:LOCAL_THREE_DOMAIN_READ_CONTRACT,
    sessionBound:active?.valid===true,domains,
    sourceOnly:true,coreSessionIssuedByThisModule:false,
    canEncodeEditedCopy:false,canReplaceOriginal:false,
    maximumExpandedBytes:128*1024*1024,
    read200MiBSupported:false
  });
}
/**
 * Bounded W1 Timing READ only. The bridge is the PR394 Worker owner.
 * Never place returned data into the URL or a cloud storage queue.
 */
export async function readThreeDomainPage(bridge,{domain,search='',cursor=null,limit=64}={}){
  if(typeof domain!=='string'||!Object.hasOwn(POLICY,domain))
    throw Error('LOCAL_DOMAIN_NOT_MODELLED');
  const p=POLICY[domain];
  // Do not infer Item/World acceptance from a forged caller 'capability' bit.
  // These domains require separate accepted Worker API and Native evidence.
  if(!p.sourceReadAccepted)
    throw Error('LOCAL_DOMAIN_READ_NOT_ACCEPTED');
  const before=snapshot(bridge);
  if(!before?.valid)throw Error('LOCAL_DOMAIN_SESSION_PROVENANCE_UNVERIFIED');
  if(before.caps[p.capability]!==true||
     typeof bridge.readDomainPage!=='function')
    throw Error('LOCAL_DOMAIN_WORKER_CAPABILITY_MISSING');
  if(typeof search!=='string'||search.length>120||
     (cursor!==null&&(typeof cursor!=='string'||cursor.length>160))||
     !Number.isSafeInteger(limit)||limit<1||limit>64)
    throw Error('LOCAL_DOMAIN_QUERY_BOUNDS');
  const {receipt}=before;
  const response=await bridge.readDomainPage({
    domain:p.sourceDomain,
    sessionId:receipt.sessionId,revision:receipt.revision,
    indexGeneration:receipt.indexGeneration,sourceSha256:receipt.sourceSha256,
    search,cursor,limit
  });
  const after=snapshot(bridge);
  if(!after?.valid||after.receipt!==receipt)
    throw Error('LOCAL_DOMAIN_SESSION_CHANGED_DURING_READ');
  if(!rec(response)||response.sessionId!==receipt.sessionId||
     response.sourceSha256!==receipt.sourceSha256||
     response.revision!==receipt.revision||
     response.indexGeneration!==receipt.indexGeneration||
     response.writerAuthorized!==false||
     response.productRustWorkerAccepted!==false||
     !Number.isSafeInteger(response.total)||response.total<0||
     !Array.isArray(response.rows)||response.rows.length>limit||
     response.total<response.rows.length||
     typeof response.complete!=='boolean'||
     (response.nextCursor!==null&&
       (typeof response.nextCursor!=='string'||response.nextCursor.length>160)))
    throw Error('LOCAL_DOMAIN_WORKER_RESULT_UNTRUSTED');
  // No arbitrary Worker output properties are spread into UI data.
  const rows=response.rows.map(row=>{
    if(!rec(row)||!(row.eventId===null||Number.isSafeInteger(row.eventId))||
       typeof row.mapKey!=='string'||!/^[0-9]{1,12}$/.test(row.mapKey)||
       typeof row.oneof!=='string'||row.oneof.length>64||
       (row.nextOccurrence!==null&&typeof row.nextOccurrence!=='string'))
      throw Error('LOCAL_DOMAIN_ROW_INVALID');
    return Object.freeze({
      mapKey:row.mapKey,eventId:row.eventId,oneof:row.oneof,
      nextOccurrence:row.nextOccurrence,editable:false
    });
  });
  return Object.freeze({
    contract:LOCAL_THREE_DOMAIN_READ_CONTRACT,status:'WORKER_W1_READ_ONLY',
    domain:'Timing',sourceDomain:p.sourceDomain,
    sessionId:receipt.sessionId,sourceSha256:receipt.sourceSha256,
    revision:receipt.revision,indexGeneration:receipt.indexGeneration,
    rows:Object.freeze(rows),total:response.total,
    complete:response.complete,nextCursor:response.nextCursor,
    nativeV3Accepted:false,writerAuthorized:false,
    personalCollectionOwned:'UNKNOWN',personalPercentage:null
  });
}
