# 01A / W-CORE-004 — Product Rust ABI boundary, R02/R03 (Writer OFF)

Base: protected main `5bc658f119aec1d08138e10bf8294700c74bd700`.
Source package: new Rust `crates/ddv-save-core` and dedicated CI only.
Scope: **SOURCE_ONLY + SYNTHETIC native**. No research PR #530 ancestry/QA branch merge.

## Ownership and concrete behavior
- One Rust-minted 128-bit ProductSession ID guarded by a shared Mutex for read and close. No separate TrustedReadCore/Stage ID or UI-created authority is accepted.
- Revision=0, IndexGeneration=1, decoded source SHA-256 are mandatory on every WorkerEnvelope. Stale/forged field fails before dispatch.
- Full streaming JSON grammar scan rejects duplicate keys (including nested) and requires GameInfo.Version 626, Player and World objects. This is **NOT** 11-domain Native reference closure; no whole JSON Value allocation.
- Version registry accepts pinned Switch BID 9A239D3DB569756D or Steam FullVersion releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22 as **static candidate only**. Caller attestation is NOT independent actual device/build proof.
- Only Core-owned /GameInfo/Version read witness is dispatched. No dynamic UI ReadSet/Inventory/World query/Stage/Export/Apply/overwrite; these all deny.
- Close serializes against dispatch and permanently revokes authority; poison fails closed. Browser WASM entropy, Worker bridge integration, P1G decrypt and productReadAccepted remain explicitly FALSE/NOT_RUN.

## Exact negatives in `product_session_abi.rs`
Wrong build/platform/schema; forged external assertion; required root missing; nested duplicate keys; invalid JSON/UTF-8; forged SessionID, Revision, IndexGeneration, source SHA or contract; unauthorized read domain; Stage/Export/Apply/Overwrite; threaded Close vs dispatch and post-close read.

## Integration / QA gate
- 01A provides immutable Source HEAD + Cargo native test CI. Existing 09P-CODE E670 static26/26 and research PR530 Owner6/6 / independent 05QR-C QA538 limited scope reused **without rerunning**.
- New 05QR-C must independently verify only this ABI delta, worker contract impact, full-document duplicate/negative and Close race. No assertion of genuine P1G Product V2.
- 09 INT exclusively selects accepted Source into latest main (check other Worker/ABI and Cargo collisions), cumulative CI/Pages; never copy full prior research stack.
- Rollback removes only this isolated crate/CI/workflow; existing JS Worker remains unchanged (128MiB boundary).
- Next R04: actual single Worker/WASM binding, Core authoritative indexed read set, one-time backup -> distinct edited copy -> independent process reopen with CAS/diff/unknown preservation. R05 genuine owner-private Steam V2 via 05QR-L. Native V3 separate 01E. Writer/Cloud/Provider/Community/Public flags OFF.

Evidence classification: `SOURCE_ONLY` until new fixed-HEAD CI; **not** OFFLINE_EDITED_COPY_VERIFIED, Native V3, DEVICE or Product Writer.
