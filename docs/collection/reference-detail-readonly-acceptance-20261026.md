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
