# 01D CORE / R14 — Steam v1.25.3 Item image candidate preflight, 2026-11-08

Task W-01D-ASSET-IMG-028 | Operation DEV_READY / SOURCE_ONLY | No game media, private P1G, automatic public manifest, Cloud or Writer in repository. This is a minimum candidate bridge, not media-release acceptance.

## Reused ancestry and exact sources
Existing 01D Steam native protobuf reader: scripts/asset-research/01d-steam-native-icon-delta.py. PR668 original Source fixed 2acd359, independent QA680 PASS, 09INT PR697 selected on main. Owner-private original two Steam furniture UnityFS sha and 4,464 Texture2D stream comparison accepted E813; the three genuinely changed SHA streams are POCMKTower, HMWallKit03 and OogieBoogieDoor. No duplicate read/QA.

New live original Steam/Windows v1.25.3 GameRoot FullVersion.txt:
releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22

Original itemlist Furniture.json: 2,458,197 bytes, SHA256 823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674, 6,233 native furniture ItemID→IconGUID rows parsed. This source is NOT Switch v1.25.3 original image or BID proof. Distinct Nintendo Switch target is version1.25.3/BID9A239D3DB569756D/schema626.

Private-only example invocation using existing original files, never GitHub originals:
    python3 scripts/asset-research/01d-v1253-image-preflight.py --root /private/steam-v1253-source --report /private/output/new-three-candidates.json --item-id 40000047 --item-id 40002422 --item-id 40006096

No additional upload or source split is needed. The reader requires a new exclusive output outside the original source directory; rejects symlinks, unpinned SHA/size, forged external FullVersion, changed files, invalid/duplicate ItemID and existing report. It reuses the original 01D native parser.

## Private candidate + versioned public release boundary
Each actual native ItemID→IconGUID candidate has status STEAM_ITEM_ICON_GUID_ONLY. Sprite PathID, Texture2D PathID, current original PNG SHA, lossless WebP SHA and Switch visibility remain null until independent original image proof. Missing-item rows remain explicit. The private draft schema wand.01d.versioned-image-release-hold@1 has zero items, null public URL, publication OFF, ItemThumb OFF, Writer OFF. The 08 WEB public manifest schema wand.item-images.public-catalog-lossless@1 is intentionally not emitted.

R39 Switch v1.24.13 all 32 ZIPs were found, but their WebP derivative is quality88 LOSSY, not the required lossless-160 RGBA-exact variant. Never repurpose original historical R39 v1.24.13 item data as Switch v1.25.3 verified, and never silently relabel its WebP or reuse a Steam GUID as Nintendo Switch pixel identity.

Owner already approved game-image direction TEST Pages and formal release in Issue604. This is not proof of rights-holder licence: license UNKNOWN, source Disney Dreamlight Valley, affiliation UNAFFILIATED; rights contact/takedown/CDN tests remain NOT_RUN and not an indefinite development stop. Per-image versioned SHA + published operator/hosted proof is still required before actual media publication. No original game files or private Save in public CI/Pages.

## Source tests, QA, rollback, NEXT
Synthetic positive: bounded canonical ItemID, genuine fixture parser reuse, HOLD output (zero public rows). Synthetic negatives: wrong SHA/size/fullVersion, duplicate/invalid IDs, symlink root, input/report alias, existing report not overwritten, fake publication/rights/target version not promoted. The actual original itemlist is verified only in private runtime and not available to public CI.

Frozen new Source HEAD and terminal Owner CI first; 04 QR-W independently tests ONLY new script/test/doc; 09 INT alone selects accepted original source blobs onto freshest main with cumulative CI and Pages. No QA-only PR merge, no public Pages unpublish. No new Writer, Cloud, Provider, Community public or media Flag.

NEXT: reuse current Steam original GameRoot AssetBundle GUID→Sprite→Texture2D source address and R39 ItemID source index; compare actual image-content hashes on bounded sample, then independently verify current Switch same-BID original PNG SHA and released visibility. Only confirmed entries can receive exact RGBA lossless WebP content SHA, version-specific deploy Manifest, independent hosted 08WEB ItemThumb tests and per-image takedown. Rollback removes this PR's three new Source files only, discards private scratch report, leaves Drive originals and previously accepted main/Pages intact.
