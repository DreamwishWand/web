import {canonicalWorkId} from '../community/typed-work-route.js';
import {classifySource153OwnerHttpFixture} from './source153-owner-consumer-v2.js';
import {safeSource153OwnerView} from './source153-owner-browser-e2.js';

// Product Owner transport is deliberately OFF until a managed Auth + Ingress
// contract is independently accepted. VITE_* values cannot enable it.
export const OWNER_PRODUCT_READONLY_ENABLED = false;
export const OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED = false;
export const OWNER_PRODUCT_READONLY_CONTRACT = 'wand.dreamsnaps.owner-product-readonly@1';
const MIN_SESSION_REMAINING_MS = 60_000;
const fail = status => Object.freeze({
  status, sourceCandidateOnly:false, snapshot:null,
  ownerReadVerified:false, actionsEnabled:false, liveBackendEnabled:false
});

export function ownerProductSignedSessionCandidate(client, now=Date.now()) {
  // A sessionStorage object is NOT proof of Owner authorization. This only
  // establishes that a candidate Bearer is fresh enough to send to Source153.
  const s=client?.session, conf=client?.config;
  if(!s || typeof s.accessToken!=='string' || !s.accessToken ||
     !Number.isFinite(s.expiresAt) || s.expiresAt-now<=MIN_SESSION_REMAINING_MS ||
     typeof s.userId!=='string' || !canonicalWorkId(s.userId) ||
     !conf || typeof conf.publishableKey!=='string' || !conf.publishableKey ||
     typeof conf.supabaseUrl!=='string' || !conf.supabaseUrl.startsWith('https://'))
    return null;
  // Do not reflect user ID, email or the token in a view/UI state.
  return Object.freeze({token:s.accessToken,expiresAt:s.expiresAt,
    sessionUserId:s.userId,anonKey:conf.publishableKey});
}

export function ownerProductManagedEndpoint({endpoint,appOrigin,sourceOrigin}={}) {
  // Contract validation, NOT a proof that this origin has passed operated
  // BFF/CORS review. All managed endpoints must be explicitly provisioned.
  try {
    const e=new URL(endpoint), app=new URL(appOrigin), source=new URL(sourceOrigin);
    if([e,app,source].some(x=>x.protocol!=='https:') ||
       e.username || e.password || e.search || e.hash || !app.origin || !source.origin)
      return null;
    if(e.pathname!=='/functions/v1/community-dreamsnap-owner' &&
       e.pathname!=='/api/private/dreamsnaps/owner-authority')return null;
    if(e.origin!==app.origin && e.origin!==source.origin)return null;
    return Object.freeze({url:e.toString(),transport:e.origin===app.origin?'SAME_ORIGIN_BFF':'MANAGED_CORS'});
  } catch{return null;}
}

const readHeaders = headers => {
  const h={};
  for(const name of ['cache-control','cdn-cache-control','surrogate-control','vary']){
    const v=headers?.get?.(name);
    if(typeof v==='string')h[name]=v;
  }
  return h;
};

/** Read-only Source153 Owner transport skeleton for the real /manage/ route.
 *  NEVER enabled in production by environment variables or caller options.
 *  Uses CommunitySession as a request candidate, not as an Owner authority.
 *  No automatic token refresh/401 replay: shared Community Client currently
 *  keeps #validSession/#refresh private and lacks coordinated sign-out events.
 */
export function createOwnerProductReadOnlyAdapter({
  client,endpoint,appOrigin,sourceOrigin,fetchImpl=fetch
}={}) {
  const route=ownerProductManagedEndpoint({endpoint,appOrigin,sourceOrigin});
  const read=async({workId,token,anonKey,requestGeneration,latestGeneration,
    expectedRowVersion,expectedAuthorizationEpoch,signal}={})=>{
    if(!OWNER_PRODUCT_READONLY_ENABLED || !OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED)
      return fail('BACKEND_UNAVAILABLE');
    if(!route || typeof fetchImpl!=='function' || !canonicalWorkId(workId) ||
       requestGeneration!==latestGeneration || !Number.isSafeInteger(requestGeneration))
      return fail('SOURCE_CONTRACT_REJECTED');
    const before=ownerProductSignedSessionCandidate(client);
    if(!before || before.token!==token || before.anonKey!==anonKey)
      return fail('AUTH_UNAVAILABLE');
    const context={workId:canonicalWorkId(workId),requestGeneration,latestGeneration};
    if(expectedRowVersion!==undefined)context.expectedRowVersion=expectedRowVersion;
    if(expectedAuthorizationEpoch!==undefined)context.expectedAuthorizationEpoch=expectedAuthorizationEpoch;
    try {
      const response=await fetchImpl(route.url,{
        method:'POST',
        headers:{apikey:anonKey,Authorization:'Bearer '+token,
          'content-type':'application/json',accept:'application/json'},
        body:JSON.stringify({operation:'authority',workId:context.workId,
          ...(expectedRowVersion===undefined?{}:{expectedRowVersion}),
          ...(expectedAuthorizationEpoch===undefined?{}:{expectedAuthorizationEpoch})}),
        cache:'no-store',credentials:'omit',redirect:'error',
        referrerPolicy:'no-referrer',signal
      });
      const body=response.status===200?await response.json():null;
      // Do not synthesise private no-store/cache headers or collapse 403 into CAS.
      const decoded=classifySource153OwnerHttpFixture({
        status:response.status,headers:readHeaders(response.headers),body
      },context);
      const after=ownerProductSignedSessionCandidate(client);
      if(signal?.aborted || !after || after.token!==before.token ||
         after.sessionUserId!==before.sessionUserId ||
         after.expiresAt!==before.expiresAt)return fail('STALE_RESPONSE');
      return safeSource153OwnerView(decoded);
    }catch{return fail(signal?.aborted?'STALE_RESPONSE':'BACKEND_UNAVAILABLE');}
  };
  return Object.freeze({read,available:false,
    transport:route?.transport??'UNCONFIGURED',
    capabilities:Object.freeze({ownerReadVerified:false,actionsEnabled:false,
      liveBackendEnabled:false,snapshot:null})});
}
