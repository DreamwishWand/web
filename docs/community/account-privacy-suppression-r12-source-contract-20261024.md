# DDVRE / 03 COMM — R12 Privacy Suppression Source Contract

Date: 2026-10-24. Scope: existing Draft PR #134, issue #139; shared issue #119.
**DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.** Target native version stays Switch 1.25.0, BID 52BD625D9B4E0053, profile schema 624; Switch 1.25.3/schema 626 writer and all native Apply OFF.

## 1. Defect and narrow source correction

R12 independently proved that the original `community_tombstone_account` RPC with a synthetic recent Supabase session and an owned published Gallery Photo attempted bulk `community_works SET lifecycle_state='deleted',visibility='private'`. Gallery Cloud Preservation rejected with `GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED`; the whole transaction rolled back, including identity/public privacy state. The safety guard is **preserved**. The owner can no longer truthfully call the old operation successful account erasure in that state.

New ordered source migration `20261025002600_account_privacy_suppression_barrier_v1.sql` introduces `private.account_privacy_suppressions`, PK `account_id`, durable `suppressed_at`, `suppressed_cleanup_pending` or `cleanup_review_required`, retry counters, next due, error code, update time. No raw provider subject or Storage URL is stored in the queue. PostgreSQL RLS is enabled; public/anon/authenticated/service_role have no direct table access. Neither this migration nor the Edge handler performs physical object deletion, Cloud restoration, Gallery lifecycle retirement, Creator unlinking, receipt deletion or entitlement modification.

`public.community_request_privacy_suppression_v1(auth_subject,session_id,issued_at,DELETE)` is service-role-only with a verified Edge JWT-subject/session input. It rechecks the account/active identity, real `auth.sessions` owner/session creation freshness, expiration and session invalidation; serializes the request on the account delete advisory key + account row; inserts the durable suppression row idempotently, deletes disposable Search index rows for the owner, emits one deduplicated Outbox event and one audit record. `community_tombstone_account` is retained as a compatibility signature **delegating to suppression ONLY**: it now reports `privacyState=suppressed_cleanup_pending` and `fullDeletionComplete=false`. Edge `community-account` invokes the new RPC after `withSupabase(auth:user)` and signed identity/session claims, without an earlier normal account authorization check that would falsely block idempotent retry.

## 2. Read and new-write guard matrix

- `private.is_discoverable_work`: owner suppression denies any public Work, even if a delayed/legacy writer leaves `published/public` and Search/Outbox materialization unchanged. This is the canonical public Work read-time fence.
- `private.can_access_work`: disallow public/unlisted access and former-owner regular access; preserve staff investigation. Public Creator projection and Creator RLS deny public suppressed owner profile. `community_search_public` explicitly checks discoverability, including for service-role callers that bypass RLS. Search-document cleanup is a best-effort immediate projection purge, **not** the authority.
- `private.resolve_active_account`: all normal owner session/command helpers consulting it reject a suppressed account. Signed account-deletion retry instead uses the dedicated recent-session RPC. Community/WEP/Gallery Media Edge handlers' existing `community_authorize_session` gate invokes normal account resolution and denies subsequent owner actions.
- `community_works` positive guard: suppressed account cannot INSERT a new Work, change a currently public/unlisted Work pointer or transition into discoverable state. Negative emergency moderator restriction (moderation state clear→restricted) remains possible; unrelated Work graph and historic Cover are not modified.
- Current Gallery media public reader already delegates `private.is_discoverable_work`, preventing new authorized current media reads/issuance. Other service/public Media issuance routes and DreamSnaps projections require exhaustive runtime route audit (see outstanding gates); previous issued bearer URL/CDN cannot be declared revoked.
- No public SQL new grant to the Scene paired revision candidate; Gallery/Cloud safety, all type-specific Writer gates and physical TTL remain unchanged.

**Important:** the privacy migration cannot prove that every conceivable historic SECURITY DEFINER reader, older deployed Staging function, or raw expired/unexpired signed bearer is suppressed. Route inventory and signed Staging denial tests are release blockers; `publicReadsSuppressed` in source RPC means the enumerated *source* read surfaces, not a certified deployed/public privacy SLA. No production feature flag is promoted.

## 3. State machine

| Stage | Durable storage | Public read | Cleanup/retention | Authority |
|---|---|---|---|---|
| ACTIVE | no row | existing visibility controls | regular | normal owner account |
| SUPPRESSED_CLEANUP_PENDING | privacy row + original Work/Media immutable links retained | denied by canonical new read guards | pending, no physical deletion | recent authenticated DELETE |
| CLEANUP_REVIEW_REQUIRED | privacy row retained | still denied | operator decision / retries with hold constraints | future audited internal worker (NOT wired) |
| CLEANUP_COMPLETE | **NOT IMPLEMENTED** | denied | Cloud, Media, provider identity and legal retention require approved, atomic reconciler | Privacy/Legal/Ops + full graph |

On partial failure *before* barrier commit, the DB rolls back the entire privacy request; an authorized owner can retry. On success, a replay returns the original `suppressedAt` and does not double-insert Outbox/Audit. Cleanup failures after success MUST NOT remove the suppression row or reenable public reads. The pending table tracks next attempt, but no destructive worker, terminal completion or provider identity cleanup is authorized by this change. The old account deletion RPC is no longer a truthful signal of full erasure. User notification/retention period, provider identity revocation, privacy access requests and CDN bearer disclosure require explicit Product/Privacy/Legal/Ops approval.

## 4. R12 source verification boundaries

Added `local-clean-bootstrap-account-privacy-suppression-v1.sql`: disposable synthetic photo Gallery, READY/CLEAR owner media, actual compatibility RPC, invalid other-user session, stale session, wrong confirmation, idempotent retry, unchanged Gallery state/rowVersion, search/public media/creator deny, new write authorization deny, positive republish deny, emergency negative moderation and ACL. Entire SQL fixture rolls back.

Added `tests/comm-privacy-r12-two-session.py`: two distinct local PostgreSQL connections, synthetic signed-session TABLE RECORD (not JWT), account-row lock timeout `55P03` rollback then *fresh transaction*, published Gallery Work lock held while privacy suppression commits independently, delayed positive Work current-revision rewrite denial, search disappearance and replay. Local host/port isolation is hard-coded; no remote DSN accepted. Workflow initializes 114 source migrations from empty then reset/replay, reapplies additive sources, and executes this harness; recorded statuses apply only to the exact run/HEAD.

This is **not** real signed Owner A / non-owner B / Moderator M Staging, byte-equivalent cloud Storage, CDN old-bearer 0/60/300/post, or actual all-type transaction graph proof.

## 5. Scene Revision authority remains split

03 COMM existing DB-only `private.scene_save_revision_paired_candidate_v1` checks Scene identity, caller Gallery/Preset versions/current revision, scoped historical edge SHA, Creator, registered owner ArtifactBlob SHA/size/schemaVersion and READY/CLEAR 1–10 Media/Cover. It remains DB-owner-only INERT with service_role/anon/authenticated EXECUTE revoked.

**For 02 WEP**: pass only the existing offline intent after verified portable Scene Capture/SubGrid and include-roads/fences explicit scope, checksum/byteLength. Proposed authenticated owner request must carry `actor JWT` (backend only), `presetArtifactId`, `expectedPresetCurrentRevisionId`, `expectedPresetWorkRowVersion`, `pairedGalleryWorkId`, `expectedGalleryCurrentWorkRevisionId`, `expectedGalleryWorkRowVersion`, `expectedCreatorProfileId`, `expectedHistoricalEdgeSetSha256` with exact scope, `expectedFullGraphRegistryVersion` + full graph SHA (NOT currently available), registered `artifactBlobId` + actual Storage bytes SHA/size, ordered 1–10 finalized READY/CLEAR `mediaIds` and `coverMediaId`, idempotency key. The old Readiness digest is advisory and MUST NOT be silently promoted to a global fence. Owner API returns `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false` while graph/bytes/actor contracts are incomplete; no new signed Writer Endpoint is enabled.

**For 09 INT**: enroll every Gallery-first, Scene/generic Preset current/history, Photo, Moderation Restore and Account lifecycle under registry-versioned graph, ordered Artifact→PresetWork→GalleryWork locks and fresh whole-transaction retry; emergency read suppression and moderation restrict must not wait for positive Gallery retirement. Storage actual bytes/portable JSON validation alone cannot close all-writer graph.

**For 04 QR R12-QA01..06**: approved disposable Owner A / B / Moderator M, real fresh/stale Auth sessions, owner and Gallery mixed concurrent writers, media/current/historical Work public URL (old bearer at t0/60/300/expiry), synthetic fault + pending repair, outbox/search visibility and privacy read denial. Only genuine signed Staging + independent 2-session acceptance can justify positive release-gate changes.

## 6. Release status

The original R17 remains 30 nodes PASS0 / PARTIAL12 / BLOCKED18. Seven seeding plus Privacy/Legal/Ops gates remain blocked. No positive Gallery Delete/Unpublish/Keep Private/Restore, physical Storage cleanup, Finalized 72h TTL, Scene Owner public writer, DDV Native Writer or Apply, no Production/Staging write, no Draft merge.
