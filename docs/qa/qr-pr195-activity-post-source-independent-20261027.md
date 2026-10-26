# 04 QR / 01D PR195 Activity.ByGameplayTag Post-Source-Fix Independent Acceptance — 2026-10-27

**Verdict: PASS — ORIGINAL RAW SOURCE + STATIC NATIVE PREDICATE, bounded to 4 `ActivityItem.ByGameplayTag` selector occurrences and exact Crop/Ingredient concrete input; not CollectionSets/runtime/personal membership acceptance.** Original 04 QR PR200 HEAD `6ba429294d6ef43a49a7273b996f5d2742248faa` remains a historical **PARTIAL**, never amended. Old QR198/199, Pet/Figurine, 74 older families, WEB192, INT194, Community Source134–142 are not rerun.

## Start gate, exact refs and delta

- Owner existing Draft PR #195 exact frozen HEAD **`6cd62a15d9be6c98762c009ff938ac9e9ae2a211`**, GitHub Action CI **40420251523 COMPLETED SUCCESS (1017 PASS, 0 FAIL, 12 inherited SKIP)**. Scope: Nintendo Switch Disney Dreamlight Valley **v1.25.0**, BID **`52BD625D9B4E0053`**, schema **624**; nothing is exported to 1.25.3/schema626 or Steam.
- Compared against QR200's Owner frozen base `fc873b5500b62fe491222bc62c7bf2dc90f69fd4`; exactly three new/modified Owner paths: `static/ddv/core/collection/v1.25/native-activity-raw-wire-hastag-fallback-v125.json`, `tests/ddv-core-collection-activity-raw-wire-hastag-fallback-v125.test.mjs` (6 Owner tests, not rerun/reimplemented), `docs/core/collection-save-backed-readonly-v125-20261026.md`. New audit is independently based at frozen **Owner `6cd62a15...`**, not a moving branch or old QR200 base.
- QR output: this matrix + new-only cross-contract negative/Ignore/coverage tests and a dedicated workflow. Only QR files changed; no Owner product code, data, source tables, runtime or CI rewrites.

## Independent original-source repro — local only, no original game data in PR

04 QR **independently fetched the exact two private Google Drive files** and verified byte-count, compressed SHA256, decompressed byte-count and SHA256. A NEW independent raw-protobuf decoder (not Owner's 6 tests) decoded original retained bytes from the pinned, original-sourced archives:

| Input | Compressed bytes / SHA256 | Decompressed JSON bytes / SHA256 |
|---|---|---|
| DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz (Drive `1_iMow5gXJTmgbogw1y7S8vTQp-Bj2vI8`) | **5,090,928** / `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048` | **29,992,206** / `81d3743fa9620b9e17fa702f7341426cc3d9600c100146b23902cc29c53bbae1` |
| DDV_GAME_SUPPORT_TABLES_v1.25.0.json.gz (Drive `1Ee5tySw_XinkIXvLTSkDfFUMlTjJPtJJ`, despite `.json` MIME) | **168,583** / `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9` | **748,439** / `638904e8c3fb9ea62c382b7f00208c877a5a862436a2a55077f19c1fd6ebb2ac` |

Original complete `CollectionSet.json` 45,171-byte SHA `e4887dc5729b8660caadc0d8f875a199a331973ccfeb97c740542a27ac44cc87` is **MANIFEST ONLY**, not within Support Tables as whole original bytes and **NOT independently rehashed**. However **293 individual original CollectionSet protobuf row byte payloads** are preserved with distinct SHA and individually testable. QR has independently rehashed and parsed each of the **four target full row payloads**, not merely Owner's short hex excerpts. Original complete file is a separate, nonblocking whole-file provenance NEED_SOURCE.

### Four full original definition raw payloads (distinct `CollectionsByItem` and `CollectionsByType` Ignore)

| CollectionDefinition ID | Full row bytes | Full row SHA256 | `ByGameplayTag` (field 9→2→6→8) | ByType Ignore | Separate ByItem Ignore |
|---|---:|---|---:|---|---|
| 2120000015 | 141 | `e4cdbf3168bdc2e2e5d1e2b1748573385923d49040670f9ac0e640b1a1d7180d` | 2001200013 | absent → false | **true** |
| 2120000016 | 150 | `6957d61b64499e2efdaee8c341a82a1cc9bf51ea33017ce20528eb610c4f5410` | 2001200014 | absent → false | **true** |
| 2120000017 | 145 | `9d375bc303bc73af2635cb4d5c56c94038bd158764682e9024d3a1f8633eef90` | 2001200011 | absent → false | absent → false |
| 2120000018 | 118 | `865c88363e4d63fb89854b46714235ef56c7e0c5614af3792f2156d66f887fb6` | 2001200012 | absent → false | no ByItem row |

**Critical:** Neither a ByType `Ignore` absent field nor a ByItem `Ignore` condition is global Group membership or the same as the other Ignore. In particular first two ByItem.Ignore=true survive independently; do not collapse them in consumer or count 115 source tag candidates as final Collection denominator.

### Four full original ItemData raw protobuf payloads

| ItemID | Concrete type | Full bytes | Full SHA256 | Packed Tags field / values | Mission field |
|---|---|---:|---|---|---|
| 30200001 Blueberry | CropItemData | 243 | `9f9b24ad7ec2fc56149887d1b0824de24128cca6101f374ffd4f4b04bbb099cc` | **30** / 2001200013, 2001200025, 2001200028 | **20 absent → default false** |
| 30200086 Oregano | CropItemData | 231 | `91defe661de8d1ea77c614d507d4df44a2706e32aa797a907e22848f15ceb5a8` | **30** / 2001200011, 2001200028 | **20 absent → default false** |
| 31100072 WildEggs | IngredientItemData | 249 | `c038762b0862ecd999e2e55988f401c0b739863645288814879809961485e2da` | **13** / 2001200015, 2001200014, 2001200028 | **11 absent → default false** |
| 30200003 Rice | CropItemData | 224 | `c3f096e10a8ee659e6870d5d5b7e2de96d1cdcf65742ccef1dfb271acc7ad77a` | **30** / 2001200012, 2001200028 | **20 absent → default false** |

All four full payload SHA matched each item's `rawPayloadSha256`, not only the packed field fragment. A missing bool field is default false; it is **not** an explicitly serialized false. Native same-build getters independently rechecked byte patterns: Crop `0x44FEFD0` and Ingredient `0x48869F0` implement `!IsMissionItem`. These specific original serialized items therefore produce **TRUE for `get_CanBeCollected` as static typed input**; no Runtime ItemDatabase instance or Save was involved.

Independently scanned all **348** original raw Crop and Ingredient item records and SHA-attested individual payloads, yielding distinct direct-tag **source occurrences**: Fruits41 / Vegetable39 / Spice23 / Grain12 = **115** total (113 Crop + 2 Ingredient), with **0 mission=true positive occurrences**. These are not native final Collection membership nor 115 verified owned items or a denominator.

## Original Native fallback independently checked

Three private game originals already available locally, all rehashed fresh: original metadata v31 **36,538,728 bytes** SHA `07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c`; NSO main **96,002,294 bytes** SHA `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0`; dump.cs **59,624,529 bytes** SHA `a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0`. Original same-build meta TypeDef, interface offset and NSO LZ4 code have been used; no d548 historical untraced metadata equivalence claimed.

- Native HasTag helper at `0x4CC92D0`: original 680 bytes SHA `8da02b30c4d1fa6c0cb133663892e7df9e58f3d1f9278dfdb363004c3f80f3c1`.
- Original AArch64 **BL** at `0x4CC93F8` targets direct RepeatedField.Contains `0x39349D0`; when true returns TRUE.
- Contains failure proceeds to interface cast; original BL `0x4CC9414` targets cast helper `0xB581C0` to **IHasSet** (TypeDef10630, byval index65697). The interface getter `get_SetItem` is MethodDef104096, owner TypeDef10630, verified original v31 metadata. Critically returned **SetItem** is looked up, NOT selector tag ID.
- Original BL `0x4CC952C` → generic ItemDatabase.TryGetItemData RVA `0x37826C0`; original NSO RODATA RVA `0x96E6AE8` methodSpec raw `31950100ffffffff35230000` independently decoded MethodDef103729 (TryGetItemData / TypeDef10610) + Inst9013; Owner's Inst9013 SetItemData TypeDef9664 retained as bounded claim consistent with target and original helper. This is a native **NSO RODATA** MethodSpec, **not** an offset from global-metadata header.
- Original second **BL** at `0x4CC9550` → Contains `0x39349D0` on retrieved SetItemData.Tags, backing +0x40. Failed cast/lookup/null tags/final failed contains return FALSE. Actual ItemDatabase/runtime for general IHasSet remains UNKNOWN.
- For exact original sealed CropItemData TypeDef9050 and IngredientItemData TypeDef9674: same-build interface-offset table count19 and includes IHasTags TypeIndex65701 offset31, ICollectionItem TypeIndex64932 offset37, excludes **IHasSet TypeIndex65697**; dump.cs identifies both as sealed. Thus **on these exact static concrete inputs only**, HasTag Direct Contains true → TRUE, Direct Contains false → FALSE (cast cannot resolve). **This must not become general `rawTagAbsenceIsFinalNegative=true`**; general IHasTags may support IHasSet fallback. Runtime final group membership remains UNKNOWN.

Examples: Blueberry TRUE Fruits / FALSE Spice; Oregano TRUE Spice / FALSE Fruits; WildEggs TRUE Vegetable / FALSE Fruits; Rice TRUE Grain / FALSE Fruits — **only static typed Native predicate inputs**, not live GameDB/CollectionSets/Owned/Collected status.

## New independent replay artifacts, not committed game data

QR independently authored and locally executed: `qr201_activity_postsource_independent.py`, SHA256 **`1d688bd965a8f780a184e16d7e86130bb6c3e99b02aff2ccacd0c33270226788`**; results JSON `qr201_activity_postsource_independent_result.json`, SHA256 **`9032120ac20ea2a4075c233c911c3886a617fb9ae471dbc74297a1bb1bc628de`**. These use local original files; private raw source binaries, raw full game archives and private save are **never committed**. Existing Owner six tests and QR200 five frozen tests were not rerun as a QR test implementation. New dedicated QR CI only checks cross-artifact safety and concrete-fallback invariants from the pinned report; it **cannot claim fresh GZ source replay in GitHub CI** without private original files.

## Release and remaining NEED_SOURCE (no release promotion)

**PASS scope** exact four static predicate source/native conditions only; no new selectors: **96/256 static, +0**, **160 UNKNOWN** = Furniture63, Clothing61, Crafting28, ActivityItem8. Full whole-file original `CollectionSet.json` is still manifest-only **NEED_SOURCE** for whole-file SHA, but preserved individual four raw source rows have been independently replayed. Actual owner-consented unmodified Switch v1.25.0 schema624 Save, runtime ItemDatabase/CollectionSets, result-set materialization, runtime Group composition, any general IHasSet dynamic lookup and personal status still **UNKNOWN/BLOCKED**. No user Collection denominator, percentage, Owned/Collected/Missing or entitlement; no Native Writer/Preset Apply/Publisher. Switch1.25.3 schema626 and Steam remain unpromoted. R17 Product Tree **30 nodes PASS0/PARTIAL12/BLOCKED18**; every PR **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY**. QA static PASS must not become a launch gate PASS.
