# DDVRE 03 COMM R17 — Legacy Gallery Comments and Photo Graph Authority Repair

Source-only candidate. Existing Draft PR #134, branch `verification/comm-clean-bootstrap-20261024`. R12 Privacy, R13 active retired identity, R14 ordered Gallery locks, R15 caller-pinned Graph and R16 registry/atomic metadata preserved. No direct modification to existing source 127 migration files. Native reference: Nintendo Switch DDV v1.25.0 BID 52BD625D9B4E0053 save schema624; Switch1.25.3 schema626 read-only and Steam native writers OFF.

## Independent P0 evidence inherited from 09 INT (not Owner test source)
- 09 INT R17 CI40239027187 CONFIRMED: old `community_set_gallery_comments_enabled_v2→v1` mutates Settings/Search/Audit with direct-only Scene Artifact held and WorkVersion unchanged, while R16 scoped writer rejects.
- 09 INT Photo CI40237805017 CONFIRMED: old `community_publish_gallery_photo_v1` existing-work Photo Revision update tested only historical links, so direct-only `preset_artifacts.associated_gallery_work_id` bypasses graph exclusion and commits while Artifact held.

## Additive Owner SQL repairs (new migrations only)
- `20261025002920_r17_legacy_gallery_comments_v1_closed.sql`: same-signature direct service/RPC v1 ALWAYS raises `R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED` before any Settings/Search/Audit/Idempotency effects. v1 is a Gallery-only RPC, no DreamSnaps support.
- `20261025002930_r17_legacy_gallery_comments_v2_dreamsnaps_preserved.sql`: same-signature v2, Gallery branch terminal raises `R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED`, **including direct RPC calls**. DreamSnaps branch retains under13 `managed_under13` check and immutable published Gallery/Entry constraints, updates only its existing DreamSnaps Search/Audit path. No implicit fallback to v1.
- `20261025002940_r17_gallery_photo_direct_history_guard.sql`: same-signature actual Photo Writer, before existing per-account/key advisory lock or committed-request lookup: active/unsuppressed Account Root `FOR SHARE`; existing target Gallery Work Owner/Creator `FOR UPDATE NOWAIT`; test *both* direct `preset_artifacts.associated_gallery_work_id` and historical `gallery_revision_presets→community_work_revisions.work_id`; any nonempty dependency denies terminal `R17_PHOTO_DEPENDENCY_NOT_ENROLLED`. Photo Work row lock serializes registered direct/historical reference inserts via existing `gallery_known_reference_writer_fence_v1` trigger. Under lock, before immutable Photo Revision insertion, same dual dependency guard repeated. Unsupported Photo+Scene/mixed/unknown authorizations remain negative, no new Graph SHA issuer or positive Scene Writer. Existing Photo Delete direct+historical denial untouched.
- `20261025002950_r17_gallery_comments_registry_denial.sql`: private R16 Writer registry old Gallery-comments entry explicitly `FAIL_CLOSED`; R16 scoped atomic Gallery metadata Writer remains only source-scoped allowed path (no Photo or Scene refs). No new public grants, no signed provider Data Access.

## Actual Source 2-connection acceptance
`tests/comm-r17-photo-legacy-comments-two-session.py` uses disposable synthetic active Account/Creator, Photo Gallery and Scene artifact/revisions, no real Storage bytes or signed JWT:
- Held Direct Scene Artifact in Session A while Photo existing Gallery update Session B attempts; `R17_PHOTO_DEPENDENCY_NOT_ENROLLED` terminal, no Revision/Outbox/Idempotency/Settings/Search/Audit/current pointer or WorkVersion partial mutation.
- Historical-only GalleryRevisionPreset and held GalleryWork in Session A; Session B fails `55P03` and rolls back; without lock historical-only terminal refusal.
- Direct+Historical simultaneously terminal no partial state.
- Direct old Gallery v1 and v2 comments RPCs fail while Scene Artifact held; no Settings/Search/Audit/Idempotency partial state.
- New R16 atomic metadata Writer continues to deny direct Scene.
- DreamSnaps managed under13 v2 enabling true fails; forced-off setting remains possible, no Gallery branch regression.
- Earlier R12/R13/R14/R15/R16 source fixtures preserved.

The original Gallery Photo Writer may still publish truly Photo-only material to metadata-backed Gallery without real Storage binary/PhotoCover SHA provider verification: this is NOT expanded Photo+Scene positive enrollment nor signed acceptance. All unknown references/media issuers remain failclosed for cross-graph claims.

## 09 INT independent next contract
Pin exact Owner PR HEAD after clean CI and empty bootstrap. Test **only new R17 branches**, not previously accepted R15 H0→H1/Replay. With independent real SQL two PG sessions:
1. Old Gallery comments v1 and v2 directly via RPC under held direct Scene Artifact both terminal no settings/Search/Audit/Idempotency or Gallery rowVersion mutation.
2. DreamSnaps v2 normal and under13 unchanged.
3. Photo existing Work update: direct-only Scene, historical-only, combined; held Artifact and GalleryWork; version/Creator/Owner/Account consistency, source atomicity, reference fence concurrent insertion lock ordering. No positive Photo+Scene promotion.
4. Check positive unrelated no-Scene Photo behavior not regressed; do NOT infer real provider bytes.
5. Privacy suppressed/retired actor and emergency Moderator restriction remain independent.
No import of independent validation branch into Owner.

## 04 QR future acceptance
Signed normal Owner A, non-owner B, Moderator M protected Staging; old Gallery v1/v2 direct API and command, R16 atomic metadata CAS; under13 DreamSnaps unaffected; Photo direct vs historical Work/Scene locks, real signed Storage bytes and CDN bearer t0/t60/t300/expiry and 40P01/40001/55P03 Edge fresh retry. Local synthetic Source PASS is not signed Staging/real Storage acceptance. Config/operator #130 remains external.

## 02 WEP return
Existing read-only R15 `preflightGalleryGraph` DTO remains unchanged; schemaVersion1 / `gallery-scene-scoped@r15` / server-issued `expectedGraphSha256` / Work row_versions and current+history dependency set. No silent pin refresh, no Scene Paired Owner positive Writer, no Product Apply.

## Safety
`graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`. Gallery Positive Retirement/Delete/Unpublish, Cloud Private/Restore, physical cleanup/72h TTL, Native Writer/Apply OFF. Draft / DO_NOT_MERGE / DO_NOT_DEPLOY. R17 Product Tree 30 PASS0 / PARTIAL12 / BLOCKED18 unchanged.
