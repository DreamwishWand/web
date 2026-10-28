# 09 INT — Source138 Postcommit Missing-object Read Graph (independent SOURCE-only audit)

Date: 2026-10-26 JST. Owner frozen exact SHA: `7d509c1a0a934b32e20d93439314168267184cc6` (03 COMM Draft PR134, no newer Owner postcommit-read-suppression HEAD observed). Existing INT PR170 `d7be92ebfd7fc07b09f9a85be3e04ad7ef3f3659`, ordinary CI `40270011446` and real isolated PostgreSQL two-backend `40270011461` accepted. Do not rerun prior incident-veto or R11–R17 tests.

**Evidence classification:** CONFIRMED SOURCE / STATIC only where listed; local Node contract regression is *not* a real SQL execution or Provider proof. SOURCE138 private Incident veto protects future Commit/Completed Replay, but does not automatically suppress already committed Work/Revision/Search/Media references. The Source137/138 incident journal has no operator-authorized resolution and the positive release gate stays OFF.

## Current reader/caller graph (verified paths)

| Consumer surface | Actual entry and reachability | Source138 integrity suppression status |
| --- | --- | --- |
| Public Browse/Search | `src/lib/community/staging-http-client.ts#searchPublicWorks` calls `/rest/v1/rpc/community_search_public`, `supabase/migrations/20261025002600_account_privacy_suppression_barrier_v1.sql` reads `search_documents` + `private.is_discoverable_work` | CONFIRMED missing-object incident not included in discoverability predicate; a still-published Work/Search document may be listed |
| Presets Discover | `src/lib/wep/preset-community-bridge.ts#discover` passes `workType:'preset'` to `searchPublicWorks` | CONFIRMED same search exposure |
| Public Gallery Detail | `supabase/functions/community-public-query/index.ts` allowlists `community_get_gallery_public_v1`; SQL in privacy barrier returns Gallery Work detail/current media/preset IDs under published/clear/public rules | CONFIRMED no reservation incident predicate at this read |
| Auth Work/Detail | `supabase/functions/community-query/index.ts` maps `work` to `community_get_work`; `20260930031310_community_core_v0_query_rpc.sql` uses `private.can_access_work` | CONFIRMED authorization without postcommit Provider-state check; staff/Owner/privacy rules remain separate |
| Auth Preset/Library | `community-query` maps `preset` to `community_get_preset`, `saved` to `community_get_saved`; SQL preset bridge and saved projection use `can_access_entity` | CONFIRMED absence of Incident-aware presentation; historical saved references and actor-specific retention still require proof |
| Preset resolve/read | `wep-preset-artifact/index.ts` `resolveWork` maps `preset_artifacts.community_work_id` to metadata RPC; `read` maps to `wep_get_accessible_preset_blob`, then calls Storage `createSignedUrl(meta.storageKey,300)` | CONFIRMED stored metadata/purged_at check without absent-object incident predicate; existing or newly issued tokens require separately proven revocation semantics |
| Preset browser materialization | `preset-community-bridge.ts#loadPreset/loadDiscoveredWork` downloads the returned signed URL and validates byte-size/SHA-256 | CONFIRMED client may fail download/checksum while upstream discovery/detail still advertises Work; not a read-side suppression contract |
| Scene public/readiness | `community-public-query/index.ts` allowlists `community_get_scene_preset_public_v1`; WEP Edge `revisionReadiness` calls `community_scene_revision_readiness_v1` | CONFIRMED live Source callsite, UNKNOWN full latest-effective SQL/read dependency and incident closure for both |
| Gallery public media/cover | `community-public-media/index.ts` calls `community_gallery_media_gateway_v1`; Gallery GET proxy downloads full bytes, checks SHA/size, no raw signed URL; `community-media/index.ts` uses Owner authenticated binary gateway | CONFIRMED existing Gallery-specific byte/read barriers; UNKNOWN whether any Gallery cover depends on *same missing Preset blob*, and no blanket claim of Gallery vulnerability |
| Non-Gallery public media / DreamSnaps | `community-public-media/index.ts` non-Gallery POST fallback `community_get_public_media_storage_v2` + 300-second Storage Signed URL; judge `community-media/index.ts` uses distinct 300-second URL | CONFIRMED distinct issuer; UNKNOWN overlapping Blob or Graph relationship; must not suppress unrelated DreamSnaps/QA/media |
| My Gallery/Cloud/Saved | `community-query/index.ts` `myGallery`, `saved`, and `ddvProfileWorkspaces` mappings; existing Gallery/Saved functions expose current metadata | CONFIRMED callable Read surfaces. UNKNOWN Cloud preservation/restoration external readers and historical Media/Preset/Scene joining until issuer inventory and signed test |
| Existing CDN/bearer | Preset/non-Gallery media Signed URL generation 300s; Gallery proxy uses no-store/cache headers | CONFIRMED source-issued TTL, NOT proof of already-issued URL revocation, CDN cache purge, actual provider response, legal hold |

## Minimal source-level counterexample

Precondition (not remotely executed): a previously committed public Preset Work with current revision, SearchDocument and ArtifactBlob metadata; later its published object is missing. Source137 `PUBLISHED_MISSING_POST_COMMIT` incident is journaled and Source138 prevents future Commit/Completed Replay, but the existing Work, SearchDocument and `artifact_blobs.purged_at` are unchanged. The `community_search_public` path relies on `private.is_discoverable_work` without checking the incident. Detail/resolve can still expose metadata, and `wep_get_accessible_preset_blob` can approve metadata for the URL signer. The Storage signer may fail if object truly missing; that does **not** suppress the work from browse or detail. No real signed Provider incident was produced.

## Required 03 COMM Owner repair (not implemented by 09 INT)

1. Define an authoritative `read_suppressed_due_to_integrity` projection scoped to affected *work/revision/storage-key/incident* under current+historical references. Never globally suppress unrelated Owner or Gallery/DreamSnaps works. Incident evidence cannot be fabricated by clients as a positive recovery entitlement.
2. Enforce at server-controlled Read entry points, not client filtering: `community_search_public`, public Work/Gallery/Scene detail, authenticated Work/Preset/My Gallery/Saved, WEP preset resolve/read and URL issuer, Gallery Media/Cover/Cloud only when linked by proven affected refs. Preserve Owner/Creator/Moderator/privacy semantics, including retired and blocked identities.
3. Provide stable non-leaking response for suppressed public data (NOT_FOUND), explicit authorized Owner/Moderator incident-status diagnostics as required, no content metadata/key/token leakage, no stale Search/Outbox promotion; validate negative response through direct RPC as well as Edge.
4. Define append-only signed/operator-evidenced, version-fenced Recovery/Resolution with independent Provider-origin immutable object Generation/ETag/source precondition and downloaded SHA/size reattestation; never simply UPDATE/DELETE immutable incidents or re-enable completed replay on client assertion. Preserve all previous Fence history.
5. Keep physical delete, Claim, retention, Scene/Cloud, positive Publish and Native Apply OFF until current+historical+legal/Cloud references and conditional Provider delete plus consent are separately accepted.
6. Require explicit CDN/bearer availability/revocation matrix at t=0/60/300/post expiry. Already-issued signed URL cannot be assumed revoked by a SQL predicate; show limitations to Operators.

## New-only independent acceptance after Owner delivers stable exact SHA

- Compare Owner exact SHA against frozen Source138 and audit only changed Reader functions/Edge/SQL ACLs/issuer graph; do not rerun accepted PR155–170 cases.
- Two actual isolated PostgreSQL connections: committed Work+Search+Blob synthetic fixture, durable missing-object incident vs Search/Detail/Owner/Moderator/Privacy reads, lock/replay/recovery and historical and current references. Preserve all unchanged baseline and transaction rollback for synthetic fake Provider/release gate.
- Validate Owner vs nonowner vs Moderator vs retired/suppressed Creator; public anonymous/direct RPC; current/historical Gallery/Scene media, Cloud saved and referenced/revision fallback; false-positive isolation.
- Independently compare Mock vs local O_EXCL vs actual PostgreSQL vs protected signed Supabase Provider; only Operator #130 approval can permit true remote Provider and real bytes/Signed URL t=0/60/300 tests.
- Record exact Owner SHA, separate INT PR HEAD and ordinary/dedicated CI IDs. With no new Owner read-suppression HEAD at this audit, *provider and new 2PG delta tests are NOT EXECUTED*.

## Blocked / UNKNOWN

- Source138 Staging parity: historical116 migrations, 21 Active Edge and seven Cron with old Generic v14, Scene Product v1, Retention v6; no new Owner rollout. Operator #130 stop/quiesce and drain physical Copy/Remove/inflight, attest failclosed Edge and workers, **then** reviewed semantic SQL ACL with PITR/legal; SQL revoke first is unsafe.
- Actual Supabase destination atomic create-if-absent/no-overwrite, source-object generation/ETag, independent original byte receipt SHA/size, object version and legal/Cloud reference query; no signed OwnerA/nonownerB/ModeratorM actor E2E; no real CDN/bearer invalidation result.
- Incident resolution and missing-object provider state at each Reader not proven. Direct SQL callers/Vault Cron targets not fully enumerated, do not mark graph CLOSED.

**R17 unchanged** Product Tree PASS0/PARTIAL12/BLOCKED18; SOURCE_FULLY_ENROLLED=0; graphComplete=false; retirementAuthorized=false; saveRevisionAuthorized=false; pairedGalleryPublishAuthorized=false; physicalCleanupAuthorized=false. All Draft DO_NOT_MERGE/DEPLOY. Positive Publish/Physical Cleanup/Cloud/Native DDV Writer/Apply OFF. No formal Release R18.
