//! W-CORE-004 / W-NATIVE-005: synthetic read-set derivation only.
 //! No private save, no device, no Native semantics promotion or Writer.
use ddv_save_core::sha256;
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::trusted_read::{TrustedReadCore,W1CommandIntent};
use ddv_save_core::w1_evidence::W1Kind;
const BID:&str="9A239D3DB569756D";
const FULL:&str=r#"{"GameInfo":{"Version":626},"Player":{"Unknown":"keep"},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z","EndDate":"2030-12-31T00:00:00Z"}}},"GridCollection":{"Grids":{"1540000000":{"Objects":[]}},"DiffGrids":{"1540000000":{"Modified":[]}}},"Villages":{"Village04":{"Area":"Wetland1"}}}}"#;
const MISSING:&str=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z"}}}}}"#;
fn open(doc:&str)->TrustedReadCore{
 let cipher=encode_synthetic_fixture(doc.as_bytes(),&[0x49;32],8).unwrap();
 TrustedReadCore::open_p1g_readonly(cipher.clone(),&[0x49;32],
  sha256(&cipher),sha256(doc.as_bytes()),b"synthetic-registry-not-native",
  sha256(b"synthetic-registry-not-native"),BID,626,128*1024*1024).unwrap()
}
fn intent<'a>(owner:&'a ddv_save_core::trusted_read::OpenReadReceipt)->W1CommandIntent<'a>{
 W1CommandIntent{
  session_id:&owner.session_id,expected_revision:0,expected_generation:0,
  expected_encrypted_sha256:owner.roots.encrypted_source_sha256,
  expected_decoded_sha256:owner.roots.decoded_json_sha256,
  expected_registry_sha256:owner.roots.registry_sha256,
  expected_external_bid:BID,schema:626,event_id:2010000021,saved_index:155,
  oneof:W1Kind::ItemSpawning,
  pointer:"/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
  expected_old_raw_json:"\"2126-08-20T00:00:00Z\"",
  expected_old_utc:"2126-08-20T00:00:00Z",proposed_utc:"2026-11-03T00:00:00Z",
  source_read_set:vec![] // malicious/omitted caller cannot shrink Core list
 }
}
#[test]
fn derived_mandatory_w1_refs_are_never_selected_by_caller(){
 let core=open(FULL);let owner=core.receipt().unwrap();
 let read=core.diagnose_w1_core_native_read_set(intent(&owner)).unwrap();
 assert!(read.core_derived_not_caller_selected);
 assert_eq!(read.event_id,2010000021);assert_eq!(read.saved_index,155);
 assert_eq!(read.required_source_paths_count,8);
 assert_eq!(read.observed_core_refs.len(),8);
 assert!(read.missing_or_unbounded_refs.is_empty());
 assert!(read.all_known_source_refs_observed);
 assert_eq!(read.source_cipher_sha256,owner.roots.encrypted_source_sha256);
 assert_eq!(read.registry_sha256,owner.roots.registry_sha256);
 // All eight source paths existing DOES NOT prove game runtime/Native effect.
 assert!(!read.same_build_native_registry_manifest_accepted);
 assert!(!read.effective_area_grid_diffgrid_quota_verified);
 assert!(!read.clock_actualize_last_to_next_verified);
 assert!(!read.complete_native_dependency_closure_verified);
 assert!(!read.product_writer_authorized);
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));
}
#[test]
fn missing_grid_diffgrid_enddate_and_village_are_reported_not_invented(){
 let core=open(MISSING);let owner=core.receipt().unwrap();
 let read=core.diagnose_w1_core_native_read_set(intent(&owner)).unwrap();
 assert!(!read.all_known_source_refs_observed);
 assert!(read.missing_or_unbounded_refs.iter().any(|x|x.ends_with("/EndDate")));
 assert!(read.missing_or_unbounded_refs.iter().any(|x|x.ends_with("/Grids")));
 assert!(read.missing_or_unbounded_refs.iter().any(|x|x.ends_with("/DiffGrids")));
 assert!(read.missing_or_unbounded_refs.iter().any(|x|x.ends_with("/Villages")));
 assert_eq!(read.observed_core_refs.len()+read.missing_or_unbounded_refs.len(),8);
 assert!(!read.product_writer_authorized);
}
#[test]
fn wrong_source_and_other_event_fail_before_native_reference_diagnostic(){
 let core=open(FULL);let owner=core.receipt().unwrap();
 let mut wrong=intent(&owner);
 wrong.expected_encrypted_sha256=[0;32];
 assert_eq!(core.diagnose_w1_core_native_read_set(wrong).unwrap_err(),"W1_SOURCE_CAS_FAILED");
 let mut wrong=intent(&owner);wrong.event_id=2010500008;
 assert_eq!(core.diagnose_w1_core_native_read_set(wrong).unwrap_err(),"W1_NATIVE_OPERATION_NOT_MODELLED");
}


#[test]
fn operation_source_gate_requires_all_eight_core_paths_even_with_empty_caller_set(){
 let core=open(FULL);
 let owner=core.receipt().unwrap();
 let witness=core.require_w1_core_operation_source_read_set(intent(&owner)).unwrap();
 assert_eq!(witness.required_source_paths_count,8);
 assert_eq!(witness.observed_core_refs.len(),8);
 assert!(witness.missing_or_unbounded_refs.is_empty());
 assert!(witness.core_derived_not_caller_selected);
 // A full known SOURCE read-set still cannot grant Native V3 or Writer.
 assert!(!witness.same_build_native_registry_manifest_accepted);
 assert!(!witness.effective_area_grid_diffgrid_quota_verified);
 assert!(!witness.clock_actualize_last_to_next_verified);
 assert!(!witness.complete_native_dependency_closure_verified);
 assert!(!witness.product_writer_authorized);
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));
}
#[test]
fn operation_source_gate_fails_closed_if_any_mandatory_ref_is_missing(){
 let core=open(MISSING);
 let owner=core.receipt().unwrap();
 let diagnosis=core.diagnose_w1_core_native_read_set(intent(&owner)).unwrap();
 assert!(!diagnosis.all_known_source_refs_observed);
 assert_eq!(core.require_w1_core_operation_source_read_set(intent(&owner)).unwrap_err(),
   "W1_CORE_MANDATORY_SOURCE_READSET_INCOMPLETE");
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));
}
#[test]
fn operation_source_gate_does_not_trust_optional_selected_ref_or_stale_source(){
 let core=open(FULL);
 let owner=core.receipt().unwrap();
 let mut wrong=intent(&owner);
 wrong.expected_decoded_sha256=[0;32];
 assert_eq!(core.require_w1_core_operation_source_read_set(wrong).unwrap_err(),
   "W1_SOURCE_CAS_FAILED");
 let mut wrong=intent(&owner);
 wrong.event_id=2010500008;
 assert_eq!(core.require_w1_core_operation_source_read_set(wrong).unwrap_err(),
   "W1_NATIVE_OPERATION_NOT_MODELLED");
 let mut wrong=intent(&owner);
 wrong.source_read_set.push(ddv_save_core::trusted_read::SourceReadCondition{
   pointer:"/GameInfo/Version".to_string(),
   expected_raw_token_sha256:[0;32]
 });
 assert_eq!(core.require_w1_core_operation_source_read_set(wrong).unwrap_err(),
   "W1_READ_SET_CAS_FAILED");
}
