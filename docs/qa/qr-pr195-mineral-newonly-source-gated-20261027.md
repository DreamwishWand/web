# 04 QR — PR195 ActivityItem.Mineral New-Only Source-Gated Audit (2026-10-27)

**Verdict: PARTIAL / NEED_SOURCE for independent original Native and original full protobuf.** Source-projection consistency tests are valid but cannot certify source provenance. The new Owner +1 is not yet independent PASS STATIC. All PRs DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.

## Owner freeze and scope

- Repository DreamwishWand/web; Owner Draft PR #195 https://github.com/DreamwishWand/web/pull/195
- Frozen Owner HEAD: **5ed6b31dc1ce44943baee67362e65575effaf6ab**.
- Prior accepted QR204 Owner HEAD: **7e5bd4fe70ff2895bb2e0aa50cf80677d85ed87e**; old independent QA PR #204 HEAD 12e2ae4aa1327f8dd83c6bf3867ab9672abc14b1 unchanged.
- Compare old→new: exactly 3 commits, 3 changed paths: new native-activity-mineral-original-predicate-v125.json; new six Owner tests; 19 lines appended to collection-save-backed-readonly-v125-20261026.md. No prior selector rewrites.
- Owner GitHub CI https://github.com/DreamwishWand/web/actions/runs/40438067445 is COMPLETED SUCCESS, 1041 PASS / 0 FAIL / 12 inherited SKIP, per current 01D canonical Handoff. This is NOT original-byte independent QA.
- New QA changes only this report, tests/qr-pr195-activity-mineral-newonly-source-gated.test.mjs and .github/workflows/qr-pr195-mineral-newonly-source-gated.yml. Source-projection frozen Git blobs: Owner Mineral JSON cff621bc97fa1e63f23de9c92909b1228acc5021; compact source index 7622ff51f6e48315893d7b75f08e51c248d09f2e.

## Re-derived using available published bytes (scope-limited)

1. Source compact index contains **293 CollectionDefinition records and 256 typed Selector occurrences**; exactly one ActivityItem.Mineral record, ID **2120000084**, compact original-row SHA reference 55be403d62d4b9ac75ed7a0a339b085b55c6b6c3fe23b188908851efba814e19.
2. Independently parsing the **provided 18-byte fragment** groupField9WireHex gives outer Group field9, typed field2, ActivityItem field6, Mineral field7 **empty message**, with typed Ignore field1 absent/default false. Separate ByItem field1 has Ignore=true and one packed ItemID **31600040 (Onyx_Shiny)**. Do NOT apply ByItem.Ignore as typed Mineral filter; final membership UNKNOWN.
3. From the provided MethodSpec record 2a950100ffffffff49870000, decode native method-def **103722**, class instantiation **-1**, method instantiation **34633**; encoded usage 0xC00303AF resolves MethodSpec index **98775**. The Owner labels two original generic type arguments MineralItemData TypeDef9063 and ActivityItemType TypeDef10400, subtype16 and ItemType3. These type identities and RVA calls remain ORIGINAL-SOURCE UNVERIFIED.
4. Provided original-getter **16-byte hex** 088041391f010071e0179f1ac0035fd6 SHA256 **9173b888b01aea203e357cfeda024f06898a1824ae272ffcf5c2389d294bbd4c** decodes LDRB W8,[X0,+0x60], CMP W8,#0, CSET W0,EQ, RET. That byte string has the conditional semantics **!IsMissionItem**. However the QA session did not independently re-extract those 16 bytes from RVA0x451B400 NSO, nor check protobuf field11 linkage or metadata interface/vtable.
5. Owner reports Mineral case7 RVA0x4BFDE68 252-byte arm SHA4703f8..., MethodSpec98775 and native GetAllByType<MineralItemData,ActivityItemType>(3,16).Select(ID) with 160-byte projector at RVA0x4BFF7C0 SHA091f6d...; no Mineral-specific Where, and common downstream IsValid gate separate. **NEED_SOURCE** for full native re-derivation.
6. Owner reports 53 source MineralItemData raw protobuf rows, all Field11 absent/default false; Diamond31600002 and Onyx_Shiny31600040 are typed source positives. Different subtype17 ActivityItemData Brick31700000 is source-type negative, **not** native Collection-membership negative. No same-concrete Mineral Mission=true original source example. The new QA cannot independently rehash/decode 53 full raw payloads or the original 114-byte CollectionDefinition because those originals are absent.

## Provenance matrix

| Subject | QA classification | Caveat |
|---|---|---|
| Exact Owner HEAD/3-path delta/Owner CI | CONFIRMED | CI test success is not source-original validation |
| Published compact count 293, selector count 256, Mineral exactly 1 | CONFIRMED | Static metadata only, not denominator |
| Published 18B nested protobuf fragment, two-type MethodSpec record, 16B getter bytes | CONFIRMED AS PUBLISHED-BYTE DECODE | Embedded Owner bytes, **not independently sourced** originals |
| Original NSO main 96,002,294B SHA3258d5e05..., IL2CPP metadata v31 36,538,728B SHA07e919f07..., dump.cs 59,624,529B SHAa94ae73d... | NEED_SOURCE | Owner hashes only, no local original streams in QA runtime |
| Original lossless ItemDB gzip SHA df78c309..., SupportTables gzip SHA537cfcf..., full 114B definition and 53 typed item payloads | NEED_SOURCE | Published compact/hash/fragment are not lossless original inputs |
| Original 252B Native branch, 160B projector, MethodSpec/TypeDef chain, 18 interface offsets/vtable34/getter | NEED_SOURCE | Original NSO and metadata necessary for independent acceptance |
| Actual runtime enum, combined Ignore/IsValid, CollectionSets, personal save | UNKNOWN | Not inferable from item definition |
| Incorrect/unsafe promotion | No defect proven; safety guards remain | Lack of original independent source is PARTIAL, not fabricated PASS or RED |

Historical d548 metadata and standalone CollectionSet.json whole-file provenance remain separately NEED_SOURCE; previous QR198–204 acceptance is not re-executed or revised.

## Counter and fail-closed rules

- **Independently accepted before this audit: 101/256 (QR204).**
- **Owner-proposed after Mineral: 102/256, remaining154**, broken down as ActivityItem2 (Fish, CraftingMaterial) + Crafting28 + Clothing61 + Furniture63. Arithmetic and unique Mineral count confirmed; the **one new Mineral predicate is NOT independently original-byte PASS** until raw source replay.
- 53 raw source Mineral rows do not equal runtime enumerator results, CollectionDefinition final members, actual Collected/Owned, or percentage denominators.
- Runtime native eligibility UNKNOWN; player Owned/Collected/Missing UNKNOWN, denominator NULL; personal percent, native persistent Save Writer, Preset Apply, Community Publisher, entitlement editing OFF. Switch v1.25.3/schema626 and Steam not promoted.
- R17 Product Tree acceptance unchanged: 30 rows PASS0/PARTIAL12/BLOCKED18; public release NO-GO.

## Reproduction and next gate

Dedicated QA command: node --test tests/qr-pr195-activity-mineral-newonly-source-gated.test.mjs

Six new-only cases independently decode *provided* bytes, cross-check the separately pinned compact index and fail-closed gates. The workflow explicitly has NO private game source; passing CI must not be represented as full original-byte QA.

For **PASS STATIC** require a consented authorized local replay using matching original NSO0 main, metadata, dump.cs, lossless source ItemDB, SupportTables, SHA256 validated before deriving from original bytes the Mineral branch/MethodSpec/projector/interface getter and full 114B definition/53 raw typed item protobuf rows. Do not commit proprietary binaries or personal Saves. If originals remain unavailable, stop at PARTIAL/NEED_SOURCE. The next 01D tasks Fish and CraftingMaterial remain UNKNOWN; do not copy Mineral semantics to either.

Report to 00 CTRL: One Mineral owner-only +1 is arithmetically valid but raw-original independent QA is still blocked; all Draft DO_NOT_MERGE / DO_NOT_DEPLOY. 04 QR should resume this exact review only upon source availability, with no redundant QR198–204 or Web/Community/Operator work.
