# DDVRE 03 COMM — R17 Photo / Media / Cover read-only preflight

## Source and acceptance boundary

Owner continuation of Draft PR #134, following R17 131-file Gallery Comments and Photo Writer repair. New source migration `20261025002960_gallery_photo_media_readonly_preflight_r17.sql`, bringing local Source to 132 migrations. The SQL addition does not enable previously disabled writers or change R17 old Comments/Photo behavior. A signed user-session query `galleryPhotoMediaPreflight` in `community-query` invokes service-only `community_gallery_photo_media_preflight_r17(subject,workId)`. This is an observational contract, **not** an optimistic concurrency writer pin.

Version boundary: Nintendo Switch DDV v1.25.0 BID 52BD625D9B4E0053 schema624 is the verified subject scope. Switch v1.25.3 schema626 is read-only; Steam/native save writers remain unsupported. Community metadata observation itself must not promote any game writer.

## Current R17 graph: CONFIRMED source names, not full graph authority

- `community_works` / `community_work_revisions`: owner, creator, lifecycle, rowVersion, current revision and historical immutable revisions.
- `work_revision_media` → `media_assets`: each current and historical media reference, ordinal/role, stored owner, processing/moderation/purge state, recorded byte count, MIME and declared SHA256. **Declared SHA is not independently downloaded object proof**.
- `gallery_photo_revision_fields`: immutable cover Media ID, bound verified Photo subject and whether the cover occurs among that revision's media refs, including ordinal-zero.
- `gallery_photo_subjects`: immutable Work/subject/owner/creator binding.
- `preset_artifacts.associated_gallery_work_id`: direct Scene and other facet dependencies, counted but not authorized.
- `gallery_revision_presets` → `community_work_revisions`: historical Preset attachment count across all Gallery revisions; source's old Photo Writer remains fail-closed when present.
- `community_media_upload_intents` and Storage object paths remain separate upload/physical data-plane state; this preflight intentionally does not return Storage key, private object path, bearer or capability token.

## Actual source issuer and cleanup catalog (bounded)

| Source Edge | Issuer/data-plane path | Authority status |
|---|---|---|
| `community-media` | `createSignedUploadUrl` for Gallery prepare; downloads and hashes bytes for Finalize | Source-observed; independent signed PUT/Storage byte proof pending |
| `community-media` | `createSignedUrl(...,300)` for DreamSnaps judge and non-Gallery legacy owner media | Existing independent exception paths; do not globally disable DreamSnaps |
| `community-public-media` | Gallery managed per-request byte proxy; legacy DreamSnaps signed fallback `createSignedUrl(...,300)` | New Gallery gateway bypasses new raw URL minting; old already-issued tokens unrevoked |
| `wep-preset-artifact` | `createSignedUploadUrl`, `Storage.copy`, `createSignedUrl(...,300)`, conditional `Storage.remove` | Separate Preset Storage origin; not enrolled with Photo/Cover/Cloud all-writer authority |
| `community-retention` / provider operations | physical storage worker and deferred removal | Legal, provider expiry, active Media reference and CDN effects not accepted |

This is a bounded catalog from source. It is not a proof that every dynamically called RPC, trigger, external Storage provider, Cloud retention path or previous signed URL issuer has been found.

## Contract / privacy

Owner-only: Edge `withSupabase({auth:'user'})` enforces session authorization; SQL resolves active, unsuppressed account identity and requires owner and Creator/Photo subject binding. No anonymous/authenticated direct SQL EXECUTE; only service_role through Edge. Read-only SQL function marked STABLE, no stored state mutation or Storage SDK call. Invalid actor/non-owner/non-Photo Work returns terminal `R17_PHOTO_PREFLIGHT_FORBIDDEN`, mapped by Edge to HTTP403.

Fields returned: contract/version, Work owner/Creator/subject, rowVersion/current revision, historical revisions, media refs and declared byte/hash/mime/status, cover refs and per-revision consistency, direct+history link counts, incomplete-bounds flags. No Storage key, signed URLs, identity tokens, or private bytes. Snapshot is deliberately **not an atomic mutation fence**; read→write races remain possible.

Always false: `actualStorageBytesVerified`, `metadataSha256IsStorageProof`, `priorSignedUrlsRevoked`, `cdnBrowserPurgeProven`, `storageIssuerGraphComplete`, `graphComplete`, `mutationAuthorized`, `saveRevisionAuthorized`, `pairedGalleryPublishAuthorized`, `retirementAuthorized`, `physicalCleanupAuthorized`.

Always blocked: verified provider bytes/SHA, cover issuer graph, old bearer replay, historical completeness, all-facet writer graph, atomic mutation pin. Known direct/historical Scene links append separate deny reason. Metadata defects add `MEDIA_COVER_METADATA_INCONSISTENT`, but an empty returned list never grants write authority.

## Validation, deployment, and next

Local source automated: full project Node contract test; isolated empty Supabase/bootstrap reset/replay count132, service-only SQL ACL, existing negative Gallery/Privacy test suite, 21 additive source reapplications. Tests that pass before a run completes must not be promoted. No staging migration/Edge deployment performed.

Independent 09 INT / 04 QR should pin the **new** exact Owner HEAD and verify *new* observer behavior, especially signed Owner vs nonowner vs retired/suppressed actor, current and historical refs/cover mismatches, and zero mutations. Do not rerun accepted R12–R17 old Photo/Comments writer tests without changed source. Actual post-download SHA256, CDN old bearer t0/60/300/expiry, signed A/B/M and 40P01/40001 injection remain operator-gated. Read-only Staging catalog was 116 managed historic migrations, **not** a prefix of Source131/132; never deploy 132 directly on top or rewrite ledger.

Existing gates unchanged: `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`; all positive Gallery retirement, Cloud Private/Restore, physical removal/finalized72h, Scene paired revision and native DDV writer/Apply OFF. All drafts DO_NOT_MERGE/DO_NOT_DEPLOY. R17 Product Tree 30 nodes PASS0/PARTIAL12/BLOCKED18; no R18.
