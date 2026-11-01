import {canonicalWorkId} from '../community/typed-work-route.js';
import {
  classifySource153OwnerHttpFixture,
  SOURCE153_OWNER_V2_LIVE_ENABLED
} from './source153-owner-consumer-v2.js';

// Dev-only, loopback-only read probe. Never reclassifies the fixed @2
// decoder's SOURCE_SCHEMA_CANDIDATE as an authorized Owner snapshot.
export const SOURCE153_BROWSER_E2_PRODUCTION_ENABLED = false;
const LOCAL = 'http://127.0.0.1:4175';
// Dedicated dev-only same-origin transparent local proxy; not deployed.
// Real Edge cache headers remain intact and browser-readable.
const SOURCE = LOCAL + '/__source153_e2';
const OWNER = SOURCE + '/functions/v1/community-dreamsnap-owner';
const AUTH = SOURCE + '/auth/v1';
const fail = (status='BACKEND_UNAVAILABLE') => Object.freeze({
  status, kind:null, entryState:null, grantState:null, policyScope:null,
  publicDisabled:null, rowVersion:null, authorizationEpoch:null,
  ownerReadVerified:false, actionsEnabled:false, liveBackendEnabled:false,
  snapshot:null, sourceCandidateOnly:false
});

export function safeSource153OwnerView(decoded) {
  if (decoded?.status !== 'SOURCE153_SCHEMA_CANDIDATE_ONLY' ||
      decoded?.ownerReadVerified !== false ||
      decoded?.actionsEnabled !== false ||
      decoded?.liveBackendEnabled !== false ||
      decoded?.snapshot !== null) return fail(decoded?.status ?? 'SOURCE_CONTRACT_REJECTED');
  const c=decoded.projectionCandidate;
  if (!c || !['OriginalCompetition','PostEventCreation'].includes(c.kind) ||
      typeof c.isCompetitionEntry !== 'boolean' ||
      c.isCompetitionEntry !== (c.kind==='OriginalCompetition') ||
      c.publicUsageAuthorized !== false || c.actionsEnabled !== false ||
      c.mediaSigningEnabled !== false || c.publicDetailEnabled !== false ||
      !Number.isSafeInteger(c.rowVersion) || !Number.isSafeInteger(c.authorizationEpoch))
    return fail('SOURCE_CONTRACT_REJECTED');
  return Object.freeze({
    status:decoded.status,
    kind:c.kind,
    entryState:c.isCompetitionEntry ? 'FROZEN_ORIGINAL_ENTRY' : 'NO_COMPETITION_ENTRY',
    grantState:c.grantState,
    policyScope:c.policyReceiptSourceClaim,
    publicDisabled:c.localDeletionState==='PUBLIC_DISABLED' || c.grantState==='withdrawn',
    rowVersion:c.rowVersion,authorizationEpoch:c.authorizationEpoch,
    ownerReadVerified:false,actionsEnabled:false,liveBackendEnabled:false,
    snapshot:null,sourceCandidateOnly:true
  });
}

function onlyLoopback(url,allowed) {
  try {
    const v=new URL(url);
    return allowed===v.origin && v.protocol==='http:' && v.hostname==='127.0.0.1';
  } catch {return false;}
}
function readHeaders(headers) {
  const out={};
  for(const key of ['cache-control','cdn-cache-control','surrogate-control','vary']){
    const v=headers?.get?.(key);
    if(v!==null && typeof v==='string')out[key]=v;
  }
  return out;
}
export async function loginDisposableGoTrue({fetchImpl, email, password, anonKey, signal}) {
  if (SOURCE153_BROWSER_E2_PRODUCTION_ENABLED || !onlyLoopback(AUTH,LOCAL) ||
      typeof fetchImpl!=='function' || typeof email!=='string' ||
      typeof password!=='string' || typeof anonKey!=='string' || !anonKey)
    return {status:'TEST_SESSION_UNAVAILABLE',token:null};
  try {
    const response=await fetchImpl(AUTH+'/token?grant_type=password',{
      method:'POST',headers:{apikey:anonKey,'content-type':'application/json'},
      body:JSON.stringify({email,password}),cache:'no-store',
      credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal
    });
    if(response.status!==200)return {status:'AUTH_DENIED',token:null};
    const body=await response.json();
    const token=body?.access_token;
    if(typeof token!=='string'||token.split('.').length!==3)
      return {status:'AUTH_DENIED',token:null};
    // Require the genuine local GoTrue session to be accepted by its /user.
    const who=await fetchImpl(AUTH+'/user',{
      method:'GET',headers:{apikey:anonKey,Authorization:'Bearer '+token},
      cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal
    });
    const user=who.status===200 ? await who.json():null;
    if(!user || typeof user.id!=='string')return {status:'AUTH_DENIED',token:null};
    return {status:'SIGNED_LOCAL_SESSION_CANDIDATE',token};
  }catch{return {status:'AUTH_UNAVAILABLE',token:null};}
}

export async function readIsolatedSource153Owner({
  fetchImpl,token,anonKey,workId,requestGeneration,latestGeneration,
  expectedRowVersion,expectedAuthorizationEpoch,signal
}) {
  if(SOURCE153_BROWSER_E2_PRODUCTION_ENABLED || !onlyLoopback(OWNER,LOCAL) ||
      typeof fetchImpl!=='function'||typeof token!=='string' ||
      !token || typeof anonKey!=='string' || !anonKey || !canonicalWorkId(workId))
    return fail('SOURCE_CONTRACT_REJECTED');
  const context={workId:canonicalWorkId(workId),requestGeneration,latestGeneration};
  if(expectedRowVersion!==undefined)context.expectedRowVersion=expectedRowVersion;
  if(expectedAuthorizationEpoch!==undefined)context.expectedAuthorizationEpoch=expectedAuthorizationEpoch;
  if(requestGeneration!==latestGeneration)return fail('STALE_RESPONSE');
  try {
    const response=await fetchImpl(OWNER,{
      method:'POST',headers:{apikey:anonKey,Authorization:'Bearer '+token,
        'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({operation:'authority',workId:context.workId,
        ...(expectedRowVersion===undefined?{}:{expectedRowVersion}),
        ...(expectedAuthorizationEpoch===undefined?{}:{expectedAuthorizationEpoch})}),
      cache:'no-store',credentials:'omit',redirect:'error',
      referrerPolicy:'no-referrer',signal
    });
    const body=response.status===200 ? await response.json():null;
    const verdict=classifySource153OwnerHttpFixture(
      {status:response.status,headers:readHeaders(response.headers),body},context);
    if(signal?.aborted)return fail('STALE_RESPONSE');
    return safeSource153OwnerView(verdict);
  }catch{return fail(signal?.aborted?'STALE_RESPONSE':'BACKEND_UNAVAILABLE');}
}
