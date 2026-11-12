//! 01A / R04: bounded native-only Area -> GridID structural reference slice.
//! Borrows the ONE ProductSession decoded buffer and the accepted indexed
//! lexical scanner. This is not a second Reader, a geometry validator, V3,
//! a product Consumer, nor an all-domain Native reference closure.
use super::{ProductSession, WorkerEnvelope};
use super::indexed_read::{roots, skip_ws, string_end, value_end, validate_scope, Span};
use crate::{CoreError,CoreResult};
use std::collections::{BTreeSet,HashMap};

const MAX_KEY_BYTES: usize=128;
const MAX_RECORDS: usize=1_000_000;
const JS_SAFE_INTEGER: u64=9_007_199_254_740_991;
fn fail(s:&'static str)->CoreError{CoreError(s)}
fn number(bytes:&[u8],span:Span)->CoreResult<u64>{
    let n: u64=serde_json::from_slice(&bytes[span.begin..span.end])
        .map_err(|_|fail("NATIVE_REF_TYPED_INTEGER_REQUIRED"))?;
    if n>JS_SAFE_INTEGER{return Err(fail("NATIVE_REF_INTEGER_BOUNDS"));}
    Ok(n)
}
fn canonical_key(key:&str)->CoreResult<u64>{
    if key.is_empty()||key.len()>20||key.as_bytes().iter().any(|b|!b.is_ascii_digit()){
        return Err(fail("NATIVE_REF_NONCANONICAL_KEY"));
    }
    let n=key.parse::<u64>().map_err(|_|fail("NATIVE_REF_KEY_OVERFLOW"))?;
    if n>JS_SAFE_INTEGER||n.to_string()!=key{
        return Err(fail("NATIVE_REF_NONCANONICAL_KEY"));
    }
    Ok(n)
}
fn count(n:&mut usize)->CoreResult<()>{
    *n=n.checked_add(1).ok_or(fail("NATIVE_REF_COUNT_OVERFLOW"))?;
    if *n>MAX_RECORDS{return Err(fail("NATIVE_REF_COUNT_BOUNDS"));}
    Ok(())
}
// The strict whole-document JSON validator ran before ProductSession opened.
// This walker reuses the already-accepted lexical span parser, never builds a
// serde_json::Value tree or exports original text to JS/UI.
fn object<F>(b:&[u8],s:Span,mut visit:F)->CoreResult<()>
where F:FnMut(String,Span)->CoreResult<()>{
    if b.get(s.begin)!=Some(&b'{')||b.get(s.end-1)!=Some(&b'}'){
        return Err(fail("NATIVE_REF_OBJECT_REQUIRED"));
    }
    let mut i=s.begin+1;
    loop{
        i=skip_ws(b,i);
        if i==s.end-1{return Ok(());}
        let begin=i;
        let end=string_end(b,i)?;
        if end-begin>MAX_KEY_BYTES{return Err(fail("NATIVE_REF_KEY_BOUNDS"));}
        let key:String=serde_json::from_slice(&b[begin..end])
            .map_err(|_|fail("NATIVE_REF_KEY_INVALID"))?;
        i=skip_ws(b,end);
        if b.get(i)!=Some(&b':'){return Err(fail("NATIVE_REF_COLON"));}
        i=skip_ws(b,i+1);
        let last=value_end(b,i)?;
        if last>=s.end{return Err(fail("NATIVE_REF_OUTSIDE_OBJECT"));}
        visit(key,Span{begin:i,end:last})?;
        i=skip_ws(b,last);
        match b.get(i){
            Some(b',')=>i+=1,
            Some(b'}') if i==s.end-1=>return Ok(()),
            _=>return Err(fail("NATIVE_REF_OBJECT_DELIMITER")),
        }
    }
}
fn array<F>(b:&[u8],s:Span,mut visit:F)->CoreResult<()>
where F:FnMut(Span)->CoreResult<()>{
    if b.get(s.begin)!=Some(&b'[')||b.get(s.end-1)!=Some(&b']'){
        return Err(fail("NATIVE_REF_ARRAY_REQUIRED"));
    }
    let mut i=s.begin+1;
    loop{
        i=skip_ws(b,i);
        if i==s.end-1{return Ok(());}
        let end=value_end(b,i)?;
        if end>=s.end{return Err(fail("NATIVE_REF_OUTSIDE_ARRAY"));}
        visit(Span{begin:i,end})?;
        i=skip_ws(b,end);
        match b.get(i){
            Some(b',')=>i+=1,
            Some(b']') if i==s.end-1=>return Ok(()),
            _=>return Err(fail("NATIVE_REF_ARRAY_DELIMITER")),
        }
    }
}
fn field(b:&[u8],s:Span,name:&str)->CoreResult<Option<Span>>{
    let mut result=None;
    object(b,s,|key,val|{
        if key==name {
            if result.replace(val).is_some(){return Err(fail("NATIVE_REF_FIELD_DUPLICATE"));}
        }
        Ok(())
    })?;
    Ok(result)
}
fn required(b:&[u8],s:Span,name:&str)->CoreResult<Span>{
    field(b,s,name)?.ok_or(fail("NATIVE_REF_REQUIRED_FIELD_MISSING"))
}
/// Only direct village Area/Grid + optional FloatingIsland/Grid structural links,
/// and per-Grid ObjectID identity. Map absence remains UNKNOWN, never 0 verified.
/// Other World refs (Group, SubGrid, Footprint, Quest, Clock etc.) are UNKNOWN.
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct NativeAreaGridSliceReceipt {
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub decoded_sha256:[u8;32],
    pub village_records:usize,
    pub area_records:usize,
    pub grid_records:usize,
    pub direct_area_grid_links:usize,
    pub grid_object_identity_records:usize,
    pub floating_island_map_present:bool,
    pub floating_island_records:usize,
    pub floating_island_direct_grid_links:usize,
    pub direct_root_ownership_unique:bool,
    pub full_native_reference_closure_verified:bool,
    pub area_group_footprint_verified:bool,
    pub native_v3_verified:bool,
    pub product_read_accepted:bool,
    pub writer_authorized:bool,
}
impl ProductSession {
    /// Opt-in, PRIVATE NATIVE feature only. No UI cursor or client-supplied
    /// path/readset; a Rust-owned Session/Revision/Generation/SHA CAS is required.
    /// The mutex linearizes the scan against Close/Stage/Undo/Redo.
    pub fn verify_native_area_grid_slice(
        &self,scope:WorkerEnvelope
    )->CoreResult<NativeAreaGridSliceReceipt>{
        let state=self.lock()?;
        validate_scope(self,&state,&scope)?;
        // The existing index scanner supplies the World root span.
        let b:&[u8]=&self.decoded;
        let world=roots(b)?.world;
        let grid_collection=required(b,world,"GridCollection")?;
        let grids=required(b,grid_collection,"Grids")?;
        let villages=required(b,world,"Villages")?;
        let mut grid_ids=HashMap::<u64,()>::new();
        let mut grid_count=0;
        let mut object_count=0;
        object(b,grids,|key,grid|{
            count(&mut grid_count)?;
            let id=canonical_key(&key)?;
            if number(b,required(b,grid,"ID")?)?!=id{
                return Err(fail("NATIVE_REF_GRID_KEY_ID_MISMATCH"));
            }
            if grid_ids.insert(id,()).is_some(){
                return Err(fail("NATIVE_REF_DUPLICATE_GRID_ID"));
            }
            if let Some(objects)=field(b,grid,"Objects")?{
                let mut per_grid=BTreeSet::new();
                object(b,objects,|key,item|{
                    count(&mut object_count)?;
                    let id=canonical_key(&key)?;
                    if number(b,required(b,item,"ID")?)?!=id{
                        return Err(fail("NATIVE_REF_OBJECT_KEY_ID_MISMATCH"));
                    }
                    if !per_grid.insert(id){
                        return Err(fail("NATIVE_REF_DUPLICATE_OBJECT_ID"));
                    }
                    Ok(())
                })?;
            }
            Ok(())
        })?;
        let mut village_count=0;
        let mut area_count=0;
        let mut links=0;
        // This is a conservative direct-root key uniqueness check only.
        // It does not infer Native Area/Island/Group layout semantics.
        let mut owned_direct_root_ids=BTreeSet::<u64>::new();
        array(b,villages,|village|{
            count(&mut village_count)?;
            if let Some(areas)=field(b,village,"Areas")?{
                object(b,areas,|area_key,area|{
                    count(&mut area_count)?;
                    canonical_key(&area_key)?;
                    let grid_array=required(b,area,"GridIDs")?;
                    let mut within_area=BTreeSet::new();
                    array(b,grid_array,|value|{
                        count(&mut links)?;
                        let id=number(b,value)?;
                        if !grid_ids.contains_key(&id){
                            return Err(fail("NATIVE_REF_ORPHAN_AREA_GRID"));
                        }
                        if !within_area.insert(id){
                            return Err(fail("NATIVE_REF_DUPLICATE_AREA_GRID_LINK"));
                        }
                        if !owned_direct_root_ids.insert(id){
                            return Err(fail("NATIVE_REF_CROSS_LOCATION_ROOT_ALIAS"));
                        }
                        Ok(())
                    })?;
                    Ok(())
                })?;
            }
            Ok(())
        })?;
        // FloatingIslands is optional in a strict document. Its absence is
        // explicitly UNKNOWN rather than a zero-record complete-domain proof.
        // Present records MUST have exact SceneItemId/key and typed GridIDs.
        // No assumption is made that an empty/locked Island is a usable route.
        let floating_map=field(b,world,"FloatingIslands")?;
        let mut floating_records=0usize;
        let mut floating_links=0usize;
        if let Some(floating)=floating_map {
            object(b,floating,|key,island|{
                count(&mut floating_records)?;
                let scene_id=canonical_key(&key)?;
                if scene_id==0 {return Err(fail("NATIVE_REF_ISLAND_SCENE_ID_ZERO"));}
                if number(b,required(b,island,"SceneItemId")?)?!=scene_id{
                    return Err(fail("NATIVE_REF_ISLAND_SCENE_KEY_ID_MISMATCH"));
                }
                let direct=required(b,island,"GridIDs")?;
                let mut local=BTreeSet::new();
                array(b,direct,|raw|{
                    count(&mut floating_links)?;
                    let grid_id=number(b,raw)?;
                    if !grid_ids.contains_key(&grid_id){
                        return Err(fail("NATIVE_REF_ORPHAN_FLOATING_GRID"));
                    }
                    if !local.insert(grid_id){
                        return Err(fail("NATIVE_REF_DUPLICATE_FLOATING_GRID_LINK"));
                    }
                    if !owned_direct_root_ids.insert(grid_id){
                        return Err(fail("NATIVE_REF_CROSS_LOCATION_ROOT_ALIAS"));
                    }
                    Ok(())
                })?;
                Ok(())
            })?;
        }
        Ok(NativeAreaGridSliceReceipt{
            session_id:state.id,revision:state.revision,
            index_generation:state.generation,decoded_sha256:self.sha,
            village_records:village_count,area_records:area_count,
            grid_records:grid_count,direct_area_grid_links:links,
            grid_object_identity_records:object_count,
            floating_island_map_present:floating_map.is_some(),
            floating_island_records:floating_records,
            floating_island_direct_grid_links:floating_links,
            direct_root_ownership_unique:floating_map.is_some(),
            full_native_reference_closure_verified:false,
            area_group_footprint_verified:false,native_v3_verified:false,
            product_read_accepted:false,writer_authorized:false,
        })
    }
}

/// 01B native PRIVATE source-owned stored GridObject old fields, not edit authority.
/// A caller may choose an ID, but cannot forge a field value on this receipt.
/// It is deliberately crate-only: the UI/Worker has no such capability and
/// 01A must explicitly bind a future typed Read before exposing any fields.
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub(crate) struct NativeStoredModifiedObjectWitness {
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub decoded_sha256:[u8;32],
    pub grid_id:u32,
    pub object_id:u32,
    pub item_id:i32,
    pub old_x:i32,
    pub old_y:i32,
    pub old_orientation:u8,
    pub state_field_present:bool,
    pub source_oneof_present:bool,
    pub stored_modified_identity_and_old_values_verified:bool,
    pub removed_overlap_excluded:bool,
    pub native_parent_subgrid_verified:bool,
    pub native_gridarea_footprint_verified:bool,
    pub native_floor_and_gridcells_verified:bool,
    pub native_item_edit_restrictions_verified:bool,
    pub native_placement_legal:bool,
    pub writer_authorized:bool,
}
fn stored_i32(bytes:&[u8],span:Span)->CoreResult<i32>{
    serde_json::from_slice::<i32>(&bytes[span.begin..span.end])
        .map_err(|_|fail("SPATIAL_STORED_I32_REQUIRED"))
}
/// Read from the SAME validated ProductSession, not a second parser/session.
/// Owner-private native feature only. The selected existing ModifiedObjects
/// object is rejected if it is also in RemovedObjects. No default-layout
/// object is cloned or created. Presence alone does NOT verify Parent,
/// ItemDB restrictions, Native GridCells, GridArea masks or collision.
/// Every positive result remains explicitly non-Writer.
impl ProductSession {
    pub(crate) fn read_native_stored_modified_object(
        &self,scope:WorkerEnvelope,grid_id:u32,object_id:u32
    )->CoreResult<NativeStoredModifiedObjectWitness>{
        let state=self.lock()?;
        validate_scope(self,&state,&scope)?;
        const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
        let build=&self.native_source_build;
        if build.platform!=crate::Platform::SteamWindows ||
           build.build_kind!=crate::BuildKind::SteamFullVersion ||
           build.build_id!=STEAM || build.schema!=626 || !build.externally_attested {
            return Err(fail("SPATIAL_STORED_STEAM_EXACT_BUILD_REQUIRED"));
        }
        let b:&[u8]=&self.decoded;
        let world=roots(b)?.world;
        let collection=required(b,world,"GridCollection")?;
        let diffs=required(b,collection,"DiffGrids")?;
        let mut target=None;
        object(b,diffs,|key,span|{
            let key_id=canonical_key(&key)?;
            // Distinct JSON keys can alias the same stored Native identity.
            // Validate every map record, not only the selected key.
            if key_id>u64::from(u32::MAX) ||
               number(b,required(b,span,"ID")?)?!=key_id {
                return Err(fail("SPATIAL_STORED_GRID_KEY_ID_MISMATCH"));
            }
            if key_id==u64::from(grid_id) {
                if target.replace(span).is_some(){
                    return Err(fail("SPATIAL_STORED_DUPLICATE_GRID"));
                }
            }
            Ok(())
        })?;
        let grid=target.ok_or(fail("SPATIAL_STORED_GRID_NOT_FOUND"))?;
        if number(b,required(b,grid,"ID")?)?!=u64::from(grid_id){
            return Err(fail("SPATIAL_STORED_GRID_KEY_ID_MISMATCH"));
        }
        let modified=required(b,grid,"ModifiedObjects")?;
        let mut item=None;
        object(b,modified,|key,span|{
            let key_id=canonical_key(&key)?;
            if key_id>u64::from(u32::MAX) ||
               number(b,required(b,span,"ID")?)?!=key_id {
                return Err(fail("SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH"));
            }
            if key_id==u64::from(object_id){
                if item.replace(span).is_some(){
                    return Err(fail("SPATIAL_STORED_DUPLICATE_OBJECT"));
                }
            }
            Ok(())
        })?;
        let saved=item.ok_or(fail("SPATIAL_STORED_MODIFIED_OBJECT_NOT_FOUND"))?;
        if number(b,required(b,saved,"ID")?)?!=u64::from(object_id){
            return Err(fail("SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH"));
        }
        if let Some(removed)=field(b,grid,"RemovedObjects")?{
            let mut overlaps=false;
            match b[removed.begin]{
                b'[' => array(b,removed,|raw|{
                    if number(b,raw)?==u64::from(object_id){overlaps=true;}
                    Ok(())
                })?,
                b'{' => object(b,removed,|key,raw|{
                    canonical_key(&key)?;
                    if number(b,raw)?==u64::from(object_id){overlaps=true;}
                    Ok(())
                })?,
                _=>return Err(fail("SPATIAL_STORED_REMOVED_SHAPE_INVALID")),
            }
            if overlaps{return Err(fail("SPATIAL_STORED_MODIFIED_REMOVED_OVERLAP"));}
        }
        let item_id=stored_i32(b,required(b,saved,"ItemID")?)?;
        let old_x=stored_i32(b,required(b,saved,"X")?)?;
        let old_y=stored_i32(b,required(b,saved,"Y")?)?;
        let orientation_span=required(b,saved,"Orientation")?;
        // Steam626 protobuf OriginalName string; numeric enum is not the stored contract.
        let orientation_name: String=serde_json::from_slice(&b[orientation_span.begin..orientation_span.end])
            .map_err(|_|fail("SPATIAL_STORED_ORIENTATION_STRING_REQUIRED"))?;
        let old_orientation=match orientation_name.as_str(){
            "GridOrientation_Up"=>0,
            "GridOrientation_UpUpRight"=>1,
            "GridOrientation_UpRight"=>2,
            "GridOrientation_UpRightRight"=>3,
            "GridOrientation_Right"=>4,
            "GridOrientation_DownRightRight"=>5,
            "GridOrientation_DownRight"=>6,
            "GridOrientation_DownDownRight"=>7,
            "GridOrientation_Down"=>8,
            "GridOrientation_DownDownLeft"=>9,
            "GridOrientation_DownLeft"=>10,
            "GridOrientation_DownLeftLeft"=>11,
            "GridOrientation_Left"=>12,
            "GridOrientation_UpLeftLeft"=>13,
            "GridOrientation_UpLeft"=>14,
            "GridOrientation_UpUpLeft"=>15,
            _=>return Err(fail("SPATIAL_STORED_ORIENTATION_UNDEFINED")),
        };
        let state_field_present=field(b,saved,"State")?.is_some();
        let source_oneof_present=field(b,saved,"From")?.is_some();
        Ok(NativeStoredModifiedObjectWitness{
            session_id:state.id,revision:state.revision,
            index_generation:state.generation,decoded_sha256:self.sha,
            grid_id,object_id,item_id,old_x,old_y,
            old_orientation,
            state_field_present,source_oneof_present,
            stored_modified_identity_and_old_values_verified:true,
            removed_overlap_excluded:true,
            native_parent_subgrid_verified:false,
            native_gridarea_footprint_verified:false,
            native_floor_and_gridcells_verified:false,
            native_item_edit_restrictions_verified:false,
            native_placement_legal:false,
            writer_authorized:false,
        })
    }
}

#[cfg(test)]
mod tests{
    use super::*;
    use crate::{BuildIdentity,BuildKind,Platform,WorkerAction,PRODUCT_WORKER_CONTRACT};
    const VALID:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"Villages":[{"Areas":{"1":{"GridIDs":[7]}}}],"GridCollection":{"Grids":{"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":100}}}}}}}"#;
    fn session(s:&str)->ProductSession{
        ProductSession::open_decoded_readonly(s.as_bytes().to_vec(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
            schema:626,externally_attested:true
        }).unwrap()
    }
    fn scope(s:&ProductSession)->WorkerEnvelope{
        let r=s.receipt().unwrap();
        WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain,
        }
    }
    #[test]
    fn real_scanner_direct_area_to_grid_and_object_identity_only(){
        let s=session(VALID);
        let r=s.verify_native_area_grid_slice(scope(&s)).unwrap();
        assert_eq!((r.village_records,r.area_records,r.grid_records,r.direct_area_grid_links,r.grid_object_identity_records),(1,1,1,1,1));
        assert!(!r.full_native_reference_closure_verified&&!r.area_group_footprint_verified&&!r.native_v3_verified&&!r.product_read_accepted&&!r.writer_authorized);
    }
    #[test]
    fn orphan_duplicate_malformed_and_unknown_ids_fail_closed(){
        let cases=[
            VALID.replace("\"GridIDs\":[7]","\"GridIDs\":[8]"),
            VALID.replace("\"GridIDs\":[7]","\"GridIDs\":[7,7]"),
            VALID.replace("\"GridIDs\":[7]","\"GridIDs\":[\"7\"]"),
            VALID.replace("\"GridIDs\":[7]","\"GridIDs\":null"),
            VALID.replace("\"7\":{\"ID\":7","\"7\":{\"ID\":6"),
            VALID.replace("\"4\":{\"ID\":4","\"4\":{\"ID\":5"),
            VALID.replace("\"4\":{\"ID\":4,\"ItemID\":100}","\"4\":{\"ID\":4},\"04\":{\"ID\":4}"),
            VALID.replace("\"1\":{\"GridIDs\"","\"01\":{\"GridIDs\""),
            VALID.replace("\"Villages\":[{\"Areas\":{\"1\":{\"GridIDs\":[7]}}}]","\"Villages\":{}"),
        ];
        for input in cases {
            let s=session(&input);
            assert!(s.verify_native_area_grid_slice(scope(&s)).is_err(),"bad scoped record must deny");
        }
    }
    #[test]
    fn floating_island_direct_grid_links_are_typed_and_scoped_only(){
        let with_other_grid=VALID.replace(
            "\"7\":{\"ID\":7,\"Objects\":{\"4\":{\"ID\":4,\"ItemID\":100}}}",
            "\"7\":{\"ID\":7,\"Objects\":{\"4\":{\"ID\":4,\"ItemID\":100}}},\"8\":{\"ID\":8,\"Objects\":{}}"
        );
        let valid=with_other_grid.replace(
            "\"GridCollection\":",
            "\"FloatingIslands\":{\"1540000147\":{\"SceneItemId\":1540000147,\"GridIDs\":[8]}},\"GridCollection\":"
        );
        let s=session(&valid);
        let got=s.verify_native_area_grid_slice(scope(&s)).unwrap();
        assert!(got.floating_island_map_present&&got.direct_root_ownership_unique);
        assert_eq!((got.floating_island_records,got.floating_island_direct_grid_links),(1,1));
        assert!(!got.full_native_reference_closure_verified);
        assert!(!got.area_group_footprint_verified&&!got.native_v3_verified);
        assert!(!got.product_read_accepted&&!got.writer_authorized);
        let bad=[
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":[9]"), // orphan
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":[8,8]"), // duplicate
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":[7]"), // cross Area
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":[\"8\"]"), // type
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":null"), // unknown
            valid.replace("\"SceneItemId\":1540000147","\"SceneItemId\":1540000148"),
            valid.replace("\"1540000147\":{\"SceneItemId\"","\"01540000147\":{\"SceneItemId\""),
            valid.replace("\"FloatingIslands\":{","\"FloatingIslands\":["), // wrong map
        ];
        for input in bad {
            // Invalid entire-document syntax is a valid strict-open denial.
            if let Ok(rejected)=ProductSession::open_decoded_readonly(
                input.into_bytes(),BuildIdentity{
                    platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
                    build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
                    schema:626,externally_attested:true
                }
            ){
                assert!(rejected.verify_native_area_grid_slice(scope(&rejected)).is_err());
            }
        }
        let missing=session(VALID);
        let m=missing.verify_native_area_grid_slice(scope(&missing)).unwrap();
        assert!(!m.floating_island_map_present&&!m.direct_root_ownership_unique);
        assert_eq!(m.floating_island_records,0);
    }
    #[test]
    fn shared_root_between_two_village_areas_is_conservatively_denied(){
        let two=VALID.replace(
            "\"1\":{\"GridIDs\":[7]}",
            "\"1\":{\"GridIDs\":[7]},\"2\":{\"GridIDs\":[7]}"
        );
        let s=session(&two);
        assert!(s.verify_native_area_grid_slice(scope(&s)).is_err());
    }
    #[test]
    fn foreign_stale_action_and_closed_session_fail_closed(){
        let s=session(VALID);
        let e=scope(&s);
        let mut stale=e;stale.expected_revision+=1;
        assert!(s.verify_native_area_grid_slice(stale).is_err());
        let mut invalid=e;invalid.expected_index_generation+=1;
        assert!(s.verify_native_area_grid_slice(invalid).is_err());
        let mut forbidden=e;forbidden.action=WorkerAction::Stage;
        assert!(s.verify_native_area_grid_slice(forbidden).is_err());
        let other=session(VALID);
        assert!(s.verify_native_area_grid_slice(scope(&other)).is_err());
        s.close().unwrap();
        assert!(s.verify_native_area_grid_slice(e).is_err());
    }

    const STORED_MODIFIED:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"DiffGrids":{"7":{"ID":7,"ModifiedObjects":{"4":{"ID":4,"ItemID":100,"X":2,"Y":-1,"Orientation":"GridOrientation_Right"}},"RemovedObjects":[]}}}}}"#;
    #[test]
    fn modified_existing_real_source_old_transform_only_not_native_legal(){
        let s=session(STORED_MODIFIED);
        let out=s.read_native_stored_modified_object(scope(&s),7,4).unwrap();
        assert_eq!((out.grid_id,out.object_id,out.item_id,out.old_x,out.old_y,out.old_orientation),(7,4,100,2,-1,4));
        assert!(out.stored_modified_identity_and_old_values_verified&&out.removed_overlap_excluded);
        assert!(!out.state_field_present&&!out.source_oneof_present);
        assert!(!out.native_parent_subgrid_verified&&!out.native_gridarea_footprint_verified);
        assert!(!out.native_floor_and_gridcells_verified&&!out.native_item_edit_restrictions_verified);
        assert!(!out.native_placement_legal&&!out.writer_authorized);
        let receipt=s.receipt().unwrap();
        assert_eq!((out.session_id,out.revision,out.index_generation,out.decoded_sha256),
            (receipt.session_id,receipt.revision,receipt.index_generation,receipt.decoded_sha256));
    }
    #[test]
    fn forged_key_and_inner_id_rejected_instead_of_ui_assertion(){
        let s=session(STORED_MODIFIED);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,99).unwrap_err().0,
            "SPATIAL_STORED_MODIFIED_OBJECT_NOT_FOUND");
        assert_eq!(s.read_native_stored_modified_object(scope(&s),8,4).unwrap_err().0,
            "SPATIAL_STORED_GRID_NOT_FOUND");
        let fake=STORED_MODIFIED.replace("\"4\":{\"ID\":4","\"4\":{\"ID\":5");
        let s=session(&fake);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,
            "SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH");
        let fake=STORED_MODIFIED.replace("\"7\":{\"ID\":7","\"7\":{\"ID\":8");
        let s=session(&fake);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,
            "SPATIAL_STORED_GRID_KEY_ID_MISMATCH");
    }
    #[test]
    fn overlap_bad_orientation_and_missing_old_fields_rejected(){
        for removed in ["[4]","{\"0\":4}"]{
            let changed=STORED_MODIFIED.replace("\"RemovedObjects\":[]",
                &format!("\"RemovedObjects\":{removed}"));
            let s=session(&changed);
            assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,
                "SPATIAL_STORED_MODIFIED_REMOVED_OVERLAP");
        }
        let wrong=STORED_MODIFIED.replace("\"GridOrientation_Right\"","\"GridOrientation_Unknown\"");
        let s=session(&wrong);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,
            "SPATIAL_STORED_ORIENTATION_UNDEFINED");
        let missing=STORED_MODIFIED.replace("\"X\":2,","");
        let s=session(&missing);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,
            "NATIVE_REF_REQUIRED_FIELD_MISSING");
        let wrong=STORED_MODIFIED.replace("\"ItemID\":100","\"ItemID\":\"100\"");
        let s=session(&wrong);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,
            "SPATIAL_STORED_I32_REQUIRED");
    }
    #[test]
    fn all_diffgrid_and_selected_modified_map_identities_are_unambiguous(){
        let grid7=r#""7":{"ID":7,"ModifiedObjects":{"4":{"ID":4,"ItemID":100,"X":2,"Y":-1,"Orientation":"GridOrientation_Right"}},"RemovedObjects":[]}"#;
        let good=STORED_MODIFIED.replace(grid7,&format!("{},\"8\":{{\"ID\":8,\"ModifiedObjects\":{{}},\"RemovedObjects\":[]}}",grid7));
        assert_ne!(good,STORED_MODIFIED);
        let s=session(&good);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap().object_id,4);
        let bad=good.replace("\"8\":{\"ID\":8","\"8\":{\"ID\":7");
        let s=session(&bad);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,"SPATIAL_STORED_GRID_KEY_ID_MISMATCH");
        let good=STORED_MODIFIED.replace("\"Orientation\":\"GridOrientation_Right\"}}","\"Orientation\":\"GridOrientation_Right\"},\"5\":{\"ID\":5,\"ItemID\":101,\"X\":3,\"Y\":4,\"Orientation\":\"GridOrientation_Up\"}}");
        assert_ne!(good,STORED_MODIFIED);
        let s=session(&good);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap().object_id,4);
        let bad=good.replace("\"5\":{\"ID\":5","\"5\":{\"ID\":4");
        let s=session(&bad);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,"SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH");
        let bad=good.replace("\"5\":{\"ID\":5","\"4294967296\":{\"ID\":4294967296");
        let s=session(&bad);
        assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap_err().0,"SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH");
    }

    #[test]
    fn steam626_original_orientation_names_only(){
        let names=["GridOrientation_Up","GridOrientation_UpUpRight","GridOrientation_UpRight","GridOrientation_UpRightRight","GridOrientation_Right","GridOrientation_DownRightRight","GridOrientation_DownRight","GridOrientation_DownDownRight","GridOrientation_Down","GridOrientation_DownDownLeft","GridOrientation_DownLeft","GridOrientation_DownLeftLeft","GridOrientation_Left","GridOrientation_UpLeftLeft","GridOrientation_UpLeft","GridOrientation_UpUpLeft"];
        for (index,name) in names.iter().enumerate(){
            let input=STORED_MODIFIED.replace("GridOrientation_Right",name);
            let s=session(&input);
            assert_eq!(s.read_native_stored_modified_object(scope(&s),7,4).unwrap().old_orientation,index as u8);
        }
        for bad in ["4","null","true","\"4\"","\"Right\"","\"GridOrientation_right\""]{
            let input=STORED_MODIFIED.replace("\"GridOrientation_Right\"",bad);
            let s=session(&input);
            assert!(s.read_native_stored_modified_object(scope(&s),7,4).is_err());
        }
    }
    #[test]
    fn state_source_flags_only_never_writer_or_native_consent(){
        let with_state=STORED_MODIFIED.replace(
            "\"Orientation\":\"GridOrientation_Right\"","\"Orientation\":\"GridOrientation_Right\",\"State\":{},\"From\":1");
        let s=session(&with_state);
        let r=s.read_native_stored_modified_object(scope(&s),7,4).unwrap();
        assert!(r.state_field_present&&r.source_oneof_present);
        assert!(!r.native_placement_legal&&!r.writer_authorized);
    }
    #[test]
    fn foreign_revision_generation_sha_action_closed_and_wrong_build_denied(){
        let s=session(STORED_MODIFIED);
        let mut e=scope(&s);e.expected_revision+=1;
        assert!(s.read_native_stored_modified_object(e,7,4).is_err());
        let mut e=scope(&s);e.expected_index_generation+=1;
        assert!(s.read_native_stored_modified_object(e,7,4).is_err());
        let mut e=scope(&s);e.expected_decoded_sha256=[0u8;32];
        assert!(s.read_native_stored_modified_object(e,7,4).is_err());
        let mut e=scope(&s);e.action=WorkerAction::Stage;
        assert!(s.read_native_stored_modified_object(e,7,4).is_err());
        let foreign=session(STORED_MODIFIED);
        assert!(s.read_native_stored_modified_object(scope(&foreign),7,4).is_err());
        let wrong=ProductSession::open_decoded_readonly(
            STORED_MODIFIED.as_bytes().to_vec(),
            BuildIdentity{
                platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
                build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true
            }
        ).unwrap();
        assert_eq!(wrong.read_native_stored_modified_object(scope(&wrong),7,4).unwrap_err().0,
            "SPATIAL_STORED_STEAM_EXACT_BUILD_REQUIRED");
        let valid_scope=scope(&s);
        s.close().unwrap();
        assert!(s.read_native_stored_modified_object(valid_scope,7,4).is_err());
    }

}
