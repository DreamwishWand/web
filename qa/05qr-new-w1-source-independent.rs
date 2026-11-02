//! Independent QA of NEW W1 source proof and source-derived reference witnesses.
//! No static Native semantics or P1G Writer permission is inferred.
use ddv_save_core::sha256;
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::w1_evidence::{inspect_w1_source_research,W1Identity,W1Kind};
use ddv_save_core::session::{
 SaveSession,ReferenceIndex,LogicalIdentity,Domain,SemanticCommand,
 CommandKind,TransactionPlan
};
use std::collections::BTreeSet;
const KEY:[u8;32]=[0x42;32];
const REGISTRY:&[u8]=b"SYNTHETIC_ONLY_NOT_ACTUAL_508_EVENT_REGISTRY";
fn json()->Vec<u8>{
 br#"{"GameInfo":{"Version":626},"World":{"GridCollection":{"Grids":{"5":{"Objects":{"3":{"ID":3,"Chest":"A","State":{"Unseen":"KEEP"}}}}}},"RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","Unseen":true}}}},"Player":{"ContainerInventories":{"A":{"Items":[]}}},"Unknown":{"number":1.00}}"#.to_vec()
}
fn identity()->W1Identity{
 W1Identity{event_id:2010000021,saved_index:0,variant:W1Kind::ItemSpawning}
}
#[test]
fn independent_w1_source_sha_build_registry_saved_identity_observed_only_not_authorized(){
 let profile=json();
 let encrypted=encode_synthetic_fixture(&profile,&KEY,8).unwrap();
 let src=sha256(&encrypted);
 let reg=sha256(REGISTRY);
 let w=inspect_w1_source_research(&encrypted,&KEY,REGISTRY,src,reg,
   "9A239D3DB569756D",identity(),
   "2126-08-20T00:00:00Z","2022-09-06T00:00:00Z").unwrap();
 assert_eq!(w.roots.encrypted_p1g_sha256,src);
 assert_eq!(w.roots.decoded_json_sha256,sha256(&profile));
 assert_eq!(w.roots.registry_sha256,reg);
 assert_eq!(w.identity.saved_index,0);
 assert_eq!(w.identity.event_id,2010000021);
 assert_eq!(w.decoded_old_timestamp_utc,"2126-08-20T00:00:00Z");
 assert!(!w.roots.build_cryptographically_bound_to_save);
 assert!(!w.registry_event_semantics_verified);
 assert!(!w.native_semantics_verified);
 assert!(!w.required_reference_closure_complete);
 assert!(!w.encode_copy_authorized);
 assert!(w.roots.external_build_selection_only);
 assert_eq!(w.roots.schema,626);
 assert!(w.registry_digest_matched);
 for (wrong_build,expected_reg,expected_source) in [
  ("WRONG_BUILD",reg,src),
  ("9A239D3DB569756D",[0;32],src),
  ("9A239D3DB569756D",reg,[0;32])
 ]{
  assert!(inspect_w1_source_research(&encrypted,&KEY,REGISTRY,expected_source,expected_reg,
    wrong_build,identity(),"2126-08-20T00:00:00Z","2022-09-06T00:00:00Z").is_err());
 }
 let forged=W1Identity{event_id:2010000022,..identity()};
 assert_eq!(inspect_w1_source_research(&encrypted,&KEY,REGISTRY,src,reg,
  "9A239D3DB569756D",forged,
  "2126-08-20T00:00:00Z","2022-09-06T00:00:00Z").unwrap_err(),
  "W1_SAVED_EVENT_ID_CAS_FAILED");
 assert!(inspect_w1_source_research(&encrypted,&KEY,REGISTRY,src,reg,
  "9A239D3DB569756D",identity(),
  "2126-08-20T00:00:00Z","2023-02-29T00:00:00Z").is_err());
}
#[test]
fn independent_source_paths_witness_absent_links_and_revision_never_native_closure(){
 let source=json();
 let grid=LogicalIdentity{domain:Domain::Grid,key:"object:3".into()};
 let chest=LogicalIdentity{domain:Domain::ContainerInventory,key:"A".into()};
 let mut nodes=BTreeSet::new();
 nodes.insert(grid.clone());nodes.insert(chest.clone());
 // Deliberately omit GridObject Chest->A edge despite serialized "Chest":"A".
 let graph=ReferenceIndex{nodes,edges:vec![]};
 let mut s=SaveSession::open_decoded_research(37,source.clone(),626,graph.clone()).unwrap();
 let paths=vec![
   (grid.clone(),"/World/GridCollection/Grids/5/Objects/3/Chest".to_owned()),
   (chest.clone(),"/Player/ContainerInventories/A/Items".to_owned())
 ];
 let witness=s.inspect_source_reference_paths(&paths).unwrap();
 assert_eq!(witness.witnessed.len(),2);
 assert!(witness.all_requested_paths_observed);
 assert!(!witness.cross_domain_reference_closure_complete);
 assert!(!witness.domain_reference_semantics_verified);
 assert!(!witness.usable_for_product_writer);
 assert_eq!(witness.original_decoded_sha256,sha256(&source));
 assert_eq!(s.inspect_references(&grid).unwrap().len(),0);
 let missing=vec![(grid.clone(),"/World/GridCollection/Grids/5/Objects/3/UnseenPointer".to_owned())];
 assert_eq!(s.inspect_source_reference_paths(&missing).unwrap_err(),"SOURCE_REFERENCE_PATH_MISSING");
 let cmd=SemanticCommand{
  domain:Domain::Grid,identity:grid.clone(),kind:CommandKind::ReplaceKnownSubtree,
  pointer:"/World/GridCollection/Grids/5/Objects/3/State".into(),
  expected_old_json:r#"{"Unseen":"KEEP"}"#.into(),
  new_json:r#"{"Value":2}"#.into(),read_set:vec![]
 };
 s.stage_command(TransactionPlan{
  session_id:37,expected_revision:0,expected_source_sha256:sha256(&source),
  commands:vec![cmd],postconditions:vec![],post_references:graph
 }).unwrap();
 let updated=s.inspect_source_reference_paths(&paths).unwrap();
 assert_eq!(updated.revision,1);
 assert_ne!(updated.inspected_snapshot_sha256,witness.inspected_snapshot_sha256);
 assert!(!updated.cross_domain_reference_closure_complete);
 // Source-derived path presence does not attest unknown nested State retention.
 assert!(!s.validate_transaction().unwrap().semantic_domain_guards_accepted);
 assert!(!s.validate_transaction().unwrap().encode_copy_authorized);
 s.undo(1).unwrap();
 let restored=s.inspect_source_reference_paths(&paths).unwrap();
 assert_eq!(restored.revision,2);
 assert_eq!(restored.inspected_snapshot_sha256,witness.inspected_snapshot_sha256);
 assert_eq!(s.source_sha256(),sha256(&source));
 assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}


#[test]
fn independent_new_head_mixed_domains_stale_revision_and_undo_redo_rewitness(){
 use ddv_save_core::session::{ReferenceEdge,ReadWitness};
 let before=json();let sha=sha256(&before);
 let grid=LogicalIdentity{domain:Domain::Grid,key:"obj:3".into()};
 let chest=LogicalIdentity{domain:Domain::ContainerInventory,key:"chest:A".into()};
 let ev=LogicalIdentity{domain:Domain::RecurringEvent,key:"event:2010000021".into()};
 let nodes=BTreeSet::from([grid.clone(),chest.clone(),ev.clone()]);
 let graph=ReferenceIndex{nodes,edges:vec![ReferenceEdge{from:grid.clone(),to:chest.clone()}]};
 let mut s=SaveSession::open_decoded_research(212,before,626,graph.clone()).unwrap();
 let commands=vec![
  SemanticCommand{domain:Domain::Grid,identity:grid,kind:CommandKind::ReplaceStringToken,
   pointer:"/World/GridCollection/Grids/5/Objects/3/State/Unseen".into(),
   expected_old_json:r#""KEEP""#.into(),new_json:r#""STILL_KEEP""#.into(),read_set:vec![]},
  SemanticCommand{domain:Domain::ContainerInventory,identity:chest,kind:CommandKind::ReplaceKnownSubtree,
   pointer:"/Player/ContainerInventories/A/Items".into(),
   expected_old_json:"[]".into(),new_json:r#"[{"ItemID":123}]"#.into(),read_set:vec![]},
  SemanticCommand{domain:Domain::RecurringEvent,identity:ev,kind:CommandKind::ReplaceStringToken,
   pointer:"/World/RecurringEvents/0/ItemSpawning/NextOccurrence".into(),
   expected_old_json:r#""2126-08-20T00:00:00Z""#.into(),
   new_json:r#""2022-09-06T00:00:00Z""#.into(),read_set:vec![]}
 ];
 let postconditions=commands.iter().map(|c|ReadWitness{
  pointer:c.pointer.clone(),expected_raw_json:c.new_json.clone()}).collect();
 let plan=TransactionPlan{session_id:212,expected_revision:0,expected_source_sha256:sha,
    commands,postconditions,post_references:graph};
 let stale=plan.clone();
 let first=s.stage_command(plan).unwrap();
 assert_eq!(first.changed_paths.len(),3);
 assert_eq!(s.revision(),1);
 assert_eq!(s.stage_command(stale).unwrap_err(),"STALE_REVISION");
 let probe=vec![(
  LogicalIdentity{domain:Domain::RecurringEvent,key:"event:2010000021".into()},
  "/World/RecurringEvents/0/ItemSpawning/NextOccurrence".to_owned())];
 let current=s.inspect_source_reference_paths(&probe).unwrap();
 assert_eq!(current.revision,1);
 assert!(!current.cross_domain_reference_closure_complete);
 assert!(!s.validate_transaction().unwrap().encode_copy_authorized);
 s.undo(1).unwrap();
 let reverted=s.inspect_source_reference_paths(&probe).unwrap();
 assert_eq!(reverted.revision,2);
 assert_ne!(reverted.inspected_snapshot_sha256,current.inspected_snapshot_sha256);
 s.redo(2).unwrap();
 let restored=s.inspect_source_reference_paths(&probe).unwrap();
 assert_eq!(restored.revision,3);
 assert_eq!(restored.inspected_snapshot_sha256,current.inspected_snapshot_sha256);
 assert_eq!(s.source_sha256(),sha);
 assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}


#[test]
fn independent_counterexample_nested_unknown_state_drop_is_not_a_product_write(){
 let before=json();let sha=sha256(&before);
 let obj=LogicalIdentity{domain:Domain::Grid,key:"grid:5:object:3".into()};
 let graph=ReferenceIndex{nodes:BTreeSet::from([obj.clone()]),edges:vec![]};
 let mut session=SaveSession::open_decoded_research(98,before,626,graph.clone()).unwrap();
 let cmd=SemanticCommand{
  domain:Domain::Grid,identity:obj,kind:CommandKind::ReplaceKnownSubtree,
  pointer:"/World/GridCollection/Grids/5/Objects/3/State".into(),
  expected_old_json:r#"{"Unseen":"KEEP"}"#.into(),
  new_json:r#"{"Different":1}"#.into(),read_set:vec![]
 };
 // At frozen HEAD 1909dd5 generic research subtree rewrite is allowed but
 // no semantic owner has established that Unknown was safe to remove.
 let staged=session.stage_command(TransactionPlan{
  session_id:98,expected_revision:0,expected_source_sha256:sha,
  commands:vec![cmd],postconditions:vec![],post_references:graph
 });
 assert!(staged.is_ok(),"if frozen HEAD grows a semantic guard, reassess this exact test");
 assert_eq!(session.revision(),1);
 let page=session.query_paged(
  &["/World/GridCollection/Grids/5/Objects/3/State".to_owned()],0,1).unwrap();
 assert_eq!(page[0].preview_json,r#"{"Different":1}"#);
 let receipt=session.validate_transaction().unwrap();
 assert!(!receipt.semantic_domain_guards_accepted);
 assert!(!receipt.encode_copy_authorized);
 assert!(!receipt.persistent_replace_authorized);
 assert_eq!(session.export_verified_copy().unwrap_err(),
  "PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
 assert_eq!(session.source_sha256(),sha);
}
