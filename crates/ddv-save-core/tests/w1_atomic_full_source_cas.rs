//! Native research-only: full Core-owned W1 read-set is atomic, not caller-shrunk.
//! No real P1G/key, no Native V3, no product Writer or user Save in GitHub CI.
use ddv_save_core::{sha256,index_selected_tokens};
use ddv_save_core::trusted_read::{SourceReadCondition,W1CoreNativeReadSet};
use ddv_save_core::offline_w1_v2::private_core_bound_w1_atomic_readset;
use ddv_save_core::session::{SaveSession,ReferenceIndex,LogicalIdentity,
 Domain,SemanticCommand,CommandKind,TransactionPlan};
const DOC:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-08-20T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{"10":{"Objects":{}}},"DiffGrids":{}},"Villages":[{"Areas":{"0":{"GridIDs":[10]}}}]},"Unknown":{"opaque":"keep","float":1.00}}"#;
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
fn core_witness()->W1CoreNativeReadSet{
 let paths=PATHS.iter().map(|s|s.to_string()).collect::<Vec<_>>();
 let hits=index_selected_tokens(DOC.as_bytes(),&paths).unwrap();
 assert_eq!(hits.len(),8);
 let refs=hits.iter().map(|hit|SourceReadCondition{
   pointer:hit.pointer.clone(),
   expected_raw_token_sha256:sha256(hit.value.as_bytes())
 }).collect();
 W1CoreNativeReadSet{
   event_id:2010000021,saved_index:155,
   source_cipher_sha256:[1;32],registry_sha256:[2;32],
   observed_core_refs:refs,missing_or_unbounded_refs:vec![],
   required_source_paths_count:8,core_derived_not_caller_selected:true,
   all_known_source_refs_observed:true,
   same_build_native_registry_manifest_accepted:false,
   effective_area_grid_diffgrid_quota_verified:false,
   clock_actualize_last_to_next_verified:false,
   complete_native_dependency_closure_verified:false,
   product_writer_authorized:false
 }
}
fn verify(doc:&str,refset:&W1CoreNativeReadSet)->Result<Vec<ddv_save_core::session::ReadWitness>,&'static str>{
 private_core_bound_w1_atomic_readset(doc.as_bytes(),sha256(doc.as_bytes()),refset)
}
#[test]
fn exactly_eight_core_source_refs_are_required_for_same_revision_change(){
 let result=verify(DOC,&core_witness()).unwrap();
 assert_eq!(result.len(),8);
 assert_eq!(result.iter().map(|r|r.pointer.as_str()).collect::<Vec<_>>(),PATHS);
 assert_eq!(result[4].expected_raw_json,"null");
 assert_eq!(result[5].expected_raw_json,r#"{"10":{"Objects":{}}}"#);
 assert_eq!(result[6].expected_raw_json,"{}");
 assert!(result.iter().all(|x|x.pointer.starts_with('/')));
}
#[test]
fn forged_shrunk_duplicate_noncore_and_writer_witnesses_deny(){
 let mut forged=core_witness();
 forged.observed_core_refs.pop();
 assert_eq!(verify(DOC,&forged).err(),Some("OFFLINE_STAGE_CORE_READSET_INCOMPLETE"));
 let mut forged=core_witness();
 forged.observed_core_refs[1]=forged.observed_core_refs[0].clone();
 assert_eq!(verify(DOC,&forged).err(),Some("OFFLINE_STAGE_CORE_READSET_INCOMPLETE"));
 let mut forged=core_witness();
 forged.observed_core_refs[1].pointer="/Unknown/opaque".into();
 assert_eq!(verify(DOC,&forged).err(),Some("OFFLINE_STAGE_CORE_READSET_INCOMPLETE"));
 let mut forged=core_witness();
 forged.core_derived_not_caller_selected=false;
 assert_eq!(verify(DOC,&forged).err(),Some("OFFLINE_STAGE_CORE_READSET_INCOMPLETE"));
 let mut forged=core_witness();
 forged.product_writer_authorized=true;
 assert_eq!(verify(DOC,&forged).err(),Some("OFFLINE_STAGE_CORE_READSET_INCOMPLETE"));
 let mut forged=core_witness();
 forged.complete_native_dependency_closure_verified=true;
 assert_eq!(verify(DOC,&forged).err(),Some("OFFLINE_STAGE_CORE_READSET_INCOMPLETE"));
}
#[test]
fn altered_grid_villages_enddate_or_event_identity_never_passes_raw_snapshot_cas(){
 let expected=core_witness();
 for altered in [
   DOC.replace(r#""DiffGrids":{}"#,r#""DiffGrids":{"999":{"Modified":[]}}"#),
   DOC.replace(r#""GridIDs":[10]"#,r#""GridIDs":[11]"#),
   DOC.replace(r#""EndDate":null"#,r#""EndDate":"2026-12-01T00:00:00Z""#),
   DOC.replace(r#""RecurringEventItemID":2010000021"#,r#""RecurringEventItemID":2010000099"#),
 ] {
   assert_eq!(verify(&altered,&expected).err(),
     Some("OFFLINE_STAGE_CORE_SOURCE_REF_CAS_FAILED"));
 }
 let absent=DOC.replace(r#","EndDate":null"#,"");
 assert_eq!(verify(&absent,&expected).err(),
   Some("OFFLINE_STAGE_CORE_SOURCE_REF_MISSING"));
 assert_eq!(private_core_bound_w1_atomic_readset(DOC.as_bytes(),[0;32],&expected).err(),
   Some("OFFLINE_STAGE_SOURCE_SHA_CAS_FAILED"));
}
#[test]
fn stale_core_reference_rejected_by_atomic_session_before_commit_and_original_unchanged(){
 let stale=verify(DOC,&core_witness()).unwrap();
 let changed=DOC.replace(r#""DiffGrids":{}"#,r#""DiffGrids":{"42":{"Modified":[]}}"#);
 let identity=LogicalIdentity{domain:Domain::RecurringEvent,key:"W1:155:2010000021".into()};
 let mut refs=ReferenceIndex::default();
 refs.nodes.insert(identity.clone());
 let mut tx=SaveSession::open_decoded_research(77,changed.as_bytes().to_vec(),626,refs.clone()).unwrap();
 let old=r#""2126-08-20T00:00:00Z""#;
 let after=r#""2026-11-04T00:00:00Z""#;
 let err=tx.stage_command(TransactionPlan{
   session_id:77,expected_revision:0,expected_source_sha256:sha256(changed.as_bytes()),
   commands:vec![SemanticCommand{
     domain:Domain::RecurringEvent,identity,kind:CommandKind::ReplaceStringToken,
     pointer:PATHS[2].into(),expected_old_json:old.into(),new_json:after.into(),
     read_set:stale
   }],
   postconditions:vec![],post_references:refs
 }).unwrap_err();
 assert_eq!(err,"READ_SET_CAS_FAILED");
 assert_eq!(tx.revision(),0);
 assert_eq!(tx.index_generation(),0);
 assert_eq!(tx.source_sha256(),sha256(changed.as_bytes()));
 assert_eq!(tx.validate_transaction().unwrap().staged_sha256,sha256(changed.as_bytes()));
 assert_eq!(tx.export_verified_copy().err(),Some("PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED"));
}
