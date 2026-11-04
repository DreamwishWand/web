//! 05 QR new-only delta for PR475, fixed Source/CI. SYNTHETIC research only.
use ddv_save_core::{sha256,index_selected_tokens};
use ddv_save_core::trusted_read::{SourceReadCondition,W1CoreNativeReadSet};
use ddv_save_core::offline_w1_v2::private_core_bound_w1_atomic_readset;
use ddv_save_core::session::{SaveSession,ReferenceIndex,LogicalIdentity,
 Domain,SemanticCommand,CommandKind,TransactionPlan};

const DOC:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-11-05T00:00:00Z","LastOccurrence":"2026-11-04T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{"42":{"Objects":{}}},"DiffGrids":{"42":{"ModifiedObjects":{},"RemovedObjects":{}}}},"Villages":[{"SceneItemId":1540000000,"Areas":{"1":{"GridIDs":[42]}}}]},"Other":{"opaque":{"preserve":true}}}"#;
const PATHS:[&str;8]=[
 "/GameInfo/Version",
 "/World/RecurringEvents/155/ItemSpawning/RecurringEventItemID",
 "/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
 "/World/RecurringEvents/155/ItemSpawning/LastOccurrence",
 "/World/RecurringEvents/155/ItemSpawning/EndDate",
 "/World/GridCollection/Grids",
 "/World/GridCollection/DiffGrids",
 "/World/Villages"
];
fn readset(doc:&str)->W1CoreNativeReadSet{
 let hits=index_selected_tokens(doc.as_bytes(),&PATHS.map(|p|p.to_string())).unwrap();
 assert_eq!(hits.len(),8);
 W1CoreNativeReadSet {
   event_id:2010000021,saved_index:155,
   source_cipher_sha256:[1;32],registry_sha256:[2;32],
   observed_core_refs:hits.into_iter().map(|hit|SourceReadCondition{
     pointer:hit.pointer,expected_raw_token_sha256:sha256(hit.value.as_bytes())
   }).collect(),
   missing_or_unbounded_refs:vec![],required_source_paths_count:8,
   core_derived_not_caller_selected:true,all_known_source_refs_observed:true,
   same_build_native_registry_manifest_accepted:false,
   effective_area_grid_diffgrid_quota_verified:false,
   clock_actualize_last_to_next_verified:false,
   complete_native_dependency_closure_verified:false,
   product_writer_authorized:false
 }
}
fn audit(doc:&str,r:&W1CoreNativeReadSet)->Result<Vec<ddv_save_core::session::ReadWitness>,&'static str>{
 private_core_bound_w1_atomic_readset(doc.as_bytes(),sha256(doc.as_bytes()),r)
}
#[test]
fn all_eight_are_bound_to_raw_token_values_with_nullable_enddate(){
 let r=readset(DOC);
 let output=audit(DOC,&r).unwrap();
 assert_eq!(output.len(),8);
 assert_eq!(output[4].expected_raw_json,"null");
 assert_eq!(output[5].pointer,PATHS[5]);
 assert_eq!(output[6].pointer,PATHS[6]);
 assert_eq!(output.iter().map(|t|t.pointer.as_str()).collect::<Vec<_>>(),PATHS);
}
#[test]
fn full_eight_path_forgery_and_unrelated_native_grant_cannot_authorize(){
 let mut forged=readset(DOC);
 forged.observed_core_refs[0].expected_raw_token_sha256=[0;32];
 assert_eq!(audit(DOC,&forged).unwrap_err(),"OFFLINE_STAGE_CORE_SOURCE_REF_CAS_FAILED");
 let mut forged=readset(DOC);
 forged.observed_core_refs.reverse();
 assert_eq!(audit(DOC,&forged).unwrap().len(),8);
 forged.observed_core_refs.pop();
 assert_eq!(audit(DOC,&forged).unwrap_err(),"OFFLINE_STAGE_CORE_READSET_INCOMPLETE");
 let mut forged=readset(DOC);
 forged.complete_native_dependency_closure_verified=true;
 assert_eq!(audit(DOC,&forged).unwrap_err(),"OFFLINE_STAGE_CORE_READSET_INCOMPLETE");
 let mut forged=readset(DOC);
 forged.product_writer_authorized=true;
 assert_eq!(audit(DOC,&forged).unwrap_err(),"OFFLINE_STAGE_CORE_READSET_INCOMPLETE");
}
#[test]
fn changed_version_grids_next_and_last_rejected_even_with_new_decoded_hash(){
 let expected=readset(DOC);
 for changed in [
   DOC.replace("\"Version\":626","\"Version\":627"),
   DOC.replace("\"Grids\":{\"42\"","\"Grids\":{\"43\""),
   DOC.replace("\"NextOccurrence\":\"2126-11-05","\"NextOccurrence\":\"2126-11-06"),
   DOC.replace("\"LastOccurrence\":\"2026-11-04","\"LastOccurrence\":\"2026-11-05")
 ] {
   assert_ne!(changed,DOC);
   assert_eq!(audit(&changed,&expected).unwrap_err(),
     "OFFLINE_STAGE_CORE_SOURCE_REF_CAS_FAILED");
 }
}
#[test]
fn operation_witness_is_bounded_and_does_not_give_edited_copy_capability(){
 let giant="x".repeat(2*1024*1024+1);
 let big=DOC.replace("\"SceneItemId\":1540000000",
   &format!("\"SceneItemId\":1540000000,\"opaque\":\"{}\"",&giant));
 let r=readset(&big);
 assert_eq!(audit(&big,&r).unwrap_err(),"OFFLINE_STAGE_CORE_SOURCE_REF_CAS_FAILED");
 let id=LogicalIdentity{domain:Domain::RecurringEvent,key:"W1:155:2010000021".into()};
 let mut refs=ReferenceIndex::default();
 refs.nodes.insert(id.clone());
 let drift=DOC.replace("\"Grids\":{\"42\"","\"Grids\":{\"43\"");
 let mut session=SaveSession::open_decoded_research(25,drift.as_bytes().to_vec(),626,refs.clone()).unwrap();
 let stale=audit(DOC,&readset(DOC)).unwrap();
 let error=session.stage_command(TransactionPlan{
   session_id:25,expected_revision:0,expected_source_sha256:sha256(drift.as_bytes()),
   commands:vec![SemanticCommand{
     domain:Domain::RecurringEvent,identity:id,kind:CommandKind::ReplaceStringToken,
     pointer:PATHS[2].into(),
     expected_old_json:"\"2126-11-05T00:00:00Z\"".into(),
     new_json:"\"2126-11-06T00:00:00Z\"".into(),read_set:stale
   }],
   postconditions:vec![],post_references:refs
 }).unwrap_err();
 assert_eq!(error,"READ_SET_CAS_FAILED");
 assert_eq!(session.revision(),0);
 assert_eq!(session.index_generation(),0);
 assert_eq!(session.source_sha256(),sha256(drift.as_bytes()));
 assert_eq!(session.export_verified_copy().err(),
   Some("PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED"));
}
