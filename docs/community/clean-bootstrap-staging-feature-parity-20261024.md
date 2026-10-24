# 03 COMM — source bootstrap vs historical Staging feature parity (2026-10-24)

Status: **SOURCE BOOTSTRAP CANDIDATE / FEATURE PARITY BLOCKED**. This document belongs to Draft PR #134 (target Draft PR #129). Do not merge/re-pin QA solely on this report.

## Evidence boundary

- Source candidate: `verification/comm-clean-bootstrap-20261024`, 113 uniquely versioned SQL migrations, in isolated Supabase CLI v2.81.3 / disposable local PostgreSQL. The previous 113-file clean replay passed; the follow-up Scene identity fix requires its own exact-head successful CI.
- Read-only Staging: `dreamwish-wand-staging` (`ptpdoxhrqopvczpclcij`, PostgreSQL 17), with historical migration SQL retained in `supabase_migrations.schema_migrations.statements`.
- The old Staging ledger includes entries absent from the canonical source. Different numeric versions for later logical migrations must not be rewritten in Staging. Neither a source-only replay nor temporary SQL reconstruction proves Source↔Staging feature parity.
- Audits below are **function/catalog/route presence**, not signed JWT/Storage byte, game save write, CDN or independent full-graph race acceptance.

## Historical SQL provenance

| Historical Staging migration | Archived SQL bytes/metadata | Source-candidate coverage |
| --- | --- | --- |
| `20260930070539_community_core_v0_provider_cleanup_queue` | 8,712 SQL characters; MD5 `554018e661d012b2358b6a2e85efb4cc` | Reconstructed only historical `private.provider_identity_cleanup_jobs` parent (before orphan FK index); 2 obsolete-looking service RPCs not recovered |
| `20261007135856_scene_preset_product_vertical_v1` | 27,423 SQL characters; MD5 `889ce4fc8335efc36195500ab4ba04fe` | Reconstructed nullable `preset_artifacts.associated_gallery_work_id`, FK and now updated revision immutability guard. **Not** Scene publish/read/unpublish/delete behaviors |
| `20261007201915_scene_preset_unattached_media_discard_v1` | 2,819 SQL characters; MD5 `82783f43640e1c54facaf92bd70c6834` | No source functional equivalent proved for prepare/finalize orphan-media discard |

All three historical SQL sources can be inspected read-only in the Staging migration ledger. Do **not** automatically replay legacy SQL into new production: later migrations altered work and media security, lock order, session identity, and retention.

## Current route and function inventory

The following checks were performed on the Draft #134 source tree and live read-only Staging function catalog.

| Staging function / owner | Source runtime route or counterpart | Parity conclusion |
| --- | --- | --- |
| `community_complete_provider_identity_cleanup(uuid)`, `community_fail_provider_identity_cleanup(uuid,text)` | Current `community_tombstone_account(uuid,uuid,bigint,text)` and `community_claim_provider_cleanup_jobs` use `private.provider_cleanup_jobs` (the newer queue). Live legacy RPCs are SECURITY DEFINER but EXECUTE limited to postgres and service_role. | **HISTORIC / CURRENT DELETION SUPERSEDED; historical outstanding-job callers UNKNOWN.** No automatic legacy RPC restoration |
| `community_publish_scene_preset_product_v1` | Active `wep-preset-artifact` uses `community_publish_preset_envelope` for supported Preset publication. Historic Scene RPC additionally handles existing Preset and Gallery Media/link semantics. | **PARTIAL / NOT EQUIVALENT.** Keep any missing workflow disabled until 09 INT/WEP/COMM publication contract reviewed |
| `community_get_scene_preset_public_v1` | Source generic `community_get_preset` and WEP signed Blob read exist, but the historic Scene Gallery joined projection isn't demonstrated. | **UNKNOWN**; owner review and route-shaped E2E required |
| `community_unpublish_scene_preset_v1` / `community_delete_scene_preset_v1` | Source `community-command` routes `unpublishWork` / `deleteWork` to generic Work RPCs. 09 INT has separately found that broader Work mutation paths can race Gallery dependency checks. | **NOT SAFE TO RESTORE/ROUTE AS-IS.** Global Writer lock-order and rollback/retry proof required |
| `community_prepare_unattached_media_discard_v1` / `community_finalize_unattached_media_discard_v1` | None of inspected `community-media`, `community-command`, `community-query`, `community-public-query`, `wep-preset-artifact`, or Preset bridge sources calls these legacy functions. | **UNKNOWN / historical recovery gap**. Inventory all callers and physical-origin deletion contract before adoption |
| `guard_preset_artifact_identity` | Source original bridge guard protected owner, creator, Work and type, but not Staging historical Scene association field. | **SOURCE CANDIDATE FIXED** in Draft #134 with new guard and rollback-only post-first-revision mutation negative fixture. CI status applies only to exact tested HEAD |

### Narrow corrected invariant

After a `public.preset_revisions` row exists for a Preset, `public.preset_artifacts.associated_gallery_work_id` must be immutable, just like `owner_account_id`, `creator_profile_id`, `community_work_id`, and `preset_type`. The Staging `preset_artifacts_identity_guard` trigger already calls this function. The Draft #134 source now installs the Staging-equivalent function after adding the association column and FK, before known-reference writer fencing. This does not alter public grants or unlock positive Gallery retirement.

Automated fixture `supabase/staging/acceptance/local-clean-bootstrap-scene-identity-guard-v1.sql` uses **synthetic local** account/Creator/Gallery entities, publishes a synthetic Scene via source `community_publish_preset_envelope`, tries to associate its already-revisioned Preset with an existing local Gallery Work, requires the immutable-identity error and unchanged reference, then rolls back. The fixture does **not** prove actual media bytes, signed-auth role matrix, safe mutable no-revision association or all-writer concurrency.

## Mandatory open gates

1. 09 INT / WEP / 03 COMM: classify historical Scene publish/read/update/unpublish/delete and unattached-media use against the actual supported Product Tree user jobs and authoritative Writer registry. Recover only currently required semantics, with ordered full-transaction locks, privacy and version guards.
2. 03 COMM: compare full historical SQL versus final source, including constraints/triggers/SECURITY DEFINER/GRANT ownership, and audit any historical outstanding provider identity cleanup jobs without exposing personal subjects.
3. 04 QR: execute authorized genuine signed Owner A / nonowner B / Moderator M Gallery/Scene workflows, native bytes/CDN URL-replay and independent two-session concurrent mutations when operators provision approved disposable actors.
4. Keep physical Gallery cleanup 0/hour, 72-hour finalized TTL OFF, Cloud entitlement/private durable ACL and Restore unapproved, positive Gallery retirement/Keep Private/Republish OFF. No Staging ledger rewrite, remote reset, Cron #33 force, Storage.remove or native DDV persistent writer.

**Release decision:** the independent 113-SQL clean bootstrap can be PASS narrowly; Source↔Staging **feature parity and cross-product Gallery retirement are still BLOCKED**. Do not flip release-status or merge Draft PR #134 without owner review.
