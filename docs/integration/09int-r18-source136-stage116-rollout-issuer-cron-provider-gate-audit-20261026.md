# 09 INT — R18-work Verified Provider cross-system atomicity / staged rollout hazard
26 October 2026. **Existing** 09 INT; no new stream; do not begin Release R18.

## New-Owner contract check

03 COMM Draft Owner [PR134](https://github.com/DreamwishWand/web/pull/134) exact **HEAD `aba2b9e98eebcb445e034215af87ed6c4c2199f5`**, 136 source migrations. This is the SAME Source136 accepted previously, not a new positive Provider Publisher. Separate independent PR164 HEAD `95c9c03f2095f96a7117290fb8ffb5c7f3753aa3`, CI40261668656 and actual local PostgreSQL40261668678 PASS; previous PR155/156/158/161/162/164 and R11–R17 must not be reimplemented.

Observed Source136:
- generic `wep-preset-artifact`: positive `publish` returns 409; `inspectPublishedObject` may call provider download but only returns `EDGE_READBACK_UNATTESTED`, never trusted attested Publisher.
- separate `wep-scene-preset-product`: new authenticated inert Edge, all publish/prepare/retire/discard/cleanup return 409 and no `Storage.copy` or `Storage.remove`.
- `wep-preset-retention`: verified worker token but no Storage physical deletion; returns 409.
- SQL 02990: 90s Lease/Fence, private `preset_storage_commit_candidate_r18` with disabled `preset_storage_release_gate_r18` and no service_role EXECUTE; `PROVIDER_ATTESTED` accepted state defined but **no registered genuine Provider attestation writer**; reported SHA/size does not set it.
- SQL 03000: revokes service/public/anon/auth EXECUTE for any historical `community_publish_scene_preset_product_v1`, `community_unpublish_scene_preset_v1`, `community_delete_scene_preset_v1`, adds old deployed issuer Registry explicitly SOURCE_PRESENT_UNENROLLED. These only apply to future reviewed Source deployment. Owner synthetic positive SQL rollback tests are **not Provider acceptance**.

There are **no new Owner conditional immutable Provider Copy, versioned ETag, authoritative Download SHA/size receipts, DB+Storage version-fenced positive Commit/Crash recovery or reference-aware physical Cleanup** after latest Source136. Do not create a fake success verdict. Real signed Provider Local/Staging **NOT_EXECUTED/CONFIGURATION_BLOCKED**.

## Read-only actual staged Issuer/Worker/Cron inventory

Direct Supabase connected queries to Staging project `ptpdoxhrqopvczpclcij` (no SQL DML/DDL, deployment, auth, Vault secret reads, Storage mutations). Full snapshot [tests/fixtures/09int-r18-source136-staging21-cron7-readonly-inventory.json](../../tests/fixtures/09int-r18-source136-staging21-cron7-readonly-inventory.json).
- EXACT observed: 21 Edge functions have `status=ACTIVE` (three test endpoints deliberately return 410); seven `cron.job.active=true); 116 managed DB migrations; all THREE Scene Producer/Unpublish/Delete RPC signatures still `service_role EXECUTE=true`; Source136 claim RPC and Release Gate ABSENT.
- WEP Preset same bucket risky:
  1. `wep-preset-artifact:v14` bundleSHA `fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa`: published/staging `discard`, Copy-before-SQL, failed publication physical compensation;
  2. `wep-scene-preset-product:v1` bundleSHA `6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045`: distinct published deterministic same-key copy-before-Scene SQL, compensating published removal; staging-only own discard (not published); separate lifecycle SQL;
  3. `wep-preset-retention:v6` bundleSHA `675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e`: worker-token and claimed account Blob list then physical `Storage.remove`, finalize.
- `community-retention:v12` and `community-media:v16` use *different Gallery MEDIA bucket*, not WEP bucket; `community-retention` throws unavailable on WEP artifact purge. Do not call them additional WEP deletion issuers. Across 21 live Edge bundles no fourth direct WEP Bucket physical removal observed; indirect SQL/Vault Cron/in-flight external service are **UNKNOWN**.
- Active cron job sources (actual `cron.job` query, no secret values):
  - **#1** every min `public.community_process_outbox_batch(100)` (DB/Outbox issuer, not direct physical WEP delete)
  - **#31** every min `private.community_refresh_operations_alerts()` (Ops alerts)
  - **#32** every min `private.community_invoke_provider_cleanup_worker()` (Vault HTTP worker; **target unresolved**)
  - **#33** hourly at :17 `private.community_invoke_retention_worker()` (Vault HTTP worker; likely Community retention, but **Vault target unresolved**; no unsupported assertion it calls WEP retention v6)
  - **#34** every min `private.community_refresh_retention_operations_alerts()` (Ops alert)
  - **#37** every min `private.community_refresh_operations_escalation_alerts()` (Ops alert)
  - **#38** every min `private.community_invoke_operations_escalation_worker()` (Vault HTTP worker; **target unresolved**).
- The 3 `private.community_invoke_*worker` definitions read-only query show Vault secret *names* and `net.http_post`; **no Vault decrypted URL/token fetched**. Cron #32/#33/#38 dispatch destination, external direct caller of `wep-preset-retention` and any schedule outside pg_cron UNKNOWN. Protect privacy/legal retention and workflow SLA before pausing cron; do not stop all 7 indiscriminately.

## Critical anti-ordering finding

**DO NOT REVOKE legacy Scene SQL service-role EXECUTE while historical Scene Edge:v1 is still allowed to publish or has in-flight Copy.** Its actual deployed code performs `Storage.copy(staging,published)` FIRST, then separate `community_publish_scene_preset_product_v1` SQL, and on any error `Storage.remove(published)` if it promoted. Deploying Source136 SQL 03000 ACL revoke first can turn an otherwise racing old Publisher into `Copy -> SQL permission denied -> compensation physical delete`. A concurrent successful reference could then point to missing bytes. 09 INT prior PR162 separately proved cross-endpoint actual Edge+Mock race; **do not duplicate that accepted race**. New scoped test is a rollout-order model/source-inventory assertion, NOT an execution of a real Provider/SQL revocation event.

A proposed operator sequencing **precondition**, not deployment authorization:
1. Human-approved scope, signed normal A/non-owner B/mod M actors, PITR/backup, legal retention holds, semantically reconcile 116 historical migrations against 136 Source (not simple +20 SQL append).
2. Verify ingress-block capability, stop accepting risky Scene/Generic Publish + staging/published discard and all unowned physical cleanup; handle queued/issued old calls, drain in-flight Copy and worker claims with evidence **before** ACL revocation. Coordinate affecting Cron #32/#33 and externally callable v6; honor legal/privacy operations and backpressure.
3. Roll out the exact chosen Source136 inert WEP Generic/Scene/Retention bundles with operator approval; verify deployed bundled SHA, no legacy direct copy/remove, normal session enforcement, old worker calls blocked; keep traffic quiesced. A rollback to old Edge could re-open the unsafe Delete path, so rollback must remain failclosed and restore safe state.
4. Apply reviewed semantic SQL/RLS/ACL/trigger migration plan, then verify all 3 legacy Scene RPCs no longer callable as service and no direct privileges reappear; reconcile reserve/Creator/Privacy Current+historical references and Cron worker destination; preserve Source private gate OFF.
5. Only reopen unaffected read-only/Guide/Community traffic after parity checks. **Do not** enable positive Preset Publication/Physical cleanup until independently attested Provider no-overwrite/versioned writes, actual byte SHA/size, complete current/historical ref protection, crash/recovery, QA real signed acceptance. Emergency operator rollback/retry must not resurrect historic writer.

## Exact evidence / Registry matrix

| Surface | Live Stage | New Source136 | Verdict |
|---|---|---|---|
| generic Preset Artifact publish/discard/compensation | active v14 physical Copy/Remove | terminal Publish 409, Discard/preflight 409 | STAGE SOURCE_PRESENT_UNENROLLED, SOURCE FAIL_CLOSED |
| independent Scene Product + dedicated SQL lifecycle | active v1 physical Copy/Remove, 3 legacy service callable RPCs | Scene Edge terminal 409, 3 SQL grants revoked | STAGE SOURCE_PRESENT_UNENROLLED, SOURCE FAIL_CLOSED |
| retention worker | active v6 token/claim/physical delete | Source retention 409 no remove | STAGE SOURCE_PRESENT_UNENROLLED, SOURCE FAIL_CLOSED |
| reservation/fence/readback/commit | absent on Stage116 | Source136 lease/readback only, private disabled gate | SOURCE_SCOPED_NOT_PROVIDER_VERIFIED |
| Cron #32/#33/#38 external job destinations | active Vault HTTP | not globally attested | UNKNOWN (no decrypted Vault value retrieved) |
| current + historical Preset / Gallery / Scene / Cloud / native + legal-hold refs | partial source metadata | cleanup global refgraph not closed | UNKNOWN / FAIL_CLOSED physical |
| immutable provider object ETag & signed normal actors | NOT_EXECUTED | no actual positive Provider | CONFIGURATION_BLOCKED |
| full writer registry | 21 Edge+7 Cron inventory (without external callers) | Source136 typed registry | SOURCE_FULLY_ENROLLED=0, graphComplete=false |

## New independent source-only validation

Draft 09 INT verification branch on exact Owner136 `aba2b9e98eebcb445e034215af87ed6c4c2199f5` with unique `tests/09int-r18-source136-stage-issuer-rollout-readonly-barrier.test.mjs`. Validates 21 pinned Edge SHA names, 7 Cron names+programs, 3 independent WEP physical issuer routes, no Source136 Copy/remove, SQL Source revokes, Stage 116/136 mismatch, symbolic SQL-first hazard, and a required operator readiness predicate. **Synthetic readiness model**, not actual drain/Provider. No repeat of PR155/#156/#158/#161/#162/#164 or R11–R17.

## 04 QR genuinely signed Provider acceptance (Issue #130)

Preconditions operator approved normal OwnerA/nonownerB/ModeratorM, disposable bytes and protected env, exact SQL116→136 semantic parity/Edge+Cron+external worker inventory, PITR/legal holds and explicit rollback. Then actual same Account+Idempotency across Scene & Generic Publisher A/B different bytes/metadata; conditional no-overwrite with version/ETag and Lease expired/tardy Copy; published actual bytes SHA256/size at pre- and post-DB commit, copy succeeded/DB commit failed, DB committed/provider disappeared, crash after Copy and completed idempotent replay, old retention worker claim vs newly committed historical Scene/Gallery/Cloud references, object deletion 0 and public dangling refs 0, actor privacy retired/moderator emergency deny and old bearer URL CDN t0/t60/t300/post-expiry. **Current real signed QA NOT_EXECUTED; do not substitute service_role or Mock Provider.**

R17 release acceptance Product Tree 30: PASS0 / PARTIAL12 / BLOCKED18, unchanged. `SOURCE_FULLY_ENROLLED=0`, `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`, `physicalCleanupAuthorized=false`. ALL Draft DO_NOT_MERGE/DEPLOY, no stage mutation, no formal Release R18, all positive Preset/Cloud/Native/DDV Writer/Apply OFF.
