# W-CORE-RUST-SESSION-068 — 01A R03/R04 Stage A (Writer OFF)

## Source / dependency
- Protected main baseline: `7ca7369bc3cd9e12e4cbbe7a7815789e14432e25`.
- Accepted ancestor: R02 Rust ProductSession PR698, R04 nine original Source paths PR711, independent 05 QR-C QA707 (synthetic BigInt Q01–Q03 only). Reuse this evidence; do not merge/re-QA old research PR530/475/500/512/458/466.
- Change ONLY existing Rust ProductSession's **Worker ownership path**: add a guard around the *same* session, no new SessionID issuer, revision/generation, readset, registry, Worker or reader implementation. Existing live JS Worker and UI remain unchanged.

## Concrete Worker authority
- `WorkerSessionGuard` holds one `Arc<ProductSession>` with exactly the original Rust-owned SessionID, revision, index generation and **decoded JSON** SHA-256; `receipt/dispatch` delegate to the original ProductSession mutex/CAS and fixed readset `/GameInfo/Version`.
- `WorkerWasmSource` owns `WorkerSessionGuard`, not a second separate Rust session. Successful `finish` adopts the exact original validated ProductSession. Explicit CLOSE and WASM owner Drop revoke the same authoritative ProductSession. A borrowed internal Arc cannot revive it.
- Drop clears pending source buffer and entropy; decoded Arc is dropped with owner unless retained by internal code, in which case the shared ProductSession is already closed. No claim of guaranteed physical memory zeroization.
- No change to original 128MiB/chunk1MiB caps or strict full-document grammar checks. `productReadAccepted=false`, `allDomainReferencesVerified=false`, `writerAuthorized=false`, `canApply=false`, `canExportEditedCopy=false`.

## Native negative acceptance
Five new tests in `crates/ddv-save-core/src/worker_session.rs`:
1. Guard retains exactly one Rust SessionID/decodedSHA/Rev0/IndexGen1; Core-owned read witness only.
2. Fake SessionID, SHA, old Revision, wrong IndexGeneration, contract, ReadDomain, Stage, ExportEditedCopy, Apply, overwrite all rejected without revision change.
3. Explicit Close revokes the guard and an internally borrowed Arc, and double-close denied.
4. Dropping Worker guard **without** explicit Close revokes an outstanding internal Arc.
5. Concurrent read and Close linearized by same ProductSession mutex; all post-close accesses denied.

Normal native cargo tests + `wasm32-unknown-unknown --features worker-wasm` compile are required. Public source CI must not contain any personal Save, keys, actual plaintext, media, or altered Writer settings.

## Evidence limits / Gate
This is **SOURCE_ONLY / SYNTHETIC native and WASM compilation**. The generated wasm-bindgen JS bundle and actual Browser Worker imported runtime, real Steam encrypted P1G product full-Document ref closure, V2 original backup→separate edited-copy→independent-process reopen, and V3 same-build Native semantics are **NOT_RUN**. An externally attested string is not independent build proof. 100–200MiB actual browser no full JSON UI transfer is not yet validated.

## Integration Ready / rollback
01A Source HEAD + Owner CI; 05 QR-C independent changed-only Worker drop/borrowed Arc + WASM compile and fail-closed negatives; 09P-CODE changed-risk ABI only if needed; **09 INT alone** selects exact three Rust sources against then-current main and runs cumulative CI/Pages. Rollback exact three changed paths, preserve accepted R02/R04 source and legacy JS read UI. Writer/Cloud/Provider/Community/Public flags OFF.

**Next distinct task**: Stage B product Rust old-value CAS, Indexed ReadSets, Atomic ChangeSet, original backup→one-time separately named edited copy, independent decode/Reopen, with 05 QR-L on owner-private Steam Save only after explicit operation/version gate. Stage A is not V2 acceptance or Writer authorization.
