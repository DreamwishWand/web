# 01A CORE — Post-PR322 semantic completeness and product P1G gate (2026-11-03)

Status: **RESEARCH / SYNTHETIC ONLY / WRITER OFF**. This is a release-blocking interface inventory, not a schema626 product API implementation. It is based on Timekeeper Issue #19 (accepted architecture), Wand 01A Save/Codec/Version, Wand PR #312 `c6b152512d3bc901fd1474dbcfcb07253ae1b347`, PR #322 `8ef6d111ba904e20590d6444abf422b1c1a14a33`, QA PR #320 `247c585543505ce458dc406c213ada96c8907089`, Timekeeper TIME PR #20 `1069a16d5e4e62c556197420bed6d2fbfba0809b` and WEB PR #27 `eb071cc49927c1b154b6780001d2d6f5f8abeca8`.

## ReferenceIndex completeness: proof obligation, not field-name scanning

Existing PR #312 `session.rs`: caller-provided `ReferenceIndex` consistency checks and exact selected source pointer witnesses; `semantic_safety.rs` validates only directly observed `GridObject.Container -> Player.ContainerInventories`. PR #322 `integrity.rs` adds bounded source-derived `World.GridCollection.Grids[*].Objects[*].State.Storage.ContainerInventoryID -> Player.ContainerInventories` checks, rejects missing/invented edges, unknown locations of the same named key and unknown/unowned nested edits. **This does not establish the complete reference graph**, and source guards cover at most 2 MiB; there is no accepted streaming full-save index. PR #322 is based on frozen PR #312 `1909dd5e041db69dd3c6fc0f896d0c57e02c5a89`, not the newer PR #312 head. Do not claim that its code is already in PR #312.

Per-domain closure evidence required before operation-specific write:
- Ownership and collections: source-key identity, ownership/container/list/collection-set membership and back-reference/invariant changes; domain-native semantics and cross-domain consumers **UNKNOWN**.
- ListInventory / ContainerInventory / Chest: inventory identity and contents, object-to-container links, capacity, ownership and quest/collection consumers, special chest lifecycle; only the aforementioned tiny container edge is **SYNTHETIC_TESTED**.
- Grid / DiffGrid / SubGrid / houses: direct Area->GridID; GridObject key/ID, Diff Modified/Removed, SubGrid links, exterior house entrance and ID remap effects. Source matching is not runtime provenance.
- Quest / progression / ConditionalEvent: active `ConditionalEventHistory.ActiveEvents[*].SpawnState.SpawnedObjects[*]` (GridID, GridObjectID), historical collected GridObject addresses under achievement/duty paths, unknown system pointers, quest/duty/mission/conditional-event actions; the observed save-local NOT_MATERIALIZED addresses are **not** proven inactive.
- RecurringEvent: canonical EventID, saved index, oneof variant and NextOccurrence token must be bound to source Registry and version-specific 02 TIME native consumer semantics. EventID is not an ItemID or GridObjectID.

A complete graph requires all reference producers/consumers and deletion, insertion, identity remap, tombstone, nonmaterialized identity and version-specific native invariants, with a documented enumeration proof and collision/duplicate-key handling. The graph must be **Core-derived from the entire supported source** and re-derived or invalidated after relevant ChangeSet revisions. If any relevant domain/consumer is unknown, return explicit `DEPENDENCY_CLOSURE_INCOMPLETE` at the future product authorization gate. An affirmative absence-of-known-reference check is never an allow grant.

## Fail-closed matrix

| Mutation / input | Research enforcement and remaining gate |
| --- | --- |
| Unknown nested state removed | PR312 structural-loss check; PR322 protected-token/known-leaf gate; reject |
| Unknown value changed / lexical reserialization | PR312 ordinary stage does **not** fully prevent it; PR322 source-guarded stage protects opaque subtree bytes within bounded fixture, but is not production |
| Unknown array reorder/append/shrink | Reject unless dedicated domain-owned identity/remap semantics accepted; post-PR322 isolated regression tests include reorder, grow, shrink |
| New reference or target deleted | Source-before and Source-after exact edge reconciliation; unknown reference-field positions and dangling targets reject. No native all-domain proof |
| Incomplete/missing source graph, caller-asserted edge, stale source SHA or revision | Fail closed. Frontend cannot supply trusted graph, semantics, identities or capability grants |
| Unsupported or unrecognized ZIP member, local/central extra, comment, descriptor flag, ZIP64, filename, gap, bounds, CRC or method | Fail closed, no silent normalization or repack. Unsupported archive may still receive a separately justified read-only diagnostic |
| Unexpected schema or unverified external BID | Read-only when codec safely decodes; NEVER infer BID from `GameInfo.Version` or a registry hash |

## ZIP metadata interop matrix — supported **research** only

Rust `p1g.rs` currently accepts only exactly one `profile` entry, ZIP method **0 (Stored)** or **8 (Deflate)**, strict local/central matching, flags either 0 or UTF-8 bit 11, zero entry extra and file comment, zero archive comment, zero ZIP prefix/gap/descriptor, no ZIP64 or unknown extensions. Research tests and PR #312/QA #320 independent Node/JS oracles cover encrypted AES256-ECB/PKCS7, CRC/length/parity/reopen and negative metadata fixtures. This is **not** acceptance for arbitrary real ZIP metadata. The writer cannot silently change compression method, timestamps, file flags, local/central metadata or ignored bytes. Future supported classes need both original local/central parsed representation, explicit encode fidelity and independent Rust <-> Wand/Timekeeper JS Codec verification per class. Existing method0/8 success must not be generalized.

## Versioned interface contract proposal (NOT exposed in product)

Target `ddv.common-save-session/1`, **read-only subset first**:
1. `openLocal(sourceFile, sourceP1gSha, saveIdentity, externallySuppliedBuildEvidence)` -> Core-issued opaque `SessionId`, revision 0, separately verified `P1gSourceSha256` and `DecodedJsonSha256`, codec support, source evidence and denied writer capabilities. External `TargetBuildIdentity.SwitchBid` has separate provenance; never extracted from schema626.
2. `queryPage(sessionId, revision, view, opaqueCursor, limit, cancelToken)` -> ordered typed bounded rows, `complete`/nextCursor with Core-owned index generation, source SHA and revision. The Worker decides the cursor; never trust frontend asserted reference graph. WEB PR #27 response fence limits 200 rows, 64 KiB/row, 2 MiB/page, 512-char cursor, but Core presently has only numeric pointer-offset research `query_paged` (64 rows, 512 watched pointers, 512 preview bytes), **not** that product implementation.
3. `readW1Witness(eventId, savedIndex, oneof, registrySha, oldUtc)` -> evidence object with exact `rawOldTimestampJson`, decoded UTC CAS, selected registry hash, source P1G/JSON SHA and explicit BID provenance. The 02 TIME native/allowlist gate remains separately necessary. Event `2010000021`, saved index `0`, kind `ItemSpawning` are distinct; no access by guessed item ID.
4. `stageChangeSet`, `undo`, `redo` and `verifyExport`: **not available to product READ-only Worker**. The current `stage_command_source_guarded` and `create_p1g_copy_research` are isolated synthetic proof APIs; never translate `product_writer_authorized=false` into a positive grant. Future typed SemanticCommand requires Core-owned identity, complete operation-specific read/write/dependency sets, exact revision and Source-CAS and native semantics, immutable original cipher as backup, one verified encrypted output and independent reopen.

Capability axes: `READ_PACKAGE`, `READ_PROFILE`, `READ_PROJECTION` are independently reported; `PLAN_OPERATION`, `ENCODE_COPY`, `PERSISTENT_REPLACE` require new affirmative evidence. **All product write gates remain false**. No original overwrite, no backend P1G upload, no ZIP bundle.

## Integration / QA

- **Wand PR #312 main branch unaffected**; PR #322 frozen-base tests retained. This child contains only test-only regression and contract/CI changes outside the shared crate. No redundant 16/64/100/200 MB browser stress or 256MB tests.
- 05 QR must audit this child's exact HEAD and its ancestor PR322 separately against PR312 current head, confirm protected array, unknown new reference, original P1G SHA/decoded SHA and external BID distinctions and meta-class independent oracles; do not inherit green runs across different heads.
- 03 WEB may consume **contract analysis and fail-closed read-only DTO design**, not compiled product Rust WASM/Worker bindings. Phase B remains BLOCKED.
- Release requires per-domain native closure, real schema626 edited-copy preservation/independent reopen, complete ZIP metadata compatibility, real browser budget and Switch cold-load/save/restart as applicable, followed by independent QR.
