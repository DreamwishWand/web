# 01D CORE — Collection Save-backed Read-only Semantics (2026-10-26)

Status: PARTIAL / SOURCE-ONLY IMPLEMENTATION. No authentic Switch1.25.0 CollectionSets replay or reviewed complete v1.25.0 category binding pack was performed. Native write/entitlement modification disabled.

## Exact version and provenance

* Switch v1.24.13 / Profile608: historical R45 baseline only. 7,951 Entry pairs, 7,499 unique, and 452 repeated-category ItemIDs are NOT current denominators.
* Switch v1.25.0 / BID 52BD625D9B4E0053 / Profile624: original P1G read and native CollectionSet/ListInventory meaning are confirmed independently, but exact current category membership source and authentic save replay still gate the metric.
* Switch v1.25.3 / BID 9A239D3DB569756D / Profile626: original P1G offline packaged read is promoted, but CollectionSet and ListInventory native semantics are NOT promoted. STRUCTURAL_ONLY with no discovered, owned, denominator or percent.
* Steam v1.25.3: original P1G is STATIC_COMPATIBLE_RUNTIME_PENDING. BLOCKED.

Sources: DDV_WAND_COLLECTION_METRIC_SPEC_R45_2026-09-25.md (Drive 1b1hKULn4snWPhZX2BkrRvBdZaAdn1VNg), DDV_COLLECTION_NATIVE_SEMANTICS_SWITCH_v1.25.0.md (Drive 1twdWJlpb97uBDkDPWQ3l6B6iZpWrkUgL), DDV_LISTINVENTORY_NATIVE_SWITCH_v1.25.0.md (Drive 1NGRpxnnPLqyx3ODdDtxzHVos91Qj7QcA), lossless Game DB SHA256 df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048, source save versioning registry from PR #109.

## Semantic model

The game constructs collection candidates from serialized Player.CollectionSets repeated entries, CollectionDefinitionID, ordered GroupData and GroupsCollectionItems[ItemID] persisted bool, resolved through a same-build ItemDatabase. R45 Entry Coverage is the ratio of collected to all resolvable (category, ItemID) entries; duplicates in one category collapse if boolean agrees, conflicting boolean fails closed. An ItemID in multiple categories counts once per category; Unique Item Coverage merges ItemID only and returns PARTIAL when categories disagree. Native visible counters, RedDot, runtime history and reference catalogue are NOT the denominator.

PR #192's 12,552 static ItemID reference records and 18 SHA-checked shards are metadata only. The Core adapter requires verified same-version CollectionDefinitionID to category/group-count mapping and current ItemID definition index. Unknown definitions become exclusions and null denominator, not missing. The complete metric requires reviewed full category manifest and complete source candidate universe; these source attestations must come from an independently trusted local loader, never client-submitted claims. No DLC/Premium exclusion is assumed. Photo Gallery and Exhibition are special non-R45 domains. World/Universe/Area/expansion filtering will require a separate reviewed metadata join and is not implemented here.

Owned is separate from Collected/Discovered: ListInventory.Data.Amount>0 only after exact native ApplyVariation canonical ItemID and compatible list routing evidence. Zero amount with retained key and absent key both mean no stock but remain distinct persistent states. Unknown/unverified canonical ownership route returns UNKNOWN. Available/Unlocked/DLC entitlement/Premium/receipt/auth are never inferred.

## Files and consumer

* src/lib/ddv/core/collection/save-backed-readonly-v125.js — projectSaveBackedCollection, ddv.collection-save-backed-readonly@1, matchProfileReadContract gate, private source and owner guard, category/unique summary, optional exact ItemID owned binding, 626 structural-only.
* tests/ddv-core-collection-save-backed-readonly-v125.test.mjs — focused synthetic category, partial, duplicate, zero-versus-absent, unknown source, version and owner tests.
* This document — version/privacy/consumer contract.

Private caller requires original source/storage platform, exact target build, GameInfo schema, raw source SHA256, P1G read validation and explicit owner/local-only assurance. The emitted source hash, category states and Owned are sensitive local profile-derived data; never publish as Community metadata, telemetry, public Gallery/analytics or server default.

08 WEB PR #192 remains source-only. BLOCKED => no private results; STRUCTURAL_ONLY => safe nonpersonal diagnostics; PARTIAL => no global percentage; COMPLETE => percentage only for an audited current-source membership universe. Even COMPLETE can have per-item UNKNOWN Owned. TRACKED and READ_ONLY reference state never imply owned. No profile API, server persistence or personal Collection UI is enabled by this source-only change.

## Open evidence

1. 01D: actual reviewed Switch1250 category definition/group count/current ItemDB binding pack and consenting genuine schema624 save replay. No Profile608 denominator inheritance.
2. 01D/Core: exact canonical ownership/variation/ListInventory routing binder for requested item families and special-class exceptions.
3. 01D/01B: Switch1253 same-build CollectionSet, visibility, group selector and ListInventory native semantic regression. Schema626 P1G alone is insufficient.
4. 08 WEB/09 INT/04 QR: authorized local owner/provenance UX, cross-version negative, private state, partial/empty filters, source-facet overlap, real actor/device regression.

All DDV native writers, entitlement edits, Gallery/Cloud publication, Road/Fence and Shop V8 WAIT_EXTERNAL_SERVER_DATA remain untouched. DRAFT / DO_NOT_MERGE until Integrator review.

## 01D Category-to-ItemDB Provenance Closure — 2026-10-26

**CONFIRMED STATIC / REAL SAVE UNKNOWN.** The independently SHA-256-checked v1.25.0 raw CollectionSet.json (45,171 bytes; e4887dc5729b8660caadc0d8f875a199a331973ccfeb97c740542a27ac44cc87) matches the canonical 01D support table (537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9). The complete lossless 17,413 ItemID set exactly matches the 01D Query index (DB sha df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048; Query sha f3472e53bfcd55f13249cc79ddeae83ea71168fcb356c7038a0c0935eca2d06e). Existing Switch v1.25.0 dump.cs CollectionSubMenu supplies exact enum identities; no Switch/Steam transfer.

17 active native CollectionSubMenu values / counts of CollectionSet definition: Crop0=7, Fish1=2, Meals2=3, FurnitureSets3=63, ClothingSets4=61, Memories6=40, Characters7=33, Foraging8=2, Minerals9=2, Crafting10=4, TimeBending11=5, BoardGame12=16, Snippets13=3, Stories14=39, Companions15=2, Mounts16=5, QuestPuzzles18=6. Native PhotoGallery17 and Exhibition19 are excluded special domains. All 293 source definitions have exactly one Group. There are 150 direct explicit include-ItemID filter occurrences and 273 exclude occurrences; 422/423 filter ItemIDs exist in canonical 17,413 DB, the sole non-definition being exclude sentinel ItemID=0 in Definition2120000259. Eight typed selector families occur 256 times, **NOT** native-equivalently expanded, so static ItemID filters and raw typed selectors are not a proven final Collection candidate universe.

Immutable full detailed machine artifact: Drive 1gBbhxGGk3AO2DfZPdWykDGnoeQ81bzJ- / SHA256 ffd0df28b5a12ff97044710c6fed31688f68b3772843721d54b777a502d803b9 / 269634 bytes. Minimal checked-in pack static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json SHA256 c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb / 50078 bytes. It includes all 293 exact definition IDs, enum, per-definition protobuf SHA-256, internal name, explicit typed include/exclude ItemIDs and raw typed selectors. src/lib/ddv/core/collection/category-definition-provenance-v125.js verifies **actual pack bytes** against separately hardcoded SHA256 and independently guards source scope with an unforgeable in-process verified capability. The private profile binder checks only observed CollectionDefinitionID, one Group and exact persisted boolean maps; it never synthesizes an absent save membership or returns a denominator or Owned. Negative tests refuse modified bytes, forged manifest capability, unknown definition, duplicate ID, wrong Group, nonboolean map, schema626 and owner provenance absence.

**08 WEB consumer boundary:** Use the pinned source binder only as STATIC SOURCE PROVENANCE and structural verification of the already-loaded, consented owner profile. Do not turn profile binder's static flags into adapter's categoryManifestReviewed/currentDefinitionUniverseComplete, do not pass index IDs from the 12,552 Reference Catalogue as the full 17,413 ItemDB, and do not emit personal percentages or owned status. Precise native selector+Ignore expansion and one original owner-consented genuine schema624 save with current-source ItemDB resolution/independent coverage validation are next hard gates. DLC/Premium and unknown/empty memberships remain visible filter metadata rather than denominator-affecting ownership guesses. Switch v1.25.3 / schema626 remains STRUCTURAL_ONLY despite P1G READ PASS; Steam remains separate.
