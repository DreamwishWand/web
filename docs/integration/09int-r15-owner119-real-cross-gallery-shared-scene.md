# DDVRE 09 INT R15 — Actual Owner Source119, Two Gallery Writers Sharing One Scene

Date: 2026-10-25 JST. Continuation of existing 09 INT / Cross-Product Integration. This is R15, not Release Acceptance R18.

## Source, provenance, and why this is a new acceptance case

- Pinned 03 COMM Draft PR #134 HEAD `7414e0666a2afa55709b874d3e2dee5fbd970df9`, **119 migrations**. Difference from prior 03 COMM source pin `983b03edf17f8ec27ba857feb445d07f228a0b64` consists only of Owner docs and changes to its Owner test fixture, not the production SQL/Edge writer. No direct modifications to #134, #135, or QR branches, no rebase.
- Prior independent 09 INT Source119 branch `validation/09int-r15-owner119-actual-source-20261025` HEAD `717eb253e0ac433d2ca63eb79e98fa8a8481628a` [Actions 40130192359](https://github.com/DreamwishWand/web/actions/runs/40130192359) COMPLETED SUCCESS. It proved **actual** Source `community_publish_gallery_v4` Account/Artifact waits, 55P03, multi-artifact reject, and missing caller historical graph pin. Do not rerun or conflate that work.
- This addendum independently tests **TWO actual Gallery v4 Writer transactions on DIFFERENT Gallery Work IDs but the SAME live Scene Preset Artifact**, with the first transaction committed and a second operation issued from a stale pre-commit graph view. Uses one PresetRevision per Source call, satisfying real Source constraint.
- New validation branch `validation/09int-r15-owner119-cross-gallery-race-20261025`, test `tests/09int-r15-owner119-real-cross-gallery-shared-artifact.py` and isolated workflow `.github/workflows/09int-r15-owner119-cross-gallery-shared-scene.yml`. All source Graph/Lock logic remains 03 COMM-owned; no alternate Python lock wrapper.

## Actual SQL lock and authority contract

`community-command.publishGallery` (authenticated Edge user, `community_authorize_session`, and service client executing SQL on behalf of verified actor) calls `public.community_publish_gallery_v4`. Latest 119-Source migration `20261025002820_gallery_v4_actual_writer_enrollment_r14.sql` introduces `private.gallery_v4_atomic_lock_scoped_r14` inside the RPC: account root `FOR SHARE` → up to one supported Scene Artifact `FOR UPDATE NOWAIT` → sorted associated PresetWork `FOR UPDATE NOWAIT` → sorted linked GalleryWork `FOR UPDATE NOWAIT`, twice-read `private.gallery_v4_scoped_graph_r14`, owner/Creator/active Identity/privacy recheck. v4 target Gallery RowVersion and idempotency, immutable revision, Search and Outbox atomic with SQL. The Edge `publishGallery` caller retries selected SQLSTATE `40P01/55P03/40001` on separate Admin RPC calls at most 3 attempts (bounded ~1.7 s) with session reauthorization, but **no actual signed Edge retry** is executed in this isolated DB-only test.

**Important gap**: although the Source calculates and compares an internal before/after scoped snapshot, the SQL RPC and public Edge action expose **no `p_expected_graph_sha256` / `expectedGraphSha256` input**. Therefore stale preflight after another Writer committed a historical `gallery_revision_presets` edge can still publish with unchanged target Gallery RowVersion. A bounded retry must never authorize a changed caller graph as if it were unchanged; stale actor/work/graph is terminal. This is an **optimistic authority gap, not proof of an ownership bypass**.

## Two actual Source Writers test, exact expectations

- Create a synthetic Owner/ScenePreset/Media READY fixture, plus Gallery A and Gallery B new draft Works with same Creator and one Scene PresetRevision.
- Compute Gallery B old scoped Graph before Writer A; assert single known Scene Artifact.
- Session A: `BEGIN`, execute actual Gallery v4 Publish A to insert immutable WorkRevision, `gallery_revision_presets`, Search, Outbox and Idempotency; hold locks until commit.
- Session B: `BEGIN`, real Source Gallery v4 for independent target Gallery B, `SET LOCAL lock_timeout='800ms'`, expect SQLSTATE `55P03` from shared Artifact `NOWAIT`, full SQL transaction rollback, no partial B revision/index/outbox/idempotency. Commit A; verify no uncommitted A state leaked to B.
- After A commit, B's original scoped Graph changed via new historical GalleryRevisionPreset edge; Gallery B `row_version` has NOT changed.
- New B transaction invokes actual unchanged v4 using original client expected Gallery RowVersion and no Graph expected hash; currently the Source can commit B, documenting caller-stale weakness. Confirm Gallery A and B each has one WorkRevision, Search, Outbox, Idempotency, and stable B replay.
- All commits are in **ephemeral local Supabase only**. No real signed JWT, Object Storage bytes, prior bearer CDN, Staging or production state, native DDV save writer.

## Coverage matrix, Source119 state

| Writer or contract | State |
|---|---|
| Gallery-first no Preset / one Scene → original v4 | **SOURCE_SCOPED_ENROLLED** in current Source119 SQL Account/Artifact/Work lock order; NOT global |
| Different Gallery targets but shared Scene Artifact | Target of this new two-Writer independent local test, Source scoped serialization; stale caller pin missing |
| Scene Paired Revision/paired Cover | **SOURCE_SCOPED INERT**, not connected to common Source119 writer graph |
| Generic Preset Lifecycle all facets | **FAIL_CLOSED** for unsafe positive mutations, not enrolled |
| Biome / Floating Island / ToM Furniture / ToM Clothing | **UNKNOWN → FAIL_CLOSED**, known Scene only allowed |
| Gallery positive Delete/Unpublish/Restore, Cloud Private | **FAIL_CLOSED / BLOCKED**, never enabled |
| Emergency Moderator Restrict, Account Privacy Phase1 | **SAFETY_INDEPENDENT**, public read suppression works without deferred Cloud Cleanup |
| Deferred erasure, physical media cleanup/finalized 72h, native DDV apply | **NOT AUTHORIZED** |
| Universal all-kind current/history graph, Cloud URL issuer/cover/media/native provenance | **UNKNOWN / UNENROLLED**, cannot claim graphComplete |
| Automatic Edge retry under signed normal A/B/M with real Media | **NOT EXECUTED** |

## Actionable Owner API change — #119 / 03 COMM #134

Preserve existing Source119 account-first sorted locks and Privacy/Moderator safety. Extend SQL `community_publish_gallery_v4` and authenticated Edge action with **registry-tagged expected Graph SHA** plus Caller Work/Revision/RowVersion/Owner/Creator pins, ensuring version of snapshot and canonical serialization match owner readiness preflight. Validate caller digest against full old/new current/historical graph *under held sorted locks* BEFORE any mutation or idempotency success return. Old edge hash `scene-historical-edges-v1` remains a separate scoped check; do not substitute it for complete cross-facet Graph. Graph roster changes require full transaction rollback/restart from Account root; semantic stale caller remains terminal. No hidden autorefresh of caller expected hash on automatic retry. Do not relax `R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED` until five-facet/Media/Cloud/Native reference registry proven.

## Signed 04 QR cases — #121

Issue the client preflight for Gallery B, modify historical GalleryRevisionPreset via actual different Gallery A Writer while B Work rowVersion unchanged, then call B signed Edge API with OLD expected Graph SHA: must terminal reject, with no Gallery B Revision/Search/Outbox/Idempotency. Verify two real signed concurrent normal sessions A/B and separately Moderator M, true lock wait/retry and fresh session+Actor+Graph on each request; invalid/retired identity, privacy barrier before/during publication, unchanged emergency restriction, Storage byte SHA, signed URL before/after t0,t60,t300/expiry and CDN behavior. Positive retirement/Cloud/physical cleanup remain blocked.

## Release scope and acceptance

`graphComplete=false`, `retirementAuthorized=false`. No positive Gallery Retirement/Delete/Unpublish/Cloud Private/Restore, physical Media cleanup/72h TTL, native DDV Writer/Product Apply. Nintendo Switch v1.25.0 BID `52BD625D9B4E0053` schema624 source target only; Switch v1.25.3 schema626 and Steam native writers OFF. All Draft PRs DO_NOT_MERGE. R17 PASS0/PARTIAL12/BLOCKED18 unchanged; no R18. **Exact-head new CI must be COMPLETED SUCCESS before promoting the above test expectations from hypothesis to confirmed results.**
