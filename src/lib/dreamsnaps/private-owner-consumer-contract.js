import { canonicalWorkId } from '../community/typed-work-route.js';

// PROPOSED PRIVATE OWNER READ PROJECTION ONLY. Source149 has PRIVATE SQL tables
// and functions but NO verified authenticated HTTP issuer, endpoint or read API.
// This module is pure: importing or executing it can never send an RPC.
// Never combine a valid shape with permission to activate an Owner operation.
export const PRIVATE_OWNER_CONSUMER_CONTRACT = 'wand.dreamsnaps.private-owner-consumer@1';
export const PRIVATE_OWNER_BACKEND_ACTIVATED = false;
export const PRIVATE_OWNER_CAPABILITIES = Object.freeze({
  read: false, acceptGrant: false, editConcept: false, withdraw: false,
  requestDelete: false, createPostEvent: false, publish: false, publicDetail: false,
  mediaSigner: false, verifyPurge: false
});
export const PRIVATE_OWNER_WORK_KINDS = Object.freeze(['OriginalCompetition', 'PostEventCreation']);
export const PRIVATE_OWNER_CONTROL_STATES = Object.freeze([
  'consented', 'preflight_blocked', 'withdrawn', 'delete_requested'
]);
export const PRIVATE_OWNER_PURGE_STATES = Object.freeze([
  'not_requested', 'requested', 'provider_pending', 'provider_reported', 'verified'
]);
export const PRIVATE_OWNER_GRANT_SCOPES = Object.freeze(['cdn','display','store','thumbnail']);

const uuid = value => canonicalWorkId(value);
const positiveVersion = value => Number.isSafeInteger(value) && value > 0;
const generation = value => Number.isSafeInteger(value) && value >= 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fieldsOnly = (value, keys) => record(value) &&
  Object.keys(value).every(key => keys.includes(key)) && Object.keys(value).every(key => !key.startsWith('__'));
const same = (a,b) => typeof a === 'string' && uuid(a) === uuid(b) && uuid(a) !== null;
const policyId = value => typeof value === 'string' && value.length >= 1 && value.length <= 80;
const safeConcept = value => value === null || (typeof value === 'string' && value.length <= 2000);
const noMediaUrls = keys => !keys.some(key => /url|storage|bucket|objectpath|path|jwt|token|signed|secret/i.test(key));

/**
 * @typedef {'OriginalCompetition'|'PostEventCreation'} PrivateOwnerWorkKind
 * @typedef {'not_requested'|'requested'|'provider_pending'|'provider_reported'|'verified'} PrivateOwnerPurgeState
 * @typedef {{workId:string,actorAccountId:string,requestGeneration:number,latestGeneration:number,expectedRowVersion?:number,expectedAuthorizationEpoch?:number}} OwnerConsumerContext
 *
 * @typedef {object} OwnerServiceSnapshotCandidate
 * @property {string} contractVersion - exact proposed service DTO version, NOT an existing endpoint
 * @property {{workId:string,ownerAccountId:string,creatorProfileId:string,kind:PrivateOwnerWorkKind,challengeId:string,photoRevisionId:string,mediaId:string,conceptRevisionId:string,conceptText:string|null,entryId?:string,frozenEntryRevisionId?:string}} work
 * @property {{ownerAuthorized:true,accountState:'active',identityState:'active',retired:false,privacySuppressed:false,moderationAllowed:true,photoBindingVerified:true,mediaOwnershipVerified:true,rowVersion:number,authorizationEpoch:number}} authority
 * @property {{state:'accepted'|'withdrawn',policyIdentifier:string,consentEventVersion:number,workId:string,mediaId:string,creatorSelfCaptureDeclared:true,explicitGrantAccepted:true,scopes:string[]}} grant
 * @property {{controlState:'consented'|'preflight_blocked'|'withdrawn'|'delete_requested',publicDisabled:boolean,purgeState:PrivateOwnerPurgeState,providerVerificationAccepted:boolean,purgeScopeComplete:boolean,legalHold:boolean}} deletion
 */

// Strict shape check ONLY. A fake ownerAuthorized flag, mock Auth token, or
// valid DTO does not establish trusted identity. The not-yet-created backend
// MUST bind verified JWT subject to Source149 private p_auth_subject, and pin
// account/Work/media/epoch under an owner-only read transaction.
export function decodePrivateOwnerSnapshotCandidate(input, context) {
  if (!fieldsOnly(input,['contractVersion','work','authority','grant','deletion']) ||
      input.contractVersion !== PRIVATE_OWNER_CONSUMER_CONTRACT ||
      !record(context) || !uuid(context.workId) || !uuid(context.actorAccountId) ||
      !generation(context.requestGeneration) ||
      context.requestGeneration !== context.latestGeneration ||
      !fieldsOnly(input.work,['workId','ownerAccountId','creatorProfileId','kind',
        'challengeId','photoRevisionId','mediaId','conceptRevisionId','conceptText',
        'entryId','frozenEntryRevisionId']) ||
      !noMediaUrls(Object.keys(input.work)) ||
      !fieldsOnly(input.authority,['ownerAuthorized','accountState','identityState','retired',
        'privacySuppressed','moderationAllowed','photoBindingVerified',
        'mediaOwnershipVerified','rowVersion','authorizationEpoch']) ||
      !fieldsOnly(input.grant,['state','policyIdentifier','consentEventVersion',
        'workId','mediaId','creatorSelfCaptureDeclared','explicitGrantAccepted','scopes']) ||
      !fieldsOnly(input.deletion,['controlState','publicDisabled','purgeState',
        'providerVerificationAccepted','purgeScopeComplete','legalHold'])) return null;

  const {work:w,authority:a,grant:g,deletion:d} = input;
  if (!same(w.workId,context.workId) || !same(w.ownerAccountId,context.actorAccountId) ||
      !uuid(w.creatorProfileId) || !uuid(w.challengeId) || !uuid(w.photoRevisionId) ||
      !uuid(w.mediaId) || !uuid(w.conceptRevisionId) ||
      !PRIVATE_OWNER_WORK_KINDS.includes(w.kind) || !safeConcept(w.conceptText) ||
      a.ownerAuthorized !== true || a.accountState !== 'active' ||
      a.identityState !== 'active' || a.retired !== false ||
      a.privacySuppressed !== false || a.moderationAllowed !== true ||
      a.photoBindingVerified !== true || a.mediaOwnershipVerified !== true ||
      !positiveVersion(a.rowVersion) || !positiveVersion(a.authorizationEpoch) ||
      (context.expectedRowVersion !== undefined &&
        (!positiveVersion(context.expectedRowVersion) || context.expectedRowVersion !== a.rowVersion)) ||
      (context.expectedAuthorizationEpoch !== undefined &&
        (!positiveVersion(context.expectedAuthorizationEpoch) ||
         context.expectedAuthorizationEpoch !== a.authorizationEpoch))) return null;

  if (w.kind === 'OriginalCompetition') {
    if (!uuid(w.entryId) || !same(w.frozenEntryRevisionId,w.photoRevisionId)) return null;
  } else if (Object.hasOwn(w,'entryId') || Object.hasOwn(w,'frozenEntryRevisionId')) {
    return null; // A PostEvent has no competition entry, rank or award.
  }

  // SQL grant_policy_version is an opaque TEXT identifier (1..80 code units).
  // It is NOT the positive integer revision used by WEB245's imageGrant mock.
  // Never Number()/parseInt() or imply the two fields share a version domain.
  if (!policyId(g.policyIdentifier) || !positiveVersion(g.consentEventVersion) ||
      g.consentEventVersion > a.rowVersion ||
      !['accepted','withdrawn'].includes(g.state) ||
      !same(g.workId,w.workId) || !same(g.mediaId,w.mediaId) ||
      g.creatorSelfCaptureDeclared !== true || g.explicitGrantAccepted !== true ||
      !Array.isArray(g.scopes) || g.scopes.length !== PRIVATE_OWNER_GRANT_SCOPES.length ||
      !g.scopes.every((v,i) => v === PRIVATE_OWNER_GRANT_SCOPES[i])) return null;

  if (!PRIVATE_OWNER_CONTROL_STATES.includes(d.controlState) ||
      !PRIVATE_OWNER_PURGE_STATES.includes(d.purgeState) ||
      typeof d.publicDisabled !== 'boolean' ||
      typeof d.providerVerificationAccepted !== 'boolean' ||
      typeof d.purgeScopeComplete !== 'boolean' ||
      typeof d.legalHold !== 'boolean' ||
      ((d.controlState === 'withdrawn' || d.controlState === 'delete_requested') &&
        (!d.publicDisabled || g.state !== 'withdrawn')) ||
      (d.controlState === 'delete_requested' && d.purgeState === 'not_requested') ||
      (d.purgeState !== 'not_requested' && d.controlState !== 'delete_requested') ||
      (d.purgeState === 'verified' &&
        (!d.publicDisabled || !d.providerVerificationAccepted || !d.purgeScopeComplete || d.legalHold)) ||
      (d.purgeState !== 'verified' && (d.providerVerificationAccepted || d.purgeScopeComplete))) return null;

  const mediaPurgeVerified = d.purgeState === 'verified' && d.providerVerificationAccepted &&
    d.purgeScopeComplete && !d.legalHold && d.publicDisabled;
  const purgePresentation = mediaPurgeVerified ? 'MEDIA_PURGED' :
    d.publicDisabled ? 'PUBLIC_DISABLED' :
    d.purgeState === 'requested' ? 'REQUESTED' :
    d.purgeState === 'provider_pending' ? 'QUEUED' :
    d.purgeState === 'provider_reported' ? 'PROCESSING' : 'NOT_REQUESTED';

  // Read-only, non-rendered normalized contract. No URL, Storage key, media
  // bytes, provider digest, JWT, raw owner Account, or mutation capability.
  return Object.freeze({
    contractVersion: PRIVATE_OWNER_CONSUMER_CONTRACT,
    workId:uuid(w.workId), creatorProfileId:uuid(w.creatorProfileId),
    kind:w.kind, challengeId:uuid(w.challengeId),
    photoRevisionId:uuid(w.photoRevisionId), mediaId:uuid(w.mediaId),
    conceptRevisionId:uuid(w.conceptRevisionId), conceptText:w.conceptText,
    isCompetitionEntry:w.kind === 'OriginalCompetition',
    rowVersion:a.rowVersion,authorizationEpoch:a.authorizationEpoch,
    imageGrantState:g.state,grantPolicyIdentifier:g.policyIdentifier,
    consentEventVersion:g.consentEventVersion,
    controlState:d.controlState,purgeState:d.purgeState,
    publicDisabled:d.publicDisabled,mediaPurgeVerified,
    purgePresentation,legalHold:d.legalHold,
    actionsEnabled:false,publicDetailEnabled:false,mediaSigningEnabled:false
  });
}

// CAS is an expected Work row_version, NOT a safe client-side increment.
// 409/412 means discard optimistic state and re-fetch a new authenticated
// owner snapshot before manually retrying; never auto-replay a mutation.
export function classifyPrivateOwnerServiceOutcome(httpStatus) {
  if (httpStatus === 409 || httpStatus === 412)
    return Object.freeze({status:'REFRESH_REQUIRED',clearPriorSnapshot:true,autoRetry:false});
  if ([401,403,404,410].includes(httpStatus))
    return Object.freeze({status:'BACKEND_UNAVAILABLE',clearPriorSnapshot:true,autoRetry:false});
  if (httpStatus === 200 || httpStatus === 201 || httpStatus === 204)
    return Object.freeze({status:'AUTHORITATIVE_REREAD_REQUIRED',clearPriorSnapshot:true,autoRetry:false});
  return Object.freeze({status:'BACKEND_UNAVAILABLE',clearPriorSnapshot:true,autoRetry:false});
}

// Prepared CAS values are diagnostic contracts only, not an executable
// command plan. The server must recheck owner, revision, epoch, grant, incident,
// privacy and mutable state within its transaction.
export function describePrivateOwnerCas(snapshot, action) {
  if (!record(snapshot) || !['grant','concept','withdraw','delete'].includes(action) ||
      !uuid(snapshot.workId) || !positiveVersion(snapshot.rowVersion) ||
      !positiveVersion(snapshot.authorizationEpoch) || snapshot.actionsEnabled !== false)
    return {status:'BACKEND_UNAVAILABLE'};
  return Object.freeze({
    status:'BACKEND_ACTIVATION_WAIT',workId:snapshot.workId,
    expectedRowVersion:snapshot.rowVersion,
    expectedAuthorizationEpoch:snapshot.authorizationEpoch,
    operation:action,executable:false
  });
}

// Deliberately no transport argument, fetch, RPC path, session token, or
// activation switch. The accepted Source149 private SECURITY DEFINER RPCs
// are REVOKE ALL, not callable from this browser.
export function createPrivateOwnerServiceConsumer() {
  return Object.freeze({
    capabilities:PRIVATE_OWNER_CAPABILITIES,
    async read() {return Object.freeze({status:'BACKEND_UNAVAILABLE',snapshot:null});},
    async mutate() {return Object.freeze({status:'BACKEND_UNAVAILABLE',persisted:false});}
  });
}
