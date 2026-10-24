# 09 INT R11 — All three known Gallery reference trigger writers, independent sessions

## Purpose

09 INT Issue #119: Prove the *source-level* Gallery Work lock coverage of the three installed known trigger edges, not merely the R10 `gallery_revision_presets INSERT` path.

**Strict scope:** independent validation branch `validation/09int-r11-pr134-all-known-writers-20261024` derived from 03 COMM Draft PR #134 source HEAD `8c4af953be94c6d7564df4df450375dc84cb6dfb`. 03 COMM independently advanced to HEAD `1413d026e62c35cdc463946597796cb329d9be85` after branch creation, adding only owner-scoped read-only readiness fields/fixtures; existing paired writer and three reference trigger source logic unchanged. Do not represent R11 as exact latest-readiness-head source. All source files remain unmerged and disabled for positive Gallery retirement.

## Isolated test

1. Apply all 113 SQL migrations to a newly created local-only Supabase CLI Postgres at 127.0.0.1:54322; synthetic owner/Creator, GalleryWork, PresetWork, PresetArtifact, existing current and historical paired Scene references, owner READY media metadata (no object bytes).
2. R8: paired Scene DB-owner inert candidate waits behind held GalleryWork lock, 55P03 aborts whole SQL transaction, fresh owner-only retry executes solely inside rolled-back local transaction.
3. R9: another unsealed historical GalleryRevisionPreset edge to the SAME GalleryWork changes historical SHA while Work versions and current published PresetRevision remain constant; original caller historicalEdgeSetSha256 must be rejected with no persistent effects, refreshed pin may execute only in rollback.
4. R10: precreate unsealed GalleryWorkRevision *before* A holds GalleryWork FOR UPDATE; separate B attempts real `gallery_revision_presets INSERT`; verify `pg_blocking_pids`, 55P03 and rollback. After unlock, reattempt local INSERT but roll back.
5. R11A: A holds GalleryWork; B performs real `UPDATE preset_artifacts SET associated_gallery_work_id=associated_gallery_work_id` on existing artifact (same owner/current association). Verify GalleryWork lock, 55P03, whole B rollback and no rowVersion/graph change. After unlock, repeat in rollback.
6. R11B: precreate new unsealed **PresetWorkRevision** BEFORE A's lock; B performs real `preset_revision_publications INSERT` referencing existing PresetRevision while A holds linked GalleryWork. Verify blocking A's PG backend, 55P03 and no effects. After unlock, the same INSERT can proceed within rolled-back local B transaction.
7. R11 exercises 3 enabled known trigger names; no RLS/Auth/Storage bytes/CDN, public Edge, native writer or users. No SQL changes to 03 COMM-owned source.

## Interpretation and safety

`KNOWN_REFERENCE_TRIGGER_LOCKS_LOCAL_PASS` verifies one FK/reference relation writer **path per installed known trigger**, not all current/history states nor any universal atomic graph. In particular:
- Generic owner Work visibility/delete/unpublish is hard-denied for Preset, not enrolled;
- Scene legacy unpublish/delete, Gallery-first publisher/update, all kind-specific preset/native listings remain unenumerated;
- Moderator safety takedown and account erasure must keep immediate privacy suppression; cannot remove those paths to game the lock gate;
- A GalleryWork lock acquired by a trigger after other row locks can still create opposing global lock orders; this test only proves wait behavior, NOT deadlock-free multi-writer serialization;
- Scoped historicalEdgeSetSha256 still does not fingerprint all current+historical cross-product dependency types; backend must re-pin complete caller-authorized graph under one globally enrolled lock order;
- Bounded retry of **whole transaction** for transient 40P01/55P03/40001 must freshly resolve actor/owner/graph. Stale graph remains terminal;
- Signed normal Owner A/Owner B/Moderator Staging, ACL/RLS, actual stored Blob/Media checksums and old signed URL/CDN replay not tested.

`graphComplete=false; retirementAuthorized=false`. No positive Gallery Unpublish/Delete, Cloud Private/Restore, physical cleanup/72h TTL, or native DDV Writer/Product Apply. Draft PRs remain DO_NOT_MERGE. R17 release gate unchanged.

## Cross-stream returns

- 03 COMM: incorporate cross-writer protocol only after evaluating a **complete writer enumeration**, directional lock order, source/live function parity and rollback; current source R9 caller scoped hash remains a safety improvement but non-atomic.
- 02 WEP: owner readonly paired Gallery Work rowVersion/current revision hints are non-atomic; keep offline Save Revision intent, no server mutation.
- 04 QR: re-pin only after owner approved combined backend plus protected normal-user disposable staging and real Storage/CDN testing.
