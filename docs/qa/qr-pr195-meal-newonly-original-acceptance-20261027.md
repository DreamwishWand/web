# 04 QR — PR195 remaining ActivityItem Meal 3 new-only original-byte independent acceptance (2026-10-27)

**VERDICT: PASS — STATIC Meal selector-stage Where predicate and raw protobuf (three entries), with PARTIAL/UNKNOWN full `MealItemData.get_CanBeCollected` positive eligibility.** Not a runtime, Save, personal Collection or release-gate PASS. All PRs DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.

## Start gate and scope

- Existing 01D Owner PR #195 **exact HEAD `9f8128c38abb5bd83ede5fb18f3690533079a9d5`**, Owner CI [40427063298](https://github.com/DreamwishWand/web/actions/runs/40427063298) completed **SUCCESS** (1029 PASS, 0 FAIL, 12 inherited SKIP; total1041).
- Compared against QR #202-accepted frozen Owner `0b8e7b13190a518c8e31f38f48d35f0bee3425dd`: **ahead 4 commits**, exactly 3 Owner paths: new `native-activity-meal-original-predicate-v125.json`, new six focused Owner tests and bounded appendix to existing `collection-save-backed-readonly-v125-20261026.md`. No prior QR198–202, CharacterUniverse/MemoryShard/Pet/Figurine/ByGameplayTag/Flower, WEB192, INT194, Source134–142 or Operator gates rerun.
- This independent QR is a **new-only** frozen-base PR, no product-code modifications. Scope **Nintendo Switch DDV v1.25.0 BID `52BD625D9B4E0053`, schema624**. Steam and Switch1.25.3/schema626 remain unpromoted.

## Independently rehashed original sources and wire

QR ran a fresh standalone original-byte parser, without importing the Owner report or QR #202 tests, on the actual private originals already in the working container. Exact bytes and SHA256:

| Original source | Size | SHA256 |
|---|---:|---|
| ExeFS/main NSO, BID `52BD625D9B4E0053` | 96,002,294 | `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0` |
| RomFS global-metadata.dat, magic FAB11BAF/version31 | 36,538,728 | `07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c` |
| Original same-build dump.cs | 59,624,529 | `a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0` |
| Lossless Item DB raw GZ | 5,090,928 | `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048` |
| Original Support Tables raw GZ | 168,583 | `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9` |

Decompressed lossless DB **29,992,206 bytes / SHA `81d3743fa9620b9e17fa702f7341426cc3d9600c100146b23902cc29c53bbae1`**; Support Tables **748,439 bytes / SHA `638904e8c3fb9ea62c382b7f00208c877a5a862436a2a55077f19c1fd6ebb2ac`**. The support archive labels `platform=Switch`, while Item DB labels `platform=Nintendo Switch`; version/BID and actual source hashes match the pinned Switch source. These labels must not be interpreted as Steam or version compatibility. Historical untraced `d548...` metadata remains **NEED_SOURCE** and is not equated to original verified `07e...`.

Independent original `tables.CollectionSet[].rawPayloadBase64` entire entry decode (not just Owner's field9 excerpt):

| Definition | Name | MealType | Full protobuf bytes | Full payload SHA256 |
|---|---|---|---:|---|
| `2120000022` | Dessert | `2001500000` | 138 | `f4f7d7cc2a80a67dd1e4eb519ca943697ec04952a9889f0813b1aba0973372ce` |
| `2120000032` | Dinner | `2001500001` | 132 | `d9f6d844709bc1a3d2d135787047838cd0b816e222205e32cb0c736b5b716a48` |
| `2120000111` | Appetizer | `2001500003` | 128 | `6913254a004c0d12f5a418db26a76e0ef926c83c2e806deb920f3e28b291fdf3` |

Each independent source record SHA matched its retained rawPayloadSha256. The wire path is **Group field9 → CollectionsByType field2 → ActivityItem field6 → Meal field2 → nested MealType field1**. In each group `CollectionsByType.Ignore` is absent / protobuf default false, but **the separate `CollectionsByItem.Ignore` is explicitly true**; those semantics cannot be merged or overwritten. The 45,171-byte *whole* original CollectionSet.json remains a separately manifest-attested source, not independently whole-file rehashed; the three **full individual original protobuf records** are verified.

## Independent NSO/metadata Native proof: one shared predicate and three selectors

The original NSO0 LZ4 sections were decompressed from authentic original bytes; native instructions, `BL` targets, metadata MethodDefs/interface offsets and NSO RODATA generic pointer chain independently decoded.

- `CollectionGroup._GetItemsFromType` outer ActivityItem case6 `CMP W8,#6` RVA **`0x4BFCACC`**, inner Meal case2 `CMP W8,#2` RVA **`0x4BFDD28`**. ItemType argument `MOV W1,#3` at `0x4BFDD54`.
- `BL` RVA **`0x4BFDD5C`** targets `ItemDatabase.GetAllByType<MealItemData>` native implementation `0x37811C0`. Encoded NSO generic usage at `0xB1EF548` is **`0xC003035D` → MethodSpec98734**; original NSO MethodSpec RODATA RVA `0x96E5EC4` raw **`29950100ffffffff39220000`** decodes MethodDef103721 `ItemDatabase.GetAllByType`, generic Inst8761 with original NSO generic pointer chain TypeDef **9672 MealItemData**. Do not confuse the NSO method-spec bytes with an unverified metadata-header MethodSpec table.
- Shared native `CollectionGroup.<>c__DisplayClass46_0.<_GetItemsFromType>b__12(MealItemData)` at **`0x4C00590`**: full 240 bytes SHA256 **`e0b189c431058f8cc3f80385b8fba01f2234a462ab4dc1dbc424321c50e26628`**. The original AArch64 instructions explicitly read MealItemData.MealType from `+0x5C` (`0x4C005B0`), guard outer6 and inner2 (`0x4C005DC`, `0x4C0062C`), read nested selector meal type from `+0x18` (`0x4C00650`) and `CMP W20,W8` at `0x4C00654`, followed by CSET EQ. This **exact same lambda** covers all three definition IDs, varying only the raw source MealType value.
- Native `Enumerable.Where` `BL` site `0x4BFDD98` → `0x3756AE0`, shared `Enumerable.Select` `BL` `0x4BFD874` → `0x3752680`, latter projects ID. **Selector-stage static predicate**: `GetAllByType<MealItemData>(ItemType=3).Where(m => m.MealType == selector.Meal.MealType).Select(m => m.ID)`. **Common downstream IsValidItemForCollection is separate**, not implied by this Where.

Original metadata TypeDef **9672** `MealItemData` 88-byte record SHA `7cd51310d58084eff37fad168ab2aa22c3c5e8568f9b001c63c949e1176e84f0`, interface offsets start20634/count20 SHA `e724f74b9dcd2810ee744afd72e343ae297299e6f32579e1fc236ec16070bc16`. ICollectionItem TypeIndex64932 interface offset37 + interface slot1 ⇒ VTable slot **38**; encoded `0x6002D8D1` ⇒ MethodDef **93288** MealItemData.get_CanBeCollected. Variation TypeIndex65831 **absent**. MealType getter RVA `0x487A080` 8 bytes `005c40b9c0035fd6` confirms field backing +0x5C, protobuf **field15** (same-build dump.cs). IsMissionItem protobuf **field12** backed +0x58.

**Separate eligibility safety caveat:** the original 400-byte `get_CanBeCollected` at RVA `0x487E110` full SHA **`913fbf182330f29304f52dd8fe5a7278776cad6ab3afc1d64bf046c8bf94ff30`** contains **`LDRB W8,[X19,#0x58]`** at `0x487E164`, mission=true short-circuits to FALSE at `0x487E16C`; nonmission branch reads ItemID at `0x487E194` and performs additional `CMP W19,W8` at `0x487E1E4` with CSET NE. The **secondary Item-backed comparator value and runtime context remain UNKNOWN**. No `!IsMissionItem`-only simplification and **no nonmission positive getter assertion**. That restriction is part of the PASS, not a failure to protect the boundary.

## All 578 original typed Meal records and examples

All **578 original MealItemData** complete Base64 protobuf payloads individually SHA-verified and decoded for field15 `MealType`, field12 `IsMissionItem` presence/default. Results: Dessert162 (mission true1), Dinner230 (mission true1), Appetizer96 (mission true1), fourth value `2001500005` 90 (mission true89). Total **92 explicit mission=true**, remaining486 false/absent source rows. The fourth type is **not** a fourth selector.

- ID `30300001` ApplePie: original full 204 bytes SHA `4a085acfc408494687c69368c6ec6214660dd1454616d7f991fcfdd3fa6078c8`, MealType2001500000, Dessert Where TRUE and other two FALSE; getter remains **UNKNOWN**.
- ID `30300010` FishTaco: original 204 bytes SHA `7bccc353cbb9a08fd93d59b7d80158b7e2cd2db649864e8b9333dba79d0cff9b`, Dinner Where TRUE and other two FALSE; getter **UNKNOWN**.
- ID `30300009` PotatoLeekSoup: original 222 bytes SHA `4ae2c801e3163621d220ae80e8a5ebdcee006be5bb6006865604dc6b23e969c7`, Appetizer Where TRUE and other two FALSE; getter **UNKNOWN**.
- ID `30300119` Mission RockSoup: original 311 bytes SHA `4e3fcc75d4b973f1726ee3ddcd5c06fc75ef75ebee6503d74c28c3b6372feb04`, MealType2001500005 so **all three Where FALSE**; explicit mission Field12 `6001` guarantees isolated getter FALSE short-circuit.

The figures162/230/96/90 and 578 are **original typed Source row counts only**, not Runtime ItemDatabase enumeration, native final eligibility, CollectionSets, owned/collected/denominator.

## Evidence & verdict limits

Independent original-only local script `qr203_meal_original_independent.py` SHA **`e4fdf191e8dc15325aae7cf57e0b3997cf1a39dce8640d19443bd8da7b43128b`**, output JSON `qr203_meal_original_independent_result.json` SHA **`3aa76a1c67ebe60e9ec1344858a92cbcd6053a67cc6a6127840517b4ae734680`**. Both contain checks/claims limited to the new Meal delta. Private source game binaries/DB are not committed to GitHub. **GitHub CI only pins source projection and new cross-contract invariants, not original raw data retrieval or native replay.**

**PASS STATIC ONLY**: exactly **three** Meal Native selector-stage predicates, previous 97 → **100/256**, remaining **156 UNKNOWN** = ActivityItem4 (Fish/Ingredient/Mineral/CraftingMaterial each1), Crafting28, Clothing61, Furniture63. **PARTIAL / UNKNOWN**: positive full MealItemData.CanBeCollected and actual runtime ItemDatabase/CollectionSets. Historical d548 metadata origin and standalone whole CollectionSet.json remain provenance holds. Personal Collected/Owned/Missing **UNKNOWN**, denominator **null**; Moonstone/premium entitlement and local Writer/Apply/Community Publisher disabled; no Steam/schema626 promotion. R17 launch tree **30 nodes PASS0/PARTIAL12/BLOCKED18** remains unchanged. No merge/deploy.

**Next:** 01D isolate secondary Meal static ItemID comparison if claiming full native getter eligibility; separately analyze one of remaining four Activity native selector arms from exact same-build originals. 04 QR hold until new Owner evidence and CI. Do not redo QR198–202.
