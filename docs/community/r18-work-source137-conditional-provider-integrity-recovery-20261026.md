# DDVRE 03 COMM — R18-work Source137: Conditional Provider Protocol, Integrity Quarantine and Operator Release Gate

**Status: DRAFT / SOURCE ONLY / NOT RELEASE R18 / DO_NOT_MERGE / DO_NOT_DEPLOY.**
Source134 Reservation, Source135 90-second Lease/Fence/readback and gated private synthetic SQL Commit, Source136 dual Publisher terminal denial and historical Scene SQL ACL remain unchanged. This delta **does not authorize any positive public publication, provider attestation or physical deletion**.

## 1. Verified capabilities vs assumptions

**CONFIRMED documented Supabase interface**: storage-js `copy(sourceKey,destinationKey)` sends `POST /object/copy` with bucket/source/destination and no documented destination If-None-Match header, immutable generation binding or independent signed verifier receipt. The Supabase Copy Objects documentation describes source SELECT, destination INSERT and possible upsert when UPDATE is allowed; it is not proof of end-to-end atomic non-overwrite for the deployed WEP bucket. See https://supabase.com/docs/guides/storage/management/copy-move-objects and https://github.com/supabase/storage-js/blob/main/src/packages/StorageFileApi.ts.

**CONFIRMED isolated SOURCE tests (when green):** `supabase/functions/_shared/preset-conditional-provider-r18.ts` is not imported by either deployed Edge Publisher; it defines a conditional immutable provider interface, enforced pre-copy capability checks, version-bound Staging byte SHA/size verification, two authoritative lease callbacks, atomic Copy-if-absent, version-bound Published byte SHA/size reread, and post-Copy Lease check. Every result has `publicationAuthorized=false` and `physicalCleanupAuthorized=false`. Even a valid immutable local binary observation is explicitly `LOCAL_PROVIDER_OBJECT_OBSERVED_UNATTESTED` rather than `PROVIDER_ATTESTED`. There are zero calls to legacy publish, private commit, compensation or physical remove.

**CONFIRMED evidence limits:** pure in-memory CAS tests are **MOCK**. Exclusive `wx`/`O_EXCL` local disk test is **actual isolated filesystem Provider**, not real Supabase Storage, and its `etag`/generation are LOCAL synthetic identities. Neither authenticates a remote Provider issuer nor protects against external Staging writers. The production Provider Copy capabilities, immutability, real ETag semantics, independent receipt and signed actor eligibility remain **UNKNOWN/NOT_EXECUTED**. It is a logical safety/contract proof, not live provider acceptance.

## 2. Shared Generic/Scene immutable object protocol

Both `wep-preset-artifact` and `wep-scene-preset-product` MUST call the same authoritative Reservation and Provider layer before creating a Published object. Scope: Actor + active Wand Account + Creator + idempotency key + request hash + immutable deterministic Published Key. Source135 creates 90-second LeaseToken, monotonic Fence and stateVersion.

1. Validate session/account/creator and exact reservation hash and version in SQL before any Storage action.
2. Demand an **actual provider-enforced** atomic create-if-absent for the destination, immutable source version condition and immutable version-bound read (not a preflight HEAD plus unsafe ordinary Copy). Without all capabilities, `CAPABILITY_BLOCKED` before Copy.
3. Hash *actual* Staging bytes and compare to reserved byteSize/checksum and source version. Revalidate Lease before Copy. The Provider must atomically reject a duplicate key; overlapping Generic+Scene caller cannot upsert, overwrite or remove another winner.
4. Provider returns a specific destination immutable Version/Generation and ETag. Revalidate Lease after Copy and re-download **that exact version**. Check Published SHA256/Size/ETag. A late write after expiry may leave an orphan: its SQL Commit remains forbidden and its object **must not be removed blindly**.
5. Observed bytes and the Provider's returned version remain `EDGE_READBACK_UNATTESTED` / `LOCAL_PROVIDER_OBJECT_OBSERVED_UNATTESTED` until an independent trusted attestor with authenticated issuer, exact content+version, TTL/replay protection and a server-side protected transition is implemented and separately reviewed. Source135's Private Gate remains OFF and its synthetic Postgres-only positive Commit rollback is not counted as Provider evidence.
6. Only after independently attested immutable version and full current+historical graph under-lock reference revalidation, issue gated atomic Source135 Blob/Work/Revision/Publication/Search/Outbox/Idempotency transaction. **That positive transition has NOT been implemented or enabled by Source137.**

## 3. Recovery and Post-Commit Reconciliation

- `CAPABILITY_BLOCKED`, stale lease and modified Staging: terminal no Copy, no SQL and no compensating physical delete.
- `COPY_OUTCOME_UNKNOWN` after timeout or 5xx: Copy MAY have succeeded; quarantine the key, append audited incident, never retry with overwrite or physically delete.
- `DESTINATION_CONFLICT` on same-key concurrent writers: never overwrite or reuse the destination as owner evidence. Require immutable winner identity and actor/idempotency reconciliation with SQL; absent that, remain blocked.
- `LEASE_STALE` after completed conditional Copy: object can be orphaned. Fence blocks Commit; quarantine and preserve possible winner.
- `VERSION_DRIFT`/actual Byte SHA or size mismatch: never elevate attestation; report and suppress future positive attempts until authorized reconciliation.
- **Committed SQL + missing/version-changed Provider object**: `inspectPostCommitObject` returns `POST_COMMIT_MISSING` or version drift, without calling public unpublish/delete, Search suppression or Storage.remove. This case must be propagated to a trusted service reconciliation/safety-response workflow before positive release. Current Source137 offers only owner-scoped incident recording; no autonomous repair or privilege to rewrite historical references.
- New additive Source137 Migration `20261025003010_r18_preset_provider_integrity_quarantine.sql` holds append-only-equivalent immutable **untrusted observations** in private RLS `preset_storage_integrity_incidents_r18`. A service-only `community_preset_storage_report_integrity_r18` checks signed-Edge-supplied Actor → active Account/Privacy, Creator ownership, the Reservation's stateVersion and leaseFence under Account SHARE + Reservation UPDATE. Issues deduplicate per reservation/fence/case. Incident state is permanently `QUARANTINED_PENDING_OPERATOR`; `providerOriginAttested=false`, `publicationAuthorized=false`, `cleanupClaimAuthorized=false`. Ordinary user cannot directly call the SQL RPC; no public Edge route currently calls it. This journal is not independent attestation.
- In the real committed-but-missing case, user-facing published references must eventually be made unavailable under a separately tested moderation/privacy-compatible policy; incident logging by itself is not suppression.

## 4. Cleanup Authority = separate P0

Current Source134 cleanup preflight and all Source135/136 Source Edges/worker keep physical deletion OFF. A future cleanup **eligibility query** and durable **claim** are separate from a provider-conditional physical **remove**. Under Account/Reservation/Work/Revision and provider-generation locks, prove absence of:
- Current and historical PresetRevision/Publication/Artifact and immutable WorkRevision relationships.
- Gallery GalleryRevision, Scene paired links, Cloud Private/Restore/linked snapshots and any other current or historical reference.
- Active Pending/Lease/Reservation or transient Copy; duplicate idempotency requests or same-key alternate Publisher.
- Legal holds, privacy-suppression retention, active moderator appeals, in-flight signed URLs and cached CDN bearer (including t0/60/300s and after expiry).
- Indirect Cron/retention workers and unknown schema references.

Unknown reference => denial. Cleanup Claim must include exact immutable Provider Version, lease fence, expiry, claim ID and audit/outbox. Worker must revalidate all references after claiming and prior to delete; provider must conditional-delete only that version. A 404, stale claim or missing conditional-delete feature cannot be treated as successful physical deletion. No unattended 72h orphan deletion enabled. Privacy Phase1 suppression remains independently available.

## 5. Full issuer/deployment barrier — Human Operator #130

**Source-only changes DO NOT stop historical deployed Staging.** Latest read-only known three ACTIVE WEP issuers:
- `wep-preset-artifact` v14 SHA `fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa` — Generic Copy-before-SQL, failed-SQL Published compensating Remove, staging Discard and post-success cleanup.
- `wep-scene-preset-product` v1 SHA `6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045` — distinct Scene Copy-before-SQL, failed-SQL Published compensation, staging Discard, Scene publish/unpublish/delete RPCs.
- `wep-preset-retention` v6 SHA `675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e` — worker token / claim followed by physical Remove. **All three still ACTIVE historically until exact Staging verified otherwise.**

Also inventory direct Published Blob writes, old Preset Envelope SQL, Scene lifecycle SQL, direct service callers, outbox consumers, indirect 7 Staging Cron registrations, WEP Retention, Cloud/Gallery deletion and CDN URLs. Avoid pretending Gallery MEDIA removal is WEP Preset removal; separate bucket/issuer checks. 21 Staging Edge bundles/7 Cron are an observed historical census, not automatically a complete future issuer proof. Stage managed 116 migrations are NOT a Source137 137-migration prefix.

**Operator-approved step ordering, not a deployment instruction to execute automatically:**
1. Obtain human #130 approval, protected disposable staging environment, signed OwnerA/NonownerB/ModeratorM, privacy/legal holds, exact migration parity plan, backups/PITR and rollback.
2. Freeze **all** Generic+Scene inbound writes, retention/Cron and direct RPC callers together. Drain and attest all in-flight Copy, SQL, compensating Remove, worker jobs; inventory orphan/conflicting destination keys.
3. Replace and verify exact fail-closed Edge/worker bundles and routes; no old Copy-before-SQL/Remove path may remain reachable. Distinguish WEP same-path PR #163 from Owner136; never Whole-file Merge.
4. Apply reviewed compatible SQL/ACL/RLS/trigger changes **after** old Copy/compensation paths are quiesced and verified. SQL revoke first is unsafe because it forces old copied object failure compensation. Verify under protected backup/PITR rollback gate.
5. Independently perform real signed Provider conditional Copy/no-overwrite/version/immutable bytes, stale late attempts, failed SQL/compensation, committed-object loss, graph/moderation/privacy/legal and old signed/CDN URL tests. Positive Source137 has no public route and remains OFF.

## 6. Independent QA matrix and boundaries

- 03 COMM isolated Node tests: Source137 adapter with in-memory MOCK fault injection; true local filesystem exclusive Create (not Supabase) races both aliases and postcommit object loss. No positive DB Writer invoked.
- 03 COMM two **actual isolated PostgreSQL connections**: Source137 private incident SQL ACL, forged Actor, bad fence/version, postcommit-only missing-object classification, same incident idempotent replay, row-lock 55P03, no Blob created, no release gate escalation.
- 09 INT: independently pin exact Owner Source137, test new Provider adapter's destination double-writer conflict, expired late result, crash, missing postcommit, audit transaction and enrolled issuer graph; **no reenactment** of completed Source134/135/136 negatives.
- 04 QR: Source137 independent failure-classification + refusal to attest; signed real Provider and protected Source/Staging semantic parity await Operator #130 and documented conditional/immutable Provider guarantee. Normal signed Actor credentials cannot be simulated with service_role.
- All 03 COMM draft branches DO_NOT_MERGE/DEPLOY; no positive Preset Publish, Cloud/Private Restore, physical cleanup, Gallery retire, paired Scene save, Native DDV Writer/Apply. `SOURCE_FULLY_ENROLLED=0`, `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`, `physicalCleanupAuthorized=false`. R17 ProductTree30 PASS0/PARTIAL12/BLOCKED18 unchanged. **NO formal Release R18**.
