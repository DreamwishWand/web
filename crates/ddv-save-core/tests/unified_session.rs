//! Synthetic-only unified session cross-domain overlay regression.
use ddv_save_core::session::{
 SaveSession,ReferenceIndex,ReferenceEdge,LogicalIdentity,Domain,
 TransactionPlan,SemanticCommand,CommandKind,ReadWitness,BackingKind
};
use ddv_save_core::sha256;
use std::collections::BTreeSet;

fn source()->Vec<u8>{
 br#"{
 "GameInfo":{"Version":626},
 "Player":{
  "ListInventories":{"0":[{"ItemID":1,"Quantity":1}]},
  "CollectionSets":{"1":false},
  "ContainerInventories":{"ChestA":{"Items":[{"ItemID":1,"Quantity":1}]}}
 },
 "World":{
  "GridCollection":{"Grids":{"5":{"Objects":{"3":{"ID":3,"ItemID":1,"X":4}}}}},
  "RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z"}}}
 },
 "Quest":{"Progression":{"1":{"State":"Locked"}}},
 "Unknown":{"payload":"\u00e9","integerText":"9007199254740993","decimal":1.00,"arr":[true,null]}
}"#.to_vec()
}
fn id(domain:Domain,key:&str)->LogicalIdentity{
 LogicalIdentity{domain,key:key.to_owned()}
}
fn graph()->ReferenceIndex {
 let nodes=BTreeSet::from([
  id(Domain::ListInventory,"slot:0"),
  id(Domain::CollectionSet,"set:1"),
  id(Domain::ContainerInventory,"chest:A"),
  id(Domain::Grid,"grid:5:object:3"),
  id(Domain::Progression,"quest:1"),
  id(Domain::RecurringEvent,"event:2010000021"),
 ]);
 let edges=vec![
   ReferenceEdge{from:id(Domain::Grid,"grid:5:object:3"),
     to:id(Domain::ContainerInventory,"chest:A")},
   ReferenceEdge{from:id(Domain::ListInventory,"slot:0"),
     to:id(Domain::CollectionSet,"set:1")},
 ];
 ReferenceIndex{nodes,edges}
}
fn command(domain:Domain,identity:&str,kind:CommandKind,
 pointer:&str,old:&str,new:&str)->SemanticCommand{
 SemanticCommand{domain,identity:id(domain,identity),kind,
  pointer:pointer.to_owned(),expected_old_json:old.to_owned(),new_json:new.to_owned(),
  read_set:Vec::new()}
}
fn plan(s:&SaveSession,commands:Vec<SemanticCommand>,post:ReferenceIndex)->TransactionPlan{
 TransactionPlan{session_id:s.session_id(),expected_revision:s.revision(),
 expected_source_sha256:s.source_sha256(),postconditions:commands.iter().map(|c|ReadWitness{
 pointer:c.pointer.clone(),expected_raw_json:c.new_json.clone()}).collect(),
 commands,post_references:post}
}
fn open()->SaveSession {
 SaveSession::open_decoded_research(7,source(),626,graph()).unwrap()
}
fn batch()->Vec<SemanticCommand>{
 vec![
 command(Domain::ListInventory,"slot:0",CommandKind::ReplaceKnownSubtree,
 "/Player/ListInventories/0",
 r#"[{"ItemID":1,"Quantity":1}]"#,
 r#"[{"ItemID":1,"Quantity":2},{"ItemID":5,"Quantity":1}]"#),
 command(Domain::CollectionSet,"set:1",CommandKind::ReplaceKnownSubtree,
 "/Player/CollectionSets/1","false","true"),
 command(Domain::ContainerInventory,"chest:A",CommandKind::ReplaceKnownSubtree,
 "/Player/ContainerInventories/ChestA/Items",
 r#"[{"ItemID":1,"Quantity":1}]"#,
 r#"[{"ItemID":1,"Quantity":1},{"ItemID":5,"Quantity":1}]"#),
 command(Domain::Grid,"grid:5:object:3",CommandKind::ReplaceKnownSubtree,
 "/World/GridCollection/Grids/5/Objects/3",
 r#"{"ID":3,"ItemID":1,"X":4}"#,
 r#"{"ID":3,"ItemID":1,"X":5,"State":{"nested":[1,true]}}"#),
 command(Domain::Progression,"quest:1",CommandKind::ReplaceStringToken,
 "/Quest/Progression/1/State",r#""Locked""#,r#""Ready""#),
 command(Domain::RecurringEvent,"event:2010000021",CommandKind::ReplaceStringToken,
 "/World/RecurringEvents/0/ItemSpawning/NextOccurrence",
 r#""2126-08-20T00:00:00Z""#,r#""2022-09-06T00:00:00Z""#)
 ]
}
#[test]
fn one_session_multi_domain_commit_undo_redo_and_source_unchanged(){
 let raw=source();let expected_sha=sha256(&raw);
 let mut s=open();
 assert_eq!(s.backing_kind(),BackingKind::OwnedMemory);
 assert_eq!(s.revision(),0);
 let before_generation=s.index_generation();
 let committed=s.stage_command(plan(&s,batch(),graph())).unwrap();
 assert_eq!(committed.changed_paths.len(),6);
 assert_eq!(s.revision(),1);
 assert!(s.index_generation()>before_generation);
 let keys=committed.changed_paths.clone();
 let page=s.query_paged(&keys,0,16).unwrap();
 assert_eq!(page.len(),6);
 assert!(page.iter().any(|p|p.pointer.ends_with("/NextOccurrence")&&
  p.preview_json==r#""2022-09-06T00:00:00Z""#));
 assert!(page.iter().any(|p|p.pointer.ends_with("/ListInventories/0")&&
  p.preview_json.contains(r#""ItemID":5"#)));
 assert_eq!(s.inspect_references(&id(Domain::Grid,"grid:5:object:3")).unwrap().len(),1);
 let report=s.validate_transaction().unwrap();
 assert_eq!(report.transaction_count,1);
 assert!(!report.encode_copy_authorized);
 assert!(!report.semantic_domain_guards_accepted);
 assert_ne!(report.staged_sha256,report.source_sha256);
 assert_eq!(report.source_sha256,expected_sha);
 assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
 let reverted=s.undo(1).unwrap();
 assert_eq!(reverted.changed_paths.len(),6);
 assert_eq!(s.revision(),2);
 let old=s.query_paged(&["/Player/CollectionSets/1".into()],0,2).unwrap();
 assert_eq!(old[0].preview_json,"false");
 s.redo(2).unwrap();
 assert_eq!(s.revision(),3);
 let newer=s.query_paged(&["/Player/CollectionSets/1".into()],0,2).unwrap();
 assert_eq!(newer[0].preview_json,"true");
 assert_eq!(sha256(&raw),expected_sha);
 assert_eq!(s.source_sha256(),expected_sha);
}
#[test]
fn subtree_array_insertion_but_unproven_deletion_denied_and_opaque_preserved(){
 let mut s=open();
 let add=command(Domain::ListInventory,"slot:0",CommandKind::ReplaceKnownSubtree,
 "/Player/ListInventories/0",r#"[{"ItemID":1,"Quantity":1}]"#,
 r#"[{"ItemID":1,"Quantity":1},{"ItemID":9,"State":{"Deep":true}}]"#);
 s.stage_command(plan(&s,vec![add],graph())).unwrap();
 let remove=command(Domain::ListInventory,"slot:0",CommandKind::ReplaceKnownSubtree,
 "/Player/ListInventories/0",
 r#"[{"ItemID":1,"Quantity":1},{"ItemID":9,"State":{"Deep":true}}]"#,
 r#"[{"ItemID":9,"State":{"Deep":true}}]"#);
 assert_eq!(s.stage_command(plan(&s,vec![remove],graph())).unwrap_err(),
  "STRUCTURAL_ARRAY_REMOVAL_UNVERIFIED");
 let projection=s.query_paged(&[
 "/Player/ListInventories/0".into(),"/Unknown".into()
 ],0,8).unwrap();
 assert_eq!(projection[0].preview_json,
  r#"[{"ItemID":1,"Quantity":1},{"ItemID":9,"State":{"Deep":true}}]"#);
 assert!(projection[1].preview_json.contains(r#""decimal":1.00"#));
 assert!(projection[1].preview_json.contains(r#""payload":"\u00e9""#));
 assert_eq!(s.validate_transaction().unwrap().transaction_count,1);
}
#[test]
fn stale_session_sha_revision_and_failed_mixed_transaction_do_not_mutate_history(){
 let mut s=open();
 let initial=s.source_sha256();
 let a=batch();
 let mut p=plan(&s,a.clone(),graph());p.session_id=15;
 assert_eq!(s.stage_command(p).unwrap_err(),"STALE_SESSION");
 let mut p=plan(&s,a.clone(),graph());p.expected_revision=5;
 assert_eq!(s.stage_command(p).unwrap_err(),"STALE_REVISION");
 let mut p=plan(&s,a.clone(),graph());p.expected_source_sha256=[0;32];
 assert_eq!(s.stage_command(p).unwrap_err(),"SOURCE_SHA_CAS_FAILED");
 let mut corrupted=a.clone();
 corrupted[5].new_json=r#""NOT WRONG SYNTAX""tail"#.to_owned();
 assert!(s.stage_command(plan(&s,corrupted,graph())).is_err());
 assert_eq!(s.revision(),0);
 assert_eq!(s.index_generation(),0);
 assert_eq!(s.source_sha256(),initial);
 assert_eq!(s.validate_transaction().unwrap().transaction_count,0);
}
#[test]
fn missing_reference_and_duplicate_graph_edge_fail_closed(){
 let mut s=open();
 let mut missing=graph();
 missing.nodes.remove(&id(Domain::ContainerInventory,"chest:A"));
 assert_eq!(s.stage_command(plan(&s,batch(),missing)).unwrap_err(),"REFERENCE_TARGET_MISSING");
 let mut duplicate=graph();
 duplicate.edges.push(duplicate.edges[0].clone());
 assert_eq!(s.stage_command(plan(&s,batch(),duplicate)).unwrap_err(),"DUPLICATE_REFERENCE_EDGE");
 assert_eq!(s.revision(),0);
}
#[test]
fn stale_read_witness_and_overlapping_parent_child_deny_without_partial_changes(){
 let mut s=open();
 let mut edit=batch();
 edit[0].read_set.push(ReadWitness{
  pointer:"/Quest/Progression/1/State".into(),expected_raw_json:r#""Completed""#.into()
 });
 assert_eq!(s.stage_command(plan(&s,edit,graph())).unwrap_err(),"READ_SET_CAS_FAILED");
 let parent=command(Domain::ListInventory,"slot:0",CommandKind::ReplaceKnownSubtree,
 "/Player/ListInventories",r#"{"0":[{"ItemID":1,"Quantity":1}]}"#,
 r#"{"0":[{"ItemID":5,"Quantity":1}]}"#);
 let child=batch().remove(0);
 assert_eq!(s.stage_command(plan(&s,vec![parent,child],graph())).unwrap_err(),"OVERLAPPING_COMMANDS");
 assert_eq!(s.revision(),0);
}
#[test]
fn invalid_input_utf8_duplicate_keys_unsafe_integers_and_invalid_post_tokens_refused(){
 for invalid in [
  br#"{"GameInfo":{"Version":626},"Unknown":{"x":1,"x":2}}"#.to_vec(),
  br#"{"GameInfo":{"Version":626},"Unknown":{"n":9007199254740992}}"#.to_vec(),
  br#"{"GameInfo":{"Version":626},"Unknown":{"x":"\uD800"}}"#.to_vec(),
 ]{
  assert!(SaveSession::open_decoded_research(7,invalid,626,graph()).is_err());
 }
 let mut s=open();
 let mut bad=batch();
 bad[4].new_json=r#""bad\q""#.into();
 assert!(s.stage_command(plan(&s,bad,graph())).is_err());
 assert_eq!(s.revision(),0);
}
#[test]
fn independent_session_index_lifecycle_and_undo_discard_redo_on_new_change(){
 let mut s=open();
 assert_eq!(s.query_paged(&["/Unknown/payload".into()],0,1).unwrap()[0].preview_json,r#""\u00e9""#);
 s.stage_command(plan(&s,vec![batch()[4].clone()],graph())).unwrap();
 s.undo(1).unwrap();
 let command=command(Domain::CollectionSet,"set:1",CommandKind::ReplaceKnownSubtree,
 "/Player/CollectionSets/1","false","true");
 s.stage_command(plan(&s,vec![command],graph())).unwrap();
 assert_eq!(s.redo(s.revision()).unwrap_err(),"REDO_EMPTY");
 assert_eq!(s.revision(),3);
}

#[test]
fn explicit_postcondition_mismatch_rejects_batch_and_preserves_revision(){
 let mut s=open();
 let mut p=plan(&s,batch(),graph());
 p.postconditions[2].expected_raw_json=r#"[]"#.into();
 assert_eq!(s.stage_command(p).unwrap_err(),"POSTCONDITION_FAILED");
 assert_eq!(s.revision(),0);
 assert_eq!(s.index_generation(),0);
}
#[test]
fn cached_span_index_invalidated_on_atomic_change_and_undo(){
 let mut s=open();
 let pointer="/Player/CollectionSets/1".to_owned();
 assert_eq!(s.query_paged(&[pointer.clone()],0,1).unwrap()[0].preview_json,"false");
 assert_eq!(s.query_paged(&[pointer.clone()],0,1).unwrap()[0].preview_json,"false");
 let edit=command(Domain::CollectionSet,"set:1",CommandKind::ReplaceKnownSubtree,
 "/Player/CollectionSets/1","false","true");
 s.stage_command(plan(&s,vec![edit],graph())).unwrap();
 assert_eq!(s.query_paged(&[pointer.clone()],0,1).unwrap()[0].preview_json,"true");
 s.undo(1).unwrap();
 assert_eq!(s.query_paged(&[pointer],0,1).unwrap()[0].preview_json,"false");
}
