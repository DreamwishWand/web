# W1 private V2 research runner — isolated operation contract (2026-11-04)

STATUS: SOURCE ONLY. No real P1G in public CI. No product Writer, no Native V3, no original overwrite. Source is a research child of independently accepted PR #412; source-only QA must be renewed for this delta.

## Exact source identity

Switch DDV v1.25.3, independently verified BID `9A239D3DB569756D`, schema626. W1 only: saved map key 155, EventID 2010000021, oneof ItemSpawning, field NextOccurrence. The external build identity is not inferred from schema or source P1G. An intentional future 2126 date is **not** automatically repaired.

## Private-only invocation

Use owner-controlled offline machine and local paths. Inject all secrets through a private execution environment that does not retain command or environment logs. The following variable **names** are required (never publish their values):

`DDV_PRIVATE_CODEC_KEY_HEX`, `DDV_EXPECTED_P1G_SHA256`, `DDV_EXPECTED_JSON_SHA256`, `DDV_EXPECTED_REGISTRY_SHA256`, `DDV_EXTERNAL_PLATFORM` (switch), `DDV_EXTERNAL_FULL_VERSION` (1.25.3), `DDV_EXTERNAL_SWITCH_BID`, `DDV_W1_EXPECTED_OLD_UTC`, `DDV_W1_PROPOSED_UTC`.

From the authorized private checkout:

```sh
cargo run --manifest-path crates/ddv-save-core/Cargo.toml \
  --example w1_private_v2_local -- \
  /PRIVATE/ORIGINAL.p1g /PRIVATE/NEW-ORIGINAL-BACKUP.p1g \
  /PRIVATE/NEW-EDITED-COPY.p1g /PRIVATE/registry-source.json
```

Do **not** pass real P1G, key, decoded document, personal media or edited copy through GitHub, CI, a public chat, a cloud connector or a remote shell. Paths are placeholders, not actual local paths.

## Behavior and evidence

- Source is opened for READ; source/decoded/registry SHA and external version/BID/schema CAS precede every other operation.
- TrustedReadCore owns the eight W1 source-root readset; missing/oversized/typed-invalid mandatory refs deny, even with caller readset empty.
- A separate research SaveSession with a limited event identity witnesses Revision0 CAS, atomic exact-diff of one UTC token and staged SHA, Undo and Redo. Its reference graph is **not** Native-authoritative and cannot enable product Writer.
- The encrypted original is copied to a **new** destination, fsynced (including parent directory on Unix), re-read byte-identically and SHA verified **before** a research edited P1G is encoded. Unix output files are mode 0600. Windows ACL/private-directory retention must be checked independently before any real owner-private run; successful Rust synthetic CI is not Windows ACL evidence. Every output uses create_new; any existing destination or original alias fails. Edited copy is fsynced and re-read via Rust P1G decoder. Original SHA is re-read again at end.
- The PRIVATE Rust CLI now requires a new Node process using independent Node crypto/zlib ZIP32/CRC, immutable source/backup SHA and byte identity, one exact lexical NextOccurrence token diff and full JSON no-other-change check. It reports independent-process PASS only after the child process succeeds. On failed independent verification, encrypted source is unchanged; existing newly created backup and edited-copy files remain quarantined for private inspection and cannot be overwritten by replay. No operation is promoted until an independent 05 QR and genuine owner-private Rust/Wand acceptance.
- The CLI returns only status flags, never raw hashes, timestamps, secrets or paths to stdout.

## Acceptance boundary

The new synthetic CI also launches a distinct Node process against a Rust-produced synthetic edited P1G and denies tampered encrypted copies; this is a cross-process/source regression, NOT true real-P1G V2 nor Product Worker acceptance. Synthetic fixture Rust CI may show Source/CAS/atomic/UndoRedo/backup-before-edit mechanics only. Real private product Rust+browser E2E, bounded WASM heap, Native effective Wetland Grid/default DiffGrid, Tree/Softwood quota and Clock/Actualize cold-load remain separate. JS Worker retains expanded 128MiB fail-closed; Rust 200MiB decoded-only sparse scan QA #437 is **not** encrypted real 200MiB P1G acceptance. ProductOperationEnabled / EditedCopy / NativeApply / OriginalOverwrite = OFF. V4 device only for a documented specific remaining behavior.
