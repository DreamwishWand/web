use ddv_save_core::{sha256};
use ddv_save_core::session::{
 SaveSession,ReferenceIndex,LogicalIdentity,Domain,TransactionPlan,SemanticCommand,CommandKind
};
fn raw()->Vec<u8>{
 br#"{"GameInfo":{"Version":626},"Player":{"ListInventories":{"0":[{"ItemID":10}]},
 "CollectionSets":{"1":true},"ContainerInventories":{"ChestA":{"Items":[{"ItemID":10}]}}},
 "World":{"GridCollection":{"Grids":{"5":{"Objects":{"3":{"ID":3,"ItemID":10}}}}},
 "RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z"}}}},
 "Quest":{"Progression":{"1":{"State":"Ready"}}},"Unknown":{"lexical":1.00}}"#.to_vec()
}
fn id(domain:Domain,key:&str)->LogicalIdentity{LogicalIdentity{domain,key:key.into()}}
fn request()->Vec<(LogicalIdentity,String)>{
 vec![
  (id(Domain::ListInventory,"slot:0"),"/Player/ListInventories/0/0/ItemID".into()),
  (id(Domain::CollectionSet,"collection:1"),"/Player/CollectionSets/1".into()),
  (id(Domain::ContainerInventory,"chest:A"),"/Player/ContainerInventories/ChestA/Items/0/ItemID".into()),
  (id(Domain::Grid,"grid:5:object:3"),"/World/GridCollection/Grids/5/Objects/3/ItemID".into()),
  (id(Domain::Progression,"quest:1"),"/Quest/Progression/1/State".into()),
  (id(Domain::RecurringEvent,"event:2010000021"),
   "/World/RecurringEvents/0/ItemSpawning/RecurringEventItemID".into())
 ]
}
#[test]
fn source_scanned_exact_cross_domain_paths_are_not_full_reference_closure(){
 let bytes=raw();let mut s=SaveSession::open_decoded_research(99,bytes.clone(),626,ReferenceIndex::default()).unwrap();
 let before=s.inspect_source_reference_paths(&request()).unwrap();
 assert_eq!(before.witnessed.len(),6);
 assert_eq!(before.revision,0);
 assert_eq!(before.original_decoded_sha256,sha256(&bytes));
 assert!(!before.cross_domain_reference_closure_complete);
 assert!(!before.domain_reference_semantics_verified);
 assert!(!before.usable_for_product_writer);
 assert!(before.all_requested_paths_observed);
 // A source-derived presence witness cannot grant edit rights.
 let cmd=SemanticCommand {
  domain:Domain::CollectionSet,identity:id(Domain::CollectionSet,"collection:1"),
  kind:CommandKind::ReplaceKnownSubtree,pointer:"/Player/CollectionSets/1".into(),
  expected_old_json:"true".into(),new_json:"false".into(),read_set:vec![]
 };
 let graph=ReferenceIndex::default();
 assert_eq!(s.stage_command(TransactionPlan{
  session_id:s.session_id(),expected_revision:0,expected_source_sha256:sha256(&bytes),
  commands:vec![cmd],postconditions:vec![],post_references:graph
 }).unwrap_err(),"COMMAND_IDENTITY_NOT_INDEXED");
 assert_eq!(s.revision(),0);
 assert_eq!(s.inspect_source_reference_paths(&request()).unwrap().revision,0);
}
#[test]
fn missing_reference_scope_and_duplicate_paths_fail_closed(){
 let s=SaveSession::open_decoded_research(7,raw(),626,ReferenceIndex::default()).unwrap();
 assert_eq!(s.inspect_source_reference_paths(&[]).unwrap_err(),"SOURCE_REFERENCE_SCOPE_INVALID");
 let bad=vec![(id(Domain::Grid,"missing"),"/World/GridCollection/Grids/5/Objects/19/ItemID".into())];
 assert_eq!(s.inspect_source_reference_paths(&bad).unwrap_err(),"SOURCE_REFERENCE_PATH_MISSING");
 let same=request()[0].clone();
 assert_eq!(s.inspect_source_reference_paths(&[same.clone(),same]).unwrap_err(),"SOURCE_REFERENCE_POINTER_INVALID");
}

#[test]
fn source_reference_witness_is_invalidated_and_rederived_after_stage_and_undo(){
 use std::collections::BTreeSet;
 let raw_json=raw();
 let node=id(Domain::CollectionSet,"collection:1");
 let graph=ReferenceIndex{nodes:BTreeSet::from([node.clone()]),edges:vec![]};
 let mut s=SaveSession::open_decoded_research(33,raw_json.clone(),626,graph.clone()).unwrap();
 let scope=vec![(node.clone(),"/Player/CollectionSets/1".to_owned())];
 let original=s.inspect_source_reference_paths(&scope).unwrap();
 assert_eq!(original.revision,0);
 let cmd=SemanticCommand{
  domain:Domain::CollectionSet,identity:node,
  kind:CommandKind::ReplaceKnownSubtree,pointer:scope[0].1.clone(),
  expected_old_json:"true".into(),new_json:"false".into(),read_set:vec![]
 };
 s.stage_command(TransactionPlan {
  session_id:33,expected_revision:0,expected_source_sha256:sha256(&raw_json),
  commands:vec![cmd],postconditions:vec![],post_references:graph
 }).unwrap();
 let edited=s.inspect_source_reference_paths(&scope).unwrap();
 assert_eq!(edited.revision,1);
 assert_ne!(edited.inspected_snapshot_sha256,original.inspected_snapshot_sha256);
 assert_ne!(edited.witnessed[0].lexical_token_sha256,original.witnessed[0].lexical_token_sha256);
 assert_eq!(edited.original_decoded_sha256,original.original_decoded_sha256);
 assert!(!edited.cross_domain_reference_closure_complete);
 s.undo(1).unwrap();
 let reverted=s.inspect_source_reference_paths(&scope).unwrap();
 assert_eq!(reverted.revision,2);
 assert_eq!(reverted.inspected_snapshot_sha256,original.inspected_snapshot_sha256);
 assert_eq!(reverted.witnessed[0].lexical_token_sha256,original.witnessed[0].lexical_token_sha256);
 assert!(!reverted.usable_for_product_writer);
}
