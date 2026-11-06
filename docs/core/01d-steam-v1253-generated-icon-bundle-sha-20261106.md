# 01D CORE / ASSET — v1.25 Steam original generated-icon Bundle byte reuse

2026-11-06. W-01D-ASSET-IMG-028. **SOURCE_ONLY / NO PUBLIC ART / NO STEAM MIGRATION DECISION**.

## Original provenance and motivation

Steam/Windows original DDV installation contents are present in Owner Drive; these are two distinct *original game versions*, not versions inferred from Save schema:

- `v1250`: `releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14`
- `v1253`: `releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22`

Both have the authentic Unity Addressables `ddv_Data/StreamingAssets/aa/win/ui-images-generatedicons_assets_assets` folder. To narrow what must be regenerated for an update, 01D locally downloaded and compared the **entire raw first-party UnityFS original** bytes for three named generated-icon bundles, SHA-256 independently read from each of the two versions. These are actual original Bundle bytes, not decoded textures, image GUID lookups, or historical lossy thumbnails.

| Native original bundle | v1.25.0 original bytes | v1.25.3 original bytes | Independent SHA256 both originals |
| --- | ---: | ---: | --- |
| `flower_584a9f69.bundle` | 3,784,859 | 3,784,859 | `e7cbd3f2c08f13bcca84e58ec96cf519ef566cb2061c5ae6fe3d65a612b97770` |
| `seed_8c733f88.bundle` | 6,372,358 | 6,372,358 | `3650906d8318350dd35944ddbcf67f4616e11c37e544ab379a48faa059514e3f` |
| `meal_7a31d699.bundle` | 24,835,033 | 24,835,033 | `9770b0d4980da18332bf1870f7fdb0969cc88046d769e25316b0663cdf47ccf5` |

**Result: 3/3 identical full Bundle bytes** — 34,992,250 original bytes in each version were all SHA-identical. The matched original Bundle payload is safe to **reuse as an original source candidate** for this Steam version pair, rather than re-extracting unchanged pixels. This is stronger than a mere same-`IconGUID` check, but narrower than a version-specific whole-catalog approval.

Local source-only report `/mnt/data/01d_steam_1250_to_1253_bundle_source_only.json` SHA256 `132390e99555918e78eca5e7bab86ed7364dc1d9b2865e0c19277948722181c5`. The original six copyrighted .bundle files remain exclusively private-local. **DO NOT upload them or decoded art to public repo, CI or cloud.**

## Implementation contract

`scripts/asset-research/01d-steam-bundle-byte-identity.py` is an offline first-party Source verifier with pinned expected SHA+byte size for these three named bundles and two original game versions. Source root layout must be `v1250/{flower,seed,meal}_*.bundle` and `v1253/{...}`, with exact filenames from the table above. Run only in the Owner-authorized local source environment and emit a new report **outside** the original source root:

```bash
python3 scripts/asset-research/01d-steam-bundle-byte-identity.py \
 --root /private/original-steam-bundles \
 --report /private-output/steam-v1253-identical-bundles-SOURCE_ONLY.json
```

Input is SHA-verified in chunks and bounds-checked. Missing original, non-regular or symlink path, unexpected bytes/SHA, unsafe filename, changed bytes with same size, preexisting output/alias/symlink, or attempted output inside the input root fails closed or explicitly reports `reuseSourceBundleCandidate=false` only for a synthetic testing mode. Private inputs are never overwritten; all output is SOURCE_ONLY JSON. CI uses **seven self-authored synthetic negatives**, with no original Bundle.

**Important source boundaries**:
- 3/3 Bundle exact identity means **only** that all content carried in these three original Steam Bundle files is identical across the *Steam version pair*. It does not prove which ItemID is linked to which native texture (Addressables graph still unverified for these specific versions).
- Other **37/40** generated-icon Bundle files are **NOT_RUN**, especially `furniture_a1c425a5.bundle` which has different file byte size in the two source installations. `clothing_27c843ba.bundle` actual hash not yet compared, though its reported file size is equal. Same length does not imply identical bytes.
- v1.24.13→v1.25.0 originals were NOT byte compared here. Full 40-Bundle / 12,082 item original source coverage and all-content migration NOT_RUN.
- No original **Switch** v1.25.0/BID `52BD625D9B4E0053`/schema624 nor v1.25.3/BID `9A239D3DB569756D`/schema626 original ItemID→IconGUID→original PNG SHA/released visibility positive proof. Target positive remains **zero**.
- The owner-local 10-pair original Switch/Steam v1.24.13 160px quality study favored `KEEP_SWITCH` at 160px, with Steam high-density future options; this Bundle identity result does not authorize global Steam original-source unification or resolve Rights/Operator/real-asset publication.
- Old historic 32 lossily encoded R39 WebP copies never substitute for 31 missing original R39 PNG shard ZIPs; full 12,082 lossless variant not generated.
- No Native Save Writer/Cloud/Community public enablement. 09 INT merges only exact independently accepted Source paths after current protected main CI/Pages; no original game binaries to deploy. Rollback: revert only research code, docs and test paths.

STREAM / LANE / TARGET / HEAD / CHANGES / TESTS / EVIDENCE / BLOCKERS / NEXT / SSoT:
01D CORE / ASSET / W-01D-ASSET-IMG-028 / main1847a3b1 parent, separate Source research draft / three original Steam v1250-v1253 full-Bundle SHA match, script + negatives / owner-local six original SHA matching 3 pairs, 7 synthetic negative PASS; independent QR NOT_RUN / SHA132390e9 report, PR data / 37 Bundle pairs, Switch original current SHA and real public media remains UNKNOWN/NOT_RUN / QR changed-only scope then 09 INT source-only merge, continue original Bundle diff and versioned per-item ImageID / Roadmap, Board, 01D Handoff, GitHub.


## 2026-11-06 — QA653 TRUE RED and exact-source evidence update

Independent 04 QR-W QA-only PR653 at old Source `951dfce0c3b753585c6f82709059c09180079544` found TRUE RED: imported `analyze(root, externally_chosen_pins, synthetic=False)` accepted six fabricated fixture bundles whose attacker-provided SHA and size matched themselves, then labeled the result `REAL_STEAM_ORIGINAL_BUNDLE_BYTES_SOURCE_ONLY`. This was **provenance confidence mislabel**, NOT a game-art leak or public image/Writer gate bypass. Historical red is retained.

Narrow Source correction: immutable `MappingProxyType` wraps the original three known-good SHA+size Bundle pins; any `pins is not BUNDLE_PINS` override is rejected when `synthetic=False` with `ORIGINAL_PIN_OVERRIDE_FORBIDDEN`. Foreign fixtures only work when `synthetic=True`, always tagged `SYNTHETIC_ONLY`. Nine self-authored Python negatives now include a direct reproduction of the independent QA653 forged self-signed SHA scenario and attempted pin mutation. Reuse the earlier unrelated QR acceptance for unchanged codec/no-clobber and v1.25 Item-definition source; request new changed-HEAD differential QR for this source only after Owner CI.

Separate, independent OWNER-LOCAL real source discovery continued without changing the packaged three-pin verifier. Of the 40 original Steam `ui-images-generatedicons_assets_assets` Bundles each from v1.25.0 and v1.25.3, **39/40 same named source bundles have now been fetched for both versions and full SHA-256 compared, all 39 pairs byte-identical**. The original three pinned Bundles are included in that count. Additional read-only original-source evidence is retained private-locally:
- 11 original pairs, `steam_additional_11_bundle_pairs_source_only_20261106.json` SHA `4b225a6c3ed9443a569a3a33b87b9b76da44013bacda3bab1088872d73912549`;
- 19 original pairs, `steam_additional_19_bundle_pairs_source_only_20261106.json` SHA `dfc37920016a3b327b5ff90901c8a5fc9fd657a84293dd20b7fe2e70a0632475`;
- 5 original pairs, `steam_additional_5_midsize_bundle_pairs_source_only_20261106.json` SHA `08e1b50af6b4256940e6857d1174c1344429851ff95c7cc4ca7c2b7d5a256895`;
- exact original `clothing_27c843ba.bundle` 175,977,709 bytes in EACH version, SHA-256 BOTH `f81a952b879a5a7d5bc4c12469fc3929bed47273cb9190088174f03026400671`.

The sole remaining generated-icon bundle is `furniture_a1c425a5.bundle`, v1.25.0 original size 249,376,337 bytes and v1.25.3 original size 249,369,620 bytes. Thus the **same full Bundle cannot be reused** for that pair (size difference); a per-Texture2D diff, raw SHA and ItemID mapping are still **NOT_RUN**. Its v1.25.0 original was fetched for comparison, but the 249 MB private-local copy/SHA workspace failed, so do not report two original source SHA values for it or a specific changed item count. No source archive/art bytes are uploaded.

This 39/40 equality is **Steam source Bundle-only** original byte identity, not per-item Texture graph, Switch original same-BID PNG content equality, player-facing visibility, licence or permission for public CDN. The app's Switch ItemThumb160 source remains unchanged. Existing product/Provider/Cloud/Community Public and Native Save Writer gates remain OFF. The Source verifier intentionally stays bounded to its original three immutable Bundle pins, and this broader offline study requires its own independent genuine-source QA before any product launch attribution.
