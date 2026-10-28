import { canonicalWorkId } from '../community/typed-work-route.js';
import {
  PRIVATE_OWNER_CONSUMER_CONTRACT, PRIVATE_OWNER_BACKEND_ACTIVATED,
  PRIVATE_OWNER_CAPABILITIES
} from './private-owner-consumer-contract.js';

// ONLY the frozen Source150 service@1 response schema may enter this converter.
// This is a local, synthetic fixture validator, not an API client or trust root.
export const SOURCE150_OWNER_SERVICE_CONTRACT = 'wand.dreamsnaps.owner-management-service@1';
export const SOURCE150_OWNER_SOURCE_CONTRACT = 'wand.dreamsnaps.owner-management@1';
export const SOURCE150_OWNER_ADAPTER_ENABLED = false;

// Required authoritative fields are NOT included in Source150's actual wire.
// No field here may be filled using a browser route, display account, or mock JWT.
export const SOURCE150_MISSING_AUTHORITY = Object.freeze([
  'work.ownerAccountId [server-verified owner account]',
  'authority.photoBindingVerified [server-attested frozen photo binding]',
  'authority.mediaOwnershipVerified [server-attested owned Media]',
  'grant.mediaId [server-attested consent-to-Media binding]',
  'grant.creatorSelfCaptureDeclared [server-attested explicit declaration]',
  'grant.explicitGrantAccepted [server-attested grant]',
  'grant.scopes [server-attested immutable licence scopes]',
  'deletion.controlState [authoritative Source149 state]',
  'deletion.providerVerificationAccepted [retention/provider verified]',
  'deletion.purgeScopeComplete [Provider+Cloud+CDN verified scope]',
  'deletion.legalHold [explicit authoritative hold state]'
]);
export const SOURCE150_FIELD_LINEAGE = Object.freeze({
  'data.workId':'work.workId',
  'data.creatorProfileId':'work.creatorProfileId',
  'data.kind':'work.kind',
  'data.challengeId':'work.challengeId',
  'data.photoRevisionId':'work.photoRevisionId',
  'data.photoMediaId':'work.mediaId',
  'data.conceptRevisionId':'work.conceptRevisionId',
  'data.concept':'work.conceptText',
  'data.entryId':'work.entryId [Original only]',
  'data.frozenEntryRevisionId':'work.frozenEntryRevisionId [Original only]',
  'data.rowVersion':'authority.rowVersion',
  'data.authorizationEpoch':'authority.authorizationEpoch',
  'data.imageGrant.policyVersionText':'grant.policyIdentifier [opaque TEXT]',
  'data.imageGrant.consentRevision':'grant.consentEventVersion [last GRANT event only]',
  'data.imageGrant.state':'grant.state',
  'data.erasure.providerStatus':'deletion.purgeState [NOT a purge receipt]',
  'data.erasure.publicDisabled':'deletion.publicDisabled'
});
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => obj(value) && Object.keys(value).every(key =>
  allowed.includes(key) && key !== '__proto__' && key !== 'constructor' && key !== 'prototype');
const uuid = value => canonicalWorkId(value);
const same = (a,b) => !!uuid(a) && uuid(a) === uuid(b);
const positive = n => Number.isSafeInteger(n) && n > 0;
const nonnegative = n => Number.isSafeInteger(n) && n >= 0;
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const refuse = (status, refreshRequired=false) => Object.freeze({
  status, snapshot:null, clearPriorSnapshot:true, refreshRequired,
  autoRetry:false, ownerReadVerified:false, actionsEnabled:false
});
const hasOwn = (o,k) => Object.prototype.hasOwnProperty.call(o,k);

function validContext(c) {
  return obj(c) && keys(c,['workId','requestGeneration','latestGeneration',
    'expectedRowVersion','expectedAuthorizationEpoch']) &&
    !!uuid(c.workId) && nonnegative(c.requestGeneration) &&
    nonnegative(c.latestGeneration);
}

function source150FlatValid(data, c) {
  if (!keys(data,['contractVersion','sourceContractVersion','workId','kind',
      'creatorProfileId','challengeId','entryId','frozenEntryRevisionId',
      'photoRevisionId','photoMediaId','conceptRevisionId','concept',
      'rowVersion','authorizationEpoch','ownerAuthorized','accountState',
      'identityState','retired','privacySuppressed','moderationAllowed',
      'imageGrant','erasure','capabilities']) ||
      data.contractVersion !== SOURCE150_OWNER_SERVICE_CONTRACT ||
      data.sourceContractVersion !== SOURCE150_OWNER_SOURCE_CONTRACT ||
      !same(data.workId,c.workId) || !uuid(data.creatorProfileId) ||
      !uuid(data.challengeId) || !uuid(data.photoRevisionId) ||
      !uuid(data.photoMediaId) || !uuid(data.conceptRevisionId) ||
      typeof data.concept !== 'string' || data.concept.length > 2000 ||
      !['OriginalCompetition','PostEventCreation'].includes(data.kind) ||
      data.ownerAuthorized !== true || data.accountState !== 'active' ||
      data.identityState !== 'active' || data.retired !== false ||
      data.privacySuppressed !== false || data.moderationAllowed !== true ||
      !positive(data.rowVersion) || !positive(data.authorizationEpoch)) return false;
  // Source150 does NOT expose an AccountID; injected owner provenance is
  // a schema violation, not a reason to trust client-supplied IDs.
  if (data.kind === 'OriginalCompetition') {
    if (!uuid(data.entryId) || !same(data.frozenEntryRevisionId,data.photoRevisionId))
      return false;
  } else if (hasOwn(data,'entryId') || hasOwn(data,'frozenEntryRevisionId')) return false;

  const g=data.imageGrant,e=data.erasure,cap=data.capabilities;
  if (!keys(g,['policyVersionText','policyVersionOrdinal','policyDigest',
        'consentRevision','workId','state']) ||
      typeof g.policyVersionText !== 'string' ||
      g.policyVersionText.length < 1 || g.policyVersionText.length > 80 ||
      !(g.policyVersionOrdinal === null ||
        (positive(g.policyVersionOrdinal) && g.policyVersionOrdinal <= 9999999)) ||
      !digest(g.policyDigest) ||
      !positive(g.consentRevision) || g.consentRevision > data.rowVersion ||
      !same(g.workId,data.workId) ||
      !['accepted','withdrawn'].includes(g.state)) return false;
  // Source150 generates an ordinal ONLY for strict vN policy IDs. There is
  // NO numeric inference from arbitrary source policyVersionText.
  if (g.policyVersionOrdinal !== null &&
      !/^v[1-9][0-9]{0,6}$/.test(g.policyVersionText)) return false;
  if (!keys(e,['state','revision','publicDisabled','physicalPurgeVerified',
        'providerStatus']) ||
      !['NOT_REQUESTED','PUBLIC_DISABLED','MEDIA_PURGE_PENDING',
        'MEDIA_PURGED','LEGAL_HOLD'].includes(e.state) ||
      !['not_requested','requested','provider_pending','provider_reported',
        'verified'].includes(e.providerStatus) ||
      e.revision !== data.rowVersion ||
      typeof e.publicDisabled !== 'boolean' ||
      typeof e.physicalPurgeVerified !== 'boolean') return false;
  if (e.state === 'NOT_REQUESTED' &&
      (e.publicDisabled || e.physicalPurgeVerified || e.providerStatus !== 'not_requested')) return false;
  if (e.state === 'PUBLIC_DISABLED' &&
      (!e.publicDisabled || e.physicalPurgeVerified || e.providerStatus !== 'not_requested')) return false;
  if (e.state === 'MEDIA_PURGE_PENDING' &&
      (!e.publicDisabled || e.physicalPurgeVerified ||
        !['requested','provider_pending','provider_reported','verified'].includes(e.providerStatus))) return false;
  if (e.state === 'MEDIA_PURGED' &&
      (!e.publicDisabled || !e.physicalPurgeVerified || e.providerStatus !== 'verified')) return false;
  if (e.state === 'LEGAL_HOLD' &&
      (!e.publicDisabled || e.physicalPurgeVerified ||
        e.providerStatus === 'not_requested')) return false;
  if (!keys(cap,['ownerRead','grant','concept','withdraw','deleteRequest',
      'publicDetail','publicMedia','publish','verifyPurge']) ||
      cap.ownerRead !== true ||
      !['grant','concept','withdraw','deleteRequest'].every(k=>typeof cap[k]==='boolean') ||
      !['publicDetail','publicMedia','publish','verifyPurge'].every(k=>cap[k]===false))
    return false;
  return true;
}

// A valid schema never means a verified session. 03 COMM must return ALL
// evidence-backed missing fields as an authoritative server projection, not
// caller/body extras. Until then, do not materialize WEB248's nested DTO.
export function adaptSource150OwnerEnvelope(envelope,context) {
  if (!validContext(context)) return refuse('SOURCE_CONTRACT_REJECTED');
  if (context.requestGeneration !== context.latestGeneration)
    return refuse('STALE_RESPONSE');
  if (!keys(envelope,['ok','operation','contractVersion','data']) ||
      envelope.ok !== true ||
      !['read','action'].includes(envelope.operation) ||
      envelope.contractVersion !== SOURCE150_OWNER_SERVICE_CONTRACT)
    return refuse('SOURCE_CONTRACT_REJECTED');
  let source;
  if (envelope.operation === 'read') {
    source=envelope.data;
  } else {
    if (!keys(envelope.data,['result','owner','publicActivationAllowed']) ||
        !obj(envelope.data.result) ||
        envelope.data.publicActivationAllowed !== false)
      return refuse('SOURCE_CONTRACT_REJECTED');
    source=envelope.data.owner;
  }
  if (!source150FlatValid(source,context))
    return refuse('SOURCE_CONTRACT_REJECTED');
  if (hasOwn(context,'expectedRowVersion') &&
      (!positive(context.expectedRowVersion) ||
        source.rowVersion !== context.expectedRowVersion))
    return refuse('REFRESH_REQUIRED',true);
  if (hasOwn(context,'expectedAuthorizationEpoch') &&
      (!positive(context.expectedAuthorizationEpoch) ||
        source.authorizationEpoch !== context.expectedAuthorizationEpoch))
    return refuse('REFRESH_REQUIRED',true);

  // Do not construct ownerAccountId/authority flags/consent MediaId or
  // provider full-purge proof. A source-only valid Owner payload is still
  // insufficient for decodePrivateOwnerSnapshotCandidate.
  return Object.freeze({
    ...refuse('NEED_BACKEND_PROJECTION'),
    sourceContractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,
    consumerContractVersion:PRIVATE_OWNER_CONSUMER_CONTRACT,
    missingAuthority:SOURCE150_MISSING_AUTHORITY,
    requiresFreshAuthenticatedRead:envelope.operation === 'action',
    liveBackendEnabled:PRIVATE_OWNER_BACKEND_ACTIVATED &&
      Object.values(PRIVATE_OWNER_CAPABILITIES).some(Boolean)
  });
}

// This accepts only local response-shaped fixtures. NO fetch(), bearer, RPC
// or endpoint is included. Success needs private,no-store headers even in a
// test fixture; no old public cache allowance can be inherited.
export function classifySource150OwnerHttpFixture(response,context) {
  if (!validContext(context)) return refuse('SOURCE_CONTRACT_REJECTED');
  if (context.requestGeneration !== context.latestGeneration)
    return refuse('STALE_RESPONSE');
  if (!obj(response) || !Number.isInteger(response.status))
    return refuse('BACKEND_UNAVAILABLE');
  if (response.status === 409 || response.status === 412)
    return refuse('REFRESH_REQUIRED',true);
  if ([401,403,404,410,503].includes(response.status))
    return refuse('BACKEND_UNAVAILABLE');
  if (response.status !== 200) return refuse('BACKEND_UNAVAILABLE');
  const headers=response.headers;
  if (!obj(headers) || typeof headers['cache-control'] !== 'string' ||
      !/(?:^|[,\s])private(?:[,\s]|$)/i.test(headers['cache-control']) ||
      !/(?:^|[,\s])no-store(?:[,\s]|$)/i.test(headers['cache-control']) ||
      headers['cdn-cache-control'] !== 'no-store' ||
      headers['surrogate-control'] !== 'no-store' ||
      typeof headers.vary !== 'string' ||
      !headers.vary.toLowerCase().includes('authorization'))
    return refuse('UNSAFE_CACHE_POLICY');
  return adaptSource150OwnerEnvelope(response.body,context);
}
