# 08 WEB — Collection Reference Detail / Progressive Read-only Consumer
Date: 2026-10-26 · Owner: 08 WEB · Draft PR #192 · DO_NOT_MERGE / DO_NOT_DEPLOY

## Canonical product and source
- One Collection workspace, `Category` **default**; `World` / `Universe` are alternative **views** rather than separate products/routes.
- Existing shared DDV item-reference projection is `src/lib/collection/runtime.js`: `wand.collection.runtime@1` index and `wand.collection.records@1` source rows in `static/ddv/collection/v1.25/`. No second Item model.
- 12,552 reference rows / 18 on-repo shards with count, offsets, bytes and SHA-256 checked by Web Crypto before rendering. Exact source target Nintendo Switch DDV 1.25.0 / BID `52BD625D9B4E0053`. Each row's stable ItemID/family/state semantic/world/universe/expansion and official 8-locale name comes from that checked source.
- This is a static **public reference catalogue**, not per-account owned inventory; `TRACKED` and `READ_ONLY` are catalogue metadata, never personal `Owned`, `Missing`, `Discovered`, `Available` or Entitlement.

## Jobs and implementation
| Job | Status / boundary |
|---|---|
| Browse verified 12,552 catalogue rows / Category default | Existing source implementation; progressive 120-row `Show more` now prevents browse hard stop after first 120 |
| Search by official names in eight locales / exact numeric ItemID | Existing source implementation retained |
| Change to World / Universe classification view | Existing source implementation retained; linked detail retains view/query/selected facet on Back |
| Open a specific Item Detail | NEW read-only `/collection/?item=<canonical ItemID>` from existing record model; source-backed label, family, World and Universe; no separate product workspace and no guessed external URL |
| Unknown/invalid item deep link | NEW no detail, explicit unavailable; not redirect to any arbitrary ID |
| Unsupported Switch1.25.3 / Steam version | NEW unsupported version status; no item/detail/ownership output for unsupported target; 1.25.3 schema626 Core read-only is NOT silently adopted by 1.25.0 catalogue |
| Source index/shard failure | Existing count/byte/hash checks kept; NEW safe generic error and Retry, clears data on failure |
| Locale / keyboard / 320px | Eight locale messages including uncertified ownership/media/version; keyboard-followable card link and focus styles; Chrome actual source fixture on local dev only |
| Personal `Owned/Missing/Discovered`, filters by user progression | **BLOCKED** pending shared DDV Core source/version-specific owner save projection and privacy/account/linkage/QR; no guess from database state |
| Item images | **BLOCKED** pending media bytes, rights and source provenance; no stock placeholders or unapproved game art |
| Preset Apply / native DDV writer / Gallery Publish / Cloud | **OFF**; not part of this consumer |

## Backend contract and limits
- Collection Index and Shard are the **only** data fetches in this view. Existing `loadCollectionRuntime` rejects target mismatch, invalid dictionary/index/offset/count and any shard byte/hash/record-envelope drift. It uses browser fetch of checked-in public static JSON; no Supabase row, authenticated API, Storage signing, direct SQL or user save upload/read.
- Future personal state must reuse the shared DDV Core item and schema626 version distinction; must not coerce Collection `stateClass=TRACKED` to a user's ownership claim. Cross-product 09 INT links require exact registered subject identity, not generic ItemID guess. Owner/Account+Save provenance privacy and per-platform build must be verified independently.
- 03 COMM Source142 / active staging116 and Storage Provider Gate B are NOT dependencies for this source-only browse/detail job and are **not** certified by its passing tests.
- Canonical media rights, authorizations, update migration and complete seven-product release acceptance remain separately gated.

## QR handoff
- Automated pure contract checks in `tests/collection-reference-detail.test.mjs`: IDs, invalid/unsupported versions, 8 locale textual boundaries, one-workspace deep-link roundtrip, no ownership fields or mutation routes.
- Real Chrome on checked-in static source (not mocked positive database): `scripts/collection-reference-browser-acceptance.mjs`, action `.github/workflows/collection-reference-browser.yml` checks Category/120→240 progressive, World→Detail→World, Universe search empty, ItemID link/keyboard, unknown ID, unsupported version, 8 locale / 320px reflow, injected index 503 and Retry.
- Browser negative network interception uses synthetic *failure only*, while positive records are checked-in source; not signed user save / staging / provider acceptance.
- Full QR of actual user-owned Collection job still BLOCKED until authorized normal Actor, save metadata correctness, version-specific data and privacy evidence. Release R17 score unchanged.

## 2026-10-26 — independent QR193 RED-1/2/3 minimal repair (owner scope)

The original QR [PR193](https://github.com/DreamwishWand/web/pull/193) demonstrated three **real functional RED conditions** in the original PR192 source (despite its earlier positive 8/8 Chrome). Repairs in this same isolated Draft PR192:

- **RED-1 root integrity:** The fetched Index is hashed from its original response bytes using browser Web Crypto SHA-256 **before JSON parsing or any Shard fetch**; expected independent pinned digest is `a74f6df131e114c66759bc3f463266e3b68fea629ac6a360062423ce6fc133c9` from the existing QR raw-byte calculation. Any category/facet/localized dictionary, target/BID/source identity, count, or Shard description mutation rejects the entire runtime, even if individual Shards retain/recompute their own SHA. Pin is code-owned, not read from the Index. This protects the static JS-consumer vs compromised/cached Index bytes; it does **not** establish an external signature or a trustworthy deployment when the application JS bundle itself is compromised.
- **RED-2 unique identity:** All 18 Shards share one ItemID `Set` during load; any malformed/non-safe/negative ItemID or repeated ID fails before returning any completed data. Detail selection also refuses ambiguous repeated IDs rather than selecting arbitrary first match. No array subset is returned after a rejected Shard. This is the same version-scoped numeric ItemID referenced by 09 INT PR194, not a new ID space.
- **RED-3 URL entrance:** Strict single-occurrence allowlist for `view/q/family/world/universe/version/item`; noncanonical decimal ItemID, invalid view, unknown/duplicate parameters, incompatible view/facet combination, empty meaningful values, and oversized filters are rejected with `invalid-url`. The route never renders a Detail/List for such input, offers safe reset, and resets selected state on URL navigation. Loading clears the old runtime immediately and uses a monotonically increasing generation number so stale failing/successful fetches cannot overwrite latest Retry. Valid Category/World/Universe and localized search/facet Back round-trip retained.

Owner-source regressions: `tests/collection-failclosed-qr193-regression.test.mjs` includes real checked-in Index pin, forged dictionaries/build/source/Shard/count, cross-Shard duplicate fixture and ambiguous Detail selection, duplicate/noncanonical/conflicting URL, and safe request generation source assertions. Original eight Chrome groups are retained, with two new live-Chrome groups in `scripts/collection-reference-browser-acceptance.mjs`: invalid URL following valid Detail, tampered Index failure followed by canonical Retry Detail. Browser tests use a **real Chrome against local development server**, real positive static corpus and adversarial HTTP interception only; not signed actor/Storage/Save/staging evidence.

**Safety/acceptance hold:** No changes to 12,552 reference data or 18 on-repo Shards; Switch v1.25.0 BID `52BD625D9B4E0053` only. No 01D PR195 private Save-backed UI, no unconditional merge of PR194, and no claim `TRACKED` = Owned/Discovered. Native Save Writer, Preset Apply, Gallery publishing, Wand Cloud and physical deletion remain disabled. Even successful owner tests cannot replace new **04 QR independent post-fix HEAD** acceptance. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.
