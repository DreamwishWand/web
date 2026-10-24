# DDVRE / 09 INT R12 — Source–Staging All-Writer Inventory & Atomic Enrollment Contract
Date: 2026-10-24 · Workstream: existing 09 INT / Cross-Product Integration · Issue #119

## Provenance, immutable limits

**Source**: 03 COMM Draft PR #134 pinned **d2e4576830bb7e37e4f7981c5777912e7b3be85c** at R12 branch creation. 113 source migrations, PR134 remains Draft and original owner unchanged. **Live Staging**: Supabase project *dreamwish-wand-staging*, PostgreSQL 17, read-only `pg_proc` inspection including exact function signatures, `pg_get_functiondef`, owner/role flags and text search; **zero Staging SQL mutation**. Source/Staging are NOT interchangeable. R11 known 3 reference trigger 2-session CI #40086248029 already PASS; R12 does not reimplement those triggers. 02 WEP child Draft #135 read-only Scene capture / offline artifact intent; no writer promotion.

Evidence vocabulary: CONFIRMED = actual Source SQL/Live Staging catalog observation or exact-head CI; HIGH CONFIDENCE = source-derived runtime risk with incomplete dynamic enrollment; UNKNOWN = registry/version/actor/provider not proved.

**Non-negotiable defaults**: `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false` for any non-authorized public entry. Gallery positive Delete/Unpublish, Cloud Private/Restore, physical media cleanup, finalized 72h retention, native DDV save Writer and Product Apply remain HARD OFF. No re-grants, no production migrations, no remote SQL writes, no Draft merge.

## A. Source–Staging Writer Coverage Matrix

Fields below: *Transaction / Lock / Actor & owner / Version & graph / Enrollment*. Each RPC body executes in the caller's PostgreSQL transaction unless stated; intrinsic function atomicity is **not** global graph serializability, and account idempotency advisory locks do **not** substitute for cross-Work locks.

| Writer / source of truth | Transaction & actual lock | Authorization, version, current/history | Enrollment / gate |
|---|---|---|---|
| Scene initial `community_publish_scene_preset_product_v1` (STAGING present; not owner PR134 migration) | Function contains 3 `FOR UPDATE` blocks; no verified ALL Writer ordering | Active Account, owner/Creator/new Artifact checks; no expected Work rowVersion on initial creation; current + historical reference registry not proven | **STAGING PARITY MISSING**; NEVER use as basis for Gallery retirement |
| Scene paired Save Revision `private.scene_save_revision_paired_candidate_v1` (PR134 SOURCE ONLY) | Artifact → PresetWork → GalleryWork row `FOR UPDATE` then sorted Media `FOR SHARE`; immutable Preset/Gallery Revision, both pointers, Search/Outbox/Idempotency in single DB call | Existing PUBLIC Scene+Gallery same owner/Creator, expected current PresetRevision and both Work rowVersions, source v1.25.0; caller `scene-historical-edges-v1` SHA locked recheck. Blob/Media metadata but **not physical bytes** | Scoped R9 source-only candidate; owner-only, no service_role/anon/authenticated EXECUTE. **NOT GLOBAL** |
| Scene Unpublish `community_unpublish_scene_preset_v1` (LIVE STAGING) | Account/idempotency advisory lock, `preset_artifacts FOR UPDATE`, then unordered `community_works UPDATE WHERE work_id IN (PresetWork,GalleryWork)`; Search+Outbox | Active owner + scene type, Preset published; **no expected Work rowVersions/current+historical graph pin**, no complete lock discovery | **UNENROLLED LIVE LEGACY**; positive Scene/Gallery lifecycle must remain blocked at consumer/Edge policy. Source PR134 does not supply a matching approved replacement |
| Scene Delete `community_delete_scene_preset_v1` (LIVE STAGING) | Same Artifact-only lock followed by unordered dual Work UPDATE, community_entities/Search/Outbox | Active owner+scene, no paired version/graph pin, no independent dependent Work authorization | **UNENROLLED LIVE LEGACY**; no positive retirement |
| Generic Preset initial `community_publish_preset_envelope` (LIVE STAGING + source ancestry) | New Preset Work/Artifact+Revision, idempotency, Search/Outbox; no `FOR UPDATE` existing Work needed | Active Account, creator/owner and artifact metadata; 5 preset kinds require separate graph semantics; no global cross-Work enrollment | **PARTIAL initial create ONLY**, not reason to permit subsequent dependent retirement |
| Generic owner Work `community_change_work_visibility`, `community_unpublish_work`, `community_delete_work` (PR134 SOURCE) | Existing target Work `FOR UPDATE` only; account idempotency; Search/Outbox | Owner, expected target `row_version`; **for work_type=preset source raises `PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED` before mutation**; no related Artifact/Gallery lock | **DENIED, NOT ENROLLED**. Live Staging functions have differing body MD5 and need explicit operator parity before deployment; do not assume active source guard in Staging |
| Gallery-first `community_publish_gallery_v4` (LIVE STAGING + source) | GalleryWork `FOR UPDATE` **first**, inserts new Gallery WorkRevision and reference `gallery_revision_presets`, changes current published revision, Search/Outbox/Idempotency | Actor owns Gallery, expected Gallery rowVersion; checks owner PresetRevision using plain read (not locked); **no caller historical graph SHA or Artifact/PresetWork version pin** | **GALLERY-FIRST LOCK INVERSION** against proposed Artifact→PresetWork→GalleryWork order. R12 source 2-session negative test |
| Gallery photo create/update `community_publish_gallery_photo_v1` (LIVE STAGING + source) | GalleryWork/media locks; owner-ready photo, cover; immutable photo Revision and current pointer, Search/Outbox/Idempotency | Expected Gallery rowVersion, owner/Creator, provider Media Ready metadata; no global dependent graph scope; gallery_kind/subject validation independent | **PARTIAL** only; must reject unknown Preset/linked graph and never authorize dependent positive retirement |
| Gallery photo delete `community_delete_gallery_photo_v1` (LIVE STAGING + source) | GalleryWork `FOR UPDATE`; pending guards and dependency preflight | Expected Gallery Work rowVersion, owner; current/history Cover, Storage issued URLs, Cloud and Preset refs not universally revoked | **DENIED** by downstream negative gates; NO positive delete |
| Generic Work current/visibility other types | Individual Work lock / source-specific RPC; direct `UPDATE community_works` also possible in privileged workflows | Target rowVersion sometimes present, complete linked current/historical reachability not sealed | **UNENROLLED** for any linked Gallery/Preset; must use all-kind atomic source protocol |
| Moderation `community_moderate_work`, `v2`, `v3`, `community_moderate_entity_v4/v5` (LIVE STAGING) | Case and/or target Work lock, moderation state/Search/audit/outbox; `v5` delegates to `v4` | Moderator role or session-bound recent moderator authorization; **no full Artifact→PresetWork→GalleryWork linked graph lock**, no owner graph pin required for safety takedown | **SAFETY-CRITICAL, MUST NOT DISABLE**. Immediate read suppression must remain effective; restoration requires full graph recheck. R12 actual legacy moderation 2-session negative evidence |
| Reports and Community moderation cases | Report/Case insert and independent moderation command | Reporter/staff policies separate from ownership; targeted Work can be linked | Report submission itself does not mutate Gallery dependency; restrict/remove/restore is a Writer and must publish privacy state consistently |
| Account Erasure `community_tombstone_account` (LIVE STAGING) | Recent auth/session, account-level advisory + `wand_accounts FOR UPDATE` / Creator lock, bulk `UPDATE community_works ... WHERE owner_account_id`, Search wipe, identities/content retention and provider cleanup jobs | Recent session & confirmation, owner account controls; no deterministic per Artifact/Preset/Gallery order, no caller current/history graph pin | **P0 PRIVACY-COLLISION CONFIRMED in isolated actual tombstone RPC**: using a synthetic recent auth session, account-owned public photo Gallery causes the Gallery Cloud negative trigger to abort the full tombstone transaction. Real signed Staging actor remains NOT_EXECUTED. Do not disable erasure or Gallery guards; separate prompt public-read suppression from deferred reference/media cleanup. |
| Biome/Floating Island/ToM Furniture/ToM Clothing Preset | Generic Preset Work and Artifact model present; no separate complete related Gallery writer registry found | Type-specific current/historical refs/media/artifact unknown; do not treat Scene-only digest as complete | **REGISTRY_UNPROVEN** even if generic Preset owner operations are denied |
| DreamSnaps/In-Game/Native references | `community_dreamsnap_publish_gallery_v1` present; native/in-game use cross-product reference namespaces if present | DreamSnaps competition-owned, not Gallery competition; native DDV presets are distinct from Wand Presets; publisher cross-link registry unresolved | **UNKNOWN/READ-ONLY**. No implicit native save applicability |
| Search/Discovery projector & Outbox | Called from publisher/owner/moderation/erasure transactions; standalone worker readers/async consumers exist | Must be derived from *post-commit* authorized states, suppress unpublished/removed/deleted even during asynchronous lag | **CRITICAL OUTPUT IN SAME TRANSACTION**, plus read-time authorization; not a reference-owner shortcut |
| Media/Cloud/Storage garbage collection | Separate owner URL issuer & retention workers; source media physical cleanup gate remains negative | Historical Cover URLs, CDN bearer replay, Cloud private refs may outlive Work pointer | **NOT ENROLLED / NO PHYSICAL DELETE** until signed operator acceptance |

**Important active-drift fact (CONFIRMED)**: The live Staging DB currently contains executable older Scene Unpublish/Delete functions; PR134's source candidate is not an approved deployed replacement. Source filesystem contains only 113 migrations and no matching approved complete legacy Scene writer contract. A successful local PR134 migration test must not be represented as deployed Staging lifecycle safety. All API/Edge exposures need an explicit call-site inventory before release.

## B. Canonical ALL-WRITER transaction contract — proposed `ddv.atomic-paired-writer@r12`

This section is an **owner implementation contract**, NOT a GRANT/deployed implementation. No general positive mutation until **all** known sources support it and QR signs it.

### B1. Request, inputs and end-to-end ownership

```ts
type AtomicPairedWriterRequestR12 = {
  actorAuthSubject: UUID; accountSessionProof: AuthContext; // backend only
  operation: "scene.revise" | "preset.visibility" | "preset.unpublish" |
             "preset.delete" | "gallery.publish" | "gallery.revise" |
             "gallery.visibility" | "gallery.retire" | "moderation.restore";
  idempotencyKey: string;
  targetPresetArtifactId?: UUID;
  targetPresetWorkId?: UUID;
  targetGalleryWorkId?: UUID;
  expectedArtifactIdentity: { id: UUID; ownerAccountId: UUID; creatorProfileId: UUID } | null;
  expectedPresetWork: { workId: UUID; rowVersion: bigint; currentRevisionId: UUID | null } | null;
  expectedGalleryWorks: Array<{ workId: UUID; rowVersion: bigint; currentRevisionId: UUID | null }>;
  expectedCurrentAndHistoricalGraph: {
    schema: "ddv.cross-product-dependency-graph@1";
    registryVersion: string; // binds supported item types and writers
    graphFingerprintSha256: LowercaseSha256;
    referenceEdgesSha256: LowercaseSha256;
    historicalSceneEdgesSha256?: LowercaseSha256; // distinct v1 limited-scope signal
  };
  proposedRevision?: { bytesSha256: LowercaseSha256; byteLength: bigint; blobId: UUID };
  mediaManifest?: { mediaIds: UUID[]; coverMediaId: UUID };
  publicationIntent?: "public" | "unlisted" | "private";
}
```

Existing `historicalEdgeSetSha256` is the **Scene historical GalleryRevisionPreset edge-only** namespace `scene-historical-edges-v1` and is **not** the global graph hash. It is retained as a separate necessary check, never silently substituted for `expectedCurrentAndHistoricalGraph.graphFingerprintSha256`. WEP's offline JSON byte SHA is also unrelated to either graph SHA.

### B2. Canonical graph registry (must enumerate before and after locks)

- All PresetArtifacts (Scene, Biome, Floating Island, ToM furniture/clothing) and identity/owner/Creator/associated Gallery columns; all PresetRevisions and ArtifactBlobs; all current PresetWorkRevision→PresetRevision publication and **all historical** `preset_revision_publications`.
- All GalleryWork IDs reachable via direct associated references or any GalleryRevisionPreset link; all GalleryWorkRevisions, current and historical, and `gallery_revision_presets` edges with BOTH immutable revision IDs.
- All GalleryPhoto/Media/Cover owner+purge state, all historical WorkRevisionMedia and photo Cover fields, all published URI/gateway and Cloud private references; safely include otherwise-unrecognized new reference tables via fail-closed registry completeness guard.
- Work owner/Creator, lifecycle, visibility, moderation, current revision pointer and rowVersion for *every* reachable Work; account active/deleted identity; record which references are PUBLIC/current vs historical/unsealed.
- Source build/platform/game version/provenance; Switch v1.25.0 BID `52BD625D9B4E0053`, schema624 only for verified enrolled native subject. Unsupported Switch v1.25.3/schema626 and Steam: read-only; native DDV writer still OFF.
- A caller-authorized fingerprint must include deterministic version header, registry ID, all node/edge IDs, owner/Creator, current vs historical edge state and all related Work version/pointer/visibility data. Type-annotated, sorted canonical serialization (explicit null, UTF-8, stable UUID lowercase, no locale-specific sorting); SHA-256 hex. Graph unknown => reject, not hash an incomplete subset.

### B3. Actor and global lock order

1. Authenticate backend real actor (NOT service-role impersonated user), session freshness/active account or recent moderator/admin; check operation rights and idempotency request body hash **before any mutation**. For account erasure, session-bound recent auth and affirmative DELETE; for moderation, staff role and active case.
2. Provisional graph discovery with stable IDs. Do not acquire a GalleryWork row lock first for Gallery-first publishing; reverse lookup the target PresetRevisions/Artifacts and **all existing Gallery references** before any Work lock.
3. Acquire the root Account privacy/epoch barrier consistently for new owner writes **before** entity locks (conceptual account tombstone epoch / read-time suppression, not an unbounded mutex that delays emergency hiding).
4. Lock all **Artifact UUIDs sorted ascending**, one-by-one `SELECT ... FOR UPDATE`. Then lock all **PresetWork UUIDs sorted ascending**, then all **GalleryWork UUIDs sorted ascending**, one-by-one. Lock related revisions/media in a deterministic subordinate order after Work locks; never introduce reverse edge lock acquisition via triggers or deferred DDL. Lock-key list must include old *and* new reference graphs on moves/rebinds.
5. Re-read actor/account/owner/Creator/status and complete all-kind graph **while holding all required locks**; if any ID is newly discovered, graph changed, version/pointer SHA stale or registry unknown, ABORT entire transaction and return a terminal stale/unsupported error. **Never lock newly discovered IDs out of order within an already-mutating transaction**.
6. Validate exact expected Work versions, current Revision IDs, immutable reference ancestry, media object bytes SHA+size/owner READY/CLEAR, atomic publication rights, Native version compatibility, and moderation/public privacy policy. Read-only owner readiness fingerprints are advisory, not a permission grant.
7. With all locks and barriers held, insert Artifact/Preset/Gallery immutable revisions+reference edges, current pointers, lifecycle/visibility, search projections, outbox events and idempotency completion **once inside one DB transaction**. Unknown references fail closed. No positive Storage retirement/TTL.
8. Commit atomically. Search/read endpoints must independently suppress removed/deleted/unpublished/owner-tombstoned data even if asynchronous materialization temporarily lags.

### B4. Retry, rollback, and safety-critical exceptions

- Backend may retry only SQLSTATE `40P01` deadlock, `55P03` lock timeout, or `40001` serialization failure, with bounded attempts (proposal: max 3 including initial; jitter and upper deadline; operator tuning required).
- **ROLLBACK the entire command** and retry in a **fresh DB transaction** with a freshly resolved, noncached real actor, live account/membership/staff role, current reference graph and idempotency result. Never retry only the failing statement/savepoint, never reuse prior lock state or graph digest as fresh authorization.
- Stale caller graph, owner mismatch, version conflict, unknown reference, revoked account, incompatible target/version, invalid blob or permission are **terminal**, not automatically recoverable retries; return a new preflight requirement to user.
- Moderator *restrict/remove* and Account Erasure must preserve immediate public read suppression and identity revocation, even when graph cleanup cannot yet acquire locks. Use an independently enforced account/work visibility barrier before or in the same safely committed privacy transaction; schedule follow-up reference/Media retirement under the common registry. Do **not** make emergency hide dependent on optional positive Gallery retirement. Moderation **restore** is a positive re-publication and must satisfy the full all-writer graph contract.
- Emit idempotent outbox and durable operator error metrics without leaking private media URLs or Graph hashes to public clients.

### B5. Minimum 03 COMM / 02 WEP / QR handoff

**03 COMM**: Implement a common internal owner-only `private.cross_product_discover_and_lock_v1(...)` using registry-versioned expanded nodes and sorted lock order; wire it into *every* exposed related RPC with exact caller graph digest & expected Work revisions; add SQL command boundaries for before/after lock/actor reauthorization, idempotency, negative actor/rowVersion/graph, deadlock/timeout handling. Do not expose via `GRANT EXECUTE` or Edge before signed acceptance. Keep old legacy RPCs blocked at server API while preserving prompt moderation/erasure hiding; ensure Source↔Staging migration/version parity.

**02 WEP**: For Scene Revision Intent preserve actual Capture/SubGrid/IncludeRoadFence graph closure and JSON byte SHA/size. Obtain backend **owner-scoped** pair (artifact,presetWork,currentPresetRevision,rowVersion,associatedGalleryWork,currentGalleryRevision,rowVersion), `historicalEdgeSetSha256` (scope explicitly v1) **and** eventually global registry-versioned graphFingerprint; never use the non-atomic readiness object as an atomic fence. Submit ephemeral expected fields and owner upload intents only once backend public route is authorized; otherwise keep `saveRevisionAuthorized=false` and no media/cover mutation.

**04 QR**: Exact source SHA + genuinely signed normal Owner A/B/Moderator Staging A/B/M with actual storage byte SHA, immutable cover/media and old signed URL replay at 0/60/300/post expiry; independent two-connection all-writer RPC concurrency and injected faults, current/historical negative reference/mismatch, privacy suppression before cleanup and bounded fresh actor retry. No live destructive staging records; operator disposable account and Storage namespace required.

## C. R12 standalone true 2-connection negative validation

R12 branch `validation/09int-r12-all-writer-source-inventory-20261024` uses actual PR134 source, 113 migration isolated Supabase local DB, imported **unchanged** R11 helper module solely for synthetic fixture (no R3-R11 replay/reimplementation). New `tests/09int-r12-heterogeneous-source-writer-concurrency.py`:

- **Actual Source generic Preset three owner commands:** one session holds linked Gallery Work; second invokes real owner RPC with valid Work rowVersion; source hard-denies before mutation. **This is safety denial, not atomic writer enrollment.**
- **Actual Source `community_publish_gallery_v4`:** A holds linked PresetArtifact `FOR UPDATE`; B invokes genuine Gallery-first publish with linked PresetRevision and new current GalleryRevision. If B succeeds while A still holds Artifact, it proves a *missing shared Artifact lock* (while B's transaction is always rolled back); R12 records this as a NEGATIVE finding, not a positive publish permission.
- **Validation-only lock-preflight wrapper:** B first acquires Artifact `FOR UPDATE` before invoking unchanged v4; A holds Artifact, expect `55P03` and a full B rollback. Illustrates one safe ordered lock dependency, not an authorized source implementation.
- **Actual legacy Moderation `community_moderate_work`:** synthetic moderator case/role (local only) and A-held PresetArtifact; B restricts linked Gallery Work while A still holds Artifact, only inside rollback. **Do not disable moderation**; this shows source's moderation Graph enrollment remains incomplete.
- **ACTUAL `community_tombstone_account` RPC:** synthetic LOCAL `auth.users` and `auth.sessions` satisfy the real `private.require_recent_session` path. While A holds linked PresetArtifact, B invokes the real RPC and the existing `GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED` trigger rejects its public photo Gallery bulk update. Full B transaction and all provider/account changes roll back. P0 account-erasure liveness obstruction, not signed HTTP actor or Staging proof.
- **Source-derived account-erasure Work bulk UPDATE:** second independent B runs the same Work UPDATE predicate, confirming the Cloud guard conflict. This is a supplemental diagnostic distinct from the full RPC. Do not weaken Gallery negative gates or turn off account deletion.

All assertions include two distinct PG backends, source RPC vs derived distinction, rowVersion/Reference/Search/Outbox/Idempotency before-after equal after B rollback, local DSN host/port/name hard checks, no staging secrets/Storage. Failed or incomplete CI MUST NOT be reported as accepted.

## D. Gaps, release status, next unblocker

No single validated global Reference Registry exists yet; unapproved/legacy Gallery-first code still acquires Gallery Work first. **P0: the actual account deletion RPC is blocked by a Gallery Cloud negative guard for a synthetic owner with a published Gallery photo**. There is no proven separate committed privacy barrier before dependent cleanup, and rejection rolls back the account/identity privacy change. Owner and Privacy/Ops must resolve this without disabling moderation, account deletion or Gallery protection. The proposed schema/API is a contract, **not production migration code**. Until 03 COMM has enrolled every writer, validated full graph under deterministic locks, preserved emergency privacy paths, and QR has signed actual Staging tests: `graphComplete=false`, `retirementAuthorized=false`, Gallery positive retirement, Cloud Private/Restore, physical media/72h TTL, Native Save Writer and Product Apply remain OFF. R17 **30 nodes PASS0 / PARTIAL12 / BLOCKED18** and all 7 seed gates unchanged. No Draft PR merge.


## E. Evidence / exact source run

R12 actual test code-head `e136e8a3f6012f4185775a8b27f50cacf2013cf3`: [Actions #40088735465](https://github.com/DreamwishWand/web/actions/runs/40088735465), 113 PR134-source migrations on an isolated local ephemeral Supabase. Synthetic owner and auth.session; true two distinct PG backends. Source generic Preset owner visibility/unpublish/delete 3/3 denied before mutation (NOT enrolled). Actual `community_publish_gallery_v4` changes Gallery Current Revision with Artifact independently locked (non-enrollment negative), validation-only Artifact preflight `FOR UPDATE` yields `55P03` full rollback. Actual `community_moderate_work` restrict remains functional while Artifact locked but misses Artifact graph synchronization. Actual full `community_tombstone_account` session-authorized local RPC rejects with Cloud-preservation guard and rolls back erasure; separate matching derived UPDATE has same rejection. No real JWT/HTTP, Staging write, object bytes, CDN or public grants. Intermediate unsuccessful runs are superseded; only exact-head SUCCESS can be cited as acceptance. R11 known 3 triggers were NOT rerun or modified in this R12 validation.
