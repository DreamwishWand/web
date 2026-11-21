# 01B CORE → 02 WEP: Source-addressed Spatial Model v1

**Date:** 2026-11-04. **Workstreams:** W-DEC-018 / W-NATIVE-005. **Baseline:** Wand TEST main `d3ec2f5b66da9bbef42943fc9abaea067df9aac4`. **Status:** SOURCE-ONLY + SYNTHETIC local tests; NOT independently accepted until exact-head CI/05 QR. All permanent Save/World Writer flags OFF.

## Integration surface

Use `src/lib/wep/source-spatial-model.ts` with the **existing** `EditorDocument` from `src/lib/ddv/core/world/runtime-v125/direct-root-editor-document-v125.js` and the existing WEP `editor-runtime.ts`. The new model **does not create an alternative GridObject or editor identity**.

```ts
const scene = projectSourceSpatialScene(editorDocument, viewEpoch);
const camera = { gridId: scene.grids[0].gridId, cellPixels: 24, panX: 0, panY: 0 };
const hit = hitTestSource(scene, pointerInCanvasPixels, camera);
// If overlapping, show the candidate list; don't guess Native z-order.
const selected = selectHitCandidate(scene, hit, userChosenEditorId, viewEpoch);
const schematic = previewSourceTransform(scene, selected.editorId, viewEpoch, { dx: 1, dy: 0 });
// Never pass schematic to a Save writer or claim Native placement validated.
```

`GridObject` identity: `(sourceGridId, GridObject.ID, objectMapKey)` where `objectMapKey === String(GridObject.ID)` in source `Grids[String(gridId)].Objects`. The canonical editor ID **stays** `g${gridId}:o${gridObjectId}`, exactly as the existing direct-root projector; the renderer MUST reuse this ID for Scene Node, hover/hit, selection, detail and transform preview. No canvas UUID or synthetic re-ID is used for an imported object. `GridObject.ItemID` is the **item type** and is not a unique instance key. Every node keeps `relation=ROOT|SUBGRID_CHILD`, `parentAddress`, grid-local `X/Y`, serialized 16-step orientation index, layer, imported footprint cells and read-only policy.

**Axes:** `GridObject.X/Y` and footprint offsets are integer **grid-local** coordinates. UI `SCREEN_X_RIGHT_Y_DOWN` is a view choice: `screenX=(sourceX-panX)*cellPixels`, `screenY=(sourceY-panY)*cellPixels`, invertible for hit-testing. This is **not** a claim that Unity world axes/rotations match screen coordinates. Source `Orientation` 0..15 remains untouched. The schematic quarter-turn computes `orientation+4 mod 16` and rotates only an already-verified rectangular footprint; no Native rotated support/collision result or persistent rotation is produced.

**Footprint and occupancy:** accept the existing 01B oriented bounding rectangle from a pinned geometry record. A source cell is `{x: GridObject.X + footprintCell.x, y: GridObject.Y + footprintCell.y}`. Reject missing, duplicate, noninteger or out-of-grid cells. Hit-testing returns **all** overlapping source addresses instead of inventing depth order. For schematic transform, deny out-of-bounds, occupied candidate cells, unknown/nonrect geometry and an unverified orientation. `WEP` must still invoke its existing strict `previewStrictMove`/`EditorValidator` for its own synthetic draft/Undo, never treat this read-only source projection as a Native placement grant.

**Hierarchy:** `metadata.subGridHierarchy` is traversed without re-ID. Each child's `source.parentAddress` and the parent source `State.SubGrid.GridID` must match the child Grid. Child `X/Y` remain **child Grid-local**. There is no proved child-to-parent world transform, scale/rotation, anchor, support/footprint propagation or deletion cascade; **do not flatten** child nodes into the root canvas. Use a separate child-grid viewport or inspector and forbid source persistent move/rotate/delete for children. Reject cycles, duplicate Grid IDs, missing/incorrect parent and unproved GridData bounds. Object support/building attachment across Grid/Container/World requires independent Native evidence.

**Exact version:** This initial executable projection targets the preexisting **Nintendo Switch v1.25.0, BID `52BD625D9B4E0053`, schema624** direct-root projector and pinned `GridData` dimensions SHA `75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa`. Only source-projected, `CONFIRMED` direct-root documents are accepted. A missing user-source BID may still be rendered under the **contract** as read-only; the contract's BID is **not** proof of the imported user's BID. If the actual source BID is explicitly known and mismatches this contract, projection is denied. An `exactBuildKnown=true` claim without a matching source BID also denies. `sourceRevision` here is **only a UI view epoch**, not a Core-minted Revision/CAS capability.

**Switch v1.25.3, BID `9A239D3DB569756D`, schema626** has independent W1/RecurringEvent V0–V2 source and previous 01B grid/diff static evidence, but has **not** been promoted as the v1.25.0 World geometry/coordinate writer authority. The new projector explicitly rejects it until same-version Grid/Footprint/Area/SubGrid model + Core Session read consistency are verified. Other platform/versions fail closed. No Steam inference from shared schema.

## 02 WEP delivery obligations

1. Draw schematic footprint cells using `SpatialScene.nodes` for one selected `gridId` at a time; maintain the same `editorId` in hover/selection/detail. No image rights dependency.
2. Convert pointer pixels with `screenToSource` (or `hitTestSource`), retain `address` and `parentAddress`; overlaps require a choice or cycling among returned candidates.
3. Restrict source transform to **schematic** root stateless furniture preview. Show `nativePlacementVerified=false`, `persistentWriteAuthorized=false`; separate 02 WEP's editor draft undo from the immutable source object.
4. On Save reopen/reselect/source revision change, discard cached `SpatialScene` and any selected/hit/preview handles. `hitTestSource` binds its result to the exact in-memory scene using WeakMap; copied/forged/stale Hit Test objects cannot be selected even if their GridObject editorId coincides. Never trust caller-provided `sourceRevision` as permission.
5. Keep children within their own grids until the Native parent anchor and orientation mapping is proved; no guessed global positions.

## Native evidence / operation V0–V3 matrix

| Operation | V0/V1 | V2 isolated edited copy | V3 Native semantics / remaining blockers | Product |
|---|---|---|---|---|
| Source-read 2D selected root | v1.25.0 schema624 source+static GridData projection; external BID not inferred from schema | N/A | Static read/source provenance as in earlier 01B/02 WEP; browser real-source QA for this new rendering not run | **Read/Preview only** |
| GridObject root MOVE | v1.25.0 exact static ordinary stateless furniture subset and identity/root-only source | Existing historic bounded synthetic evidence is NOT per-current v1.25.3 real Save V2 | Native placement, GridCells/gridArea update, coordinate limits, current World ownership/progression, overlap, runtime/reopen; Core full Session CAS and independent 05 QR | OFF |
| GridObject root ROTATE | same, Native orientation 16 index, subset cardinal `{0,4,8,12}` for prior conservative v1.25.0 root writer | no new genuine isolated copy | Native pivot/footprint orientation updates, collision, GridCells, persistence and reversal; 90deg schematic is not Native proof | OFF |
| GridObject DELETE | root-vs-child, state/class/ownership and references require distinct allowlist | no new supported source | Native Delete/Deinitialize, inventories and attached/subgrid child/quest/storage references, rollback semantics | OFF |
| SubGrid parent/child transform | source oneof SubGrid GridID and child local coords; parentAddress guaranteed only when source-projector verifies | no | child→root affine transform/rotation, cascade, support/occupancy, per-grid ID uniqueness and update ordering; high risk | Source read only |
| Road/Fence | 01C logical relation/segment family, native variations and connectivity are distinct from furniture | no current operation V2 | native quantity, neighbor connections/variation angles/diagonal semantics/recompile/cost+inventory, dynamic grids | Read/Preview only; Writer OFF |
| Building / PlayerHouse | source grid instance, type and house state distinguishable | no current scoped V2 | entrance/placement binding, interior links, progression/quests, storage/skin, move/deletion callbacks | Read-only; Writer OFF |
| W1 `ItemSpawning.NextOccurrence` EventID 2010000021 / saved map key `155` | exact Switch **v1.25.3** BID/schema event/registry/Area/Tree source separately verified, REAL V1 private reference | PR329+QA343 genuine 6 P1G **Codec mechanism only** accepted; no Core-issued operation CAS | GridCollection `Grids→DiffGrids` and default/modified/removed static path known; **live effective Wetland Tree/Softwood count and cold-load Actualize→Execute→Last/Next persisted evidence missing**. Core revision/registry event read-set required | W1 Writer OFF |

## Negative test coverage (new-only synthetic)

Source address duplicate, mismatched map key and `GridObject.ID`, wrong Grid, nonexistent source, invalid Orientation, noncanonical/editor-only ID, unknown footprint, out-of-Grid footprint, collision, ambiguous hit, stale source view revision, SubGrid wrong parent/cycle and no cross-Grid flatten, unsupported building/road/fence and read-only operation, v1.25.3 schema626 passed to v1.25.0 projector, invalid camera zoom. `14/14` focused local Node tests and a type-only strict TS compilation on an exact interface stub were observed. **Not independent QA / not actual browser**. New negatives also reject stale hit handles from another in-memory Save scene and an actual external BID that contradicts the v1.25.0 projection. On PR exact HEAD required CI and new-only 05 QR remain pending.

## 01A / 01E handoff

01A: Keep the **Core-owned** single Session, source/decoded SHA, authoritative external platform/Full Version/BID/schema, source-minted indexed row/cursor, Revision and source read-set; never use this module's UI epoch (`sourceRevision`), a WEP `editorId` alone, or `persistentWriteAuthorized:false` as a trusted CAS permission. Previews may use source address but writer should rederive exact same GridObject ID/map key, parent closure and atomic source delta from Core. No new writer exposed.

01E: Independently provide only an approved **private derived read-only** event-scoped projection of actual v1.25.3 Wetland+Grid/default/Diff/Tree anchor+Softwood current count if technically accessible. Do not move the private source to repo/CI. If concrete startup reschedule/Native event outcome still cannot be closed offline, V4 test only with an explicitly approved single-event, backed-up original vs isolated edited copy. Not a general Device prerequisite for World 2D preview.

**Fixed baseline:** GitHub `DreamwishWand/web@d3ec2f5b66da9bbef42943fc9abaea067df9aac4`; 01B Native prior ELF SHA `e99b1aa67ec729053d847adb3621d63e4f2ced570826b8b923531378752b8ebf` for **Switch v1.25.3** and existing QR343 original-private evidence are reused but never promoted to v1.25.0 spatial Writer. WEP source direct-root projection contract current original blob `d5f188a27b1a6e93e7dbf9e34a355dbb6647f740`; existing editor runtime `4dd36dee364a6118fc8d410de3ee2e647c2a064b`.