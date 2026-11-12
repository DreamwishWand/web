// Independent affected-only QA. Included into crate-private native_reference_slice
// in an ephemeral CI worktree ONLY. Source Git blob remains immutable.
use super::*;
use crate::{BuildIdentity,BuildKind,Platform,WorkerAction,PRODUCT_WORKER_CONTRACT};
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SRC:&str=r#"{"GameInfo":{"Version":626},"Player":{"ListInventories":{"4":{"ID":4,"CompatibleItemType":"ItemType_Ingredient","Inventory":{"30000001":{"Amount":50}}}}},"World":{"GridCollection":{"DiffGrids":{"17":{"ID":17,"ModifiedObjects":{"29":{"ID":29,"ItemID":30001001,"X":-37,"Y":2147483647,"Orientation":12,"State":{},"From":1}},"RemovedObjects":[31]}}}}}"#;
fn build()->BuildIdentity{BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),schema:626,externally_attested:true}}
fn open(s:&str)->ProductSession{ProductSession::open_decoded_readonly(s.as_bytes().to_vec(),build()).unwrap()}
fn envelope(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
fn read(s:&ProductSession)->CoreResult<NativeStoredModifiedObjectWitness>{s.read_native_stored_modified_object(envelope(s),17,29)}
fn denied(s:&str){let p=open(s);assert!(read(&p).is_err(),"malformed selected source accepted");}
#[test]
fn qac933_exact_saved_values_not_ui_claim_and_all_authority_false(){
 let p=open(SRC);let r=read(&p).unwrap();let receipt=p.receipt().unwrap();
 assert_eq!((r.grid_id,r.object_id,r.item_id,r.old_x,r.old_y,r.old_orientation),(17,29,30001001,-37,i32::MAX,12));
 assert_eq!((r.session_id,r.revision,r.index_generation,r.decoded_sha256),(receipt.session_id,receipt.revision,receipt.index_generation,receipt.decoded_sha256));
 assert!(r.stored_modified_identity_and_old_values_verified&&r.removed_overlap_excluded&&r.state_field_present&&r.source_oneof_present);
 assert!(!r.native_parent_subgrid_verified&&!r.native_gridarea_footprint_verified&&!r.native_floor_and_gridcells_verified&&!r.native_item_edit_restrictions_verified&&!r.native_placement_legal&&!r.writer_authorized);
 assert!(!receipt.writer_authorized&&!receipt.edited_copy_authorized&&!receipt.apply_authorized);
 assert_eq!(read(&p).unwrap(),r);
 let changed=SRC.replace("\"X\":-37","\"X\":-2147483648").replace("\"Orientation\":12","\"Orientation\":15");
 let q=open(&changed);let t=read(&q).unwrap();
 assert_eq!((t.old_x,t.old_orientation),(i32::MIN,15));assert_ne!(t.decoded_sha256,r.decoded_sha256);assert_ne!(t.session_id,r.session_id);
}
#[test]
fn qac933_selected_keys_and_types_fail_closed(){
 let p=open(SRC);
 assert!(p.read_native_stored_modified_object(envelope(&p),17,30).is_err());
 assert!(p.read_native_stored_modified_object(envelope(&p),18,29).is_err());
 for (a,b) in [("\"17\":{\"ID\":17","\"17\":{\"ID\":18"),("\"29\":{\"ID\":29","\"29\":{\"ID\":30"),("\"17\":{\"ID\":17","\"017\":{\"ID\":17"),("\"29\":{\"ID\":29","\"029\":{\"ID\":29"),("\"ID\":29","\"ID\":4294967296"),("\"ID\":17","\"ID\":4294967296"),("\"ItemID\":30001001","\"ItemID\":2147483648"),("\"X\":-37","\"X\":-2147483649"),("\"Y\":2147483647","\"Y\":2147483648"),("\"X\":-37","\"X\":1.25"),("\"Y\":2147483647","\"Y\":\"2\""),("\"Orientation\":12","\"Orientation\":-1"),("\"Orientation\":12","\"Orientation\":16"),("\"Orientation\":12","\"Orientation\":12.0"),("\"ItemID\":30001001","\"ItemID\":null"),("\"X\":-37,","")]{
  denied(&SRC.replace(a,b));
 }
}
#[test]
fn qac933_removed_overlap_and_malformed_collection(){
 for value in ["[29]","{\"0\":29}","[31,29]","{\"1\":31,\"2\":29}","null","true","[\"29\"]","{\"0\":null}","{\"00\":31}"]{
  denied(&SRC.replace("\"RemovedObjects\":[31]",&format!("\"RemovedObjects\":{value}")));
 }
 for value in ["[]","{\"0\":31}","[31,32]"]{
  let p=open(&SRC.replace("\"RemovedObjects\":[31]",&format!("\"RemovedObjects\":{value}")));
  assert!(read(&p).unwrap().removed_overlap_excluded);
 }
 let absent=SRC.replace(",\"RemovedObjects\":[31]","");
 // Absence is permitted by the existing stored-ID shape contract; no claim
 // about effective Native layout, removed precedence or default layout.
 let p=open(&absent);assert!(!read(&p).unwrap().native_placement_legal);
}
#[test]
fn qac933_strict_duplicate_and_corrupt_documents_rejected_before_witness(){
 for x in [SRC.replace("\"X\":-37","\"X\":-37,\"X\":7"),
 SRC.replace("\"X\":-37","\"X\":-37,\"\\u0058\":7"),
 SRC.replace("\"29\":{\"ID\":29","\"29\":{},\"29\":{\"ID\":29"),
 SRC.replace("\"17\":{\"ID\":17","\"17\":{},\"17\":{\"ID\":17"),
 SRC[..SRC.len()-1].to_owned()]{
  assert!(ProductSession::open_decoded_readonly(x.into_bytes(),build()).is_err());
 }
}
#[test]
fn qac933_scope_build_closed_and_read_only_boundary(){
 let p=open(SRC);let q=open(SRC);let original=envelope(&p);
 for e in [WorkerEnvelope{expected_revision:1,..original},WorkerEnvelope{expected_index_generation:2,..original},WorkerEnvelope{expected_decoded_sha256:[0;32],..original},WorkerEnvelope{session_id:envelope(&q).session_id,..original},WorkerEnvelope{contract:"fake",..original},WorkerEnvelope{action:WorkerAction::Apply,..original}]{
 assert!(p.read_native_stored_modified_object(e,17,29).is_err());
 }
 let mut sw=build();sw.platform=Platform::Switch;sw.build_kind=BuildKind::SwitchBid;sw.build_id="9A239D3DB569756D".into();
 let w=ProductSession::open_decoded_readonly(SRC.as_bytes().to_vec(),sw).unwrap();
 assert_eq!(read(&w).unwrap_err().0,"SPATIAL_STORED_STEAM_EXACT_BUILD_REQUIRED");
 for b in [BuildIdentity{schema:624,..build()},BuildIdentity{externally_attested:false,..build()},BuildIdentity{build_id:"releases_1.25-v1.25.3".into(),..build()}]{
 assert!(ProductSession::open_decoded_readonly(SRC.as_bytes().to_vec(),b).is_err());
 }
 p.close().unwrap();assert!(p.read_native_stored_modified_object(original,17,29).is_err());
}
#[test]
fn qac933_selected_object_inner_identity_alias_must_not_be_certified(){
 // JSON has distinct keys, so strict grammar validation succeeds.
 // Two stored objects claim the SAME Native object ID in the selected grid.
 let x=SRC.replace("\"From\":1}}","\"From\":1},\"30\":{\"ID\":29,\"ItemID\":30001002,\"X\":91,\"Y\":92,\"Orientation\":0}}");
 assert_ne!(x,SRC);let p=open(&x);
 assert!(read(&p).is_err(),"selected ObjectID29 alias via key30 incorrectly certified");
}
#[test]
fn qac933_selected_grid_inner_identity_alias_must_not_be_certified(){
 // Two distinct DiffGrid keys claim the same stored ID, different records.
 let x=SRC.replace("\"RemovedObjects\":[31]}}","\"RemovedObjects\":[31]},\"18\":{\"ID\":17,\"ModifiedObjects\":{},\"RemovedObjects\":[]}}");
 assert_ne!(x,SRC);let p=open(&x);
 assert!(read(&p).is_err(),"selected GridID17 alias via key18 incorrectly certified");
}
#[cfg(feature="semantic-writer-dev")]
#[test]
fn qac933_new_witness_respects_existing_staged_read_invalidation(){
 use crate::TypedSemanticCommand;
 let p=open(SRC);let pre=envelope(&p);
 let stage=p.stage_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..pre},&[TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:4,canonical_item_id:30000001,expected_compatible_item_type:"ItemType_Ingredient".into(),expected_old_amount:50,new_amount:49}]).unwrap();
 assert!(stage.semantic_changed);
 assert!(p.read_native_stored_modified_object(pre,17,29).is_err());
 assert_eq!(read(&p).unwrap_err().0,"SEMANTIC_STAGED_READ_SET_INVALIDATED");
}
