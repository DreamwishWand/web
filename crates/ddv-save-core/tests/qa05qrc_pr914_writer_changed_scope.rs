//! 05 QR-C INDEPENDENT changed-only verification of 01A PR914 real Amount Writer.
//! PUBLIC SYNTHETIC ONLY. Never promotes Writer, product schema/ABI, or Native V3.
#![cfg(feature="semantic-writer-dev")]
use ddv_save_core::{
 BuildIdentity,BuildKind,Platform,ProductSession,TypedSemanticCommand,
 TYPED_OPERATION_REGISTRY,IndexedDomain,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT
};
use sha2::{Digest,Sha256};
use std::sync::{Arc,Barrier};
use std::thread;
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
// Different synthetic IDs, replacement token widths and unknowns from Owner tests.
const DOC:&str=r#"{"GameInfo":{"Version":626},"NewDomain":{"Keep":"こんにちは","UnknownNumber":1.00,"Nested":[{"opaque":null}]},"Player":{"ListInventories":{"31":{"ID":31,"CompatibleItemType":"ItemType_Material","Inventory":{"42001":{"Amount":1000,"Unknown":{"t":1.00,"case":"KEEP"}},"42002":{"Amount":300}}}},"ContainerInventories":{"51":{"ID":51,"BelongsToPlayer":true,"ParentItemID":48005,"Size":2,"Inventory":[{"ItemID":9876,"Amount":101,"UnknownFuture":"literal"},{"ItemID":0,"Amount":0,"Keep":null}]}}},"World":{"GridCollection":{"DiffGrids":{}}}}"#;
fn steam()->BuildIdentity {BuildIdentity{
 platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
 build_id:STEAM.into(),schema:626,externally_attested:true
}}
fn open(text:&str)->ProductSession {
 ProductSession::open_decoded_readonly(text.as_bytes().to_vec(),steam()).unwrap()
}
fn env(s:&ProductSession, action:WorkerAction)->WorkerEnvelope {
 let r=s.receipt().unwrap();
 WorkerEnvelope{
  contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
  expected_decoded_sha256:r.decoded_sha256,
  expected_revision:r.revision,expected_index_generation:r.index_generation,action
 }
}
fn inv(id:u32,old:u32,new:u32)->TypedSemanticCommand{
 TypedSemanticCommand::InventoryExistingAmountDecrease{
  inventory_id:31,canonical_item_id:id,
  expected_compatible_item_type:"ItemType_Material".into(),
  expected_old_amount:old,new_amount:new
 }
}
fn chest(old:u32,new:u32)->TypedSemanticCommand{
 TypedSemanticCommand::ChestExistingSlotAmountDecrease{
  container_id:51,slot_index:0,expected_item_id:9876,
  expected_old_amount:old,new_amount:new
 }
}
fn expected()->String {
 DOC.replace("\"Amount\":1000","\"Amount\":9")
    .replace("\"Amount\":101","\"Amount\":7")
}
#[test]
fn qa_multiwidth_reverse_order_exact_two_leaf_diff_unknown_bytes_and_fresh_reopen(){
 let s=open(DOC);
 let before=s.receipt().unwrap();
 assert!(before.full_document_json_validated);
 assert!(!before.all_domain_references_verified&&!before.writer_authorized);
 let cmds=[chest(101,7),inv(42001,1000,9)];
 let staged=s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),&cmds).unwrap();
 assert_eq!(staged.operation_count,2);
 assert_eq!(staged.exact_field_changed_count,2);
 assert_eq!(staged.revision,1);
 assert_eq!(staged.index_generation,2);
 assert!(staged.semantic_changed&&staged.applied);
 assert_eq!(staged.original_decoded_sha256,before.decoded_sha256);
 assert!(!staged.native_v3_verified&&!staged.product_writer_authorized&&!staged.original_overwrite_authorized);
 let e=env(&s,WorkerAction::ExportEditedCopy);
 let edited=s.take_typed_semantic_decoded_once(e).unwrap();
 assert_eq!(edited,expected().as_bytes());
 assert_eq!(Sha256::digest(&edited).as_slice(),&staged.staged_decoded_sha256);
 assert!(expected().contains("\"UnknownNumber\":1.00"));
 assert!(expected().contains("\"t\":1.00"));
 assert!(s.take_typed_semantic_decoded_once(e).is_err());
 assert!(s.receipt().is_err());
 let reopened=open(std::str::from_utf8(&edited).unwrap());
 assert_ne!(reopened.receipt().unwrap().decoded_sha256,before.decoded_sha256);
 assert_eq!(DOC.as_bytes()[0],b'{');
}
#[test]
fn qa_atomic_failed_second_command_does_not_advance_revision_or_write_first(){
 let s=open(DOC);
 let bad=TypedSemanticCommand::ChestExistingSlotAmountDecrease{
  container_id:51,slot_index:0,expected_item_id:9877,
  expected_old_amount:101,new_amount:7
 };
 assert!(s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),
   &[inv(42001,1000,9),bad]).is_err());
 let r=s.receipt().unwrap();
 assert_eq!((r.revision,r.index_generation),(0,1));
 let pass=s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),
   &[inv(42001,1000,9),chest(101,7)]).unwrap();
 assert_eq!(pass.revision,1);
 let output=s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).unwrap();
 assert_eq!(output,expected().as_bytes());
}
#[test]
fn qa_forged_session_cross_session_revision_generation_sha_contract_action_denied(){
 let s=open(DOC);
 let other=open(DOC);
 let real=env(&s,WorkerAction::Stage);
 let mut forged=real;
 forged.session_id=other.receipt().unwrap().session_id;
 assert_eq!(s.stage_typed_semantic_batch(forged,&[inv(42001,1000,9)]).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");
 forged=real;forged.expected_decoded_sha256[0]^=0xaa;
 assert_eq!(s.stage_typed_semantic_batch(forged,&[inv(42001,1000,9)]).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");
 forged=real;forged.expected_revision+=1;
 assert_eq!(s.stage_typed_semantic_batch(forged,&[inv(42001,1000,9)]).unwrap_err().0,"SESSION_REVISION_GENERATION_CAS");
 forged=real;forged.expected_index_generation+=1;
 assert_eq!(s.stage_typed_semantic_batch(forged,&[inv(42001,1000,9)]).unwrap_err().0,"SESSION_REVISION_GENERATION_CAS");
 forged=real;forged.contract="qac-forged";
 assert_eq!(s.stage_typed_semantic_batch(forged,&[inv(42001,1000,9)]).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");
 forged=real;forged.action=WorkerAction::OriginalOverwrite;
 assert_eq!(s.stage_typed_semantic_batch(forged,&[inv(42001,1000,9)]).unwrap_err().0,"SEMANTIC_ACTION_DENIED");
 assert_eq!(s.receipt().unwrap().revision,0);
 assert_eq!(s.dispatch(real).unwrap_err().0,"PRODUCT_WRITER_DISABLED");
}
#[test]
fn qa_old_read_cursor_invalidated_and_staged_reader_denied_until_export(){
 let s=open(DOC);
 let cur=s.issue_indexed_cursor(env(&s,WorkerAction::ReadDomain),IndexedDomain::Player).unwrap();
 let old=env(&s,WorkerAction::ReadDomain);
 s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),&[inv(42001,1000,9)]).unwrap();
 assert!(s.read_indexed_page(old,cur.cursor).is_err());
 assert_eq!(s.issue_indexed_cursor(env(&s,WorkerAction::ReadDomain),IndexedDomain::Player)
   .unwrap_err().0,"SEMANTIC_STAGED_READ_SET_INVALIDATED");
 assert!(s.read_indexed_page(env(&s,WorkerAction::ReadDomain),cur.cursor).is_err());
 let output=s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).unwrap();
 assert_eq!(output,DOC.replace("\"Amount\":1000","\"Amount\":9").as_bytes());
}
#[test]
fn qa_undo_redo_stale_replay_rejected_and_export_only_after_redo(){
 let s=open(DOC);
 let stage_env=env(&s,WorkerAction::Stage);
 s.stage_typed_semantic_batch(stage_env,&[chest(101,7)]).unwrap();
 assert!(s.stage_typed_semantic_batch(stage_env,&[chest(101,7)]).is_err());
 assert!(s.undo_typed_semantic_batch(stage_env).is_err());
 let undone=s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
 assert_eq!((undone.revision,undone.index_generation),(2,3));
 assert!(!undone.applied);
 assert!(s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).is_err());
 assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
 let redone=s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
 assert_eq!((redone.revision,redone.index_generation),(3,4));
 assert!(redone.applied);
 assert!(s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).is_err());
 let e=env(&s,WorkerAction::ExportEditedCopy);
 let bytes=s.take_typed_semantic_decoded_once(e).unwrap();
 assert_eq!(bytes,DOC.replace("\"Amount\":101","\"Amount\":7").as_bytes());
 assert!(s.take_typed_semantic_decoded_once(e).is_err());
 assert!(s.undo_typed_semantic_batch(stage_env).is_err());
}
#[test]
fn qa_atomic_same_session_concurrent_old_value_cas_only_one_stage_wins(){
 let s=Arc::new(open(DOC));
 let e=env(&s,WorkerAction::Stage);
 let barrier=Arc::new(Barrier::new(3));
 let mut jobs=Vec::new();
 for new_amount in [8,9]{
  let sess=Arc::clone(&s);let gate=Arc::clone(&barrier);
  jobs.push(thread::spawn(move ||{
   gate.wait();
   sess.stage_typed_semantic_batch(e,&[inv(42001,1000,new_amount)]).map(|r|r.staged_decoded_sha256)
  }));
 }
 barrier.wait();
 let results:Vec<_>=jobs.into_iter().map(|j|j.join().unwrap()).collect();
 assert_eq!(results.iter().filter(|r|r.is_ok()).count(),1);
 let rec=s.receipt().unwrap();
 assert_eq!((rec.revision,rec.index_generation),(1,2));
 let output=s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).unwrap();
 let edited=String::from_utf8(output).unwrap();
 assert!(edited==DOC.replace("\"Amount\":1000","\"Amount\":8")||
         edited==DOC.replace("\"Amount\":1000","\"Amount\":9"));
}
#[test]
fn qa_positive_decrease_only_and_duplicate_batch_bounds_no_partial_commit(){
 let s=open(DOC);
 let req=env(&s,WorkerAction::Stage);
 for (old,new) in [(1000,1000),(1000,1001),(1000,0),(10000,9),(999,8),(0,1)] {
  assert!(s.stage_typed_semantic_batch(req,&[inv(42001,old,new)]).is_err());
 }
 assert!(s.stage_typed_semantic_batch(req,&[]).is_err());
 assert!(s.stage_typed_semantic_batch(req,&[inv(42001,1000,9),inv(42001,1000,8)]).is_err());
 let wrong_type=TypedSemanticCommand::InventoryExistingAmountDecrease{
  inventory_id:31,canonical_item_id:42001,
  expected_compatible_item_type:"ItemType_Premium".into(),
  expected_old_amount:1000,new_amount:9
 };
 assert!(s.stage_typed_semantic_batch(req,&[wrong_type]).is_err());
 assert!(s.stage_typed_semantic_batch(req,&[inv(0,1000,9)]).is_err());
 assert!(s.stage_typed_semantic_batch(req,&[inv(99999,1000,9)]).is_err());
 assert_eq!(s.receipt().unwrap().revision,0);
}
#[test]
fn qa_inventory_chest_owner_parent_size_slot_and_item_integrity_denied(){
 let candidates=[
  DOC.replace("\"BelongsToPlayer\":true","\"BelongsToPlayer\":false"),
  DOC.replace("\"ParentItemID\":48005","\"ParentItemID\":0"),
  DOC.replace("\"Size\":2","\"Size\":1"),
  DOC.replace("\"ID\":51","\"ID\":52"),
  DOC.replace("\"ItemID\":9876","\"ItemID\":9877"),
 ];
 for altered in candidates{
  let s=open(&altered);
  assert!(s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),&[chest(101,7)]).is_err());
  assert_eq!(s.receipt().unwrap().revision,0);
 }
 let s=open(DOC);
 let slot=TypedSemanticCommand::ChestExistingSlotAmountDecrease{
  container_id:51,slot_index:257,expected_item_id:9876,
  expected_old_amount:101,new_amount:7
 };
 assert!(s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),&[slot]).is_err());
}
#[test]
fn qa_exact_full_document_grammar_and_build_separation_before_stage(){
 for invalid in [
  DOC.replace("\"Version\":626","\"Version\":624"),
  format!("{DOC}{{}}"),
  DOC.replace("\"Amount\":1000","\"Amount\":1000,\"Amount\":999"),
 ]{
  assert!(ProductSession::open_decoded_readonly(invalid.into_bytes(),steam()).is_err());
 }
 let mut unauth=steam();unauth.externally_attested=false;
 assert!(ProductSession::open_decoded_readonly(DOC.as_bytes().to_vec(),unauth).is_err());
 let wrong=BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
  build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true};
 let s=ProductSession::open_decoded_readonly(DOC.as_bytes().to_vec(),wrong).unwrap();
 assert_eq!(s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),&[inv(42001,1000,9)])
  .unwrap_err().0,"SEMANTIC_EXACT_STEAM626_REQUIRED");
}
#[test]
fn qa_operation_registry_is_dev_only_and_product_apply_overwrite_disabled(){
 assert_eq!(TYPED_OPERATION_REGISTRY.len(),5);
 for (i,entry) in TYPED_OPERATION_REGISTRY.iter().enumerate(){
  assert_eq!(entry.schema,626);
  assert_eq!(entry.dev_implementation,i<2);
  assert!(!entry.native_v3_verified&&!entry.product_enabled);
 }
 let s=open(DOC);
 for action in [WorkerAction::Stage,WorkerAction::Apply,WorkerAction::ExportEditedCopy,WorkerAction::OriginalOverwrite]{
  assert_eq!(s.dispatch(env(&s,action)).unwrap_err().0,"PRODUCT_WRITER_DISABLED");
 }
 let r=s.receipt().unwrap();
 assert!(!r.edited_copy_authorized&&!r.apply_authorized&&!r.product_read_accepted);
}
#[test]
fn qa_seventeen_commands_reject_without_silent_first_sixteen_staging(){
 let s=open(DOC);
 let commands:Vec<_>=(0..17).map(|_|inv(42001,1000,9)).collect();
 assert_eq!(s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),&commands)
    .unwrap_err().0,"SEMANTIC_BATCH_BOUNDS");
 assert_eq!((s.receipt().unwrap().revision,s.receipt().unwrap().index_generation),(0,1));
}
