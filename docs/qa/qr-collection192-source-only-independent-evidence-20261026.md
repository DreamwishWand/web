# 04 QR — Collection PR192 independent source-only release QA (2026-10-26)

Status: **SOURCE CORPUS INTEGRITY PASS; NEGATIVE FAIL-CLOSED CONTRACT RED (3 witness classes); RELEASE PRODUCT NOT PASS.** DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. No real Save, signed Actor, Storage, Community SQL or native DDV Writer accessed.

## Frozen evidence

- Target: 08 WEB Draft [PR192](https://github.com/DreamwishWand/web/pull/192), exact HEAD `f5647ea4d05fa26afcf3cf57933a1df09a101c18`, base main `71e568c9b576c54f8d100fae2ae883c835de7602`. Index Git Blob `51e72eb055ef150df060ebeb86bd3dc79bc3cb2c`; Collection Loader Git Blob `13d46bb37e09f121d9768ad7bf683ff1913a5f86`; Selection/navigation Git Blob `912718244a1055d1b1b295b41b638d6911fdd6c4`; page Git Blob `b42571555e118a63c1ef918c7d13a2ac9425ab69`.
- Independent QR Draft PR193 branches from **exact PR192 HEAD**, adds only two independent test files, isolated workflow and this evidence note. WEP/Core/WEB product code unchanged; existing WEB actual Chrome 8/8, 914 unit-contract PASS and prior accepted QA/Operator suites not rerun.
- Canonical Nintendo Switch **v1.25.0 BID52BD625D9B4E0053**, native save schema624. Index `wand.collection.runtime@1`, shards `wand.collection.records@1`, source manifest `COLLECTION_SEED_MANIFEST_DDV_v1.25.0_2026-10-02_V2`. This is a **12,552-record catalogue projection**, not the entire canonical 01D Core **17,413-definition** baseline and not personal Collection.
- Switch v1.25.3 BID9A239D3DB569756D, schema626 read-only CORE and Steam/Windows current FullVersion have distinct evidence, not an implied v1.25.0 catalogue promotion.

## Independent positive proofs (source-only)

Using checked-in physical JSON bytes, Node crypto (independent of browser Web Crypto) validates **all 18 records-00..17**, contiguous offset/count, raw byte sizes and per-Shard SHA-256, record envelopes, dictionary indices, no duplicate ItemIDs, target and source manifest. Count **12,552**, 12,552 unique ItemIDs. Observed Index raw byte SHA256 **`a74f6df131e114c66759bc3f463266e3b68fea629ac6a360062423ce6fc133c9`** (not pinned by runtime). Failure injection: missing initial/final shard; appended byte; altered manifest length/count/offset; v1.25.3 and Steam target substitutions all **rejected** by Loader/validator. Deep-links across Category default / World / Universe preserve query and relevant facet on generated Back URLs; invalid numeric IDs/unknown ID and unsupported target are not rendered as found detail. Eight-locale source copy contains explicit uncertainty about Owned/Discovered and image rights; Svelte source does not load item image or account/Save entitlement; Trackable remains DB class, not Owned. Structural keyboard/320px checks are SOURCE ONLY, not a second actual Chrome trial. No genuine Platform v1.25.3 or Steam state was read.

## Independent negative witnesses (functional acceptance RED)

1. **Unpinned Index root authenticity:** mutate only `index.f[0]` to unverified category; retain all 18 original Shard byte SHA-256 and sizes. `loadCollectionRuntime` accepts and decodes labels against modified Index dictionary, because neither Index bytes nor trusted Source manifest SHA is checked against a pinned external/root digest. Marker `QR_COLLECTION192_RED_UNPINNED_INDEX_DICTIONARY_ACCEPTED`. This is a synthetic integrity attack, not evidence the checked-in index was modified.
2. **Cross-shard duplicate ItemID fail-close:** clone a Shard, replace one ID with an ID already in another Shard, update the Shard's manifest byte count+hash consistently; Loader returns the full corpus and two records for the same ID, without uniqueness rejection. Detail `records.find` then resolves by first occurrence, not a validated unique identity. Marker `QR_COLLECTION192_RED_DUPLICATE_ID_AFTER_SELF_CONSISTENT_MANIFEST_ACCEPTED`. Synthetic fixture only; actual 12,552 checked-in IDs were unique.
3. **Malformed duplicate URL parameter:** `?item=507&item=abc&view=???` silently selects first ItemID and normalized view, then resolves a detail rather than rejecting malformed/duplicated ID; original URL is not replaced/canonicalized on entry (though generated Detail/Back HREFs omit invalid view/facets and encode query). Marker `QR_COLLECTION192_RED_NONCANONICAL_DUPLICATE_ITEM_PARAM_ACCEPTED`. This does not mean cross-workspace Back link fails for valid input.

An isolated workflow can finish green because these tests **reproduce** the three RED counterexamples. It must NOT be used as proof those functional criteria PASS.

## Acceptance and repair boundary

- 08 WEB owner should independently pin/verify the Index against a trusted expected digest/source identity, not merely trust an unverified Index pointing to correctly hashed Shards. Validate duplicate ItemIDs across all Shards before any record is returned or rendered, including self-consistent altered manifest. Add explicit duplicate/invalid parameter refusal or canonical URL replacement on entry, and no stale Detail when malformed URLs/version changes. No partial rows after any failure.
- Owner fix must be followed by **new exact HEAD + new isolated QR regression**; do not recycle this old QA pass. Item media bytes/public-display rights, per-account Owned/Missing/Discovered, Premium/DLC entitlement, Save provenance and personal Collection privacy remain UNKNOWN/BLOCKED, not implicit results of reference browse.
- Gate A/B/C Operator #130 and prior Source142 QA untouched. All Draft/DO_NOT_MERGE/DO_NOT_DEPLOY. Release R17 Product Tree30 PASS0/PARTIAL12/BLOCKED18, no formal R18/R19 and **no Collection node Release PASS**.
