//! Reproduce QR PR317's two known vulnerabilities against current PR312
//! and require stage-level fail closed rather than a false-positive receipt.
use ddv_save_core::session::{SaveSession,Domain,ReferenceIndex,ReferenceEdge,LogicalIdentity,
    SemanticCommand,CommandKind,TransactionPlan,ReadWitness};
use std::collections::BTreeSet;
fn id(domain:Domain,s:&str)->LogicalIdentity{LogicalIdentity{domain,key:s.into()}}
fn fixture()->Vec<u8>{
 br#"{"GameInfo":{"Version":626},"Player":{"CollectionSets":{"1":false},
 "ContainerInventories":{"A":{"Items":[]}}},
 "World":{"GridCollection":{"Grids":{"5":{"Objects":{"7":{
 "ID":7,"ItemID":1,"Container":"A","State":{"opaque":"KEEP","state":1}}}}}}},
 "RecurringEvents":{"0":{"ItemSpawning":{"NextOccurrence":"2126-08-20T00:00:00Z"}}}},
 "Unknown":{"e":"\u00e9","n":1.00}}"#.to_vec()
}
fn graph()->ReferenceIndex{
 let grid=id(Domain::Grid,"grid:5:obj:7");
 let chest=id(Domain::ContainerInventory,"chest:A");
 let set=id(Domain::CollectionSet,"set:1");
 ReferenceIndex{nodes:BTreeSet::from([grid.clone(),chest.clone(),set]),edges:vec![
  ReferenceEdge{from:grid,to:chest}
 ]}
}
fn command(domain:Domain,key:&str,path:&str,old:&str,new:&str)->SemanticCommand{
 SemanticCommand{domain,identity:id(domain,key),kind:CommandKind::ReplaceKnownSubtree,
 pointer:path.into(),expected_old_json:old.into(),new_json:new.into(),read_set:vec![]}
}
fn plan(s:&SaveSession,cmd:Vec<SemanticCommand>,post:ReferenceIndex)->TransactionPlan{
 let postconditions=cmd.iter().map(|c|ReadWitness{
  pointer:c.pointer.clone(),expected_raw_json:c.new_json.clone()}).collect();
 TransactionPlan{
  session_id:s.session_id(),expected_revision:s.revision(),
  expected_source_sha256:s.source_sha256(),commands:cmd,postconditions,
  post_references:post
 }
}
#[test]
fn qr_omitted_chest_edge_cannot_pass_stage_or_validate(){
 let raw=fixture();
 let mut s=SaveSession::open_decoded_research(11,raw.clone(),626,graph()).unwrap();
 let mut omitted=graph();
 omitted.edges.clear();
 let c=command(Domain::CollectionSet,"set:1","/Player/CollectionSets/1","false","true");
 assert_eq!(s.stage_command(plan(&s,vec![c],omitted)).unwrap_err(),"REFERENCE_CHEST_EDGE_MISSING");
 assert_eq!(s.revision(),0);
 assert_eq!(s.validate_transaction().unwrap().transaction_count,0);
 assert_eq!(s.source_sha256(),ddv_save_core::sha256(&raw));
 // Opening with a self-consistent yet source-incomplete graph is also refused.
 assert!(matches!(SaveSession::open_decoded_research(12,raw,626,{
   let mut a=graph();a.edges.clear();a
 }),Err("REFERENCE_CHEST_EDGE_MISSING")));
}
#[test]
fn qr_unknown_nested_state_deletion_and_mixed_change_are_atomic_denials(){
 let mut s=SaveSession::open_decoded_research(11,fixture(),626,graph()).unwrap();
 let drop=command(Domain::Grid,"grid:5:obj:7",
 "/World/GridCollection/Grids/5/Objects/7/State",
 r#"{"opaque":"KEEP","state":1}"#,r#"{"state":2}"#);
 let collection=command(Domain::CollectionSet,"set:1",
  "/Player/CollectionSets/1","false","true");
 assert_eq!(s.stage_command(plan(&s,vec![collection,drop],graph())).unwrap_err(),
 "STRUCTURAL_NESTED_FIELD_REMOVAL_UNVERIFIED");
 assert_eq!(s.revision(),0);
 let page=s.query_paged(&[
 "/World/GridCollection/Grids/5/Objects/7/State".into(),
 "/Player/CollectionSets/1".into()],0,2).unwrap();
 assert_eq!(page[0].preview_json,r#"{"opaque":"KEEP","state":1}"#);
 assert_eq!(page[1].preview_json,"false");
}
#[test]
fn preserving_opaque_and_chest_reference_allows_research_stage_undo_redo_only(){
 let mut s=SaveSession::open_decoded_research(11,fixture(),626,graph()).unwrap();
 let safe=command(Domain::Grid,"grid:5:obj:7",
 "/World/GridCollection/Grids/5/Objects/7/State",
 r#"{"opaque":"KEEP","state":1}"#,r#"{"opaque":"KEEP","state":2}"#);
 s.stage_command(plan(&s,vec![safe],graph())).unwrap();
 assert_eq!(s.revision(),1);
 assert_eq!(s.inspect_references(&id(Domain::Grid,"grid:5:obj:7")).unwrap().len(),1);
 s.undo(1).unwrap();
 assert_eq!(s.revision(),2);
 s.redo(2).unwrap();
 assert_eq!(s.revision(),3);
 let p=s.query_paged(&["/World/GridCollection/Grids/5/Objects/7/State".into()],0,1).unwrap();
 assert_eq!(p[0].preview_json,r#"{"opaque":"KEEP","state":2}"#);
 assert!(!s.validate_transaction().unwrap().semantic_domain_guards_accepted);
 assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
#[test]
fn missing_container_in_source_is_denied_even_if_graph_asserts_edge(){
 let raw=String::from_utf8(fixture()).unwrap().replace(r#""ContainerInventories":{"A":{"Items":[]}}"#,
 r#""ContainerInventories":{}"#);
 assert!(matches!(SaveSession::open_decoded_research(10,raw.into_bytes(),626,graph()),
 Err("REFERENCE_CHEST_TARGET_MISSING_IN_SOURCE")));
}
