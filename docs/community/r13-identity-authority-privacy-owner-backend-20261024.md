# DDVRE / 03 COMM R13 — Active Identity Authorization & Owner Scene Backend Gate

Date: 2026-10-24; existing Draft PR #134, Issue #139 / #119 / #124 / #116.
Owner Source only. **DO_NOT_MERGE / DO_NOT_DEPLOY**. Switch v1.25.0 BID `52BD625D9B4E0053` schema 624; Switch v1.25.3 schema 626/Steam Native Writer and Apply OFF.

## R13 finding and narrow repair

09 INT R13 confirmed that the owner Source `private.resolve_active_account(uuid)` accepted a synthetic Supabase Identity whose `auth_identities.identity_state='retired'`, even though the target Wand Account remained active. This was caused by a late override in `20261025002600_account_privacy_suppression_barrier_v1.sql` dropping the `identity_state='active'` predicate previously implemented in `20260930063000_community_core_v0_account_recovery.sql`. Source assertion, **not** a signed JWT exploit demonstration.

The owner fix is the **115th additive source migration** `20261025002700_active_identity_regular_resolver_guard_v1.sql`; none of the prior 114 migration files are rewritten. Its final `private.resolve_active_account(p_auth_subject uuid)` requires all:

1. Exact Supabase subject mapping and `auth_identities.identity_state='active'`, `retired_at IS NULL`; any retired/unknown/future revoked or disabled state is rejected. No fallback to historical provider subject or account owner.
2. `wand_accounts.status='active'` and `deleted_at IS NULL`.
3. `private.is_account_privacy_suppressed(account_id)=false`.

All checked before returning an owner Account ID. It **does not** take token/session identifiers and cannot alone prove session freshness; HTTP identity is derived by `withSupabase(auth:'user')`, then `community_authorize_session` validates active identity and JWT `iat` against `sessions_valid_after`. Recent-auth and actual `auth.sessions` checks remain in `private.require_recent_session` for high-risk operations. Source-only direct service-role SQL calls are NOT signed HTTP actor proof. Retired historical identities must not invoke regular owner actions even if their old JWT has not expired.

### Source affected call-paths, without changing business mutation logic

| Surface | Source path / denial |
|---|---|
| Gallery positive owner Work state | `community_change_work_visibility` → resolver; retired Identity denied before idempotency/row mutation |
| Gallery read / owner Media | `community_get_gallery_v1`, `community_gallery_owner_media_read_v1` → resolver; no historical bearer issuance |
| Preset / Scene | `community_scene_revision_readiness_v1` → resolver; existing inert Scene paired update has no new grants |
| Other regular owner RPCs | Existing `private.resolve_active_account` dependency immediately enforces the final Identity predicate |
| Account ordinary auth | `community_authorize_session` invokes resolver then active Identity / issuance cutoff; no source bypass via retired subject |
| Account phase1 suppression | Dedicated `community_request_privacy_suppression_v1` uses its own explicitly active identity plus actual recent session and account lock, preserving idempotent retry for **suppressed active** identity, not restoring normal owner access |
| Moderation emergency restriction | Unchanged; do not weaken or route through a retired actor |

## Source tests and bounded concurrency

- `local-clean-bootstrap-r13-retired-identity-v1.sql`: full local disposable schema, synthetic active Account with two Supabase identities; ACTIVE historical actor initially works, then is retired without changing owner Account. Six actual resolver/session/Gallery write/Gallery read/Gallery Media/Scene readiness calls MUST deny with `Active AuthIdentity not found`. Also tests `identity_state='active' + retired_at NOT NULL` fail-closed, current original active identity unaffected, same WorkVersion and Outbox. Entire fixture rolls back.
- `tests/comm-r13-retired-identity-two-session.py`: two distinct local PG backends; A commits synthetic identity retirement, B uses new transactions to invoke regular Gallery, Scene, Media, Account-session and Privacy DELETE RPC; all denied, no Work/Outbox/Privacy mutation, unrelated still-active Subject accepted. It intentionally **does not claim** to stop a writer that already entered with an uncommitted identity-status change; R13 full Graph/account-root lock enrollment remains open.
- Updated existing `comm-privacy-r12-two-session.py` remains independent and runs after retiring temporary actor cleanup. Previous 15 SQL fixtures preserved, R13 fixture added as #16.
- Workflow migration check, fresh EMPTY Source Postgres start + reset/replay ledger, same-schema safe migration reapplication and rollback-only tests updated 114→115. Source-only `community-r13-active-identity-regression.test.mjs` records this exact security regression.
- Exact-head CI/Bootstrap conclusions must be verified before describing acceptance as PASS.

## Privacy Barrier and Scene Owner authority boundary

Issue #139 phase1 retains durable `SUPPRESSED_CLEANUP_PENDING`, read-time Work/Creator/Search/QA/DreamSnaps/Media denial and positive republish gate; suppression commit is independent of Gallery lifecycle/Cloud/Media cleanup. Original published GalleryRevision and historical Cover untouched; old issued Bearer URL/CDN cache immediate revocation **not proven**; legal retention/notification/cleanup approval NOT GIVEN. `cleanup_review_required` is only a durable status, not an approved worker.

03 COMM Scene Owner candidate remains **DB-only/INERT**, no direct service_role/anon/authenticated Execute grant. It already checks registered Blob SHA/size, expected current Work rowVersion/revisions, Creator, scoped old historical edge SHA, finalized READY/CLEAR Media and Cover membership. These are not an all-writer graph fence or actual Storage byte proof. Before real signed Owner API:

- 09 INT `ddv.graph-allwriters@r13`: signed actor/account-root shared lock **before** sorted Artifact UUID→PresetWork UUID→GalleryWork UUID locks, complete old+new current and historical reference registry, owner/Creator/current revisions/expected rowVersions/full graph fingerprint rechecked under locks; 40P01/55P03/40001 bounded **fresh entire transaction** retry. Gallery-first publisher and moderation/restore/erasure paths not universally enrolled. Emergency restrict and privacy read suppression remain independently live.
- 03 COMM actual Object Storage GET under approved signed owner/session, inspect bytes and SHA-256/length against *registered* immutable owner `artifact_blobs`; reuse WEP portable Scene JSON/SubGrid/Road/Fence validator rather than duplicate a schema, signed Media Prepare→PUT→Finalize/READY/CLEAR Current Cover with immutable history, atomic paired revisions/Search/Outbox/idempotency. Until graph/provenance real, the Source candidate stays INERT and every public authorization flag false.
- 02 WEP DTO: `actor` derived server-side JWT only; `presetArtifactId`, expected Preset/Gallery current revisions + rowVersions, expected Creator, scoped historical edge digest **as advisory**, registered owner Blob ID + SHA256/byteSize/schema, portable validated JSON, ordered finalized Media IDs + Cover, idempotency key; **future** mandatory R13 all-type graph version/fingerprint. No writer enablement from readiness/offline Intent.
- 04 QR R12/R13-QA: real signed disposable Owner A/Non-owner B/Moderator M + stale/retired identities, current Auth JWT with session and cutoff, independent 2-session race in both ordering directions, Gallery Photo/Scene cross references and Moderation restrict/restore, actual Storage binary checksum, CDN old bearer at 0/60/300/expiry, queued cleanup faults/retry, source-vs-Staging ledger 115/116 parity and privacy notice/retention approval. CONFIGURATION_BLOCKED until operator provisions protected signed actors/environment. Do not use service-role as impersonated human actor.

Global toggles remain `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`. Gallery Positive Delete/Unpublish, Cloud Private/Restore, Physical Cleanup, 72h TTL and native DDV Writer/Product Apply remain OFF. R17 = PASS0 / PARTIAL12 / BLOCKED18 across 30 product nodes; no change without genuine release evidence.
