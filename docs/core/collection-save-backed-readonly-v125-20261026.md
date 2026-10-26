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
