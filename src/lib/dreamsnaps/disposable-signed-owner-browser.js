import { canonicalWorkId } from '../community/typed-work-route.js';
import {
  classifySource153OwnerHttpFixture,
  SOURCE153_OWNER_V2_LIVE_ENABLED
} from './source153-owner-consumer-v2.js';
import { OWNER_MANAGEMENT_ENABLED } from './owner-management.js';

// This module is a disposable browser acceptance seam, NOT a production
// Owner adapter. The compiled production bundle cannot enable it by env flag.
export const DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED =
  import.meta.env?.DEV === true &&
  import.meta.env?.VITE_DDVRE_LOCAL_SIGNED_OWNER_BROWSER === 'true' &&
  OWNER_MANAGEMENT_ENABLED === false && SOURCE153_OWNER_V2_LIVE_ENABLED === false;

export function localOwnerTestOrigin(url, pageHostname) {
  if (typeof url !== 'string' || typeof pageHostname !== 'string' ||
      !['127.0.0.1','localhost'].includes(pageHostname)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' ||
        !['127.0.0.1','localhost'].includes(parsed.hostname) ||
        parsed.username || parsed.password || parsed.search || parsed.hash ||
        parsed.pathname !== '/') return null;
    return parsed.origin;
  } catch { return null; }
}

const failure = status => Object.freeze({
  status, safeView:null, projectionCandidate:null, snapshot:null,
  ownerReadVerified:false, actionsEnabled:false, liveBackendEnabled:false,
  clearPriorSnapshot:true, autoRetry:false
});

export function safeSignedOwnerCandidate(result) {
  if (!result || result.status !== 'SOURCE153_SCHEMA_CANDIDATE_ONLY' ||
      result.snapshot !== null || result.ownerReadVerified !== false ||
      result.actionsEnabled !== false || result.liveBackendEnabled !== false ||
      !result.projectionCandidate) return null;
  const c=result.projectionCandidate;
  if (!['OriginalCompetition','PostEventCreation'].includes(c.kind) ||
      typeof c.policyVersionText !== 'string' ||
      !Number.isSafeInteger(c.rowVersion) ||
      !Number.isSafeInteger(c.authorizationEpoch) ||
      c.publicUsageAuthorized !== false ||
      c.actionsEnabled !== false || c.mediaSigningEnabled !== false ||
      c.globalPurgeScopeComplete !== false) return null;
  // No WorkID, AccountID, CreatorID, MediaID, EntryID, URL, concept,
  // policy digest or storage key is projected to the DOM.
  return Object.freeze({
    kind:c.kind,
    entryStatus:c.kind === 'OriginalCompetition' && c.isCompetitionEntry === true
      ? 'frozen-entry-present' : c.kind === 'PostEventCreation' && c.isCompetitionEntry === false
      ? 'post-event-no-entry' : 'unavailable',
    rowVersion:c.rowVersion,
    authorizationEpoch:c.authorizationEpoch,
    policyVersionText:c.policyVersionText,
    policyStatus:c.policyReceiptSourceClaim === 'UNVERIFIED' ? 'unverified' : 'test-only-receipt',
    grantStatus:c.grantState === 'withdrawn' ? 'withdrawn' : 'recorded',
    publicDisabled:c.grantState === 'withdrawn' || c.localDeletionState === 'PUBLIC_DISABLED',
    globalPurgeStatus:'unknown',
    resultAuthority:'schema-candidate-only'
  });
}

function headersObject(headers) {
  const o={};
  for(const key of ['cache-control','cdn-cache-control','surrogate-control','vary']) {
    if(headers.has(key)) o[key]=headers.get(key);
  }
  return o;
}

export async function disposableGoTrueLogin({origin,publishableKey,email,password,onStatus=(_status)=>{},fetchImpl=fetch}) {
  if (!DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED || !origin ||
      !localOwnerTestOrigin(origin+'/',location.hostname) ||
      typeof publishableKey !== 'string' || publishableKey.length<20 ||
      typeof email !== 'string' || typeof password !== 'string' ||
      !email.endsWith('@example.invalid')) { onStatus('LOCAL_CONFIG_REJECTED'); return null; }
  try {
    const r=await fetchImpl(origin+'/auth/v1/token?grant_type=password',{
      method:'POST',cache:'no-store',
      headers:{apikey:publishableKey,accept:'application/json','content-type':'application/json'},
      body:JSON.stringify({email,password})
    });
    if(!r.ok) { onStatus('GOTRUE_TOKEN_DENIED'); return null; }
    const data=await r.json();
    const token=data?.access_token;
    if(typeof token!=='string' || token.length<50) { onStatus('GOTRUE_TOKEN_MISSING'); return null; }
    // GoTrue validates the issued token. The browser never trusts decoded
    // AccountID or user claims as OwnerAuthority.
    const verify=await fetchImpl(origin+'/auth/v1/user',{
      method:'GET',cache:'no-store',
      headers:{apikey:publishableKey,authorization:'Bearer '+token}
    });
    if(!verify.ok) { onStatus('GOTRUE_VERIFY_DENIED'); return null; }
    const user=await verify.json();
    if(typeof user?.id==='string') { onStatus('GOTRUE_VERIFIED'); return token; }
    onStatus('GOTRUE_USER_MISSING'); return null;
  } catch { onStatus('GOTRUE_TRANSPORT_ERROR'); return null; }
}

export async function readDisposableSignedOwner({
  origin,publishableKey,accessToken,workId,requestGeneration,
  latestGeneration,getLatestGeneration,expectedRowVersion,expectedAuthorizationEpoch,
  fetchImpl=fetch
}) {
  if (!DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED ||
      !localOwnerTestOrigin(origin+'/',location.hostname) ||
      typeof publishableKey!=='string' || publishableKey.length<20 ||
      typeof accessToken!=='string' || accessToken.length<50 ||
      !canonicalWorkId(workId) ||
      !Number.isSafeInteger(requestGeneration) || requestGeneration<0 ||
      !Number.isSafeInteger(latestGeneration) || latestGeneration<0)
    return failure('BACKEND_UNAVAILABLE');
  const context={workId:canonicalWorkId(workId),requestGeneration,latestGeneration};
  if(expectedRowVersion!==undefined)context.expectedRowVersion=expectedRowVersion;
  if(expectedAuthorizationEpoch!==undefined)context.expectedAuthorizationEpoch=expectedAuthorizationEpoch;
  if(requestGeneration!==latestGeneration || (getLatestGeneration && getLatestGeneration()!==requestGeneration))return failure('STALE_RESPONSE');
  const request={operation:'authority',workId:context.workId};
  if(expectedRowVersion!==undefined)request.expectedRowVersion=expectedRowVersion;
  if(expectedAuthorizationEpoch!==undefined)request.expectedAuthorizationEpoch=expectedAuthorizationEpoch;
  try {
    const r=await fetchImpl(origin+'/functions/v1/community-dreamsnap-owner',{
      method:'POST',cache:'no-store',
      headers:{
        apikey:publishableKey,
        authorization:'Bearer '+accessToken,
        accept:'application/json',
        'content-type':'application/json'
      },
      body:JSON.stringify(request)
    });
    if(requestGeneration!==latestGeneration || (getLatestGeneration && getLatestGeneration()!==requestGeneration))return failure('STALE_RESPONSE');
    let body=null;
    try { body=await r.json(); } catch { return failure('BACKEND_UNAVAILABLE'); }
    if(getLatestGeneration && getLatestGeneration()!==requestGeneration)return failure('STALE_RESPONSE');
    const classified=classifySource153OwnerHttpFixture({
      status:r.status,headers:headersObject(r.headers),body
    },context);
    return Object.freeze({
      ...classified,
      // No server-side evidence of product approval is synthesized here.
      safeView:safeSignedOwnerCandidate(classified),
      ownerReadVerified:false,actionsEnabled:false,liveBackendEnabled:false,
      snapshot:null
    });
  } catch { return failure('BACKEND_UNAVAILABLE'); }
}
