# W-NATIVE-005 — W1 Wetland Area/Grid candidate diagnostics (SOURCE_ONLY)

This companion to 01B's **accepted** schema626 `read626SpatialReferences` does **not** reimplement the Spatial projector and does **not** grant a Writer. It consumes a read-only `SpatialSourceRead` projection whose source SHA/Revision are untrusted caller-provided display provenance, then generates candidate area references and explicit reasons why none is an authorized Native Wetland area. Version: **Switch v1.25.3, external BID 9A239D3DB569756D, schema626** only.

## Input and output

Call `inspectW1WetlandGridCandidates(spatialProjection, {sourceSha256, sourceRevision})` using a bounded 01B structural projection on the **same source**. It checks exact declared build and epoch, canonical `v{village-index}:a{numeric-save-area-key}` references, GridIDs and serialized `GRIDS` vs `DIFF_ONLY` provenance, unverified GridDataPath, structural Softwood ItemID31700014 occurrences and known 01B unresolved issue codes.

The result is `SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED` (or `SOURCE_REFERENCE_UNAVAILABLE` for malformed inputs). It **never** selects an event's eligible Wetland Area, reports a game-validated Softwood quota, or grants `productWriterAuthorized`, `productEditedCopyAuthorized`, `nativeRuntimeVerified` or an automatic 2126 date repair. A matching SHA string is not actual authenticated encrypted P1G+decoded SHA; a projection imported across a Worker cannot inherit the 01B module-private issued-index identity or the Rust Core Session/Revision CAS.

The Source registry says `AreaSpecification.SpecificAreas=[VillageAreaType.Wetland=1]` for event2010000021, and the Save references look like `World.Villages[vi].Areas[areaKey].GridIDs[]`. **No accepted Native evidence equates the enum 1 to `areaKey="1"` or resolves which `vi` belongs to Village04 SceneID1540000000.** All candidates are retained without guessing that mapping.

The optional `serializedGridsOnlySoftwoodCount` is a lower-scope **raw GridObject ItemID reference count**, **not** a Native effective-grid count, a quota or proof of the source producer; eight distinct source EventIDs use ItemID31700014. A `DIFF_ONLY` Grid has unresolved default contents and is not counted as equivalent to a `GRIDS` source object. Unverified external original GameData defaults, overlaps, modified/removed, Tree!Any tags radius4, collision, owner-group semantics, Village restriction, Quest/DLC, Clock/Now, startup Actualize, authoritative Execute RPC, Last and Next after a real game cold-load remain **UNKNOWN**.

## Required follow-up evidence

For 01A Core: a same-BID original Source/Tag/Scene manifest with SHA, trusted SaveSession encrypted+decoded SHA, IndexGeneration/Revision and raw UTC old CAS; Native-confirmed Village04/Wetland Area enum→actual saved numeric area mapping; exact Area.GridIDs set and GridData/default bytes SHA; correct Grids/DiffGrid precedence+overlay, effective Tree anchors and quota accounting at that revision. These are mandatory operation-dependent witnesses, not a permission to move/edit the Grid. Also require the Native Producer/Consumer outcome after Clock/Actualize/Execute/Reschedule and cold game re-save. Only `/World/RecurringEvents/155/ItemSpawning/NextOccurrence` is a candidate future one-field change, and original-first backup / full-document atomic diff / independent edited-copy Reopen / 05QR+00 CTRL approval are separate gates.

For 01B: resolve the enum-to-save-Area and default layout using same-build raw source without guessing, test zero eligible Tree/empty quota/full cap and wrong grid IDs. For 01D: Inventory Amount/Collection bool need same-BID Native ItemDB/Variation/Quest/Storage and new V2/V3; schema624 PC NativePreset backup is not schema626 game Save Apply. Intentional year2126 is never auto-repaired.

**Tests:** `node --test tests/01e-w1-wetland-area-grid-candidate-probe.test.mjs` tests candidate grouping, exact version/BID/epoch, forged capability claims, diff-only missing external defaults, duplicate/noncanonical refs, wrong GridObject parent, multi-owner and missing layout negatives. All fixtures are **synthetic**. No actual P1G/key/ROMFS bytes or native device data is included. PR #459's frozen Source SHA/source relation QA is separate; do not rerun it for this delta.

**Verdict:** SOURCE_ONLY candidate inspector; `NATIVE_SEMANTICS_VERIFIED=false`, `PRODUCT_OPERATION_ENABLED=false`, `DEVICE_RUNTIME_VERIFIED=false`. Writer, EditedCopy/Export, Apply and original overwrite remain OFF.
