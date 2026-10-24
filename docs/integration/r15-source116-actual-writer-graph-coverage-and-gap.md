# DDVRE — 09 INT R15 / Actual Owner Source116 Independent Enrollment & Graph Gap

2026-10-25 JST | Existing 09 INT | Not Release R18 | All branches Draft DO_NOT_MERGE

## Exact Source and upgrade trajectory

- R14 inherited Validation `358ed44ef56db4135e542280c58738374ba1e714`, CI `40098288833` SUCCESS: test-only one-Scene wrapper, **not** production enrollment.
- R15 initial independent 115-migration branch `validation/09int-r15-source115-multiwriter-graph-20261025`, code tests two *actual unmodified Source115* Gallery v4 publishes across **two Scene Artifacts / two PresetWorks / four GalleryWorks**; CI `40128633461` SUCCESS baseline, later HEAD includes explicit blocker PID proof and validation-only 3-attempt transient retry. Crucially Source115 Gallery v4 still **UNENROLLED**; that prior branch is not a proof against Owner Source116.
- During R15, 03 COMM Draft PR134 independently advanced to exact Source **`b11e25c277af2bc0f924ddb14b55e0bbabf42093`**, new **116th additive migration** `20261025002800_gallery_v4_actual_scoped_atomic_enrollment_r14.sql` plus Edge retry in `supabase/functions/community-command/index.ts`. 09 INT now separately validates actual code in `validation/09int-r15-actual-owner116-20261025`. No modifications to owner PR, no rebasing, no migration to actual remote Staging; new Source116 vs Source115 results remain separately pinned.

## Actual Owner Source116 contract — static SQL plus independent PostgreSQL test

**CONFIRMED SOURCE IMPLEMENTATION (limited):** actual production-signature `public.community_publish_gallery_v4` calls `private.gallery_v4_atomic_lock_scoped_r14(actor,owner,target,presetRevisions)` before its idempotency advisory lock. Internal helper locks `wand_accounts FOR SHARE`, computes known Scope registry `gallery-scene-scoped@r14`, refuses any `>1` reachable Scene Artifact (`R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED`), rejects unknown preset facets or mixed owners, locks sorted Artifact IDs (`NOWAIT`), sorted PresetWork rows (`NOWAIT`), sorted GalleryWork rows (`NOWAIT`), recomputes same DB graph Snapshot under locks, checks Actor+Privacy again and Creator consistency. v4 itself checks Gallery rowVersion, owner, moderation and expected current valid lifecycle. Graph candidate includes Artifacts, their PresetRevisions and Publications, historical GalleryRevisionPreset, all reachable community_works/current pointer/status/versions, WorkRevisions, WorkRevisionMedia, GalleryPhoto Covers. It is **not a complete cross-product registry** (other facets, Cloud, retention holds, Native and all issued media URLs), and no client expected Graph Fingerprint is passed.

**Source code security caveats:**
1. Snapshot-before/after-lock equality protects an in-flight graph mutation, **not caller-staleness before request execution**. The actual v4 signature lacks `p_expected_graph_sha256`. A Work RowVersion can remain unchanged while a historical GalleryRevisionPreset edge is inserted; the source can still publish an outdated user intent if target Gallery rowVersion matches. Owner Source tests explicitly log `callerPinnedHashContractAvailable=false`.
2. `FOR UPDATE NOWAIT` is a 55P03 **immediate refusal**, not a long physical blocker wait. Account `FOR SHARE` can wait for suppression root. Never claim `pg_blocking_pids` for NOWAIT acquisition; positive stop and rollback are still valid evidence.
3. The account+Artifact→PresetWork→GalleryWork scope is single-known-Scene or Gallery no-Preset. A second linked Artifact is deliberately terminally fail-closed. This is safer than broad positive authorization but not equivalent to universal multi-Artifact consistent ordering.
4. New Edge retry is **SOURCE-SCOPED** to command `publishGallery`: maximum 3 RPC calls within ~1.7s, 30–95ms jitter, rechecks `community_authorize_session` before attempts 2/3, catches SQLSTATE 40P01/55P03/40001 or `R14_GRAPH_CHANGED_RETRY_WHOLE_TRANSACTION` and roster changed error. Each Admin RPC is new PostgreSQL transaction, no savepoint retry; semantic errors remain terminal. **Independent signed live Edge retries not yet tested**, and the code does not pass an externally pinned Graph hash to each attempt.
5. The 115th migration `20261025002700_active_identity_regular_resolver_guard_v1.sql` enforces active AuthIdentity and `retired_at IS NULL`. Source 115 04 QR #141 synthetic negative PASS; R15 Source116 inherits it. Real JWT acceptance remains unresolved.

### R15 Owner Source116 independent direct RPC test

`tests/09int-r15-actual-owner116-independent.py` on Source116 isolated disposable Postgres:
- A holds Preset Artifact and B invokes **actual Source116 v4 without wrapper**; B errors 55P03; entire B transaction rolls back and Source v4 succeeds in freshly begun **rollback-only** B transaction after A release;
- A holds Account root and B invokes actual v4; same 55P03/full rollback; the distinct Account path may wait before timeout;
- After recording Graph Snapshot, insert **unsealed historical GalleryRevisionPreset edge** to original associated Gallery while leaving target Gallery RowVersion unchanged. Owner scoped Snapshot changes; stale caller can still call actual v4 successfully (rollback-only), because there is no expected graph-pin parameter. This is a **CONFIRMED NEGATIVE**, not approval of stale caller semantics;
- Introduce second associated Scene Artifact to the target Gallery (using synthetic second fixture) and invoke actual v4: `R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED` denies before mutation; WorkRevision/Search/Outbox unchanged. This confirms an honest **FAIL_CLOSED** limited registry.
- No Source115 previous test scenarios or R11–R14 tests rerun; shared test fixture module imported only.

**Do not claim independent pass before final exact HEAD CI SUCCESS.** Staging and Storage/CDN not touched; rollback-only test commits only synthetic fixture/historical edges to discarded ephemeral local DB.

## R15 Updated Actual Writer Coverage Matrix

Legend `SOURCE_SCOPED_ENROLLED` is not global; `SAFETY_INDEPENDENT` means emergency negative can commit, `FAIL_CLOSED` means disabled positive, `UNENROLLED` is no common transaction, `UNKNOWN` incomplete registry. **FULLY_ENROLLED = NONE**.

| Actual Edge / RPC | Signed Actor / Account | Work/Artifact locks | Ref/Version, Outbox/Retry | Status |
|---|---|---|---|---|
| `community-command.publishGallery` → `community_publish_gallery_v4` | Signed Edge with `community_authorize_session`; active non-retired resolver Source115; **Account FOR SHARE inside Source116** | **Sorted Artifact, PresetWork, GalleryWork NOWAIT** for zero or single known Scene, actor+creator recheck | Snapshot pre/post, expected target `row_version`, Search+Outbox+idempotency in DB transaction; Edge bounded 3 Whole-RPC transient retries; **NO caller expected Graph Fingerprint** | **SOURCE_SCOPED_ENROLLED** for restricted Source116, never global |
| `community-command.publishGalleryPhoto` → `community_publish_gallery_photo_v1` | signed session and Gallery owner | Gallery Photo lock; media/cover but not global older Preset/cross-kind | local RowVersion/media READY; other references/old issued URL not closed | **UNENROLLED** all-writer |
| `wep-preset-artifact.publish` → `community_publish_preset_envelope` | signed session, owner+creator | initial Artifact/PresetWork create; no all related Galleries | initial idempotency, no all-kind graph | **SOURCE_SCOPED** only create, not all-writer |
| `private.scene_save_revision_paired_candidate_v1` | DB-owner-only EXECUTE revoked for anon/authenticated/service; not public | Artifact→PresetWork→GalleryWork (Scene), maybe Media shared, not new Account-first global source | expected Work versions/current Revision + R9 historical edge-only pin, no full all-kind graph/retry | **SOURCE_SCOPED_INERT** |
| `community-command.changeVisibility/unpublishWork/deleteWork` → generic owner RPC | signed actor, target Work lock | Preset positive blocked by `PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED` | target version, incomplete Gallery reverse graph | **FAIL_CLOSED** |
| Legacy Scene Unpublish/Delete | old Staging functions | Artifact then unordered related Work updates, Source parity not accepted | no full Work graph/Owner caller pin | **UNENROLLED / OFF** |
| Three known ref triggers (GalleryRevisionPreset / PresetArtifact assoc / PresetRevisionPublication) | internal SQL | R11 3/3 Gallery lock contention, not universal lock order | no caller full dependency pin | **NARROW_SOURCE_SCOPED** |
| Gallery positive retirement/unpublish/delete/Cloud Private/restore | entrypoints exist; normal signed actor not sufficient | physical Storage/old bearer/CDN and historical dependent refs unapproved | Cloud Guard stays enabled, no destructive authorizer | **FAIL_CLOSED** |
| `community-command.moderateWork`, `community-admin.moderateCase` | signed moderator/staff case | emergency restrict independent of optional graph cleanup | safe immediate public read suppression, Outbox/audit | **SAFETY_INDEPENDENT**; positive Restore needs full graph |
| `community-account.deleteAccount` → Privacy Suppression | verified recent Auth and account FOR UPDATE | no Gallery/Media positive retirement locks | durable Account read Search/Creator/Media deny, idempotent `suppressed_cleanup_pending`, full Erasure not complete | **SAFETY_INDEPENDENT_SOURCE_PARTIAL** |
| Deferred retention, Media URL issuers, Cloud clean up | worker token/user session; physical object handling | Storage/URL/Cover/holds historical registry incomplete | previously issued bearer URL and CDN not revoked immediately | **UNENROLLED / OFF** |
| All five Wand Facets, Native/In-Game Preset refs, DreamSnaps contexts | distinct current/publication semantics | cross-kind graph registry not closed | unsupported version/writer disabled | **UNKNOWN→FAIL_CLOSED** |

## Owner Contract / Workstream Actions

**03 COMM**: Preserve the real Source116 Gallery-first scoped enrollment and active Identity fix; extend safe constraints rather than widening grants. Priority (1) add caller `expectedGraphSha256` and explicit registry ID + versioned serialized edges with tested canonicalization; (2) account/owner/creator under lock and old/new cross-type reference closure before multi-Artifact permission; (3) strong discipline for Search/Outbox/idempotency and bounded retry semantics (must reauthorize real signed actor *every* attempt even first, not only Edge middleware); (4) maintain moderation negative and Privacy phase1 independent; (5) all positive Delete/Unpublish/Cloud/Restore still fail closed. Do not expose an internal graph helper via service-role grants.

**02 WEP**: Offline Scene Intent must contain actual capture closure including required SubGrid descendants/Scene Region/Include RoadFence containment, blob SHA256 byte size/owner, Media Cover receipt, Artifact+PresetWork/current revision/rowVersion, associated Gallery/current revision/rowVersion and independent `scene-historical-edges-v1` **plus** future registry-versioned full graph caller hash. Owner readiness non-atomic. `saveRevisionAuthorized=false`, no native DDV writer.

**04 QR**: Test exact Source116+new successors in protected signed normal OwnerA/NonownerB/Moderator M Staging. Positive: valid one-Scene and no-Preset Gallery v4, real uploaded byte SHA/cover, account/Artifact ordered locks, idempotency stable after transient. Negative: held Artifact 55P03/source retry bounded; retired identity/current session revocation mid-retry; one target Gallery RowVersion unchanged but add historical edge after client preflight—must FAIL until caller pin added; add 2nd Scene to target—must failclosed; unsupported Biome/Floating Island/ToM categories, Cloud historical Media. Moderator Restrict continues while Account Suppression commits; positive restore and physical cleanup disabled. Sign and replay OLD issued Storage URL at t0/t60/t300/post expiry with CDN cache headers. None of these synthetic tests are signed E2E.

## Hard release gates

`graphComplete=false`, `retirementAuthorized=false`. Gallery Positive Delete/Unpublish/Cloud Private/Restore OFF; physical cleanup/finalized72h TTL OFF; Native DDV Persistent Writer/Product Apply OFF. v1.25.0 Nintendo Switch BID52BD625D9B4E0053 schema624 only for verified read model; v1.25.3 schema626 and Steam Native Writer OUT. Draft PRs DO_NOT_MERGE. R17 30 Product Tree PASS0/PARTIAL12/BLOCKED18; no R18.
