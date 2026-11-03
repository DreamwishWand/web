# Wand-owned shared Rust save core — 01A research Slice v0.1.0

**Research-only. Not a product Writer.** Location: Wand \`DreamwishWand/web\` isolated branch \`research/01a-shared-rust-save-core-20261102\`, \`crates/ddv-save-core\`. No changes to Wand main or Timekeeper PR #8/#11. Owner of shared portable Save Core: **Wand 01A**. Timekeeper 01 CORE supplies research/benchmark consumers; 02 TIME owns W1 meaning and eligibility; 03 WEB owns browser Session/planRevision/UI. This crate is not a rival Timekeeper P1G codec.

## Reused upstream source and scope

Authoritative provenance: private-to-DDVRE research artifacts exported by Owner-approved Drive, **no user profile data**:
- Canonical \`DDV_RUST_PROFILE_JSON_AUDIT_SLICE_FIX1_2026-09-21.zip\` (v0.3.2, Drive file ID \`1z2i8fYl-F2eLDRgRyhSD1r-uff5Y5_hG\`): Rust \`rust/ddv-core/src/json_syntax.rs\` SHA256 \`9ea12b82aead40ae733729e9015d55d9f2f40c0085a683163d0473214d180926\`. This established strict JSON lexical grammar, Unicode-surrogate handling, duplicate keys, decoded token spans and Amount-only memory splice.
- Newer \`DDV_RUST_GAME_DB_REVIEW_GATE_2026-09-21.zip\` (v0.6.0, Drive file ID \`1-LN_Z8G6wKqtk_ChX3Ygky_EdspXlzwx\`, ZIP SHA256 \`6776176b7925cddc0616c49acfa62a3d1e1d2834808a7f11d4af37e57c8c6261\`). It **retains the same strict Rust scanner** and \`profile_json.rs\` memory-only splice, and adds inventory/GameDB research **not needed for Timekeeper**. Historical Windows log: 92/92 Rust/TS semantics, 10/10 synthetic byte preservation; the 608 real decoded JSON was READ ONLY, never P1G output. Do not misreport earlier data as schema626 parity.

This new \`src/lib.rs\` is an **adaptation** of the above std-only scanner/strict validation/token splice, not an exact source transplant: it traverses syntax without building \`serde_json::Value\` or a retained full node tree, collects only explicitly requested RFC6901 selected String Token spans and \`GameInfo.Version\`, and reconstructs an *in-memory synthetic decoded JSON* with unchanged UTF-8 bytes outside the approved span. It is a smaller proof step, NOT yet bounded streaming IO for 200 MB.

## Stable proposed common API

- \`sha256(&[u8]) -> [u8;32]\` for source-bound CAS.
- \`validate_json(&[u8]) -> Result<(),reason>\` strict duplicate-key/UTF-8/number/depth/grammar validation. Root type alone does not authorize a write.
- \`patch_json_string_tokens(source,expected_source_sha256,expected_schema,&[TokenChange]) -> Result<PatchedJson,reason>\`. Strict source SHA; expected old *decoded string* at unique exact JSON Pointer; new String tokens encoded safely; zero change/no-op/duplicate pointer/schema mismatch fail closed; edited JSON independently reparsed; receipt includes exact original/edited SHA and selected byte span. It **does not know W1 ItemID/EventID/oneof semantics** and must never be used as a general product Writer.
- \`match_explicit_build(...)\` separates *external target platform/build identity* and save schema; never infer BID from Version.
- \`RESEARCH_CAPABILITIES {read:true,encode_copy:false,persistent_replace:false}\`. Future rights require separate 01A/05 QR operation gates.
- \`MAX_DECODED_JSON_BYTES=256MiB\` is only an explicit parser size rejection threshold, **NOT** verified browser/WASM memory ceiling nor an authorization to lift existing JS 128MiB inflate cap.

## Next shared contracts and non-goals

Required **separate common engine** phases still OPEN: chunked P1G AES/ZIP/Deflate/CRC and preserved local/central metadata (unknown extras/comments/descriptors FAIL CLOSED); streaming decoded JSON input with bounded queue and sparse Grid/Event projection, without a 200MB full JSON copy; exact byte-span multi-edit and independent *encrypted P1G* cross-reopen against Wand/Timekeeper JS codecs; Web Worker + WASM target runtime (native \`wasm32\` compile alone is insufficient); 16/64/100/200 MB/MiB deterministic synthetic varying compression/Grid/unknown fields and actual Chrome/low-memory peak memory & UI long-task benchmarks. Legacy JS remains immutable baseline and rollback. **Never upload personal saves, original game files, executable data, or change Wand Writer authority.**

02 TIME adapter must bind verified W1 active EventID, saved index, oneof, \`RecurringEventItemID\`, old/new \`NextOccurrence\`, Native ledger and explicit externally selected Switch BID \`9A239D3DB569756D\` / schema 626 to selected Pointer, and then call common core only after a trusted operation review; unknown W1 subtype/Moonstone/quest/duplicates rejected. Common parser never claims semantic eligibility.

03 WEB future port: typed \`open/queryPaged/planCAS/validate/encodeCopy\` messages bearing Worker-owned \`sessionId\`, \`planRevision\`, \`sourceSHA\`, explicit \`targetBuild\`. Do not return raw giant profiles to UI. Old original-first/edited separate download remains; stale Session/Revision reply discarded. 05 QR validates actual browser WASM, field-only parity, source SHA/unknown preservation, P1G independent reopen and OOM denial at advertised size before switching product engine. Direct overwrite and automatic 2126 normalization permanently excluded.
