// Independent affected-only synthetic QA, included only in temporary crate.
use super::*;
use crate::{BuildIdentity,BuildKind,Platform,WorkerAction,PRODUCT_WORKER_CONTRACT};
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SRC:&str=r#"{"GameInfo":{"Version":626},"Player":{"ListInventories":{"4":{"ID":4,"CompatibleItemType":"ItemType_Ingredient","Inventory":{"30000001":{"Amount":50}}}}},"World":{"GridCollection":{"DiffGrids":{"17":{"ID":17,"ModifiedObjects":{"29":{"ID":29,"ItemID":30001001,"X":-37,"Y":2147483647,"Orientation":"GridOrientation_Left","State":{},"From":1}},"RemovedObjects":[31]}}}}}"#;
const NAMES:[&str;16]=["GridOrientation_Up","GridOrientation_UpUpRight","GridOrientation_UpRight","GridOrientation_UpRightRight","GridOrientation_Right","GridOrientation_DownRightRight","GridOrientation_DownRight","GridOrientation_DownDownRight","GridOrientation_Down","GridOrientation_DownDownLeft","GridOrientation_DownLeft","GridOrientation_DownLeftLeft","GridOrientation_Left","GridOrientation_UpLeftLeft","GridOrientation_UpLeft","GridOrientation_UpUpLeft"];
fn build()->BuildIdentity{BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),schema:626,externally_attested:true}}
fn open(s:&str)->ProductSession{ProductSession::open_decoded_readonly(s.as_bytes().to_vec(),build()).unwrap()}
fn scope(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
fn read(s:&ProductSession)->CoreResult<NativeStoredModifiedObjectWitness>{s.read_native_stored_modified_object(scope(s),17,29)}
fn deny(x:&str,code:&str){let p=open(x);assert_eq!(read(&p).unwrap_err().0,code,"input: {x}");}
fn off(r:&NativeStoredModifiedObjectWitness){assert!(!r.native_parent_subgrid_verified&&!r.native_gridarea_footprint_verified&&!r.native_floor_and_gridcells_verified&&!r.native_item_edit_restrictions_verified&&!r.native_placement_legal&&!r.writer_authorized);}
fn orient(raw:&str)->String{SRC.replace("\"GridOrientation_Left\"",raw)}
fn sibling_object(id:&str,key:&str)->String{SRC.replace("\"From\":1}}",&format!("\"From\":1}},\"{key}\":{{\"ID\":{id},\"ItemID\":30001002,\"X\":91,\"Y\":92,\"Orientation\":\"GridOrientation_Up\"}}}}"))}
fn sibling_grid(id:&str,key:&str)->String{SRC.replace("\"RemovedObjects\":[31]}}",&format!("\"RemovedObjects\":[31]}},\"{key}\":{{\"ID\":{id},\"ModifiedObjects\":{{}},\"RemovedObjects\":[]}}}}"))}
#[test]
fn qac933repair_all_sixteen_exact_native_names_and_core_receipt(){
 for (i,name) in NAMES.iter().enumerate(){
  let p=open(&orient(&format!("\"{name}\"")));let w=read(&p).unwrap();let r=p.receipt().unwrap();
  assert_eq!((w.grid_id,w.object_id,w.item_id,w.old_x,w.old_y,w.old_orientation),(17,29,30001001,-37,i32::MAX,i as u8));
  assert_eq!((w.session_id,w.revision,w.index_generation,w.decoded_sha256),(r.session_id,r.revision,r.index_generation,r.decoded_sha256));
  assert!(w.stored_modified_identity_and_old_values_verified&&w.removed_overlap_excluded&&w.state_field_present&&w.source_oneof_present);
  off(&w);assert!(!r.writer_authorized&&!r.edited_copy_authorized&&!r.apply_authorized);
 }
}
#[test]
fn qac933repair_numeric_unknown_short_case_null_bool_and_missing_orientation(){
 for raw in ["0","4","15","-1","4.0","null","true","false","{}","[]"]{deny(&orient(raw),"SPATIAL_STORED_ORIENTATION_STRING_REQUIRED");}
 for raw in [r#""Right""#,r#""gridOrientation_Right""#,r#""GridOrientation_right""#,r#""GridOrientation_UNKNOWN""#,r#""GridOrientation_UpUp""#,r#""GridOrientation_Up ""#,r#""4""#,r#""""#]{deny(&orient(raw),"SPATIAL_STORED_ORIENTATION_UNDEFINED");}
 let p=open(&SRC.replace(",\"Orientation\":\"GridOrientation_Left\"",""));assert!(read(&p).is_err());
 // JSON string escapes decode to the same exact native name.
 assert_eq!(read(&open(&orient(r#""GridOrientation_\u004c eft""#.replace(" ","").as_str()))).unwrap().old_orientation,12);
}
#[test]
fn qac933repair_selected_alias_grid_and_object_both_directions(){
 for (x,code) in [(sibling_object("29","30"),"SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH"),(sibling_grid("17","18"),"SPATIAL_STORED_GRID_KEY_ID_MISMATCH"),(sibling_object("29","28"),"SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH"),(sibling_grid("17","16"),"SPATIAL_STORED_GRID_KEY_ID_MISMATCH")]{
  assert_ne!(x,SRC);deny(&x,code);
 }
 // Also reject malformed unrelated sibling identity, even if not selected.
 deny(&sibling_object("31","30"),"SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH");
 deny(&sibling_grid("19","18"),"SPATIAL_STORED_GRID_KEY_ID_MISMATCH");
}
#[test]
fn qac933repair_distinct_multiple_ids_and_uint32_boundary(){
 let x=sibling_object("4294967295","4294967295");
 let p=open(&x);let a=read(&p).unwrap();let b=p.read_native_stored_modified_object(scope(&p),17,u32::MAX).unwrap();
 assert_eq!((a.object_id,a.old_x,b.object_id,b.old_x,b.old_orientation),(29,-37,u32::MAX,91,0));off(&a);off(&b);
 let x=sibling_grid("4294967295","4294967295");let p=open(&x);off(&read(&p).unwrap());
 assert_eq!(p.read_native_stored_modified_object(scope(&p),u32::MAX,29).unwrap_err().0,"SPATIAL_STORED_MODIFIED_OBJECT_NOT_FOUND");
 for (x,code) in [(sibling_object("4294967296","4294967296"),"SPATIAL_STORED_OBJECT_KEY_ID_MISMATCH"),(sibling_grid("4294967296","4294967296"),"SPATIAL_STORED_GRID_KEY_ID_MISMATCH"),(sibling_object("30","030"),"NATIVE_REF_NONCANONICAL_KEY"),(sibling_grid("18","018"),"NATIVE_REF_NONCANONICAL_KEY")] {deny(&x,code);}
}
#[test]
fn qac933repair_bad_sibling_id_type_and_shape_fail_closed(){
 for raw in ["\"30\"","-1","30.0","null","true","{}","4294967296"]{assert!(read(&open(&sibling_object(raw,"30"))).is_err());}
 for raw in ["\"18\"","-1","18.0","null","false","[]","4294967296"]{assert!(read(&open(&sibling_grid(raw,"18"))).is_err());}
 for x in [SRC.replace("\"17\":{\"ID\":17","\"17\":{\"ID\":18"),SRC.replace("\"29\":{\"ID\":29","\"29\":{\"ID\":30"),SRC.replace("\"29\":{\"ID\":29","\"029\":{\"ID\":29"),SRC.replace("\"X\":-37","\"X\":-2147483649"),SRC.replace("\"Y\":2147483647","\"Y\":2147483648"),SRC.replace("\"ItemID\":30001001","\"ItemID\":null"),SRC.replace("\"X\":-37","\"X\":1.25")] {assert!(read(&open(&x)).is_err());}
 for x in [SRC.replace("\"X\":-37","\"X\":-37,\"\\u0058\":1"),SRC.replace("\"29\":{\"ID\":29","\"29\":{},\"29\":{\"ID\":29"),SRC.replace("\"17\":{\"ID\":17","\"17\":{},\"17\":{\"ID\":17"),SRC[..SRC.len()-1].into()] {assert!(ProductSession::open_decoded_readonly(x.into_bytes(),build()).is_err());}
}
#[test]
fn qac933repair_removed_overlap_shape_and_saved_values_not_caller_claim(){
 for raw in ["[29]","[31,29,29]","{\"0\":29}","{\"1\":31,\"2\":29}"] {deny(&SRC.replace("[31]",raw),"SPATIAL_STORED_MODIFIED_REMOVED_OVERLAP");}
 for raw in ["null","false","[\"29\"]","{\"0\":null}","{\"00\":31}"]{assert!(read(&open(&SRC.replace("[31]",raw))).is_err());}
 let a=open(SRC);let b=open(&SRC.replace("\"X\":-37","\"X\":-2147483648").replace("\"GridOrientation_Left\"","\"GridOrientation_UpUpLeft\""));
 let p=read(&a).unwrap();let q=read(&b).unwrap();assert_eq!((q.old_x,q.old_orientation),(i32::MIN,15));assert_ne!(p.decoded_sha256,q.decoded_sha256);assert_ne!(p.session_id,q.session_id);off(&q);
}
#[test]
fn qac933repair_exact_build_cas_scope_and_closed(){
 let p=open(SRC);let other=open(SRC);let e=scope(&p);
 for bad in [WorkerEnvelope{expected_revision:1,..e},WorkerEnvelope{expected_index_generation:2,..e},WorkerEnvelope{expected_decoded_sha256:[0;32],..e},WorkerEnvelope{session_id:scope(&other).session_id,..e},WorkerEnvelope{contract:"fake",..e},WorkerEnvelope{action:WorkerAction::Apply,..e}] {assert!(p.read_native_stored_modified_object(bad,17,29).is_err());}
 let mut sw=build();sw.platform=Platform::Switch;sw.build_kind=BuildKind::SwitchBid;sw.build_id="9A239D3DB569756D".into();
 let s=ProductSession::open_decoded_readonly(SRC.as_bytes().to_vec(),sw).unwrap();assert_eq!(read(&s).unwrap_err().0,"SPATIAL_STORED_STEAM_EXACT_BUILD_REQUIRED");
 for b in [BuildIdentity{schema:624,..build()},BuildIdentity{externally_attested:false,..build()},BuildIdentity{build_id:"releases_1.25-v1.25.3".into(),..build()}] {assert!(ProductSession::open_decoded_readonly(SRC.as_bytes().to_vec(),b).is_err());}
 p.close().unwrap();assert!(p.read_native_stored_modified_object(e,17,29).is_err());
}
#[cfg(feature="semantic-writer-dev")]
#[test]
fn qac933repair_dev_stage_invalidates_witness_even_fresh_scope(){
 use crate::TypedSemanticCommand;
 let p=open(SRC);let pre=scope(&p);off(&read(&p).unwrap());
 let st=p.stage_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..pre},&[TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:4,canonical_item_id:30000001,expected_compatible_item_type:"ItemType_Ingredient".into(),expected_old_amount:50,new_amount:49}]).unwrap();
 assert!(st.semantic_changed);assert!(p.read_native_stored_modified_object(pre,17,29).is_err());assert_eq!(read(&p).unwrap_err().0,"SEMANTIC_STAGED_READ_SET_INVALIDATED");
}
