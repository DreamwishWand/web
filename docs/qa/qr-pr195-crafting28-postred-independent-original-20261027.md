# DDVRE 04 QR — Crafting RecipeType28 Post-RED Original-Source Independent Acceptance
Date: 2026-10-27 JST. Existing 04 QR QA & Release stream; newly scoped Crafting28 review only.

**Verdict: PASS STATIC 28/28; independent Collection selector STATIC 256/256.** NOT runtime Collection membership, NOT personal counters, NOT writer/apply/publisher approval, NOT public release. All PRs Draft / DO_NOT_MERGE / DO_NOT_DEPLOY.

## Frozen target and what was *not* redone
- Owner Draft PR #195 NEW EXACT HEAD `da9528ce3565f68c5c201593fe06c84dfe8fbd3e` and Owner CI #40463462885 COMPLETED SUCCESS.
- Pre-fix Owner `64913f8d63f90dc9ada1200a1249aff373217420` → fixed Owner compare: 5 commits, **4 Crafting-only files**: `docs/core/collection-save-backed-readonly-v125-20261026.md`, `scripts/ddv/replay-native-crafting-recipe-28-original-v125.py`, `static/ddv/core/collection/v1.25/native-crafting-recipe-type-28-original-v125.json`, `tests/ddv-core-collection-crafting-28-original-v125.test.mjs`. No historical QA file modified.
- Historical 04 QR PR208 exact HEAD `b3f33956eeabba1f42c2287f57f75b68391ddd67`, original Crafting28 **RED**, independent static228/256 is **preserved** as a historical snapshot. Prior 228 independent accepted selectors (Fish, Clothing, Furniture and QR198–207) were **not reimplemented or rerun**.
- Platform **Nintendo Switch DDV v1.25.0**, Build ID `52BD625D9B4E0053`, save schema **624**. Switch v1.25.3 schema626 and Steam semantic equivalence **NOT ACCEPTED**.

## Truly independent private-original replay
Private original SHA256 independently calculated against existing native mounted files in QR, *without executing Owner's repair replay script*. Their original bytes are not committed or referenced as public GitHub source files.
| File | Original bytes | independent sha256 |
|---|---:|---|
| NSO main | 96,002,294 | `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0` |
| global-metadata.dat v31 | 36,538,728 | `07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c` |
| dump.cs | 59,624,529 | `a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0` |
| Lossless Item DB gzip | 5,090,928 | `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048` |
| Support Tables gzip | 168,583 | `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9` |

Independent original-source local Python script hash SHA256 `684e4d319ab9458c5f42f1a0bce9a4e46b8e71c2f09c32445b4f285f89ee3a91`; resulting complete machine JSON SHA256 `818ae55b618e88021355992748d897a55929d6d94a48332469e88a71ec71ef89`. This public PR contains source-derived manifest, no private source bytes. **GitHub CI tests attestation / contracts only, not original private byte replay; that rerun was done locally in independent QR.**

## Native proof: original actual path, *not* pre-fix Critter
- Original NSO `CollectionGroup._GetItemsFromType`: outer Crafting oneof **case8** (CMP W8,#8 opcode `0x7100211f` RVA `0x4BFD140`); RecipeType inner **case2** (CMP W8,#2 opcode `0x7100091f` RVA `0x4BFD3D0`).
- Actual GetAllByType NSO instruction chain **ADRP `0x4BFD0E0` + LDR `0x4BFD0E8` → usage RVA `0xB1EF628` → encoded token `0xC0030395`; MOV W1,205 `0x4BFD0E4` and MOV W8,3 `0x4BFD0EC` (subtype stack), BL `0x4BFD0F8` → `0x37816F0`**. Original opcode SHA of 60-byte direct call context `ceec4dd83d4056294fa57424ffaf8c4deaa91ef06d3ecb3e23c348e45ae34cbe`. Outer oneof 56B SHA `3c989a5576c249ddfda216ea4fc97d31e4c8937926a9d2820e59223fd92a786b`; RecipeType case2 140B SHA `0bebc977cf0761b5ab7c09531f5460d200d69c142a0075f02051bceb7edb8887`.
- Original metadata MethodSpec**98762** 12-byte `2a950100ffffffff3c870000` at RVA `0x96E6014` = MethodDef**103722** `GetAllByType`, GenericInst**34620** (record RVA `0xAC1F7A0`) **two** args: TypeDef**9715** `CraftingRecipeItemData`, TypeDef**10402** `ActivityDataItemType`. This exact MethodSpec is bound to original Native BL above.
- Original separate **NEGATIVE**: OLD Critter call `0x4BFC974`, usage RVA `0xB1EF488` token `0xC003032D` → MethodSpec**98710**, GenericInst**8335**, **CritterItemData TypeDef9630**. Original separate one-arg Recipe MethodSpec**98709** GenericInst**8326** yields `CraftingRecipeItemData` TypeDef9715 but is **not** the Collection case2 caller. Any swapped token, wrong generic arg count, or old class mapping must FAIL CLOSED.
- Original RecipeType lambda `0x4C009E0`: LDR W8 [X1,#0x50], LDR W9 [X0,#0x10], CMP W8,W9, CSET W0,EQ, RET. 36-byte SHA `d211d013e5a5afa619ff492d1e52f92293a30d5ae3acfd1424d8101c9c191ed6`; native Where BL `0x4BFD438` → `0x3756AE0`.
- Original projector `0x4BFF330` loads Result pointer [X1,#0x40], then ItemID [Result,#0x18], returns Result.ItemID **NOT recipe.ItemID**; 36-byte SHA `b0c036d6800e0f1d66a82fcb12b29559287c1ca2259c68f19ef57305213ecdbb`; original null recipe/Result branches to exceptional helper via BL `0x4BFF350`→`0xAFB960`, **NOT a valid zero ItemID**. Native shared Select `0x4BFD874` and ToList `0x4BFD880`, separate downstream IsValid and concrete returned-item CanBeCollected.
- Thus selector-stage original predicate: `GetAllByType<CraftingRecipeItemData,ActivityDataItemType>(ItemType=205,subtype=3).Where(recipe => recipe.RecipeType == selector.RecipeType).Select(recipe => recipe.Result.ItemID).ToList()`.

## All 28 original protobuf selector occurrences, not a 28-record shortcut
- Independently read and rehash all **293** original full CollectionDefinition protobuf `Support Tables.tables.CollectionSet[].rawPayloadBase64`, decoded **Groups field9 → ByType field2 → Crafting outer field8 → RecipeType inner field2**, preserving **ByType.Ignore field1** separate.
- **28 selector occurrences**, **25 distinct Definition IDs**, **8 distinct selector RecipeType values**. **19 ByType.Ignore=true**; 9 false. Multiple case2 selectors in the *same* full raw Definition are separately accepted: ID `2120000121` has RecipeType `2001100002` + `2001100006`, ID `2120000205` has `2001100007` + `2001100006` + `2001100008`.
- Full independent per-selector tuple `(definitionId,recipeType,Ignore,raw Definition SHA256,PASS_STATIC)` is stored in `static/ddv/qa/qr-pr195-crafting28-postred-independent-v125.json` and new-only contract tests; **28/28 individually PASS STATIC**.
- All **1,206** original `CraftingRecipeItemData` source rows individually sha-rehashed, each ItemType205/subtype3, protobuf RecipeType field8 and Result field6 → Result.ItemID field1 independently re-decoded and checked against source parameters. All source Result fields present; 1,206 recipe ItemIDs distinct from result ItemIDs; absence at runtime **UNKNOWN**, null is original Native exceptional path not a successful ItemID0. Some recipe types in source are not among these eight selectors; source is not actual runtime DB.
- Final Ignore/ByItem/Variation, common `IsValidItemForCollection`, and the Result concrete type `CanBeCollected` are explicitly separate from Crafting selector predicate, as are runtime membership and entitlement.

## Classification and release safety
| Category | New pass | Remaining |
|---|---:|---:|
| Crafting.RecipeType independent original STATIC | **28/28** | 0 |
| Other previously independent STATIC | **228/228** (preserved, not rerun) | 0 |
| TOTAL original Collection selector STATIC | **256/256** | **0 static selectors** |

**This is STATIC only.** Runtime ItemDatabase, actual CollectionSets/Group membership, unmodified owner-consented genuine Switch1250 save and personal Owned/Collected/Missing all UNKNOWN. Collection denominator NULL; personal collection rate OFF. Native Writer, Preset Apply, Community Publisher, entitlement editing OFF; no Switch1253 schema626 or Steam semantic promotion. Product Tree R17 30 PASS0/PARTIAL12/BLOCKED18, seven human seed/privacy/legal/ops gates and Operator A/B/C statuses unchanged. **Public release NO-GO**. Draft / DO_NOT_MERGE / DO_NOT_DEPLOY.

## 00 CTRL handoff and next dependency
Owner Native selector STATIC 256 independently accepted 256 via new QA PR; old QR208 Crafting RED remains historical. Next work is independent strictly READ-ONLY real Switch1250 runtime CollectionSets/ItemDatabase/IsValid membership acceptance and a genuine user-authorized device save (baseline→one change→save→re-import) if owner provides it; **never invent or proxy** runtime input. Keep Writer/Apply/Publisher OFF. Do not repeat static Native work or remove unrelated release blockers.
