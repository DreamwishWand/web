# 09 INT — R18-work Source135 Verified Preset Fencing / Deletion Issuer census
2026-10-26 JST. Existing 09 INT, not Release Acceptance R18.

## Exact new owner candidate

03 COMM Owner PR #134 immutable SQL migration pin `86982608fd593001be11e449e7e43fd016f670dc` (+ `20261025002990_r18_preset_promotion_fencing_candidate.sql`) over accepted Source134 `cb86ac1ba4601d57dbaeb6a0c3e5c59e61d0749b`. The migration is #135, adds `lease_token`, `lease_fence`, `lease_expires_at`, readback byte count/SHA, states and gate. Original Owner initial CI40255553862 SUCCESS, initial Bootstrap40255553967 FAILED because workflow still asserts 134 source migrations. Later Owner moved HEAD, verify exact current Owner CI separately; never promote this preliminary pin to final Owner accepted by inheritance.

- `community_preset_storage_claim_promotion_r18`: Account/share+reservation FOR UPDATE, owner/Creator/Privacy, state version, 90-second Lease Token, increasing fence; reply `providerCopyAuthorized=false`.
- `community_preset_storage_report_readback_r18`: checks lease token/fence/version/unexpired and declared SHA+bytes; a matching *claimed* readback becomes `EDGE_READBACK_UNATTESTED` + `VERIFICATION_REQUIRED`, never `VERIFIED_PUBLISHED_OBJECT`. Wrong bytes become `FAILED_RECOVERABLE`.
- Private `preset_storage_commit_candidate_r18`: SQL candidate behind `preset_storage_release_gate_r18.enabled=false` and no `service_role` EXECUTE; its test-only synthetic successful transaction must be rolled back and not used as Provider attestation or deployed positive Writer proof.
- `preset_storage_commit_scope_r18` temporarily allows the published-artifact trigger to insert only within a restricted SQL transaction, and private scoped commit is disabled. No signed/verified Copy source, no provider conditional object-write fencing, no physical reference-aware cleanup authority.
- `community_publish_preset_envelope` remains failclosed from 02980 and main `wep-preset-artifact` source returns publish409 before any copy; old Staging does not.
- Do not re-run previous accepted R11–R17 or 09 INT #155/#156/#158.

## New deployed Staging inventory — read-only direct Supabase Edge source audit

Project `ptpdoxhrqopvczpclcij`; **NO deployment, schema mutation, object delete or normal JWT sign-in**. Read-only inspected 21 deployed Edge function entries and associated source for Storage `.copy`, `.remove`, SQL/RPC call sites, and bucket helper. These are deployed code traces, not proof of an incident or actual reachability by a normal user.

| Deployed Edge | Version | Bundle SHA256 | Relevant operation and exact scope | Class |
| --- | --- | --- | --- | --- |
| `wep-preset-artifact` | ACTIVE v14 | `fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa` | `publish` copy published key before `community_publish_preset_envelope`; failed RPC compensation removes published; successful publish removes staging; `discard` accepts staging **and published** and physically removes when no committed `artifact_blobs` row | **DEPLOYED_UNENROLLED_WRITE_DELETE** |
| `wep-preset-retention` | ACTIVE v6 | `675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e` | verified worker token `retention_cleanup` → `wep_get_claimed_retention_artifact_blobs` → physical `Storage.remove` → `community_finalize_artifact_blob_purge`; no R18 global reservation fence/provider re-attestation in deployed bundle | **DEPLOYED_UNENROLLED_DELETE_ISSUER** |
| `wep-scene-preset-product` | ACTIVE v1 | `6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045` | **NEW distinct route**: deterministic `published/{account}/{SHA256(account:idempotency)}.json` in the **same WEP Preset bucket**; `Storage.copy` before independent `community_publish_scene_preset_product_v1` SQL. On failed SQL, `promoted=true` physical `Storage.remove(publishedKey)`. Successful publish physically removes staging. `discard` accepts **staging only**, unlike artifact v14; `unpublish`/`delete` call separate lifecycle RPCs (not direct physical removal in Edge). | **DEPLOYED_UNENROLLED_WRITER_COMPENSATION_DELETE** |
| `community-retention` | ACTIVE v12 | `2e0235b40060cf3d5462e4505905fbd28d7b62e24e2d408b2ca982327e29413c` | `MEDIA_BUCKET` deletion for Account media and Gallery orphan under separate origin/cleanup gate, while direct WEP Preset adapter throws `Preset artifact storage purge adapter is not available`. Do **not** falsely classify these Media bucket removes as WEP Preset deletes; still an overall deletion issuer requiring Gallery-only gate review | **OTHER_BUCKET_SCOPED** |
| `community-media` | ACTIVE v16 | provider-specific bundle not pinned in this report | `BUCKET` Gallery media validation/failure cleanup and registration; separate Gallery contract | **OTHER_BUCKET_SCOPED** |
| `wep-preset-flow-e2e` / `wep-retention-e2e` / `community-wep-retention-e2e` | v9/v4/v5 | see provider | explicit `410 STAGING_E2E_DISABLED`; cannot be used to prove safety of above active issuers | **DISABLED_410** |
| Other deployed functions | 21 total checked | see provider metadata | `community-command`, `community-query`, `community-admin`, Account/Auth/Ops/Media/Public gateway, related stubs; no additional direct WEP bucket Copy/remove found in *inspected bundles*. Indirect SQL/cron worker invokes still require full graph/registration | **NO_DIRECT_WEP_DELETE_OBSERVED / INDIRECT_UNKNOWN** |

Separate live SQL read-only `pg_proc`: `community_publish_scene_preset_product_v1`, `community_unpublish_scene_preset_v1`, `community_delete_scene_preset_v1`, `community_publish_preset_envelope`, `wep_get_claimed_retention_artifact_blobs`, `community_finalize_artifact_blob_purge` are service-role EXECUTE=true, anon/auth EXECUTE=false, and are not new R18 reservation RPCs. Scene publish body references `artifact_blobs`, idempotency, and has **no** R18 reservation linkage. These represent deployed old code; do not infer RPC success or specific deletions from read-only probes.

**Cross-issuer same-key collision:** deployed artifact v14 and Scene Product v1 each derive `published/{account}/{SHA256(account:idempotency)}.json` under the same bucket. Distinct Edge/RPC code can interleave Copy, SQL commit/fail and physical compensation for the *same key*. This is HIGH_CONFIDENCE SOURCE_CONFORMING ordering, actual provider interleaving **NOT_EXECUTED**. Do not mistake Scene Product staging-only `discard` for published discard; published deletion risk comes from its failed-publish compensation and from artifact v14/retention.

## Mandatory 03 COMM changes prior to positive publication

1. Treat `wep-scene-preset-product` and `community_publish_scene_preset_product_v1` as an independent Preset Writer. Add explicit Source registry entry, current/historical Gallery/Scene/Media/Cloud dependency map and abort-before-Copy guard even when old existing Preset revision/Media IDs are involved. Source134 currently lacks matching `supabase/functions/wep-scene-preset-product/index.ts` file in frozen Owner134 repo, despite **ACTIVE deployed v1**.
2. Block ALL physical `Storage.remove` issuer paths across the shared WEP bucket, including expired retention, failed publish compensation, cleanup/staging discard, in-flight copy, and cross endpoint idempotency. Distinguish current+historical references and provider lease semantics. Do not assume row absence equals no in-flight reservation.
3. Copy to published and real byte-length/SHA256 attestation require **provider-enforced immutable key/conditional write and observed version/fence**. SQL-only token/lease can expire while Copy proceeds; a tardy Copy may overwrite a newer object unless physical provider write semantics are proven. DB commit success alone cannot prove bytes remain present after a racing remove. The current `EDGE_READBACK_UNATTESTED` state must not silently become positive.
4. Inventory Cron/Vault retention job source and all SQL wrappers/migrations; link every route (including Scene Product) to one canonical idempotency and Retention/Graph Registry. First close active deployed issuer pathways and enforce safe failclosed in a reviewed future release, not through unilateral Staging mutation.
5. Keep release gate OFF, private Commit not callable, all cloud/private/native writers OFF until Provider+QR real signed acceptance and operator-approved Staging semantic parity.

## Independent new R18-work exact SQL verification

09 INT draft separate PR for **only new Source135** `02990`: actual two PG backends (Account+Reservation lock 55P03, stale fence, mismatching and matching declared bytes, expired lease, re-claim with new fence, private Commit gate closed, Cleanup denied) versus no actual provider; workflow isolated from Owner. The marker `09INT_R18_SOURCE135_ACTUAL_2PG_FENCE_FAIL_CLOSED_ACCEPTED` must appear on successful GitHub Actions run before PASS. CI FAILURE/in-progress is not acceptance. No inherited #158 criteria rerun or interpreted as new provider safety.

## 04 QR real Provider cases (Issue #130)

Signed disposable OwnerA/nonownerB/ModeratorM + privacy retired/Restrict; both `wep-preset-artifact` and `wep-scene-preset-product` aliases in the same published namespace and differing SQL RPCs; simultaneous same-key Copy; late/fenced-out Copy; pre/Post DB commit physical bytes; wrong SHA/length/readback on a moved/overwritten object; A failure compensation vs B successful commit; staged discard vs active Copy; worker claim and late retention delete; current/historical PresetRevision/Scene/Gallery/Cloud references; idempotent replay and foreign title/hash; real provider object version or conditional write semantics; old issued bearer t0/t60/t300/post expiry and CDN warm/cold; 40P01/40001/55P03 retry. Assert zero publicly discoverable Preset missing bytes and zero physical deletion of referenced objects.

Provider Signed Stage **CONFIGURATION_BLOCKED / NOT_EXECUTED** until operator reviews the historical 116 migration lineage vs source135, actual Edge bundle source/hash (three relevant WEP active writers/workers), backup/PITR and approved protected human A/B/M; service_role stand-in prohibited.

## Safety gates

`SOURCE_FULLY_ENROLLED=0`, `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`, `physicalCleanupAuthorized=false`. Public positive Preset Publication/Apply/Cloud/Native persistent writer OFF. No staging edits or merge; R17 Product Tree 30 nodes PASS0/PARTIAL12/BLOCKED18, no Release R18. All Draft DO_NOT_MERGE/DEPLOY.
