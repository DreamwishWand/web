# 01C CORE — Road/Fence Operation-specific Native closure (Switch 1.25.0 only)

**Scope:** R07 / W-NATIVE-005, `DEV_READY / SOURCE_ONLY_SYNTHETIC`. Child Source of PR #919 repaired fixed `02c5a5d92d8dcdb7ee92e46a64b2a69a36853bcb`, independently accepted by QA946 and selectively integrated via PR947 (protected main `1b0d43a878b8768a762d20ea1e6dd28b680efc94`). **No edits to PR #919 original two files or its QA scope.** This adds one pure operation requirements API, focused tests and this handoff. All product Writer/Apply/EditedCopy/Cloud/Public flags remain OFF.

## Static source and precedence

- Existing `logical.js`: Topology/Adjacency/Components/Transform. Existing `persistent-compiler-v125.js` and `persistent-v125/road.js`, `fence-support.js`, `fence-layout.js`, `reconcile.js`: Native GridObject Base/Ext/DiagExt representation **proposal**, support classification, persistent object descriptor diff and `NextGridObjectID`. The accepted historical Switch v1.25.0 fixture DW-R/F / ROAD-RM01 scopes are **not** current Steam626/Native V3 proof; not rerun.
- Existing `native-reader-v125.js` decodes a bounded same-version Native-shaped saved GridObject representation using catalog. It is **not** direct proof of executable callgraph or producer/consumer effects. Existing `persistent-transaction-v125.js` remains Writer OFF and is not a second Rust executor.
- PR #919 exact repaired fixed `02c5a5d92d8dcdb7ee92e46a64b2a69a36853bcb` (QA946 / PR947 accepted) `operation-intent-v125.js`: separate static ADD/MOVE/ROTATE/ERASE/CONNECT/DISCONNECT/RECOMPILE legitimacy.
- The historical `384bbff7f89a4e3e0ae24d6fdca52ed3c93a4aef` Source was TRUE_RED in QA928 for the legacy `::` RECOMPILE topology fingerprint collision. The repaired Source uses collision-free tuple-set comparison, preserves the earlier `|` ADD fix, and is the accepted parent imported by the child without editing it.
- 01E PR #917 is **Steam/Switch v1.25.3 schema626 static-tier draft**, not direct same-build Road/Fence Native V3. Switch v1.25.0 BID `52BD625D9B4E0053` schema624 is not interchangeable with Steam v1.25.3 `releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22` schema626 or Switch1.25.3 BID `9A239D3DB569756D` schema626.

## Scope by Operation

| Intent | Static logical facts | Remaining exact Native proof |
|---|---|---|
| ADD | Monotonic cells/nodes, quantity before/after, component delta | native create/ID allocation, neighbor recompilation, debit or proven no debit |
| MOVE | Exact translation, logical quantity unchanged | original and destination neighbor recompute, coordinates/orientation/footprint and cost or no-cost |
| ROTATE | Exact quarter-turn transform, quantity unchanged | Native orientation/footprint and variation/adjacent mode recomputation, cost or no-cost |
| ERASE | Monotonic removal, logical quantity delta negative | entire affected component, Native deletion/recompile and refund or no-refund |
| CONNECT | Connected-component count decreases, newly added logical cells or edges | connection producer, merged components, recompile, variation/quantity and inventory debit |
| DISCONNECT | Components increase, removed cells or edges | split consumers/producers, recompile, variation, quantity and refund |
| RECOMPILE | Identical logical fingerprint | exact before/after Native descriptors; trigger/callers/side effects/idempotence; no inferred V3 |

All operations are Tier B for **persistent Save mutation**. LogicalQuantityDelta is **not** Native inventory delta; a logical zero in fence CONNECT does not mean no Base/Ext/DiagExt change. `PRESERVE_EXISTING` is default, no auto-generated layout or unverified post replacement. Any source `Grid.ID`/ObjectID/Neighbor/Spatial readset requires 01A Core authenticity and 01B Footprint/Bounds. 01E supplies **same-build** producer→saved output, saved input→consumer, derived recompute, and negative branches; no invented executable symbols/addresses. Static game-device V4 is **not** blanket required. It is a targeted exception only where exact Native V3 cannot resolve a critical behavior.

## Typed machine preflight

`assessRoadFenceNativeRequirementsV125` calls the canonical PR #919 static assessor itself, rejects malformed or wrong-Build inputs and derives per-Operation **requiredEvidence**. Returns `STATIC_REQUIREMENTS_ONLY` or `FAIL_CLOSED`. It never consumes untrusted caller "proof" as authority. The authoritative 01C compiler MUST still run separately on an authenticated same-build source; Native GridObject plan and source snapshots are not produced here. No user-crafted `BuildIdentity`, GridID, Cursor, logical receipt or synthetic result may authorize 01A Rust mutation, edited-copy or Writer.

## Handoff

- **05 QR-C** reuses accepted PR #919 original2 (QA946 / PR947); independently checks this **new child delta** only, no duplicate parent or old compiler/P1I/RM01 suites.
- **01E**: for each selected Operation, provide exact same-build binary/source SHA + reachable input consumer/output producer, Native neighbor/variation/recompile and inventory cost/refund closure; report UNKNOWN on absent evidence. 01C then maps those witnesses to per-Operation legality.
- **01A** single ProductSession full-doc CAS/atomic/backup/export independent Reopen; **01B** Spatial bounds/footprint/parent legality; **02 WEP** only non-authorizing read-only preflight until Gate.
- **09 INT** sole merge: PR #919 original2 already accepted and integrated by PR947; consider only this child original3 Source paths after separate independent QA, with fresh protected-main blob/CI checks, no stacked branch/QA-only wholesale merge.
- **Rollback** remove this child three ADD files only. Preserve PR #919 (QA946 / PR947 accepted), pre-existing Native Compiler, Pages, original private Save and Backup.
