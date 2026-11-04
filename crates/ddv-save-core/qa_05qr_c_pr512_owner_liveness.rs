//! INDEPENDENT 05 QR-C PR512 QA-only module. CI temporarily includes it
//! in the Rust crate test harness; source lib.rs modification is in runner
//! workspace ONLY, never committed/merged to product source.
use crate::{sha256,p1g::encode_synthetic_fixture};
use crate::trusted_read::TrustedReadCore;
use crate::session::{SaveSession,ReferenceIndex,LogicalIdentity,Domain};
use std::sync::Arc;
const JSON:&str=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-11-05T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{},"DiffGrids":{}},"Villages":[]}}"#;
const KEY:[u8;32]=[0x34;32];
const REG:&[u8]=b"05qr-c-independent-synthetic-source";
fn owner()->TrustedReadCore{
 let p=encode_synthetic_fixture(JSON.as_bytes(),&KEY,8).unwrap();
 TrustedReadCore::open_p1g_readonly(p.clone(),&KEY,sha256(&p),
   sha256(JSON.as_bytes()),REG,sha256(REG),"9A239D3DB569756D",
   626,1024*1024).unwrap()
}
fn bound(core:&TrustedReadCore,id:u64)->SaveSession{
 let arc=core.borrow_decoded_snapshot_research().unwrap();
 let mut s=SaveSession::open_decoded_shared_research(
   id,arc,626,ReferenceIndex::default()).unwrap();
 s.bind_trusted_core_research(core).unwrap();
 s
}
fn identity()->LogicalIdentity{
 LogicalIdentity{domain:Domain::RecurringEvent,key:"155".into()}
}
fn expected_scope()->Vec<(LogicalIdentity,String)>{
 vec![(identity(),"/GameInfo/Version".into()),
      (identity(),"/World/RecurringEvents/155/ItemSpawning/EndDate".into())]
}
#[test]
fn close_revokes_source_derived_witness_inspection_even_if_lease_and_json_sha_remain_valid(){
 let mut c=owner();
 let mut s=bound(&c,501);
 assert_eq!(s.session_id(),501);
 let good=s.inspect_source_reference_paths(&expected_scope()).unwrap();
 assert!(good.all_requested_paths_observed);
 assert!(!good.usable_for_product_writer);
 let before=s.source_sha256();
 let first=s.query_paged(&["/GameInfo/Version".to_owned()],0,1).unwrap();
 assert_eq!(first.len(),1);
 c.close();
 assert_eq!(s.inspect_source_reference_paths(&expected_scope()).unwrap_err(),
   "CORE_STAGE_SOURCE_REVOKED");
 assert_eq!(s.inspect_references(&identity()).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
 assert_eq!(s.query_paged(&["/GameInfo/Version".to_owned()],0,1).unwrap_err(),
   "CORE_STAGE_SOURCE_REVOKED");
 assert_eq!(s.validate_transaction().unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
 assert_eq!(s.source_sha256(),before);
 assert_eq!(s.revision(),0);
 assert_eq!(s.index_generation(),0);
 assert_eq!(s.export_verified_copy().unwrap_err(),
  "PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
#[test]
fn drop_revokes_cached_read_cursor_and_repeated_inspect_without_any_revision_advance(){
 let mut s={
   let c=owner();
   let mut s=bound(&c,502);
   let first=s.query_paged(&["/GameInfo/Version".to_owned()],0,1).unwrap();
   assert_eq!(first.len(),1);
   assert_eq!(s.inspect_source_reference_paths(&expected_scope()).unwrap().witnessed.len(),2);
   s
 };
 assert_eq!(s.query_paged(&["/GameInfo/Version".to_owned()],0,1).unwrap_err(),
  "CORE_STAGE_SOURCE_REVOKED");
 assert_eq!(s.inspect_source_reference_paths(&expected_scope()).unwrap_err(),
  "CORE_STAGE_SOURCE_REVOKED");
 assert_eq!(s.validate_transaction().unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
 assert_eq!((s.revision(),s.index_generation()),(0,0));
}
#[test]
fn fresh_distinct_arc_with_identical_decoded_sha_cannot_mint_owner_liveness_token(){
 let c=owner();
 let fresh:Arc<[u8]>=Arc::from(JSON.as_bytes().to_vec());
 let mut foreign=SaveSession::open_decoded_shared_research(
   503,fresh.clone(),626,ReferenceIndex::default()).unwrap();
 assert_eq!(foreign.source_sha256(),sha256(JSON.as_bytes()));
 assert_eq!(foreign.bind_trusted_core_research(&c).unwrap_err(),
   "CORE_STAGE_SOURCE_IDENTITY_MISMATCH");
 assert!(foreign.validate_transaction().is_ok(),
  "independent research Vec/Arc remains research-only, not an owner-bound edit");
 assert_eq!(foreign.export_verified_copy().unwrap_err(),
   "PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
#[test]
fn closing_source_after_prior_binding_prevents_fresh_bind_and_later_stage_without_reopening(){
 let mut c=owner();let mut already=bound(&c,504);
 let separate_arc=c.borrow_decoded_snapshot_research().unwrap();
 c.close();
 let mut late=SaveSession::open_decoded_shared_research(
  505,separate_arc,626,ReferenceIndex::default()).unwrap();
 assert_eq!(late.bind_trusted_core_research(&c).unwrap_err(),"READ_SESSION_CLOSED");
 assert_eq!(already.validate_transaction().unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
 assert_eq!(already.bind_trusted_core_research(&c).unwrap_err(),
   "CORE_STAGE_BINDING_STATE_INVALID");
 assert_eq!((already.revision(),already.index_generation()),(0,0));
 assert_eq!(already.export_verified_copy().unwrap_err(),
   "PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
