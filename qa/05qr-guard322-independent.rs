//! 05 QR independent fixed PR322 source closure negative tests.
//! This branch is deliberately separate from current PR312 and Writer remains OFF.
use ddv_save_core::sha256;
use ddv_save_core::integrity::{audit_grid_container_source,verify_opaque_preservation,MAX_GUARDED_SOURCE_BYTES};
use ddv_save_core::session::{
 SaveSession,ReferenceIndex,ReferenceEdge,LogicalIdentity,Domain,
 SemanticCommand,CommandKind,TransactionPlan
};
use std::collections::BTreeSet;
fn id(domain:Domain,key:&str)->LogicalIdentity{LogicalIdentity{domain,key:key.into()}}
fn graph()->ReferenceIndex{
 let a=id(Domain::Grid,"grid:7:object:2");let b=id(Domain::ContainerInventory,"container:ChestX");
 ReferenceIndex{nodes:BTreeSet::from([a.clone(),b.clone()]),edges:vec![ReferenceEdge{from:a,to:b}]}
}
const GRID:&str="/World/GridCollection/Grids/7/Objects/2";
const OLD:&str=r#"{"ID":2,"X":1,"State":{"Storage":{"ContainerInventoryID":"ChestX"},"Private":{"deep":{"escaped":"\u00e9","integer":1.00}}}}"#;
fn source()->Vec<u8>{
 r#"{"GameInfo":{"Version":626},"Player":{"ContainerInventories":{"ChestX":{"Items":[]}}},"World":{"GridCollection":{"Grids":{"7":{"Objects":{"2":__OLD__}}}}},"Unknown":{"opaque":true}}"#
  .replace("__OLD__",OLD).into_bytes()
}

fn command(old:&str,new:&str)->SemanticCommand{
 SemanticCommand{domain:Domain::Grid,identity:id(Domain::Grid,"grid:7:object:2"),
 kind:CommandKind::ReplaceKnownSubtree,pointer:GRID.into(),
 expected_old_json:old.into(),new_json:new.into(),read_set:vec![]}
}
fn plan(s:&SaveSession,c:SemanticCommand)->TransactionPlan{
 TransactionPlan{session_id:s.session_id(),expected_revision:s.revision(),
 expected_source_sha256:s.source_sha256(),commands:vec![c],postconditions:vec![],post_references:graph()}
}
#[test]
fn qr322_independent_graph_omission_or_rogue_reference_is_refused(){
 let mut absent=graph();absent.edges.clear();
 assert_eq!(audit_grid_container_source(&source(),&absent).unwrap_err(),"SOURCE_REFERENCE_INDEX_INCOMPLETE_OR_CONFLICTING");
 let with_rogue=String::from_utf8(source()).unwrap().replace(r#""opaque":true"#,r#""opaque":{"ContainerInventoryID":"ChestX"}"#);
 assert_eq!(audit_grid_container_source(with_rogue.as_bytes(),&graph()).unwrap_err(),"UNKNOWN_OR_UNSCANNED_CONTAINER_REFERENCE");
 let dangling=String::from_utf8(source()).unwrap().replace(r#""ChestX":{"Items":[]}"#,r#""Other":{"Items":[]}"#);
 assert_eq!(audit_grid_container_source(dangling.as_bytes(),&graph()).unwrap_err(),"SOURCE_CONTAINER_REFERENCE_DANGLING");
}
#[test]
fn qr322_independent_opaque_nested_relexicalization_deletion_and_renaming_fails(){
 let now=source();let old=OLD;
 let after=old.replace(r#""X":1"#,r#""X":2"#);
 let mut whole=String::from_utf8(now.clone()).unwrap().replace(old,&after).into_bytes();
 let allow=[format!("{GRID}/X")];
 assert!(verify_opaque_preservation(&now,&whole,&[command(old,&after)],&allow).is_ok());
 let noncanonical=after.replace(r#""integer":1.00"#,r#""integer":1.0"#);
 whole=String::from_utf8(now.clone()).unwrap().replace(old,&noncanonical).into_bytes();
 assert_eq!(verify_opaque_preservation(&now,&whole,&[command(old,&noncanonical)],&allow).unwrap_err(),"GUARDED_OPAQUE_BYTES_CHANGED");
 let remove=after.replace(r#","integer":1.00"#,"");
 whole=String::from_utf8(now.clone()).unwrap().replace(old,&remove).into_bytes();
 assert!(verify_opaque_preservation(&now,&whole,&[command(old,&remove)],&allow).is_err());
 let unknownChanged=after.replace(r#""escaped":"\u00e9""#,r#""escaped":"changed""#);
 whole=String::from_utf8(now.clone()).unwrap().replace(old,&unknownChanged).into_bytes();
 assert_eq!(verify_opaque_preservation(&now,&whole,&[command(old,&unknownChanged)],&allow).unwrap_err(),"GUARDED_OPAQUE_BYTES_CHANGED");
}
#[test]
fn qr322_positive_unchanged_unknown_and_grids_remain_writer_denied(){
 let original=source();let mut s=SaveSession::open_decoded_research(58,original.clone(),626,graph()).unwrap();
 let new=OLD.replace(r#""X":1"#,r#""X":2"#);
 let changed=s.stage_command_source_guarded(plan(&s,command(OLD,&new)),&[format!("{GRID}/X")]).unwrap();
 assert_eq!(changed.changed_paths.len(),1);
 assert_eq!(s.revision(),1);
 let audit=audit_grid_container_source(&original,&graph()).unwrap();
 assert_eq!(audit.observed_container_links,1);
 assert!(audit.grid_container_scope_checked);
 assert!(!audit.cross_domain_reference_closure_complete);
 assert!(!audit.native_reference_semantics_verified);
 assert!(!audit.product_writer_authorized);
 let report=s.validate_transaction().unwrap();
 assert!(!report.semantic_domain_guards_accepted);
 assert!(!report.encode_copy_authorized);
 s.undo(1).unwrap();assert_eq!(s.revision(),2);
 s.redo(2).unwrap();assert_eq!(s.revision(),3);
 assert_eq!(s.source_sha256(),sha256(&original));
 assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
#[test]
fn qr322_guard_2mib_cannot_claim_full_realsave_coverage(){
 let bytes=vec![b' ';MAX_GUARDED_SOURCE_BYTES+1];
 assert_eq!(audit_grid_container_source(&bytes,&graph()).unwrap_err(),"SOURCE_GRAPH_AUDIT_UNSUPPORTED_SIZE");
}
