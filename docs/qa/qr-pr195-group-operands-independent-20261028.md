# 04 QR — PR195 Group Operand independent SOURCE acceptance (2026-10-28)

**Disposition: SOURCE-ONLY QA; final pass requires the exact QA HEAD test runs and CI readback.**
**DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / Public Release NO-GO.**

## Frozen scope

- Existing 04 QR / QA & Release. **Only** `planCollectionDefinitionGroupV125` and `previewCollectionDefinitionGroupV125`.
- Owner [PR195](https://github.com/DreamwishWand/web/pull/195) exact SHA `daff2110c7f112c859e05c2516ae0339b07ef5ec`.
- Owner implementation `src/lib/ddv/core/collection/category-definition-provenance-v125.js` Git blob `eb120afe2a59cb004cfd90b01b82a1748e3b9ff3`. QR modifies **no Owner implementation**.
- Nintendo Switch DDV v1.25.0 / BID `52BD625D9B4E0053` / schema 624, **not** 1.25.3 / 626 or Steam.
- Earlier 04 QR [PR241](https://github.com/DreamwishWand/web/pull/241) independently accepted Native Selector **256/256 STATIC** against original 5 private sources. This QA does not repeat that original-native audit; no private source bytes, game binaries or personal save go into GitHub/CI.
- [PR242](https://github.com/DreamwishWand/web/pull/242) separate Switch1.25.3 01B work, and [PR240](https://github.com/DreamwishWand/web/pull/240) Community Source148, are out of scope.

## Pinned original-source evidence reused; independent compact-manifest read

- Compact manifest `static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json`, 50,078 bytes, SHA-256 `c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb`, Git blob `7622ff51f6e48315893d7b75f08e51c248d09f2e`.
- Source definition raw SHA `e4887dc5729b8660caadc0d8f875a199a331973ccfeb97c740542a27ac44cc87`; Item DB source gzip SHA `df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048`; support source gzip SHA `537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9`.
- Native group evidence manifest 4,024 bytes, SHA-256 `418d9805ab59ab60941072afd206161f205f6daa4bcadd9a95f960226a6ad699`, Git blob `1cd4c874b2599e2464c50b48a7d5941d816dc30f`. Its original NSO references SHA `3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0`. It is evidence for **ordering only**, not current runtime candidate sets.
- Independently enumerated the **ordered** compact records: 293 unique DefinitionID, 17 exact CategoryIDs/counts, 256 Selector occurrences over eight families (`ActivityItem12/Furniture63/Crafting28/Clothing61/MemoryShard41/CharacterUniverse33/BoardGameFigurine16/Pet2`), 20 typed Ignore, 150 explicit Includes and 273 explicit Excludes. Strict ascending DefinitionIDs; no repeated IDs. Every Definition retains its supplied 64-hex original raw SHA. Independent Node test compares the complete per-definition plan with this SHA-sealed manifest at every ordinal, including selector argument, Ignore and explicit ByItem list.
- Original Definition `2120000121` has two Crafting selectors `RecipeType=2001100002` and `2001100006`, with `Ignore=true` explicit ByItem `40700049`; a positive synthetic preview must exclude that ID but include `40700050` and `40700051`.
- Original Definition `2120000259` has `Ignore=true` explicit `ItemID=0` sentinel. Planner preserves it; preview must return `BLOCKED / COLLECTION_ZERO_SENTINEL_NATIVE_MEANING_UNRESOLVED` with **no** implicit drop or valid ItemID substitution.

## New isolated independent coverage

`tests/qr-pr195-group-operands-independent-v125.test.mjs` is **independent from Owner's test** and derives its preview oracle from raw ordered manifest tuple arrays, not `plan` output. Cases:

1. Whole-file independently hard-pinned SHA/length/platform/version/Build/schema, 293+17+256+8 families and all Include/Exclude/Ignore/sentinel totals.
2. Per-record/slot deep comparison of all 293 plans: category, Definition raw SHA, group ordinal/count, exact selector family/arg/Ignore and ByItem list; no personal metrics.
3. All **292 non-sentinel** definitions: separate manual `union(positive) - union(ignored)` oracle against synthetic outputs in `includeIgnored=false`; `union(all)` in `includeIgnored=true`. Both remain UNTRUSTED with null denominators.
4. Original multi-Crafting example; reversed **input-array** order remains safe because immutable numeric slot bindings reconstruct original manifest order. Actual altered original-record ordering has modified SHA and must **BLOCK**; input-array permutation is not accepted as a source operand-order change.
5. ItemID0 sentinel negative case.
6. Mutated SHA bytes, source record reordering, forged/mimicked WeakMap capability, wrong Group capability, Switch1.25.3/Steam/wrong BID/schema.
7. Missing and duplicated slot, nonexistent/negative/fractional slot, wrong Family, spoofed Ignore or predicate attestation, invalid item IDs 0/negative/fractional/strings/null/overflow, invalid DefinitionIDs and includeIgnored type.

The only positive result is `SOURCE_DEFINITION_NATIVE_ORDER_PREVIEW_UNTRUSTED`. No caller-supplied candidate list can become native truth or personal Collection metrics. Slot results are not independently native-attested; presence of a slot is **structural coverage**, not actual correct GetItemsInGroup coverage.

## Execution and decision

- Independent source-verified exact original-manifest **observations** are listed above; these observations are not an original Nintendo Switch runtime replay.
- Owner ordinary CI at frozen SHA: [run 40637351084](https://github.com/DreamwishWand/web/actions/runs/40637351084) completed SUCCESS. This is Owner CI, not independent QA acceptance.
- Independent test run / dedicated source CI / ordinary CI: **PENDING exact QA HEAD readback**.
- Decision ceiling, if both CI run clean: `INDEPENDENT_SOURCE_GROUP_OPERAND_PLAN_UNTRUSTED_PREVIEW_STATIC_PASS`. Otherwise `PARTIAL` or `RED` with exact counterexample and return to 01D.
- Runtime ItemDatabase, GetItemsInGroup, CollectionSets, unmodified consented Owner Save, Owned/Collected/Missing, denominator and achievement %: **UNKNOWN / OFF**. IsValid/variation and sentinel live semantics remain runtime work.
- Native Writer, Preset Apply, Community Publisher, entitlement edits and cross-version/Steam semantic transfer remain **OFF**. Gate A0-A7 & launch **NO-GO**.

## Next owner dependency

01D: on independent PASS, preserve frozen `plan/preview` source-only scope and do not promote to runtime/ownership. No Owner implementation change is requested absent a reproduced QR RED. Future original ItemDatabase/CollectionSets/Owner Save read-only paired runtime evidence belongs to separately authorized controlled 01E/operator workflow, not this PR.
