import { canonicalWorkId } from '../community/typed-work-route.js';

// Source153 is an independently source/local-accepted authenticated SQL
// projection, NOT a live signed issuer or a browser owner capability.
// Pure decoding MUST NOT modify the frozen WEB248/252/254 @1 contracts.
export const SOURCE153_OWNER_PROJECTION_CONTRACT = 'wand.dreamsnaps.owner-authority-projection@1';
export const PRIVATE_OWNER_CONSUMER_V2_CONTRACT = 'wand.dreamsnaps.private-owner-consumer@2';
export const SOURCE153_OWNER_V2_LIVE_ENABLED = false;
export const SOURCE153_OWNER_V2_CAPABILITIES = Object.freeze({
  ownerRead:false, acceptGrant:false, editConcept:false,
  withdraw:false, requestDelete:false, publish:false,
  publicDetail:false, publicMedia:false, mediaSigner:false,
  verifyGlobalPurge:false
});

const fields = (value, allowed) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).every(key =>
    allowed.includes(key) && key !== '__proto__' && key !== 'constructor' &&
    key !== 'prototype');
const present = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const id = value => canonicalWorkId(value);
const equalId = (a,b) => !!id(a) && id(a) === id(b);
const positive = value => Number.isSafeInteger(value) && value > 0;
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const policyText = value => typeof value === 'string' && value.length >= 1 &&
  value.length <= 80 && value.trim() === value;
const deny = (status,refreshRequired=false) => Object.freeze({
  status, snapshot:null, projectionCandidate:null,
  clearPriorSnapshot:true, refreshRequired, autoRetry:false,
  ownerReadVerified:false, actionsEnabled:false,
  liveBackendEnabled:false
});

const CONTROLS = ['consented','preflight_blocked','withdrawn','delete_requested'];
const PURGE = ['not_requested','requested','provider_pending','provider_reported','verified'];
const LOCAL = ['NOT_REQUESTED','PUBLIC_DISABLED','LOCAL_PURGE_PENDING',
  'LOCAL_FROZEN_MEDIA_VERIFIED','LOCAL_LEGAL_HOLD'];

function validContext(context) {
  return fields(context,['workId','requestGeneration','latestGeneration',
      'expectedRowVersion','expectedAuthorizationEpoch']) &&
    !!id(context.workId) && nonnegative(context.requestGeneration) &&
    nonnegative(context.latestGeneration) &&
    (!present(context,'expectedRowVersion') || positive(context.expectedRowVersion)) &&
    (!present(context,'expectedAuthorizationEpoch') || positive(context.expectedAuthorizationEpoch));
}

function validSource(data,context) {
  if (!fields(data,['contractVersion','consumerTarget','work','authority','grant',
       'deletion','externalEvidence','capabilities']) ||
      data.contractVersion !== SOURCE153_OWNER_PROJECTION_CONTRACT ||
      data.consumerTarget !== PRIVATE_OWNER_CONSUMER_V2_CONTRACT) return false;
  const {work:w,authority:a,grant:g,deletion:d,externalEvidence:x,capabilities:c}=data;

  if (!fields(w,['workId','creatorProfileId','challengeId','kind',
      'photoRevisionId','photoMediaId','currentWorkRevisionId','entryId',
      'frozenEntryRevisionId']) ||
      !equalId(w.workId,context.workId) || !id(w.creatorProfileId) ||
      !id(w.challengeId) || !id(w.photoRevisionId) || !id(w.photoMediaId) ||
      !id(w.currentWorkRevisionId) ||
      !['OriginalCompetition','PostEventCreation'].includes(w.kind)) return false;
  if (w.kind === 'OriginalCompetition') {
    if (!id(w.entryId) || !equalId(w.frozenEntryRevisionId,w.photoRevisionId))
      return false;
  } else if (present(w,'entryId') || present(w,'frozenEntryRevisionId')) return false;

  if (!fields(a,['ownerAuthorized','authenticatedAccountBound',
      'activeIdentityVerified','creatorOwnerVerified','workPhotoBindingVerified',
      'mediaOwnershipVerified','mediaReady','rowVersion',
      'authorizationEpoch','controlState']) ||
      !['ownerAuthorized','authenticatedAccountBound','activeIdentityVerified',
        'creatorOwnerVerified','workPhotoBindingVerified',
        'mediaOwnershipVerified'].every(k=>a[k]===true) ||
      typeof a.mediaReady !== 'boolean' ||
      !positive(a.rowVersion) || !positive(a.authorizationEpoch) ||
      !CONTROLS.includes(a.controlState)) return false;

  if (!fields(g,['mediaId','photoRevisionId','creatorSelfCaptureDeclared',
      'explicitGrantAccepted','consentRecorded','lastGrantConsentRevision',
      'policyVersionText','policyDigest','state','policyReceiptVerified',
      'scopeStatus','scopeId','approvedPurposeIds','publicUsageAuthorized']) ||
      !equalId(g.mediaId,w.photoMediaId) ||
      !equalId(g.photoRevisionId,w.photoRevisionId) ||
      g.creatorSelfCaptureDeclared !== true || g.explicitGrantAccepted !== true ||
      g.consentRecorded !== true || !positive(g.lastGrantConsentRevision) ||
      g.lastGrantConsentRevision > a.rowVersion ||
      !policyText(g.policyVersionText) || !digest(g.policyDigest) ||
      !['recorded','withdrawn'].includes(g.state) ||
      typeof g.policyReceiptVerified !== 'boolean' ||
      !['UNVERIFIED','APPROVED_CANONICAL_RECEIPT'].includes(g.scopeStatus) ||
      g.publicUsageAuthorized !== false) return false;
  if (g.scopeStatus === 'UNVERIFIED') {
    if (g.policyReceiptVerified !== false ||
        present(g,'scopeId') || present(g,'approvedPurposeIds')) return false;
  } else {
    // Source151 receipt table constrains the only purpose+scope to this ID.
    if (g.policyReceiptVerified !== true ||
        g.scopeId !== 'wand.dreamsnaps.creator-photo-grant@1' ||
        !Array.isArray(g.approvedPurposeIds) ||
        g.approvedPurposeIds.length !== 1 ||
        g.approvedPurposeIds[0] !== g.scopeId) return false;
  }
  // A past Grant event remains even after Work CAS withdrawal. They are
  // deliberately not equal to the Work rowVersion or authorizationEpoch.
  if ((a.controlState === 'consented' && g.state !== 'recorded') ||
      (a.controlState === 'withdrawn' && g.state !== 'withdrawn')) return false;

  if (!fields(d,['controlState','localState','publicDisabled',
      'activeAccountLegalHold','localProviderReceiptVerified',
      'localProviderScope','providerStatus','globalPurgeScopeComplete',
      'cloudCdnIssuedBearerStatus']) ||
      d.controlState !== a.controlState || !LOCAL.includes(d.localState) ||
      typeof d.publicDisabled !== 'boolean' ||
      typeof d.activeAccountLegalHold !== 'boolean' ||
      typeof d.localProviderReceiptVerified !== 'boolean' ||
      d.localProviderScope !== 'SINGLE_FROZEN_MEDIA_RECORD' ||
      !PURGE.includes(d.providerStatus) ||
      d.globalPurgeScopeComplete !== false ||
      d.cloudCdnIssuedBearerStatus !== 'UNKNOWN') return false;
  if (['withdrawn','delete_requested'].includes(a.controlState) &&
      !d.publicDisabled) return false;
  if (d.localProviderReceiptVerified) {
    if (d.localState !== 'LOCAL_FROZEN_MEDIA_VERIFIED' ||
        d.providerStatus !== 'verified' || !d.publicDisabled ||
        d.activeAccountLegalHold || a.mediaReady) return false;
  } else if (d.localState === 'LOCAL_FROZEN_MEDIA_VERIFIED') return false;
  if (d.localState === 'LOCAL_LEGAL_HOLD' && !d.activeAccountLegalHold) return false;
  if (d.localState === 'PUBLIC_DISABLED' && !d.publicDisabled) return false;
  if (d.localState === 'NOT_REQUESTED' &&
      (d.publicDisabled || d.providerStatus !== 'not_requested')) return false;
  if (d.localState === 'LOCAL_PURGE_PENDING' && d.localProviderReceiptVerified)
    return false;

  if (!fields(x,['signedRuntimeSessionVerified','storageProviderObjectVerified',
      'officialChallengePhaseVerified','cloudCdnPhysicalPurgeVerified',
      'publicActivationAllowed']) ||
      !Object.values(x).every(v=>v===false) ||
      !fields(c,['ownerActionsEnabled','publicDetail','publicMedia',
        'publish','mediaSigner']) ||
      !Object.values(c).every(v=>v===false)) return false;

  return true;
}

// Source153 envelope is NOT the older Source150 service@1 or Source151
// pregrant-service@1. Client-supplied "actorAccountId" is never a trust root.
// Even a perfect MOCK never yields a verified Owner snapshot.
export function decodeSource153OwnerConsumerV2(envelope,context) {
  if (!validContext(context)) return deny('SOURCE_CONTRACT_REJECTED');
  if (context.requestGeneration !== context.latestGeneration)
    return deny('STALE_RESPONSE');
  if (!fields(envelope,['ok','operation','contractVersion','data']) ||
      envelope.ok !== true || envelope.operation !== 'authority' ||
      envelope.contractVersion !== SOURCE153_OWNER_PROJECTION_CONTRACT ||
      !validSource(envelope.data,context)) return deny('SOURCE_CONTRACT_REJECTED');

  const {work:w,authority:a,grant:g,deletion:d}=envelope.data;
  if ((present(context,'expectedRowVersion') &&
        context.expectedRowVersion !== a.rowVersion) ||
      (present(context,'expectedAuthorizationEpoch') &&
        context.expectedAuthorizationEpoch !== a.authorizationEpoch))
    return deny('REFRESH_REQUIRED',true);

  // A typed, safe-to-inspect SOURCE candidate: not a live authenticated
  // Owner snapshot, not a user action grant, public licence, or purge receipt.
  const candidate=Object.freeze({
    contractVersion:PRIVATE_OWNER_CONSUMER_V2_CONTRACT,
    workId:id(w.workId), creatorProfileId:id(w.creatorProfileId),
    challengeId:id(w.challengeId), kind:w.kind,
    photoRevisionId:id(w.photoRevisionId),
    mediaId:id(w.photoMediaId), currentWorkRevisionId:id(w.currentWorkRevisionId),
    isCompetitionEntry:w.kind === 'OriginalCompetition',
    rowVersion:a.rowVersion, authorizationEpoch:a.authorizationEpoch,
    mediaReady:a.mediaReady, authenticatedAccountSourceClaim:true,
    workPhotoMediaSourceClaim:true,
    lastGrantConsentRevision:g.lastGrantConsentRevision,
    grantState:g.state, policyVersionText:g.policyVersionText,
    policyReceiptSourceClaim:g.scopeStatus,
    // No fabricated grant scopes, permissions, global Media purge or URLs.
    approvedPurposesForPublication:Object.freeze([]),
    publicUsageAuthorized:false, localProviderStatus:d.providerStatus,
    localDeletionState:d.localState, activeAccountLegalHold:d.activeAccountLegalHold,
    globalPurgeScopeComplete:false, externalPurgeStatus:'UNKNOWN',
    actionsEnabled:false, publicDetailEnabled:false, mediaSigningEnabled:false
  });
  return Object.freeze({
    ...deny('SOURCE153_SCHEMA_CANDIDATE_ONLY'),
    sourceContractVersion:SOURCE153_OWNER_PROJECTION_CONTRACT,
    consumerContractVersion:PRIVATE_OWNER_CONSUMER_V2_CONTRACT,
    projectionCandidate:candidate, requiresSignedRuntimeAcceptance:true
  });
}

function safeHeader(headers,name) {
  if (!fields(headers,Object.keys(headers))) return null;
  const matches=Object.keys(headers).filter(k=>k.toLowerCase()===name);
  if (matches.length!==1 || typeof headers[matches[0]]!=='string') return null;
  return headers[matches[0]].toLowerCase().trim();
}
function privateUncacheable(headers) {
  const cache=safeHeader(headers,'cache-control');
  const directives=cache?.split(',').map(v=>v.trim())??[];
  if (!directives.includes('private') || !directives.includes('no-store') ||
      !directives.includes('max-age=0') || directives.includes('public') ||
      safeHeader(headers,'cdn-cache-control')!=='no-store' ||
      safeHeader(headers,'surrogate-control')!=='no-store') return false;
  const vary=safeHeader(headers,'vary')?.split(',').map(v=>v.trim())??[];
  return vary.includes('authorization') && vary.includes('origin') && !vary.includes('*');
}

// No actual fetch, bearer token, URL or client session. 200 only validates
// SOURCE-SHAPED fixture bytes; all results invalidate any prior Owner snapshot.
export function classifySource153OwnerHttpFixture(response,context) {
  if (!validContext(context)) return deny('SOURCE_CONTRACT_REJECTED');
  if (context.requestGeneration!==context.latestGeneration)
    return deny('STALE_RESPONSE');
  if (!response || typeof response!=='object' || Array.isArray(response) ||
      !Number.isInteger(response.status)) return deny('BACKEND_UNAVAILABLE');
  if (response.status===409 || response.status===412)
    return deny('REFRESH_REQUIRED',true);
  if (response.status!==200) return deny('BACKEND_UNAVAILABLE');
  if (!privateUncacheable(response.headers)) return deny('UNSAFE_CACHE_POLICY');
  return decodeSource153OwnerConsumerV2(response.body,context);
}
