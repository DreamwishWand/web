# 01D R14 — v1.25.3 three-image private proof → 08 WEB resolver HOLD contract (2026-11-08)

**Task/Owner:** W-01D-ASSET-IMG-028, 01D CORE / ASSET. **Operation:** DEV_READY / REAL_ORIGINAL_STEAM_SOURCE_ONLY. Product media publication OFF. 09 INT only Merge owner. This work is an isolated, main-based Source; it does **not** alter frozen PR #781 Source74fdf914 CI42433084361 PASS or PR #787 Sourcee67d0b8 CI42435778538 PASS, each with its own independent 04 QR-W new-only QA remaining.

## Facts, samples, and provenance

Original Steam/Windows v1.25.3 FullVersion **exact** releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22 (external file; not a Nintendo Switch BID). First-party original Furniture.json SHA823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674 2,458,197B, Native furniture 6,233 records through the accepted 01D Native reader. First-party original furniture UnityFS SHA9fbf4b75e50bd08b7479e4dc372ca0568254051c64872b66ba9332ecf139cdb0 249,369,620B. Existing PR787 first-party catalog key/bucket/entry/InternalIds resolves each exact ItemID→IconGUID→Texture2D/Sprite PPtrs→UnityFS encoded SHA, **not reconstructed by this tiny contract validator**. Genuine compressed textures and private PILOT derivatives:

| ItemID | IconGUID | Native Codec | Original texture stream SHA256 | Steam reconstructed 512px PNG SHA256 | Steam-derived 160px lossless WebP SHA256 |
|---|---|---|---|---|---|
|40000047|26d1b07fac5a07a4ebea467b962fb6a4|BC7|3667a7212306096b69896e7304be9982fd1f95e718b27f742b3ffe0cabb32972|1e195cb2c3a28acd7cd6a6d68ede35928c77245fadd1f465b506162ffd3bd474|30ab4e9c59d87e2796a56a2bdda2b87bfc03bb39364b3d2267d31db2804865e0|
|40002422|094a2e721b66fc44cb13be2d368a3c38|BC7|dfc86319c5f16ad5e1f5f614d0c0b5bf33114962ff48bd79b2f41e6736016811|4af1181ffc411ea4a41bfe03f95d41ffc9c3e0a032c56e073e91ca91bea82ae8|988eb7ef8d4b295c25882946e1f2d78aa329af583a3b3def392ee8ecfa503c3c|
|40006096|b569dad82cd3de74397780d1fa7be96a|DXT5|7daefc7646df6b25fc07859b28536027323ad12edcbdef4eb19e388ea972e1d4|e1a6a39a50a38acf6f69b70cf4d53c6092396930c41dc3327510ba307e3969f1|75292936edd3ed82fd97e69f7e8e09771ce4c9ec36d867c7703b066a95b1854c|

Private PILOT reproducibility tested: reconstructed source PNG SHA **3/3 exact**, lossless WebP SHA **3/3 exact**, WebP decoded RGBA == resized derived PNG **3/3** and white/dark opaque background composite == **6/6**. **These are derived SHA, not original Nintendo Switch PNG SHA**. The originally reported vertical stripe artifact was caused by displaying RGB of alpha0 pixels without alpha composite; not evidence of source compressed Texture swizzle corruption. The target game image still needs independent first-party visual and platform verification.

## Owner-private run only

New standalone Node script **does not** parse new Native game formats and does not write any image. It hashes the original Steam file+bundle and exactly six owner-private existing PILOT derivatives. It refuses symlink, hardlink/inode alias across inputs, missing/wrong size/sha, wrong fullversion, unknown CLI flags, output overwrite, path inside a git repository cwd, output-alias and incorrect PNG RGBA 512 or WebP VP8L 160 header. Output is only a *private metadata report* containing the schema wand.01d.v1253-item-image-consumer-hold@1 with publicProjection.items EMPTY, publishAllowed=false, no URL and every public media flag OFF. No original PNG/WebP/CAB/resS can go to GitHub/CI/Pages. Requires the existing private derived PNG and WebP outputs from PR787; only the user-private local Python PILOT materializes the derivatives.

node scripts/asset-research/01d-v1253-image-consumer-hold.mjs --fullversion /owner-private/Steam/FullVersion.txt --furniture /owner-private/Steam/Furniture.json --bundle /owner-private/Steam/furniture_a1c425a5.bundle --images /owner-private/private-01d-pilot-images --output /owner-private/hold-receipts/steam1253-item-image-hold.json

Output directory must pre-exist and be separate from all original source directories; output new/no-clobber. No additional user upload or split is required. Source CI exercises synthetic deny tests only, *never* original UnityFS or private image bytes. A valid private SHA result is tagged PINNED_FILE_SHA_VERIFIED but the reconstructed pixel equality is separately evidenced, not claimed to have been computed by this Node header/hash verifier.

## Exact 01D → 08 WEB interface and missing gates

**Current** src/lib/item-media/public-item-images.mjs on main:
- consumer schema wand.item-images.public-catalog-lossless@1, variant webp-lossless-160-v1, codec WEBP_LOSSLESS_RGBA_EXACT;
- hard-pins source Nintendo Switch v1.24.13/R39 and original R39 SHA f0ea2248bc7a91d9a8afb655bf142150798aa96fbde1fd91ae028927b4ef3aba;
- hard-pins target Nintendo Switch v1.25.0 BID52BD625D9B4E0053/schema624, and emitted URL path v1.24.13;
- requires sourcePngSha256 **original game PNG SHA**, webpSha256 and RGBA_EXACT_VERIFIED, VERSION_VERIFIED, RELEASED_PLAYER_FACING, WEBP_LOSSLESS_VERIFIED_160 + publication marker.
**Steam reconstructed PNG is not Nintendo original PNG; no target Switch v1.25.3 BID9A239D3DB569756D/schema626 evidence exists for these three.** Under current consumer code, any Steam1.25.3 manifest must be rejected. 08WEB owns the future explicit supported source/target/ABI/versioned URL layout and site media resolver changes; 01D cannot silently change them or mint old-schema PASS. New 01D report supplies *only* SHA-verified three Steam candidate rows and exact missing evidence:
1. Current Nintendo Switch v1.25.3 same-BID native ItemID→IconGUID, Sprite/Texture2D and released Item visibility;
2. Correct original source PNG SHA on current Switch or separately justified source raster pixel equivalence; never substitute reconstructed Steam PNG for original source;
3. Distinct v1.25.3 source/target Build pin, immutable PNG/WebP dualSHA, correct alpha/exact resizing, private image rights/provenance;
4. 08 WEB version-aware Image Resolver, source identity, URL namespace, lazy loads, fallback, 320px/200%/8 locales and actual managed Pages HTTPS/Chrome positive/negative;
5. 07 DBK licensing (currently UNKNOWN), non-affiliation, per-image rights contact/takedown/revoke/CDN/cache purge and Operator evidence.

**Coverage 3 only, 6,233 native furniture ID records != 6,233 game-image verified rows**. Historical R39 Switch v1.24.13 32/32 thumbnails are WebP quality88 LOSSY, not verified lossless/current Switch images. Already accepted Owner Issue604 game-art use policy for TEST Pages/formal release is not a native identity or rights-holder licence proof; no repeat approval. MediaPublic, Writer, Apply, Cloud, Provider, CommunityPublic OFF. Existing /web/ Pages remain live.

## QA, negatives, rollback, NEXT

Positive: real owner-private source FirstParty Steam FullVersion/Furniture/UnityFS SHA plus six exact derivative files in one private witness, 3 IDs only, no media uploaded or public rows. Synthetic tests exercise manifest source/target wrongBuild, right Build with forged SHA, duplicate/missing/malformed native IDs or hash, unknown release flag, symlink, alias, fake size/source, existing output. 04 QR-W independent new-only fixed HEAD of *this* isolated 3path Source after terminal CI; other PR781/787 QR are separate sequential 04 QR-W tasks, do not reQA accepted PR668/680 and do not accidentally stack these draft branches. 09 INT only individually selects independently accepted original Source blobs on latest main (do not Merge QA-only PR). Rollback delete only the three newly added code/test/doc files and private output receipt; preserve previous Native proofs and existing Pages. NEXT continue current Switch exact original image source identification, scoped proof for 3→next useful consumer items, and 08WEB image resolver contract integration only once independently accepted.
