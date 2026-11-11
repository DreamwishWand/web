# 01E CORE — Native static operation tiers (P0, fixed main ef0372a)

**Operation / release:** `W-NATIVE-005`, `R09`; `DEV_READY / SOURCE_ONLY` only. None of the 21 operations is enabled. The new source file is a bounded, pure static-contract handoff to 01A/01D, **not** another P1G Reader, Rust executor, Native V3 proof, or an invented game callgraph. Original owner-provided game binaries, private save, keys and derived user data are never placed in repo/CI/Pages.

## Provenance and exact reusable ancestors

- **Protected main:** `ef0372a58b9619a442c65b31cecbb88c3cca0029`. 01D `src/lib/ddv/core/items/item-semantics-contract.mjs` Git blob `4943280ba85c244f20f212aa85a8711b1ca49a75` establishes **saved structural path** `Player.ListInventories[InventoryID].Inventory[CanonicalItemID].Amount` and `CompatibleItemType`; it expressly does **not** bind the canonical variant route, Native owned status, maximum stack or Native mutation semantics. Older Switch v1.25.0 schema624 `storage-container-v125.js` and `storage-transition-binding-v125.js` are not reusable as Steam/Switch schema626 exact write authority.
- **01E W1:** PR459 / QA464 observed genuine same-BID Switch v1.25.3 static RomFS event→Item and ambiguous reverse mapping (8 EventIDs refer to Softwood31700014, 4 active); PR465, PR480, PR506, PR539 immutable read-only witnesses and accepted PR568/QA588 are reused. The preserved `RecurringEvent.json` source SHA and actual `main.elf` SHA plus limited native call edges are in `docs/core/01e-w1-native-v3-source-closure-20261104.md`. These include conditions, area, grids, tree, quota, Clock/Execute/Last→Next **candidate** sequence only. `Wetland enum=1` is **not** proven to match the numeric saved Area key, and saved MapKey `155` is not an EventID or protobuf outer key. Intentional 2126 NextOccurrence must not be changed automatically.
- **01A/01B:** one native Rust ProductSession with Core-issued `BuildIdentity`, indexed readset/Revision/IndexGeneration/old-value CAS; 01B owns Area/Grid/SubGrid/Footprint. 01C owns Road/Fence topology, compiler and physical layout semantics, including quantity/variation recompute; 01E does not replicate them. Current Steam/Switch schema626 Build identities must remain separate even when decoded JSON schema is equal.
- **Real-save evidence:** 05 QR-L private whitespace-only lexical V2, independently reopened with Rust/Node, is **not** actual quantity-changing V3. No fresh physical game-device V4 is generally necessary; only unresolved critical behavior after adequate static Native analysis justifies requesting it.

## Operation tiers and what the classification means

`A_CANDIDATE` means **no global wait for W1 or Road/Fence evidence to investigate that independent edit**. It does **not** prove no native recalculation, authorize Export, or bypass same-build callgraph/own-item constraints. `B_NATIVE_RECOMPUTE` requires explicit consumer/producer/derived state and dependent fields. `C_PROTECTED` is excluded from ordinary Save Writer, even if local JSON contains apparent flags.

| Tier | Operations | Static contract/gap |
|---|---|---|
| A candidates | INV_AMOUNT, INV_MOVE | Verified existing saved `Amount` path and `CompatibleItemType` raw fields; missing Native canonical variation/stack cap/zero semantics, atomic move effect. INV_AMOUNT preview accepts only existing positive row and one exact amount pointer; `50→49` example is hypothetical and previous historical game check does not certify current schema626. |
| A candidates | CHEST_AMOUNT | Existing container link `Player.ContainerInventories` plus ListInventories historical schema624 source. Exact current schema626 chest slot field and Native side effects **UNKNOWN**. |
| A candidates | APPEARANCE, WARDROBE | Independent edit investigation allowed; actual 626 saved Part/equipped paths, part enum, owned wardrobe proof **UNKNOWN**. |
| A candidates | TIME_SIMPLE | Only independently proved non-event time fields qualify. No field yet identified; W1 recurrence/2126 is expressly excluded. |
| B | INV_SLOT, CHEST_TRANSFER, FURNITURE_STORAGE, OWNERSHIP_LOCAL, SKIN_SELECT, TIME_EVENT, GRID_MOVE, GRID_ADDDEL, SUBGRID, ROAD_FENCE, QUEST, COLLECTION, PRESET_APPLY | Operation-specific Native consumers/producers and all affected derived writes. For Grid move static Footprint/Bounds/Collision/parent/rotation + atomic CAS is the primary path; do not require V4 unless a critical unknown remains. 01C owns all Road/Fence Native topology. |
| C | SKIN_UNLOCK, ENTITLEMENT_REMOTE | Premium/DLC/Receipt/Entitlement/Auth changes are not authorized general-purpose local edits. |

## New typed handoff API

- `describeNativeOperation(operationId, declaredBuild)`: returns bounded `A_CANDIDATE` vs `B_NATIVE_RECOMPUTE` **plan only**. A malformed, cross-platform or cross-schema Build is denied. Caller-supplied Build is **not** independently authenticated by this module.
- `previewNativeInventoryAmount({declaredBuild,inventoryId,canonicalItemId,compatibleItemType,existingRow,oldAmount,nextAmount,sourceHash,changedPaths})`: validates a single **existing nonzero** raw amount *candidate*, canonical positive IDs, 32-bit max, exact JSON pointer and exclusion of unrelated edits. Zero/depletion/adding a slot require separate Native evidence. Original SHA is shape-checked, not cryptographically proven. This never mutates or exports. Future execution belongs solely to 01A Rust session; the preview is **not** a receipt or CAS authority.
- `inspectNativeStaticTraceDraft({operationId,declaredBuild,producerCalls,consumerCalls,saveReadPointers,saveWritePointers,derivedWritePointers,nativeBinarySha256,...})`: validates submitted static trace *shape*, prevents missing producer/consumer, foreign hashes and protected mutation paths, and explicitly refuses to convert a complete-looking untrusted callgraph into a Native V3 PASS. An empty derived-write list is **not** proof that no recompute is required. No native address, symbol or edge is fabricated.

## Complete same-build Native V3 evidence bundle for a single operation

1. Verified **same binary/build** executable+source SHA/Version/Platform/Steam FullVersion or Switch BID/schema; Native entrypoints and exact callgraph producer→saved output and saved input→consumer with reachable conditions and negative branches.
2. Actual source paths and Core-issued typed `ReadDomain` readset from the **same** SaveSession; canonical ItemID, variation, CompatibleItemType, saved Parent/Container/Spatial references. No UI-supplied ID/cursor/Session token authority.
3. For **one value-changing operation**, list every touched field and derive recalculation or prove *absence* of dependent writes from bounded native control-flow/callers. Include Quantity, storage and collection cross-effects, plus rollback. No unrelated unknowns altered.
4. 01A Rust atomic exact old-value+Revision CAS and no duplicate Reader; backup original first, separate edited-copy, independently Rust+Node reopen with unknown fields and original SHA invariant. 05 QR-C changed-only independent Native/Rust tests; 05 QR-L isolated real same-version operation QA. V4 only if a critical static ambiguity survives.
5. **Negative tests:** forged SessionID/Read-set/IndexGeneration, stale CAS, changed Build, zero/overflow, absent source row, malformed ItemID/variation, duplicate container references, stale derivative, forged entitlement or DLC, W1 ambiguous item→Event, 2126 auto-repair, incorrect rollback or replay. No release flag without 00 CTRL explicit per-operation permission.

### Handoff / dependency release

- **01A / 01D:** Start independent `INV_AMOUNT` existing-row typed CAS work; do **not** wait for W1 Native Wetland geometry or 01C Road/Fence. Product write remains OFF until separate same-build Native amount closure + 05 QR-C/L operation acceptance. Existing 01D raw `Amount` inspector is reused, not copied into 01E.
- **01B / 02 WEP:** For grid placement/rotation, use 01B source-minted spatial identities and static collision/parent/Footprint; 01E only adds producer/consumer/derived edges, no geometry recomputation duplication.
- **01C:** Own Road/Fence topology, Quantity, Variation and recompile; ask 01E only for distinct missing exact Native call edges.
- **06 PRODUCT:** Do not turn source-only save state into Owned, Discovered or valid UI edit affordance. Tier A *candidate* does not mean enabled.
- **09 INT:** Source PR is DRAFT only; select accepted changed files after new CI+05 QR-C scoped acceptance. Do not merge historic 01E PR539 or QA-only branches. Rollback = omit/delete only new contract, types, tests and this document; keep protected main and existing public Pages.
