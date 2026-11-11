//! 01B Steam v1.25.3: SOURCE_ONLY structural move/rotation preview.
//! Caller-supplied masks/IDs have no Core authority. Never a Writer gate.
use crate::{BuildIdentity,BuildKind,Platform,CoreError,CoreResult};
use std::collections::HashSet;
pub const STEAM_SPATIAL_PREFLIGHT_CONTRACT:&str="wand.01b.steam1253.preview@1";
const FULL_VERSION:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const MAX_CELLS:usize=4096;
#[derive(Clone,Copy,Debug,PartialEq,Eq,Hash)]
pub struct PreviewCell {pub x:i32,pub y:i32}
#[derive(Clone,Copy,Debug,PartialEq,Eq,Hash)]
pub struct PreviewObjectKey {pub grid_id:u32,pub object_id:u32}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct PreviewTransform {pub x:i32,pub y:i32,pub orientation:u8}
#[derive(Clone,Copy,Debug)]
pub struct PreviewGrid {pub id:u32,pub width:u32,pub height:u32,pub tessellation:u32}
#[derive(Clone,Copy,Debug)]
pub struct PreviewRestrictions {
    pub can_move:Option<bool>,
    pub can_rotate:Option<bool>,
    pub only_default_orientations:Option<bool>,
}
#[derive(Clone,Copy,Debug)]
pub struct PreviewOccupiedCell {pub object:PreviewObjectKey,pub cell:PreviewCell}
#[derive(Clone,Debug)]
pub struct PreviewSnapshot {
    pub key:PreviewObjectKey,
    pub grid:PreviewGrid,
    pub old:PreviewTransform,
    // Asserted offsets from old object origin, not authenticated Native footprint.
    pub local_cells:Vec<PreviewCell>,
    pub other_cells:Vec<PreviewOccupiedCell>,
    pub restrictions:PreviewRestrictions,
}
#[derive(Clone,Copy,Debug)]
pub struct PreviewRequest {pub expected_key:PreviewObjectKey,pub target:PreviewTransform}
#[derive(Clone,Debug)]
pub struct PreviewReceipt {
    pub contract:&'static str,
    pub new_cells:Vec<PreviewCell>,
    pub stored_enum_checked:bool,
    pub asserted_bounds_and_conflicts_checked:bool,
    pub source_object_authenticated:bool,
    pub native_footprint_parent_floor_verified:bool,
    pub native_placement_legal:bool,
    pub writer_authorized:bool,
}
fn denied(code:&'static str)->CoreError{CoreError(code)}
pub fn steam_orientation_defined(n:u8)->bool{n<16}
pub fn steam_orientation_cardinal(n:u8)->bool{n<16 && n%4==0}
/// Only geometrical candidate checks for 1-tessellation asserted 2D cells.
/// Complex rotations need Native GridArea/Footprint; do not fake transposition.
/// A passing preview NEVER proves its caller-supplied Source or Writer legality.
pub fn preflight_steam_move_rotate(
    build:&BuildIdentity,old:&PreviewSnapshot,req:PreviewRequest
)->CoreResult<PreviewReceipt>{
    if build.platform!=Platform::SteamWindows ||
       build.build_kind!=BuildKind::SteamFullVersion ||
       build.build_id!=FULL_VERSION || build.schema!=626 || !build.externally_attested {
        return Err(denied("SPATIAL_STEAM_BUILD_MISMATCH"));
    }
    if req.expected_key!=old.key || old.grid.id!=old.key.grid_id {
        return Err(denied("SPATIAL_OBJECT_KEY_MISMATCH"));
    }
    if !steam_orientation_defined(old.old.orientation) ||
       !steam_orientation_defined(req.target.orientation){
        return Err(denied("SPATIAL_ORIENTATION_UNKNOWN"));
    }
    if old.grid.width==0 || old.grid.height==0 ||
       old.grid.width>i32::MAX as u32 || old.grid.height>i32::MAX as u32{
        return Err(denied("SPATIAL_GRID_SIZE_UNKNOWN"));
    }
    if old.grid.tessellation!=1{return Err(denied("SPATIAL_TESSELLATION_UNKNOWN"));}
    if old.local_cells.is_empty()||old.local_cells.len()>MAX_CELLS ||
       old.other_cells.len()>100_000{
        return Err(denied("SPATIAL_CELLS_UNKNOWN_OR_OVERSIZED"));
    }
    let moved=req.target.x!=old.old.x||req.target.y!=old.old.y;
    let rotated=req.target.orientation!=old.old.orientation;
    if !moved&&!rotated{return Err(denied("SPATIAL_NOOP"));}
    if moved&&old.restrictions.can_move!=Some(true){
        return Err(denied("SPATIAL_MOVE_PERMISSION_NOT_ESTABLISHED"));
    }
    if rotated&&old.restrictions.can_rotate!=Some(true){
        return Err(denied("SPATIAL_ROTATE_PERMISSION_NOT_ESTABLISHED"));
    }
    if rotated&&old.restrictions.only_default_orientations.is_none(){
        return Err(denied("SPATIAL_ROTATION_RESTRICTION_UNKNOWN"));
    }
    if old.restrictions.only_default_orientations==Some(true) &&
       !steam_orientation_cardinal(req.target.orientation){
        return Err(denied("SPATIAL_DEFAULT_ORIENTATION_REQUIRED"));
    }
    // One-cell rotation has no changed 2D mask, but still no Native legality.
    if rotated&&(old.local_cells.len()!=1 ||
        old.local_cells[0]!=(PreviewCell{x:0,y:0})){
        return Err(denied("SPATIAL_ROTATED_FOOTPRINT_UNKNOWN"));
    }
    let mut local=HashSet::new();
    let mut new_set=HashSet::new();
    let mut new_cells=Vec::with_capacity(old.local_cells.len());
    for offset in &old.local_cells{
        if offset.x<0||offset.y<0||!local.insert(*offset){
            return Err(denied("SPATIAL_DUPLICATE_OR_NEGATIVE_MASK"));
        }
        let x=req.target.x.checked_add(offset.x)
            .ok_or(denied("SPATIAL_COORDINATE_OVERFLOW"))?;
        let y=req.target.y.checked_add(offset.y)
            .ok_or(denied("SPATIAL_COORDINATE_OVERFLOW"))?;
        if x<0||y<0||x>=old.grid.width as i32||y>=old.grid.height as i32{
            return Err(denied("SPATIAL_ASSERTED_OUT_OF_BOUNDS"));
        }
        let c=PreviewCell{x,y};
        if !new_set.insert(c){return Err(denied("SPATIAL_DUPLICATE_NEW_CELL"));}
        new_cells.push(c);
    }
    for c in &old.other_cells{
        if c.object!=old.key&&new_set.contains(&c.cell){
            return Err(denied("SPATIAL_ASSERTED_CELL_CONFLICT"));
        }
    }
    Ok(PreviewReceipt{
        contract:STEAM_SPATIAL_PREFLIGHT_CONTRACT,new_cells,
        stored_enum_checked:true,asserted_bounds_and_conflicts_checked:true,
        source_object_authenticated:false,
        native_footprint_parent_floor_verified:false,
        native_placement_legal:false,writer_authorized:false,
    })
}
