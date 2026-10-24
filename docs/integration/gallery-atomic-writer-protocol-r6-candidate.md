# 09 INT — Atomic Gallery / Preset Writer Protocol R6
2026-10-24 | Validation-only design; **NOT deployed / NOT canonical-approved** | Issue #119 | 03 COMM PR #134 owner parity review

## Evidence and scope

Actual Staging `pg_get_functiondef`, table triggers, PR #134 review, and independent isolated PostgreSQL 17 R3–R6 tests. Original PR #123 remains untouched. Switch game evidence strictly v1.25.0 BID 52BD625D9B4E0053 schema624. `graphComplete=false`, `retirementAuthorized=false` always.

### Writer inventory
One RPC invocation is a PostgreSQL transaction, **not evidence of an application retry loop**. `FOR UPDATE` means its named row only. `idempotency_keys` are per request, not Gallery-global conflict control.

| Real deployed writer | Transaction/lock sequence observed | Mutation and authorization | Coverage/unresolved |
|---|---|---|---|
| `community_publish_scene_preset_product_v1` | advisory(account,key), existing update Artifact → PresetWork → GalleryWork | owner checks; creates PresetRevision/WorkRevision, GalleryRevision, publication, linked revision edge, Search/outbox | source-only PR134 historical parity missing; owner+current/history fingerprint and global ordering not proven |
| `community_unpublish_scene_preset_v1` | advisory, Artifact FOR UPDATE; then one two-row Work UPDATE with no explicit sorted locks | owner of Scene; unpublish paired Preset/Gallery, delete both Search docs, outbox | legacy function live Staging, missing from canonical source; complete graph & row version pin absent |
| `community_delete_scene_preset_v1` | advisory, Artifact FOR UPDATE; unsorted two-Work UPDATE | owner of Scene; tombstone both Works/Entities, delete Search, outbox | same; no comprehensive cross-public dependency validation; no positive authorization |
| `community_unpublish_work` | advisory, target Work FOR UPDATE only | owner+expected Work rowVersion; lifecycle state and Search/outbox | **confirmed missing** Gallery lock for a linked Preset Work |
| `community_change_work_visibility` | advisory, target Work FOR UPDATE only | owner+rowVersion; visibility/Search/outbox | no associated Gallery / preset cross-work lock |
| `community_delete_work` | advisory, target Work FOR UPDATE only | owner+rowVersion; delete Work/Entity/Search/outbox | full graph/owner Media obligations unaccepted |
| `community_moderate_work` | moderation case FOR UPDATE → target Work FOR UPDATE | moderator/admin; Work moderation, Search, audit,outbox | linked other Work presentation/graph not synchronized; **must preserve prompt moderation authority** |
| `community_tombstone_account` | recent-auth account and creator locks, account-delete advisory, then UPDATE all owner Works without explicit sorted per-Work locks | recent-session + DELETE confirmation; work+identity+interaction suppression, Search deletion and cleanup journal | all related Gallery/Preset Work topology not isolated; **privacy erasure must remain functional, not blocked to satisfy Gallery** |
| `community_publish_preset_envelope` | advisory; newly created PresetArtifact/Work/Revisions/Publications; no existing Gallery Work lock | creator/owner, five Preset types, Search/outbox | reverse Gallery reference absent; ToM/Biome/Floating Island links **SEMANTICS_UNKNOWN** |
| `community_publish_gallery_v3/v4` | advisory; GalleryWork FOR UPDATE, gallery revision/linked preset entries; Search/outbox | owner+rowVersion, published/visibility/creator checks | Gallery-first lock can invert Artifact-first future lifecycle dependencies; current/historical preset status during publish not serialized as universal graph |
| `community_publish_gallery_photo_v1` | GalleryWork FOR UPDATE after service manifest gates; immutable revision, Search/outbox | owner+creator+expected rowVersion, media+subject check | photo-only Cloud URL/Media lifecycle separate; no full dependent graph |
| DreamSnaps Gallery publishers | DreamSnaps entry then own Work lock | authorized entrant; DreamSnaps publication/Search | separate competition product contract; do not treat as Gallery Preset reverse link |
| Search/Discovery | in-RPC projection writes; query RPCs read `search_documents` | Search is a derived projection, not authoritative ownership registry | must atomically project publication transitions and invalidate caches; read-only searching is not an ownership writer |
| Native/InGame Listing | no public registry verified | local DDV native information distinct | `REGISTRY_MISSING`, fail closed |

**DB table enforcement:** three existing Known Gallery Reference triggers only cover (a) GalleryRevisionPreset INSERT, (b) PresetArtifact old/new Gallery binding insert/update, (c) PresetRevisionPublication INSERT. Current/history composition immutability and Work current revision/sealing guards exist separately. **No verified universal Gallery lock guard** for target PresetWork lifecycle, visibility, current revision or moderation changes. Scene historical RPCs exist in Staging but are not source-parity accepted by PR134.

## Proposed all-writer transaction protocol (REQUIRES 03 COMM OWNER APPROVAL)

1. Begin one server-owned transaction. Resolve actor and verb authority, owner/creator account, idempotency key and full request hash. Moderation or account-erasure emergency restrictions have their own explicit safe-denial path and must not be deferred for Gallery positive retirement.
2. Read/discover candidate authoritative Artifact, Preset Work, Gallery Work identities without taking rows in inverse order. Reject missing/ambiguous registry and unsupported versions. Treat identity discovery as **provisional**.
3. Lock existing PresetArtifacts **ascending UUID**, then PresetWorks **ascending UUID**, then GalleryWorks **ascending UUID**. In each class use explicit ordered per-row `SELECT ... FOR UPDATE`, not unordered `UPDATE ... WHERE id IN (...)`. Do not acquire an earlier class after holding a later class. For a gallery-first writer, amend its preflight before taking the Gallery lock; simple late trigger insertion is inadequate and can deadlock.
4. While holding all locks, rediscover authoritative backlinks, compare exact identity set, owner/creator, current and historical immutable revisions, moderation and publication visibility, rowVersions, source version and graph fingerprint. If the identity set changed between discovery and locked read, abort/restart from a new transaction. A Gallery Work's rowVersion need **not** increment for a new dependent edge.
5. Authorize/mutate only after under-lock proof. Update related Work state, Search documents, publication refs and outbox/idempotency in the same transaction. Use one monotonic request identity / event dedupe; no cross-transaction side effect in an uncommitted attempt. Unknown registry or Cloud/physical Media semantics -> refuse **positive Gallery retirement**.
6. On PostgreSQL `40P01`, `55P03`, `40001`, roll back the **whole** transaction and, if policy allows, retry in a fresh transaction (example implementation ceiling three attempts, to be accepted by backend owner). Re-resolve actor, ownership, references, expected graph, and expected rowVersion. Never blindly replay a previously valid owner snapshot. Stale graph/actor/rowVersion is **terminal conflict**, not automatically reauthorized; exhausted retries give typed failure and no partial writes.
7. Privacy account-erasure and moderation cases may need immediate authoritative read-time suppression, plus asynchronous safe cleanup after a consistent lock boundary. **Do not block statutory erasure or abuse removal merely because Gallery retirement graph is incomplete.** This is a design requirement, not implemented authority.

## Executable negative/positive isolated tests

R3 Actions40069328155: two PIDs, three known writer fences `55P03`, undo/retry, stale fingerprint test-only refusal, synthetic reversed lock-order `40P01`.
R4 Actions40069773553: common Artifact→PresetWork→GalleryWork order with wait/release/rollback; clean 2x transaction replay shape.
R5 Actions40070469299: **bypass** — Gallery row held by A while B committed linked PresetWork lifecycle change; Gallery rowVersion unchanged.
R6: separate minimal candidate B acquires Artifact→PresetWork→GalleryWork before lifecycle change, must block on A's Gallery row with `pg_blocking_pids` and `55P03`; entire transaction rollback then retry after holder release. This closes **only the synthetic R5 fixture**, not real RPC implementation or account/moderation cases. See validation workflow evidence and its exact HEAD.

## Hard safety and ownership gates

09 INT owns cross-product identity/backlink semantics, locked graph and negative regressions. 03 COMM owns actual service transaction implementation, actor/idempotency/rights and PR134 source-parity decisions. 04 QR owns real approved disposable Staging two-session and signed operator acceptance. No new changes to PR #123 or PR #134 from 09 INT. Until reviewed and implemented across all writer paths, **positive Gallery Delete/Unpublish/Dependent Retirement OFF, Cloud Private/Restore OFF, physical Media Delete/72h TTL OFF, native DDV Writer/Product Apply OFF**.