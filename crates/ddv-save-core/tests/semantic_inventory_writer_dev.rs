//! PUBLIC SYNTHETIC ONLY; no real P1G, crypto secret or owner media in CI.
//! Tests same existing Rust ProductSession (not a second Save reader).
#![cfg(feature="semantic-writer-dev")]
use ddv_save_core::{
 BuildIdentity,BuildKind,Platform,ProductSession,TypedSemanticCommand,
 TYPED_OPERATION_REGISTRY,WorkerEnvelope,WorkerAction,PRODUCT_WORKER_CONTRACT
};
use sha2::{Digest,Sha256};
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const ORIGINAL:&str=r#"{"GameInfo":{"Version":626},"Player":{"ListInventories":{"4":{"ID":4,"CompatibleItemType":"ItemType_Ingredient","Inventory":{"30000001":{"Amount":50,"Marker":"ItemMarker_None","Unknown":{"keep":"value","ratio":1.00}}}}},"ContainerInventories":{"12":{"ID":12,"BelongsToPlayer":true,"ParentItemID":500000,"Size":2,"Inventory":[{"ItemID":30000002,"Amount":12,"UnknownFuture":true},{"ItemID":0,"Amount":0,"KeepNull":null}]}}},"World":{"GridCollection":{"DiffGrids":{}}},"Other":{"float":1.00,"caseSensitive":"KEEP"}}"#;
fn steam()->BuildIdentity{
 BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
   build_id:STEAM.into(),schema:626,externally_attested:true}
}
fn open(bytes:&[u8])->ProductSession{
 ProductSession::open_decoded_readonly(bytes.to_vec(),steam()).unwrap()
}
fn envelope(session:&ProductSession,rev:u64,gen:u64,action:WorkerAction)->WorkerEnvelope{
 let r=session.receipt().unwrap();
 WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
  expected_revision:rev,expected_index_generation:gen,
  expected_decoded_sha256:r.decoded_sha256,action}
}
fn inventory(old:u32,new:u32)->TypedSemanticCommand{
 TypedSemanticCommand::InventoryExistingAmountDecrease{
   inventory_id:4,canonical_item_id:30000001,
   expected_compatible_item_type:"ItemType_Ingredient".into(),
   expected_old_amount:old,new_amount:new
 }
}
fn chest(old:u32,new:u32)->TypedSemanticCommand{
 TypedSemanticCommand::ChestExistingSlotAmountDecrease{
   container_id:12,slot_index:0,expected_item_id:30000002,
   expected_old_amount:old,new_amount:new
 }
}
fn stage(session:&ProductSession,commands:&[TypedSemanticCommand]){
 session.stage_typed_semantic_batch(envelope(session,0,1,WorkerAction::Stage),commands)
   .unwrap();
}
#[test]
fn registry_is_closed_source_only_no_product_writer_authority(){
 assert_eq!(TYPED_OPERATION_REGISTRY.len(),5);
 assert!(TYPED_OPERATION_REGISTRY[0].dev_implementation);
 assert!(TYPED_OPERATION_REGISTRY[1].dev_implementation);
 assert!(TYPED_OPERATION_REGISTRY[2..].iter().all(|r|!r.dev_implementation));
 assert!(TYPED_OPERATION_REGISTRY.iter().all(|r|!r.native_v3_verified&&!r.product_enabled));
 let s=open(ORIGINAL.as_bytes());
 assert!(!s.receipt().unwrap().writer_authorized);
 assert_eq!(s.dispatch(envelope(&s,0,1,WorkerAction::Stage)).unwrap_err().0,"PRODUCT_WRITER_DISABLED");
 assert_eq!(s.dispatch(envelope(&s,0,1,WorkerAction::Apply)).unwrap_err().0,"PRODUCT_WRITER_DISABLED");
}
#[test]
fn inventory_50_to_49_true_semantic_change_exact_only_one_number(){
 let s=open(ORIGINAL.as_bytes());
 let r=s.stage_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage),
   &[inventory(50,49)]).unwrap();
 assert_eq!(r.revision,1);
 assert_eq!(r.index_generation,2);
 assert_eq!(r.exact_field_changed_count,1);
 assert!(r.semantic_changed&&r.applied);
 assert!(!r.native_v3_verified&&!r.product_writer_authorized&&!r.original_overwrite_authorized);
 assert_ne!(r.staged_decoded_sha256,r.original_decoded_sha256);
 assert!(s.stage_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage),
   &[inventory(50,49)]).is_err());
 let stale=s.undo_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage));
 assert!(stale.is_err());
 let u=s.undo_typed_semantic_batch(envelope(&s,1,2,WorkerAction::Stage)).unwrap();
 assert!(!u.applied);
 assert_eq!((u.revision,u.index_generation),(2,3));
 assert!(s.take_typed_semantic_decoded_once(
   envelope(&s,2,3,WorkerAction::ExportEditedCopy)).is_err());
 let redo=s.redo_typed_semantic_batch(envelope(&s,2,3,WorkerAction::Stage)).unwrap();
 assert_eq!((redo.revision,redo.index_generation),(3,4));
 let output=s.take_typed_semantic_decoded_once(
   envelope(&s,3,4,WorkerAction::ExportEditedCopy)).unwrap();
 let expected=ORIGINAL.replacen(r#""Amount":50"#,r#""Amount":49"#,1);
 assert_eq!(output,expected.as_bytes());
 assert_eq!(Sha256::digest(&output).as_slice(),r.staged_decoded_sha256);
 assert!(expected.contains(r#""ratio":1.00"#)); // exact unknown lexical form
 assert!(expected.contains(r#""float":1.00"#));
 assert!(s.take_typed_semantic_decoded_once(
   envelope(&s,3,4,WorkerAction::ExportEditedCopy)).is_err());
 assert!(s.receipt().is_err());
 let reopened=open(&output); // independent Rust ProductSession after byte export
 assert_ne!(reopened.receipt().unwrap().decoded_sha256,r.original_decoded_sha256);
 assert!(!reopened.receipt().unwrap().writer_authorized);
 assert_eq!(ORIGINAL.as_bytes()[0],b'{'); // immutable original input
}
#[test]
fn chest_existing_slot_12_to_11_same_generic_semantic_engine(){
 let s=open(ORIGINAL.as_bytes());
 let staged=s.stage_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage),
  &[chest(12,11)]).unwrap();
 assert_eq!(staged.operation_count,1);
 let result=s.take_typed_semantic_decoded_once(
  envelope(&s,1,2,WorkerAction::ExportEditedCopy)).unwrap();
 assert_eq!(result,ORIGINAL.replacen(r#""Amount":12"#,r#""Amount":11"#,1).as_bytes());
 assert!(String::from_utf8(result).unwrap().contains(r#""UnknownFuture":true"#));
}
#[test]
fn inventory_and_chest_two_domains_are_one_atomic_exact_batch(){
 let s=open(ORIGINAL.as_bytes());
 let r=s.stage_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage),
   &[inventory(50,49),chest(12,11)]).unwrap();
 assert_eq!(r.operation_count,2);
 assert_eq!(r.exact_field_changed_count,2);
 let output=s.take_typed_semantic_decoded_once(
  envelope(&s,1,2,WorkerAction::ExportEditedCopy)).unwrap();
 let expected=ORIGINAL.replace(r#""Amount":50"#,r#""Amount":49"#)
   .replace(r#""Amount":12"#,r#""Amount":11"#);
 assert_eq!(output,expected.as_bytes());
 assert!(expected.contains(r#""Unknown":{"keep":"value","ratio":1.00}"#));
 let reopened=open(&output);
 assert!(reopened.receipt().unwrap().full_document_json_validated);
}
#[test]
fn failing_second_target_must_not_mutate_any_of_batch(){
 let s=open(ORIGINAL.as_bytes());
 let bad=TypedSemanticCommand::ChestExistingSlotAmountDecrease{
  container_id:12,slot_index:0,expected_item_id:30000003,
  expected_old_amount:12,new_amount:11,
 };
 assert!(s.stage_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage),
   &[inventory(50,49),bad]).is_err());
 let r=s.receipt().unwrap();
 assert_eq!((r.revision,r.index_generation),(0,1));
 let ok=s.stage_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage),
   &[inventory(50,49)]).unwrap();
 assert_eq!(ok.revision,1);
}
#[test]
fn invalid_amounts_duplicate_targets_and_absent_fields_fail_closed(){
 let s=open(ORIGINAL.as_bytes());
 let req=envelope(&s,0,1,WorkerAction::Stage);
 for (old,new) in [(50,50),(50,51),(50,0),(50,10_000),(0,1),
                    (49,48),(10_000,9999)]{
  assert!(s.stage_typed_semantic_batch(req,&[inventory(old,new)]).is_err(),
    "should deny {old}->{new}");
 }
 assert!(s.stage_typed_semantic_batch(req,&[]).is_err());
 assert!(s.stage_typed_semantic_batch(req,&[inventory(50,49),inventory(50,48)]).is_err());
 let missing=TypedSemanticCommand::InventoryExistingAmountDecrease{
  inventory_id:4,canonical_item_id:9999999,
  expected_compatible_item_type:"ItemType_Ingredient".into(),
  expected_old_amount:50,new_amount:49};
 assert!(s.stage_typed_semantic_batch(req,&[missing]).is_err());
 let other_type=TypedSemanticCommand::InventoryExistingAmountDecrease{
  inventory_id:4,canonical_item_id:30000001,
  expected_compatible_item_type:"ItemType_Currency".into(),
  expected_old_amount:50,new_amount:49};
 assert!(s.stage_typed_semantic_batch(req,&[other_type]).is_err());
 assert_eq!(s.receipt().unwrap().revision,0);
}
#[test]
fn forged_source_sha_session_revision_index_contract_or_action_denied(){
 let s=open(ORIGINAL.as_bytes());
 let real=envelope(&s,0,1,WorkerAction::Stage);
 let mut fake=real;fake.session_id[0]^=1;
 assert!(s.stage_typed_semantic_batch(fake,&[inventory(50,49)]).is_err());
 fake=real;fake.expected_revision=1;
 assert!(s.stage_typed_semantic_batch(fake,&[inventory(50,49)]).is_err());
 fake=real;fake.expected_index_generation=2;
 assert!(s.stage_typed_semantic_batch(fake,&[inventory(50,49)]).is_err());
 fake=real;fake.expected_decoded_sha256[0]^=1;
 assert!(s.stage_typed_semantic_batch(fake,&[inventory(50,49)]).is_err());
 fake=real;fake.contract="forged";
 assert!(s.stage_typed_semantic_batch(fake,&[inventory(50,49)]).is_err());
 fake=real;fake.action=WorkerAction::ReadDomain;
 assert!(s.stage_typed_semantic_batch(fake,&[inventory(50,49)]).is_err());
 assert_eq!(s.receipt().unwrap().revision,0);
}
#[test]
fn switch_bid_schema624_wrong_steam_build_and_close_are_denied(){
 let sw=BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
  build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true};
 let s=ProductSession::open_decoded_readonly(ORIGINAL.as_bytes().to_vec(),sw).unwrap();
 assert_eq!(s.stage_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage),
  &[inventory(50,49)]).unwrap_err().0,"SEMANTIC_EXACT_STEAM626_REQUIRED");
 let mut wrong=steam();wrong.build_id="not_exact".into();
 assert!(ProductSession::open_decoded_readonly(ORIGINAL.as_bytes().to_vec(),wrong).is_err());
 let mut wrong=steam();wrong.schema=624;
 assert!(ProductSession::open_decoded_readonly(ORIGINAL.as_bytes().to_vec(),wrong).is_err());
 let s=open(ORIGINAL.as_bytes());let req=envelope(&s,0,1,WorkerAction::Stage);
 s.close().unwrap();
 assert!(s.stage_typed_semantic_batch(req,&[inventory(50,49)]).is_err());
}
#[test]
fn container_shape_size_owner_or_id_mismatch_denied(){
 let variants=[
  ORIGINAL.replace(r#""BelongsToPlayer":true"#,r#""BelongsToPlayer":false"#),
  ORIGINAL.replace(r#""Size":2"#,r#""Size":3"#),
  ORIGINAL.replace(r#""ParentItemID":500000"#,r#""ParentItemID":0"#),
  ORIGINAL.replace(r#""ContainerInventories":{"12":{"ID":12"#,
                    r#""ContainerInventories":{"12":{"ID":13"#),
  ORIGINAL.replace(r#""Inventory":[{"ItemID":30000002"#,
                    r#""Inventory":[{"ItemID":30000003"#),
 ];
 for bad in variants{
  let s=open(bad.as_bytes());
  assert!(s.stage_typed_semantic_batch(envelope(&s,0,1,WorkerAction::Stage),
   &[chest(12,11)]).is_err());
 }
}
#[test]
fn no_whole_document_json_regeneration_large_opaque_data_exact_preserved(){
 let mut doc=ORIGINAL.to_owned();
 // This buffer is a synthetic, LOCAL-only stress witness, not 200MiB
 // encrypted browser or real Native game operation acceptance.
 doc=doc.replacen(r#""Other":{"float":1.00"#,
   &format!(r#""Other":{{"longUnknown":"{}","float":1.00"#,"z".repeat(2_000_000)),1);
 let s=open(doc.as_bytes());
 stage(&s,&[inventory(50,49)]);
 let output=s.take_typed_semantic_decoded_once(
  envelope(&s,1,2,WorkerAction::ExportEditedCopy)).unwrap();
 assert_eq!(output,
   doc.replacen(r#""Amount":50"#,r#""Amount":49"#,1).as_bytes());
}
