//! Independent 05 QR tests on frozen Wand 01A PR312 c6b152... source.
use ddv_save_core::sha256;
use ddv_save_core::session::{
 SaveSession,ReferenceIndex,ReferenceEdge,LogicalIdentity,Domain,TransactionPlan,
 SemanticCommand,CommandKind,ReadWitness
};
use std::collections::BTreeSet;
fn id(domain:Domain,key:&str)->LogicalIdentity{LogicalIdentity{domain,key:key.into()}}
fn raw()->Vec<u8>{
 br#"{"GameInfo":{"Version":626},"Player":{"ContainerInventories":{"A":{"Items":[]}},"CollectionSets":{"1":false}},"World":{"GridCollection":{"Grids":{"5":{"Objects":{"7":{"ID":7,"ItemID":5,"Container":"A","State":{"unknownNested":{"escaped":"\u00e9","n":1.00},"x":1}}}}}},"RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z"}}}},"Unknown":{"payload":"keep"}}"#.to_vec()
}
fn graph()->ReferenceIndex{
 let grid=id(Domain::Grid,"grid:5:obj:7"),chest=id(Domain::ContainerInventory,"chest:A");
 ReferenceIndex{nodes:BTreeSet::from([grid.clone(),chest.clone(),
  id(Domain::CollectionSet,"set:1"),id(Domain::RecurringEvent,"event:2010000021")]),
  edges:vec![ReferenceEdge{from:grid,to:chest}]}
}
fn open()->SaveSession{SaveSession::open_decoded_research(77,raw(),626,graph()).unwrap()}
fn command(domain:Domain,key:&str,path:&str,old:&str,new:&str,kind:CommandKind)->SemanticCommand{
 SemanticCommand{domain,identity:id(domain,key),pointer:path.into(),
   expected_old_json:old.into(),new_json:new.into(),kind,read_set:vec![]}
}
fn tx(s:&SaveSession,commands:Vec<SemanticCommand>,refs:ReferenceIndex)->TransactionPlan{
 let postconditions=commands.iter().map(|c|ReadWitness{
  pointer:c.pointer.clone(),expected_raw_json:c.new_json.clone()}).collect();
 TransactionPlan{session_id:s.session_id(),expected_revision:s.revision(),
  expected_source_sha256:s.source_sha256(),commands,postconditions,post_references:refs}
}
#[test]
fn qr_source_scan_does_not_accept_declared_chest_edge_omission(){
 let mut missing=graph();missing.edges.clear();
 assert!(matches!(SaveSession::open_decoded_research(77,raw(),626,missing.clone()),
   Err("REFERENCE_CHEST_EDGE_MISSING")));
 let mut s=open();
 let cmd=command(Domain::CollectionSet,"set:1","/Player/CollectionSets/1","false","true",
  CommandKind::ReplaceKnownSubtree);
 assert_eq!(s.stage_command(tx(&s,vec![cmd],missing)).unwrap_err(),"REFERENCE_CHEST_EDGE_MISSING");
 assert_eq!(s.revision(),0);
 assert_eq!(s.source_sha256(),sha256(&raw()));
}
#[test]
fn qr_nested_unknown_deletion_and mixed-domain batch_rejected_atomically(){
 let mut s=open();let sha=s.source_sha256();
 let drop=command(Domain::Grid,"grid:5:obj:7",
  "/World/GridCollection/Grids/5/Objects/7/State",
  r#"{"unknownNested":{"escaped":"\u00e9","n":1.00},"x":1}"#,
  r#"{"x":2}"#,CommandKind::ReplaceKnownSubtree);
 let set=command(Domain::CollectionSet,"set:1","/Player/CollectionSets/1",
  "false","true",CommandKind::ReplaceKnownSubtree);
 assert_eq!(s.stage_command(tx(&s,vec![set,drop],graph())).unwrap_err(),
   "STRUCTURAL_NESTED_FIELD_REMOVAL_UNVERIFIED");
 assert_eq!(s.revision(),0);
 assert_eq!(s.validate_transaction().unwrap().transaction_count,0);
 assert_eq!(s.source_sha256(),sha);
}
#[test]
fn qr_unknown_nested_scalar_mutation_is_still_allowed_in_research_not_writer(){
 let mut s=open();
 let change=command(Domain::Grid,"grid:5:obj:7",
  "/World/GridCollection/Grids/5/Objects/7/State",
  r#"{"unknownNested":{"escaped":"\u00e9","n":1.00},"x":1}"#,
  r#"{"unknownNested":{"escaped":"modified","n":1.00},"x":2}"#,CommandKind::ReplaceKnownSubtree);
 assert_eq!(s.stage_command(tx(&s,vec![change],graph())).unwrap().changed_paths.len(),1);
 let state=s.query_paged(&["/World/GridCollection/Grids/5/Objects/7/State".into()],0,1).unwrap();
 assert!(state[0].preview_json.contains("modified"));
 let receipt=s.validate_transaction().unwrap();
 assert!(!receipt.semantic_domain_guards_accepted);
 assert!(!receipt.encode_copy_authorized);
 assert!(!receipt.persistent_replace_authorized);
 assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
#[test]
fn qr_mixed_domains_revisions_undo_redo_source_hash_same(){
 let mut s=open(),commands=vec![
  command(Domain::CollectionSet,"set:1","/Player/CollectionSets/1",
   "false","true",CommandKind::ReplaceKnownSubtree),
  command(Domain::Grid,"grid:5:obj:7","/World/GridCollection/Grids/5/Objects/7/State/x",
   "1","2",CommandKind::ReplaceKnownSubtree),
  command(Domain::RecurringEvent,"event:2010000021",
   "/World/RecurringEvents/0/ItemSpawning/NextOccurrence",
   r#""2126-08-20T00:00:00Z""#,r#""2022-09-06T00:00:00Z""#,
   CommandKind::ReplaceStringToken)
 ];
 let sha=s.source_sha256();
 let p=tx(&s,commands.clone(),graph());let stale=p.clone();
 assert_eq!(s.stage_command(p).unwrap().changed_paths.len(),3);
 assert_eq!(s.stage_command(stale).unwrap_err(),"STALE_REVISION");
 let rev1=s.validate_transaction().unwrap().staged_sha256;
 assert_eq!(s.revision(),1);
 s.undo(1).unwrap();assert_eq!(s.revision(),2);
 s.redo(2).unwrap();assert_eq!(s.revision(),3);
 assert_eq!(s.validate_transaction().unwrap().staged_sha256,rev1);
 assert_eq!(s.source_sha256(),sha);
 assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
