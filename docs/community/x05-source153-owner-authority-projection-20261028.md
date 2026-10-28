# Source153 — Authoritative Owner Authority Projection (v2 Consumer Target)

Status: DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC_DISABLED. This is NEW ONLY SQL153 and one authenticated Owner Edge operation on frozen Source152 Owner HEAD \`96f92a00e8a0c34983026b602c39557f651f8c47\`; previous FULL152 PR263/QR264 independent source/local pass remain UNCHANGED. No new Creator/Work/Media/Policy table or external Provider calls. Not a public Media publisher or signed JWT runtime proof.

## Wire

\`POST /functions/v1/community-dreamsnap-owner\`
\`\`\`json
{"operation":"authority","workId":"<uuid>","expectedRowVersion":1,"expectedAuthorizationEpoch":1}
\`\`\`

Last two CAS expectations optional, but when provided must match current Source149 control. No account ID, subject ID, MediaID, CreatorID, permission flag, Policy version or bearer in JSON. Existing Source150 Edge \`withSupabase(auth:user)\`, verified JWT subject/session/iat, \`community_authorize_session\`, anon-key PostgREST forwarding unmodified. New public \`community_dreamsnap_x05_owner_authority_v2(uuid,bigint,bigint)\` is authenticated EXECUTE only, direct anon/service_role denied; uses \`private.dreamsnap_x05_verified_db_subject_v1()\` and active Identity/Account/Privacy DB binding. Existing \`read\` and service@1 response unchanged, separate explicit outer \`contractVersion:"wand.dreamsnaps.owner-authority-projection@1"\`. Private,no-store,max-age=0; CDN/Surrogate no-store; Vary Authorization,Origin; no error details leaked. \`operation:"authority"\` is READ-ONLY. No GUI capability enabled.

Proposed positive source-local DTO (only after actual recorded Consent; no Policy approved in production):
\`\`\`json
{
 "contractVersion":"wand.dreamsnaps.owner-authority-projection@1",
 "consumerTarget":"wand.dreamsnaps.private-owner-consumer@2",
 "work":{"workId":"UUID","creatorProfileId":"UUID","challengeId":"UUID",
  "kind":"OriginalCompetition|PostEventCreation","photoRevisionId":"UUID",
  "photoMediaId":"UUID","currentWorkRevisionId":"UUID",
  "entryId":"UUID (Original only)","frozenEntryRevisionId":"UUID (Original only)"},
 "authority":{"ownerAuthorized":true,"authenticatedAccountBound":true,
  "activeIdentityVerified":true,"creatorOwnerVerified":true,
  "workPhotoBindingVerified":true,"mediaOwnershipVerified":true,
  "mediaReady":true,"rowVersion":1,"authorizationEpoch":1,"controlState":"consented"},
 "grant":{"mediaId":"UUID","photoRevisionId":"UUID",
  "creatorSelfCaptureDeclared":true,"explicitGrantAccepted":true,"consentRecorded":true,
  "lastGrantConsentRevision":1,"policyVersionText":"opaque text",
  "policyDigest":"sha256","state":"recorded|withdrawn",
  "policyReceiptVerified":false,"scopeStatus":"UNVERIFIED",
  "publicUsageAuthorized":false},
 "deletion":{"controlState":"consented","localState":"PUBLIC_DISABLED",
  "publicDisabled":true,"activeAccountLegalHold":false,
  "localProviderReceiptVerified":false,"localProviderScope":"SINGLE_FROZEN_MEDIA_RECORD",
  "providerStatus":"not_requested","globalPurgeScopeComplete":false,
  "cloudCdnIssuedBearerStatus":"UNKNOWN"},
 "externalEvidence":{"signedRuntimeSessionVerified":false,
  "storageProviderObjectVerified":false,"officialChallengePhaseVerified":false,
  "cloudCdnPhysicalPurgeVerified":false,"publicActivationAllowed":false},
 "capabilities":{"ownerActionsEnabled":false,"publicDetail":false,
  "publicMedia":false,"publish":false,"mediaSigner":false}
}
\`\`\`

Notes: Response \`entryId/frozenEntryRevisionId\` ABSENT for PostEvent including replay (jsonb_strip_nulls), Original only real Wand-native entered/eligible Entry tied to SAME immutable frozen revision, not official DDV submission. \`lastGrantConsentRevision\` is last Source149 action=grant event_version, independent of current rowVersion/authorizationEpoch; after withdraw row2/authEpoch2 with consentRevision1. Current WorkRevision equals control concept_revision_id, but immutable frozen photograph may differ from concept. Separate local snapshots always revalidated; stale supplied CAS values reject, never auto retry.

## Authority matrix and trust limits

| Field | DB authority | Evidence category |
| --- | --- | --- |
| authenticatedAccountBound, ownerAuthorized | verified JWT subject/iat/session_id + Source150 verified_db_subject_v1, active auth_identities, wand_accounts, Source149 Owner Control + community_works, privacy barrier | source DB + simulated JWT GUC; signed real remote Runtime UNKNOWN |
| Creator/Work | community_entities, creator_profiles, community_works, dreamsnap_works and Source149 control; managedUnder13 false | direct same Work authoritative joins |
| Entry ID / no Entry | dreamsnap_entries real frozen same Work+account+revision; Source148 private STAGED without Entry nor public gallery | DB source only; NOT actual DDV official entry |
| WorkPhoto+Media | community_work_revisions + dreamsnap_work_revisions + work_revision_media role dreamsnap ordinal0 + media_assets SAME frozen Work+Owner; Source149 frozen_media_id; R19 preset incident suppression | DB reference, not external Storage physical content |
| rowVersion/authEpoch/controlState | Source149 private dreamsnap_x05_work_control_v1 | commit/snapshot CAS, no browser permission |
| grant.mediaId, explicit selfCapture, consent | Source149 frozen media + creator_self_capture_declared; actual latest GRANT consent_events action=grant account/version/digest and Source150 Owner Action enforces explicit grant accepted true | recorded SQL grant, separate from external/licensor permission |
| Policy version/digest/scope | existing Source150 owner_policy_v1 ACTIVE and Source151 immutable canonical receipt exact UTF8 SHA256/approval timestamp/purpose | \`scopeStatus=APPROVED_CANONICAL_RECEIPT\` ONLY for actual registry evidence, otherwise UNVERIFIED/zero scopes, always publicUsageAuthorized=false. No Source149 hardcoded CDN/display scope projected as unconditional licence |
| local legal hold | private.account_retention_holds live legal rows; no detailed reason leaked | local account scope, not CDN |
| deletion state | Source149 purge_tracking, media_assets purged_at, current Work visibility, Account retention hold, local verified provider receipt | SINGLE_FROZEN_MEDIA_RECORD only; NEVER global Provider+Cloud+CDN/old issued URL purge |
| incident | Source R19 preset_storage_work_quarantined_r19/media_quarantined_r19; fail-closed if true | local incident source; injected predicate test is *simulated incident*, no Provider incident claimed |
| external operation authority | **none** | real signed JWT Stage, Storage bytes, CDN/Cloud, actual official DDV Phase, Owner-approved literal Policy, physical erase ALL NEED_RUNTIME/NEED_OPERATOR |

## Mandatory unproved/disabled cases

Production Policy Registry EMPTY; Japanese v1 candidate sha256 \`2c4e78e46345a3d230a304d74086aa49b66700396acca91bf6280cd6f938d0cb\` approved=false. Existing Source151/150 immutable receipt is proof only when genuinely approved exact text exists. A synthetic CI-only receipt is never real approval. No licence scopes before approved receipt; even after receipt this DTO never grants public publication, Media signer, CDN access or positive owner GUI actions.

Source152 stores prepopulated synthetic READY Media in local tests: DB ownership is not Storage/Provider authenticity. Source150 \`physicalPurgeVerified\` local single-media is not full Provider+Cloud+CDN/issued signed bearer erasure, and output \`globalPurgeScopeComplete=false\` must not be upgraded. User AccountID intentionally omitted; versioned v2 WEB Consumer must use \`authenticatedAccountBound\` and avoid browser actorAccountId. Existing WEB252 Source150 adapter \`NEED_BACKEND_PROJECTION\` remains correct for @1. An actual v2 WEB decoder must separately independently validate this exact contract and keep all capability OFF until approved Policy, Media and signed Runtime. No pregrant authority replacement before initial consent: Source151 PreGrant remains separate state(0,0).

No P01–P03 legal re-review or new Disney/Gameloft approval search. All existing Public, Publisher, Signer and Native Writer surfaces unaffected.
