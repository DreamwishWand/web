# DDVRE — 09 INT R10 / Actual Known Gallery Reference Writer Lock Contention (Isolated)

Status: **Validation-only candidate / no source PR merge / not release acceptance.**

Context: The cross-product requirement is that any mutation to a Gallery's current/historical linked-Preset graph serialize with a Scene paired writer's `GalleryWork FOR UPDATE` lock. The accepted production writer registry is **not yet complete**, but migration `20261025002400_gallery_known_reference_writer_fence_v1.sql` enrolls three narrowly known reference writers. R9 established a caller-pinned historical edge digest only for the Scene association.

## Executed test specification

This R10 isolated branch derives from R9 and reuses the 113-migration ephemeral full-schema PostgreSQL fixture (strictly localhost:54322, synthetic owner and media metadata; no actual Staging or real Storage).

The new test `concurrent_known_reference_edge_insert`:

1. Confirms the `gallery_revision_presets_known_reference_fence` is enabled.
2. Commits a new unsealed `community_work_revisions` and `gallery_work_revisions` pair referencing the same Gallery Work **before locking**, with no preset dependency edge yet; checks the Scene historical-edge digest and both Work versions are unchanged.
3. Session A acquires `SELECT ... FROM public.community_works WHERE work_id=GalleryWork FOR UPDATE`.
4. Session B attempts **direct actual table INSERT** into `public.gallery_revision_presets` for the precreated Gallery Revision and existing PresetRevision, with a short local lock timeout. A observes B's backend PID in `pg_blocking_pids`; B must produce SQLSTATE `55P03`, roll back, and leave the graph digest intact.
5. After A unlocks, B repeats the same edge insertion in a fresh transaction, sees the edge in its own transaction, then deliberately rolls back. This proves the known INSERT trigger contributes the Gallery lock without claiming that it covers other Writer types.

The existing R8 2-session Scene writer and R9 stale-caller/fresh-pinned edge tests are retained, not replaced.

## Expected evidence interpretation

**If exact-head Actions is SUCCESS**, this establishes `CONFIRMED: KNOWN gallery_revision_presets INSERT row lock enrollment in an isolated full-schema DB`. It does **not** establish universal reference tracking, all Writer ordering, current-revision mutation enrollment, source–Staging parity, Auth/RLS, signed Owner A/B/Moderator, durable Blob/Media object hash checks, URL revocation, operator policy or positive dependent retirement.

R10 test isolation: `validation/09int-r10-known-edge-contender-20261024`, no changes to original 09 INT Draft PR #123 or 03 COMM PR #134. Unlike R9, R10 adds **no additional SQL schema mutation**, only a live 2-session integration test and its Actions wiring.

## Remaining writer coverage (not enrolled / unaccepted)

- Generic `community_change_work_visibility`, `community_unpublish_work` and `community_delete_work` for Preset Work: 03 COMM currently hard-denies positive owner operations, not a solved transaction.
- Legacy Scene Unpublish/Delete and all Gallery-first reference/status/current revision writers: no all-kind lock graph.
- ToM Furniture/Clothing, Biome, Floating Island and Native/In-Game registry reference types: semantic completeness unresolved.
- Moderation and lawful account erasure must remain available and must enforce immediate public read suppression, even when ordinary publish/delete blocked.
- Signed normal-account HTTP/Storage and old issued Media URL/CDN proof in disposable Staging unavailable; parallel writer 40P01/55P03/40001 bounded new-transaction retry not accepted.
- The R9 Scene historical-edge digest covers a *subset* of graph edges. Full current + historical reference registry and under-lock caller-authorized graphFingerprintSha256 across product types required. Do not treat `Work.row_version` as a graph fence.

Gates remain: `graphComplete=false`, `retirementAuthorized=false`; Gallery positive Unpublish/Delete/Cloud Private/Restore, physical media cleanup and 72-hour TTL, native DDV save writers and Product Apply **OFF**. All Draft PRs remain DO_NOT_MERGE; R17 release matrix unchanged.

Owner handoff: 03 COMM should enroll remaining source RPC writers under a globally verified lock order and actor/idempotency/graph snapshot protocol; 02 WEP remains read-only/offline intent; 04 QR validates signed disposable Staging A/B/M, actual bytes/CDN replay and true multi-session lock source once a production-safe Edge/DB contract exists.
