use ddv_save_core::{
    preflight_steam_move_rotate,steam_orientation_cardinal,steam_orientation_defined,
    BuildIdentity,BuildKind,Platform,PreviewCell,PreviewObjectKey,PreviewGrid,
    PreviewRestrictions,PreviewOccupiedCell,PreviewSnapshot,PreviewTransform,PreviewRequest
};
fn build()->BuildIdentity{BuildIdentity{
    platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
    build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
    schema:626,externally_attested:true
}}
fn old()->PreviewSnapshot{
    let key=PreviewObjectKey{grid_id:42,object_id:7};
    PreviewSnapshot{
        key,grid:PreviewGrid{id:42,width:10,height:8,tessellation:1},
        old:PreviewTransform{x:1,y:1,orientation:0},
        local_cells:vec![PreviewCell{x:0,y:0}],
        other_cells:vec![PreviewOccupiedCell{
            object:PreviewObjectKey{grid_id:42,object_id:8},
            cell:PreviewCell{x:7,y:7},
        }],
        restrictions:PreviewRestrictions{
            can_move:Some(true),can_rotate:Some(true),
            only_default_orientations:Some(true),
        },
    }
}
fn request(x:i32,y:i32,o:u8)->PreviewRequest{PreviewRequest{
    expected_key:PreviewObjectKey{grid_id:42,object_id:7},
    target:PreviewTransform{x,y,orientation:o}
}}
fn fail(s:&PreviewSnapshot,r:PreviewRequest)->&'static str{
    preflight_steam_move_rotate(&build(),s,r).unwrap_err().0
}
#[test]
fn synthetic_move_and_one_cell_rotate_never_authorize_writer(){
    let a=preflight_steam_move_rotate(&build(),&old(),request(2,3,0)).unwrap();
    assert_eq!(a.new_cells,vec![PreviewCell{x:2,y:3}]);
    assert!(a.asserted_bounds_and_conflicts_checked);
    assert!(!a.native_placement_legal);
    assert!(!a.source_object_authenticated);
    assert!(!a.writer_authorized);
    let b=preflight_steam_move_rotate(&build(),&old(),request(1,1,4)).unwrap();
    assert_eq!(b.new_cells,vec![PreviewCell{x:1,y:1}]);
    assert!(!b.native_footprint_parent_floor_verified);
}
#[test]
fn orientation_domain_and_default_only_restriction(){
    for i in 0..16{assert!(steam_orientation_defined(i));}
    assert!(!steam_orientation_defined(16));
    for i in [0,4,8,12]{assert!(steam_orientation_cardinal(i));}
    for i in [1,3,7,15,16]{assert!(!steam_orientation_cardinal(i));}
    assert_eq!(fail(&old(),request(1,1,16)),"SPATIAL_ORIENTATION_UNKNOWN");
    assert_eq!(fail(&old(),request(1,1,1)),"SPATIAL_DEFAULT_ORIENTATION_REQUIRED");
    let mut s=old();s.restrictions.can_rotate=None;
    assert_eq!(fail(&s,request(1,1,4)),"SPATIAL_ROTATE_PERMISSION_NOT_ESTABLISHED");
}
#[test]
fn invalid_bounds_conflicts_duplicate_parent_scope_and_forged_key(){
    assert_eq!(fail(&old(),request(7,7,0)),"SPATIAL_ASSERTED_CELL_CONFLICT");
    assert_eq!(fail(&old(),request(-1,2,0)),"SPATIAL_ASSERTED_OUT_OF_BOUNDS");
    assert_eq!(fail(&old(),request(10,2,0)),"SPATIAL_ASSERTED_OUT_OF_BOUNDS");
    let mut r=request(2,2,0);r.expected_key.object_id=100;
    assert_eq!(fail(&old(),r),"SPATIAL_OBJECT_KEY_MISMATCH");
    let mut s=old();s.local_cells.push(PreviewCell{x:0,y:0});
    assert_eq!(fail(&s,request(2,2,0)),"SPATIAL_DUPLICATE_OR_NEGATIVE_MASK");
    let mut s=old();s.local_cells.push(PreviewCell{x:1,y:0});
    assert_eq!(fail(&s,request(1,1,4)),"SPATIAL_ROTATED_FOOTPRINT_UNKNOWN");
}
#[test]
fn no_steam_switch_schema_confusion_or_unknown_permissions(){
    let mut b=build();b.platform=Platform::Switch;b.build_kind=BuildKind::SwitchBid;
    b.build_id="9A239D3DB569756D".into();
    assert_eq!(preflight_steam_move_rotate(&b,&old(),request(2,2,0)).unwrap_err().0,
        "SPATIAL_STEAM_BUILD_MISMATCH");
    let mut b=build();b.build_id="invalid".into();
    assert_eq!(preflight_steam_move_rotate(&b,&old(),request(2,2,0)).unwrap_err().0,
        "SPATIAL_STEAM_BUILD_MISMATCH");
    let mut s=old();s.restrictions.can_move=None;
    assert_eq!(fail(&s,request(2,2,0)),"SPATIAL_MOVE_PERMISSION_NOT_ESTABLISHED");
    let mut s=old();s.grid.tessellation=2;
    assert_eq!(fail(&s,request(2,2,0)),"SPATIAL_TESSELLATION_UNKNOWN");
    let mut s=old();s.local_cells.clear();
    assert_eq!(fail(&s,request(2,2,0)),"SPATIAL_CELLS_UNKNOWN_OR_OVERSIZED");
}
