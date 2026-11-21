# 01D CORE — R39 authentic icon provenance and Stage1 image source (2026-11-05)

**Task:** W-01D-ASSET-IMG-028 (P0 READY → implementation). **Source base:** protected TEST main `6428d080786bf3b2035be86b945b1460dbf1452a`.
**Owner decision:** `OWNER_GO_FOR_DDV_GAME_IMAGES_20261105` (GitHub Issue #604). In-game DDV art publication is the approved product direction despite accepted residual legal exposure. This does **not** establish rights-holder licence, and never overrides technical QA, genuine source binding, operator controls, or explicit 09 INT deployment.

## Direct original source evidence

- Original **Nintendo Switch v1.24.13 / R39** Query Foundation ZIP: `201729836d0bab2f097252b4e59effc8539d318a7a99f47fe624b8d7eaa3a05e`.
- Compressed Query Index: `a175dc6936496c00e3c94520a91a861b63a37ba86e2476cac939424a540f4882`; PNG portable manifest gzip: `f0ea2248bc7a91d9a8afb655bf142150798aa96fbde1fd91ae028927b4ef3aba`.
- R39 derivative manifest file SHA `c619541497732e76441c52f6505b2ca2dbe1fd2baffdfda4fa4584b9819a7733`. Source from original DDVRE Drive `04_DATABASE/GameDatabase/AssetPacks/v1.24.13/ThumbnailsR39`, folder `1bqKGQBl0ipO6wDQq_VZEPZpB8oqLQUbY`, 32 exact ZIPs.
- Local original data revalidation: **32/32 ZIP SHA and CRC clean**, **12,082/12,082 WebP headers + full decode valid** and within 160px; 12,117 verified original source Icon GUID address mappings → 12,082 unique lossless PNG/content SHA → 12,082 WebP objects; 85,464,564 total original ZIP bytes. Query Index 16,930 ItemIDs, 14,601 source-icon ItemIDs, 2,329 without source icons. 14,601 source ItemID → `guid:` → source PNG SHA → WebP path verified against portable mapping; distinct 10,656 GUID, 10,629 content SHA used by the item subset. No generated/guessed IconIDs.
- SHA-pinned local rebuild evidence: original `r39-source-itemid-guid-sha.json.gz` and separate **HOLD_NOT_DEPLOY** packaging of actual 12,082 WebP bytes (full package and verification report retained locally; do not upload art to PR/CI or push to Pages from this branch).
- All mapping entries retain `currentVersionEquivalent:null` and `releasedPlayerFacingInTarget:null`. Historical original SHA integrity is **not** current Native equivalence.

## Version/gate boundary

| Target | Exact evidence | Approved mapping |
|---|---|---|
| Original R39 Switch v1.24.13 | Original asset bytes and SHA provenance verified | SOURCE_ONLY |
| Consumer Switch v1.25.0, BID 52BD625D9B4E0053, schema624 | Current browse Catalog 12,552 text records; no independent v1250 ItemID→IconGUID→original SHA join | **UNKNOWN / zero current rows** |
| Save/Worker Switch v1.25.3, BID 9A239D3DB569756D, schema626 | v1253 original save/source structural evidence; no same-BID item PNG/GUID diff | **UNKNOWN / zero current rows** |
| Other platforms/versions | No original equivalence evidence | DENY |

This source-only contract `r39-image-source-contract.mjs` accepts a historical provenance row but **never** returns an authorized manifest entry, public URI or `Owned` state. Invalid source SHA, target BID/schema, forged current-version flags, wrong shard path or ItemID rejects. A caller's positive Owner permission is **not** same-version GameDB proof. The 08 WEB production `public-item-images.mjs` (PR #609) requires independently certified `VERSION_VERIFIED`, `RELEASED_PLAYER_FACING` and `WEBP_VERIFIED_160` for individual rows. This PR **does not** emit `static/ddv/item-images/v1/manifest.json`, put art in GitHub, or enable media in publicly accessible Pages.

## Next exact integration inputs

01D: acquire authentic same-build v1.25.0 and v1.25.3 source ItemID→IconAddress GUID mapping, exact variant/category/visibility differences, and cross-compare source PNG/raw texture digest against R39 per ItemID. Only positively independently verified current-version rows can be promoted; others stay unavailable. No prior R39 bytes silently assigned to new items.

08 WEB: consume confirmed same-build manifest rows through existing PR #609 shared ItemThumb only; no filename/IconID inference; correct path and immutable SHA; fallback when unavailable; 8 locales, 320px/200%, dynamic fit/density. Handle CI scope failures without incorrectly relaxing negative assertions.

07 DBK operator: actual non-affiliation/attribution/contact, per-ItemID/hash disable, takedown and CDN purge/rollback. Licence not asserted; already approved Owner direction should not be re-requested.

04 QR-W: new-only Source + actual game-image hosted Chrome with matching first-party WebP bytes after 09 INT and operator readiness, wrong ItemID/version/sha and retraction negatives; no source + CI pass alone implies actual Pages success.

09 INT: only Merge Owner-accepted source with exact fixed HEAD/CI and independent QA; separately pack/ship art on owner-authorized media release scope and verify protected main/Pages. No blanket deploy from file availability.

## Evidence Gate

R39 artifact metadata V0/SOURCE original SHA verified; original v1.24.13 12,082 WebP decode verified. Current v1.25.0/v1.25.3 Item image mapping V0 source target join UNKNOWN, independent source QA NOT_RUN. Actual hosted image bytes NOT_RUN; `PRODUCT_PUBLIC_IMAGE_DEPLOYED=false`. Real personal P1G V1/V2, Native V3 and device V4 not part of this asset operation; all native Save Writer/Apply/Cloud/Community public and personal Owned/Discovered remain OFF/UNKNOWN with denominators NULL. No private original/key upload, no User Save modification.
