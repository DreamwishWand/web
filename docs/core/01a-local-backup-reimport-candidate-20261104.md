# 01A CORE — reimported original-backup candidate byte check (2026-11-04)

## Problem
The accepted single Worker Session can request an untouched original P1G download, but a browser download request is NOT proof the OS wrote the backup. Before product edited-copy V2 is ever considered, separate local original-first backup evidence is needed.

## Safe new READ-only contract
Explicit caller-supplied Blob, via `verifyUserSelectedOriginalBackupCandidate(candidate, scopedReceipt)`. The accepted SingleSaveSession Worker remains sole source owner, and the bridge keeps only the original browser File reference, never decoded data.

- Require the exact active SessionID, Worker source SHA, Revision0, IndexGeneration and the same source handle. Deny unknown scope keys and stale A→B/close/destroy, including source change mid-await.
- Require user explicitly reimport a **distinct Blob object** of equal bounded size. Compare bytes against the local originally selected File chunk-by-chunk, 1MiB at a time; no second entire 128MiB buffer, no cloud upload, no keys, no private data in URL/log. Any difference denies.
- Return only the known source SHA and compared byte count with `candidateBytesMatchOriginal:true`, but `persistedVerified:false`, `distinctDiskPathVerified:false`, `originalOverwriteProtectionVerified:false`, `writerAuthorized:false`. A separate Blob identity is not proof of a distinct underlying file path or durable independent OS backup.
- No automatic file export or any product editing command; all Writer / EditedCopy / NativeApply / original overwrite flags unchanged and OFF.
- Scope is a future optional local UI verification action; 08 WEB must not claim successful filesystem persistence from it and must not auto-upload P1G to Supabase. No public state/feature flag change.

Tests: 1MiB+13 synthetic Blob across chunk boundary, identical candidate positive but persistence remains explicitly false, same-object/size mismatch, 1-byte mismatch, forged SHA/session/revision/gen/Writer bit, stale A→B/close, and a pending asynchronous chunk invalidated during source switch. Existing W1 Preview, backup-download and original hashes retained. New independent 05 QR changed-scope required after Owner CI. No genuine private P1G in GitHub CI; this does not upgrade product Rust operation V2 or Native V3.
