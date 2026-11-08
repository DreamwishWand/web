# 01B CORE — R06 Native Area/Grid Census Concordance (2026-11-08)

Task: W-NATIVE-005 / R06; Operation: DEV_READY / SOURCE_ONLY_SYNTHETIC / PRIVATE_NATIVE_CENSUS_ONLY. Writer OFF.

## Starting dependency / accepted ancestor
- 09 INT PR #817 exact Rust11 selective protected main `8358ce24f0b7e35a1a9707561924f210c27ae265`. Protected Verify `42480071636`, Pages `42480071634` Build+Deploy all SUCCESS.
- 01A Source PR807 fixed `21e709cdc213080539094cd394a342384152ac76` / 05 QR-C QA #811 SCOPED_PASS.
- 01B Source PR808 fixed `e219f505d819fa87a7916cef221496ae5db1ebfd` / 05 QR-C QA #814 SCOPED_PASS. Existing accepted parent/cycle/duplicate/Footprint/bounds tests and ProductSession/indexed read are not repeated.

## New change: 01B-only correlation, NOT another Reader
`SpatialCandidateIndex::compare_core_native_area_grid_census(&ProductSession, SpatialScope)` is compiled only with the pre-existing native-only `private-native-v1` feature (which implies `indexed-read`). It invokes 01A's already-accepted `ProductSession::verify_native_area_grid_slice(ReadDomain)` using the SAME session, revision, generation, SHA and native mutex, not a new Save parser, Reader, Codec, executor or Worker route. The 01B index retains bounded candidate area/grid/object counts and direct Area→Grid link count. The native scanner's source-derived village/area/grid/link/per-Grid-object cardinalities must agree. Dangling/duplicate/noncanonical source Area/Grid/ObjectID identities are rejected by 01A before the receipt exists; stale scope or closed session rejects.

**Critical limitation:** equal counts do NOT prove the candidate Area/Grid/Object IDs equal the original Native source records, and none of the proposed footprint dimensions, GridData bounds, orientation transform, Root/SubGrid geometry, or actual Build platform is authenticated by this API. A synthetically forged ObjectID with matching counts is an explicitly accepted *count-only* diagnostic but produces `candidate_native_ids_authenticated=false`. Fields `source_platform_provenance_verified`, `native_footprint_bounds_verified`, `full_native_reference_closure_verified`, `product_read_accepted`, `writer_authorized` remain false. Source platform mismatch must never be promoted by an external Build declaration. This method is not a new product read or V3 gate.

## Scope
Original PR820 four paths; repaired PR820 adds exactly one narrow 01A-owned native-only Build accessor in `crates/ddv-save-core/src/product_session.rs`. Existing four paths:
1. `crates/ddv-save-core/src/spatial_reference_index.rs` — private count correlation against same 01A ProductSession; opt-in candidate counts.
2. `crates/ddv-save-core/tests/spatial_native_census.rs` — source-synthetic actual native lexical scan positive and stale/foreign/closed, mismatch, forged-same-cardinality negatives.
3. `crates/ddv-save-core/src/lib.rs` — feature-gated native-only receipt export.

No direct change to 01A `native_reference_slice.rs`, the existing Indexed Read parser, Rust Worker contract, Worker, browser WASM, P1G Codec, Road/Fence semantics, 01E producer/consumer, SQL/UI, flags or published Pages. No private Save, decoded JSON, keys or native binaries included.

## PR #822 TRUE_RED repair: Platform / Build binding (2026-11-08)

The initial Source HEAD `5e4985c9a8537d0b1c2ba38d0e7f27ee22c94c74` failed independent 05 QR-C PR #822 fixed `8b0faaafc0a26b555ae1d4cb6a3822498c44c860`: an otherwise-valid Switch Spatial candidate and a Steam ProductSession (same schema626, same serialized JSON and counts) were fused into one successful census. This is a **TRUE_RED** and the old Source HEAD must NEVER be merged.

**Minimal fix across five changed source paths:** 01A-owned `product_session.rs` stores the externally declared, registry-validated `BuildIdentity` at ProductSession-open time, **only** under the existing native-only `private-native-v1` feature. The crate-private `verify_native_source_build_matches` checks exact Platform, BuildKind, BuildID/FullVersion, Schema, externally-attested marker and live SessionID/Revision/IndexGeneration/decoded SHA/ReadDomain before any 01A scanner call. No native Build string leaves Core or becomes an attested game-file claim. 01B `SpatialCandidateIndex` retains its originally validated candidate Build declaration only for this native feature, calls the 01A matcher first, then invokes the accepted native Area→Grid census scanner; a mismatch throws `SPATIAL_NATIVE_BUILD_IDENTITY_MISMATCH`. No second Reader/Codec/Parser, no default product/Worker/WASM ABI change.

The repaired Source tests additionally exercise Steam Session + Switch candidate with identical JSON+schema626 and require ERROR; valid Switch+Switch scope PASS; wrong same-schema BID/FullVersion at ProductSession open denied. Old QA #822 TRUE_RED remains historical evidence; new fixed HEAD changed-only independent 05 QR-C required. **Six existing receipt flags remain false** even when counts match; non-cryptographic Build equality is only a mandatory negative gate, NOT positive proof of actual Save origin, Native IDs, GridData geometry, V3 or Writer.

**Rollback:** restore only `product_session.rs`, `spatial_reference_index.rs`, `spatial_native_census.rs`, `lib.rs` to pre-PR820 main and delete this PR820 document if introduced. Do not revert or modify protected main PR817/PR823, 01A Native AreaGrid/FloatingIslands scanner, or accepted prior 01B/QA source. Writer, Apply, cloud and public flags remain OFF.

## QA / Gate / NEXT
Owner targeted `cargo test --manifest-path crates/ddv-save-core/Cargo.toml --features private-native-v1 --test spatial_native_census` and current Rust native CI + default/WASM ABI + full normal CI. Source CI does not imply independent QA. New 05 QR-C changed-only independent Source HEAD QA, then 09 INT only selective integration, cumulative protected main CI+Pages. Keep PR807/811 and PR808/814 accepted ancestry.

01A NEXT: a trusted source-minted typed ID witness/readset must bind true original Area/Grid/SubGrid/ObjectID and Build identity into its ONE ProductSession. 01B NEXT: genuine same-build GridData/Footprint/Bounds and hierarchy; 01E Native V3 consumers/producers. Until verified all Writer/EditedCopy/Apply/Cloud/Provider/Community Public/prod flags OFF; 05 QR-L genuine edited-copy V2/V3 operation separate.

Rollback (repair version): revert original `spatial_reference_index.rs`, `product_session.rs` and `lib.rs` changes and delete the new PR820 test/document files only. Preserve protected main8358 existing 01A/01B accepted Source and public Pages.
