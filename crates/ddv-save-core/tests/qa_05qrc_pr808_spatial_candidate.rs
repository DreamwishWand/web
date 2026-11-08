//! 05 QR-C independent changed-only Source PR808: candidate Spatial graph only.
//! PUBLIC SYNTHETIC. No real Save, second reader, writer, native geometry or new Session.
#![cfg(feature="indexed-read")]
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,SpatialAreaRef,SpatialCandidateIndex,
    SpatialExtent,SpatialGridRef,SpatialObjectKey,SpatialObjectRef,SpatialScope,
    SPATIAL_GRAPH_CONTRACT,MAX_SPATIAL_GRIDS,MAX_SPATIAL_OBJECTS,
};
type Fixture=(Vec<SpatialAreaRef>,Vec<SpatialGridRef>,Vec<SpatialObjectRef>);
fn build()->BuildIdentity{
    BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}
}
fn scope()->SpatialScope{
    SpatialScope{session_id:[0x31;16],revision:10,index_generation:4,decoded_sha256:[0x51;32]}
}
fn key(grid_id:u64,object_id:u64)->SpatialObjectKey{SpatialObjectKey{grid_id,object_id}}
fn bounds(w:u32,h:u32)->Option<SpatialExtent>{Some(SpatialExtent{width:w,height:h})}
fn grid(id:u64,parent:Option<SpatialObjectKey>,w:u32,h:u32)->SpatialGridRef{
    SpatialGridRef{grid_id:id,parent_object:parent,proposed_bounds:bounds(w,h)}
}
fn obj(grid_id:u64,object_id:u64,x:i64,y:i64,child:Option<u64>)->SpatialObjectRef{
    SpatialObjectRef{key:key(grid_id,object_id),item_id:1701,serialized_x:x,serialized_y:y,
        orientation:0,proposed_footprint:bounds(2,2),child_grid_id:child}
}
fn fixture()->Fixture{
    let mut child=obj(43,7,8,8,Some(44));
    child.orientation=15;
    (
      vec![
        SpatialAreaRef{village_index:0,area_key:1,root_grid_ids:vec![42]},
        SpatialAreaRef{village_index:1,area_key:1,root_grid_ids:vec![50]},
      ],
      vec![
        grid(42,None,10,10),
        grid(43,Some(key(42,7)),10,10),
        grid(44,Some(key(43,7)),6,6),
        grid(50,None,4,4),
      ],
      vec![
        obj(42,7,0,0,Some(43)),
        child,
        obj(44,7,4,4,None),
        obj(50,7,2,2,None),
      ]
    )
}
fn fail(f:Fixture,expected:&str){
    let err=SpatialCandidateIndex::validate(&build(),scope(),&f.0,&f.1,&f.2)
        .err().expect("invalid candidate graph must fail closed");
    assert_eq!(err.0,expected);
}
#[test]
fn qa808_valid_two_villages_nested_subgrids_grid_qualified_objectid_and_exact_edges(){
    let f=fixture();
    let index=SpatialCandidateIndex::validate(&build(),scope(),&f.0,&f.1,&f.2).unwrap();
    assert_eq!(SPATIAL_GRAPH_CONTRACT,"wand.core.01b.typed-spatial-subgraph@1");
    for (grid_id,root,village,area) in [(42,42,0,1),(43,42,0,1),(44,42,0,1),(50,50,1,1)]{
        let w=index.inspect(scope(),key(grid_id,7)).unwrap();
        assert_eq!((w.root_grid_id,w.area_village_index,w.area_key),(root,village,area));
        assert_eq!(w.object.key,key(grid_id,7));
        assert!(!w.source_session_authenticated && !w.native_layout_verified
            && !w.product_writer_authorized);
    }
    assert_eq!(index.inspect(scope(),key(43,7)).unwrap().object.orientation,15);
    assert!(index.graph_references_checked && index.asserted_footprint_bounds_checked);
    assert!(!index.full_native_reference_closure_verified);
    assert!(!index.source_session_authenticated && !index.native_layout_verified);
    assert!(!index.product_read_accepted && !index.product_writer_authorized);
    assert_eq!(index.inspect(scope(),key(42,8)).unwrap_err().0,"SPATIAL_OBJECT_ID_NOT_FOUND");
}
#[test]
fn qa808_orphan_duplication_root_owner_and_grid_key_ref_rejections(){
    let mut f=fixture();f.0[0].root_grid_ids=vec![999];fail(f,"SPATIAL_AREA_GRID_ORPHAN");
    let mut f=fixture();f.0[0].root_grid_ids.push(42);
    fail(f,"SPATIAL_DUPLICATE_AREA_GRID_OWNER");
    let mut f=fixture();f.0[1].root_grid_ids.push(42);
    fail(f,"SPATIAL_DUPLICATE_AREA_GRID_OWNER");
    let mut f=fixture();f.0.push(f.0[0].clone());
    fail(f,"SPATIAL_DUPLICATE_AREA_KEY");
    let mut f=fixture();f.1.push(f.1[0]);
    fail(f,"SPATIAL_DUPLICATE_GRID_ID");
    let mut f=fixture();f.2.push(f.2[0]);
    fail(f,"SPATIAL_DUPLICATE_OBJECT_ID_IN_GRID");
    let mut f=fixture();f.2.push(obj(999,7,0,0,None));
    fail(f,"SPATIAL_OBJECT_GRID_ORPHAN");
    let mut f=fixture();f.1.push(grid(99,None,5,5));
    fail(f,"SPATIAL_GRID_NOT_REACHABLE_FROM_AREA");
}
#[test]
fn qa808_parent_child_backrefs_cycle_and_root_subgrid_holds(){
    let mut f=fixture();f.2[0].child_grid_id=Some(999);
    fail(f,"SPATIAL_SUBGRID_ORPHAN");
    let mut f=fixture();f.1[1].parent_object=Some(key(42,999));
    fail(f,"SPATIAL_SUBGRID_PARENT_MISMATCH");
    let mut f=fixture();f.2[0].child_grid_id=None;
    fail(f,"SPATIAL_SUBGRID_BACKREFERENCE_MISMATCH");
    let mut f=fixture();f.0[0].root_grid_ids.push(43);
    fail(f,"SPATIAL_ROOT_SUBGRID_OWNERSHIP_CONFLICT");
    let mut f=fixture();
    f.1.push(grid(70,Some(key(71,9)),5,5));
    f.1.push(grid(71,Some(key(70,9)),5,5));
    f.2.push(obj(70,9,0,0,Some(71)));
    f.2.push(obj(71,9,0,0,Some(70)));
    fail(f,"SPATIAL_SUBGRID_PARENT_CYCLE");
}
#[test]
fn qa808_footprint_i64_checked_xy_bounds_orientation_and_missing_proposal(){
    let mut f=fixture();f.2[0].serialized_x=i64::MAX;
    fail(f,"SPATIAL_FOOTPRINT_OVERFLOW");
    let mut f=fixture();f.2[0].serialized_y=i64::MAX;
    fail(f,"SPATIAL_FOOTPRINT_OVERFLOW");
    let mut f=fixture();f.2[0].serialized_x=9;
    fail(f,"SPATIAL_FOOTPRINT_OUT_OF_BOUNDS");
    let mut f=fixture();f.2[0].serialized_y=9;
    fail(f,"SPATIAL_FOOTPRINT_OUT_OF_BOUNDS");
    let mut f=fixture();f.2[0].serialized_x=-1;
    fail(f,"SPATIAL_COORDINATE_NEGATIVE");
    let mut f=fixture();f.2[0].serialized_y=-1;
    fail(f,"SPATIAL_COORDINATE_NEGATIVE");
    let mut f=fixture();f.2[0].orientation=16;
    fail(f,"SPATIAL_ORIENTATION_OUT_OF_RANGE");
    let mut f=fixture();f.2[0].proposed_footprint=None;
    fail(f,"SPATIAL_FOOTPRINT_UNKNOWN");
    let mut f=fixture();f.2[0].proposed_footprint=bounds(0,2);
    fail(f,"SPATIAL_FOOTPRINT_INVALID");
    let mut f=fixture();f.1[0].proposed_bounds=None;
    fail(f,"SPATIAL_BOUNDS_UNKNOWN");
    let mut f=fixture();f.1[0].proposed_bounds=bounds(0,10);
    fail(f,"SPATIAL_BOUNDS_INVALID");
}
#[test]
fn qa808_untrusted_scope_is_comparison_only_never_core_session_auth(){
    let f=fixture();
    for bad in [
        SpatialScope{session_id:[0;16],..scope()},
        SpatialScope{decoded_sha256:[0;32],..scope()},
        SpatialScope{index_generation:0,..scope()},
    ]{
        assert_eq!(SpatialCandidateIndex::validate(&build(),bad,&f.0,&f.1,&f.2)
             .err().unwrap().0,"SPATIAL_SCOPE_INVALID");
    }
    let idx=SpatialCandidateIndex::validate(&build(),scope(),&f.0,&f.1,&f.2).unwrap();
    for bad in [
        SpatialScope{session_id:[0x32;16],..scope()},
        SpatialScope{revision:11,..scope()},
        SpatialScope{index_generation:5,..scope()},
        SpatialScope{decoded_sha256:[0x52;32],..scope()},
    ]{
        assert_eq!(idx.inspect(bad,key(42,7)).unwrap_err().0,
             "SPATIAL_SCOPE_REVISION_OR_SHA_STALE");
    }
    // A nonzero forged *matching* token can validate the candidate graph.
    // That is NOT a proof of ProductSession authentication, CAS, or native layout.
    let synthetic=SpatialScope{session_id:[0xab;16],revision:99,index_generation:3,
         decoded_sha256:[0xcd;32]};
    let candidate=SpatialCandidateIndex::validate(&build(),synthetic,&f.0,&f.1,&f.2).unwrap();
    assert!(candidate.inspect(synthetic,key(42,7)).is_ok());
    assert!(!candidate.source_session_authenticated && !candidate.product_read_accepted
            && !candidate.product_writer_authorized && !candidate.native_layout_verified);
    assert!(!candidate.inspect(scope(),key(42,7)).is_ok());
}
#[test]
fn qa808_switch_build_bid_schema_attestation_and_bounded_resource_gate(){
    let f=fixture();
    for build in [
      BuildIdentity{platform:Platform::SteamWindows,..build()},
      BuildIdentity{build_kind:BuildKind::SteamFullVersion,..build()},
      BuildIdentity{build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),..build()},
      BuildIdentity{build_id:"9A239D3DB569756E".into(),..build()},
      BuildIdentity{schema:624,..build()},
      BuildIdentity{externally_attested:false,..build()},
    ]{
      assert_eq!(SpatialCandidateIndex::validate(&build,scope(),&f.0,&f.1,&f.2)
           .err().unwrap().0,"SPATIAL_EXACT_SWITCH_BUILD_REQUIRED");
    }
    let mut f=fixture();f.0.clear();
    fail(f,"SPATIAL_TYPED_SCOPE_BUDGET");
    let mut f=fixture();f.1.clear();
    fail(f,"SPATIAL_TYPED_SCOPE_BUDGET");
    let mut f=fixture();
    for id in 100_000..100_000+(MAX_SPATIAL_GRIDS as u64) {
       f.1.push(grid(id,None,1,1));
    }
    fail(f,"SPATIAL_TYPED_SCOPE_BUDGET");
    let mut f=fixture();f.2.extend(
      (0..=MAX_SPATIAL_OBJECTS).map(|id|obj(42,id as u64 + 1_000_000,0,0,None))
    );
    fail(f,"SPATIAL_TYPED_SCOPE_BUDGET");
}
