//! 05 QR-C independent QA-only PR915 source4; synthetic Steam626 Preview not Writer.
use ddv_save_core::{
 preflight_steam_move_rotate,steam_orientation_cardinal,steam_orientation_defined,
 BuildIdentity,BuildKind,Platform,PreviewCell,PreviewObjectKey,PreviewGrid,
 PreviewRestrictions,PreviewOccupiedCell,PreviewSnapshot,PreviewTransform,PreviewRequest,
 PreviewReceipt,STEAM_SPATIAL_PREFLIGHT_CONTRACT
};
fn cell(x:i32,y:i32)->PreviewCell {PreviewCell{x,y}}
fn key(g:u32,id:u32)->PreviewObjectKey{PreviewObjectKey{grid_id:g,object_id:id}}
fn pos(x:i32,y:i32,o:u8)->PreviewTransform{PreviewTransform{x,y,orientation:o}}
fn build()->BuildIdentity{BuildIdentity{
 platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
 build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
 schema:626,externally_attested:true
}}
fn old()->PreviewSnapshot{PreviewSnapshot{
 key:key(31,904),grid:PreviewGrid{id:31,width:12,height:10,tessellation:1},
 old:pos(2,3,0),local_cells:vec![cell(0,0)],
 other_cells:vec![PreviewOccupiedCell{object:key(31,905),cell:cell(9,8)}],
 restrictions:PreviewRestrictions{can_move:Some(true),can_rotate:Some(true),
 only_default_orientations:Some(true)}
}}
fn req(x:i32,y:i32,o:u8)->PreviewRequest{PreviewRequest{
 expected_key:key(31,904),target:pos(x,y,o)}}
fn check(s:&PreviewSnapshot,r:PreviewRequest)->Result<PreviewReceipt,&'static str>{
 preflight_steam_move_rotate(&build(),s,r).map_err(|e|e.0)}
fn fail(s:&PreviewSnapshot,r:PreviewRequest,msg:&str){assert_eq!(check(s,r).unwrap_err(),msg);}
fn unprivileged(r:&PreviewReceipt){
 assert_eq!(r.contract,STEAM_SPATIAL_PREFLIGHT_CONTRACT);
 assert!(r.stored_enum_checked&&r.asserted_bounds_and_conflicts_checked);
 assert!(!r.source_object_authenticated);
 assert!(!r.native_footprint_parent_floor_verified);
 assert!(!r.native_placement_legal);
 assert!(!r.writer_authorized);
}
#[test] fn qa_simple_move_and_rotation_are_never_authorized(){
 let r=check(&old(),req(7,2,0)).unwrap();
 assert_eq!(r.new_cells,vec![cell(7,2)]);unprivileged(&r);
 for o in [4,8,12]{
 let r=check(&old(),req(2,3,o)).unwrap();
 assert_eq!(r.new_cells,vec![cell(2,3)]);unprivileged(&r);}
}
#[test] fn qa_orientation_all_256_values_default_only_and_unknown(){
 for o in 0..=u8::MAX{
 assert_eq!(steam_orientation_defined(o),o<16);
 assert_eq!(steam_orientation_cardinal(o),o<16&&o%4==0);}
 for o in [1,2,3,5,6,7,9,10,11,13,14,15]{
 fail(&old(),req(2,3,o),"SPATIAL_DEFAULT_ORIENTATION_REQUIRED");}
 for o in [16,255]{fail(&old(),req(2,3,o),"SPATIAL_ORIENTATION_UNKNOWN");}
 let mut s=old();s.old.orientation=16;
 fail(&s,req(2,3,4),"SPATIAL_ORIENTATION_UNKNOWN");
 let mut s=old();s.restrictions.only_default_orientations=Some(false);
 for o in [1,3,7,15]{unprivileged(&check(&s,req(2,3,o)).unwrap());}
}
#[test] fn qa_caller_forged_key_and_wrong_grid_denied(){
 let mut r=req(7,2,0);r.expected_key.object_id+=1;
 fail(&old(),r,"SPATIAL_OBJECT_KEY_MISMATCH");
 r=req(7,2,0);r.expected_key.grid_id+=1;
 fail(&old(),r,"SPATIAL_OBJECT_KEY_MISMATCH");
 let mut s=old();s.grid.id+=1;
 fail(&s,req(7,2,0),"SPATIAL_OBJECT_KEY_MISMATCH");
}
#[test] fn qa_spoofed_matching_snapshot_and_missing_parent_floor_never_authorize(){
 let mut s=old();s.key=key(31,12345);s.old=pos(1,1,0);
 s.local_cells=vec![cell(0,0),cell(1,0)];s.other_cells.clear();
 let r=preflight_steam_move_rotate(&build(),&s,PreviewRequest{
 expected_key:s.key,target:pos(4,4,0)}).unwrap();
 assert_eq!(r.new_cells,vec![cell(4,4),cell(5,4)]);
 unprivileged(&r);
 let mut s=old();s.other_cells.clear();
 for r in [req(0,0,0),req(11,9,0),req(2,3,8)]{
 unprivileged(&check(&s,r).unwrap());}
}
#[test] fn qa_exact_steam_fullversion_build_attestation_schema(){
 let mut cases=Vec::new();
 let mut b=build();b.platform=Platform::Switch;b.build_kind=BuildKind::SwitchBid;
 b.build_id="9A239D3DB569756D".into();cases.push(b);
 let mut b=build();b.schema=624;cases.push(b);
 let mut b=build();b.schema=625;cases.push(b);
 let mut b=build();b.externally_attested=false;cases.push(b);
 let mut b=build();b.build_id="wrong-steam-build".into();cases.push(b);
 let mut b=build();b.build_kind=BuildKind::SwitchBid;cases.push(b);
 for b in cases{assert_eq!(
 preflight_steam_move_rotate(&b,&old(),req(4,5,0)).unwrap_err().0,
 "SPATIAL_STEAM_BUILD_MISMATCH");}
}
#[test] fn qa_noop_move_rotate_permissions_and_default_restriction(){
 fail(&old(),req(2,3,0),"SPATIAL_NOOP");
 for p in [None,Some(false)]{
 let mut s=old();s.restrictions.can_move=p;
 fail(&s,req(4,4,0),"SPATIAL_MOVE_PERMISSION_NOT_ESTABLISHED");
 let mut s=old();s.restrictions.can_rotate=p;
 fail(&s,req(2,3,4),"SPATIAL_ROTATE_PERMISSION_NOT_ESTABLISHED");}
 let mut s=old();s.restrictions.only_default_orientations=None;
 fail(&s,req(2,3,4),"SPATIAL_ROTATION_RESTRICTION_UNKNOWN");
 let mut s=old();s.restrictions.can_move=None;
 unprivileged(&check(&s,req(2,3,4)).unwrap());
}
#[test] fn qa_bad_tessellation_grid_dimensions_and_overflow(){
 for t in [0,2,4,u32::MAX]{let mut s=old();s.grid.tessellation=t;
 fail(&s,req(4,5,0),"SPATIAL_TESSELLATION_UNKNOWN");}
 for (w,h) in [(0,10),(12,0),(i32::MAX as u32+1,10),(12,i32::MAX as u32+1)]{
 let mut s=old();s.grid.width=w;s.grid.height=h;
 fail(&s,req(4,5,0),"SPATIAL_GRID_SIZE_UNKNOWN");}
 let mut s=old();s.grid.width=i32::MAX as u32;
 s.local_cells=vec![cell(1,0),cell(0,0)];
 fail(&s,req(i32::MAX,5,0),"SPATIAL_COORDINATE_OVERFLOW");
}
#[test] fn qa_bounds_signed_coordinates_and_multicell_footprint(){
 for (x,y) in [(-1,4),(4,-1),(12,4),(4,10),(i32::MIN,5),(5,i32::MIN)]{
 fail(&old(),req(x,y,0),"SPATIAL_ASSERTED_OUT_OF_BOUNDS");}
 let mut s=old();s.local_cells=vec![cell(0,0),cell(1,0),cell(1,1),cell(0,1)];
 let r=check(&s,req(5,4,0)).unwrap();
 assert_eq!(r.new_cells,vec![cell(5,4),cell(6,4),cell(6,5),cell(5,5)]);
 unprivileged(&r);
 fail(&s,req(11,4,0),"SPATIAL_ASSERTED_OUT_OF_BOUNDS");
 for o in [4,8,12]{fail(&s,req(2,3,o),"SPATIAL_ROTATED_FOOTPRINT_UNKNOWN");}
 s.local_cells=vec![cell(1,0)];
 fail(&s,req(2,3,4),"SPATIAL_ROTATED_FOOTPRINT_UNKNOWN");
}
#[test] fn qa_missing_duplicate_negative_and_excessive_footprints(){
 let mut s=old();s.local_cells.clear();
 fail(&s,req(4,5,0),"SPATIAL_CELLS_UNKNOWN_OR_OVERSIZED");
 let mut s=old();s.local_cells=vec![cell(0,0),cell(-1,0)];
 fail(&s,req(4,5,0),"SPATIAL_DUPLICATE_OR_NEGATIVE_MASK");
 let mut s=old();s.local_cells=vec![cell(0,0),cell(0,0)];
 fail(&s,req(4,5,0),"SPATIAL_DUPLICATE_OR_NEGATIVE_MASK");
 let mut s=old();s.local_cells=vec![cell(0,0);4097];
 fail(&s,req(4,5,0),"SPATIAL_CELLS_UNKNOWN_OR_OVERSIZED");
 let mut s=old();s.other_cells=vec![
 PreviewOccupiedCell{object:key(31,905),cell:cell(9,8)};100_001];
 fail(&s,req(4,5,0),"SPATIAL_CELLS_UNKNOWN_OR_OVERSIZED");
}
#[test] fn qa_other_claimed_occupied_cells_collision_and_same_object_spoof(){
 fail(&old(),req(9,8,0),"SPATIAL_ASSERTED_CELL_CONFLICT");
 let mut s=old();s.other_cells=vec![
 PreviewOccupiedCell{object:key(32,904),cell:cell(6,6)}];
 fail(&s,req(6,6,0),"SPATIAL_ASSERTED_CELL_CONFLICT");
 let mut s=old();s.other_cells=vec![
 PreviewOccupiedCell{object:s.key,cell:cell(6,6)}];
 unprivileged(&check(&s,req(6,6,0)).unwrap());
}
