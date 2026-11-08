//! 01B R06: bounded typed Spatial reference GRAPH validator, opt-in SOURCE_ONLY.
//!
//! Input MUST be supplied by the existing 01A ProductSession's future trusted
//! typed read path. This module neither decodes a P1G nor mints a Session,
//! authenticates caller-provided records, or supplies a second JSON reader.
//! A passing subgraph does not prove the complete Native World, exact GridData
//! footprint/rotation, actual collision legality, or any Writer permission.
use crate::{BuildIdentity, BuildKind, CoreError, CoreResult, Platform};
use std::collections::{HashMap, HashSet};
#[cfg(feature="private-native-v1")]
use crate::{ProductSession, WorkerAction, WorkerEnvelope, PRODUCT_WORKER_CONTRACT};

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
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct SpatialCandidateCounts {
    areas: usize, grids: usize, direct_area_grid_links: usize,
    objects: usize, highest_village_index: usize,
}
/// Private native-only correlation to the ONE Rust ProductSession scanner.
/// Count agreement does NOT prove candidate IDs, geometry, build or Writer.
#[cfg(feature="private-native-v1")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SpatialNativeCensusReceipt {
    pub same_session_census_counts_match: bool,
    pub candidate_native_ids_authenticated: bool,
    pub source_platform_provenance_verified: bool,
    pub native_footprint_bounds_verified: bool,
    pub full_native_reference_closure_verified: bool,
    pub product_read_accepted: bool,
    pub writer_authorized: bool,
}
pub struct SpatialCandidateIndex {
    scope: SpatialScope,
    // Exactly the declaration validated at candidate construction. Preserve
    // it only in the native-only build where source equality is checked.
    #[cfg(feature="private-native-v1")]
    candidate_build: BuildIdentity,
    counts: SpatialCandidateCounts,
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
            if object.serialized_x < 0 || object.serialized_y < 0 {
                return Err(denied("SPATIAL_COORDINATE_NEGATIVE"));
            }
            // Coords are i64 in the native-shaped record. Check addition in
            // that SAME domain before comparing against asserted grid bounds.
            let x_end = object.serialized_x.checked_add(i64::from(foot.width))
                .ok_or(denied("SPATIAL_FOOTPRINT_OVERFLOW"))?;
            let y_end = object.serialized_y.checked_add(i64::from(foot.height))
                .ok_or(denied("SPATIAL_FOOTPRINT_OVERFLOW"))?;
            if u64::try_from(x_end).map_err(|_| denied("SPATIAL_FOOTPRINT_OVERFLOW"))? > u64::from(bounds.width)
                || u64::try_from(y_end).map_err(|_| denied("SPATIAL_FOOTPRINT_OVERFLOW"))? > u64::from(bounds.height) {
                return Err(denied("SPATIAL_FOOTPRINT_OUT_OF_BOUNDS"));
            }
            if object_by_key.insert(object.key, *object).is_some() {
                return Err(denied("SPATIAL_DUPLICATE_OBJECT_ID_IN_GRID"));
            }
        }
        let mut root_owner = HashMap::<u64,(u32,u64)>::new();
        let mut seen_areas = HashSet::new();
        let mut root_link_count = 0usize;
        for area in areas {
            if !seen_areas.insert((area.village_index, area.area_key)) {
                return Err(denied("SPATIAL_DUPLICATE_AREA_KEY"));
            }
            let mut local = HashSet::new();
            for grid_id in &area.root_grid_ids {
                root_link_count = root_link_count.checked_add(1)
                    .ok_or(denied("SPATIAL_AREA_LINK_BUDGET"))?;
                if root_link_count > MAX_SPATIAL_GRIDS {
                    return Err(denied("SPATIAL_AREA_LINK_BUDGET"));
                }
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
            scope,
            #[cfg(feature="private-native-v1")]
            candidate_build:build.clone(),
            counts: SpatialCandidateCounts {
                areas: areas.len(), grids: grids.len(),
                direct_area_grid_links: root_link_count,
                objects: objects.len(),
                highest_village_index: areas.iter().map(|a|a.village_index as usize)
                    .max().unwrap_or(0),
            },
            by_object,graph_references_checked:true,
            asserted_footprint_bounds_checked:true,
            full_native_reference_closure_verified:false,
            source_session_authenticated:false,native_layout_verified:false,
            product_read_accepted:false,product_writer_authorized:false,
        })
    }
    /// Only a PRIVATE NATIVE count cross-check against the existing 01A scanner.
    /// No second Save reader. Neither this typed candidate graph nor a caller's
    /// declared Switch BID is authenticated by comparing cardinalities.
    #[cfg(feature="private-native-v1")]
    pub fn compare_core_native_area_grid_census(
        &self, session: &ProductSession, scope: SpatialScope
    ) -> CoreResult<SpatialNativeCensusReceipt> {
        if self.scope != scope {
            return Err(denied("SPATIAL_NATIVE_SCOPE_STALE"));
        }
        // 01A validates the live Rust-owned SessionID/revision/generation/SHA
        // while scanning borrowed original bytes under its own lock.
        let envelope = WorkerEnvelope {
            contract: PRODUCT_WORKER_CONTRACT,
            session_id: scope.session_id,
            expected_revision: scope.revision,
            expected_index_generation: scope.index_generation,
            expected_decoded_sha256: scope.decoded_sha256,
            action: WorkerAction::ReadDomain,
        };
        // 01A owns the immutable open-time Build declaration and source CAS.
        // A same-schema Steam Session must NEVER validate a Switch candidate.
        session.verify_native_source_build_matches(envelope,&self.candidate_build)?;
        let native = session.verify_native_area_grid_slice(envelope)?;
        if native.village_records <= self.counts.highest_village_index ||
            native.area_records != self.counts.areas ||
            native.grid_records != self.counts.grids ||
            native.direct_area_grid_links != self.counts.direct_area_grid_links ||
            native.grid_object_identity_records != self.counts.objects {
            return Err(denied("SPATIAL_NATIVE_CENSUS_MISMATCH"));
        }
        if native.full_native_reference_closure_verified ||
            native.area_group_footprint_verified || native.native_v3_verified ||
            native.product_read_accepted || native.writer_authorized {
            return Err(denied("SPATIAL_NATIVE_CENSUS_AUTHORITY_FORBIDDEN"));
        }
        Ok(SpatialNativeCensusReceipt {
            same_session_census_counts_match: true,
            candidate_native_ids_authenticated: false,
            source_platform_provenance_verified: false,
            native_footprint_bounds_verified: false,
            full_native_reference_closure_verified: false,
            product_read_accepted: false,
            writer_authorized: false,
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
