# 03 COMM — Gallery PUBLIC Photo Work Lifecycle (V1)

**Result:** PARTIAL / WAIT_ON_09_INT + CDN_REVOKE + CONFIGURED_SIGNED_E2E  
**Owner:** 03 COMM. **Request:** `03-COMM-GALLERY-PUBLIC-WORK-LIFECYCLE-V1`.  
**Consumer:** 08 WEB draft PR #105 (HEAD `96c902609a495289b6c0dcec9979d371cee10788`).  
**Parent:** Issues #106, #104. **Target:** Switch DDV v1.25.0 / BID `52BD625D9B4E0053` / schema 624. No save writer is enabled.

## Delivered interfaces

### Service-only SQL/RPC

- `community_publish_gallery_photo_v1(authSubject, creatorProfileId, workId nullable, expectedVersion nullable only for new, galleryKind, subjectId, title, description, mediaIds, coverMediaId, originalityAttested, idempotencyKey)`
- `community_delete_gallery_photo_v1(authSubject,workId,expectedVersion,idempotencyKey)`
- `community_get_gallery_photo_public_v1(workId)` exposed through fixed public-query Edge allowlist (NOT anonymous direct RPC)
- `gallery_verified_subjects`: trusted, versioned, evidence-ref-backed 09 INT subject registry. Only `verification_state=verified` accepted. Registry is **empty by design** pending Game DB provenance.
- `gallery_photo_subjects`: immutable creator/account/type/target binding to one Work.
- `gallery_photo_revision_fields`: revision-scoped canonical subject, cover and provenance attestation.

### Edge

Signed `community-command`:

- `publishGalleryPhoto` (same command for creation and immutable update)
- `deleteGalleryPhoto`

Public `community-public-query` allowlist:

- `community_get_gallery_photo_public_v1` keyed by `p_work_id`

Typed contract `src/lib/community/gallery-photo-contract.ts`: `PublishGalleryPhotoV1`, `PublishGalleryPhotoResultV1`, `DeleteGalleryPhotoV1`, `GalleryPhotoErrorCode`.

Existing signed JWT + session cutoff, `gallery_write` rate bucket, service-role-only SQL grants and pre-existing media upload pipeline are reused. No Auth/RLS relaxation.

## Exact semantics of current bounded implementation

1. **New PUBLIC Work:** 09 INT verified subject gate; 1–10 distinct owner-READY/CLEAR media; PNG/JPEG/WebP, non-zero geometry, <=20MiB; explicit originality attestation; title, creator and cover. Existing `create_gallery_work_v1` and `publish_gallery_v4` run in **one SQL transaction**; failure rolls both back. The cover becomes ordinal 0, remaining image order preserved. No persistent free server-private draft.
2. **Immutable Publish Update:** requires existing bound subject and same owner+Creator, kind, target, and current row version. Inserts new community/gallery revision and work_revision_media; canonical pointer promotion auto-seals via existing trigger; a failed operation keeps previous PUBLIC revision. Stable Work ID preserves legitimate SavedItem/Social identity.
3. **Target binding:** `outdoor` = verified `biome` or `floating_island`; `indoor` = verified `room`; ToM `tom_furniture`/`tom_clothing` includes exact registry-backed `base_item_id>0`. This is metadata provenance, **not** a claim that items, designs, motifs, DDV ownership or importability were inferred from screenshots.
4. **Free Delete:** existing `community_delete_work` is wrapped and gated. For unlinked classified photo-only PUBLIC Work, deletion atomically removes public search and revokes new direct detail/media authorizations. Related Preset-artifact bindings or Gallery revision Preset relations fail closed `GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED`. A legacy generic delete cannot circumvent this new guarded Work transition.
5. **Cloud Unpublish/Keep Private:** **not authorized**. Generic unpublish or visibility-private transition on a classified PUBLIC photo Work is now blocked via DB trigger until 09 INT provides validated private preservation and atomic dependent retirement. `GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED`.
6. **Old signed media URLs:** new calls to public-media resolver are revoked immediately by current Work visibility, but an **already issued** storage/CDN signed URL (current TTL up to 300 seconds) may remain usable. Therefore immediate CDN revocation is **NOT PROVEN**, and the full Delete/Unpublish release job is still PARTIAL.

### Stable Edge error shape

`{ok:false,error:GALLERY_*|CONFLICT|FORBIDDEN|RATE_LIMITED|COMMAND_FAILED,message?:string}`

Typical error codes: `GALLERY_VERIFIED_SUBJECT_REQUIRED`, `GALLERY_MEDIA_SELECTION_INVALID`, `GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED`, `GALLERY_CREATOR_FORBIDDEN`, `GALLERY_ROW_VERSION_CONFLICT`, `GALLERY_SUBJECT_OR_CREATOR_IMMUTABLE`, `GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED`, `GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED`.

Positive response: `{ok:true,command:'publishGalleryPhoto',data:{workId,revisionId,rowVersion,visibility:'public',lifecycleState:'published',creatorProfileId,galleryKind,subjectId,subjectType,canonicalTargetId,baseItemId,platform,gameVersion,buildId,profileSchema,coverMediaId,mediaIds,created}}`.

## 09 INT dependent-artifact contract

**Required input** from 09 INT / 01D Game DB:

- Provide reviewed versioned `gallery_verified_subjects` records (exact `canonical_target_id`, classification, exact ToM `base_item_id`, platform/game/build/schema, `evidence_ref`). Never backfill a `verified` record based on client input, screenshot, or unsupported Switch/Steam v1.25.3.
- Resolve Presets-originated one-to-one Gallery linkage and native/ToM public-listing dependencies without duplicating Work/media/Social ownership.
- Transactionally revoke dependent PUBLIC Preset/ToM/native listings before or with Gallery Work delete/unpublish, including discoverability, deep links and apply/reuse entry points; preserve unrelated native game-issued codes/save state. Use a single DB transaction or an access gate that is **fail-closed before asynchronous cleanup**.
- Keep `preset_artifacts.associated_gallery_work_id` and `gallery_revision_presets` semantics; do not treat a mere historic citation as a reason to delete an independent source artifact. Explicit ownership and dependency contracts required.
- Permit Preset-only delist without hiding original Gallery photo when the product contract allows it.
- Prove a Wand Cloud private source has been durably preserved **before** any `Unpublish and Keep Private` transition. Do not turn PUBLIC CommunityWork into an unproven free server-private record.

**Cross-product unresolved:** no automated ToM/native listing graph exists here; deleting a photo with unrecognized indirect dependencies cannot be called globally safe. 09 INT must return the dependency graph plus atomic revocation interface. For CDN old signed URL cancellation, coordinate access-controlled delivery/object-key revocation or equivalent with 04 QR and infrastructure owner. Existing private bucket resolver denial is necessary but insufficient.

## Evidence and acceptance boundary

- Staging project: `ptpdoxhrqopvczpclcij` only, **no production resource mutations**.
- Applied staging migrations (in order):
  - `20261023223000_community_gallery_photo_lifecycle_v1.sql`
  - `20261023223200_community_gallery_photo_revision_seal_order_v1.sql`
  - `20261023223400_community_gallery_photo_existing_seal_trigger_v1.sql`
  - `20261023223600_community_gallery_photo_null_version_guard_v1.sql`
  - `20261023223800_community_gallery_photo_fk_indexes_v1.sql`
- The intermediate 223200 seal-order migration was superseded by 223400, which deliberately consumes the **existing** `seal_current_work_revision` trigger. Preserve applied migration order; do not squash migration history behind staging.
- Rollback-only staging SQL: `supabase/staging/acceptance/gallery-photo-public-lifecycle-v1.sql`. It executes real DB procedures, tests all category branches and negative paths, then `ROLLBACK`. **No canonical subject seed or media fixture remains**.
- New classification publication's server source is implemented and exercised with temporary test subjects; **no real Game DB registry subject has yet been accepted**. This limits actual 08 WEB release enablement.
- Signed Chrome remains CONFIGURATION_BLOCKED by missing GitHub Actions public Supabase variables and existing authenticated A/B/Moderator sessions. Workflow SUCCESS with skipped browser checks is NOT E2E PASS.
- QA must also test Supabase Storage signed-URL behavior, real upload, ownership/moderation, ordinary/Cloud distinctions, idempotency and 09 INT dependent retirement.
- PR #105 and PR #102 remain DRAFT / DO_NOT_MERGE; Gallery photo publishing never promotes persistent DDV save writers.
