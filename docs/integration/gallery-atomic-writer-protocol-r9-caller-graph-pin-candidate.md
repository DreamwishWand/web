# 09 INT R9 — Paired Scene caller-pinned historical edge candidate (isolated)

Status: **VALIDATION-ONLY CANDIDATE — NOT a deployed RPC, acceptance, or release gate closure**.  
Repo: DreamwishWand/web. Independent branch `validation/09int-r9-scene-caller-graph-pin-20261024` derived from prior 09 INT R8 validation tree; PR #134 and PR #123 untouched.  
Scope: Nintendo Switch DDV v1.25.0, BID 52BD625D9B4E0053, schema 624 **only for verified subject identities**. No DDV native writing.

## Why R9 exists

R8 demonstrated a stale caller authorization defect in the existing *owner-only inert* Scene paired writer: an additional noncurrent `GalleryRevisionPreset` edge can be committed to the **same** Gallery Work with both Work `row_version` values and the current PresetRevision unchanged. The source candidate's before/after edge comparison detects edges added while waiting on locks, but does **not** reject a graph already changed before the command starts when the caller only pins Work versions.

## R9 candidate delta

This branch modifies **only the isolated validation copy** of `20261025002350_gallery_known_writer_scene_parent_bootstrap_v1.sql`. It adds `p_expected_historical_edge_set_sha256` to the existing owner-only `private.scene_save_revision_paired_candidate_v1` local signature.

Caller pins deterministic SHA256 of `scene-historical-edges-v1|<PresetArtifactUUID>|<AssociatedGalleryWorkUUID>|<sorted GalleryRevisionUUID/PresetRevisionUUID edge strings joined by |>`. The function includes the pin in the idempotency request hash and validates the lowercase 64-digit digest. After ordered Artifact -> PresetWork -> GalleryWork row locks and current before/after edge re-enumeration, it compares the caller pin against those **locked** historical edges; mismatch raises `SCENE_REVISION_CALLER_EDGE_FINGERPRINT_STALE` and aborts the transaction.

The isolated test demonstrates two separate guarantees, if its CI is green:

1. Real two-backend contention: one session locks linked GalleryWork and the candidate caller must rollback everything on 55P03; fresh retry with current caller pin may proceed **within a rollback-only disposable fixture**.
2. The R8 same-Gallery historical-edge addition leaves both Work versions unchanged but invalidates the old edge SHA. Stale caller pin must fail atomically; newly acquired pin can execute in a rollback-only local transaction.

Only local Supabase CLI PostgreSQL with exactly 113 source migrations and synthetic account/media rows is used. Workflow enforces loopback PostgreSQL `127.0.0.1:54322`; neither Staging nor Production connections, signed HTTP/Auth actors, real object bytes, CDN, or persistent DDV writing are used. Function remains revoked from public, anon, authenticated and service_role.

## Explicit non-closure

- This is **not** a complete `graphFingerprint` for *all* known and unknown cross-product references, nor a globally atomic foreign-key/reference writer registry.
- Other writers that skip the same lock order may still introduce historical edges or otherwise bypass the graph seal; a single Scene edge digest does not prove global serialization.
- Gallery-first publishers; generic Preset visibility/unpublish/delete; Scene legacy publish/unpublish/delete source parity; other Preset types, ToM, Room, Native/In-Game listing; moderator takedowns; lawful account erasure; Search/outbox and eventual public projections all need source-owned integrated contracts.
- Source SQL in 03 COMM PR #134 is unchanged. This branch's one new function parameter does **not** authorize an API signature upgrade or direct Edge invocation. There is no deployed RPC, protected normal-auth signed two-session Staging, byte-integrity or old issued media URL/CDN replay proof.
- `graphComplete=false` and `retirementAuthorized=false`. Gallery public dependent Unpublish/Delete/Cloud Private/Restore, physical media cleanup/72-hour TTL, and native DDV Writer/Product Apply remain hard OFF.

## Owner returns

- **03 COMM** owns real source RPC parity, server actor/idempotency, all-writer ordered transactions, graph digest/version authorization and bounded whole-transaction retries; retain owner-only inert candidate until accepted.
- **02 WEP** may supply offline Scene/owner/revision/cover intent and *advisory* digest, but must keep Save Revision/Publish/Apply disabled until Backend-signed acceptance. Do not advertise atomic fencing.
- **04 QR** owns configured real signed normal Owner A / other Owner B / Moderator roles on disposable Staging, true Storage bytes and prior issued URL replay/CDN proof; mock DB-owner tests are not substitutes.
- **00 CTRL** must keep all Draft PRs unmerged and R17 release matrix unchanged absent genuine end-to-end acceptance.

Next engineering milestone: define authoritative complete reference namespace and mutually enrolled writer registry, pin all current + historical reference edges, actor, revision, Work row versions and media object state **under a universal transaction lock order**, then test heterogeneous real writers in two distinct sessions with terminal semantic conflicts and bounded retries.
