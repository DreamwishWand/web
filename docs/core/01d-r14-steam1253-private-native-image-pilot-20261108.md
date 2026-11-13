# 01D CORE / ASSET R14 — Steam 1.25.3 genuine Sprite/Texture private pilot (2026-11-08)

**Task:** W-01D-ASSET-IMG-028. **Operation:** DEV_READY / REAL_ORIGINAL_STEAM_SOURCE_ONLY / PUBLIC_IMAGE_HOLD. Main-based isolated three-file Source delta; separate frozen PR781 Source74fdf914/Owner CI42433084361 and accepted PR668/QA680/09INT697 reused, never reQA.

## Authentic owner-private provenance

External Steam GameRoot FullVersion: releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22. Native Furniture original is 2,458,197B SHA823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674, parsed using the already accepted 01D Native itemlist reader (6,233 furniture records), not a new duplicate. Original furniture UnityFS SHA9fbf4b75e50bd08b7479e4dc372ca0568254051c64872b66ba9332ecf139cdb0 249,369,620B. Its CAB is 7,989,552B, resS 799,025,968B; block-index/lazy decompression prevents full memory expansion. Class28 Texture2D 4,464 objects, class213 Sprite 4,459, class142 AssetBundle1. Actual Addressables bucket/key/entry/InternalIds source hashes match pinned originals. For each icon GUID the catalog has two ResourceLocations, Unity class Texture2D and Sprite, both depending on exactly this furniture Bundle. Original AssetBundle GUID container maps to two distinct typed SerializedFile PathIDs.

Private real sample source witnesses:

| ItemID | Texture name | format | raw streamed original SHA256 |
| --- | --- | --- | --- |
| 40000047 | Armoir01 | BC7/25 | 3667a7212306096b69896e7304be9982fd1f95e718b27f742b3ffe0cabb32972 |
| 40002422 | OogieBoogieSign01 | BC7/25 | dfc86319c5f16ad5e1f5f614d0c0b5bf33114962ff48bd79b2f41e6736016811 |
| 40006096 | OogieDiceTree | DXT5/12 | 7daefc7646df6b25fc07859b28536027323ad12edcbdef4eb19e388ea972e1d4 |

Each encoded original stream is 262,144B for a 512x512 texture. Steam-derived reconstructed PNG versus Steam-derived 160px WebP lossless, using the original decoded raster resized with LANCZOS and exact=True to preserve transparent pixel RGB, passed 3/3 exact resized RGBA equality. Correct raw PNG/WebP file SHA witnesses:
- 40000047 reconstructed PNG 1e195cb2c3a28acd7cd6a6d68ede35928c77245fadd1f465b506162ffd3bd474 / lossless WebP 30ab4e9c59d87e2796a56a2bdda2b87bfc03bb39364b3d2267d31db2804865e0.
- 40002422 reconstructed PNG 4af1181ffc411ea4a41bfe03f95d41ffc9c3e0a032c56e073e91ca91bea82ae8 / lossless WebP 988eb7ef8d4b295c25882946e1f2d78aa329af583a3b3def392ee8ecfa503c3c.
- 40006096 reconstructed PNG e1a6a39a50a38acf6f69b70cf4d53c6092396930c41dc3327510ba307e3969f1 / lossless WebP 75292936edd3ed82fd97e69f7e8e09771ce4c9ec36d867c7703b066a95b1854c.

**WARNING:** The decoded candidate images visually exhibit vertical banding/artifacts. The format/raster pipeline needs separate real image and rendering QA. Exact WebP pixel identity to a resized candidate does NOT establish faithful native game rendering or platform equivalence. Original UnityFS stores BC7/DXT5, not standalone native PNG, so the reconstructed PNG SHA is *not* the Switch original PNG SHA. Independent real current Switch v1.25.3 BID9A239D3DB569756D/schema626 ItemID/IconGUID/PNG SHA/released visibility: NOT_RUN, 0 accepted. R39 Switch v1.24.13 ZIP 32/32 WebP quality88 is lossy and never projected to v1.25.3 lossless. Current public item release manifest remains items={} and publicImagesEnabled=false.

## Usage / Gates / QA

Private-only example (no extra upload/split, no externally billed service):
python3 scripts/asset-research/01d-steam1253-private-native-image-pilot.py --source-root /private/steam-v1253-itemlist --catalog-root /private/steam-v1253-aa --bundle /private/steam-v1253-furniture/furniture_a1c425a5.bundle

The runner checks exact original file SHA/size and external FullVersion, reuses Native Furniture decoder, bounds UnityFS virtual reads and checks types, returns candidate PNG/WebP bytes and the HOLD record in memory, refuses symlink/alias input paths, and verifies lossless160 pixel identity. The CLI emits only a redacted summary (counts, SHA, privateFilesWritten=false), never media or a receipt file. Optional legacy --private-output is a validation-only hint, not a sink. Owner must never place any original UnityFS, PNG, WebP, private Save, decoded JSON, keys, or raw byte excerpts in public GitHub, CI or Pages. The code itself contains no original image media.

Rights: Owner game-image TEST Pages/formal direction already approved in Issue604, do not request again or make written licence permission an indefinite code-development stop. License UNKNOWN, source Disney Dreamlight Valley, UNAFFILIATED, image-unit contact/takedown/HTTPS+CDN revocation operation NOT_RUN. Native Writer, Cloud, Provider and CommunityPublic OFF; public image operation NOT_RUN. A source SHA verifies provenance, not a rights licence or production release.

**Positive:** authentic Steam same FullVersion, native ItemID/GUID, two ResourceLocation types, exact dependent bundle, two typed PPtrs, actual compressed texture SHA, bounded reconstruction and private dual SHA with RGBA-equal WebP. **Negative:** wrongBuild, wrong SHA, input symlink, alias/output collision, duplicate ID/GUID, missing texture/Sprite, invalid type/offset/stream, unknown target release/rights flag and historic R39 rebranding must fail closed. Owner Source CI is not independent QA. Request 04QR-W independent NEW_ONLY Source HEAD + CI; 09 INT alone selects original accepted files latest main/Verify/Pages, no QA-only PR or bulk stacking.

**Rollback:** revert only the three new source/test/docs paths, original Drive bytes and Pages unchanged; no new scratch derivatives to remove. **NEXT:** repair/verify native image visual fidelity; first-party Switch v1.25.3 same-BID pixels and visibility; then actual versioned lossless public manifest rows, 07DBK source/nonaffiliation/contact/takedown and 08 WEB item-card HTTPS/320px/200%/8-locale real visual diff. No automatic public art switch.

## 2026-11-13 — post-preflight output boundary repair

09 INT E1317 reproduced an actual Linux symlink replacement after the accepted QA844 preflight; the original path-based writer created a new file in a synthetic original directory. QA844 historical accepted scope remains valid, but immutable write containment was not established. Remove all arbitrary image/receipt writes and pathname unlink cleanup. `run(args)` returns the complete HOLD record and bounded PNG/WebP products in memory; `report_summary`/CLI emits only redacted counts and a receipt digest, privateFilesWritten=false. Legacy save_exclusive rejects before I/O; optional --private-output is only a checked hint. Native decoder and SHA/Build/ItemID/format/pixel checks remain unchanged. No full Native rerun or new GPU parity, Switch visibility, rights or publish authority is claimed. Actual synthetic regression substitutes only upstream source/decode fixtures and exercises production orchestration, real symlink/rename, error propagation and original invariance. Existing private derivative files remain usable by PR794; new persistence or combined in-memory verifier integration requires a separate safe contract. QA-L2 changed-risk independent QA required before selective 09 INT. No new public media, Writer or other flags.
