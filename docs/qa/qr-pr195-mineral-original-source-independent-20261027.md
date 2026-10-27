# 04 QR — PR195 Mineral Original-Source Independent Acceptance (2026-10-27)

**Final original-source verdict: PASS STATIC BOUNDED.** This is a *new, independent, local original-byte re-derivation* after recovery of the five named Drive assets. The earlier QR Draft PR #205 at exact HEAD `e9672f1005db4a5df52af7bfba8ddabd8ac23a2d` remains **historical PARTIAL/NEED_SOURCE and is not edited or rewritten**. This QA acceptance is a distinct new-only Draft PR. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.

## Fixed scope, Owner, source access

- Nintendo Switch DDV v1.25.0, BID `52BD625D9B4E0053`, save schema624 ONLY. No Switch1.25.3/schema626/Steam semantic transfer.
- **Frozen Owner PR #195 commit**: `5ed6b31dc1ce44943baee67362e65575effaf6ab`; subsequent Owner HEADs are NOT accepted implicitly. Original Owner CI [40438067445](https://github.com/DreamwishWand/web/actions/runs/40438067445) COMPLETED SUCCESS. Previous independent QR204 static selectors **101/256**.
- Historical QR #205: `e9672f1005db4a5df52af7bfba8ddabd8ac23a2d`, dedicated CI40439283540 and normal CI40439283427 SUCCESS but **PARTIAL/NEED_SOURCE** as of that earlier audit. Not retroactively converted.
- Drive metadata was fetched by ID before original raw downloads. The exact raw downloads were materialized as private QA local files; all five hashes independently computed with `sha256sum`, not inherited from Owner claims or CTRL.
- Independent local replay executable: `qr206_mineral_original_independent.py` SHA256 **ec781dd13d85b817ff260438e0e0424af1b266fe68ff55b6a394872d252b594a**. Generated independent JSON result SHA256 **b2cb0754a81e38f63e220e252289f48712643e9fe64ee5d71365bec22aa62671**. Script and complete private result are preserved as user-session artifacts; no proprietary source binaries or personal profile Save are committed. Committed machine-readable public digest/semantic attestation: `static/ddv/qa/qr-pr195-mineral-original-independent-v125.json`.
- GitHub CI intentionally runs **only new original-source attestation contracts**, because original proprietary game files are NOT uploaded to GitHub. CI SUCCESS must not be described as a replay of private originals.

## Independent file SHA256 and authoritative bytes

| Drive file ID | Raw file | Bytes | Independently measured SHA256 | Result |
|---|---|---:|---|---|
| `1oZ4V2BdNSH62n7KFruNbgvGsw5eRs1Z8` | ExeFS main | 96,002,294 | `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0` | PASS |
| `1-Ptq2xCjQh1Fc_tHn1DeekiqiVTFc0v1` | global-metadata.dat | 36,538,728 | `07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c` | PASS |
| `13nyviL_uZ9w-Op_9VhJsdpe0Ho4l2cdj` | dump.cs | 59,624,529 | `a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0` | PASS |
| `1_iMow5gXJTmgbogw1y7S8vTQp-Bj2vI8` | lossless ItemDB gzip | 5,090,928 | `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048` | PASS |
| `1Ee5tySw_XinkIXvLTSkDfFUMlTjJPtJJ` | Support Tables gzip | 168,583 | `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9` | PASS |

Support Tables Drive MIME `application/json` and returned local extension `.json` are misleading: ORIGINAL byte magic `1f8b` verified, gzip decompressed successfully and raw SHA checked. NSO magic `NSO0` and header Build ID itself also checked. Metadata original magic `af1bb1fa`, v31 checked. NSO compressed segments independently LZ4-unpacked to memory bases `0x0/0x91BA000/0xAACA000`, lengths `152803164/26278856/13050248` bytes.

## Native re-derivation from ORIGINAL bytes

1. `CollectionGroup._GetItemsFromType` Mineral case7 RVA `0x4BFDE68`, full **252 original unpacked NSO bytes** SHA256 `4703f8dcee3487eb05203cab1182fe8be1f3e844c32596897a56d1357b462eee`. Independently decoded `CMP W8,#7` at start; `MOV W8,#16` RVA `0x4BFDE9C`, `MOV W1,#3` RVA `0x4BFDEA0`, `STR W8,[SP,#0x18]` RVA `0x4BFDEA4`, and BL RVA `0x4BFDEA8` → `0x37816F0`. This is the two-type `GetAllByType<T,SubEnum>(ItemType3, ActivityItemType.Mineral16)` path. **NOT** Flower's one-argument generic.
2. Original NSO RODATA metadata-usage at `0xB1EF690` is `0xC00303AF` → MethodSpec98775. The original 12-byte MethodSpec at `0x96E60B0` is `2a950100ffffffff49870000`: MethodDef103722 `GetAllByType`, classInst -1, methodInst34633. NSO GenericInst table `0xAC24890 + 34633*8`→`0xAC1F870`; count **2**; arg pointers `0xB313598`/`0xB2CCFD8` resolve original TypeDef9063 `MineralItemData` and TypeDef10400 `ActivityItemType`. Metadata method name and same-build dump declaration independently checked.
3. Original ID projector `CollectionGroup.<>c.<_GetItemsFromType>b__46_14(MineralItemData)` RVA `0x4BFF7C0`, full **160B** SHA `091f6df3a1790b1a787ced9caa5cf709cd21ae08b3f9f57155398d0736408b8e`. Original AArch64 `LDR W19,[X19,#0x18]` at `0x4BFF7E8`, Select call `0x4BFD874`→`0x3752680`. There is no Mineral-specific Where in this selector path; common downstream `IsValidItemForCollection` stays separate and is not a final membership guarantee.
4. Original metadata v31 `MineralItemData` TypeDef9063 record **88B** SHA `1bc0bba3688460e826bd497c173771f27df38eee141c323444a449cde16a5d40`. Its interface-offset table starts at index18342 and has **18 actual entries** SHA `5cf1e5dd3ffd6a275fc1ccea7b2c77a88b453500e3421234e71b4e4b586ec992`. Interface type64932 `ICollectionItem` offset33 plus virtual slot1 → VTable **34**. Original vtable `0x60028BB9`→MethodDef83420 **get_CanBeCollected**; variation interface TypeIndex65831 does not appear in its 18 interface offsets.
5. Original Native getter RVA `0x451B400` full **16B** SHA `9173b888b01aea203e357cfeda024f06898a1824ae272ffcf5c2389d294bbd4c`, decoded original opcodes `LDRB W8,[X0,#0x60]; CMP W8,#0; CSET W0,EQ; RET`: **`!IsMissionItem`**. Same-build dump maps backing offset `+0x60` to protobuf **field11**, default false.

## FULL original source protobuf independently decoded

- Original SupportTables `CollectionSet` record `2120000084`, `Minerals`, full rawPayloadBase64→**114 bytes** SHA `55be403d62d4b9ac75ed7a0a339b085b55c6b6c3fe23b188908851efba814e19`. Original wire parser found one Group9 → ByType2 → ActivityItem6 → Mineral7 explicit empty message, ByType.Ignore absent/default false. Separately, ByItem1 has **Ignore=true and ItemID31600040**. These are different selectors/exclusion dimensions.
- Original lossless Item DB entire 17,413 raw definitions retained; specifically all **53** full MineralItemData rawPayloadBase64 blobs individually decoded and rehashed against their per-record source hashes; every source record ItemType=3 and subtype=16, Field11 **absent in all 53**, **explicit false=0**, **explicit true=0**. Absent→false is protobuf default; it is not the same as a serialized explicit false.
- Representative independently verified source rows: Diamond `31600002` 243B SHA`0ca66672...`, Onyx_Shiny `31600040` 254B SHA`da8207b0...` (ByItem ignored separately), Mini01!HoneyAgate `31600082` 273B SHA`9a1e4e1f...`. Different concrete `ActivityItemData` subtype17 Brick `31700000` SHA`50dd4839...` was checked as typed-path negative; **not evidence of final Collection membership-negative**. No same-concrete Mineral mission=true source exemplar was available; the Native getter itself provides the negative branch predicate.

## Judgment, coverage, nonpromotion

**PASS STATIC BOUNDED for exactly ONE Mineral source-native predicate**, as directly re-derived from original 5 input files. No Owner Native semantic discrepancy observed. The original-source independent selector count moves **101→102/256**, **154** still unknown: ActivityItem2 (Fish, CraftingMaterial), Crafting28, Clothing61, Furniture63. This increases *predicate knowledge only*. The 53 original typed source rows are **not** runtime enumeration, final Collection group membership or denominator. A single Onyx_Shiny ByItem Ignore cannot be collapsed into ByType Ignore.

Runtime original ItemDatabase, CollectionSets and common IsValid evaluation, unchanged authorized user profile save, personal Owned/Collected/Missing, denominator, personal percentage remain **UNKNOWN/null**. Native Save Writer, Preset Apply, Community Publisher, entitlement editing all OFF. Switch v1.25.3/schema626 is Collection STRUCTURAL_ONLY; Steam independently bounded; no promotion or writer authorization. R17 Product Tree launch matrix **30 rows PASS0/PARTIAL12/BLOCKED18**, seeds/privacy/legal/operations unchanged, Release NO-GO.

Historical QR198–204 and QR205 remain untouched; no frontend, Community R12–R17, Source134–142, Operator Gate A/B/C, Editor/Presets reimplementation. This PR is independently frozen on Owner `5ed6b31dc1ce44943baee67362e65575effaf6ab`, all Draft DO_NOT_MERGE / DO_NOT_DEPLOY.

Next 01D direction: Fish or CraftingMaterial original-source native closure as separately scoped selectors; QR to review only new exact Owner delta with independent original inputs. Do not re-review this completed Mineral source-static predicate absent substantive contradictory evidence.
