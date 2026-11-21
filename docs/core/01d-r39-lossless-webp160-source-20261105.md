# 01D R39 Item image lossless WebP160 — original PNG provenance (2026-11-05)

## Owner authority and exact scope

The latest Owner directive supersedes R39 quality88 lossy WebP as a shipping format: **lossless WebP from canonical lossless source PNG** is mandatory. The old R39 WebP quality88/alpha preserved is lossy, as confirmed by the original R39 README and derivative manifest; its 12,082 successful decodes are historical integrity evidence, not evidence of pixel exactness. Owner GO for public DDV item artwork remains recorded in Issue #604, but licence status is UNKNOWN and new technical/QA/Pages and operator gates remain.

**This PR is source-only conversion tooling, not a deployed image bundle.** New output URI variant: `ddv/item-images/webp-lossless-160-v1/v1.24.13/<SHA5bit shard>/<SOURCE_PNG_SHA>-<ENCODED_LOSSLESS_WEBP_SHA>.webp`, isolated from old R39 `ddv/item-images/v1.24.13/.../*.webp` quality88 cache. No 08 WEB release `manifest.json`, `VERSION_VERIFIED`, `WEBP_VERIFIED_160`, current-target positive mapping or public image asset URLs are generated.

Source input: DDVRE Drive `portable32` folder `1X8gGlyzIKZ5ASdyegPR9jh39O-VIzSam`, original portable manifest gzip SHA `f0ea2248bc7a91d9a8afb655bf142150798aa96fbde1fd91ae028927b4ef3aba`. This folder currently exposes original PNG source shard `00` only; source shard ZIP SHA `816feb3090a4880dd2752b6dbb3db1ffbacd6abb6b92b3f3d1983d9c24937ba6`. Other 31 original portable32 PNG ZIP files were not found in the folder. The historical 32/32 WebP88 ZIPs are *lossy derivatives* and cannot be used as replacement lossless source.

## Local original-source result (only shard 00, all original bytes verified)

- Source PNG `shard_00`: original ZIP bytes 20,805,294; hash pinned and ZIP CRC clean; **361/361 PNG** filenames match their original raw PNG SHA-256.
- Transcode: Pillow/libwebp `lossless=True, exact=True, method=4`, RGBA conversion and LANCZOS thumbnail with max 160×160; re-decode and full `RGBA.tobytes()` exact equality for **361/361** (including alpha and invisible RGB).
- Output distinct lossless shard ZIP: **6,084,946 bytes**, exact SHA `b848645b2a6379f4b7a5bc3979225064d295246452254eb38e852024808e866a`; ZIP CRC clean.
- Encoded image payload sum **5,972,292 bytes**, compared with 2,469,772 bytes for the same 361 old lossy WebP88 icons (**2.418×**). This measures only shard00, **not** a full-12,082 runtime or total CDN cost.
- Original image dimensions observed 256×256, 512×288 or 512×512; 55/361 have 512px source width, potentially allowing high-density originals. No automatic 320px WebP output or retina acceptance has been run.
- Local observed report SHA `7bab34195a9d6641ca82f8878092e19cdc6f54caace20691de263668d75309e1`, local initial builder SHA `2a39e811fdf96bbe13c5e85d765e9d1dbbc6814e91109cdb47746ebf4ca3e4de`. The reproducible repository builder is a narrowed source-only implementation of the same sha/CRC/codec/exact-pixel algorithm, not byte-for-byte equal to the separately retained local pilot script.

## Running / Gate

```sh
python3 scripts/01d-r39-lossless-webp160.py \
  --manifest /path/to/DDV_GAME_ASSET_PORTABLE_MANIFEST_v1.24.13.json.gz \
  --png-dir /path/to/portable32 \
  --out /private/local/r39-lossless160
```

The manifest is strictly SHA-pinned, each source PNG ZIP size/SHA/CRC and per-file PNG SHA/shard checked, and every derivative's decoded RGBA bytes compared with LANCZOS-resized original. Without all 32 source PNG ZIPs the output declares `completeR39Lossless=false`; `--require-complete` fails closed rather than falsely claiming a 12,082 asset pack. Do not upload genuine image bytes to CI, public repo, or Pages solely to support this test. Do not promote target v1.25.0/schema624 or v1.25.3/schema626 by same ItemID; need original target icon GUID/PNG digest and release visibility proof.

## Dependency & QA

- **01D ongoing**: recover remaining 31 original lossless PNG shard ZIPs via genuine local source/approved Drive transport; one-time bulk transcoding only from lossless PNG; target v1.25.x *incremental PNG source hash* additions/changes (not regenerating all unchanged outputs repeatedly). Original 16 missing IconGUID are separate.
- **08 WEB**: align PR609 shared ItemThumb image URI/manifest with lossless variant namespace and per-item SHA+codec verification. Old lossy URLs must not silently be reused.
- **04 QR-W**: independently verify `lossless=True`, `exact=True`, PNG original source SHA/ZIP, exact RGBA roundtrip and negative corrupt/missing source; evaluate current target denial and 8locale/320/200 actual hosted display later. Fixed Owner code HEAD and actual image bytes gated separately.
- **07 DBK**: operator takedown/hide/hash purge, attribution and real contact, not an extra demand to renegotiate Owner-approved image policy.
- **09 INT**: sole main merge and Pages release; separate cumulative CI and genuine hosted asset receipt. No P1G/Native Writer/Cloud/Community Public effect.

**State:** original R39 partial lossless encoder ready, local 361/361 verified, remaining 11,721 PNG sources (31 shards) not present in Drive folder, full pack NOT_RUN, published lossless Manifest NOT_GENERATED, v1250/v1253 target original source same-build binding UNKNOWN, public Pages art NOT_RUN. `PRODUCT_PUBLIC_IMAGE_DEPLOYED=false`; personal Owned/Discovered/Missing UNKNOWN and denominators NULL. 

## 2026-11-05 final 01D producer/08 WEB consumer path ABI correction (new-only)

The already independently accepted offline original PNG→VP8L/alpha-equivalence converter PR620/QR627 originally packed `<sourcePngSha256>.webp`, but the independent 08 WEB accepted ItemThumb PR609/QR626 requires `<sourcePngSha256>-<encodedWebpSha256>.webp`. This is a real cross-stream integration mismatch: **it would prevent published WebP paths from resolving** even if the decoded image was correct. This change computes `encoded_sha=sha(encoded)` from the actual encoded WebP bytes and emits the immutable dual-SHA member path exactly matching the 08 WEB consumer. SHA5bit shard still derives from original PNG SHA; original `sourcePngSha256`, `losslessWebpSha256`, and `path` remain in SOURCE_ONLY report for exact negative checking. No target `VERSION_VERIFIED` or public manifest is emitted, and no URLs are deployed.

**QA delta vs old accepted PR620 HEAD218cf197**: only path+record digest and direct tests require new changed-only independent 04 QR-W; reuse the prior fixed-HEAD QR627 actual Pillow/libwebp+synthetic original-equivalence PASS for unchanged converter, original SHA/CRC checks and `--require-complete` preflight. The real R39 shard00 PNG contains 361 original-source images; previous old pilot ZIP filename remains old source-only proof, **not a dual-SHA production pack**. A new package requires full re-run and report SHA at the changed source HEAD. Other 31 original PNG input ZIPs still absent; 12,082 lossless full set NOT_RUN. Real v1.25.0/schema624 and v1.25.3/schema626 per-item IconGUID→original PNG content/version/visibility original mapping still 0 verified; public image bytes/Pages/Native Writer all OFF. 09 INT alone may integrate scoped code after new QR and cumulative CI; it cannot substitute inherited QR627 proof for this changed output contract.
