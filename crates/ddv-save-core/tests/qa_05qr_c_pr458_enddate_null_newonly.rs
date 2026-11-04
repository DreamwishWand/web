//! 05 QR-C independent PR458 two-file changed-only acceptance.
 //! All encrypted P1G-shaped bytes and AES keys are synthetic test fixtures.
use ddv_save_core::sha256;
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::trusted_read::{TrustedReadCore,W1CommandIntent,OpenReadReceipt};
use ddv_save_core::w1_evidence::W1Kind;
const BID:&str="9A239D3DB569756D";
const KEY:[u8;32]=[0x17;32];
const REG:&[u8]=b"05qr-c-research-synthetic-not-a-native-registry";
const NULL_SOURCE:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-11-01T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{"10":{"Objects":{}}},"DiffGrids":{}},"Villages":[{"Areas":{"0":{"GridIDs":[10]}}}]},"Unknown":{"EndDate":"unrelated","float":1.00}}"#;
const ENDPATH:&str="/World/RecurringEvents/155/ItemSpawning/EndDate";
fn open(doc:&str)->TrustedReadCore{
 let encrypted=encode_synthetic_fixture(doc.as_bytes(),&KEY,8).unwrap();
 TrustedReadCore::open_p1g_readonly(encrypted.clone(),&KEY,
   sha256(&encrypted),sha256(doc.as_bytes()),REG,sha256(REG),BID,626,
   128*1024*1024).expect("synthetic strict P1G reads")
}
fn intent<'a>(r:&'a OpenReadReceipt)->W1CommandIntent<'a>{
 W1CommandIntent{
  session_id:&r.session_id,expected_revision:0,expected_generation:0,
  expected_encrypted_sha256:r.roots.encrypted_source_sha256,
  expected_decoded_sha256:r.roots.decoded_json_sha256,
  expected_registry_sha256:r.roots.registry_sha256,
  expected_external_bid:BID,schema:626,event_id:2010000021,saved_index:155,
  oneof:W1Kind::ItemSpawning,
  pointer:"/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
  expected_old_raw_json:"\"2126-08-20T00:00:00Z\"",
  expected_old_utc:"2126-08-20T00:00:00Z",proposed_utc:"2026-11-05T02:00:00Z",
  source_read_set:vec![]
 }
}
fn observe(doc:&str)->ddv_save_core::trusted_read::W1CoreNativeReadSet{
 let core=open(doc);let receipt=core.receipt().unwrap();
 core.diagnose_w1_core_native_read_set(intent(&receipt)).unwrap()
}
fn not_authorized(r:&ddv_save_core::trusted_read::W1CoreNativeReadSet){
 assert!(!r.same_build_native_registry_manifest_accepted);
 assert!(!r.effective_area_grid_diffgrid_quota_verified);
 assert!(!r.clock_actualize_last_to_next_verified);
 assert!(!r.complete_native_dependency_closure_verified);
 assert!(!r.product_writer_authorized);
}
#[test]
fn present_enddate_null_is_exact_four_byte_source_witness_not_native_writer_or_auto_date_repair(){
 let core=open(NULL_SOURCE);let r=core.receipt().unwrap();
 let result=core.diagnose_w1_core_native_read_set(intent(&r)).unwrap();
 assert!(result.all_known_source_refs_observed);
 assert_eq!(result.required_source_paths_count,8);
 assert_eq!(result.observed_core_refs.len(),8);
 assert!(result.missing_or_unbounded_refs.is_empty());
 let end=result.observed_core_refs.iter().find(|w|w.pointer==ENDPATH).unwrap();
 assert_eq!(end.expected_raw_token_sha256,sha256(b"null"));
 assert_eq!(result.source_cipher_sha256,r.roots.encrypted_source_sha256);
 not_authorized(&result);
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));
 assert_eq!(core.original_unchanged(),Ok(()));
 // No command accepted; intentionally future 2126 remains source data.
 assert_eq!(r.roots.schema,626);
}
#[test]
fn four_byte_true_must_not_be mistaken_for_null_and_string_null_is_distinct_witness(){
 let bad=NULL_SOURCE.replace(r#""EndDate":null"#,r#""EndDate":true"#);
 let result=observe(&bad);
 assert!(!result.all_known_source_refs_observed);
 assert!(result.missing_or_unbounded_refs.contains(&ENDPATH.to_string()));
 assert!(result.observed_core_refs.iter().all(|x|x.pointer!=ENDPATH));
 not_authorized(&result);
 // A string carrying the four letters is still a string, never null's SHA.
 let string=NULL_SOURCE.replace(r#""EndDate":null"#,r#""EndDate":"null""#);
 let r=observe(&string);
 assert!(r.all_known_source_refs_observed);
 let end=r.observed_core_refs.iter().find(|w|w.pointer==ENDPATH).unwrap();
 assert_eq!(end.expected_raw_token_sha256,sha256(br#""null""#));
 assert_ne!(end.expected_raw_token_sha256,sha256(b"null"));
 not_authorized(&r);
}
#[test]
fn caller_cannot_fill_missing_target_enddate_using_similarly_named_unknown_field(){
 let bad=NULL_SOURCE.replace(r#","EndDate":null"#,"");
 let read=observe(&bad);
 assert!(!read.all_known_source_refs_observed);
 assert!(read.missing_or_unbounded_refs.contains(&ENDPATH.to_string()));
 assert_eq!(read.observed_core_refs.len()+read.missing_or_unbounded_refs.len(),8);
 not_authorized(&read);
 // Unrelated same-key unknown string must not be promoted into native EndDate.
 assert!(bad.contains(r#""Unknown":{"EndDate":"unrelated""#));
}
#[test]
fn over_budget_enddate_token_is_rejected_before_witness_grant_and_writer_remains_off(){
 let huge="Z".repeat(2*1024*1024+19);
 let doc=NULL_SOURCE.replace(r#""EndDate":null"#,
   &format!(r#""EndDate":"{huge}""#));
 let core=open(&doc);let receipt=core.receipt().unwrap();
 let result=core.diagnose_w1_core_native_read_set(intent(&receipt));
 match result{
  Ok(read)=>{
   assert!(!read.all_known_source_refs_observed);
   assert!(read.missing_or_unbounded_refs.contains(&ENDPATH.to_string()));
   not_authorized(&read);
  }
  Err(_)=>{} // Strict bounded ref evaluation may refuse entire diagnostic.
 }
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));
 assert_eq!(core.original_unchanged(),Ok(()));
}
#[test]
fn source_scoped_enddate_witness_from_other_same_build_save_is_not_reused(){
 let core_a=open(NULL_SOURCE);let a=core_a.receipt().unwrap();
 let shifted=NULL_SOURCE.replace(r#""EndDate":null"#,
   r#""EndDate":"2030-12-31T00:00:00Z""#);
 let core_b=open(&shifted);let b=core_b.receipt().unwrap();
 let aa=core_a.diagnose_w1_core_native_read_set(intent(&a)).unwrap();
 let bb=core_b.diagnose_w1_core_native_read_set(intent(&b)).unwrap();
 assert_ne!(a.roots.decoded_json_sha256,b.roots.decoded_json_sha256);
 assert_ne!(aa.observed_core_refs.iter().find(|x|x.pointer==ENDPATH).unwrap().expected_raw_token_sha256,
  bb.observed_core_refs.iter().find(|x|x.pointer==ENDPATH).unwrap().expected_raw_token_sha256);
 assert!(core_b.diagnose_w1_core_native_read_set(intent(&a)).is_err());
 assert!(core_a.diagnose_w1_core_native_read_set(intent(&b)).is_err());
 assert!(!aa.product_writer_authorized&&!bb.product_writer_authorized);
}
