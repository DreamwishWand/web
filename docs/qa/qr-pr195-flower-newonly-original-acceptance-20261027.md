# 04 QR / PR195 Flower Selector Original-Source Independent Acceptance — 2026-10-27

**VERDICT: PASS — one new ActivityItem.Flower STATIC ORIGINAL SOURCE / NATIVE PREDICATE. No runtime or personal Collection acceptance.** Existing 04 QR stream; not a new workstream. Original historical QR #198/#199/#200/#201 untouched. New only `CollectionDefinitionID=2120000083` / Flower case3, Nintendo Switch DDV **1.25.0 BID `52BD625D9B4E0053` schema624**. No Steam or Switch 1.25.3/schema626 transfer.

## Pinned owner/QA boundary
- Owner existing Draft PR #195 exact frozen HEAD **`0b8e7b13190a518c8e31f38f48d35f0bee3425dd`**, original CI [40423690303](https://github.com/DreamwishWand/web/actions/runs/40423690303) **COMPLETED SUCCESS** (**1023 PASS / 0 FAIL / 12 inherited SKIP**). Compared to QR #201's accepted Owner `6cd62a15d9be6c98762c009ff938ac9e9ae2a211`: **ahead 5 commits**, **exactly 3 paths** changed: new Flower evidence JSON + Owner's six targeted Flower tests + bounded existing technical doc appendix. Prior QR #201 Frozen HEAD `12131451cff9d48fd031fa638b05de5f3636a25d` is left untouched; Owner's earlier Activity/Character/Memory/Pet/Figurine cases not rerun.
- New independent 04 QR draft PR base frozen **`0b8e7b13190a518c8e31f38f48d35f0bee3425dd`**; only three QR-only files (this evidence matrix, new 3-test cross-contract delta, isolated CI). No Owner implementation/file edits.
- Original artifacts are **private local-only**, not committed or run in public CI. New QR independent source replay script: `qr202_flower_independent_original_replay.py` **SHA256 `e2f20487ddb67f808dfd6bd44bd9657d2e37f93bbdc3b2b9af63f75cfb0a9157`**, results JSON: `qr202_flower_independent_original_replay_result.json` **SHA256 `f8038ab4e8a9b4d6a216a0b9a5a49f9ae625721589fab0bb5c4ea1a01f1a6a93`**. The independently executed script parses original full source and NSO/metadata, not Owner's six tests or QR #201 tests.

## Source identity from **original raw bytes**
Rechecked byte length and SHA256 (not Owner report file hashes) from existing authenticated private original Drive fetched files:

| Original same-build source | Bytes | SHA256 |
|---|---:|---|
| ExeFS/main NSO | 96,002,294 | `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0` |
| RomFS global-metadata.dat v31 (magic `0xFAB11BAF`) | 36,538,728 | `07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c` |
| Original same-build dump.cs | 59,624,529 | `a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0` |
| DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz | 5,090,928 | `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048` |
| DDV_GAME_SUPPORT_TABLES_v1.25.0.json.gz | 168,583 | `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9` |

GZIP JSON sizes/digests independently reproduced: ItemDB **29,992,206** bytes / `81d3743fa9620b9e17fa702f7341426cc3d9600c100146b23902cc29c53bbae1`; support **748,439** bytes / `638904e8c3fb9ea62c382b7f00208c877a5a862436a2a55077f19c1fd6ebb2ac`. Source DB Switch Build identity matched. Historical `d5487...` MethodIdentity metadata provenance remains NEED_SOURCE, and is **not** equated to verified original `07e...`.

## Only newly closed CollectionDefinition native predicate
**Definition 2120000083 / ForagingFlower:** support-tables `tables.CollectionSet[].rawPayloadBase64` full **118-byte** protobuf payload independently Base64-decoded / SHA256 `7878e7a0ab0ea4d571bfe472c2405078cb1ac4c8cc546803054fc9d3bd3fbd73`, original ID field1 **2120000083**. Group field **9** → CollectionsByType field **2** → ActivityItem field **6** → Flower field **3**; Flower is **explicit empty message** `1a00` (not absent or ByGameplayTag). `CollectionsByType.Ignore` absent => protobuf default false; group has no `CollectionsByItem` entry. Original four-field group wire exactly `4a06120432021a00`. Independently cross-checked original compact source with no guessed oneof.

**NSO dispatch:** NSO0 LZ4 code extracted; AArch64 cmp immediate independently decoded at outer `0x4BFCACC`: `CMP W8,#6`, Flower inner `0x4BFDA08`: `CMP W8,#3`; `MOV W1,#3` at `0x4BFDA34` and `BL` at `0x4BFDA3C` independently decoded to native `0x37811C0` `ItemDatabase.GetAllByType<FlowerItemData>(ItemType3)`. NSO RODATA encoded generic usage `0xC003033F` RVA `0xB1EF4D0` decoded to **MethodSpec98719**; NSO 12-byte original record at `0x96E5E10` **`29950100ffffffff6f210000`** → MethodDef103721 (original metadata: `ItemDatabase.GetAllByType`, declaring TypeDef10610), generic inst8559. Independently followed original NSO generic pointer chain to **FlowerItemData TypeDef9472**. This is **NSO RODATA MethodSpec**, not raw metadata header offset and not historical d548 source.

**ID projection:** original `CollectionGroup.<>c.<_GetItemsFromType>b__46_9(FlowerItemData)` at `0x4BFF5E0`, full **160-byte** SHA `5433bbdfc30142a02d0719dcdf2b3773eceffb4ec3580aba91741b28463c2d48`, loads ID field `LDR W19,[X19,#0x18]` native opcode at `0x4BFF608` `0xB9401A73`. Shared `Enumerable.Select` call `0x4BFD874` original BL target `0x3752680`. No Flower-specific `Where` predicate found in this specific Flower selection arm. **Never fuse the below CanBeCollected and IsValid gates into this selection arm**: the native type enumeration may include mission-type Flower records; runtime enumeration and final group membership need actual ItemDatabase + IsValid.

**Concrete I/F and getter:** original metadata v31 FlowerItemData **TypeDef9472** entry SHA `f12b9942d7a12fc16f6d87e1a5620c19c73da1a2d49488e497c82d0e49a70737`, original interfaceOffset table start19955/count20 SHA `b9401b40f57a564bdce7b61db6d925d04d36dc9d5c983a5053327143034542dc`, includes ICollectionItem byval64932 at offset35 + interface method slot1 → VTable36, encoded `0x6002C115` → MethodDef90250 `get_CanBeCollected` declared by FlowerItemData. Variation interface TypeIndex65831 **absent**, cannot infer variation mapping. Same-build original 16-byte getter NSO RVA **`0x4786C20`**, exact native opcode hex **`087041391f010071e0179f1ac0035fd6`** SHA `a06501e8fd86c2861c80b160974f4c417ed4c67628322122d1fd21a10fd3f529` = load bool from `[x0,#0x5C]` / compare zero / CSET EQ / RET = `!IsMissionItem`; independently checked same-build original dump.cs `IsMissionItemFieldNumber=10`, `isMissionItem_; // 0x5C`, `IDFieldNumber=1`, `iD_; // 0x18`.

## Original typed Flower protobuf positive/negative
Independent local raw protobuf wire decode and per-record SHA validation for **all 117 FlowerItemData original ItemDB records**. Protobuf `IsMissionItem` **field10**:
- **94 absent**, effective bool **false by protobuf default** → isolated native getter true; not an explicit stored false.
- **23 present with wire varint1** (`5001`), effective true → isolated native getter false.
- Item **30800054** (Flower Purple) full original payload 273 bytes SHA `1e1a9b54404436094fef1154151a053b1835cc40651c8651338c82aa6b9e1773`, ID field1 and Mission field10 absent, getter true for this exact *typed source input*.
- Item **30800098** (Mission SculptureFlower01) full original 390 bytes SHA `09b88b993008f7496c9d7cdb32273a9e34c331438061b742f4e0ec7b77586cd6`, Mission field10 `5001`, getter false.
- Item **30800099** (Mission SculptureFlower02) original 388 bytes SHA `12e046016b52ff3d2b634cc5ebcf6524708d60d50ee75c1d622ba94089d50698`, field10 `5001`, getter false.
No 117, 94 or 23 is **runtime Collection denominator**. The Source flower set, runtime ItemDatabase type enumeration, CanBeCollected virtual gate, common IsValidItemForCollection, CollectionSets materialization, personal Owned/Collected are different stages. Do not infer actual runtime membership or per-user percent from static counts.

## Remaining UNKNOWN and release safety
Exactly **ONE** new Owner static selector predicate closure: **96 + 1 = 97 / 256**; remaining **159** = ActivityItem **7**, Crafting **28**, Clothing **61**, Furniture **63**. **Mineral** definition 2120000084 case7 is **NOT closed**: its native generic uses subtype16 and a distinct branch. Other six Activity selectors (Fish1, Meal3, Ingredient1, CraftingMaterial1) still UNKNOWN. The independently verified original raw source proves Flower case3 only.

**PASS bounded STATIC**, not a source for collected/available/owned or actual per-user Collection membership. Actual owner-consented unmodified Switch1.25.0 schema624 Save + native runtime ItemDatabase/CollectionSets remain missing. NativeEligibility runtime UNKNOWN; denominator **NULL**, Owned/Collected/Missing **UNKNOWN**. No personal percentage, Native Save Writer, Preset Apply, Community Publisher, entitlement inference, cross-platform transfer. R17 Product Tree **30 nodes PASS0/PARTIAL12/BLOCKED18 unchanged**. All PRs remain **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY**. Existing QR198–201, CharacterUniverse, MemoryShard, Pet/Figurine, WEB192, INT194, Source134–142, Operator A/B/C untouched.

**QR code trust statement:** dedicated GitHub CI includes only new three cross-contract guard cases against pinned source JSON plus existing manifest, no downloaded private game files. Full original source byte replay is an independent **local** artifact, not GitHub CI.
