# 01B / W-NATIVE-005 / R06 R22 — Cardinal GridArea bounds (Steam v1.25.3)

Operation: **SOURCE_ONLY_SYNTHETIC / BOUNDS_ONLY / Writer OFF**.

## Native code source
Reuses authenticated Steam FullVersion/schema626 game assets already owner-private. Original unchanged GameAssembly.dll IL2CPP `Definitions.Grid.GridArea.GetSizeForOrientation` RVA `0x37241F0` branches 0/8 = (SizeX,SizeY), 4/12 = (SizeY,SizeX); scale each by `gridTessellationFactor / areaTessellationFactor` in native signed int32 arithmetic. All other orientation angles use `MoreRotationSize` at RVA `0x3724320`, not modeled. `GridArea` has floor layers/stride and item-dependent GridArea distinct from simple bounds.

## New Rust contract
The existing exported `SpatialExtent` gets `steam1253_cardinal_bounds`; no lib.rs conflict with independent immutable PR915 or integrated PR914. Exact external Steam Build/schema checked, 0/8 normal, 4/12 transposed. To avoid wrong portable overflow/truncation results, both input dims/tessellations must be positive signed int32, product must not overflow signed int32, division must be exact, result nonzero. `SOURCE_ONLY` means build declaration and caller's dimensions can be forged; this function never proves item ownership or Move/Rotate legality and never returns a Writer grant.

**DO NOT promote successful bounding calculation to Native IsAreaValidFor**: requires true one-object source (old GridID/ObjectID/ItemID/X/Y/Orientation, whether already ModifiedObjects or DefaultGrid), source ItemDB GridArea mask, IGridEditRestriction, floor types, complete effective GridCells occupancy and Parent/SubGrid references from 01A ONE ProductSession under SHA/Revision/IndexGeneration CAS. Current 01A SavedDiffGrids page exposes IDs/path/type/hashes, NOT typed X/Y/Orientation or effective GridObjects. 01C Road/Fence excluded.

`DiffGrid.UpdateTransform` native RVA `0x3FEDA00` checks `GridExtensions.IsAreaValidFor` before writing X/Y/Orientation, removes old GridCells, may clone default GridObject and add to ModifiedObjects, then updates 32-bit X/Y/Orientation and re-adds GridCells. For first operation select an existing `ModifiedObjects` object NOT also `RemovedObjects`, no child/parent, no RoadFence, no special state, so no new map entry is needed; this class remains **UNKNOWN/NOT_RUN** until 01A Source and layout/item coverage.

Positive tests only show cardinal dimensions; negatives include wrong FullVersion/Switch BID, 16-direction noncardinal MoreRotationSize, zero tessellation, signed overflow and inexact scale. No Game device tests requested for typical object move/rotate, but no move/rotate Writer yet. Changes consist of `spatial_reference_index.rs` MOD, focused test ADD, document ADD; no second reader/codec/executor, no Save data or Native binary uploaded. Independent 05 QR-C changed-only QA and 09 INT sole selective merge required. Rollback these three paths only; Native V3/Writer/Apply/Cloud/Public OFF.
