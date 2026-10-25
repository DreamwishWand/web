# 09 INT R17 — WEP Preset published Storage object discard / registration race

**Scope:** independent Source-only cross-stream Writer/Storage audit; no change to Owner PR #134 or Production. Frozen Owner HEAD `8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec`, Source133. Readonly source and a deterministic interleaving model. **HIGH CONFIDENCE**, not proven actual Edge/Storage/Postgres concurrency, not a confirmed production incident.

## Observed source order

1. Actual `supabase/functions/wep-preset-artifact/index.ts` action `publish` validates staged bytes, computes deterministic `published/{accountId}/{sha256(accountId:idempotencyKey)}.json`, and performs Supabase Storage `copy(stagingKey,publishedKey)`. Only **after** this independent object operation does it call the actual service RPC `community_publish_preset_envelope`.
2. Actual `supabase/migrations/20260930035240_community_core_v0_preset_bridge.sql` RPC checks actor/Creator/idempotency, inserts `artifact_blobs` with the provided key and creates the public/private Preset Work, Revision, Search and Outbox. It is an atomic **database transaction**, not a transaction spanning Supabase Storage. It does not verify provider object existence.
3. The **same Edge** action `discard` accepts **both** `staging/{accountId}/...` **and** `published/{accountId}/...` keys, checks `artifact_blobs` for an **already-committed** row with that storage key, and calls Storage `remove([key])` whenever no row is returned. No reservation/lease/shared lock with in-flight `copy→RPC` is evident.
4. Interleaving allowed by the above source contracts: Publish A copies published object; Discard B queries DB before A creates `artifact_blobs` and sees none; B removes published object; A's RPC then commits a published Preset pointing to absent storage bytes. A similar object key conflict window may exist in compensating cleanup when the publisher RPC fails. This is a **possible concurrent interleaving**, not an observed real provider race.

## Independent evidence

- `tests/09int-r17-preset-storage-publish-discard-source-race.test.mjs`: parses exact Owner Edge/SQL/R16 registry source and executes a deterministic **simulation**, not the real Deno Edge, Storage provider or PostgreSQL. The meaningful security assertion is ordering/policy inconsistency in source, not that the remote race has occurred.
- R16 reference `preset-revision-blob` is `SOURCE_READONLY_UNVERIFIED_BYTES`, Writer `preset-envelope` is `SOURCE_PRESENT_UNENROLLED`; no `SOURCE_FULLY_ENROLLED` expansion from either.
- Existing community-media owner proxy and public Gallery gateway are separate from the WEP Preset Storage bucket; do not incorrectly classify Gallery image gateway as automatically protecting Preset artifacts.

## Required action and acceptance

**02 WEP (Edge owner)**: stop user-triggered destructive `discard` of published keys until a complete authoritative, owner-scoped atomic reservation/Graph/Storage policy exists. Keep staging-only cleanup where safe. The published key can be created before SQL registration, so a mere pre-delete `artifact_blobs` lookup is insufficient. Avoid replacing it with a silent background provider delete on an unproved TTL.

**03 COMM (DB/Authority owner)**: design one Publisher/Discard/Retention contract covering idempotency, Upload Intent/Reservation/Committed `artifact_blobs`, ownership and Creator, held locks across commit/recovery, all historical preset references and Graph flags. SQL-only row locks cannot make object storage transactional. Ensure a failed RPC or retry cannot physically remove an object just claimed by another successful writer.

**04 QR**: independent controlled disposable staging with **real signed Owner actor**, concurrency barriers around copy→registration, discard, retry and failure compensation. Must assert (a) never a committed publicly discoverable Preset with missing Storage object, (b) no physical removal of any currently or historically registered key, (c) no accidental restoration of dropped bytes by replays or orphaned object leak, (d) actual SHA/byte downloads and expiry where authorized. Local simulated PASS is not release acceptance.

Until runtime acceptance, `SOURCE_FULLY_ENROLLED=0`, `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`; positive Scene Revision/Cloud/Native DDV write and Product Apply OFF. R17 Product Tree PASS0/PARTIAL12/BLOCKED18, no R18; all Draft DO_NOT_MERGE/DEPLOY. Preserve Switch v1.25.0 schema624 and v1.25.3 schema626 read-only separation.
