# DDVRE — 08 WEB CTRL43 / Source153 Owner Consumer v2 strict decoder

Status: DRAFT, DO_NOT_MERGE, DO_NOT_DEPLOY, LIVE_BACKEND_DISABLED. This is the **existing 08 WEB workstream**, not a new product or a replacement of accepted WEB248/252/254.

## Exact accepted sources and branch isolation

- 03 COMM Source153 [Owner PR265](https://github.com/DreamwishWand/web/pull/265) frozen HEAD `b24eec2cb4dae4ab30824636670c520d7c6eea40`, SQL `supabase/migrations/20261028000060_x05_authoritative_owner_projection_v2.sql` blob `356cc10138cd351674fde8dd943acc968e26fbbc`, authenticated Owner Edge blob `38f6830b88eb37dc612cbc11901812a90b406146`. Owner ordinary CI40706085216 and actual FULL153 two-PG CI40706085390 SUCCESS; inherited historical generic fixed-count workflow40706085386 fails, not Source153 logic verdict.
- Independent 04 QR [PR266](https://github.com/DreamwishWand/web/pull/266) final HEAD `f508475e4a13272ef6d33f0111590c55a7e2aa2f`, fixed direct base Source153 Owner HEAD above, ordinary [CI40711632239](https://github.com/DreamwishWand/web/actions/runs/40711632239) and actual independent three-PG [CI40711632062](https://github.com/DreamwishWand/web/actions/runs/40711632062) SUCCESS. Source-local independent PASS only; injected incident is synthetic R19 predicate override inside rolled-back transaction. No signed real JWT/Stage, Provider actual upload/readback, approved literal Owner Policy, global Provider+Cloud+CDN deletion, public Work Detail, publish, signer or native Apply acceptance.
- Previously independently accepted FULL152 Owner PR263 HEAD `b9bb5f4eed24f751c6b5e607095fd40e9a62b0e5`, QA PR264 HEAD `edb7940120fa5ab1920dbf516cea0bea6c57ad63`, genuine FULL152 3PG-to-WEB Source/Local PASS. Frozen WEB248/252/254 continue unchanged: WEB248 Consumer@1 source-only proposal, WEB252 strict Source150 service@1 returns `NEED_BACKEND_PROJECTION/snapshot:null/actionsEnabled:false`, WEB254 Source151 initial PreGrant@1 remains inert. Legacy Creator route fix WEB222/QA226 independent real Chrome PASS; do not duplicate.

## Exact Source153 wire, not a new mock authority

Server accepts `POST /functions/v1/community-dreamsnap-owner`, request `{operation:'authority',workId:UUID,expectedRowVersion?:positiveInteger,expectedAuthorizationEpoch?:positiveInteger}`. Verified JWT actor/session is handled server-side, not in the JSON. Response is strictly versioned:

```js
{ ok:true, operation:'authority',
  contractVersion:'wand.dreamsnaps.owner-authority-projection@1',
  data:{
    contractVersion:'wand.dreamsnaps.owner-authority-projection@1',
    consumerTarget:'wand.dreamsnaps.private-owner-consumer@2',
    work:{workId,creatorProfileId,challengeId,kind,photoRevisionId,
      photoMediaId,currentWorkRevisionId,entryId?,frozenEntryRevisionId?},
    authority:{ownerAuthorized:true,authenticatedAccountBound:true,
      activeIdentityVerified:true,creatorOwnerVerified:true,
      workPhotoBindingVerified:true,mediaOwnershipVerified:true,
      mediaReady:boolean,rowVersion,authorizationEpoch,controlState},
    grant:{mediaId,photoRevisionId,creatorSelfCaptureDeclared:true,
      explicitGrantAccepted:true,consentRecorded:true,
      lastGrantConsentRevision,policyVersionText,policyDigest,
      state:'recorded'|'withdrawn',policyReceiptVerified:boolean,
      scopeStatus:'UNVERIFIED'|'APPROVED_CANONICAL_RECEIPT',
      scopeId?,approvedPurposeIds?,publicUsageAuthorized:false},
    deletion:{controlState,localState,publicDisabled,
      activeAccountLegalHold,localProviderReceiptVerified,
      localProviderScope:'SINGLE_FROZEN_MEDIA_RECORD',providerStatus,
      globalPurgeScopeComplete:false,cloudCdnIssuedBearerStatus:'UNKNOWN'},
    externalEvidence:{signedRuntimeSessionVerified:false,
      storageProviderObjectVerified:false,officialChallengePhaseVerified:false,
      cloudCdnPhysicalPurgeVerified:false,publicActivationAllowed:false},
    capabilities:{ownerActionsEnabled:false,publicDetail:false,
      publicMedia:false,publish:false,mediaSigner:false}
  }
}
```

Every top-level/nested field is allowlisted; any extra JWT, raw AccountID, Storage key, URL, unexpected elevated entitlement or missing field is rejected. `work.workId` must equal requested route WorkID (UUID is a locator, *never* an Owner identity assertion). Same-Work Photo/Media/Grant relationships are validated: `work.photoMediaId===grant.mediaId`, `work.photoRevisionId===grant.photoRevisionId`. `currentWorkRevisionId` is current **concept** revision and need not equal frozen PhotoRevision. An OriginalCompetition Work includes a same-photo frozen Entry pair. PostEventCreation must omit Entry properties entirely (not null). All server-sourced true relational flags are checked, but a user-crafted structurally valid DTO remains a mock **until** an independently accepted real authenticated HTTP issuer.

The latest `lastGrantConsentRevision` is the last GRANT event version, separate from Work `rowVersion`, `authorizationEpoch` and SPA `requestGeneration`. E.g. after withdraw Work row2 / epoch2 / lastGrant1. `policyVersionText` is preserved opaque text and never parsed as a numeric revision; no unconditional fixed CDN/display/store/thumbnail scopes. Unapproved `UNVERIFIED` requires absent scopeId/purposes; approved Source151 canonical receipt may carry a single narrowly verified purpose but **does not** authorize public use. The actual v1 Japanese policy is still a CANDIDATE/approved=false, production policy registry is unseeded, and the source-local independent QA uses test-only synthetic policy.

Deletion fields distinguish single frozen Media DB/local receipt from global physical Provider, Storage, Cloud, CDN and previously issued bearer revocation. Even `LOCAL_FROZEN_MEDIA_VERIFIED` cannot set globalPurgeScopeComplete true or present MEDIA_PURGED. Legal hold and local provider status are preserved with external status `UNKNOWN`.

## Decoder and cache/error boundary

`src/lib/dreamsnaps/source153-owner-consumer-v2.js` exports a pure exact-version decoder `decodeSource153OwnerConsumerV2(envelope,context)` and synthetic HTTP classifier `classifySource153OwnerHttpFixture(response,context)`. They do **not** connect to any backend or copy browser actorAccountId into an Owner proof. Successful strict local decoding returns `SOURCE153_SCHEMA_CANDIDATE_ONLY` with a sanitized typed `projectionCandidate` but `snapshot:null`, `ownerReadVerified:false`, `actionsEnabled:false`, `liveBackendEnabled:false`; source proof is not confused with signed authenticated UI authority. This is a standalone v2 model: no imported WEB248 @1 schema, no mutation of WEB252 or WEB254. Scope presentation is an empty list; no owner action, media signer or publisher is activated.

HTTP success requires `Cache-Control: private, no-store, max-age=0`, `CDN-Cache-Control:no-store`, `Surrogate-Control:no-store`, and `Vary:Authorization, Origin`; mock 200 with public/stale/missing headers -> `UNSAFE_CACHE_POLICY`, clearing prior Owner state. 401/403/404/410/503, all other non-200 -> `BACKEND_UNAVAILABLE` / snapshot cleared. 409/412 -> `REFRESH_REQUIRED` / clear previous state, manual fresh authenticated read, `autoRetry:false`. Older SPA response (requestGeneration != latestGeneration) -> `STALE_RESPONSE` before any source decoding. Client route WorkID cannot serve as AccountID.

The new-only Node tests cover valid post-grant Original/PostEvent, last-Grant revision after Withdraw, invalid Work/media cross-bind, unapproved vs approved-looking Policy, unknown Cloud/CDN purge, withheld provider evidence, active/retired false booleans, malformed/overprivileged fields, stale and cache/error cases. A valid-looking same-owner **other** MediaID cannot be detected by a pure decoder if both IDs are substituted together; server-side Source153 real SQL join (independently accepted QR266) is authoritative, but runtime live issuer not yet verified. Never claim all cross-work substitutions are validated in the browser.

## Next independent acceptance

04 QR: verify ONLY new v2 Decoder, its Node fixtures, this contract document and new CI workflow against **exact new Owner HEAD**. No Source153 SQL retest, no WEB245/248/252/254 Chrome replays. 09 INT later integrates independently accepted Source153 server and WEB v2 pure adapter in one pinned additive FULL153 draft with new-only independent QA. Human Operator A0–A7, Provider B, physical Gate C remain NOT_AUTHORIZED. Public launch NO-GO, X05/X07/X08 positive published/detail/rehydrate/share remain blocked.
