# 04 QR / R18-work — Operator-only Atomic-safe Staging Cutover & Incident Recovery

**Status:** DRAFT | CONFIGURATION_BLOCKED | NOT_EXECUTED | DO_NOT_MERGE | DO_NOT_DEPLOY. This is an operator-review procedure, not authorization or an executable deployment. R18-work is not formal Release R18.

**Frozen references:** 03 COMM Owner Source136 PR134 aba2b9e98eebcb445e034215af87ed6c4c2199f5 (CI 40259425017, local PostgreSQL Bootstrap 40259424883 SUCCESS); 09 INT PR164 95c9c03f2095f96a7117290fb8ffb5c7f3753aa3 (CI 40261668656, PG 40261668678 SUCCESS); 04 QR PR165 670b9df356e7d6d14cd6befa8b8db08524af2c05 (CI 40259417528 SUCCESS, actual Source TypeScript with MOCK Admin/Storage). All are source-negative evidence. No actual signed staging Provider or positive publication receipt.

**Read-only deployed state 2026-10-26:** Isolated Supabase Staging ptpdoxhrqopvczpclcij has managed historical migrations 116 (last 20261024043436), 21 ACTIVE Edge, seven ACTIVE Cron. Current old Artifact v14, alternate Scene Product v1 and Preset Retention v6 include physical Copy/Remove paths and SQL service-only RPCs. Source136 has 136 migrations, not a historical116 prefix. Source136 Positive Commit is still private/disabled. The complete immutable deployment SHA and caller matrix is in qr-r18work-staging-issuer-worker-manifest-20261026.md.

## 0. Distinct human approvals

**A = Fail-closed cutover only.** Issue #130 must record explicit named Operator change authority, protected Actions environment, exact project and existing/new version and SHA manifests, reviewed ingress/worker freeze, drain and rollback, complete SQL semantic reconciliation and recovery/PITR/legal hold. A does not authorize positive Publish, cloud/private, physical delete, or signed E2E.

**B = Genuine signed Provider Positive acceptance.** A separate later signoff requires NEW 03 COMM immutable no-overwrite Version/ETag-backed Copy, independently downloaded actual byte SHA256/size receipt, Account/Creator/privacy+lease/fence/atomic DB Commit/Recovery, 09 INT independent verification, and real disposable normal signed A/B/M with explicit consent. No service_role impersonation.

**C = Reference-complete physical cleanup.** Separate human approval after current/historical Preset/Scene/Gallery/Cloud, reservation/lease, legal holds #139, preissued bearer and CDN review. B cannot imply C.

Default all A/B/C = NO. For any uncertain issuer, actor authority, copy in flight, legal hold, project, bundle hash or data recovery: NO-GO, preserve objects and leave protective barrier engaged.

## 1. Immutable preflight evidence and rollback package

Before any change, Operator must create encrypted and access-restricted, secret-free evidence refs (do NOT store secret values in the report):
- UTC date, project identity, all 21 active Edge version and downloaded full bundle SHA256, route/alias map, JWT/worker token modes, frontend and privileged direct RPC entrypoints, seven Cron job IDs/schedules/targets, external webhook/retry ingress, live signed upload/read issuers, Storage bucket policies and object metadata.
- SQL catalog snapshot of every publisher, alternate Scene lifecycle and retention function signature and pg_get_functiondef, EXECUTE grants incl PUBLIC/anon/authenticated/service_role, SECURITY DEFINER call chains, table RLS+policies, UPDATE/INSERT/DELETE guards, triggers, worker claims, indexes/FK, Outbox/Idempotency, reservation/lease references, legal holds. Validate each snapshot fingerprint.
- Actual staging historic 116 migration ledger versus 136 Source SQL. Historical Source135 pairing: 23 exact Version+Name, 107 shared names with 86 version shifts, five Staging-only names (staging_media_bucket, staging_pg_net, staging_remove_pg_net, scene_preset_product_vertical_v1, scene_preset_unattached_media_discard_v1), 28 Source-only names and 4 historical repeated name entries. Source136 adds 03000. Name/version matching is **not** DDL semantic equivalence. Explain every SQL object/regrant before approving a tailored migration; never blindly append 20 files.
- Valid backup/PITR and disposable restoration REHEARSAL for DB, Auth, RLS/grants/trigger, Storage object metadata **and physical bytes**. Database PITR does not necessarily recover overwritten/deleted Storage objects. Pin a consistent checkpoint, retention window, legal holds, recovery target, accountable responder and abort switch. Capture privacy-safe opaque identifiers only: never email, token, signed URL, credential, raw personal media or recovery secret.
- Snapshot current committed/historical Preset, Scene, Gallery, Cloud refs; any pending Copy, orphan, compensation, retention claim, worker lease, queued cleanup or signed-bearer expiry. Declare uncertain references QUARANTINED; no cleanup.

Stage currently service-role EXECUTE for public.community_publish_preset_envelope; community_publish_scene_preset_product_v1; community_unpublish_scene_preset_v1; community_delete_scene_preset_v1. Source R18 Reservation/ReleaseGate/CommitScope and published Blob insertion guard are absent at Stage. Source136 revokes old Scene signatures *in source only*.

## 2. P0 ordering: human-approved global quiescence and drain BEFORE SQL revoke

1. Activate an **external, global ingress barrier** before touching old SQL grants: reject Generic/Scene Preset prepare/publish/discard/compensate/unpublish/delete and all aliases, retries, service RPC callers, legacy webhook/queue publishers, backend workers and physical WEP retention. Restrict specific writers, not unrelated Gallery/Privacy suppression or safe Guide reads. An Edge replacement alone cannot stop old already-admitted requests.
2. Fence claim issuers and reviewed Cron/worker routes. Inspect all seven Cron jobs, particularly 32 provider cleanup, 33 retention and 38 worker-related; log actual worker dispatch identity without exposing worker tokens. Account for previously issued signed upload URLs and valid read bearer tokens: they do not disappear when an Edge deploy occurs.
3. Wait for **durable** zero new admission and zero unaccounted in-flight: Copy initiation/completion, SQL commit/rollback, compensating deletion, staging discard, worker claimed cleanup, DB lock/lease, legacy request replay, pending webhooks and object-version changes. Do NOT assume time-based waiting = drain. Quarantine unknown in-flight objects/request IDs and hold their bytes.
4. On Copy success but SQL failure, **DO NOT** issue physical compensation DELETE. Keep Published key/version for readback and claim review. A stale claimant may not remove a competing successful Publisher's object or any historical reference.
5. Independently sign an ingress/worker/claim quiescence attestation before proceeding. Any unknown alias, uninspectable inflight, unexpired untrusted worker credential or active unsafe replica => NO-GO.

**CRITICAL:** Revoking old Scene SQL RPC EXECUTE FIRST while deployed Scene v1 still handles publish can cause Storage.copy success -> SQL permission failure -> compensating Storage.remove on the shared Published key. This can delete the other Publisher's committed bytes. DO NOT REVOKE SQL FIRST.

## 3. Under barrier: fail-closed Edge and Worker swap before SQL transition

1. Operator selects reviewed Source136 fail-closed bundles for Generic, Scene Product and WEP Preset Retention, and separately classifies community-retention v12 and community-media v16 physical Media delete domains. Protect existing lawful suppression and unrelated approved operations. Confirm all 21 callers/aliases/worker entrypoints including direct privileged SQL routes; unknown writer => NO-GO.
2. While barrier remains ON, replace old physically destructive bundles with reviewed new fail-closed bundles, **without** allowing requests through during partial rolling deployment. Attest exact *deployed* SHA256 and runtime mapping for all replicas and endpoint paths, not only Git SHA or deployment success response.
3. Nonmutating negative live probes must show unsupported old Scene and Generic publish, compensate, discard, delete, unpublish and worker cleanup are denied before physical Storage.copy/remove and before mutation RPC; report zero unintended Work/Revision/Search/Outbox/Idempotency writes. Preserve current/historical and held objects. Ordinary Actor A/B/M probes require separate approved normal signed sessions; until then mark unexecuted, do not fake with service_role.
4. If ANY old bundle instance/alias remains reachable, **ABORT without SQL changes**; retain barrier and recover only fail-closed bundles.

## 4. Reviewed semantic SQL/ACL/RLS/Trigger cutover AFTER Edge attestation

1. First apply exact reviewed transitional plan against disposable **historical116 clone**, preserve real staging-only Scene migration semantics and current object graph. Record old and new function identity/arguments, default grants, RLS, trigger order/behavior, Storage bucket policy, indexes/data backfill, lock/rollback implications. A clean empty Source136 bootstrap does NOT prove safe historic116 upgrade.
2. With independent backup/PITR/Storage restore verified and barrier ON, apply ONLY the approved tailored migration/permission updates in reviewed order. Keep private Source135/136 positive release gate OFF, no new public attestor/commit route, no cleanup claim activation.
3. Revoke all overloaded signatures of the three old Scene lifecycle RPCs, disable old Generic positive writer, ensure private Reservation/ReleaseGate/CommitScope guarded; public/anon/authenticated/service_role must not EXECUTE retired Scene functions. Validate Source136 trigger prevents unreserved Published Blob direct registration. Inspect SECURITY DEFINER and alias caller graph; do not silently weaken RLS or leave an alternate public routine.
4. Read back actual pg_get_functiondef/ACL/RLS/trigger/Edge SHA/route from live project; compare with approved semantic manifest. One mismatch => hold barrier, record incident and fail closed. Confirm all native unrelated reads and Phase1 privacy suppression still work.

## 5. Limited safe reopening; separate Positive and Cleanup acceptance

A success allows **only explicitly unaffected read-only and separately proven safe Community** paths to reopen; keep Preset/Scene Positive Publish, Gallery retirement/Cloud/private, physical cleanup, Scene Save and Native DDV Apply OFF. Keep worker hard gates and monitor post-cutover for failed legacy requests, persistent queues and lease restarts. A is NOT a normal publisher E2E PASS.

Future B, ONLY after new exact Owner Provider contract and separate human signoff:
- Provider-enforced destination-create-if-absent, not a pre-read plus unconditional Copy and not upsert; same-key two Publisher concurrent Copy and no-overwrite proof; immutable exact version/ETag/generation retained in DB receipt.
- Actual signed A/B/M Session/Creator rights, uploaded bytes and independently downloaded actual Published object SHA256 + byte size + contentType; receipt signed by a trusted independent attestor bound to reservation+lease token/fence, Owner/Creator, destination key+version, request hash, TTL and project, not caller-/Edge-self-reported digest.
- Atomic SQL Commit Work/Artifact/Revision/Publication/Search/Outbox/Idempotency with lock/CAS; re-read Provider bytes after SQL commit; replay returns same Work/Revision and no duplicate Outbox; conflicting hash denies; delayed SQL failure must never erase another key winner.
- Crash/Copy-success-SQL-fail/lease-expiry recovery quarantines object (never unsafe compensation remove), verifies immutable version and all historical Preset/Scene/Gallery/Cloud refs and legal holds; Privacy/Retired identity/Moderator exceptions deny correctly.
- Previously issued signed bearer measured t0/t60/t300/post-expiry, CDN warm/cold; never promise immediate revocation of preissued URLs. Preserve secret-free evidence IDs only.
- No actual positive Publish test possible from Owner136 whose public Publish/Commit and attestor are OFF; mark NOT_IMPLEMENTED, no synthetic green promotion.

C physical cleanup remains separately gated by Claim+reference graph+legal hold+version/lease-aware worker+old bearer/CDN acceptance; no physical object removal permitted merely from worker token/DB claim or 72h passage.

## 6. STOP / rollback / PITR / incident playbook

STOP if old bundle SHA, unsafe Copy/Remove while barrier, lost in-flight/lock accounting, old key collision/reference mismatch, ACL drift, new Public privilege, Source↔Stage semantic mismatch, operator consent lapse, missing independent Provider byte receipt, legal hold, failed restore rehearsal or old signed-bearer failure. Freeze ingress and tokens, preserve object bytes/versions and audit evidence; notify Operator, Owner/09 INT, Privacy/Legal #139. Code finding ≠ actual incident.

**NEVER** use rollback to redeploy old destructive Publisher and reopen traffic. Under persistent barrier, roll forward to reviewed 409 inert bundles and restrictive SQL; revert only vetted non-destructive changes or PITR restore to a consistent checkpoint with **Storage bytes/version snapshot**. PITR may restore unsafe old SQL grants, so reestablish fail-closed barrier/Edge guard before any safe reopening. Unknown deleted/overwritten media cannot be claimed restored by DB-only rollback. Quarantine orphaned keys and account for pending TTL, signed bearer/CDN exposure and moderation/privacy suppression. Do not destroy evidence while incident status or legal hold is unresolved.

## 7. Evidence and human signoff register

| Checkpoint | Acceptance evidence | Current disposition |
|---|---|---|
| A0 Source negative | Owner136 CI/Bootstrap + INT164 independent PG + QR165 mock | SOURCE_ONLY PASS |
| A1 Current manifests | All 21 Edge SHA/route/worker and 7 Cron; stage SQL116 | READ_ONLY INVENTORIED; operator full caller graph unapproved |
| A2 Operator protection | Reviewed protected env, human approvals, normal signed disposable A/B/M consent, backup/PITR/legal hold | NOT_APPROVED |
| A3 Quiesce/drain | Quiescent all entrypoints, claimed workers, in-flight Copy/SQL/delete | NOT_EXECUTED |
| A4 Edge switchover | Runtime exact SHA by endpoint/replica, all old physical issuer requests denied | NOT_EXECUTED |
| A5 SQL semantic transition | Historical116 to Source136 tailored reviewed migration, ACL/RLS/Trigger replay | NOT_EXECUTED |
| A6 Safe non-writer resume | Negative probes + no unexpected DB/Outbox/Storage state | NOT_EXECUTED |
| B0 Provider Positive Contract | conditional immutable Copy, independent attestor, version-fenced SQL Commit/Recovery | NOT_IMPLEMENTED |
| B1 Genuine signed Provider | normal Owner A, Nonowner B, Moderator M, real PUT/Copy/GET hash, old bearer/CDN | CONFIGURATION_BLOCKED |
| C physical Cleanup | verified reference+legal+privacy+old bearer and separate human approval | NOT_AUTHORIZED |

Operator signoff must record opaque approval ID, approved Source and DEPLOYED bundle SHA per route, protected environment, responsible traffic barrier and backup/restore owners, clone rehearsal, #139 legal signoff, work/queue drain evidence, incident abort authority, 0-7 checkpoint dispositions, which of A/B/C was authorized, and exact resumption scope. PR reviews and discussions alone do not constitute approval.

## 8. Release

R17 Product Tree 30: PASS0 / PARTIAL12 / BLOCKED18; seven Seeds blocked, Guide Human QA0/315, Rights0/45, Public Eligible0/45; #138/#139 Privacy/Legal/Ops unresolved. SOURCE_FULLY_ENROLLED=0, graphComplete=false, retirementAuthorized=false, saveRevisionAuthorized=false, pairedGalleryPublishAuthorized=false, physicalCleanupAuthorized=false. All positive Preset Publish and physical 72h/Cloud cleanup, Gallery retirement, Scene paired Save, Native DDV Writer/Apply OFF. All Drafts DO_NOT_MERGE/DO_NOT_DEPLOY. R18-work is NOT formal Release R18.

**Next:** Human Operator #130 must review and explicitly approve **A** on a protected disposable environment after Source136→Stage116 semantic manifest signoff. 03 COMM must submit new exact Provider Positive Contract before requesting separate **B**. 04 QR must independently test ONLY that newly changed delta; never reimplement PR153-165 accepted tests.

References: DDV_CURRENT_STATE, DDV_WAND_RELEASE_ROADMAP_CURRENT, 04 QR Handoff, Issue #121/#130/#139, Owner PR134, INT164, QR165; Supabase Storage copy docs https://supabase.com/docs/guides/storage/management/copy-move-objects (docs alone are not proof of immutable CAS).
