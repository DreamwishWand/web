#![cfg(feature="indexed-read")]
use ddv_save_core::{
    BuildIdentity, BuildKind, Platform, SpatialAreaRef, SpatialCandidateIndex,
    SpatialExtent, SpatialGridRef, SpatialObjectKey, SpatialObjectRef, SpatialScope,
    SPATIAL_GRAPH_CONTRACT,
};
fn build() -> BuildIdentity {
    BuildIdentity {platform:Platform::Switch, build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}
}
fn scope() -> SpatialScope {
    SpatialScope {session_id:[1;16],revision:0,index_generation:1,decoded_sha256:[2;32]}
}
fn key(grid_id:u64,object_id:u64) -> SpatialObjectKey {
    SpatialObjectKey {grid_id,object_id}
}
fn obj(grid:u64,id:u64,x:i64,y:i64,child:Option<u64>) -> SpatialObjectRef {
    SpatialObjectRef {
        key:key(grid,id), item_id:31700014,serialized_x:x,serialized_y:y,
        orientation:0,proposed_footprint:Some(SpatialExtent{width:2,height:2}),
        child_grid_id:child
    }
}
fn fixture() -> (Vec<SpatialAreaRef>,Vec<SpatialGridRef>,Vec<SpatialObjectRef>) {
    (
        vec![SpatialAreaRef{village_index:0,area_key:5,root_grid_ids:vec![42]}],
        vec![
            SpatialGridRef{grid_id:42,proposed_bounds:Some(SpatialExtent{width:10,height:10}),parent_object:None},
            SpatialGridRef{grid_id:43,proposed_bounds:Some(SpatialExtent{width:5,height:5}),parent_object:Some(key(42,7))}
        ],
        vec![obj(42,7,1,2,Some(43)),obj(43,7,3,3,None)]
    )
}
fn deny(input:(Vec<SpatialAreaRef>,Vec<SpatialGridRef>,Vec<SpatialObjectRef>),code:&str){
    let err=SpatialCandidateIndex::validate(&build(),scope(),&input.0,&input.1,&input.2)
        .err().expect("invalid source must fail closed");
    assert_eq!(err.0,code);
}
#[test]
fn scoped_native_ids_are_grid_qualified_parent_bound_but_never_authorize_writer(){
    let (areas,grids,objects)=fixture();
    let index=SpatialCandidateIndex::validate(&build(),scope(),&areas,&grids,&objects).unwrap();
    let hit=index.inspect(scope(),key(43,7)).unwrap();
    assert_eq!(SPATIAL_GRAPH_CONTRACT,"wand.core.01b.typed-spatial-subgraph@1");
    assert_eq!(hit.root_grid_id,42);
    assert_eq!((hit.area_village_index,hit.area_key),(0,5));
    assert_eq!(hit.object.key,key(43,7)); // 42:o7 and 43:o7 are different.
    assert!(index.graph_references_checked && index.asserted_footprint_bounds_checked);
    assert!(!index.full_native_reference_closure_verified);
    assert!(!index.native_layout_verified && !index.source_session_authenticated);
    assert!(!index.product_read_accepted && !index.product_writer_authorized);
    assert!(!hit.product_writer_authorized);
    assert!(index.inspect(scope(),key(99,7)).is_err());
}
#[test]
fn orphan_ownership_wrong_parent_and_wrong_subgrid_fail_closed(){
    let mut a=fixture();a.0[0].root_grid_ids=vec![999];
    deny(a,"SPATIAL_AREA_GRID_ORPHAN");
    let mut a=fixture();a.1[1].parent_object=Some(key(42,8));
    deny(a,"SPATIAL_SUBGRID_PARENT_MISMATCH");
    let mut a=fixture();a.2[0].child_grid_id=Some(999);
    deny(a,"SPATIAL_SUBGRID_ORPHAN");
    let mut a=fixture();a.0.clear();
    deny(a,"SPATIAL_TYPED_SCOPE_BUDGET");
    let mut a=fixture();a.1.push(SpatialGridRef {
        grid_id:45,proposed_bounds:Some(SpatialExtent{width:1,height:1}),parent_object:None
    });
    deny(a,"SPATIAL_GRID_NOT_REACHABLE_FROM_AREA");
}
#[test]
fn duplicate_grid_object_area_and_parent_edges_fail_closed(){
    let mut a=fixture();a.2.push(a.2[0]);
    deny(a,"SPATIAL_DUPLICATE_OBJECT_ID_IN_GRID");
    let mut a=fixture();a.1.push(a.1[0]);
    deny(a,"SPATIAL_DUPLICATE_GRID_ID");
    let mut a=fixture();a.0[0].root_grid_ids.push(42);
    deny(a,"SPATIAL_DUPLICATE_AREA_GRID_OWNER");
    let mut a=fixture();a.0.push(a.0[0].clone());
    deny(a,"SPATIAL_DUPLICATE_AREA_KEY");
    let mut a=fixture();a.2.push(obj(42,8,0,0,Some(43)));
    deny(a,"SPATIAL_SUBGRID_PARENT_MISMATCH");
}
#[test]
fn footprint_negative_offset_unknown_and_outside_proposed_bounds_reject(){
    let mut a=fixture();a.2[0].serialized_x=-1;
    deny(a,"SPATIAL_COORDINATE_NEGATIVE");
    let mut a=fixture();a.2[0].serialized_x=9;
    deny(a,"SPATIAL_FOOTPRINT_OUT_OF_BOUNDS");
    let mut a=fixture();a.2[1].serialized_y=i64::MAX;
    deny(a,"SPATIAL_FOOTPRINT_OVERFLOW");
    let mut a=fixture();a.2[0].proposed_footprint=None;
    deny(a,"SPATIAL_FOOTPRINT_UNKNOWN");
    let mut a=fixture();a.1[0].proposed_bounds=None;
    deny(a,"SPATIAL_BOUNDS_UNKNOWN");
    let mut a=fixture();a.2[1].orientation=16;
    deny(a,"SPATIAL_ORIENTATION_OUT_OF_RANGE");
}
#[test]
fn cycles_root_subgrid_conflict_and_stale_revision_are_denied(){
    let mut a=fixture();a.0[0].root_grid_ids.push(43);
    deny(a,"SPATIAL_ROOT_SUBGRID_OWNERSHIP_CONFLICT");
    let mut a=fixture();
    a.1[0].parent_object=Some(key(43,7));
    a.2[1].child_grid_id=Some(42);
    // A cycle touching an Area root must fail even before reachability.
    assert!(SpatialCandidateIndex::validate(&build(),scope(),&a.0,&a.1,&a.2).is_err());
    // An isolated two-Grid cycle must produce the explicit cycle veto.
    let mut a=fixture();
    a.1.push(SpatialGridRef{grid_id:44,proposed_bounds:Some(SpatialExtent{width:4,height:4}),parent_object:Some(key(45,9))});
    a.1.push(SpatialGridRef{grid_id:45,proposed_bounds:Some(SpatialExtent{width:4,height:4}),parent_object:Some(key(44,9))});
    a.2.push(obj(44,9,0,0,Some(45)));
    a.2.push(obj(45,9,0,0,Some(44)));
    deny(a,"SPATIAL_SUBGRID_PARENT_CYCLE");
    let (areas,grids,objects)=fixture();
    let index=SpatialCandidateIndex::validate(&build(),scope(),&areas,&grids,&objects).unwrap();
    let mut old=scope();old.revision+=1;
    assert_eq!(index.inspect(old,key(42,7)).unwrap_err().0,
       "SPATIAL_SCOPE_REVISION_OR_SHA_STALE");
    let mut old=scope();old.decoded_sha256=[3;32];
    assert!(index.inspect(old,key(42,7)).is_err());
    let mut bad=build();bad.build_id="52BD625D9B4E0053".into();
    assert_eq!(SpatialCandidateIndex::validate(&bad,scope(),&areas,&grids,&objects)
        .err().unwrap().0,"SPATIAL_EXACT_SWITCH_BUILD_REQUIRED");
}

// Max-size synthetic parent chain: the same Grid-qualified object ID is
// intentionally repeated across Grids. No Native authority is inferred.
fn deep_chain(n:u64) -> (Vec<SpatialAreaRef>,Vec<SpatialGridRef>,Vec<SpatialObjectRef>) {
    let areas=vec![SpatialAreaRef{village_index:17,area_key:31,root_grid_ids:vec![1]}];
    let grids=(1..=n).map(|id| SpatialGridRef{
        grid_id:id,proposed_bounds:Some(SpatialExtent{width:4,height:4}),
        parent_object:if id==1 {None} else {Some(key(id-1,7))}
    }).collect();
    let objects=(1..=n).map(|id| obj(id,7,0,0,if id<n {Some(id+1)} else {None})).collect();
    (areas,grids,objects)
}
#[test]
fn max_depth_parent_resolution_is_order_invariant_and_non_authorizing(){
    let (areas,mut grids,mut objects)=deep_chain(ddv_save_core::MAX_SPATIAL_GRIDS as u64);
    let original_grids=grids.clone();let original_objects=objects.clone();
    let n=grids.len() as u64;
    for reverse in [false,true] {
        if reverse {grids.reverse();objects.reverse();}
        let index=SpatialCandidateIndex::validate(&build(),scope(),&areas,&grids,&objects).unwrap();
        for id in [1,2,n/2,n-1,n] {
            let hit=index.inspect(scope(),key(id,7)).unwrap();
            assert_eq!((hit.root_grid_id,hit.area_village_index,hit.area_key),(1,17,31));
            assert_eq!(hit.object.key,key(id,7));
            assert!(!hit.native_layout_verified && !hit.source_session_authenticated && !hit.product_writer_authorized);
        }
        assert!(!index.product_read_accepted && !index.product_writer_authorized && !index.full_native_reference_closure_verified);
    }
    grids.reverse();objects.reverse();
    assert_eq!(grids,original_grids);assert_eq!(objects,original_objects);
}
#[test]
fn memoized_prefix_never_hides_a_later_unreachable_or_cyclic_component(){
    let (areas,mut grids,mut objects)=deep_chain(256);
    // First complete a valid root component; then visit a deep isolated cycle.
    for id in 1000..1128 {
        let parent=if id==1000 {1127} else {id-1};
        let child=if id==1127 {1000} else {id+1};
        grids.push(SpatialGridRef{grid_id:id,proposed_bounds:Some(SpatialExtent{width:4,height:4}),
            parent_object:Some(key(parent,7))});
        objects.push(obj(id,7,0,0,Some(child)));
    }
    deny((areas.clone(),grids.clone(),objects.clone()),"SPATIAL_SUBGRID_PARENT_CYCLE");
    grids.reverse();objects.reverse();
    deny((areas.clone(),grids,objects),"SPATIAL_SUBGRID_PARENT_CYCLE");
    let (areas,mut grids,mut objects)=deep_chain(256);
    grids.push(SpatialGridRef{grid_id:999,proposed_bounds:Some(SpatialExtent{width:4,height:4}),parent_object:None});
    objects.push(obj(999,7,0,0,None));
    deny((areas,grids,objects),"SPATIAL_GRID_NOT_REACHABLE_FROM_AREA");
}
#[test]
fn cached_roots_keep_distinct_area_owners_and_reject_aliased_child(){
    let (mut areas,mut grids,mut objects)=deep_chain(8);
    areas.push(SpatialAreaRef{village_index:18,area_key:32,root_grid_ids:vec![100]});
    grids.push(SpatialGridRef{grid_id:100,proposed_bounds:Some(SpatialExtent{width:4,height:4}),parent_object:None});
    grids.push(SpatialGridRef{grid_id:101,proposed_bounds:Some(SpatialExtent{width:4,height:4}),parent_object:Some(key(100,7))});
    grids.push(SpatialGridRef{grid_id:102,proposed_bounds:Some(SpatialExtent{width:4,height:4}),parent_object:Some(key(100,8))});
    objects.push(obj(100,7,0,0,Some(101)));objects.push(obj(100,8,0,0,Some(102)));
    objects.push(obj(101,7,0,0,None));objects.push(obj(102,7,0,0,None));
    grids.reverse();objects.reverse();
    let i=SpatialCandidateIndex::validate(&build(),scope(),&areas,&grids,&objects).unwrap();
    for id in [101,102] {
        let h=i.inspect(scope(),key(id,7)).unwrap();
        assert_eq!((h.root_grid_id,h.area_village_index,h.area_key),(100,18,32));
    }
    assert_eq!(i.inspect(scope(),key(8,7)).unwrap().root_grid_id,1);
    objects.push(obj(101,8,0,0,Some(102)));
    deny((areas,grids,objects),"SPATIAL_SUBGRID_PARENT_MISMATCH");
}
