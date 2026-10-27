# 04 QR — PR195 Final 153 Native Selector Original-Source Independent QA (frozen Owner 64913f8, 2026-10-27)

**Classification: three independent STATIC PASS families + ONE reproducible Crafting RED.** This is existing 04 QR, not a new stream. **All Draft / DO_NOT_MERGE / DO_NOT_DEPLOY.** No runtime data, write enablement, cross-build semantics, or release authorization.

## Exact frozen scope

Owner PR #195 exact SHA `64913f8d63f90dc9ada1200a1249aff373217420`, Owner CI #40458207678 COMPLETED SUCCESS. Freeze GitHub base independently at exact SHA; later 01D work is not reviewed. Previously independently accepted through QR #207 SHA `6c673abea159bbf01a0c4be0a975e7798807246b` = **103/256**. QR #198–207 and historical #205 PARTIAL remain unmodified. Platform Switch v1.25.0, BID `52BD625D9B4E0053`, schema624 only.

### Private original SHA256 independently computed (not from Owner script)

| Source | Raw bytes | SHA256 |
|---|---:|---|
| NSO main | 96,002,294 | `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0` |
| Original IL2CPP metadata v31 | 36,538,728 | `07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c` |
| Same-build dump.cs | 59,624,529 | `a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0` |
| Lossless Item DB | 5,090,928 | `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048` |
| Support Tables | 168,583 | `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9` |

All five re-fetched from exact authenticated Drive IDs and byte-hashed in QR. Support raw uses gzip magic despite Drive MIME. Private binaries **never enter GitHub**. Local original-only QA Python script SHA256 `1e8cb8fbac5fafe0fe758afd152d7f963214ff2e39c5193bc730d11bc6c3b97d`; machine result SHA256 `ae8b49b2aba4a277c982daa5e92faa751c46bc6ab480fb8104761b2ad79c9d24`. Owner replay script deliberately **not used** as independent evidence. Public workflow uses non-proprietary signed-off attestation contracts and owner evidence parity, NOT replay of originals.

## Batch A — Fish 1/1 PASS STATIC

Full original raw CollectionDefinition2120000020 **140 bytes**, SHA `c3f2d3c00714f9b4d29d8eec4affc88c10818b8c5a18722ca1df55f14dbd430d`. Original protobuf Group.ByType.ActivityItem.Fish case4 explicit empty, `UseLocation` Field1 absent / default false; `Location` Field2 absent; `ByType.Ignore` false, separate ByItem.Ignore excludes ID31000006 (not applied inside selector stage). Original NSO nonlocation arm RVA `0x4BFDC38` **220B** SHA `6bbbedf65e22ef92cee12cf54b2a38a77039c58c19c76deb662ee55da25a660e`; original MethodSpec98717 GenericInst8542 resolves to FishItemData TypeDef9613 (not FishingDataItemData), typed call target `0x37811C0`, ID projector `0x4BFF540` **160B** SHA `2aa718b4011d73d58db3dbdf0f4bd36e8f68265bb402f8f40b396d4f5b1f7901`, Select `0x3752680`, ToList `0x37566C0`. Original 96 FishItemData raw row digests replayed; native getter `!IsMissionItem` (Field12) is a separate stage. FishingDataItemData location side is NOT selected; no runtime membership inference. **+1 accepted.**

## Batch B — Crafting.RecipeType 28/28 original protobuf PASS; Native provenance RED 28/28 pending Owner fix

Original full raw protobuf for all **28 occurrences** independently replayed (note 28 Selector occurrences may share Definition IDs, e.g. `2120000121` has RecipeTypes 2001100002 and 2001100006). Crafting outer protobuf field8; RecipeType inner field2, per-selector Ignore preserved and not collapsed into filter. Original **1,206 CraftingRecipeItemData** raw row SHA256 and protobuf Field8 `RecipeType`, Field6 `Result` / nested Field1 `Result.ItemID` independently replayed; **0 missing Result** among these source records, but missing Result at runtime is NOT thereby impossible. Recipe Item ID and returned Result ItemID are distinct. Original predicate lambda `0x4C009E0` first36B SHA `d211d013e5a5afa619ff492d1e52f92293a30d5ae3acfd1424d8101c9c191ed6`; result projector `0x4BFF330` first36B SHA `b0c036d6800e0f1d66a82fcb12b29559287c1ca2259c68f19ef57305213ecdbb`; Result-specific downstream CanBeCollected is NOT a recipe-class eligibility gate.

**Reproducible RED, immediately actionable for 01D:**
- Frozen Owner `native-crafting-recipe-type-28-original-v125.json` claims `GetAllByType<CraftingRecipeItemData>` is **MethodSpec98710 / GenericInst8335** and the call at RVA `0x4BFC974`.
- Independently decoded original MethodSpec **98710** bytes `29950100ffffffff8f200000` → MethodDef103721 `GetAllByType`, GenericInst8335, GenericArg TypeDef **9630 `CritterItemData`**, **not** 9715.
- Original MethodSpec **98709** bytes `29950100ffffffff86200000` → MethodDef103721, GenericInst8326, GenericArg TypeDef **9715 `CraftingRecipeItemData`**.
- Original NSO instruction ADRP RVA `0x4BFC968` plus LDR RVA `0x4BFC970` resolves exact usage RVA `0xB1EF488` token `0xC003032D` → MethodSpec98710. BL RVA `0x4BFC974` targets `0x37811C0`. That specific claimed call genuinely resolves **CritterItemData**. Merely relabeling MethodSpec98710 to CraftingRecipe is invalid.
- **Required minimal Owner fix:** identify the actual Crafting.RecipeType Native GetAllByType call/branch and metadata usage token; correct MethodSpec/GenericInst/Concrete mapping and test it from original independent source. Recheck recipe Result null runtime semantics and recipe-specific additional conditions. Leave unrelated Fish/Universe proofs intact. QR independently re-tests only amended Owner delta on new pinned SHA.
- Until fixed, each of **28** Crafting selectors remains **RED / not independently accepted**, even though their original protobufs and raw Recipe data are independently verified.

## Batch C — Clothing.Universe 61/61 PASS STATIC

Original NSO Clothing case4/Universe case2 dispatch SHA `7551d994d4c45abf9e8e326039fb7f95c4d9d531fdc9a1d0ad7312011cf04879`, loop SHA `12f103e308a4ad510a07b6b2c5915614f7290d9a4a6fe3507d6faf47a9afe421`, bounded predicate SHA `01caaa3222c63ba1133d30dab067cc9f2603e3c526a90276567663688d8a2f4a`. MethodSpec98706→GenericInst8166→TypeDef9204 ClothingItemData, ItemType5; original calls Set lookup `0x3782230`, RepeatedField.Contains `0x39349D0`, append `0x2306960`. Original clothing Field8 `SetItemID`, Set Field6 `Tags`; common Set MethodSpec98899→TypeDef9664. Iterate typed item→ lookup set→ null skip→ `Set.Tags.Contains(selector.Universe)`→ append **ClothingItemData.ID**, no subtype reinterpretation. Original CollectionDefinition full raw protobuf for **61** unique selector occurrences and original typed 1900 Clothing records + 711 Set records independently per-row SHA replayed. All1900 typed source Clothing rows reference original Sets; source zero-candidate DefinitionIDs **2120000162, 2120000367** are NOT runtime zero claims. No Universe additional per-selector predicate found. Original source positive/negative by Set tag reproduced. **+61 static accepted.**

## Batch D — Furniture.Universe 63/63 PASS STATIC

Distinct original NSO Furniture case3/Universe case2 dispatch SHA `1b0b1c6fe76a297647196461e9be5b309efb5a60b5ec9d5b08fadb89f62855a8`, loop SHA `019e0062485b40f6e595a0cfec2c9afb30f435a091ffaa7111ead64af9886f05`, bounded predicate SHA `5ce574f9820589dd9e41688a2d8df7e644ab058a1d3b5158cc37a0e971a6cfaa`. MethodSpec98722→GenericInst8574→TypeDef9078 FurnitureItemData, ItemType4, Field8 SetItemID; SetItemData TypeDef9664 Field6 Tags lookup MethodSpec98899; independently verified BL setLookup / Contains / append targets. Null Set skip and tag mismatch are separate negative conditions. 63 full raw definition selector occurrences; 4,949 raw Furniture records + 711 raw Sets per-row SHA replay. **945 Furniture source rows have no SetItemID; 4004 reference source Sets**, all references resolve. Source zero-candidate DefinitionIDs **2120000248, 2120000254, 2120000368** do NOT imply runtime zero. Hidden/Name concrete `CanBeCollected`, common IsValid, Ignore/ByItem and Variation are **downstream separate**. **+63 static accepted.**

## Independent scope ledger

| Family | Assigned | PASS STATIC | RED | PARTIAL | NEED_SOURCE |
|---|---:|---:|---:|---:|---:|
| Fish | 1 | **1** | 0 | 0 | 0 |
| Crafting RecipeType | 28 | 0 | **28 (shared MethodSpec proof fault)** | 0 | 0 |
| Clothing Universe | 61 | **61** | 0 | 0 | 0 |
| Furniture Universe | 63 | **63** | 0 | 0 | 0 |
| **Total newly reviewed** | **153** | **125** | **28** | **0** | **0** |

**Independent QR STATIC 103 + 125 = 228/256; 28 remain unaccepted (Crafting).** Owner 256/256 is NOT QR 256/256. Original 293 CollectionDefinition raw records, 711 Set records, all relevant typed source rows independently rehashed and parsed; source enumeration counts never promoted to real runtime/Collection denominator. Runtime ItemDatabase, CollectionSets/Group membership, consented personal Switch Save, Owned/Collected/Missing, denominator/percentage all UNKNOWN/null/OFF. Native Writer, Preset Apply, Community Publisher, entitlement edits OFF. Steam and Switch1253 schema626 semantically NOT transferred. R17 Product Tree 30 PASS0/PARTIAL12/BLOCKED18 and blocked human operational/privacy/seeding gates unchanged. **Release NO-GO.** All PR Draft / DO_NOT_MERGE / DO_NOT_DEPLOY.

## Next owner/QR boundary

Owner fixes only Crafting RecipeType shared Native MethodSpec/call-site provenance and proves actual source path, then obtains new exact Owner HEAD/CI. QR reviews amended Crafting delta alone independently; no replay/rewrite of prior QR198–207 or these Fish/Universe accepted results. 00 CTRL receives only current 228/256 independent + Crafting28 reproducible RED; never authorize runtime/writing/publishing.
