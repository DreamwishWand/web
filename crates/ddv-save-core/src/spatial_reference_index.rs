//! 01B R06: bounded typed Spatial reference GRAPH validator, opt-in SOURCE_ONLY.
//!
//! Input MUST be supplied by the existing 01A ProductSession's future trusted
//! typed read path. This module neither decodes a P1G nor mints a Session,
//! authenticates caller-provided records, or supplies a second JSON reader.
//! A passing subgraph does not prove the complete Native World, exact GridData
//! footprint/rotation, actual collision legality, or any Writer permission.
use crate::{BuildIdentity, BuildKind, CoreError, CoreResult, Platform};
use std::collections::{HashMap, HashSet};

pub const SPATIAL_GRAPH_CONTRACT: &str = "wand.core.01b.typed-spatial-subgraph@1";
pub const MAX_SPATIAL_GRIDS: usize = 8192;
pub const MAX_SPATIAL_OBJECTS: usize = 100_000;
const MAX_SPATIAL_AREAS: usize = 4096;
const SWITCH_1253_BID: &str = "9A239D3DB569756D";

fn denied(code: &'static str) -> CoreError { CoreError(code) }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SpatialScope {
    // A comparison witness only. The caller cannot mint ProductSession authority.
    pub session_id: [u8; 16],
    pub revision: u64,
    pub index_generation: u64,
    pub decoded_sha256: [u8; 32],
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct SpatialObjectKey { pub grid_id: u64, pub object_id: u64 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SpatialExtent { pub width: u32, pub height: u32 }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SpatialAreaRef {
    pub village_index: u32,
    pub area_key: u64,
    pub root_grid_ids: Vec<u64>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SpatialGridRef {
    pub grid_id: u64,
    // These proposed dimensions are NOT game-verified GridData authority.
    pub proposed_bounds: Option<SpatialExtent>,
    pub parent_object: Option<SpatialObjectKey>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SpatialObjectRef {
    pub key: SpatialObjectKey,
    pub item_id: u64,
    pub serialized_x: i64,
    pub serialized_y: i64,
    pub orientation: u8,
    // Orientation-specific Footprint is an INPUT assertion, never Native V3 proof.
    pub proposed_footprint: Option<SpatialExtent>,
    pub child_grid_id: Option<u64>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SpatialReadWitness {
    pub object: SpatialObjectRef,
    pub area_village_index: u32,
    pub area_key: u64,
    pub root_grid_id: u64,
    pub native_layout_verified: bool,
    pub source_session_authenticated: bool,
    pub product_writer_authorized: bool,
}
pub struct SpatialCandidateIndex {
    scope: SpatialScope,
    by_object: HashMap<SpatialObjectKey, SpatialReadWitness>,
    pub graph_references_checked: bool,
    pub asserted_footprint_bounds_checked: bool,
    pub full_native_reference_closure_verified: bool,
    pub source_session_authenticated: bool,
    pub native_layout_verified: bool,
    pub product_read_accepted: bool,
    pub product_writer_authorized: bool,
}
impl SpatialCandidateIndex {
    /// Checks a scoped, complete-looking typed candidate graph. This does NOT
    /// certify that the candidate records were extracted from a real Save.
    /// Only future 01A Core-owned typed extraction may establish that boundary.
    pub fn validate(
        build: &BuildIdentity, scope: SpatialScope,
        areas: &[SpatialAreaRef], grids: &[SpatialGridRef],
        objects: &[SpatialObjectRef],
    ) -> CoreResult<Self> {
        if build.platform != Platform::Switch ||
            build.build_kind != BuildKind::SwitchBid ||
            build.build_id != SWITCH_1253_BID ||
            build.schema != 626 || !build.externally_attested {
            return Err(denied("SPATIAL_EXACT_SWITCH_BUILD_REQUIRED"));
        }
        if scope.session_id == [0;16] ||
            scope.decoded_sha256 == [0;32] || scope.index_generation == 0 {
            return Err(denied("SPATIAL_SCOPE_INVALID"));
        }
        if areas.is_empty() || areas.len() > MAX_SPATIAL_AREAS ||
            grids.is_empty() || grids.len() > MAX_SPATIAL_GRIDS ||
            objects.len() > MAX_SPATIAL_OBJECTS {
            return Err(denied("SPATIAL_TYPED_SCOPE_BUDGET"));
        }
        let mut grid_by_id = HashMap::<u64, SpatialGridRef>::new();
        for grid in grids {
            let bounds = grid.proposed_bounds.ok_or(denied("SPATIAL_BOUNDS_UNKNOWN"))?;
            if bounds.width == 0 || bounds.height == 0 {
                return Err(denied("SPATIAL_BOUNDS_INVALID"));
            }
            if grid_by_id.insert(grid.grid_id, *grid).is_some() {
                return Err(denied("SPATIAL_DUPLICATE_GRID_ID"));
            }
        }
        let mut object_by_key = HashMap::<SpatialObjectKey, SpatialObjectRef>::new();
        for object in objects {
            let grid = grid_by_id.get(&object.key.grid_id)
                .ok_or(denied("SPATIAL_OBJECT_GRID_ORPHAN"))?;
            if object.orientation >= 16 {
                return Err(denied("SPATIAL_ORIENTATION_OUT_OF_RANGE"));
            }
            let foot = object.proposed_footprint
                .ok_or(denied("SPATIAL_FOOTPRINT_UNKNOWN"))?;
            if foot.width == 0 || foot.height == 0 {
                return Err(denied("SPATIAL_FOOTPRINT_INVALID"));
            }
            let bounds = grid.proposed_bounds.ok_or(denied("SPATIAL_BOUNDS_UNKNOWN"))?;
            let x = u64::try_from(object.serialized_x)
                .map_err(|_| denied("SPATIAL_COORDINATE_NEGATIVE"))?;
            let y = u64::try_from(object.serialized_y)
                .map_err(|_| denied("SPATIAL_COORDINATE_NEGATIVE"))?;
            let x_end = x.checked_add(u64::from(foot.width))
                .ok_or(denied("SPATIAL_FOOTPRINT_OVERFLOW"))?;
            let y_end = y.checked_add(u64::from(foot.height))
                .ok_or(denied("SPATIAL_FOOTPRINT_OVERFLOW"))?;
            if x_end > u64::from(bounds.width) || y_end > u64::from(bounds.height) {
                return Err(denied("SPATIAL_FOOTPRINT_OUT_OF_BOUNDS"));
            }
            if object_by_key.insert(object.key, *object).is_some() {
                return Err(denied("SPATIAL_DUPLICATE_OBJECT_ID_IN_GRID"));
            }
        }
        let mut root_owner = HashMap::<u64,(u32,u64)>::new();
        let mut seen_areas = HashSet::new();
        for area in areas {
            if !seen_areas.insert((area.village_index, area.area_key)) {
                return Err(denied("SPATIAL_DUPLICATE_AREA_KEY"));
            }
            let mut local = HashSet::new();
            for grid_id in &area.root_grid_ids {
                if !grid_by_id.contains_key(grid_id) {
                    return Err(denied("SPATIAL_AREA_GRID_ORPHAN"));
                }
                if !local.insert(*grid_id) || root_owner.insert(
                    *grid_id, (area.village_index, area.area_key)
                ).is_some() {
                    return Err(denied("SPATIAL_DUPLICATE_AREA_GRID_OWNER"));
                }
            }
        }
        // Every declared child must have exactly one matching parent object;
        // a parent object may not claim a second child via a duplicate ID.
        let mut parent_of = HashMap::<u64, SpatialObjectKey>::new();
        for object in objects {
            if let Some(child) = object.child_grid_id {
                let target = grid_by_id.get(&child)
                    .ok_or(denied("SPATIAL_SUBGRID_ORPHAN"))?;
                if target.parent_object != Some(object.key) {
                    return Err(denied("SPATIAL_SUBGRID_PARENT_MISMATCH"));
                }
                if parent_of.insert(child, object.key).is_some() {
                    return Err(denied("SPATIAL_SUBGRID_DUPLICATE_PARENT"));
                }
            }
        }
        for grid in grids {
            if grid.parent_object != parent_of.get(&grid.grid_id).copied() {
                return Err(denied("SPATIAL_SUBGRID_BACKREFERENCE_MISMATCH"));
            }
            if grid.parent_object.is_some() && root_owner.contains_key(&grid.grid_id) {
                return Err(denied("SPATIAL_ROOT_SUBGRID_OWNERSHIP_CONFLICT"));
            }
        }
        // Iterative walk: no recursion depth dependent on malformed Source.
        let mut owner_for_grid = HashMap::<u64,(u64,u32,u64)>::new();
        for grid in grids {
            let mut seen = HashSet::new();
            let mut current = grid.grid_id;
            while let Some(parent) = parent_of.get(&current) {
                if !seen.insert(current) {
                    return Err(denied("SPATIAL_SUBGRID_PARENT_CYCLE"));
                }
                current = parent.grid_id;
            }
            if !seen.insert(current) {
                return Err(denied("SPATIAL_SUBGRID_PARENT_CYCLE"));
            }
            let &(village, area_key) = root_owner.get(&current)
                .ok_or(denied("SPATIAL_GRID_NOT_REACHABLE_FROM_AREA"))?;
            owner_for_grid.insert(grid.grid_id, (current, village, area_key));
        }
        let mut by_object = HashMap::new();
        for object in objects {
            let &(root_grid_id, area_village_index, area_key) =
                owner_for_grid.get(&object.key.grid_id)
                    .ok_or(denied("SPATIAL_OBJECT_GRID_ORPHAN"))?;
            by_object.insert(object.key, SpatialReadWitness {
                object:*object, area_village_index, area_key, root_grid_id,
                native_layout_verified:false, source_session_authenticated:false,
                product_writer_authorized:false,
            });
        }
        Ok(Self {
            scope,by_object,graph_references_checked:true,
            asserted_footprint_bounds_checked:true,
            full_native_reference_closure_verified:false,
            source_session_authenticated:false,native_layout_verified:false,
            product_read_accepted:false,product_writer_authorized:false,
        })
    }
    /// Rejects stale caller scope, but never treats caller tokens as Core CAS.
    pub fn inspect(&self, scope:SpatialScope, key:SpatialObjectKey)
        -> CoreResult<SpatialReadWitness> {
        if scope != self.scope {
            return Err(denied("SPATIAL_SCOPE_REVISION_OR_SHA_STALE"));
        }
        self.by_object.get(&key).copied()
            .ok_or(denied("SPATIAL_OBJECT_ID_NOT_FOUND"))
    }
}
