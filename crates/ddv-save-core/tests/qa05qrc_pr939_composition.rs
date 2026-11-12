//! Independent affected-only composition QA, PR939. Synthetic only.
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,
 WorkerEnvelope,PRODUCT_WORKER_CONTRACT,preflight_steam_move_rotate,PreviewCell,
 PreviewObjectKey,PreviewTransform,PreviewGrid,PreviewRestrictions,PreviewSnapshot,
 PreviewRequest,PreviewReceipt,STEAM_SPATIAL_PREFLIGHT_CONTRACT};
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const JSON:&str=r#"{"GameInfo":{"Version":626},"Player":{"ListInventories":{"4":{"ID":4,"CompatibleItemType":"ItemType_Ingredient","Inventory":{"30000001":{"Amount":50}}}}},"World":{"GridCollection":{"DiffGrids":{}}}}"#;
fn build()->BuildIdentity{BuildIdentity{platform:Platform::SteamWindows,
 build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),schema:626,externally_attested:true}}
fn session()->ProductSession{ProductSession::open_decoded_readonly(JSON.as_bytes().to_vec(),build()).unwrap()}
fn env(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{
 let r=s.receipt().unwrap();
 WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
 expected_revision:r.revision,expected_index_generation:r.index_generation,
 expected_decoded_sha256:r.decoded_sha256,action}
}
fn preview()->PreviewReceipt{
 let key=PreviewObjectKey{grid_id:22,object_id:981};
 let old=PreviewSnapshot{key,grid:PreviewGrid{id:22,width:16,height:16,tessellation:1},
 old:PreviewTransform{x:2,y:2,orientation:0},local_cells:vec![PreviewCell{x:0,y:0}],
 other_cells:vec![],restrictions:PreviewRestrictions{can_move:Some(true),can_rotate:Some(true),
 only_default_orientations:Some(true)}};
 preflight_steam_move_rotate(&build(),&old,PreviewRequest{expected_key:key,
 target:PreviewTransform{x:6,y:7,orientation:4}}).unwrap()
}
fn untrusted(p:&PreviewReceipt){
 assert_eq!(p.contract,STEAM_SPATIAL_PREFLIGHT_CONTRACT);
 assert_eq!(p.new_cells,vec![PreviewCell{x:6,y:7}]);
 assert!(p.stored_enum_checked&&p.asserted_bounds_and_conflicts_checked);
 assert!(!p.source_object_authenticated&&!p.native_footprint_parent_floor_verified&&
 !p.native_placement_legal&&!p.writer_authorized);
}
#[test]
fn composition_preview_and_existing_product_session_are_separate_authority(){
 let s=session();let before=s.receipt().unwrap();
 untrusted(&preview());
 let after=s.receipt().unwrap();
 assert_eq!((before.session_id,before.revision,before.index_generation,before.decoded_sha256),
 (after.session_id,after.revision,after.index_generation,after.decoded_sha256));
 assert!(after.full_document_json_validated);
 assert!(!after.writer_authorized&&!after.edited_copy_authorized&&!after.apply_authorized);
 let read=s.dispatch(env(&s,WorkerAction::ReadCoreSchemaWitness)).unwrap();
 assert_eq!(read.session_id,before.session_id);
 assert_eq!(read.decoded_sha256,before.decoded_sha256);
 assert_eq!(read.core_owned_readset,"/GameInfo/Version");
 for action in [WorkerAction::Stage,WorkerAction::ExportEditedCopy,
 WorkerAction::Apply,WorkerAction::OriginalOverwrite]{
 assert_eq!(s.dispatch(env(&s,action)).unwrap_err().0,"PRODUCT_WRITER_DISABLED");
 }
}
#[cfg(feature="indexed-read")]
#[test]
fn composition_cardinal_bounds_does_not_authenticate_preview(){
 use ddv_save_core::{SpatialExtent,IndexedDomain,IndexedCursorReceipt};
 let s=session();
 let d=SpatialExtent{width:3,height:7}.steam1253_cardinal_bounds(&build(),4,1,1).unwrap();
 assert_eq!((d.width,d.height),(7,3));
 let p=preview();untrusted(&p);
 let c:IndexedCursorReceipt=s.issue_indexed_cursor(env(&s,WorkerAction::ReadDomain),IndexedDomain::Player).unwrap();
 // Receipt exists on the original single session; preview cannot change its identity.
 let _=c;
 assert_eq!(s.receipt().unwrap().revision,0);
 assert!(!s.receipt().unwrap().writer_authorized);
}
#[cfg(feature="semantic-writer-dev")]
#[test]
fn composition_dev_exports_survive_and_preview_does_not_change_staged_revision(){
 use ddv_save_core::{TypedOperationKind,TypedOperationRegistryEntry,TypedSemanticCommand,
 SemanticStageReceipt,TYPED_OPERATION_REGISTRY};
 let s=session();
 let rows:&[TypedOperationRegistryEntry]=&TYPED_OPERATION_REGISTRY;
 assert!(rows.iter().any(|r|r.kind==TypedOperationKind::InventoryExistingAmountDecrease&&r.dev_implementation));
 assert!(rows.iter().all(|r|!r.native_v3_verified&&!r.product_enabled));
 untrusted(&preview());
 let staged:SemanticStageReceipt=s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),
 &[TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:4,
 canonical_item_id:30000001,expected_compatible_item_type:"ItemType_Ingredient".into(),
 expected_old_amount:50,new_amount:49}]).unwrap();
 assert_eq!(staged.exact_field_changed_count,1);
 assert!(staged.semantic_changed&&!staged.native_v3_verified&&!staged.product_writer_authorized);
 untrusted(&preview());
 let r=s.receipt().unwrap();
 assert_eq!((r.session_id,r.revision,r.index_generation),
 (staged.session_id,staged.revision,staged.index_generation));
 assert!(!r.writer_authorized&&!r.edited_copy_authorized&&!r.apply_authorized);
 assert_eq!(s.dispatch(env(&s,WorkerAction::Apply)).unwrap_err().0,"PRODUCT_WRITER_DISABLED");
}
