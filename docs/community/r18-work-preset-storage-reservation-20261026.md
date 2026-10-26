# DDVRE 03 COMM — R18-work Preset Storage Reservation, Publication and Cleanup Authority

## Evidence boundary

**R18-work is not Release Acceptance R18.** Owner is existing Community Core Draft PR #134, additive over R17 accepted Source133. 09 INT CI40246837794 independently observed source ordering (Storage.copy before artifact_blobs registration, published-key discard and failed-publish physical compensation) and demonstrated deterministic *in-memory* race; **HIGH CONFIDENCE SOURCE HAZARD**, not a confirmed real provider incident. Our Source134 local PostgreSQL tests cannot prove external Storage atomicity.

We preserve Owner/Account privacy, identity, Gallery/Photo/Comments/Observer logic, source-only Gallery negative tests and signed staging parity gates. No eligible new positive Preset writer exists.

## Lifecycle state machine / ownership

| State | Meaning | Entry | Safe next / constraints |
| --- | --- | --- | --- |
| Upload/Staging | `staging/<AccountUUID>/<FileUUID>.json` after signed PUT | Existing WEP `prepare` | Actual byte size/hash and Scene portable JSON checked in Edge before reservation |
| `RESERVED` | Durable `private.preset_storage_reservations_r18` row for Account+Creator+source and **unique published key** | `community_preset_storage_reserve_r18` | Idempotent same-account/key/hash replay returns same row; no Storage.copy or deletion |
| `PROMOTION_IN_PROGRESS` | Reserved promotion explicitly fenced | **NOT ENABLED** | Requires a provider-fenced lease/heartbeat, ownership and race-proof independent acceptance |
| `COPIED_UNVERIFIED` | Provider returned success, bytes not independently re-downloaded | **NOT ENABLED** | Verification required, never equals DB commit |
| `VERIFICATION_REQUIRED` | Object byte length, content hash and key binding unknown | **NOT ENABLED** | Must independently re-download/re-hash and check actual account and reservation |
| `VERIFIED_PUBLISHED_OBJECT` | Independently verified provider object for this reservation | **NOT ENABLED** | Needs trusted attestation and atomic SQL commit contract, never caller-declared hash alone |
| `COMMITTED_PRESET_PUBLICATION` | Blob, Work, Artifact, Preset revisions, historic link, Idempotency and Outbox committed atomically | **NOT ENABLED** | External bytes must be verified before transaction, protected from concurrent deletion before/after |
| `FAILED_RECOVERABLE` | A failed or uncertain attempt, key retained in quarantine | `community_preset_storage_recovery_r18` with row version and reason | Caller can inspect/replay existing reservation; operator/proven provider reconciliation still needed |
| Deferred cleanup eligible | No live, historical, Cloud or legal refs, no reservation or in-flight lease | **NOT ENABLED** | Separate verified cleanup claim must be authorized transactionally before Storage.delete |
| Cleanup authorized / denied | Scoped owner+lease+version+provider proof | Current `community_preset_storage_cleanup_preflight_r18` **DENIED always** | No Storage.remove authorized, irrespective of zero DB rows |

Only `RESERVED` and `FAILED_RECOVERABLE` are constructively reachable through new Owner RPCs. The other states are schema/model placeholders deliberately not an implied positive transition. The privacy/Moderator emergency suppression path is never coupled to a Storage sweep.

## Uniqueness and transaction contracts

`private.preset_storage_reservations_r18` stores `reservation_id`, `owner_account_id`, `creator_profile_id`, `auth_subject`, `source_staging_key`, deterministic `published_storage_key`, `byte_size`, `checksum_sha256`, content type `application/json`, Scene schema/type, `idempotency_key`, content-sensitive `request_hash`, `reservation_state`, monotonic `state_version`, `copy_attempts`, `retry_after`, `last_failure`, and future `committed_blob_id`. Keys are unique by `(owner_account_id,idempotency_key)` and globally by `published_storage_key`; deterministic key is SHA-256(`AccountUUID:IdempotencyKey`). **Never normalize away arbitrary idempotency key differences after deriving published key**.

SQL reserve checks active, unsuppressed Identity→Account and same-owner clear Creator; Account `FOR SHARE` and unique-key insert followed by Reservation `FOR UPDATE` serialize exact-key races. A conflicting request hash is terminal, an identical replay returns the existing row (including failed/recoverable version). Recovery uses expected `state_version` and row lock, increments on success, stale rejects. Recovery never deletes copied bytes.

Legacy `community_publish_preset_envelope` same-signature RPC is deliberately fail-closed; a new `artifact_blobs` trigger rejects *new published-key registration*. WEP Edge action `publish` fails before copy; `discard` never calls Storage.remove, even when `artifact_blobs` lacks a row. WEP `reservePublication` independently downloads/validates the Staging JSON, SHA-256 and byte count, obtains DB reservation, cross-checks derived deterministic published key; `recoverPublication` records an explicit failed attempt, no Storage actions. Existing `prepare` and authorized `read` routes continue. No new public client direct SQL; all new RPCs service-role-only via the signed JWT+session-bound Edge, RLS on private table.

`community_preset_storage_cleanup_preflight_r18` reports number of Reservations, blob rows and **historical** `preset_revisions` for the exact key. It returns `cleanupAuthorized=false`, `physicalDeleteAuthorized=false` regardless of observed counts because no complete cross-product history/Cloud/retention/provider object inventory exists. No SQL snapshot should be treated as a physical deletion lease. If Copy succeeded but SQL commit failed, retain the key and reservation in failed-recoverable state, never compensate with Storage.remove. Reconcile/verify actual provider bytes before any future enabled replay; if key already exists, **do not overwrite it blindly**.

## Registered reference coverage and known unknowns

R16 `community_writer_reference_registry_r16` gains Reservation, publication and cleanup edges. `community_writer_routes_r16` gains reserve, recovery and discard, and legacy preset-envelope transitions to `FAIL_CLOSED`. Current and historical Preset references involve `artifact_blobs → preset_revisions → preset_revision_publications → community_work_revisions → community_works`, historical `gallery_revision_presets`, `preset_artifacts.associated_gallery_work_id`, Scene lineage, media Gallery and Cloud references. Full all-facet and Cloud ownership is **UNKNOWN / FAIL_CLOSED** and cannot be cleared by `count(*)=0` in one table. Existing retention workers and external provider cleanup issuers must be independently reviewed before physical cleanup enrollment.

## Source-local acceptance criteria and limitations

- 134 unique Source migrations apply from EMPTY and replay after clean reset; 23 additive reapplications; previous independent Gallery/Privacy/DreamSnaps negative regressions unchanged.
- Two independent actual PostgreSQL sessions: same-key uncommitted insert forces unique-index wait/lock timeout; committed replay returns original reservation; hash/key collision rejects.
- Stale recovery version rejects; explicit failure records `FAILED_RECOVERABLE` and preserves published key and reservation; replay keeps that recoverable state.
- Direct published-key blob registration and old Preset publication RPC are terminal; no new Work, Artifact, Preset revision, Idempotency or Outbox partial result.
- Staging and Published cleanup remain denied whether row is present or not; Account Privacy suppression prevents new Reserve; Moderator/public suppression remains independent (inherited tests).
- **Never count SQL-only result, in-memory interleaving, mock provider or signed URL string as real binary SHA verification or cross-system atomicity.**

## Handoffs and release gates

**02 WEP:** harmonize fail-closed publish/published+staging discard and no compensation (Owner current branch has source-only guard). New optional `reservePublication` and `recoverPublication` actions are *not* positive publish authority. Do not force rebase unrelated WEP PRs #135/#147 without review.

**09 INT:** independently repin Owner Source134 exact HEAD, exercise reservation uniqueness across two real PostgreSQL backends, replay with hash mismatch, expired/retired identity, stale versions, simulated old/new historical registrations and Phase1 Privacy vs reservation holding Account `FOR SHARE`; do not rerun previously accepted R11–R17 Owner races.

**04 QR:** after operator issue #130 approved Staging semantic parity, real signed disposable Storage provider A/B concurrency: upload, reserve, concurrent same-key publish/discard, Copy-succeeded/SQL-failed recovery with provider byte SHA, old/new historical reference denial, bounded cleanup token lease, Moderator/Privacy, retry/idempotency. Inspect old Storage bearer/CDN expiry separately. No deployment/physical remove before operator.

**Release:** Source staging managed historic 116 vs current Source134 is not a trivial patch increment; operator review, backup/PITR and verified provider binary needed before writer enablement. `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`, `SOURCE_FULLY_ENROLLED=0`. Gallery retire/delete/unpublish/Cloud Private/Restore, physical cleanup/finalized72h, Scene paired save and native DDV Writer/Apply OFF. PRs Draft DO_NOT_MERGE / DO_NOT_DEPLOY. Release Acceptance remains R17 Product Tree PASS0/PARTIAL12/BLOCKED18; no Release R18.

## 2026-10-26 R18-work production safety follow-up

An additional physical deletion issuer was found in `supabase/functions/wep-preset-retention/index.ts`: authenticated worker token, retention job claim, `Storage.remove(published/<account>/...)`, then `community_finalize_artifact_blob_purge`. Owner Source134 now makes this adapter return terminal `R18_PRESET_PHYSICAL_RETENTION_CLEANUP_NOT_ENROLLED` **before any claimed blob or Storage remove**, while keeping token authentication and keeping Account Privacy/Moderator Phase1 logically independent. Deferred retention jobs may need operator handling: privacy suppression is immediate, but final physical GDPR/account-erasure completion cannot be asserted. This cannot be enabled until legal hold, historical/current references, provider byte/identity proof, lease fencing and failed-worker recovery are accepted. `community-retention` Gallery media deletion paths are separate and were **not** changed.

The fail-closed old `community_publish_preset_envelope` necessarily invalidates five historical rollback fixtures whose *setup* positively invoked that old RPC or inserted an unreserved published blob: Scene identity guard, Scene public read, Preset generic owner lifecycle, Scene revision readiness, and Scene paired update. They remain accepted as **Source133 historical baseline** in [CI40246024478](https://github.com/DreamwishWand/web/actions/runs/40246024478) and [Clean Bootstrap40246024516](https://github.com/DreamwishWand/web/actions/runs/40246024516), not as current Source134 positives. Source134 bootstrap intentionally freezes those exact five (still named, never silently counted as passes), executes 11 remaining compatible original rollback SQL fixtures, and exercises new R18 published-registration terminal plus two-session reservation/refusal/recovery cases. This is an intentional production safety change, not a clean passing run of the old positive publication path.

Remaining P0 is a provider-verified, lease-fenced, reference-aware, atomic SQL publication and deferred-cleanup orchestration. Until then, public Preset publishing, including preexisting source path, and Preset physical discard/retention are disabled on this Owner branch. Storage accumulation, orphan retention, legal erasure SLAs and user-facing product readiness remain blocked. **Signed staging parity / actual Storage E2E not executed**.
