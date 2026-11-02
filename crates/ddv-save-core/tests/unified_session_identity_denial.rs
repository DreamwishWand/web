//! Independent negative: version/build/owner metadata are never general structural edits.
use ddv_save_core::session::{
 SaveSession,ReferenceIndex,LogicalIdentity,Domain,TransactionPlan,
 SemanticCommand,CommandKind
};
use std::collections::BTreeSet;
fn profile()->Vec<u8>{
 br#"{"GameInfo":{"Version":626,"LastCustomIdOwner":"real-old"},"Player":{},"World":{}}"#.to_vec()
}
fn plan(s:&SaveSession,pointer:&str,old:&str,new:&str)->TransactionPlan{
 let identity=LogicalIdentity{domain:Domain::Ownership,key:"owner".into()};
 let graph=ReferenceIndex{nodes:BTreeSet::from([identity.clone()]),edges:vec![]};
 TransactionPlan{
   session_id:s.session_id(),expected_revision:s.revision(),
   expected_source_sha256:s.source_sha256(),
   commands:vec![SemanticCommand{
     domain:Domain::Ownership,identity,kind:CommandKind::ReplaceKnownSubtree,
     pointer:pointer.into(),expected_old_json:old.into(),new_json:new.into(),
     read_set:vec![],
   }],
   postconditions:vec![],post_references:graph,
 }
}
fn open()->SaveSession{
 let identity=LogicalIdentity{domain:Domain::Ownership,key:"owner".into()};
 SaveSession::open_decoded_research(991,profile(),626,
   ReferenceIndex{nodes:BTreeSet::from([identity]),edges:vec![]}).unwrap()
}
#[test]
fn complete_gameinfo_or_owner_metadata_replacement_is_never_a_generic_command(){
 for (pointer,old,new) in [
  ("/GameInfo/LastCustomIdOwner",r#""real-old""#,r#""hijacked""#),
  ("/GameInfo",r#"{"Version":626,"LastCustomIdOwner":"real-old"}"#,
     r#"{"Version":626,"LastCustomIdOwner":"hijacked"}"#),
 ] {
   let mut s=open();
   let sha=s.source_sha256();
   assert_eq!(s.stage_command(plan(&s,pointer,old,new)).unwrap_err(),
     "IDENTITY_METADATA_WRITE_FORBIDDEN");
   assert_eq!(s.revision(),0);
   assert_eq!(s.source_sha256(),sha);
   assert_eq!(s.validate_transaction().unwrap().transaction_count,0);
   assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
 }
}
