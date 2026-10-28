import { canonicalWorkId } from '../community/typed-work-route.js';
import { SOURCE150_OWNER_SERVICE_CONTRACT } from './source150-owner-service-adapter.js';

// Frozen 03 COMM Source151 pregrant SERVICE wire proposal. This module has no
// transport, signed session, policy registry write, Grant, Media or UI action.
// The actual Source151 Owner PR253 must pass its own independent new-only QA.
export const SOURCE151_PREGRANT_DATA_CONTRACT = 'wand.dreamsnaps.pregrant-service@1';
export const SOURCE151_PREGRANT_ADAPTER_ENABLED = false;
export const SOURCE151_PREGRANT_CAPABILITIES = Object.freeze({
  pregrantRead: false, registerWork: false, registerMedia: false,
  acceptCreatorGrant: false, editConcept: false, publish: false,
  publicDetail: false, mediaSigner: false, requestDelete: false
});
export const SOURCE151_POLICY_SCOPE = 'wand.dreamsnaps.creator-photo-grant@1';
export const SOURCE151_REQUIRED_FIRST_CAS = Object.freeze({
  expectedRowVersion: 0, expectedAuthorizationEpoch: 0
});
export const SOURCE151_LIMITS = Object.freeze({
  policyTextMin: 20, policyTextMax: 16000,
  policyIdMax: 80
});

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, allowed) => object(v) &&
  Object.keys(v).every(k => allowed.includes(k) &&
    k !== '__proto__' && k !== 'constructor' && k !== 'prototype');
const workId = v => canonicalWorkId(v);
const same = (a, b) => !!workId(a) && workId(a) === workId(b);
const nonnegative = v => Number.isSafeInteger(v) && v >= 0;
const proofDigest = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const policyVersion = v => typeof v === 'string' && /^v[1-9][0-9]{0,6}$/.test(v);
const invalid = (status,refreshRequired=false) => Object.freeze({
  status, snapshot:null, policyReceipt:null, ownerReadVerified:false,
  creatorGrantRecorded:false, firstGrantExecutable:false,
  actionsEnabled:false, refreshRequired, clearPriorSnapshot:true, autoRetry:false
});

function contextValid(c) {
  return exact(c,['workId','requestGeneration','latestGeneration']) &&
    !!workId(c.workId) && nonnegative(c.requestGeneration) &&
    nonnegative(c.latestGeneration);
}

// Source151 is a *preconsent* read, separate from Source150's postconsent
// Owner Read / Action response. A client must not turn zero first-CAS into
// positive rowVersion or an accepted image grant.
export function inspectSource151PregrantEnvelope(envelope, context) {
  if (!contextValid(context)) return invalid('SOURCE_CONTRACT_REJECTED');
  if (context.requestGeneration !== context.latestGeneration)
    return invalid('STALE_RESPONSE');

  if (!exact(envelope,['ok','operation','contractVersion','data']) ||
      envelope.ok !== true || envelope.operation !== 'pregrant' ||
      envelope.contractVersion !== SOURCE150_OWNER_SERVICE_CONTRACT)
    return invalid('SOURCE_CONTRACT_REJECTED');

  const d=envelope.data;
  if (!exact(d,['contractVersion','state','ownerAuthorized','workId',
      'kind','creatorProfileId','challengeId','photoRevisionId','photoMediaId',
      'entryId','frozenEntryRevisionId','authenticatedAccountBound',
      'workPhotoBindingVerified','mediaOwnershipVerified','originalImageImmutable',
      'expectedRowVersion','expectedAuthorizationEpoch','grantRecorded',
      'publicActivationAllowed','officialChallengePhaseVerified',
      'policyReceipt','grantAvailable','erasure']) ||
      d.contractVersion !== SOURCE151_PREGRANT_DATA_CONTRACT ||
      !['NEED_POLICY_ARTIFACT','PREGRANT_READY'].includes(d.state) ||
      !same(d.workId,context.workId) ||
      !workId(d.creatorProfileId) || !workId(d.challengeId) ||
      !workId(d.photoRevisionId) || !workId(d.photoMediaId) ||
      !['OriginalCompetition','PostEventCreation'].includes(d.kind) ||
      d.ownerAuthorized !== true || d.authenticatedAccountBound !== true ||
      d.workPhotoBindingVerified !== true ||
      d.mediaOwnershipVerified !== true || d.originalImageImmutable !== true ||
      d.expectedRowVersion !== SOURCE151_REQUIRED_FIRST_CAS.expectedRowVersion ||
      d.expectedAuthorizationEpoch !== SOURCE151_REQUIRED_FIRST_CAS.expectedAuthorizationEpoch ||
      d.grantRecorded !== false ||
      d.publicActivationAllowed !== false ||
      d.officialChallengePhaseVerified !== false ||
      typeof d.grantAvailable !== 'boolean' ||
      !exact(d.erasure,['state','physicalPurgeVerified','publicDisabled']) ||
      d.erasure.state !== 'NOT_REQUESTED' ||
      d.erasure.physicalPurgeVerified !== false ||
      typeof d.erasure.publicDisabled !== 'boolean')
    return invalid('SOURCE_CONTRACT_REJECTED');

  if (d.kind === 'OriginalCompetition') {
    if (!workId(d.entryId) || !same(d.frozenEntryRevisionId,d.photoRevisionId))
      return invalid('SOURCE_CONTRACT_REJECTED');
  } else if (Object.hasOwn(d,'entryId') ||
             Object.hasOwn(d,'frozenEntryRevisionId')) {
    return invalid('SOURCE_CONTRACT_REJECTED');
  }

  const policyPresent = Object.hasOwn(d,'policyReceipt');
  if (d.state === 'NEED_POLICY_ARTIFACT') {
    if (d.grantAvailable !== false || policyPresent)
      return invalid('SOURCE_CONTRACT_REJECTED');

    return Object.freeze({
      ...invalid('NEED_POLICY_ARTIFACT'),
      sourceContractVersion: SOURCE151_PREGRANT_DATA_CONTRACT,
      policyRegistered:false, pendingSource151IndependentQA:true
    });
  }

  const p=d.policyReceipt;
  if (d.grantAvailable !== true || !policyPresent ||
      !exact(p,['policyVersionText','policyDigest','scopeId','canonicalText']) ||
      !policyVersion(p.policyVersionText) ||
      p.policyVersionText.length > SOURCE151_LIMITS.policyIdMax ||
      !proofDigest(p.policyDigest) ||
      p.scopeId !== SOURCE151_POLICY_SCOPE ||
      typeof p.canonicalText !== 'string' ||
      p.canonicalText.length < SOURCE151_LIMITS.policyTextMin ||
      p.canonicalText.length > SOURCE151_LIMITS.policyTextMax)
    return invalid('SOURCE_CONTRACT_REJECTED');

  // Strict schema matching is NOT a verified live JWT issuer, actual Policy
  // approval, independently trusted SHA256 receipt, or registered consent.
  // Never expose canonicalText/digest/MediaID/EntryID to UI via mock results.
  return Object.freeze({
    ...invalid('PREGRANT_CONTRACT_CANDIDATE_ONLY'),
    sourceContractVersion: SOURCE151_PREGRANT_DATA_CONTRACT,
    policyRegistered:false, pendingSource151IndependentQA:true,
    requiresLiveOwnerAndPolicyEvidence:true
  });
}

// The HTTP object is synthetic only. Source151 uses the same Source150
// Edge's private/no-store authenticated boundary. Neither request nor network
// transport is wired here.
export function inspectSource151PregrantHttpFixture(response,context) {
  if (!contextValid(context)) return invalid('SOURCE_CONTRACT_REJECTED');
  if (context.requestGeneration !== context.latestGeneration)
    return invalid('STALE_RESPONSE');
  if (!object(response) || !Number.isInteger(response.status))
    return invalid('BACKEND_UNAVAILABLE');
  if (response.status === 409 || response.status === 412)
    return invalid('REFRESH_REQUIRED',true);
  if (response.status !== 200)
    return invalid('BACKEND_UNAVAILABLE');

  const h=response.headers;
  const val=k=>object(h) && typeof h[k]==='string' ? h[k].toLowerCase() : '';
  if (!/(?:^|[,\\s])private(?:[,\\s]|$)/i.test(val('cache-control')) ||
      !/(?:^|[,\\s])no-store(?:[,\\s]|$)/i.test(val('cache-control')) ||
      val('cdn-cache-control') !== 'no-store' ||
      val('surrogate-control') !== 'no-store' ||
      !val('vary').split(',').some(v=>v.trim()==='authorization'))
    return invalid('UNSAFE_CACHE_POLICY');
  return inspectSource151PregrantEnvelope(response.body,context);
}

// Always inert despite a structurally positive mocked pregrant response.
// Source151's initial (0,0) CAS is for a FUTURE trusted service, not a command.
export function createSource151PregrantConsumer() {
  return Object.freeze({
    capabilities:SOURCE151_PREGRANT_CAPABILITIES,
    async pregrant() { return invalid('BACKEND_UNAVAILABLE'); },
    async acceptGrant() { return invalid('BACKEND_UNAVAILABLE'); }
  });
}
