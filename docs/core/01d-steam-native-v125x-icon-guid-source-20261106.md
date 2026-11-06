# 01D CORE / ASSET — Steam native IconGUID source delta, v1.24.13→v1.25.0→v1.25.3

**2026-11-06 / SOURCE_ONLY / DO_NOT_DEPLOY / W-01D-ASSET-IMG-028**

This is a narrow, machine-reproducible **candidate discovery** for v1.25 image updates and a possible later Steam-original pipeline evaluation. It does **not** authorize a Steam-only product migration, imply Switch game image pixel equivalence, read a private P1G, or generate a published image manifest.

## First-party input and version identity

Inputs are **original Steam/Windows itemlist files** from Owner-connected DDVRE Drive, not a text-dump or inferred ItemID mapping. The filenames end in \`*.json\` historically, but their actual payload consists of length-framed protobuf-native records. The extractor verifies exact SHA-256 and raw file bytes before decoding, validates frame key = original ItemID minus the original category base, and reads the original native \`ItemID\`, \`name\` and \`IconGUID\` fields only. Other native fields are skipped, not reinterpreted.

- Steam v1.24.13: \`releases_1.24-v1.24.13-2-ga6fe50c4da68-incremental-33\`
- Steam v1.25.0: \`releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14\`
- Steam v1.25.3: \`releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22\`

Only **ActivityItem/Furniture/Clothing/Trimming** are within this bounded Source check. Exactly 12 binary source files, 4 per version, have their real SHA-256 and byte sizes pinned directly in the local-only tool. No actual game binary, artwork, source filename-to-private-path map, player Save or game media is committed to public GitHub/CI.

To run in a private directory with the original Owner-accessible raw files (never in public CI):

\`\`\`bash
python3 scripts/asset-research/01d-steam-native-icon-delta.py \
  --source-root /private/steam-original-itemlist-three-versions \
  --report /private-local-output/steam-native-v125x-delta-SOURCE_ONLY.json
\`\`\`

Place original files at \`v12413/ActivityItem.json\`, etc. A report destination must be fresh, not a symlink, and **outside** the source directory. All original input files must be regular files, not symlinks. Source SHA/size mismatch, bad protobuf wire/length, duplicate IDs, wrong item-frame key, malformed GUID, duplicate required field, report alias or output collision fail closed. The GitHub CI runs **self-authored synthetic metadata fixtures only**, without copyrighted asset bytes. The \`--synthetic-fixture\` mode marks output \`SYNTHETIC_FIXTURE_ONLY\`, never real asset authority.

## Original source result / bounded triage

For these four categories, genuine raw Steam files were fetched and SHA-read back locally:

| Version pair | Retained ItemIDs | IconGUID changed | New ItemIDs | Removed |
|---|---:|---:|---:|---:|
| v1.24.13→v1.25.0 | 11,862 | **3** | **346** | 0 |
| v1.25.0→v1.25.3 | 12,208 | **0** | **1** | 0 |

Three changed existing ItemIDs: \`30200105\`, \`31200064\`, \`40500164\`. These three and 346 new v1.25.0 rows are candidate source checks only. A retained GUID is **not** proof of unchanged PNG bytes. The v1.25.3 one newly added row is a separate candidate.

Original Owner-local full-source output: \`01d_native_icon_delta_result_SOURCE_ONLY.json\`, SHA-256 \`617cc4815e73bfae18dcb1b148be05d2434f7eb3b2cd0819c62d86827b546464\`. It contains the full bounded candidate list and exact input SHA evidence but must remain in the private local workspace; do not publish as a player-facing item catalog or imply all candidates are player-visible.

**Unknown/NOT_RUN**:
- Switch v1.25.0/BID \`52BD625D9B4E0053\`/schema624 and Switch v1.25.3/BID \`9A239D3DB569756D\`/schema626 same-build, player-facing ItemID→actual original PNG SHA plus released visibility: **0 verified**.
- Steam image payload pixel SHA vs Switch original v1.25 image payload SHA for all 347 new candidates, all 3 changed GUIDs, and retained GUID source bytes: **NOT_RUN**.
- Steam all-category source mapping, native asset bundle GUID graph and incremental 320/512px high-DPI visual evidence: **NOT_RUN**.
- Full R39 original lossless 12,082 images: **NOT_RUN** because 31/32 original PNG shards are not available.
- Product/Native Save Writer/Cloud/Provider/Community Public, CDN operator, genuine hosted item art: **OFF or NOT_RUN**.

## Existing accepted work and authority

PR #620 dual-hash real PNG→lossless WebP160 Python source has scoped independent QA #632 and was selected onto main by **09 INT only** (PR #630). PR #624 private-safe ten-image quality research has scoped independent QA #633 and was selected onto main by **09 INT only** (PR #636). Reuse those acceptances; do not rerun their immutable ancestors or rebuild an independent Reader. Owner-local ten v1.24.13 Switch/Steam original pairs supported keeping Switch for current 160px thumbnails; possible higher-density Steam use remains a research option rather than a licensed/public release decision.

This tool is **source-only**, returns \`targetSwitchOriginalPngShaVerified=0\`, \`publishAllowed=false\`, \`nativeSaveWriterAllowed=false\`, and never emits release/asset CDN paths. Commit and independent QA of this source code do not upgrade real-game visual Source to DEVICE/INDEPENDENT_QA/PRODUCT_OPERATION_ENABLED. 09 INT alone merges after fixed-HEAD independent QA and cumulative CI/Pages, with rollback of only this new source/test/doc set. No existing Pages should be made private.

STREAM / LANE / TARGET / HEAD / CHANGES / TESTS / EVIDENCE / BLOCKERS / NEXT / SSoT: 01D CORE / ASSET / W-01D-ASSET-IMG-028 / standalone main912 branch pending PR / pinned original 12 Steam source files + protobuf-negative parser + protected output / 7 real local Python synthetic-negative tests PASS; independently QA NOT_RUN / local report SHA617cc481… / Switch v1250/v1253 actual image bytes and original R39 shards missing / request new-only 04 QR-W source-contract QA, then 09 INT; continue bounded authoritative current Switch PNG source extraction / Roadmap+Board+GitHub+01D Handoff.
