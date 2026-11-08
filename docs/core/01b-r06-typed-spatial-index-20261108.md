# 01B CORE — R06 typed Spatial candidate graph / 2026-11-08

Task: W-NATIVE-005 / R06. Owner policy EFFICIENCY_FIRST_OWNER_20261107.
Operation: DEV_READY — SOURCE_ONLY/SYNTHETIC candidate graph, NEVER PRODUCT_OPERATION_ENABLED.

Build isolation: Switch DDV v1.25.3 / externally declared BID `9A239D3DB569756D` / schema626 only. Steam schema626 FullVersion, older Switch schema624 and unsupported build are rejected. Schema is not evidence of BID.

## Scope and boundary

- New opt-in Rust `SpatialCandidateIndex::validate` under existing `indexed-read` feature; exported types in `lib.rs`. No new Reader, Codec, WASM Worker message, cursor, SessionID mint, Save decoder or Executor. Native Source data is NOT yet authenticated by this function.
- Validates bounded, typed *candidate* Area→Grid roots and scoped descendant SubGrid graph, qualified (GridID,ObjectID), parent/backreference, duplicate keys, reachability, cycles, 0–15 orientation syntax and axis-aligned proposed footprint rect within supplied proposed grid bounds using checked arithmetic.
- The proposed grid bounds/footprint are supplied input assertions, NOT derived from actual same-build GridData/DefaultLayout, orientation/collision/terrain/Native footprint. Exact native geometry remains UNKNOWN and all editing/Writer OFF.
- All returned witnesses `source_session_authenticated=false`, `native_layout_verified=false`, `product_read_accepted=false`, `product_writer_authorized=false`, `full_native_reference_closure_verified=false`. Rechecking an external SHA/Revision value is NOT a trusted ProductSession CAS.
- Does not iterate/deserialize/copy 200MiB save JSON, expose private P1G, or construct a second document parser. Actual 01A Core-owned typed slice extraction & complete source closure is the NEXT dependency.
- Explicitly excludes Road/Fence topology; 01C retains complete ownership. 01E retains Native producer/consumer and V3.

## Acceptance & negatives

Source changed only new `crates/ddv-save-core/src/spatial_reference_index.rs`, integration test `crates/ddv-save-core/tests/spatial_reference_index.rs` and opt-in exports in `src/lib.rs`. Existing Core ProductSession, Worker, indexed_read.rs, Cargo features, WASM messages, JS facade, Codec, Flag and Pages untouched.

Positive: root Area42 and child Grid43, distinct Grid-qualified ObjectID7, root Area inheritance, proposed bounds checked.
Negative: missing Area/Grid, duplicate Grid/ObjectID/Area ownership, wrong immediate parent or child backreference, isolated Grid, parent cycle, root/subgrid ownership conflict, negative/out-of-grid/overflow footprint, unknown dimensions/footprint, unsupported orientation, forged build and stale revision/SHA.

Owner CI and independent 05 QR-C new-only tests must run against fixed Source HEAD. Source CI is NOT independent QA. Existing ancestor QA (01A PR782/QA790, prior 01B PR666/QA667 and merged PR671) is reused and not repeated. No new real/private P1G, Native V3, device, Product Export, Edit or Apply proof.

## Next / Gate / rollback

NEXT 01A: consume opt-in typed candidate graph from ONE Rust ProductSession's authenticated, indexed/lazy readset and mint Core-owned scope (never caller-defined records); ensure cross-domain references/Revision/IndexGeneration/UTF8/duplicate-key constraints.
NEXT 01E: same-build Native GridData/Footprint/transform/Area/Default+DiffGrid effective semantics, required consumer/producer and Native V3 evidence; 05 QR-L only for genuine new value-change Operation after V2 source.
Gate: 05 QR-C changed-only independent QA, then 09 INT alone selects accepted original Source files into latest protected main and verifies cumulative CI/Pages. All Writer/EditedCopy/Apply/Cloud/Public flags OFF.
Rollback: delete the new Rust candidate source and test, revert only `lib.rs` opt-in re-exports; preserve 01A indexed_read.rs, ProductSession, Worker and accepted main.
