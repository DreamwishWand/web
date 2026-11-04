# 01E CORE — W1 Native V3 source boundary (research only)

**Task:** W-NATIVE-005. **Target:** Nintendo Switch DDV v1.25.3 / externally verified BID `9A239D3DB569756D` / save schema 626. The companion module is a **SOURCE_ONLY** negative evidence/registry audit, not a trusted SaveSession, game oracle, edit capability, or new Native V3 PASS. No private P1G, game binary, key or decrypted user Save is committed.

## Fixed source provenance — previously checked, not re-tested

The same-BID original `RecurringEvent.json` SHA256 is `028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea`; target 93-byte event record SHA256 `8c9aff67e6b82c7c31db360858a6dc3b5d27ad80550427fea29f84b3158b492a`. The derived 508-row `static/ddv/timing/v1.25.3/recurring-events.json` has Git blob `d8a4031a20369e2ba70cb143dec178b73254eff8`.

EventID **2010000021** `Wood!Wetland_Softwood` has one weighted ItemID **31700014**, active W1, fixed duration 480 seconds, Min1/Max2/BasicMaximum8, AreaSpecification `SpecificAreas=[VillageAreaType.Wetland=1]`, SpawnAround `Tree!Any` TagItemID2001200008 radius4, and VillageRestriction SceneID1540000000 (`Village!Village04`). Original Tag and Scene record SHA256: `7c1d572eeb4563fd0c02d397deeab3704490ece37497d99873b70c55a03e6c07`, `b37b65feb8cc0055fba7a7cca6ac0b90e4e4358fcadb2b8bb09f29a33dea4936`. Empty Conditions AND. Source nominal overdue cap is 480 * floor(8/1) = 3840 seconds; this does **not** prove observed execution.

Eight original source EventIDs refer to Softwood31700014, four active and four inactive: 2010000021, 2010000022, 2010000024, 2010000025, 2010000099, 2010000121, 2010000122, 2010000123. The ItemID is **not** a unique inverse lookup for EventID. Source protobuf outer framed key21 is **not** the saved recurring-event map key `"155"`.

01B same-BID Native static call edges (original `main.elf` SHA `e99b1aa67ec729053d847adb3621d63e4f2ced570826b8b923531378752b8ebf`) show candidate Conditions/Scene/Area/Grid/Tree/Quota checks, Grids-first then DiffGrids, default + ModifiedObjects − RemovedObjects, and conditional Execute→LastOccurrence→Reschedule→NextOccurrence. Original 24+23+53+3+22 bounded tests reused without a new runtime experiment. 2126 `NextOccurrence` is intentional: never auto-repair.

## Mandatory *future* Native closure, not a grant

Trust sources: immutable encrypted P1G SHA, decoded JSON SHA and exact external BID/schema, original authenticated RomFS/Tag/Scene source bytes, Core-issued Session/Revision/IndexGeneration, old raw lexical and UTC CAS, saved MapKey155 oneof ItemSpawning EventID2010000021 and `LastOccurrence`/nullable `EndDate` unchanged.

Resolve the real live `World.Villages[vi].Areas[areaKey].GridIDs[]` for Wetland1/Village04 via Native enum→save Area mapping. **Do not infer** that `VillageAreaType.Wetland=1` automatically equals a saved Areas map key, nor infer that ItemID identifies the producer. For each actual GridID, validate Grids/DiffGrids precedence, external default GridData/GridDefaultLayout SHA, Modified/Removed occupancy, eligible Tree tag/positions/collision and owner-group Softwood quota. Actual Clock/host Now, startup Actualize, Execute RPC acceptance or denial, Last stamp, Next Reschedule and cold Native save/reload are still **UNKNOWN**. The 8 Core root source hashes in PR397/QA408 and typed PR412/QA436 cannot certify this Native graph; PR417/QA437 synthetic 200MiB decoded-only sparse hash is not real encrypted P1G browser support. No invented Grid IDs.

**Only proposed one-field target** (not currently authorized): `/World/RecurringEvents/155/ItemSpawning/NextOccurrence`. An eventual product operation requires full-document validation, Core-owned exact multi-domain read-set and Revision CAS, atomic one-field diff, preservation of every unrelated/unknown value, original-first backup, edited-copy independent P1G reopen, Native V3 independent evidence and operation-specific 05QR + Owner/CTRL enablement. Previously accepted PR329/QA343 six genuine P1G codec outputs, PR368/QA376 synthetic CAS and Owner-private Python→Node edited-copy technical V2 are reused **without** being promoted to a Rust/JS Worker product Writer.

**Non-World parallel:** Inventory Amount needs canonical Variation/CompatibleItemType/stack/zero/crafting/Quest/storage/native producer references; Collection bool is true/false/ABSENT, not native Owned/Discovered; schema624 local PC-native DecorationPreset backup is not schema626 Save Apply or Touch-of-Magic Design. All Writer/Apply/edited-copy product flags remain OFF.

## Test & QA discipline

`node --test tests/01e-w1-native-v3-source-evidence.test.mjs`: a synthetic source corpus checks event→ItemID direction, eight referrers, wrong Build/ROMFS metadata, forged Writer claims and negative source changes. On full repo CI, it additionally matches the **unchanged original 508-row Registry Git blob**. The standalone test skips that one check only when the canonical file is unavailable in an isolated local source-copy. SOURCE_ONLY tests cannot attest Native gameplay. V3 UNKNOWN; V4 NOT_RUN (only a concrete unresolvable cold-load or Tree/Quota effect with explicit Owner permission).