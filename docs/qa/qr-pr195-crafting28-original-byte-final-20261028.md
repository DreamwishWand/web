# 04 QR — FINAL private original-byte Crafting RecipeType28 independent static acceptance (2026-10-28 JST)

**FINAL CLASSIFICATION: `INDEPENDENT_ORIGINAL_NATIVE_STATIC_CRAFTING28_PASS` — 28/28 new static selector-stage accepted.**
**CUMULATIVE: `NINTENDO_SWITCH_V1250_NATIVE_SELECTOR_STAGE_STATIC_256_OF_256_ACCEPTED` — 228 prior accepted + 28 private-source new accepted.**
Only Nintendo Switch Disney Dreamlight Valley v1.25.0, BID `52BD625D9B4E0053`, save schema624. These are **Native SELECTOR-STAGE STATIC** predicates, NOT runtime collection membership, personal ownership, % or save writer permissions.

## Fixed auditable inputs and provenance

- Owner [Draft PR195](https://github.com/DreamwishWand/web/pull/195) **frozen HEAD `da9528ce3565f68c5c201593fe06c84dfe8fbd3e`**, Native Crafting manifest Git Blob **`877d06e19cd783423995f578105de17af5558ac7`**.
- QA [Draft PR241](https://github.com/DreamwishWand/web/pull/241) **original tested fixed HEAD `380328297ac870cfe648e14f9d47a25c7020d909`**, existing test script **`scripts/qr/reaccept-crafting28-switch1250-original.py`** Git Blob **`161d94cb78875084f0ad72a8f9488ae800eb9348`**. Exact script was locally reconstructed byte-identically and `git hash-object` verified; no edits to verifier for execution. Final evidence-amended QA HEAD is a descendant; do not misstate the tested fixed script SHA.
- Five original Drive Raw File downloads were made **directly in 04 QR**, not reused from 00 CTRL. Each file's byte count and independently calculated SHA256:

| PRIVATE ORIGINAL — no raw game bytes committed | Byte length | Actual SHA-256 / expected SHA-256 |
| --- | ---: | --- |
| ExeFS `main` (NSO) | 96,002,294 | `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0` |
| `global-metadata.dat` v31 | 36,538,728 | `07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c` |
| `dump.cs` | 59,624,529 | `a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0` |
| Lossless `ItemDB.json.gz` | 5,090,928 | `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048` |
| Support Tables gzip | 168,583 | `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9` |

All **5/5 hashes MATCH** 01D canonical SHA ledger. Private Drive IDs, user account data, binary/metadata contents and raw excerpts are intentionally omitted from this public GitHub file.

## Actual offline execution (not GitHub CI)

Independently installed/found `python-lz4`. Ran the **existing, unchanged, Git-blob-verified QA PR241 Python script** in this order: main, metadata, dump.cs, lossless gzip, support gzip. The original Owner machine manifest's 28 selector rows were retrieved via GitHub connector from exact frozen Owner JSON Blob `877d06e...` and materialized as a **local selector-only mirror** (not represented as a byte-for-byte copy of the full JSON). The original 25 Definition SHA checks + 28 row tuple comparisons establish that the local mirror matches original Native-support raw content. Two local initial transcription typos in the selector-only mirror caused a temporary local assertion and were corrected **only in the private mirror**, not in Owner JSON or the fixed QA script. Final unchanged-verifier execution succeeded with zero assertion failure.

Original Python stdout **exact PASS marker** `QR_CRAFT28_INDEPENDENT_ORIGINAL_RAW_NATIVE_28_PASS`. SHA256 of its 402-byte JSON stdout record: **`bb51db6c9508857fca765bd94aaf43ffd7c3f0a756c729ee4795b4dd49eed2c5`**. These bytes contain the safe machine PASS summary only; no game binary.

Independent fixed-script checks, all on **actual original bytes**:
- Original NSO0 and exact Switch BID; metadata v31, LZ4-decompressed executable sections. Original MethodSpec98762 **12 raw bytes `2a950100ffffffff3c870000`**, MethodDef103722 / GenericInst34620 / exactly **two** TypeDef9715 `CraftingRecipeItemData` and TypeDef10402 `ActivityDataItemType`. Original usage token `C0030395`.
- Correct Crafting Outer Case8 / RecipeType Inner Case2 native bounded instruction SHA; BL `0x4BFD0F8`→`0x37816F0` plus other four Native call targets; the true RecipeType Where predicate and `Result.ItemID` projector native SHA slices, and null exceptional helper target.
- **Negative original control**: MethodSpec98710 GenericInst8335 resolves **CritterItemData TypeDef9630** at old BL `0x4BFC974`; unrelated one-generic MethodSpec98709 is not substituted for selected two-generic Crafting MethodSpec98762.
- All **293/293** raw original `CollectionSet` payload SHA (including **25/25** Crafting Definition raw hash equality vs exact frozen Owner selector manifest), **28/28** RecipeType occurrences across 25 distinct original DefinitionIDs, exact tuple `(DefinitionID, RecipeType, Ignore)`, and **1206/1206** original CraftingRecipe ItemData SHA with ItemType205/subtype3 and nested `Result.ItemID` presence.

## Previous independent CI vs new private-byte proof

Source-only GitHub dedicated [CI #40632693591](https://github.com/DreamwishWand/web/actions/runs/40632693591) **SUCCESS** (7/7 source assertions), ordinary [CI #40632693619](https://github.com/DreamwishWand/web/actions/runs/40632693619) **SUCCESS** at fixed QA head `380328...`, but deliberately **no private original binary in GitHub CI**. Final offline QA execution **independently supplies the missing Native original proof** and is reported as LOCAL/OFFLINE, *not* an additional GitHub original-binary CI PASS. Evidence-amended QA HEAD may rerun GitHub source-only CI; those runs do not change the original proof scope.

Historic [04 QR PR208](https://github.com/DreamwishWand/web/pull/208) red Owner old HEAD `64913f8d63f90dc9ada1200a1249aff373217420` / independent QA historic SHA `b3f33956eeabba1f42c2287f57f75b68391ddd67` remains **genuine historical wrong Critter branch RED** and is not amended or relabeled. The Source correction addresses that exact former defect; this is a new acceptance on a later Owner HEAD, not a retroactive change.

**No release escalation**: actual Runtime `ItemDatabase`, `CollectionSets`, final membership, player Owned/Collected/Missing/denominator or %, schema626/Switch1.25.3, Steam, Native Writer/Preset Apply/Community publishing/entitlement editing all remain UNACCEPTED / UNKNOWN / OFF. No private game source in repository. Operator A0–A7 HUMAN NO-GO, B Provider D HOLD/CAPABILITY_BLOCKED, C physical cleanup NOT_AUTHORIZED. R17 Product Tree PASS0/PARTIAL12/BLOCKED18+seven human blockers; public release NO-GO. **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY**.
