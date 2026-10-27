# DDVRE — 09 INT Provider B Shared Issuer Graph and Failure Integration Contract (03 COMM Handoff)

**2026-10-27 | DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY | no positive Publisher or physical cleanup.**
This is the bounded next independent 09 INT task. Do not repeat accepted Source142 PR #187 local SQL guard, Source141 #184 historical RED, QR #185 or Source134–142 accepted tests. New findings must be evidence-classified, not mechanically promoted to Provider acceptance.

## 1. Pinned owner baseline / boundaries

03 COMM Owner PR #134 frozen functional Source142 HEAD 0b90e6681507a20c5cfa637752fb6c5a575c5d06; CI40295103790 and local142 bootstrap40295103855 SUCCESS. Docs-only Owner Packet at [Provider B Owner Decision Packet](provider-b-immutable-object-authority-decision-packet-20261027.md). Prior Source137 strict versioned Copy driver is capability-blocked on Supabase, no truthful object VersionID. SQL gated positive only synthetic ROLLBACK. No new source migration, positive attestation RPC, service_role write grant or real Provider upload allowed here.

Staging last read-only historical116 managed/21 Edge/7 Cron with active Legacy Generic14, distinct Scene1, Retention6 Copy/Remove. Source-only ACL revocation is NOT a deployed barrier. Operator #130 human Gate A/B/C remains NO-GO unless separate named approval actually obtained and independently read back. INT can do bounded static source and trusted read-only manifest/call-graph work; remote tests only after authorizations.

## 2. Release-critical shared issuer/capability closure

Construct a version/build-scoped machine-readable **authority map** with one row for each path: system, source and active Stage bundle/SQL identity, actor credential, bucket+key namespace (anonymized), storage method, RLS/service_role/SQL-definer bypass, exact HTTP/RPC trigger and dependency, condition/precondition, capability (INSERT/UPDATE/DELETE), LeaseFence/Reservation linkage, current+historic Reference graph involvement, deployment/runtime status, evidence (observed/documented/unknown).

**Minimum source candidates, not an exhaustive list:**
- Two competing writers: wep-preset-artifact Generic Artifact v14, wep-scene-preset-product v1; both same deterministic published namespace and pre-SQL Copy with failed-SQL remove and distinct Scene SQL issuer.
- wep-preset-retention v6 worker, account/Creator media retention, async cleanup/cancellation, alternate direct Storage CRUD, compensation and old Cron invocations.
- SQL triggers, SECURITY DEFINER functions, direct service_role publish/delete/retire/Scene, WEP source-only aliases and all deployed Stage-only RPC signatures; Source Registry 18 writer families is not all-system proof.
- S3 PutObject/CopyObject/Multipart and REST Standard/TUS/Upload/Move/Copy signed-object ingress; private bucket direct ACL and privileged credentials; reuse of issued upload URLs.
- Community Gallery public/owner Media, Gateway, legacy direct Media SQL signers, DreamSnaps Judge signer, Scene/Cloud signed media URLs, old issuer fallback, event consumers, all current/historical Preset/Gallery/Scene/Cloud links, retention/legal/privacy/moderation duties.
- Authorized operators/break-glass and storage policies. Their unscoped bypass prevents a provider-enforced global immutable promise unless independent governance, audit and read-denial/quarantine prove acceptable. Do not claim WORM from a partial app-level issuer list.

Classify each row SOURCE_PRESENT_ENROLLED, SOURCE_PRESENT_FAIL_CLOSED, STAGE_ACTIVE_OLD, PRIVILEGED_UNKNOWN, NOT_FOUND_SUPPORTED_EVIDENCE, or NEED_RUNTIME. Missing a dependency produces graphComplete=false and Provider B NO-GO. Confirm staged actual manifests read-only if approved, but do not dispatch an Edge, ACL change, SQL DML or Storage Probe.

## 3. Database–Provider ordering and retry model to prove

Logical immutable identifiers: active Account+Creator+actor session, request hash/idempotency key, ReservationID, monotonic LeaseFence, StateVersion, never-reused Published Key and verified Staging SHA256+Size. Source ETag only equals an opaque precondition token, not VersionID or byte SHA. No external Storage call can be serialized by a PostgreSQL row lock alone.

Expected transitions (all positive are **DESIGN HYPOTHESIS** pending real Provider + new reviewed implementation):
- Prepared/Reserved: one intended owner/request/digest; same idempotency reuses reservation only if exact request, different hash terminal; key never recycled.
- Claimed: monotonic Fence and valid lease, graph state pinned, privacy/moderator/Creator/Account checked; other/wrong/stale requests terminal.
- SourceRead: conditional full actual Staging bytes hash/size against reservation and source-writer immutable guarantee. Changed Stage or ETag ABA => deny. Caller does NOT issue Copy of mutable source later.
- CreatedUnknown: after upload timeout/5xx or ACK loss, physical winner unknown; independent verifier + reservation ownership needed, never blindly retry overwrite/adopt.
- CreatedUnattested: one no-upsert winner exists; independent second reader SHA+Size needed; no SQL positive rights.
- VerifiedCandidate: independently attested exact bytes and issuer/lease/fence, still cannot become published when issuer catalog incomplete or new incident exists.
- CommitCandidate: SQL lock all-fence Incident/current+history/Cloud/Creator+Work and idempotent receipt; release private gate remains OFF. Commit could write Blob, Work, immutable Revision, Publication, Search, Outbox, Idempotency in one SQL TX only after approved independent proof; two resources never a shared ACID transaction.
- Quarantined: stale lease after physical upload, unknown ACK winner, SQL transaction fail after create, postcommit missing/drift, another actor attempts overwrite or removal, or Reporter commits new Incident after positive. No physical delete or automatic false success.

**Exact independent interleavings** to inspect at source/model level now, real gated only after Operator:
I01 Generic A vs Scene B on same key with different request and both leases; one create winner but cannot authorize another request.
I02 Same request same idempotency and completed replay before/after Source138 old/new Fence Incident; already-completed response must be vetoed when quarantined.
I03 Reporter inserts Incident concurrently with Commit; reporter-first blocks commit, commit-first then reporter suppresses new readers and search without time-travel promises.
I04 Lease expiry during conditional Stage GET, after upload and before DB Commit; bytes may exist but no old-fence commit.
I05 Storage success + DB failure; no compensating Remove/Storage Copy, preserve orphan and failed SQL zero new Revision/Outbox/Search.
I06 DB commit success + missing/modified Provider bytes; new guarded readers deny; old bearer still possibly retrieves cached bytes. Never physical 'repair' by overwrite.
I07 ACK-loss after succeeded create and after request failed before create; outcome unresolved, no false success, exactly-one future idempotency outcome only after independently attested winner.
I08 Different key aliases generic/scene/Cloud/Media with shared physical or logical references; no direct SQL bypass / unintended deletion.
I09 Privacy suppression, Retired Identity, Creator reassignment, moderator restrictions, legal holds before/during commit; phase1 read suppression not conflated with disposal.
I10 Provider object overwrite/delete privileged route after independent byte attestation but before SQL Commit; without globally immutable policy => versionless model is REJECTED.

## 4. 09 INT ownership vs 04 QR and Gate B approval

09 INT deliverables BEFORE Operator B:
1. Version-pinned issuer capability and provenance graph for *both Source142 and Stage116* with UNKNOWN markers; do not infer Stage parity from Source CI.
2. Actual SQL transactional negative proof only where NEW DELTA and source-only can be independently exercised; inherited Source142 accepted facts cited, not rerun. If impossible to exercise without new positive route, report DESIGN HYPOTHESIS.
3. Composable test oracle for QR-B03/04/06/07/08/09/12 in [QR Gate B acceptance](provider-b-04qr-independent-real-storage-acceptance-20261027.md), using evidence shape (identity, lease, expected status, physical object digest, DB rows/search/outbox, incident, cache, actor).
4. Ordered human Gate A and B dependency list: no Stage operations until approved, exact allowed disposable key and privileged issuer list, failclosed rollback.

Independent 04 QR owns actual signed authorized Actor/Storage E2E, independent externally downloaded SHA256+size, issuer-negative cross-protocol and CDN t0/60/300/expiry. INT independently checks manifests, collisions/interleavings and DB consistency; passing a local source model cannot fulfill QR real-provider acceptance.

## 5. NO-GO/rollback and acceptance definition

Any unknown privileged route, stale complete Writer Inventory, privilege that allows another PUT/Copy/Move/Delete to winner key, ineffective source freeze/ABA, spoofable independent receipt, Content SHA mismatch, stale-fence commit, double idempotency, incident replay bypass, physical compensation delete, legal/privacy/Cloud reference gap or ambiguous cross-system failure implies **CAPABILITY_BLOCKED**. Upon an authorized test failure, stop ingress, preserve active failclosed barrier and physical orphan/backup, append report and escalate to Operator. Do not roll back to old unsafe worker, delete a Published key, or claim SQL ROLLBACK restored bytes.

**Return classification:** CONFIRMED SOURCE/LOCAL | CONFIRMED DOCUMENTED API | DESIGN HYPOTHESIS | UNKNOWN | UNSUPPORTED | REAL-PROVIDER-PASS (only with QR signed evidence) | REAL-PROVIDER-FAIL. Project flags stay graphComplete=false, SOURCE_FULLY_ENROLLED=0, retirementAuthorized=false, saveRevisionAuthorized=false, pairedGalleryPublishAuthorized=false, physicalCleanupAuthorized=false. Positive Preset/Gallery/Scene, Incident Resolution, physical cleanup, Cloud Restore and Native DDV writer/Apply OFF. PRs Draft DO_NOT_MERGE/DEPLOY; R17 30 PASS0/PARTIAL12/BLOCKED18, NO formal Release R18/R19.
