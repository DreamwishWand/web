# DDVRE / 09 INT R15 — Actual Owner Source119 Atomic Enrollment Independent Acceptance

Date 2026-10-25 JST. Existing 09 INT; R15 is not Release R18. Exact pinned 03 COMM PR134 owner Source HEAD `983b03edf17f8ec27ba857feb445d07f228a0b64`; **119 additive migrations** including `20261025002700_active_identity_regular_resolver_guard_v1.sql` and separate `20261025002800`, `02810`, `02820`, `02830` Gallery v4 scoped Graph/Lock/actual writer/helpers ACL migrations. Other newer owner commits are NOT included. All Drafts DO_NOT_MERGE.

Independent 09 INT Validation Branch: `validation/09int-r15-owner119-actual-source-20261025` with synthetic fixture helper (prior R11 concurrency not rerun) and `tests/09int-r15-actual-owner119-independent.py`. GitHub Actions `.github/workflows/09int-r15-owner119-actual-writer-source.yml` applies all 119 Source migrations to an isolated ephemeral local Supabase DB, never connects to real Staging and never changes 03 COMM PR134. **Only exact-head CI COMPLETED SUCCESS constitutes independent proof; intermediate 116/118 migration bootstrap FAILURES from earlier pinned owner commits are not accepted.**

## Actual Source call-site and lock contract

`community-command/index.ts`: signed `withSupabase({auth:'user'})`, `community_authorize_session`, `publishGallery → public.community_publish_gallery_v4`; current owner Source 119 calls `private.gallery_v4_atomic_lock_scoped_r14` early inside actual v4 (not test-only wrapper). Root Account `FOR SHARE`; `gallery_v4_scoped_graph_r14` discovers direct associated Gallery, requested PresetRevision and all historical GalleryRevisionPreset references. It rejects more than one reachable Artifact, any unknown kind or cross-owner Artifact, then sorted `NOWAIT` Artifact→PresetWork→GalleryWork row locks; compares pre/post graph snapshots under locks, re-resolves active/nonretired Actor and owner/Creator. v4 checks requested Gallery rowVersion/owner/moderation/valid current lifecycle; immutable GalleryRevision, Search, Outbox and Idempotency share one SQL RPC transaction.

Edge retries **publishGallery only** (other Writers remain unregistered): up to 3 distinct Admin RPC transactions bounded ~1.7 seconds with jitter, renewed session authorization on attempts 2/3, SQLSTATE 40P01/55P03/40001 and selected roster-change errors. No automatic retry of terminal rowVersion/authorization conflicts. The actual signed Edge retry sequence is not tested using normal A/B/M staging actors.

**Critical remaining authority hole**: public `community_publish_gallery_v4` still has NO `p_expected_graph_sha256` input, although internal helper creates an under-lock snapshot. Caller can capture Work rowVersion and design while historical GalleryRevisionPreset changes without that target Work rowVersion changing; Source can accept stale client intent based only on target expected version. This is not a proof of unauthorized ownership; it is a Graph Optimistic Concurrency gap. Cross-kind global graph closure and old/new Media/Cloud/native references are missing. Source multi-Artifact must remain Fail Closed.

## Independent R15 cases

New actual Source SQL (no wrapper) with two PostgreSQL connections and synthetic Scene Artifact:
1. Held Artifact `FOR UPDATE` vs actual v4 → `55P03` due `NOWAIT`; B full transaction rollback; fresh B transaction can execute v4 rollback-only.
2. Held Account `FOR UPDATE` vs actual v4 → `55P03` timeout; full rollback; fresh transaction source positive rollback-only.
3. Add unsealed historical GalleryRevisionPreset edge pointing to the same PresetRevision while target GalleryWork `row_version` stays unchanged. Internal `gallery_v4_scoped_graph_r14` differs before/after; no caller expected graph hash parameter means actual v4 accepts request with still-valid target Work version (rollback-only) ⇒ **stale caller negative outcome**.
4. Add second associated Scene Artifact to target GalleryWork. Internal scope detects 2 Artifacts; actual v4 refuses `R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED` before mutations. This is desired Fail Closed, not multi-Artifact support.
5. Source SQL active retired identity gate inherited from 115, QR synthetic 115 Source verified; real signed JWT Staging not yet.
All positives are rolled back except fixture/source-derived immutable historical edges in disposable local PostgreSQL; no real user, Storage/CDN or native DDV writer mutations.

## Current Writer Coverage Matrix (actual source pin)

| Source writer | Classification |
|---|---|
| Gallery v4 no Preset or one known Scene | **SOURCE_SCOPED_ENROLLED** if Source119 bootstrap/independent CI passes; NOT full all-Writer and NO caller expected Graph SHA |
| Gallery Photo Publish/Update/Cover and Gallery-first other Facets | **UNENROLLED** global; own distinct Media/subject verification only |
| Scene paired Save Revision | **SOURCE_SCOPED INERT**; actor & limited R9 historical edge SHA, no shared graph, public EXECUTE disabled |
| Preset initial envelope | **SOURCE_SCOPED** initial create, other associations/history not complete |
| Generic Preset Visibility/Unpublish/Delete | **FAIL CLOSED**, `PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED` |
| Legacy Scene Unpublish/Delete and Gallery Positive Retirement/Cloud Private/Restore | **UNENROLLED/BLOCKED** old Cloud signed URL/retention and graph dependencies |
| R11 three known Gallery reference triggers | **NARROW SOURCE_SCOPED**, not all-Writer |
| Emergency Moderator Restrict/Remove | **SAFETY_INDEPENDENT**, prompt public read suppression preserved |
| Account Privacy Phase1 | **SAFETY_INDEPENDENT SOURCE PARTIAL**, durable suppression, no full erasure or old bearer immediate revoke |
| Deferred Cleanup, Retention, Physical Storage deletion, 72h TTL | **UNENROLLED/NOT_AUTHORIZED** |
| Biome/Floating Island/ToM Furniture/ToM Clothing/Native/InGame refs and DreamSnaps crossproduct | **UNKNOWN→FAIL CLOSED**; all facet Graph registry not accepted |

## 03 COMM owner API changes

Expose internally a registry-versioned `expectedGraphSha256` and exact `current+historical dependent references` pin for Gallery-first caller, in addition to existing target rowVersion. Add all native Wand five facet, Cover/Media/Cloud/private-issuer/retention reference namespaces and multi-Artifact bounded graph closure before ever lifting `R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED`. Recheck Owner/Creator/active Identity/privacy under Account-root then sorted all Artifact/PresetWork/GalleryWork locks. Abort whole transaction and restart ordering on graph-roster growth; stale caller/owner mismatch terminal; Source idempotency/Search/Outbox must remain atomic. Keep phase1 Privacy and emergency Moderator negative independent of optional deferred cleanup. Leave all positive retire/Cloud/private/physical operations off.

## 02 WEP Atomic Revision Intent

Offline Scene Capture (required SubGrid descendants/Region, Include Roads and Fences topology safety), byte SHA256/length, owner/Creator, Artifact/associated Gallery, Current Preset+Gallery WorkRevisions/rowVersions, separate R9 `historicalEdgeSetSha256` and later global caller graph SHA, Media Cover upload receipts. Read-only readiness hints cannot grant authority; `saveRevisionAuthorized=false`.

## 04 QR signed acceptance to run

Protected disposable Owner A/Nonowner B/Moderator M with actual signed JWT/session: invoke Edge `publishGallery`, `publishGalleryPhoto`, Scene Owner revision only when approved. Held Artifact → NOWAIT 55P03/Edge bounded retry, held Account → privacy and Gallery Cross-lock, old vs new historical edge mutation without target rowVersion (expected client graph pin must fail once owner fixes), two-Artifacts must remain Fail Closed, retired/revoked identity and current Creator/Owner, Outbox/Search/Idempotency side-effect count under forced transient errors 40P01/55P03/40001. Emergency moderation/restricted public read and phase1 Suppression continue while physical cleanup blocked. Real Storage Media byte SHA, new issuer suppression, prior signed bearer URL at 0/60/300/post-expiry and CDN edge caches, operator policy legal holds/72h remain unaccepted.

`graphComplete=false`, `retirementAuthorized=false`. No Gallery Positive Delete/Unpublish/Cloud Private/Restore, physical Cleanup/Finalized72h TTL, Native DDV persistent Writer/Product Apply. Scope Switch DDV v1.25.0 BID52BD625D9B4E0053 schema624; v1.25.3 schema626/Steam Native Writer OFF. R17 30 Product Tree PASS0/PARTIAL12/BLOCKED18. No R18.
