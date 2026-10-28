import { canonicalWorkId, parseTypedWorkQuery } from '../community/typed-work-route.js';

// No public detail, image, upload, publish, signer, or deletion capability is
// wired to this read-only owner preview. Enabling a UI flag cannot grant rights.
export const OWNER_MANAGEMENT_CONTRACT = 'wand.dreamsnaps.owner-management@1';
export const OWNER_MANAGEMENT_ENABLED = false;
export const OWNER_BACKEND_CAPABILITIES = Object.freeze({
  ownerRead: false, createPostEvent: false, editConcept: false,
  acceptImageGrant: false, withdrawImageGrant: false,
  requestDelete: false, verifyPurge: false, publicDetail: false, publicMedia: false
});
export const OWNER_KINDS = Object.freeze(['OriginalCompetition', 'PostEventCreation']);
export const OWNER_ERASURE_STATES = Object.freeze([
  'UNKNOWN', 'NOT_REQUESTED', 'REQUESTED', 'QUEUED', 'PROCESSING',
  'PUBLIC_DISABLED', 'MEDIA_PURGED', 'LEGAL_HOLD'
]);

const uuid = value => canonicalWorkId(value);
const nonnegativeSafe = n => Number.isSafeInteger(n) && n >= 0;
const positiveSafe = n => Number.isSafeInteger(n) && n > 0;
const safeString = v => typeof v === 'string' ? v : '';
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);

// Query is valid ONLY if absent or exactly one Work UUID; never treat EntryID,
// RevisionID, MediaID, creator or mixed/duplicate params as a route.
export function parseOwnerWorkRoute(search = '') {
  if (search === '' || search === '?') return { status: 'draft', workId: null };
  const parsed = parseTypedWorkQuery(search, 'work');
  return parsed.status === 'valid'
    ? { status: 'authority-pending', workId: parsed.workId }
    : { status: 'invalid', workId: null };
}

export function validateOwnerDraft({ kind, challengeId, concept } = {}) {
  const text = safeString(concept).trim();
  if (!OWNER_KINDS.includes(kind) || !uuid(challengeId) ||
      typeof concept !== 'string' || text.length > 2000) {
    return { status: 'invalid', value: null };
  }
  return { status: 'preview-only', value: Object.freeze({
    kind, challengeId: uuid(challengeId), concept: text,
    immutableImage: true, immutableChallenge: true,
    isCompetitionEntry: kind === 'OriginalCompetition',
    publishEnabled: false, persisted: false
  }) };
}

// This is an inert *future* typed adapter, not a backend reader. The accepted
// Source148 PRIVATE/STAGED projection does not authorize this new endpoint.
export function createOwnerManagementAdapter() {
  return Object.freeze({
    capabilities: OWNER_BACKEND_CAPABILITIES,
    async read() { return { status: 'backend-unavailable', work: null }; },
    async write() { return { status: 'backend-unavailable', persisted: false }; }
  });
}

// Strict decoder for future authenticated owner-only responses/mocks. The
// untrusted search/Creator/Saved candidate and session token are not authority.
// Do not return media IDs, storage keys, signer URLs or internal owner IDs.
export function decodeOwnerManagementProjection(data, context) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !context || typeof context !== 'object' ||
      !uuid(context.workId) || !uuid(context.actorAccountId) ||
      !nonnegativeSafe(context.generation) ||
      context.generation !== context.latestGeneration ||
      data.contractVersion !== OWNER_MANAGEMENT_CONTRACT ||
      data.ownerAuthorized !== true ||
      data.accountState !== 'active' ||
      data.identityState !== 'active' ||
      data.privacySuppressed !== false ||
      data.retired !== false ||
      data.moderationAllowed !== true ||
      uuid(data.workId) !== uuid(context.workId) ||
      uuid(data.ownerAccountId) !== uuid(context.actorAccountId) ||
      !OWNER_KINDS.includes(data.kind) ||
      !uuid(data.challengeId) ||
      !uuid(data.creatorProfileId) ||
      !uuid(data.photoRevisionId) ||
      !uuid(data.photoMediaId) ||
      !uuid(data.conceptRevisionId) ||
      !positiveSafe(data.rowVersion) ||
      !positiveSafe(data.authorizationEpoch) ||
      typeof data.concept !== 'string' ||
      data.concept.length > 2000) return null;

  // Competition provenance and Post-Event provenance are mutually exclusive.
  if (data.kind === 'OriginalCompetition') {
    if (!uuid(data.entryId) || !uuid(data.frozenEntryRevisionId) ||
        data.photoRevisionId !== data.frozenEntryRevisionId) return null;
  } else if (own(data,'entryId') || own(data,'frozenEntryRevisionId') ||
             data.hasWandRank === true || data.hasWandAward === true ||
             data.hasCompetitionEntry === true) return null;

  const grant = data.imageGrant;
  if (grant != null && (!grant || typeof grant !== 'object' ||
      !positiveSafe(grant.policyVersion) ||
      !['unrecorded','accepted','withdrawn'].includes(grant.state) ||
      uuid(grant.workId) !== uuid(data.workId) ||
      uuid(grant.photoMediaId) !== uuid(data.photoMediaId) ||
      !positiveSafe(grant.revision))) return null;

  const erasure = data.erasure;
  if (erasure != null && (!erasure || typeof erasure !== 'object' ||
      !OWNER_ERASURE_STATES.includes(erasure.state) ||
      !positiveSafe(erasure.revision) ||
      typeof erasure.publicDisabled !== 'boolean' ||
      typeof erasure.physicalPurgeVerified !== 'boolean' ||
      (erasure.state === 'MEDIA_PURGED' &&
        (!erasure.publicDisabled || !erasure.physicalPurgeVerified)) ||
      (erasure.state !== 'MEDIA_PURGED' && erasure.physicalPurgeVerified))) return null;

  return Object.freeze({
    kind: data.kind,
    workId: uuid(data.workId),
    challengeId: uuid(data.challengeId),
    creatorProfileId: uuid(data.creatorProfileId),
    concept: data.concept,
    rowVersion: data.rowVersion,
    authorizationEpoch: data.authorizationEpoch,
    originalImageImmutable: true,
    challengeImmutable: true,
    hasCompetitionEntry: data.kind === 'OriginalCompetition',
    imageGrant: grant == null ? 'UNKNOWN' : grant.state,
    imageGrantVersion: grant?.policyVersion ?? null,
    erasureState: erasure?.state ?? 'UNKNOWN',
    publicDisabled: erasure?.publicDisabled === true,
    mediaPurgedVerified: erasure?.state === 'MEDIA_PURGED' &&
                         erasure?.physicalPurgeVerified === true,
    // Backend capability and runtime operator acceptance are both absent.
    actionsEnabled: false
  });
}
