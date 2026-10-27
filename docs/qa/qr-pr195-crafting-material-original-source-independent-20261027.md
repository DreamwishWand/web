# 04 QR — PR195 CraftingMaterial Original-Source Independent Acceptance — 2026-10-27

**Verdict: PASS STATIC BOUNDED for one new CraftingMaterial selector only. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.**

Existing 04 QR workstream, *not* a new workstream. Frozen reviewed 01D Owner Draft PR #195 HEAD **`6c531a6f09c94eae79f4e5b960d0feb28ce57863`**; Owner CI **#40441557858 COMPLETED SUCCESS** (1047 PASS, 0 FAIL, 12 inherited SKIP). Frozen prior Mineral Owner HEAD `5ed6b31dc1ce44943baee67362e65575effaf6ab`→this target was exactly **3 Owner file changes**, CraftingMaterial evidence JSON, CraftingMaterial tests and core document appendix. **Do not implicitly accept Owner's later commits.**

Historical QR #205 `e9672f1005db4a5df52af7bfba8ddabd8ac23a2d` PARTIAL/NEED_SOURCE is immutable. Later distinct QA Draft PR #206 `498047c8688453aa0be9b5944af6b3a8f7cb70b7` accepted Mineral original STATIC PASS and established independent **102/256**. This *new-only QA* accepts CraftingMaterial as the **103rd** independent static selector, not another Mineral replay.

## 1. Explicit same-build original inputs, SHA256 in local QR

Read Drive metadata by original Drive IDs. Streamed all five through authenticated raw fetch with `download_raw_file=true` and `include_base64=false`, then *independently computed* local hashes with SHA256, not from Owner or 00 CTRL. All matched:

| Source | Drive ID | Bytes | QA SHA256 |
|---|---|---:|---|
| NSO main | `1oZ4V2BdNSH62n7KFruNbgvGsw5eRs1Z8` | 96,002,294 | `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0` |
| original metadata | `1-Ptq2xCjQh1Fc_tHn1DeekiqiVTFc0v1` | 36,538,728 | `07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c` |
| dump.cs | `13nyviL_uZ9w-Op_9VhJsdpe0Ho4l2cdj` | 59,624,529 | `a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0` |
| lossless ItemDB gzip | `1_iMow5gXJTmgbogw1y7S8vTQp-Bj2vI8` | 5,090,928 | `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048` |
| SupportTables gzip | `1Ee5tySw_XinkIXvLTSkDfFUMlTjJPtJJ` | 168,583 | `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9` |

Support Tables provider MIME `application/json` and local extension are misleading: actual original bytes start **gzip magic `1f8b`**. NSO `NSO0` Build ID `52BD625D9B4E0053`, metadata v31 `af1bb1fa` magic independently checked. Platform **Nintendo Switch**, DDV version **1.25.0**, **schema624 only**; NO Switch v1.25.3/schema626 or Steam transfer.

Locally executed original-source proof script `qr207_craftingmaterial_original_independent.py` SHA256 **`51f8907ae78b869833d80aa09764da567a5d5d489c241fbc5684d2b3468fb0c5`**, independently produced machine result `qr207_craftingmaterial_original_independent_result.json` SHA256 **`19464b96529af45ff3035d4caa6ece3df89305135776738c30125177e5353ccd`**. Original proprietary five files stay PRIVATE, not committed, and CI only runs portable digest/semantic attestation contracts. A successful CI is NOT a replay of original game files.

## 2. Independent original NSO / IL2CPP / metadata

- From independently LZ4-unpacked original NSO, bounded CraftingMaterial branch RVA `0x4BFCAF0` **256 bytes**, SHA256 `9b4fa9773591d2fea136fad19a2e8a6d8e0520fb9331658152e92a405364c6b3`. Original instructions at `0x4BFCB28` MOV W8,#17; `0x4BFCB2C` MOV W1,#3; `0x4BFCB30` subtype stack store. BL `0x4BFCB34` → `0x37816F0`. Outer ActivityItem case6, inner CraftingMaterial case6. **ItemType3/subtype17**, not Mineral subtype16.
- NSO metadata usage `0xC003038B` at `0xB1EF600`, original MethodSpec98757 bytes `2a950100ffffffff37870000` at `0x96E5FD8`, MethodDef103722 named `GetAllByType`; method instantiation34615 → GenericInst RVA `0xAC1F750`, argumentCount **2**, type pointers `0xB2CCFB8` and `0xB2CCFD8` resolving TypeDefs **9044 `ActivityItemData`** and **10400 `ActivityItemType`**. Flower one-arg and Mineral TypeDef9063 excluded.
- Original `CollectionGroup.<>c.<_GetItemsFromType>b__46_31(ActivityItemData)` projector RVA `0x4BFF290` **160B** SHA `13dc42cb2d2242ee3031b247f8b210cf46e9f045fc2a7d6db00351cfb14eed7b`. Original ID read offset `+0x18`, generic LINQ Select call → `0x3752680`, ToList call → `0x37566C0`; NO CraftingMaterial-specific Where in this selector arm. The shared downstream `IsValidItemForCollection` and final Collection composition are **separate**, not silently applied to this stage.
- Original metadata TypeDef9044 actual **88 bytes** SHA `34d34ee450e18d546a9f1d2a12935da7ec4ae71d6f573b3ee1e1bfe84585797b`. Original 16 interface offsets from index18220 SHA `9d4ba5bb84fe4fc8d74b75f382d63c3872a914583cd834d6f083af9aa6e0c1e4`. TypeIndex64932 `ICollectionItem` interface offset31 + getter method slot1 = concrete **VTable32** encoded method `0x60028809`→MethodDef82948 `get_CanBeCollected`; variation interface65831 is NOT implemented by this concrete class.
- Original Native getter RVA `0x44EFE70` **16B**, SHA `e37d5869e849938f2d6eecdde5f518bb0cdecd450eb9d97a7a9d1f4d6d7d1957`, bytes `084041391f010071e0179f1ac0035fd6` decode `LDRB [X0,#0x50]; CMP #0; CSET EQ; RET` → **`!IsMissionItem`**. Same-build dump confirms backing offset+0x50 and protobuf **Field8** (not Mineral Field11).

## 3. Original FULL protobuf from Support Tables and lossless source items

Original Support Table `CollectionSet` row ID `2120000096` `ForagingCrafting` rawPayloadBase64 independently decoded **313 bytes** exactly, SHA256 **`0d29ce51cd9970208831abd746e9371187bf78875d1dbdcd54c96b95b380443c`**. Original recursive wire structure finds Group9→ByType2→ActivityItem6→CraftingMaterial6 **explicit empty message**, ByType.Ignore absent/default false. There are **separate** Group ByItem includes `31700015`/`31700021`, ByItem.Ignore=true list (40 IDs) including `31700039` PlasticScrap; another distinct ByType.Ignore=true entry is `Crafting` (outer protobuf field8), RecipeType **2001100001**. These entries may not be conflated into a CraftingMaterial-type filter.

Original lossless Item DB contains **166** `ActivityItemData` raw records, every protobuf rawPayload individually base64-decoded and SHA256 matched to its own source stored digest. Subtype is separately preserved by original source `itemType/subtype` columns; **not embedded in ActivityItemData protobuf**.

| Source subtype | Total original raw records | proto Field8 absent/default false | proto Field8 explicit true | proto Field8 explicit false |
|---|---:|---:|---:|---:|
| 17, CraftingMaterial | **132** | **128** | **4** | **0** |
| 0, other ActivityItemData | **34** | **32** | **2** | **0** |

Representative original SHA checks independently match all five known examples: Brick `31700000`: subtype17, no mission flag, *typed stage positive and static getter true*; Soil `31700015`: subtype17 getter true, separate ByItem Include; Mission MixOfOil `31700023`: subtype17 but Field8 wire `4001` true and getter **false**; PurifiedNightShard `30000031`: subtype0, getter true but **typed-stage negative**; PlasticScrap `31700039`: subtype17 getter true but **separate ByItem.Ignore**, final membership **UNKNOWN**. Full five raw hashes are retained in machine evidence.

**Crucial caveat:** The GetAllByType→Select→ToList **selector stage** itself does not necessarily apply the concrete `CanBeCollected` getter or the separate Ignore flags there; the getter-negative is a **static predicate fact**, not proof of omission from the selector's raw enumeration. Counts **128/4** are source records classified by getter, NOT runtime enumeration output, final grouped membership, or personal numerator/denominator. Mission-true rows may not even appear in a particular runtime ItemDatabase.

## 4. Independent conclusion and safety

**PASS STATIC BOUNDED**: new single CraftingMaterial native source predicate correctly re-derived from original sources and agrees with fixed Owner assertion; no evidence of a RED discrepancy. **Independent QA static selector count 102→103/256**, unresolved **153**: Fish1, Crafting28, Clothing61, Furniture63. The former 102 Mineral accepted predicates are not re-reviewed. New dedicated QR evidence tests are source-attestation-only (not proprietary replay in public CI).

Runtime ItemDatabase, native CollectionSets, final effective Collection Group membership, owner-consented actual personal Save, Owned/Collected/Missing and denominator stay **UNKNOWN/null**. UI Collection percentage, Native save writers, Preset Apply, Community Publisher, entitlement editors all OFF. Steam and schema626 not promoted. R17 Product Tree **30: PASS0/PARTIAL12/BLOCKED18**, seeding/privacy/legal/ops gates unchanged; Release **NO-GO**.

**Next:** QR reviews only an independently fixed future Owner HEAD/delta; 01D continues Fish/Crafting/Clothing/Furniture work in parallel. Maintain QR #205 historic PARTIAL and PR #206 STATIC PASS, no blanket acceptance of later Owner batches. All Draft DO_NOT_MERGE / DO_NOT_DEPLOY.
