# 09 INT Gallery verified subjects / cross-product retirement — 2026-10-24

Request: `09-INT-GALLERY-PHOTO-SUBJECT-AND-RETIREMENT-V1` / Issue #110. Status: **PARTIAL / FAIL-CLOSED**.

## Authority and topology

Exact main: `52166f81c107de66dbfab8a6c16aaecc33b21ee0`.
03 COMM only Gallery API: PR #108 / `dev/community-gallery-public-lifecycle-20261023@a7a492254d9e5f571e41adf151e2fe893d84c813`.
09 INT integration branch is stacked on PR #108 (NOT on historical 09 INT PR #77), and intentionally does not merge PR #102 or #105.
PR #102 remains an independent Scene Preset product implementation; PR #105 remains WEB consumer awaiting accepted contracts.

## Reviewed subject source

Canonical identity and displayed region are separate. Never use screenshot labels, raw GridID, GridDataPath, house nickname or approximate item-name matching as a subject ID.

| Gallery subject | v1.25 source identity | reviewed seed count | status |
|---|---|---:|---|
| Decorations Outdoor / Biome | `ddv.outdoor-location-ref@1` with **VillageSceneItemId + AreaType** | 0 | UNKNOWN as complete official subject registry |
| Decorations Outdoor / Floating Island | `ddv.outdoor-location-ref@1` with exact **SceneItemId** | 13 | CONFIRMED v1.25 Core route audit |
| Decorations Indoor / Room | owner-specific House/Room identity, not a global GridID | 0 | UNKNOWN complete canonical photo subject enumeration |
| ToM Furniture / Base Item | exact Game DB confirmed eligible ToM Furniture Base Item ID | 0 | UNKNOWN; no positive reviewed Base Item pack |
| ToM Clothing / Base Item | exact Game DB confirmed eligible ToM Clothing Base Item ID | 0 | UNKNOWN; no positive reviewed Base Item pack |

The **13** audited Floating Island IDs are `1540000147, 1540000148, 1540000149, 1540000150, 1540000151, 1540000152, 1540000153, 1540000154, 1540000192, 1540000193, 1540000194, 1540000238, 1540000246`. These are SceneItemIDs (not save-local GridIDs); evidence is the immutable repo fixture `tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json`, Git blob `0140d2e416ecc1601f039e1fb1def277a6808e51`, which reports 13/13 map-key equality, 26 direct roots and cross-snapshot route parity. The source's pinned Switch v1.25.0 decrypted-profile SHA-256 is `1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10`. No private save bytes are included in this branch. This is version-scoped identity evidence, not native writer capability or entitlement proof.

Core-pinned 13-row enrollment SQL is `supabase/seeds/gallery-verified-subjects-v125-reviewed-20261024.sql`; it targets **the existing** `gallery_verified_subjects` table and conflicts on different provenance instead of silently overwriting a row. The positive adapter is `src/lib/integration/gallery-subject-provenance.ts`. It rejects unsigned/unreviewed kind and ID, absent Base Item proof, wrong platform/version/build/schema and mismatched evidence. v1.25.3 schema626 and Steam are not enrolled.

Until accepted registry enrollment is applied, these are **reviewed candidate rows**, not actual persisted `verified` rows. Rollback fixture rows do not count as persistent real registration or Gallery content seeds.

## Exact dependency graph

Primary graph owner is Community. It does not duplicate Gallery Work or PresetArtifact:

1. `community_works.work_id` → `gallery_works.work_id` owns PUBLIC media and revision identity.
2. `community_works.current_published_revision_id` → `gallery_work_revisions.revision_id` / `work_revision_media` pins the current media. Old media in historic revisions is NOT automatically public.
3. `gallery_revision_presets.gallery_revision_id` → `preset_revisions.preset_revision_id` → `preset_artifacts.preset_artifact_id`; historic reference does not create editable ownership.
4. PR #102 Scene one-to-one relationship: `preset_artifacts.associated_gallery_work_id` → Gallery Work, `preset_artifacts.community_work_id` → Preset Work. This optional column is only read if PR #102 has actually been deployed. Its absence is UNKNOWN, never no relation.
5. Biome/Floating Island/ToM Furniture/ToM Clothing Preset and native listing backend publications are **not deployed**; no speculative join or new item/preset domain. These remain UNKNOWN and prevent graph completeness.
6. Owner and Creator are exact `owner_account_id` and `creator_profile_id`; SavedItem is reuse/Library, not edit ownership.

The service-only, read-only `private.gallery_photo_dependency_snapshot_v1(workId)` returns known current/historical link references and the explicit coverage/unknown matrix. It never authorizes a retire operation. It does not expose a new Gallery publish API.

## Retirement negative gate

The canonical 03 COMM PR #108 already blocks linked Preset deletion, generic unauthorized Cloud Unpublish and exposure of hidden/deleted photo detail. The additive `20261024201000_gallery_retirement_negative_gate_v1.sql` further blocks classified PHOTO Work DELETE while previously issued Storage signed-URL revocation is unproven, with exact `GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN`. It is an add-on trigger; it does **not** alter or reimplement `community_publish_gallery_photo_v1`, `community_delete_gallery_photo_v1`, `community-command` or `community-public-query`. Moderation-state hiding paths remain separate.

Reason: revoking new URL issuance and search/detail authorization alone does not invalidate a previously issued signed media URL (currently up to **300 seconds**). A fully safe release requires a proven object-key revocation / media gateway / explicit TTL-and-retention acceptance model, plus signed URL negative tests. Until owner approval, **even unlinked Free Delete remains fail closed** on the integrated branch. No claim of immediate CDN revocation.

Cloud `Unpublish and Keep Private` remains disabled: no demonstrated paid Wand Cloud durable private Work store, account ACL, or restoration proof. Local PC backups are irrelevant to server-private durability.

A pure integration planner `planGalleryRetirement` reports typed blockers for UNKNOWN graph coverage, active public dependents, cross-owner dependencies, missing Wand Cloud preservation and issued-URL proof. Even a hypothetical clean read-only planner returns `GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED`; client code cannot grant authority or run unverified multi-command teardown.

## 08 WEB consumer handoff

`src/lib/integration/gallery-public-consumer-contract.ts` consumes the original `src/lib/community/gallery-photo-contract.ts` and exports typed `GalleryPublishAvailabilityV1` / `GalleryRetirementAvailabilityV1` plus the exact existing command/query names. Do NOT enable Delete or Cloud Unpublish merely because the button exists. Needs 03 COMM authorized verified-subject query/list response and complete retired-work authorization semantics before enabling.

Use `publishGalleryPhoto` for Create/Update only when subject is registry-issued and verified. Respect expectedVersion, idempotencyKey, 1..10 READY/CLEAR owned image IDs and originality attestation. Work stays linked to the exact owner+Creator. Gallery media belongs to Work, not a duplicated Preset cover bucket.

## Outstanding release acceptance

- Reviewed real subject enrollment for Biome/Room/ToM requires exact 01D provenance and stable authoritative target serialization. Current only Floating Island 13.
- Native/ToM public listing registration, atomic public retirement and projection revocation are not implemented; until then BLOCKED.
- Wand Cloud durable Private Work/ACL/recovery proof absent; Unpublish remains BLOCKED.
- Existing Storage signed URL immediate invalidation unproven; user-facing Delete remains BLOCKED. 03 COMM/CDN owner and 04 QR must resolve.
- 03 COMM must expose reviewed registry lookup under the **existing** trusted Community public-query boundary; do not grant client direct registry SQL access.
- GitHub Actions public staging values and authorized signed A/B/Moderator actors remain CONFIGURATION_BLOCKED; skipped Chrome E2E is NOT PASS.
- PRs #102/#105/#108/#113 remain unmerged pending controlled acceptance. No whole-release PASS.

Hard flags remain false: `persistentWriteAuthorized=false`, `WORLD_PERSISTENT_WRITE_V125=false`, `PERSISTENT_WRITE=false`, `productApplyAuthorized=false`, `directSourceReplacementAuthorized=false`.
