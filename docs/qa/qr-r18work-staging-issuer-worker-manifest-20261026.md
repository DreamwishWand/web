# 04 QR / Staging Issuer, Worker, SQL and Cron Read-only Manifest — 2026-10-26

STATUS: SNAPSHOT ONLY / NOT AN OPERATOR APPROVAL / DO_NOT_DEPLOY. The table is immutable evidence of the connected Staging project at the query time and must be re-read by the human immediately before the approved window. Bundle SHA256 is as returned by Supabase get/list Edge provider; Operator must independently attest complete deployed bundle including dependencies and replicas. Live route operation, SQL callgraph exhaustiveness, real signed session and object bytes are NOT thereby proven.

Project: ptpdoxhrqopvczpclcij. Current stage managed 116 historic migrations, last 20261024043436. Source136 PR134 aba2b9e98eebcb445e034215af87ed6c4c2199f5 is **not** the deployed Stage baseline. Source 136 SQL, after 03000, includes new inert Scene Edge and legacy Scene RPC revocations. Deployed Staging still has the OLD variants.

## 1. Complete 21 Active Edge inventory

All rows ACTIVE at readback. JWT refers to Edge verify_jwt metadata, **NOT** a complete human Actor authorization determination. For worker JWT-off routes, internal worker-token verification requires separate live signed proof.

| Edge slug | Deployed version | JWT check | Deployed bundle SHA-256 | Source-derived category | Call site / risk | Operator gate |
|---|---:|---|---|---|---|---|
| community-command | 30 | yes | 05434b71f095728b6754cdc85307e95402890674a6da666732ee87ba1466931f | INDIRECT SQL WRITER | command-to-RPC lifecycle, Preset/Gallery/other Work | Review all mapped mutation verbs and SQL EXECUTE |
| community-query | 14 | yes | 0bac6fe65dea784592c02c15f0746577b9b768b19bf6203856ee4e744a35e5a3 | READ PRIVATE | session-checked reads and preset query | Read-only availability after barrier if authority proven |
| community-media | 16 | yes | ccfe49b85e5ec9e2d463be76d12cdb43059029b4714b17ad23d81d89d5216845 | RELATED PHYSICAL MEDIA API | Gallery prepare/finalize/abort/cleanup, Storage.remove | Audit scope and prevent WEP cross-bucket collateral |
| community-auth-e2e | 9 | yes | e4ae6bac0cfac9be9cfb91e56cabadb7b3afa08b7b31e9df42b51346f5eb63c7 | DISABLED E2E | STAGING_E2E_DISABLED 410 | Keep disabled |
| community-e2e-once | 7 | yes | b25a648aee32b18e135f9e47d8e79a8b46f358d77015874207abbd4dd2f3af2d | DISABLED E2E | STAGING_E2E_DISABLED 410 | Keep disabled |
| community-auth | 4 | no | 901e4c38ab428a023cc85b053f723da29e477225a6eef1ac065a8c77164b1a09 | PROVIDER WORKER | worker token -> provider cleanup queue | Account external user cleanup separate from Preset Storage |
| community-admin | 16 | yes | cf8e3490584250d611c7c58b41e1f4c052f5106f59aa72682e2b7e103717dbde | PRIVILEGED SQL ISSUER | moderation / retention holds / cleanup retry | Operator authority, no service_role user impersonation |
| community-account | 3 | yes | 9526cce01292fbf7d14e09111a18f32e0b3100527d64751df03cf0653acd9690 | ACCOUNT/PRIVACY MUTATION | account tombstone and suppression | Preserve Phase1 privacy independent of Preset cuts |
| community-retention | 12 | no | 2e0235b40060cf3d5462e4505905fbd28d7b62e24e2d408b2ca982327e29413c | RELATED PHYSICAL MEDIA WORKER | account retention and Gallery orphan Media remove/info, separate gate | Map object bucket and legal/privacy implications; guard shared refs |
| community-ops-escalation | 3 | no | 463c1e173b61cb462ad6523122f91e4259309fb53103a99c734cad985a5f889f | OPERATIONS WORKER | worker escalation dispatch | Record job and operator alert dependency |
| community-ops-email | 5 | no | 02f3227169513d08a1ebf0a08822a55876efda93687df9d5ae693398ac2b65de | OPERATIONS WORKER | message dispatch and worker token | No unrelated email in acceptance |
| wep-preset-artifact | 14 | yes | fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa | P0 PRESET MUTATION | prepare/download/copy, legacy publish RPC, failed-compensation remove, discard; SHA same-key | MUST barrier + swap to failclosed before SQL revoke |
| wep-preset-retention | 6 | no | 675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e | P0 PHYSICAL DELETION WORKER | worker token and retention claim -> WEP Storage.remove -> finalize | MUST stop/drain and deploy failclosed worker |
| community-email-resend | 4 | no | 61138a14c664b47c6ca89dc271eaf0957b027c9bd965f3565e85ed982cbdabe8 | MAIL WORKER | Resend worker provider | Secret never exposed; no Preset objects |
| community-wep-retention-e2e | 5 | yes | bbb2e0e9e695553b3162e1f7fd1bdea41fb02a8de782afb2a9140a7ed5f5206d | DISABLED E2E | STAGING_E2E_DISABLED 410 | Keep disabled |
| wep-retention-e2e | 4 | no | 88ce72510999d925ec9ea67df6e53d9a55637a6a588e212e2a1b4d507eba0102 | DISABLED E2E | STAGING_E2E_DISABLED 410 | Keep disabled |
| wep-preset-flow-e2e | 9 | yes | ef6118477cf0fcfebb9347cf0760c7ca80d7f145f2ee32539532e4735c85b8da | DISABLED E2E | STAGING_E2E_DISABLED 410 | Keep disabled |
| community-auth-acceptance | 7 | no | f9c7189a345f3d213738dc54b10ec013742cd648c4a68297ae904796087b7d0d | AUTH ACCEPTANCE ROUTE | authentication acceptance utility | Review credentials and legacy issuer before any real sign-in |
| community-public-media | 6 | no | 376f40f919154195cd460501ba661af9f15bf9ac29cae099702af320b042bb39 | READ MEDIA | public Edge proxy media gateway | Review preissued bearer/CDN and privacy |
| community-public-query | 7 | no | baa7fb67eca0351617ba5afae85f0243bd435845d96a69d75ba1ae26e3040652 | READ PUBLIC | browse public documents | Revalidate privacy/search suppression; no direct Copy/Remove |
| wep-scene-preset-product | 1 | yes | 6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045 | P0 ALTERNATE PRESET MUTATION | separate Scene product RPC, copy BEFORE SQL, published compensation remove, stage discard/success remove, unpublish/delete; same key domain | MUST barrier + replace inert Source136 alias BEFORE SQL revoke |

P0 source details independently inspected:
- Artifact v14: uses Storage.copy to deterministic published account/idempotency SHA256 key before public.community_publish_preset_envelope, and physical Storage.remove for failed compensation, some discard paths and stage cleanup. Published DB registration can race delete of copied bytes.
- Scene Product v1: uses same published destination namespace, but calls separate public.community_publish_scene_preset_product_v1, removes published bytes on failed SQL and staging on success/discard; separately invokes community_unpublish_scene_preset_v1 and community_delete_scene_preset_v1. This is not guarded simply by changing Artifact v14.
- Preset Retention v6: worker token + claimed retention blob does not itself prove no active reference or legal hold; Storage.remove before finalize.
- Other physical Storage.remove implementations in community-retention v12 and community-media v16 are not automatically Preset/WEP key operations; Operator must establish which buckets/claim semantics can intersect retained Gallery/Scene/Cloud refs. A name/regex match alone is not evidence of a published Preset delete path.
- Stub v9/v7/v5/v4 routes return 410 STAGING_E2E_DISABLED; absence of positive route is not proof old authenticated aliases are gone.

## 2. Seven ACTIVE Cron inventory

| Job ID | Job | Schedule | Cutover attention |
|---:|---|---|---|
| 1 | community-outbox-every-minute | * * * * * | Outbox; preserve non-Preset operations; review receiver |
| 31 | community-operations-alerts-every-minute | * * * * * | Ops alert, may remain under barrier only if harmless |
| 32 | community-provider-cleanup-every-minute | * * * * * | Worker cleanup: stop/drain review |
| 33 | community-retention-hourly | 17 * * * * | Retention: stop/drain review, legal hold |
| 34 | community-retention-alerts-every-minute | * * * * * | Alert; safe mode only after dependencies checked |
| 37 | community-operations-escalation-alerts-every-minute | * * * * * | Ops alert; avoid noisy notification loops |
| 38 | community-operations-escalation-every-minute | * * * * * | Worker escalation; inspect alternate work dispatch |

No raw job command, token, HTTP bearer or Vault secret is embedded in this manifest. Job schedule/active from read-only pg_cron catalog; cross-project HTTP service and direct SQL/worker destinations are **NOT yet human reviewed**. Do not assume disabling cron 33 alone stops retention Worker v6: other token-based callers may exist.

## 3. Staging SQL/ACL Snapshot (read-only pg_catalog)

- PUBLIC functions and EXECUTE service_role=true, authenticated=false, anon=false: community_publish_preset_envelope; community_publish_scene_preset_product_v1; community_unpublish_scene_preset_v1; community_delete_scene_preset_v1. The first two remain historical positive registration RPCs, separate Writer contracts.
- Stage private.preset_storage_reservations_r18 ABSENT; release gate ABSENT; commit scope ABSENT; Source R18 Published Blob insert guard ABSENT. Only historical immutable artifact_blobs trigger present (one user trigger), table RLS=true.
- SQL privilege restriction to service_role does NOT prevent privileged old Edge Copy BEFORE SQL or its failed-compensation physical removal. Source136 SQL revoke must execute only AFTER external traffic barrier/drain and replacement of physical Edge/worker paths.
- Actual pg_get_functiondef body, routine overloads, Trigger order, RLS and Storage grants must be frozen as artifact in approved protected workflow; do not mistake a signed SQL inventory summary for complete SQL parity.

## 4. Migration ledger semantic reconciliation

The 116 historical migration ledger is not a prefix of 136 Source files; Source135 historical comparison: only 23 same Version+Name, 107 shared unique names with 86 different versions, Stage-only distinct names five, Source-only distinct names 28 and four duplicate historical name entries. Five Stage-only: community_core_v0_staging_media_bucket; community_staging_pg_net; community_staging_remove_pg_net; scene_preset_product_vertical_v1; scene_preset_unattached_media_discard_v1. Source136 adds 03000 scene product issuer closure. No sum/diff is a safe DDL deployment count. Snapshot existing function identity and GRANT, schema+data and Storage bucket policy, evaluate all changes on cloned historical116 before an approved migration.

## 5. Required operator re-attestation

Before authorizing A (fail-closed cutover), capture independently current exact 21 deployed SHA/version and verify approved new SHA, endpoint replica routing, all direct SQL/privileged JWT/worker Cron callers, traffic-barrier owners and in-flight zeros, full semantic SQL migration diff, PITR+physical object byte restoration test, legal hold #139 and preview rollback. Sign protected environment manifest. If any unknown caller or SHA, NO-GO. Before B, separately approve actual signed OwnerA/NonownerB/ModeratorM with consent and genuine immutable Provider version/byte SHA, concurrent dual Publisher/retention failure and prior URL/CDN tests. Before C, separate physical deletion reference graph and legal acceptance. This file does NOT authorize any A/B/C.

Reference Runbook: qr-r18work-atomic-staging-cutover-runbook-20261026.md.
