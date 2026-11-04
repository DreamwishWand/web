//! Independent 05 QR PR397 NEW delta. Synthetic local encrypted P1G only.
/// The Core derives eight source paths regardless of CALLER read-set.
/// Existence/complete source read-set does NOT imply Native V3 or Writer.
use ddv_save_core::sha256;
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::trusted_read::{
 TrustedReadCore,W1CommandIntent,SourceReadCondition, W1PreflightReceipt
};
use ddv_save_core::w1_evidence::W1Kind;

const BID:&str="9A239D3DB569756D";
const OLD:&str="2126-08-20T00:00:00Z";
const TARGET:&str="/World/RecurringEvents/155/ItemSpawning/NextOccurrence";
const DOC:&str=r#"{"GameInfo":{"Version":626},"Player":{"Unknown":"keep"},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z","EndDate":"2030-12-31T00:00:00Z","Unknown":{"retain":true}}}},"GridCollection":{"Grids":{"1540000000":{"Objects":[]}},"DiffGrids":{"1540000000":{"Modified":[]}}},"Villages":{"Village04":{"Area":"Wetland1"}},"Future":{"retain":"keep"}}}"#;
const PATHS:[&str;8]=[
 "/GameInfo/Version",
 "/World/RecurringEvents/155/ItemSpawning/RecurringEventItemID",
 "/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
 "/World/RecurringEvents/155/ItemSpawning/LastOccurrence",
 "/World/RecurringEvents/155/ItemSpawning/EndDate",
 "/World/GridCollection/Grids",
 "/World/GridCollection/DiffGrids",
 "/World/Villages"
];
fn open(doc:&str)->TrustedReadCore{
 let key=[0x32;32],registry=b"qa397-synthetic-registry-source-only";
 let ciphertext=encode_synthetic_fixture(doc.as_bytes(),&key,8).unwrap();
 TrustedReadCore::open_p1g_readonly(ciphertext.clone(),&key,
  sha256(&ciphertext),sha256(doc.as_bytes()),registry,sha256(registry),
  BID,626,128*1024*1024).unwrap()
}
fn intent<'a>(r:&'a ddv_save_core::trusted_read::OpenReadReceipt)->W1CommandIntent<'a>{
 W1CommandIntent{
  session_id:&r.session_id,expected_revision:0,expected_generation:0,
  expected_encrypted_sha256:r.roots.encrypted_source_sha256,
  expected_decoded_sha256:r.roots.decoded_json_sha256,
  expected_registry_sha256:r.roots.registry_sha256,
  expected_external_bid:BID,schema:626,event_id:2010000021,saved_index:155,
  oneof:W1Kind::ItemSpawning,pointer:TARGET,
  expected_old_raw_json:"\"2126-08-20T00:00:00Z\"",
  expected_old_utc:OLD,proposed_utc:"2026-11-04T00:00:00Z",
  source_read_set:vec![]
 }
}
fn failclosed(d:&ddv_save_core::trusted_read::W1CoreNativeReadSet){
 assert!(!d.same_build_native_registry_manifest_accepted);
 assert!(!d.effective_area_grid_diffgrid_quota_verified);
 assert!(!d.clock_actualize_last_to_next_verified);
 assert!(!d.complete_native_dependency_closure_verified);
 assert!(!d.product_writer_authorized);
}
#[test]
fn core_observes_eight_exact_source_refs_even_if_caller_omits_everything(){
 let core=open(DOC);let r=core.receipt().unwrap();
 let diag=core.diagnose_w1_core_native_read_set(intent(&r)).unwrap();
 assert!(diag.core_derived_not_caller_selected);
 assert_eq!(diag.required_source_paths_count,8);
 assert_eq!(diag.observed_core_refs.len(),8);
 assert!(diag.missing_or_unbounded_refs.is_empty());
 assert!(diag.all_known_source_refs_observed);
 for path in PATHS{
  assert!(diag.observed_core_refs.iter().any(|x|x.pointer==path),
   "missing required Core-owned path {path}");
 }
 assert_eq!(diag.source_cipher_sha256,r.roots.encrypted_source_sha256);
 assert_eq!(diag.registry_sha256,r.roots.registry_sha256);
 failclosed(&diag);
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));
 core.original_unchanged().unwrap();
}
#[test]
fn incomplete_caller_set_cannot_reduce_required_eight_path_diagnostics(){
 let core=open(DOC);let r=core.receipt().unwrap();
 let mut cmd=intent(&r);
 cmd.source_read_set.push(SourceReadCondition{
  pointer:"/GameInfo/Version".to_owned(),expected_raw_token_sha256:sha256(b"626")
 });
 let diag=core.diagnose_w1_core_native_read_set(cmd).unwrap();
 assert_eq!(diag.required_source_paths_count,8);
 assert_eq!(diag.observed_core_refs.len(),8);
 failclosed(&diag);
 // A *wrong* supplied witness still fails strict old-value/ref CAS.
 let mut wrong=intent(&r);
 wrong.source_read_set.push(SourceReadCondition{
  pointer:"/GameInfo/Version".to_owned(),expected_raw_token_sha256:[0;32]
 });
 assert_eq!(core.diagnose_w1_core_native_read_set(wrong).unwrap_err(),"W1_READ_SET_CAS_FAILED");
}
#[test]
fn every_optional_or_missing_dynamic_path_remains_explicit_unknown_and_writer_denied(){
 for path in ["/EndDate","/LastOccurrence","/DiffGrids","/Grids","/Villages"]{
  let mut doc=DOC.to_owned();
  if path=="/EndDate"{doc=doc.replace(",\"EndDate\":\"2030-12-31T00:00:00Z\"","");}
  if path=="/LastOccurrence"{doc=doc.replace(",\"LastOccurrence\":\"2026-10-01T00:00:00Z\"","");}
  if path=="/DiffGrids"{doc=doc.replace(",\"DiffGrids\":{\"1540000000\":{\"Modified\":[]}}","");}
  if path=="/Grids"{doc=doc.replace("\"Grids\":{\"1540000000\":{\"Objects\":[]}},","");}
  if path=="/Villages"{doc=doc.replace(",\"Villages\":{\"Village04\":{\"Area\":\"Wetland1\"}}","");}
  let core=open(&doc);let r=core.receipt().unwrap();
  let diag=core.diagnose_w1_core_native_read_set(intent(&r)).unwrap();
  assert!(!diag.all_known_source_refs_observed);
  assert_eq!(diag.observed_core_refs.len()+diag.missing_or_unbounded_refs.len(),8);
  assert!(diag.missing_or_unbounded_refs.iter().any(|p|p.ends_with(path)),
    "path {path} unexpectedly accepted");
  failclosed(&diag);
 }
}
#[test]
fn mismatch_source_revision_registry_event_oldvalue_and_platform_fence_before_native_diagnostics(){
 let core=open(DOC);let r=core.receipt().unwrap();
 let mut q=intent(&r);q.expected_encrypted_sha256=[0;32];
 assert_eq!(core.diagnose_w1_core_native_read_set(q).unwrap_err(),"W1_SOURCE_CAS_FAILED");
 let mut q=intent(&r);q.expected_decoded_sha256=[0;32];
 assert_eq!(core.diagnose_w1_core_native_read_set(q).unwrap_err(),"W1_SOURCE_CAS_FAILED");
 let mut q=intent(&r);q.expected_registry_sha256=[0;32];
 assert_eq!(core.diagnose_w1_core_native_read_set(q).unwrap_err(),"W1_REGISTRY_CAS_FAILED");
 let mut q=intent(&r);q.expected_revision=1;
 assert_eq!(core.diagnose_w1_core_native_read_set(q).unwrap_err(),"READ_STALE_REVISION");
 let mut q=intent(&r);q.expected_external_bid="0000000000000000";
 assert_eq!(core.diagnose_w1_core_native_read_set(q).unwrap_err(),"W1_BUILD_CAS_FAILED");
 let mut q=intent(&r);q.schema=624;
 assert_eq!(core.diagnose_w1_core_native_read_set(q).unwrap_err(),"W1_BUILD_CAS_FAILED");
 let mut q=intent(&r);q.event_id=2010500008;
 assert_eq!(core.diagnose_w1_core_native_read_set(q).unwrap_err(),"W1_NATIVE_OPERATION_NOT_MODELLED");
 core.original_unchanged().unwrap();
}
#[test]
fn derived_source_only_diagnostics_never_stage_or_export_even_with_all_eight_source_paths(){
 let mut core=open(DOC);let r=core.receipt().unwrap();
 let d=core.diagnose_w1_core_native_read_set(intent(&r)).unwrap();
 assert!(d.all_known_source_refs_observed);
 failclosed(&d);
 let fake=W1PreflightReceipt{
  exact_source_and_revision_cas:true,event_identity_and_old_raw_cas:true,
  source_read_set_cas_matched:true,required_registry_semantics_verified:true,
  complete_operation_references_verified:true,native_consumer_semantics_verified:true,
  transaction_stage_authorized:true,encode_copy_authorized:true
 };
 assert_eq!(core.stage_w1_transaction(&fake).unwrap_err(),
  "W1_OPERATION_REFERENCE_AND_NATIVE_CAPABILITY_NOT_ACCEPTED");
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));
}
