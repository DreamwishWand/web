# 01A CORE / R04 R06 R22 — stored DiffGrids typed Indexed Read (read-only, no Native oracle)

Task `W-CORE-004 / W-LOCAL-019`. Owner EVIDENCE1078 expressly removes a same-Steam Windows Native runtime/hash oracle as a blanket prerequisite to **stored-field structural Read**. This grants NO permission for effective-Grid synthesis, external layout acceptance, placement, Grid/Quest/RoadFence/Cross-domain Writer, offline edited copy, Native V3, Community publish, or production ON.

## Source and ancestry

Protected main at task start: `8d6e35adbdedc3b44e1a9a498d65da7af9c3273f`. Existing accepted PR817 Rust11, PR823 FloatingIslands and PR839 BuildIdentity reused unchanged. PR852 nonproduct diagnostic Source `db02d178d6af28bb4c812302b8b3e27669e31a38`, independent QA PR856 `8cfb0ba85314438bfde3b6a518ddc3e8fd0308a7`, genuine Rust single-Session E1015, private E1040 path/byte SHA/nonzero ID and E1044 saved canonical Type are **inherited**; no relabel of PR852 and no reQA. Separate from PR852 and unrelated to the later Native oracle E1076 WAIT_ENV. Original private Steam Save and backup already exist and must not enter CI/PR/Pages.

## Exact operation

`ProductSession::issue_saved_diffgrids_cursor(WorkerEnvelope{action:ReadDomain,...})` and `read_saved_diffgrids_page(scope,cursor)` are explicit, opt-in Rust `indexed-read` APIs. The existing strictly validated ONE immutable decoded Rust source buffer and the original `indexed_read` lexical walker, indexed cache, CSPRNG cursor grants, Mutex and CAS fields are reused. No second decoder, full serde JSON document, separate Reader, untrusted UI cursor authority, new Writer or Worker JS binding.

At open, BuildIdentity must be externally attested, registry-exact `SteamWindows / SteamFullVersion / releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22 / schema626`. Every call requires same internal Build and Rust-owned session ID/decoded SHA/Revision/IndexGeneration and `ReadDomain`. Stale, foreign, consumed, forged, wrong-domain, wrong-build, closed, wrong-action, unknown and malformed nested fields fail closed. Issue builds one cached index of canonical DiffGrids map keys, ID equality and validated spans in the *existing* IndexedCache; page length maximum 8 and page tokens single-use. No 200MiB JSON body transmitted.

Each bounded page exposes saved, not effective, values: GridID, optional DefaultLayoutGridID (including literal zero), optional `GridDefaultLayoutPath`, `GridDefaultLayoutType`, optional signed i32 `DefaultGridHashCode` / `DefaultGridDataHashCode`, bounded IDs of `ModifiedObjects` map (map key exactly nested ID), `RemovedObjects` numeric array/object map, removed stored shape and distinct within-DiffGrid Modified∩Removed pair count. It never reclassifies or deletes overlapping entries or deduplicates a saved removal list. Both optional and unrelated unknown JSON fields are preserved in the immutable original source. External file membership, Grid0 semantic status, overlay precedence and effective Grid closure are **always UNKNOWN** via `UNRESOLVED_EXTERNAL_LAYOUT`; `native_effective_grid_verified=false`. Any targeted unsupported type/ID/Bounds errors without issuing a success receipt. Both root and saved cursor grants share the existing 2-active-cursor session limit.

`SessionReceipt.all_domain_references_verified=false`, all page/cursor `all_native_references_verified=false`, `product_read_accepted=false`, `writer_authorized=false`. This is a bounded typed *read operation contract* for stored fields, not a blanket PRODUCT_OPERATION_ENABLED Gate. No WASM Worker public dispatch enabled by this PR.

## Focused synthetic positives / negatives and limits

New tests verify 0 literal GridID+DefaultLayoutID with unresolved layout, strings, signed gamehash storage (not native hash parity), Modified/Removed array and map IDs, the separate 14 DiffGrid records ×4 same-ID pairs = 56 pair **different count units** with no corruption inference, paginated 17 items as 8/8/1 with single-use token, regular World read cursor coexistence and explicit denial of cross-domain cursor reuse.

Negative tests cover Steam-vs-Switch same schema, malformed map key or ID mismatch, modified entry mismatch, Removed IDs string/null, noninteger DefaultLayoutGridID/hash, null Type, stale Session/Revision/IndexGeneration/decoded SHA, Stage action, foreign and consumed token, closed session, unknown map shape. Synthetic tests run in Actions **only**, never the original owner encrypted P1G, keys, private absolute paths, decoded JSON or original per-record IDs.

The same-Steam Native Windows oracle for derived game hashes is **NOT_RUN** and remains operation-specific for any later Native V3 effective-grid consumer/producer; E1044 source-derived Grid hash true and GridData hash false cannot be labeled Save corruption or genuine loader success. Unresolved 154 external paths, 137 DefaultLayout GridID0, 56-vs-14 count unit and 177 off-Save targets never become Native legal references.

## Acceptance, rollback and downstream

New Source fixed HEAD and original Git Blob pins are required, Owner native Rust, product ABI, normal Verify and triggered Worker/Chrome CI terminal green before independent 05 QR-C QA *only this changed scope*. QA-only PR must not merge. After changed-only `SCOPED_PASS`, 09 INT sole owner evaluates latest-main exact original source, dependencies, ABI, Feature OFF, protected cumulative CI+Pages and selective Merge1. No auto Writer/Native V3/Apply/Export/Cloud/Provider/CommunityPublic/MediaPublic/production enablement.

Rollback only new saved DiffGrids module plus minimal existing source files modified to connect it, restoring their protected-main original Git blobs. The accepted ancestors, separate PR852 diagnostic, owner local Save/Backup, Scene/IDB backup and public Pages are preserved.
