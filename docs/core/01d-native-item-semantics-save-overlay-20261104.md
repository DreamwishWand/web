# 01D CORE — Native Item Semantics & Save Overlay (main-first, source-only)

**Workstream:** W-01D-011 + W-COLL-017 + W-LOCAL-019
**Baseline:** protected TEST main `d3ec2f5b66da9bbef42943fc9abaea067df9aac4`.
**Authority:** current Roadmap (2026-11-04 10:37 JST), 01D/01E Handoffs; previous QR241/QR243 unchanged. This branch adds a structural/raw inspection interface only; it does not absorb unmerged PR195 or change main's Collection/catalog UI, JS Worker, Rust engine, editor or public flags.

## 1. Versioned source/semantic evidence

| Layer | Nintendo Switch 1.25.0 / BID 52BD625D9B4E0053 / schema624 | Nintendo Switch 1.25.3 / BID 9A239D3DB569756D / schema626 | Steam / others |
|---|---|---|---|
| FullVersion | Game version/BID source known; **complete FullVersion string not established by this new contract** | Original RomFS `releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22` (01D E0); not derivable from profile alone | Independent original full-version/profile/Platform source required |
| Reference Catalog | main `static/ddv/collection/v1.25/index.json` 12,552 reference item rows/8 label locales; shard hashes checked by existing loader | Exact 1.25.3 reference ItemID+text catalog not yet bound or verified in current UI; never borrow 1.25.0 data | Not accepted |
| CollectionDefinition | PR195 SHA-bound original packed CollectionSet corpus 293 definitions/17 Category/256 typed operands, independent QR241 selector STATIC and QR243 Group plan STATIC | 01D original 293/293 `CollectionSet.json` 45,171 bytes SHA `e4887dc5729b8660caadc0d8f875a199a331973ccfeb97c740542a27ac44cc87` BYTE IDENTICAL to 1.25.0, two RecipeType arguments and zero sentinel present; exact source identity is not complete live membership | Not accepted |
| ItemDatabase | Original source dump 17,413 ItemIDs SHA `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048`; no live ItemDB result | Current live ItemDB, concrete selector result and variation mapping not proven; v1253 source/native call-flow analog reviewed only | Not accepted |
| Save input | `GameInfo.Version=624`, `Player.CollectionSets`, `Player.ListInventories` structural contract; real schema624 owner Save/UI native membership missing | `GameInfo.Version=626`, same structural field declarations; 01A local P1G reader + separate 05QR V2 codec mechanics partial; actual personal Item semantics not accepted | Never infer from schema alone |
| Writer | OFF | OFF | OFF |

FullVersion/BID/Platform authority comes from original external same-version evidence and Core V0; `GameInfo.Version` cannot prove target BID. Cross-save `GameInfo.LastSaveDeviceInfo` is NOT original storage platform. The new source-only module makes **no attestation** from caller-supplied strings; a 01A Core-owned session capability and 05QR still must establish provenance. Neither version’s source-corpus cardinality proves a Native category denominator. The v1253 E0 raw equality is a *data fact*, not Native semantic acceptance.

## 2. Exact observed Source field contract, not interpretation

- **Category**: Original `CollectionDefinitionID` (positive key) maps via verified source Definition→`CollectionSubMenu_*` category, `GroupData` group structure. `CollectionSets` is an **array**, not `CollectionSets[definitionID]` by positional index. `GroupData[GroupIndex].GroupsCollectionItems` is a map from decimal ItemID key to bool. `true/false/ABSENT` are distinguishable RAW_SAVE_BOOL; **true is not yet independently proven game UI Discovered/Collected**, and false is not automatically Missing. A group absent in a save does not mean an empty Native category.
- **Inventory**: `Player.ListInventories[InventoryID].CompatibleItemType`; `Inventory[CanonicalItemID].Amount` integer >=0. The `Inventory` map can be absent independently of Amount=0. `CanonicalItemID` is **not necessarily the displayed variant ItemID**; routing/variation, alternative storage, deployed furniture and game-side eligibility remain native-dependent. An observed amount0/positive is a RAW_SAVE_AMOUNT only, not authorized `Owned`.
- **Native group**: `GetItemsInGroup(includeIgnored=false)` first unions typed/explicit included candidates, then subtracts ignored. `includeIgnored=true` bypasses subtract; **GetNewGroup** additionally calls **IsValidItemForCollection** after Group and discards invalid items. RecipeType returns `CraftingRecipeItemData.Result.ItemID`; `ICollectionItem.get_CanBeCollected` and `IItemIsVariationOf.get_IsVariationOf` actual dynamic vtables/lookup and valid variation identities are unverified. One explicit original ignored ItemID=0 must not become an item.
- **Denominators**: Native final Group ItemID identity set after ignored and IsValid filtering, Version/Category availability/DLC/visibility exclusions, membership refresh/caller rules, cross-Category duplicate policy and game UI meaning are ALL required for a trusted per-Category denominator. `293 definitions`, `17 categories`, `256 selectors`, `17,413 ItemDB`, `12,552 browse rows`, the count of saved bool map keys and raw inventory keys are NOT denominators. `entryDenominator=null`, `uniqueDenominator=null`, `Owned/Discovered/Missing=UNKNOWN` until operation-specific independent acceptance.
- **Read permission**: Source-only Catalog browse already in main; a verified local Session can eventually expose private exact-BID RAW_SAVE inspection, but this module does NOT authorize displaying user metrics or saving that private information to cloud, logs or repository.

## 3. Operation matrix (01A and 08 WEB integration)

| Operation | Primary Source field | Read | Inspect | Preview | Write | Minimum closing Native/QA gate |
|---|---|---|---|---|---|---|
| Inventory stock | `ListInventories[ID].Inventory[CanonicalItemID].Amount` | Structural | RAW flag/amount | Inert old-value CAS candidate only | OFF | Original ID/compatible type, variants, placement/ref, Native amount rules, V2+V3+05QR |
| Furniture | Inventory + World Grid/DiffGrids | Source only | Partial | OFF | OFF | Placed v inventory, stack and variation, same-BID native |
| Clothing | CollectionSets + inventory | Source only | Partial | OFF | OFF | Unlock, equip, mapped Item variation and real UI |
| Crafting | Source RecipeType selector `Result.ItemID` | Static | Source only | OFF | OFF | Live recipe registry and result, eligibility and unlock |
| Recipes | Save unlock field **unknown** | UNKNOWN | UNKNOWN | OFF | OFF | Locate authoritative original Player field and Native consumer |
| Memories | Source MemoryShard + CollectionSets | Static | RAW only | OFF | OFF | Piece completion and eligibility vs UI |
| Touch of Magic | Native DecorationPresets.Toggle observed shape | Partial | Partial | OFF | OFF | Exact owner/style/asset semantics and rights; local per-file backup separate |
| Collection | `CollectionSets[*].GroupData[*].GroupsCollectionItems` | Structural | RAW bool/ABSENT | OFF | OFF | Native GetNewGroup/IsValid, full category denominator, actual display |
| Premium/Entitlement | Excluded | OFF | OFF | OFF | OFF | Not a normal local Writer target |
| Quest progression | Excluded | OFF | OFF | OFF | OFF | Multi-domain native progression not authorized |

In `src/lib/ddv/core/items/item-semantics-contract.mjs`, typed reads return **RAW_SAVE_STRUCTURE_ONLY** with source field flags and no claims of Native state. Source shapes are for use **inside the 01A Worker/session**; passing a spoofed client object or metadata must not mint a trusted capability. The PR195 Category binder is not included on this main-based branch; no DefinitionIDA→ItemID native join is silently generated.

**01A typed read handoff**:
1. `Item.GetSourceCatalogDetail({sourceCatalogRef,itemId,locale,targetBuild})`: reference ItemID/labels only after existing manifest/shard integrity and exact Build/Locale.
2. `Item.InspectCollectionFlag({sessionHandle,definitionId,groupIndex,itemId})`: session-owned direct read of `CollectionSets` true/false/ABSENT, no personal metric authority, 64-row cursor/paging and revocation by Core; no full profile transfer.
3. `Item.InspectInventoryAmount({sessionHandle,inventoryId,canonicalItemId,compatibleItemType})`: exact Inventory map + validated canonical route, returns raw Amount or ABSENT. No user-selected fake canonical mapping.
4. Core to bind source original full-version/BID, Save original SHA, session/revision/index generation, immutable target identity and complete-document validation. All raw bytes and decrypted data local, never server upload.

**08 WEB consumer**: Common ItemID detail and Collection/facets continue to display versioned reference source. For a mismatched 1.25.3 Save vs 1.25.0 Catalog, show explicit **unsupported join / unknown**, not positive personal state, not false empty. For a future accepted exact-version operation, an explicit local Session-scoped overlay should distinguish `RAW bool`, `Owned/Discovered` *verified states*, and `UNKNOWN`; present status is UNKNOWN for all personal labels. Remove `/editor/items` 12 fake samples on its own 08 WEB accepted main-based change; coordinate with common `W-FOUND-020` identity instead of duplicating Entity/ItemID models. No game image until rights approved.

## 4. First low-risk item Writer candidate — research handoff only

Proposed *candidate*: `Item.SetInventoryAmountCAS` applied to **one existing, verified mapped canonical inventory row** (not newly invented row, premium currency, entitlement, placed furniture, quest/progression, missing source/variant). **No operation authorization; no export.** The inert `previewInventoryAmountCAS` displays only a hypothetical old/new amount after structural old-value match; this is NOT a Core Revision CAS.

**Required acceptance in 01A and 05 QR before any editing**:
- V0: exactly original packaged P1G SHA+size/Platform/installed FullVersion/BID/schema; non-public original storage and explicit local scope, exact Owner approval for any real write test.
- V1: one original same-build inventory ID, compatible ItemType, canonical ItemID + variation and ID reference graph, target `Amount` current raw integer, all parent/child inventory and world storage dependencies observed.
- V2: Core-issued single session and source/index Revision CAS, stale-token negatives; original-first backup; exact old raw token+value CAS; change only one existing `Amount` field in an isolated decoded copy; retain unrelated and unknown fields, full-document validation and exact diff; encoded edited P1G, independent local ZIP/CRC/reopen, unchanged original hash, rollback.
- V3: same-build Native consumer/producer, quantity limits, stack depletion/refills, alternative inventory and item placement, dependent references and UI comparison. Verify negative CAS/replay, amount=0, absent row, wrong subtype/variation, wrong version, negative/overflow, user mismatch. **No implicit inventory edit if this cannot close.**
- 05QR independently accepts *that exact operation* and 00CTRL explicitly enables only that action. V4 solely for a concrete unresolved behavior that V0–V3 cannot decide.

Result now: `DEV_READY=source-preview-only`; `REAL_SAVE_STRUCTURAL_VERIFIED=not for this inventory operation`; `OFFLINE_EDITED_COPY_VERIFIED=false`; `NATIVE_SEMANTICS_VERIFIED=false`; `DEVICE_RUNTIME_VERIFIED=false`; `PRODUCT_OPERATION_ENABLED=false`. All Writers, public media, entitlement/Quest and original overwrite OFF.

**No need to redo QR241 Native 256/256 STATIC or QR243 Group source plan.** Do not merge the broad PR195 branch; 09 INT should rebase/selectively import only new independently scoped material onto single main lineage.
