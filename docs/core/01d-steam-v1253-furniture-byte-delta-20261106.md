# 01D CORE / ASSET — Steam v1.25.0→v1.25.3 furniture Bundle bounded byte delta

W-01D-ASSET-IMG-028, 2026-11-06. **SOURCE_ONLY / NO ORIGINAL GAME MEDIA IN REPO / NO IMAGE OR SAVE WRITER RELEASE**.

Owner-private, unshared original Steam/Windows UnityFS furniture_a1c425a5.bundle metadata was independently rechecked in version-separated first-party Drive folders:

| Source | External original FullVersion | Original Drive metadata size |
| --- | --- | ---: |
| v1250 | releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14 | 249,376,337 bytes |
| v1253 | releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22 | 249,369,620 bytes |

**Confirmed metadata size difference: -6,717 bytes.** This rejects whole-Bundle byte identity/reuse across versions, but **does not identify any changed texture, ItemID, image GUID or player-visible artwork**. No raw file SHA, per-Texture2D extraction or Switch v1.25.x original PNG SHA has yet been established. Existing separate owner-local 39/40 same-sha Steam bundles and independent SOURCE_ONLY research validation remain unchanged.

The new script scripts/asset-research/01d-steam-furniture-stream-delta.py reads only locally available version-separated originals in 1MiB chunks. It pins observed whole-file sizes and Steam version strings, rejects unexpected version keys, changed size, symlinks, nonregular sources and input mutation during streaming. It records local SHA and coarse **aligned byte chunks**, without copying source content or decoding textures. Alignment after a size change may make many chunks differ: differingAlignedChunks is **never** changed-texture count. The script does not self-attest first-party provenance from a path or size: even after a local full read its tier is LOCAL_SOURCE_BYTES_UNATTESTED until independent original-byte provenance and hash witness. External sizes are overridable **only** in synthetic testing mode, which must remain SYNTHETIC_ONLY (historical QA653 negative). A report is created exclusively at a new output path outside the original source root. Inputs and existing reports are never rewritten.

Run only inside an explicitly authorized private source executor after placing both originals under v1250/ and v1253/ with their exact native filename:

    python3 scripts/asset-research/01d-steam-furniture-stream-delta.py --root /private/steam-furniture-originals --report /private-evidence/steam-v1253-furniture-byte-delta-source-only.json

Current genuine original SHA / real 249MB file read: **NOT_RUN**. Local and CI synthetic assertions only exercise source code. If the private local streaming report succeeds, compare changed UnityFS blocks and then perform a separate bounded Texture2D and exact ItemID-to-address mapping for the two exact versions. Never infer individual image change count from raw aligned chunks. Exact Switch BID+schema original PNG/visibility positive remains zero. Do not put originals, textures, decoded Save, personal paths or game art in GitHub, CI, Pages or external logs.

All Steam whole-catalog migration, hosted game art, Native Save Writer, Publisher, Cloud and Provider flags remain OFF and separately gated. Rollback: revert only these four standalone script/test/doc paths. Independently QA only the new four-path fixed-HEAD delta with eight negative tests; reuse PR650/QA654 accepted ancestors without re-QA.
