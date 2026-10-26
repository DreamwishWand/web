# DDVRE 02 WEP — R17 Preset Storage Physical Discard Fail-closed Repair

Date: 2026-10-26 (JST). Workstream: existing 02 WEP, narrowly scoped to `supabase/functions/wep-preset-artifact/index.ts`.

## Exact Source / Branch

- Reference Owner 03 COMM Draft PR #134 immutable Source133 commit `8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec`. This is source-only; PR #134 has independently moved beyond Source133.
- Isolated WEP Branch: `wep/r17-preset-storage-discard-failclosed-20261026`, child Draft PR #154. Base frozen Owner Source133 `verification/wep-r17-owner133-frozen-base-20261026`; no rebase or force push against PR #134, #135, or #147, no changes to 03 COMM migrations.
- 09 INT audit: `validation/09int-r17-owner133-preset-storage-discard-race-20261026` HEAD `8d0b903082da7d0050fd1cf3c177acba68bfe049`, ordinary CI `40246837794` SUCCESS, **HIGH_CONFIDENCE_SOURCE_ORDERING_NOT_RUNTIME**. This fix targets plausible copy->DB/discard concurrency; no actual real-provider incident is asserted.

## Actual Edge Call Sites (patched file)

- Line ~237: `prepare` authenticates JWT + active Wand Account, rate limits, creates signed staging upload URL at `staging/<accountId>/<UUID>.json`; no change.
- Line ~256: `publish` validates signed staging bytes, verifies portable Scene JSON and SHA-256, constructs deterministic `published/<accountId>/<sha256(accountId:idempotencyKey)>.json`.
- Line ~298: `Storage.copy(stagingKey,publishedKey)` may finish before or concurrently with another publish/discard; retained. If destination exists, byte SHA mismatch still blocks with `PUBLISHED_KEY_CONFLICT`. A matching existing copy may be reused only through original owner-authenticated idempotent DB RPC.
- Line ~311: `community_publish_preset_envelope` commits immutable Preset DB references; existing RPC permissions/arguments unchanged.
- Line ~327–335: on RPC failure, **DO NOT** remove deterministic Published key even if copy succeeded. On successful commit, **DO NOT** remove Staging key either. Both lack fenced cross-system deletion authority; leftover objects require Owner reconciliation.
- Line ~438: `discard`: retain signed Actor/Wand Account authorization ahead of action and exact expected 3-segment account path classification, then reject both Published and Staging with no Storage.remove/no artifact_blobs committed-only lookup.
- Line ~409: `read` still gets `wep_get_accessible_preset_blob` and requests existing 300s signed URL; no change. Public/Discovery SQL/RPC are not modified.

## Permit Matrix

| Actor/action/key | Allowed | HTTP / code | Physical removal |
|---|---|---|---|
| Current authorized account, valid `published/<own-account>/<sha256>.json` (registered, unregistered, copying or unknown) | NO | 409 `PUBLISHED_ARTIFACT_PHYSICAL_DISCARD_UNAUTHORIZED` | NEVER |
| Current authorized account, valid `staging/<own-account>/<uuid>.json` (uploaded, missing, in flight) | NO until reservation | 409 `STAGING_ARTIFACT_DISCARD_REQUIRES_RESERVATION` | NEVER |
| Cross-account staging/published | NO | 403 `INVALID_STORAGE_KEY` | NEVER |
| Invalid path, slash traversal, dot traversal, encoded traversal, malformed UUID/hash/suffix, unexpected prefix | NO | 403 `INVALID_STORAGE_KEY` | NEVER |
| Absent/revoked signed JWT or invalid active account | NO | 401 session/actor denial before action | NEVER |
| Owner Source-authenticated prepare/publish/read | existing validated routes only | existing contract | `Storage.copy` permitted; read signed URL; no delete |
| Publish RPC failed after copy | no compensating physical delete | existing 400 `PRESET_PUBLISH_FAILED` | KEEP, future quarantine/reconcile |
| Completed same key replay | existing RPC idempotency | original response | KEEP existing referenced bytes |

**Reason:** `artifact_blobs` only proves *committed* rows and is not a lease for uncommitted/in-flight copy or publish. Storage and PostgreSQL transactions are not atomic. A failed RPC caller cannot determine whether a concurrent caller has committed the same deterministic key. Staging bytes also lack an exclusive lease while another owner-authorized publish may be downloading/copying.

The repair is intentionally stricter than allowing Staging deletion. Future object reclamation is **NOT COMPLETE**. Do not treat indefinitely orphaned or failed uploads as a solved lifecycle; track with Owner cleanup and capacity policy.

## 03 COMM Required Durable Owner Contract (proposed, not implemented)

1. Server-managed reservation under authenticated active Account/Creator, `storage_key`, immutable `idempotency_key`, expected blob SHA256/byteSize/type, Work/Artifact identity, monotonically increasing fencing token, lease expiry, states `UPLOADING -> VERIFIED -> COPYING -> REGISTERED` or `FAILED/QUARANTINED`. Enforce account+exact key uniqueness and changed idempotency payload conflict.
2. Before physical copy, reserve destination key and prevent another live owner Publisher from conflicting/copying different bytes; verify **provider-read bytes** against immutable content hash. Both published materialization and DB commit must be reconciled atomically at the logical level with outbox/state machine, not falsely represented as one physical transaction.
3. Publish DB commit registers ArtifactBlob and all current/historical immutable Preset/Work/Gallery/Media/cover dependencies under the existing Account→sorted Artifact→Work lock/graph protocol. Do not allow a pending reservation's `storage_key` to be removed or recreated. Idempotent completed same-key replay must be stable; conflict on same key/different content.
4. Cleanup is Owner-issued, never a client-supplied Storage key or `artifact_blobs IS NULL` test: require reservation state terminal, no active lease or in-flight publish, no live/historical/retention/legal/Cloud references, exact account/owner/Creator rights, monotonic permit/generation bound to key and bytes checksum, grace interval > worst-case concurrency/Provider propagation and signed URL bearer lifetime, audit log and reversible quarantine when possible.
5. Just before provider deletion, recheck permitted reservation and entire dependent graph (CAS/generation fencing), handle provider failures idempotently and *never assume old issued CDN bearer is revoked*. Recovery on interrupted copy/commit must converge without dangling public DB refs; metrics for orphan count/age/quarantine/delete failures, rate limits, admin intervention and capacity alerts.
6. Only after 03 COMM authority + independent 09 INT/04 QR signed provider acceptance should an eligible Staging cleanup/Published deletion route be designed. This WEP PR intentionally introduces **no positive cleanup or reserved writer RPC**.

## Test/evidence boundary

`tests/wep-r17-preset-storage-discard-edge-handler.test.mjs` transpiles and executes the actual Source133-based WEP Edge handler with only imports injected; uses deterministic in-memory Storage copy/download/remove and synthetic SQL return timing. Cases: Published registered/unregistered refusal, valid Staging Owner authorization but failclosed removal, cross-account/invalid traversal, copy completed/DB uncommitted simultaneous two Discards, same deterministic idempotency key overlapping requests, completed replay from Published only, forced RPC rollback with Published bytes kept, owner read signed URL unchanged, JWT denial before mutations and no remaining Storage.remove call site. No Provider Storage or genuine PostgREST isolation is claimed.

### 09 INT independent next

Pin exact #154 patch SHA, inspect no physical delete callsites in the real Edge, source verify `copy(A)->uncommitted->discard(B)` denied, failed A with B same key succeeds no compensation remove, historical refs/unknown pending keys and Staging concurrent reuse. If live actual disposable PG is available, exercise reservation-less limitation as a **negative**; do not claim source mock is an atomic provider test. Do not reopen old R11–R17 accepted Gallery/Photo/Privacy contracts.

### 04 QR real Provider E2E after operator approval

Only after Issue #130 protected auth+Source133 (or owner-approved successor) ↔ Staging (historical managed 116) semantic parity: disposable A/B/Moderator, real signed provider PUT/COPY, DB row pre/post under simultaneous published/staging discard and RPC rollback, idempotent retries, checksum of downloaded published bytes (not declared metadata), CDN expired bearer t0/60/300/post, wrong actor/path/owner, RLS/RPC and privacy/retired actor; clean fixtures and observe orphan/quarantine. No deployment/activation or production deletion without operator approval.

## Release Gates

`graphComplete=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`, `retirementAuthorized=false`, full Source Writer Registry not enrolled. Native DDV Persistent Writer/Product Apply, positive Gallery Delete/Retire, Cloud Private/Restore, physical cleanup/72h TTL OFF. All Drafts DO_NOT_MERGE / DO_NOT_DEPLOY. Product Tree R17 remains PASS 0 / PARTIAL 12 / BLOCKED 18. This is a P0 safety patch, **SOURCE ONLY** until verified against actual provider concurrency.
